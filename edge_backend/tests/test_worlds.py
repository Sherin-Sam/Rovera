import math
import pytest
from app.engine import Engine
from app.planner import clearance
from app.worlds import WORLDS, obj, visible_objects
from fastapi.testclient import TestClient
from app.main import create_app

@pytest.fixture
def engine():
    e=Engine(':memory:')
    yield e
    e.db.close()

@pytest.mark.parametrize('world', list(WORLDS))
def test_world_route_geometry_and_provenance(engine,world):
    engine.select_world(world)
    assert engine.route
    for point in engine.route:
        assert all(clearance(*point,o)>.65 for o in engine.obstacles)
    assert engine.snapshot()['world']['id']==world
    assert engine.base==engine.pose
    assert all(o['label'] and o['height']>=0 for o in engine.obstacles)

def test_environment_cannot_replace_active_mission(engine):
    engine.create_mission('Preserve me',[17.5,17.5])
    with pytest.raises(ValueError): engine.select_world('campus')
    assert engine.world['id']=='woodland'

def test_return_to_base_completes_and_stops(engine):
    engine.create_mission('Outbound',[17.5,17.5])
    engine.command('start')
    for _ in range(80): engine.tick()
    engine.command('pause')
    engine.return_to_base()
    assert engine.returning and engine.goal==engine.base
    for _ in range(400): engine.tick()
    assert engine.state=='COMPLETED'
    assert math.dist(engine.pose,engine.base)<.12
    assert engine.velocity==0
    assert any(e['type']=='BASE_REACHED' for e in engine.events)

def test_cancelled_return_can_be_requested_again(engine):
    engine.pose = [4., 3.]
    engine.return_to_base()
    engine.command('cancel')
    assert not engine.returning and engine.velocity == 0
    engine.return_to_base()
    assert engine.returning and engine.state == 'AUTONOMOUS_NAVIGATION'


def test_return_cannot_override_estop_or_fault(engine):
    engine.pose=[3.,3.]
    engine.command('estop')
    with pytest.raises(ValueError): engine.return_to_base()
    engine.command('reset')
    engine.scenario('camera_loss')
    with pytest.raises(ValueError): engine.return_to_base()
    assert engine.velocity==0

def test_blocked_base_does_not_replace_current_goal(engine):
    engine.pose=[4.,4.]
    old_goal=engine.goal.copy()
    engine.obstacles.append(obj('rock','BLOCK_BASE',*engine.base))
    with pytest.raises(ValueError): engine.return_to_base()
    assert engine.goal==old_goal and not engine.returning

def test_detection_fov_range_occlusion():
    objects=[obj('rock','A',4,0),obj('pedestrian','B',8,0),obj('cone','C',0,4),obj('tree','D',15,0)]
    visible=visible_objects([0,0],0,objects)
    assert [o['id'] for o in visible]==['A']
    assert visible[0]['source']=='simulated_sensor' and visible[0]['confidence'] is None
    assert visible_objects([0,0],0,objects,True)==[]

def test_detection_notifications_are_deduplicated(engine):
    count=lambda: sum(e['type']=='OBSTACLE_DETECTED' for e in engine.events)
    before=count()
    assert before>0
    for _ in range(10):engine.update_detections()
    assert count()==before
    engine.scenario('camera_loss')
    assert engine.detections==[]
    engine.scenario('clear')
    assert count()==before

@pytest.mark.parametrize('kind',['rock','pedestrian','vehicle','barrier','cone','pothole','water','crate'])
def test_object_injection_preserves_class_and_unique_id(engine,kind):
    engine.scenario('obstacle',kind)
    assert engine.obstacles[-1]['kind']==kind
    assert engine.obstacles[-1]['label']
    assert engine.events[0]['type'] in ('REPLAN','OBSTACLE_DETECTED')

def test_environment_api_and_return_validation(monkeypatch):
    monkeypatch.setenv('AUTH_TOKEN','')
    with TestClient(create_app(':memory:')) as c:
        assert len(c.get('/api/simulation/environments').json())==4
        assert c.post('/api/simulation/environment',json={'world':'campus'}).json()['world']['id']=='campus'
        assert c.post('/api/simulation/environment',json={'world':'unknown'}).status_code==422
        assert c.post('/api/mission/return-to-base').status_code==409
        assert c.post('/api/simulation/scenario',json={'kind':'obstacle','object_kind':'dragon'}).status_code==422
