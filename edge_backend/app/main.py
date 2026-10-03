import asyncio
import contextlib
import hmac
import json
import os
from pathlib import Path
from typing import Literal
from contextlib import asynccontextmanager

import psutil
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator
from .engine import Engine
from .worlds import WORLDS

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / '.env')

class MissionInput(BaseModel):
    name: str = Field(default='Outdoor exploration', min_length=1, max_length=80)
    goal: tuple[float, float] = (17.5, 17.5)

    @model_validator(mode='after')
    def check_goal(self):
        if not all(0.5 <= v <= 19 for v in self.goal):
            raise ValueError('Goal must be within 0.5–19 m in both axes.')
        return self

class SettingsInput(BaseModel):
    max_speed: float = Field(default=.8, ge=.1, le=1.5)
    green_threshold: float = Field(default=.75, ge=.6, le=.98)
    red_threshold: float = Field(default=.5, ge=.2, le=.7)
    recording: bool = True
    normalization: bool = True
    planner: Literal['A*'] = 'A*'
    namespace: str = Field(default='/drishtinav', pattern=r'^/[a-zA-Z0-9_/]*$', max_length=100)

    @model_validator(mode='after')
    def thresholds(self):
        if self.red_threshold >= self.green_threshold:
            raise ValueError('Red threshold must be below green threshold.')
        return self

class Scenario(BaseModel):
    kind: Literal['obstacle', 'camera_loss', 'slam_loss', 'low_light', 'glare', 'clear']
    object_kind: Literal['rock','tree','pedestrian','vehicle','barrier','cone','pothole','water','crate'] = 'rock'

class EnvironmentInput(BaseModel):
    world: Literal['woodland','campus','construction','industrial']

class Calibration(BaseModel):
    fx: float = Field(gt=0, le=100000)
    fy: float = Field(gt=0, le=100000)
    cx: float = Field(ge=0, le=10000)
    cy: float = Field(ge=0, le=10000)
    width: int = Field(gt=0, le=10000)
    height: int = Field(gt=0, le=10000)
    distortion: list[float] = Field(min_length=5, max_length=5)
    reprojection_error: float = Field(ge=0, le=20)
    @model_validator(mode='after')
    def center(self):
        if self.cx >= self.width or self.cy >= self.height:
            raise ValueError('Principal point must be within the calibrated image.')
        return self

