"""Stateful, deterministic 2-D UGV simulation. Never connects to motors."""
import copy
import json
import math
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from .planner import OBSTACLES, plan
from .worlds import load_world, visible_objects, obj, OBJECTS

def now():
    return datetime.now(timezone.utc).isoformat()

DEFAULT_SETTINGS = {"max_speed": 0.8, "green_threshold": .75, "red_threshold": .5, "recording": True, "normalization": True, "planner": "A*", "namespace": "/drishtinav"}

class Engine:
    def __init__(self, database):
        self.db = sqlite3.connect(database, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS missions(id TEXT PRIMARY KEY,name TEXT,started_at TEXT,ended_at TEXT,mode TEXT,status TEXT,total_distance_m REAL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS telemetry_samples(id INTEGER PRIMARY KEY,mission_id TEXT,timestamp TEXT,payload TEXT);
        CREATE INDEX IF NOT EXISTS sample_mission ON telemetry_samples(mission_id,id);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,mission_id TEXT,timestamp TEXT,type TEXT,severity TEXT,message TEXT,metadata_json TEXT);
        CREATE TABLE IF NOT EXISTS configuration(key TEXT PRIMARY KEY,value TEXT);
        ''')
        self.settings = DEFAULT_SETTINGS | {r['key']: json.loads(r['value']) for r in self.db.execute('SELECT * FROM configuration')}
        self.latched = bool(self.settings.pop('_estop', False))
        self.db.execute("UPDATE missions SET status='INTERRUPTED',ended_at=? WHERE ended_at IS NULL", (now(),))
        self.db.commit()
        self.pose = [2.0, 2.0]
        self.yaw = 45.0
        self.world = load_world('woodland')
        self.base = self.world['base'].copy()
        self.obstacles = self.world.pop('obstacles')
        self.returning = False
        self.detected_ids = set()
        self.detections = []
        self.object_sequence = 0
        self.goal = [17.5, 17.5]
        plan_started = time.perf_counter()
        self.route, self.grid = plan(self.pose, self.goal, self.obstacles)
        self.plan_ms = round((time.perf_counter() - plan_started) * 1000, 2)
        self.old_route = []
        self.state = 'EMERGENCY_STOP' if self.latched else 'READY'
        self.state_before_estop = 'READY'
        self.mission = None
        self.velocity = 0.0
        self.distance = 0.0
        self.trajectory = [self.pose.copy()]
        self.events = []
        self.history = []
        self.fault = None
        self.recovery_ticks = 0
        self.replans = 0
        self.sample_timer = 0.0
        self.event('SYSTEM_READY', 'Simulation engine ready. No physical actuators connected.')
        self.update_detections()

    def update_detections(self):
        self.detections = visible_objects(self.pose,self.yaw,self.obstacles,self.fault=='camera_loss')
        for detection in self.detections:
            if detection['id'] not in self.detected_ids:
                self.detected_ids.add(detection['id'])
                self.event('OBSTACLE_DETECTED', f"{detection['label']} · {detection['id']} detected at {detection['distance_m']:.1f} m. Simulated sensor.", 'warning', detection)

    def select_world(self, ident):
        if self.latched:
            raise ValueError('Reset emergency stop before changing environment.')
        if self.mission and self.state not in ('COMPLETED','CANCELLED'):
            raise ValueError('Cancel or finish the current mission before switching environment.')
        world=load_world(ident)
        self.velocity=0
        self.pose=world['base'].copy()
        self.base=world['base'].copy()
        self.goal=world['goal'].copy()
        self.obstacles=world.pop('obstacles')
        self.world=world
        self.yaw=45.
        self.fault=None
        self.returning=False
        self.mission=None
        self.state='READY'
        self.trajectory=[self.pose.copy()]
        self.distance=0.
        self.detected_ids=set()
        self.object_sequence=0
        self.recovery_ticks=0
        self.replan('Environment loaded: '+world['name'])
        self.replans=0
        self.old_route=[]
        self.event('ENVIRONMENT_CHANGED',world['name']+' loaded. Select a goal to begin.')
        self.update_detections()

    def return_to_base(self):
        if self.latched or self.fault:
            raise ValueError('Restore healthy inputs and reset E-STOP before returning to base.')
        if math.dist(self.pose,self.base)<.12:
            raise ValueError('Rover is already at base.')
        route,_=plan(self.pose,self.base,self.obstacles)
        if not route:
            raise ValueError('No safe route to base. Vehicle remains in its current state.')
        if not self.mission or self.state in ('COMPLETED','CANCELLED'):
            self.create_mission('Return to base',self.base.copy())
        self.goal=self.base.copy()
        self.velocity=0
        self.replan('Operator requested return to base.')
        self.returning=True
        self.state='AUTONOMOUS_NAVIGATION'
        self.event('RETURN_TO_BASE','Returning to the marked home station via a collision-checked route.')
        self.persist_state()

    def event(self, kind, message, severity='info', metadata=None):
        t = now()
        cursor = self.db.execute('INSERT INTO events(mission_id,timestamp,type,severity,message,metadata_json) VALUES (?,?,?,?,?,?)', (self.mission['id'] if self.mission else None, t, kind, severity, message, json.dumps(metadata or {})))
        item = dict(id=cursor.lastrowid, timestamp=t, type=kind, severity=severity, message=message, metadata=metadata or {})
        self.events.insert(0, item)
        self.events = self.events[:100]
        self.db.commit()

    def save_settings(self, settings):
        self.settings.update(settings)
        for key, value in settings.items():
            self.db.execute('INSERT OR REPLACE INTO configuration VALUES (?,?)', (key, json.dumps(value)))
        self.db.commit()

    def safety(self):
        localization = .94 if self.fault != 'slam_loss' else .12
        perception = .92 if self.fault not in ('camera_loss', 'low_light', 'glare') else .0 if self.fault == 'camera_loss' else .38
        freshness = 0.0 if self.fault == 'camera_loss' else 1.0
        score = .30 * localization + .25 * perception + .15 * freshness + .15 * .95 + .15 * bool(self.route)
        hard_stop = self.latched or self.fault in ('camera_loss', 'slam_loss') or not self.route
        status = 'RED' if hard_stop or score < self.settings['red_threshold'] else 'AMBER' if score < self.settings['green_threshold'] or self.fault in ('low_light', 'glare') else 'GREEN'
        reason = 'OPERATOR_ESTOP' if self.latched else self.fault.upper() if self.fault else 'NO_SAFE_ROUTE' if not self.route else 'ALL_CHECKS_PASSED'
        return dict(state=status, score=round(score, 3), reason=reason, localization=localization, perception=perception, frame_age_ms=None if self.fault == 'camera_loss' else 0, latched=self.latched)

    def replan(self, reason):
        started = time.perf_counter()
        self.old_route = copy.deepcopy(self.route)
        self.route, self.grid = plan(self.pose, self.goal, self.obstacles)
        self.plan_ms = round((time.perf_counter() - started) * 1000, 2)
        self.replans += 1
        self.event('REPLAN', reason, 'info' if self.route else 'error', {'old_route': self.old_route, 'new_route': self.route, 'margin_m': .65, 'planner': 'A*'})
        if not self.route:
            self.velocity = 0
            self.state = 'STOP_AND_SCAN'

    def create_mission(self, name, goal):
        if self.latched:
            raise ValueError('Reset emergency stop before creating a mission.')
        if self.mission and self.state not in ('COMPLETED', 'CANCELLED'):
            raise ValueError('Cancel or finish the current mission before replacing it.')
        plan_started = time.perf_counter()
        route, grid = plan(self.pose, goal, self.obstacles)
        if not route:
            raise ValueError('Destination is blocked or unreachable. Choose a clear map cell.')
        self.goal, self.route, self.grid = goal, route, grid
        self.plan_ms = round((time.perf_counter() - plan_started) * 1000, 2)
        self.mission = dict(id='M-' + uuid.uuid4().hex[:8].upper(), name=name, started_at=now(), mode='SIMULATION')
        self.distance, self.replans = 0.0, 0
        self.returning = False
        self.detected_ids = set()
        self.trajectory = [self.pose.copy()]
        self.state = 'READY'
        self.db.execute('INSERT INTO missions(id,name,started_at,mode,status) VALUES (?,?,?,?,?)', (self.mission['id'], name, self.mission['started_at'], 'SIMULATION', self.state))
        self.event('MISSION_CREATED', f'{name} · destination {goal[0]:.1f}, {goal[1]:.1f} m')
        self.update_detections()
        return self.mission

    def command(self, action):
        if action == 'estop':
            if not self.latched:
                self.state_before_estop = self.state
            self.latched = True
            self.velocity = 0
            self.state = 'EMERGENCY_STOP'
            self.db.execute('INSERT OR REPLACE INTO configuration VALUES (?,?)', ('_estop', 'true'))
            self.event('EMERGENCY_STOP', 'Emergency stop latched. Motion inhibited.', 'error')
        elif action == 'reset':
            if not self.latched:
                raise ValueError('Emergency stop is not latched.')
            if self.fault or not self.route:
                raise ValueError('Restore healthy sensors and a safe route before resetting.')
            self.latched = False
            self.db.execute('INSERT OR REPLACE INTO configuration VALUES (?,?)', ('_estop', 'false'))
            self.state = self.state_before_estop if self.state_before_estop in ('COMPLETED', 'CANCELLED') else 'PAUSED' if self.mission else 'READY'
            self.event('ESTOP_RESET', 'Stop reset by operator. Explicit resume required.')
        else:
            if self.latched:
                raise ValueError('Emergency stop is latched. Reset it first.')
            if not self.mission:
                raise ValueError('Create a mission first.')
            allowed = {'start': ('READY',), 'pause': ('AUTONOMOUS_NAVIGATION', 'CAUTION_SLOW', 'STOP_AND_SCAN', 'RELOCALIZING', 'REPLANNING'), 'resume': ('PAUSED',), 'cancel': ('READY', 'PAUSED', 'AUTONOMOUS_NAVIGATION', 'CAUTION_SLOW', 'STOP_AND_SCAN', 'RELOCALIZING', 'REPLANNING')}
            if self.state not in allowed.get(action, ()):
                raise ValueError(f'Cannot {action} a mission in {self.state}.')
            if action in ('start', 'resume'):
                if self.safety()['state'] == 'RED':
                    raise ValueError('Mandatory safety checks failed. Restore sensors and route.')
                self.state = 'AUTONOMOUS_NAVIGATION'
            elif action == 'pause':
                self.state, self.velocity = 'PAUSED', 0
            elif action == 'cancel':
                self.state, self.velocity = 'CANCELLED', 0
                self.returning = False
            self.event('MISSION_' + action.upper(), f'Mission {action} accepted.')
            if action == 'cancel':
                self.finish()
        self.persist_state()

    def persist_state(self):
        if self.mission:
            self.db.execute('UPDATE missions SET status=?,total_distance_m=? WHERE id=?', (self.state, self.distance, self.mission['id']))
            self.db.commit()

    def finish(self):
        if self.mission:
            if self.settings['recording']:
                sample = self.snapshot()
                self.db.execute('INSERT INTO telemetry_samples(mission_id,timestamp,payload) VALUES (?,?,?)', (self.mission['id'], sample['timestamp'], json.dumps(sample)))
            self.db.execute('UPDATE missions SET ended_at=? WHERE id=?', (now(), self.mission['id']))
            self.persist_state()

    def scenario(self, kind, object_kind='rock'):
        if kind == 'obstacle':
            if len(self.route) < 7:
                raise ValueError('Create a longer route before injecting an obstacle.')
            target = self.route[min(10, len(self.route) - 2)]
            if object_kind not in OBJECTS or object_kind == 'building':
                raise ValueError('Unsupported obstacle type.')
            self.object_sequence += 1
            obstacle=obj(object_kind, 'NEW-'+str(self.object_sequence).zfill(2), target[0],target[1])
            self.obstacles.append(obstacle)
            self.event('OBSTACLE_PLACED',f"{obstacle['label']} · {obstacle['id']} added to the simulated world.", 'info',obstacle)
            self.update_detections()
            self.replan(f"{obstacle['label']} · {obstacle['id']} intersects the planned route.")
        elif kind == 'clear':
            self.fault = None
            self.event('SENSOR_RECOVERED', 'Simulated sensor inputs restored. Recovery checks running.')
        else:
            self.fault = kind
            self.event('SENSOR_FAULT', 'Injected scenario: ' + kind.replace('_', ' '), 'warning')
            if self.safety()['state'] == 'RED' and self.state in ('AUTONOMOUS_NAVIGATION', 'CAUTION_SLOW', 'RELOCALIZING', 'REPLANNING'):
                self.state, self.velocity, self.recovery_ticks = 'STOP_AND_SCAN', 0, 0
                self.event('SAFETY_STOP', 'Motion stopped. Waiting for valid sensor input.', 'error')
        self.update_detections()

    def tick(self, dt=.1):
        safe = self.safety()
        active = self.state in ('AUTONOMOUS_NAVIGATION', 'CAUTION_SLOW')
        if self.latched:
            self.state, self.velocity = 'EMERGENCY_STOP', 0
        elif active and safe['state'] == 'RED':
            self.state, self.velocity, self.recovery_ticks = 'STOP_AND_SCAN', 0, 0
            self.event('SAFETY_STOP', safe['reason'], 'error')
        elif self.state in ('STOP_AND_SCAN', 'RELOCALIZING', 'REPLANNING'):
            self.velocity = 0
            if safe['state'] == 'GREEN':
                self.recovery_ticks += 1
                if self.recovery_ticks == 10:
                    self.state = 'RELOCALIZING'
                    self.event('RELOCALIZING', 'Simulation: checking stable localization.')
                elif self.recovery_ticks == 25:
                    self.state = 'REPLANNING'
                    self.replan('Localization recovered; validating a fresh route.')
                elif self.recovery_ticks >= 35 and self.route:
                    self.state, self.recovery_ticks = 'AUTONOMOUS_NAVIGATION', 0
                    self.event('RECOVERY_COMPLETE', 'Stable inputs and route verified. Simulation resumed.')
            else:
                self.recovery_ticks = 0
                self.state = 'STOP_AND_SCAN'
        elif active:
            self.state = 'CAUTION_SLOW' if safe['state'] == 'AMBER' else 'AUTONOMOUS_NAVIGATION'
            self.velocity = self.settings['max_speed'] * (.35 if safe['state'] == 'AMBER' else 1)
            while self.route and math.dist(self.pose, self.route[0]) < .06:
                self.route.pop(0)
            if not self.route:
                self.state, self.velocity = 'COMPLETED', 0
                self.route = [self.goal.copy()]
                self.event('BASE_REACHED' if self.returning else 'MISSION_COMPLETE', 'Home station reached. Rover stopped.' if self.returning else f'Destination reached. {self.distance:.2f} m travelled.')
                self.returning = False
                self.finish()
            else:
                dx, dy = self.route[0][0] - self.pose[0], self.route[0][1] - self.pose[1]
                length = math.hypot(dx, dy)
                step = min(self.velocity * dt, length)
                self.pose = [self.pose[0] + dx / length * step, self.pose[1] + dy / length * step]
                self.yaw = math.degrees(math.atan2(dy, dx))
                self.distance += step
                if math.dist(self.pose, self.trajectory[-1]) > .15:
                    self.trajectory.append(self.pose.copy())
        self.sample_timer += dt
        if self.sample_timer >= .5:
            self.sample_timer = 0
            self.update_detections()
            sample = self.snapshot()
            self.history.append(dict(timestamp=sample['timestamp'], safety=safe['score'], speed=self.velocity))
            self.history = self.history[-120:]
            if self.mission and self.settings['recording'] and self.state not in ('COMPLETED', 'CANCELLED'):
                self.db.execute('INSERT INTO telemetry_samples(mission_id,timestamp,payload) VALUES (?,?,?)', (self.mission['id'], sample['timestamp'], json.dumps(sample)))
                self.persist_state()

    def snapshot(self):
        return dict(timestamp=now(), mode='SIMULATION', source='deterministic_2d_simulator', state=self.state, mission=self.mission,
            world=self.world, base=self.base, returning_to_base=self.returning, at_base=math.dist(self.pose,self.base)<.12,
            detections=self.detections, detected_count=len(self.detected_ids),
            pose=dict(x=self.pose[0], y=self.pose[1], yaw=self.yaw, frame='map', source='simulation'), goal=self.goal,
            velocity=self.velocity, distance=self.distance, remaining=sum(math.dist(a, b) for a, b in zip([self.pose] + self.route, self.route)),
            safety=self.safety(), route=self.route, old_route=self.old_route, trajectory=self.trajectory[-2000:], obstacles=self.obstacles,
            planner=dict(name='A* · 0.5 m grid', latency_ms=self.plan_ms, replans=self.replans, margin_m=.65),
            slam=dict(tracking='LOST' if self.fault == 'slam_loss' else 'SIMULATED', confidence=self.safety()['localization'], feature_count=None, drift_m=None, loop_closure=None),
            perception=dict(source='simulation_geometry', confidence=self.safety()['perception'], exposure='Dark' if self.fault == 'low_light' else 'Glare' if self.fault == 'glare' else 'Good', inference_fps=None, latency_ms=None),
            source_validity=dict(camera=False, imu=False, gps=False, motors=False), recording=self.settings['recording'], fault=self.fault)
