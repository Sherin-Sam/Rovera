import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import create_app

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('AUTH_TOKEN','')
    monkeypatch.setenv('ENABLE_REMOTE_CONTROL','false')
    with TestClient(create_app(':memory:')) as c:
        yield c

def test_api_mission_lifecycle(client):
    assert client.get('/api/health').json()['mode']=='SIMULATION'
    r=client.post('/api/mission',json={'name':'API test','goal':[4,4]})
    assert r.status_code==200
    assert client.post('/api/mission/start').status_code==200
    assert client.post('/api/estop').json()['safety']['latched']
    assert client.post('/api/mission/resume').status_code==409
    assert client.post('/api/estop/reset').json()['state']=='PAUSED'
    assert client.post('/api/mission/cancel').json()['state']=='CANCELLED'
    assert client.get('/api/logs/missions/'+r.json()['id']).status_code==200

def test_goal_and_settings_validation(client):
    assert client.post('/api/mission',json={'goal':[900,0]}).status_code==422
    assert client.post('/api/settings',json={'red_threshold':.7,'green_threshold':.6}).status_code==422
    assert client.get('/api/logs/missions/not-found').status_code==404

def test_tunnel_read_only_even_from_loopback(client):
    assert client.post('/api/estop',headers={'x-forwarded-for':'203.0.113.1'}).status_code==403

def test_csrf_origin_denied(client):
    assert client.post('/api/estop',headers={'origin':'https://untrusted.example'}).status_code==403

def test_token_required_when_configured(client,monkeypatch):
    monkeypatch.setenv('AUTH_TOKEN','test-only-secret')
    assert client.post('/api/estop').status_code==401
    assert client.post('/api/estop',headers={'Authorization':'Bearer test-only-secret'}).status_code==200

def test_websocket_is_explicitly_simulation(client):
    with client.websocket_connect('/ws/telemetry') as ws:
        data=ws.receive_json()
        assert data['mode']=='SIMULATION'
        assert not data['source_validity']['motors']

def test_corrupt_frame(client):
    assert client.post('/api/vision/analyze',content=b'not an image').status_code==409

def test_real_image_analysis(client):
    frame=np.zeros((120,160,3),dtype=np.uint8)
    ok,encoded=cv2.imencode('.jpg',frame)
    assert ok
    r=client.post('/api/vision/analyze',content=encoded.tobytes())
    assert r.status_code==200
    assert r.json()['exposure']=='Dark'
    assert r.json()['pose'] is None
    assert r.json()['segmentation'] is None

def test_calibration_requires_valid_intrinsics(client):
    assert client.post('/api/calibration/camera',json={'fx':-1}).status_code==422