def create_app(database=None):
    @asynccontextmanager
    async def lifespan(app):
        if os.getenv('APP_MODE', 'SIMULATION') != 'SIMULATION':
            raise RuntimeError('This console runs SIMULATION only. Live motor control is not implemented; see docs/HARDWARE.md.')
        dbpath = database or os.getenv('DATABASE_PATH', str(ROOT / 'data' / 'drishtinav.db'))
        if dbpath != ':memory:':
            Path(dbpath).parent.mkdir(parents=True, exist_ok=True)
        app.state.engine = Engine(dbpath)
        app.state.bench_lock = asyncio.Lock()
        async def run():
            while True:
                await asyncio.sleep(.1)
                app.state.engine.tick(.1)
        task = asyncio.create_task(run())
        yield
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
        app.state.engine.db.close()

    app = FastAPI(title='ROVERA Edge API', version='1.0.0', lifespan=lifespan)
    origins = [s.strip() for s in os.getenv('FRONTEND_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000').split(',')]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])

    def engine():
        return app.state.engine

    async def operator(request: Request):
        origin = request.headers.get('origin')
        if origin and origin not in origins:
            raise HTTPException(403, 'Origin is not in FRONTEND_ORIGINS.')
        forwarded = any(h in request.headers for h in ('x-forwarded-for', 'forwarded', 'cf-connecting-ip'))
        host = request.client.host if request.client else ''
        local = host in ('127.0.0.1', '::1', 'localhost', 'testclient') and not forwarded
        token = os.getenv('AUTH_TOKEN', '')
        if not local and os.getenv('ENABLE_REMOTE_CONTROL', 'false').lower() != 'true':
            raise HTTPException(403, 'Remote viewer is read-only. Use the local operator console.')
        if token:
            if not hmac.compare_digest(request.headers.get('authorization', ''), 'Bearer ' + token):
                raise HTTPException(401, 'Enter the operator token in Settings → Connection.')
        elif not local:
            raise HTTPException(403, 'AUTH_TOKEN must be configured for remote writes.')

    @app.exception_handler(ValueError)
    async def value_error(request, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=409, content={'detail': str(exc)})

    @app.get('/api/health')
    async def health():
        return dict(status='ok', mode='SIMULATION', motors_connected=False, database='connected')

    @app.get('/api/docs/deployment')
    async def deployment_guide():
        guide = ROOT / 'DEPLOYMENT.md'
        if not guide.is_file():
            raise HTTPException(404, 'Deployment guide is available in the project repository.')
        return FileResponse(guide, media_type='text/plain; charset=utf-8')

    @app.get('/api/system')
    async def system():
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(str(ROOT))
        return dict(cpu=psutil.cpu_percent(), ram=memory.percent, ram_used_gb=round(memory.used / 1024**3, 1), disk=disk.percent, gpu=None, temperature=None, battery=None, ros='NOT_CONNECTED', model='NOT_LOADED', source='edge_host', services=[dict(name=n, state=s) for n,s in [('Edge API','HEALTHY'),('SQLite recorder','HEALTHY'),('A* planner','HEALTHY'),('Simulation safety','HEALTHY'),('ROS 2 bridge','NOT_CONNECTED'),('Terrain model','NOT_LOADED'),('Motor controller','NOT_CONNECTED'),('WebRTC','NOT_CONFIGURED')]])

    @app.get('/api/telemetry')
    @app.get('/api/mission')
    async def telemetry():
        return engine().snapshot()

    @app.post('/api/mission', dependencies=[Depends(operator)])
    async def create_mission(body: MissionInput):
        return engine().create_mission(body.name, list(body.goal))

    @app.post('/api/mission/{action}', dependencies=[Depends(operator)])
    async def command(action: Literal['start','pause','resume','cancel','return-to-base']):
        if action == 'return-to-base':
            engine().return_to_base()
        else:
            engine().command(action)
        return engine().snapshot()

    @app.post('/api/estop', dependencies=[Depends(operator)])
    async def estop():
        engine().command('estop')
        return engine().snapshot()

    @app.post('/api/estop/reset', dependencies=[Depends(operator)])
    async def reset():
        engine().command('reset')
        return engine().snapshot()

    @app.post('/api/simulation/scenario', dependencies=[Depends(operator)])
    async def scenario(body: Scenario):
        engine().scenario(body.kind, body.object_kind)
        return engine().snapshot()

    @app.get('/api/simulation/environments')
    async def environments():
        return [dict(id=w['id'],name=w['name'],description=w['description'],obstacle_count=len(w['obstacles'])) for w in WORLDS.values()]

    @app.post('/api/simulation/environment', dependencies=[Depends(operator)])
    async def select_environment(body: EnvironmentInput):
        engine().select_world(body.world)
        return engine().snapshot()

    @app.get('/api/map')
    async def grid():
        return dict(resolution=.5, width=40, height=40, data=engine().grid)

    @app.get('/api/events')
    async def events():
        return engine().events

    @app.get('/api/history')
    async def history():
        return engine().history

    @app.get('/api/settings')
    async def settings():
        return {k:v for k,v in engine().settings.items() if not k.startswith('_')}

    @app.post('/api/settings', dependencies=[Depends(operator)])
    async def update_settings(body: SettingsInput):
        engine().save_settings(body.model_dump())
        engine().event('SETTINGS_SAVED', 'Operator configuration updated.')
        return body

    @app.get('/api/{module}/status')
    async def module_status(module: Literal['slam','perception','planner','calibration']):
        if module == 'calibration':
            return dict(status='IMPORTED_UNVERIFIED' if '_calibration' in engine().settings else 'NOT_CALIBRATED', camera=engine().settings.get('_calibration'), imu=None, wheel=None)
        return engine().snapshot()[module]

    @app.post('/api/calibration/camera', dependencies=[Depends(operator)])
    async def calibration(body: Calibration):
        engine().save_settings({'_calibration': body.model_dump()})
        engine().event('CALIBRATION_IMPORTED', 'Camera intrinsics imported; hardware validation still required.')
        return dict(status='IMPORTED_UNVERIFIED', camera=body)

    @app.post('/api/vision/analyze', dependencies=[Depends(operator)])
    async def analyze(request: Request):
        if app.state.bench_lock.locked():
            raise HTTPException(429, 'Previous frame still processing. Drop this frame.')
        async with app.state.bench_lock:
            data = bytearray()
            async for chunk in request.stream():
                data.extend(chunk)
                if len(data) > 2_000_000:
                    raise HTTPException(413, 'Maximum image size is 2 MB.')
            from .vision import inspect_frame
            return await asyncio.to_thread(inspect_frame, bytes(data))

    @app.get('/api/logs/missions')
    async def missions():
        return [dict(r) for r in engine().db.execute('SELECT *, (SELECT count(*) FROM telemetry_samples t WHERE t.mission_id=missions.id) AS sample_count FROM missions ORDER BY started_at DESC LIMIT 100')]

    @app.get('/api/logs/missions/{mission_id}')
    async def mission_log(mission_id: str, offset: int = 0, limit: int = 1000):
        row = engine().db.execute('SELECT * FROM missions WHERE id=?', (mission_id,)).fetchone()
        if not row:
            raise HTTPException(404, 'Mission not found.')
        limit, offset = min(max(limit, 1), 1000), max(offset, 0)
        samples = [json.loads(r[0]) for r in engine().db.execute('SELECT payload FROM telemetry_samples WHERE mission_id=? ORDER BY id LIMIT ? OFFSET ?', (mission_id,limit,offset))]
        rows = [dict(r) for r in engine().db.execute('SELECT * FROM events WHERE mission_id=? ORDER BY id', (mission_id,))]
        total = engine().db.execute('SELECT count(*) FROM telemetry_samples WHERE mission_id=?', (mission_id,)).fetchone()[0]
        return dict(mission=dict(row), samples=samples, events=rows, total=total, next_offset=offset+len(samples) if offset+len(samples)<total else None)

    @app.websocket('/ws/telemetry')
    @app.websocket('/ws/events')
    async def websocket(ws: WebSocket):
        if ws.headers.get('origin') and ws.headers['origin'] not in origins:
            await ws.close(code=1008)
            return
        await ws.accept()
        try:
            while True:
                await ws.send_json(engine().events if ws.url.path.endswith('events') else engine().snapshot())
                await asyncio.sleep(.25)
        except (WebSocketDisconnect, RuntimeError):
            pass

    dist = ROOT / 'frontend' / 'dist'
    if dist.exists():
        app.mount('/assets', StaticFiles(directory=dist / 'assets'), name='assets')
        @app.get('/{path:path}')
        async def frontend(path: str):
            if path.startswith(('api/', 'ws/')):
                raise HTTPException(404)
            candidate = (dist / path).resolve()
            if candidate.is_relative_to(dist.resolve()) and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(dist / 'index.html')
    return app

app = create_app()
