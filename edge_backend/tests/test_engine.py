import math
import pytest
from app.engine import Engine
from app.planner import plan, OBSTACLES

@pytest.fixture
def engine():
    e = Engine(':memory:')
    yield e
    e.db.close()

def start(e, goal=None):
    e.create_mission('Test mission', goal or [17.5,17.5])
    e.command('start')

def test_mission_moves_and_pause_stops(engine):
    start(engine)
    engine.tick()
    assert engine.pose != [2,2]
    engine.command('pause')
    position = engine.pose.copy()
    for _ in range(20): engine.tick()
    assert engine.pose == position
    assert engine.velocity == 0
    engine.command('resume')
    engine.tick()
    assert engine.pose != position

def test_estop_latches_and_reset_does_not_resume(engine):
    start(engine)
    engine.tick()
    engine.command('estop')
    assert engine.velocity == 0
    with pytest.raises(ValueError): engine.command('resume')
    engine.tick()
    assert engine.state == 'EMERGENCY_STOP'
    engine.command('reset')
    assert engine.state == 'PAUSED'

def test_estop_survives_restart(tmp_path):
    path = str(tmp_path/'evidence.db')
    e = Engine(path)
    e.command('estop')
    e.db.close()
    e = Engine(path)
    assert e.latched and e.state == 'EMERGENCY_STOP'
    e.db.close()

@pytest.mark.parametrize('fault',['camera_loss','slam_loss'])
def test_sensor_fault_stops_and_recovers(engine,fault):
    start(engine)
    engine.tick()
    engine.scenario(fault)
    assert engine.velocity == 0
    assert engine.state == 'STOP_AND_SCAN'
    position = engine.pose.copy()
    for _ in range(20): engine.tick()
    assert engine.pose == position
    engine.scenario('clear')
    for _ in range(36): engine.tick()
    assert engine.state == 'AUTONOMOUS_NAVIGATION'

def test_low_light_reduces_speed(engine):
    start(engine)
    engine.scenario('low_light')
    engine.tick()
    assert engine.state == 'CAUTION_SLOW'
    assert engine.velocity < engine.settings['max_speed']

def test_reset_rejects_unhealthy_inputs(engine):
    engine.command('estop')
    engine.scenario('camera_loss')
    with pytest.raises(ValueError): engine.command('reset')
    assert engine.latched

def test_new_obstacle_replans(engine):
    start(engine)
    route = engine.route.copy()
    engine.scenario('obstacle')
    assert engine.route and engine.route != route
    assert engine.replans == 1
    for p in engine.route:
        assert all(math.dist(p,[o['x'],o['y']]) > o['radius']+.65 for o in engine.obstacles)

def test_reject_overwrite_and_invalid_transitions(engine):
    start(engine)
    with pytest.raises(ValueError): engine.create_mission('Overwrite',[4,4])
    with pytest.raises(ValueError): engine.command('start')

def test_blocked_goal_rejected(engine):
    with pytest.raises(ValueError): engine.create_mission('Blocked',[7.5,6])

def test_mission_finishes_and_records(engine):
    start(engine,[3,3])
    for _ in range(60): engine.tick()
    assert engine.state == 'COMPLETED'
    assert engine.velocity == 0
    assert math.dist(engine.pose,[3,3]) < .1
    assert engine.db.execute('SELECT count(*) FROM telemetry_samples').fetchone()[0] > 0
    assert engine.db.execute('SELECT ended_at FROM missions').fetchone()[0]
    engine.command('estop')
    engine.command('reset')
    assert engine.state == 'COMPLETED'
    with pytest.raises(ValueError): engine.command('resume')

def test_deterministic_route():
    first,_=plan([2,2],[17,17],OBSTACLES)
    second,_=plan([2,2],[17,17],OBSTACLES)
    assert first==second

def test_gnss_not_required(engine):
    start(engine)
    engine.tick()
    assert not engine.snapshot()['source_validity']['gps']
    assert engine.velocity > 0
