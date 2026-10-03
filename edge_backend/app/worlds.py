"""Authored simulation worlds shared by planning, maps and camera rendering."""
import copy
import math
from .planner import OBSTACLES

OBJECTS = {
    'rock': dict(label='Rock', radius=.8, height=1.0, color='#90918a', risk='high'),
    'tree': dict(label='Tree', radius=.7, height=4.2, color='#487557', risk='high'),
    'pedestrian': dict(label='Pedestrian', radius=.4, height=1.75, color='#e9ad59', risk='critical'),
    'vehicle': dict(label='Parked vehicle', radius=1.7, height=1.5, width=1.7, length=3.2, shape='box', color='#729aa8', risk='high'),
    'barrier': dict(label='Road barrier', radius=1.2, height=1.0, width=2.3, length=.5, shape='box', color='#e9a35a', risk='high'),
    'cone': dict(label='Traffic cone', radius=.25, height=.65, color='#f39148', risk='caution'),
    'pothole': dict(label='Pothole', radius=.7, height=.08, color='#3f3933', risk='high'),
    'water': dict(label='Standing water', radius=1.1, height=.04, color='#567e8c', risk='high'),
    'building': dict(label='Structure', radius=2.0, height=4, width=3, length=3, shape='box', color='#9faaa4', risk='high'),
    'crate': dict(label='Cargo crate', radius=.75, height=1.3, width=1.3, length=1.3, shape='box', color='#ae8961', risk='high'),
}

def obj(kind, ident, x, y, **kwargs):
    return dict(OBJECTS[kind], kind=kind, id=ident, x=x, y=y, **kwargs)

def surface(name, kind, x, y, width, height):
    return dict(name=name, kind=kind, x=x, y=y, width=width, height=height)

WORLDS = {
 'woodland': dict(id='woodland', name='Woodland trail', description='Uneven terrain, boulders, vegetation and standing water.', ground='#7d8866', sky='#bdcfc9', base=[2.,2.], goal=[17.5,17.5],
     surfaces=[surface('Trail west','trail',4,10,3,20),surface('Trail north','trail',11,17,16,3),surface('Clearing','grass',13,8,9,8)],
     obstacles=[dict(OBJECTS[o['kind']],**o) for o in OBSTACLES]+[obj('water','W01',10,8),obj('pothole','H01',6,17)]),
 'campus': dict(id='campus', name='Campus crossing', description='Paved paths, parked vehicles, pedestrians and planted areas.', ground='#7f946c', sky='#c0d7df', base=[2.,2.],goal=[18.,18.],
     surfaces=[surface('West avenue','road',4,10,4,20),surface('North avenue','road',10,16,20,4),surface('Central walk','paving',12,8,12,3)],
     obstacles=[obj('vehicle','V01',4,8),obj('pedestrian','P01',8,8),obj('pedestrian','P02',13,16),obj('tree','T01',11,12),obj('building','B01',15,5),obj('tree','T02',7,12),obj('cone','C01',6.5,5)]),
 'construction': dict(id='construction',name='Construction site', description='Temporary barriers, safety cones, excavations and material stacks.',ground='#ad9b7d',sky='#d2d4c8',base=[2.,2.],goal=[18.,17.5],
     surfaces=[surface('Access lane','gravel',5,10,5,20),surface('Staging area','paving',14,14,10,8)],
     obstacles=[obj('barrier','BR01',6,7),obj('cone','C01',4,5),obj('cone','C02',7,5),obj('pothole','H01',10,10),obj('crate','CR01',14,6),obj('crate','CR02',15.5,8),obj('pedestrian','P01',11,15),obj('vehicle','V01',5,14)]),
 'industrial': dict(id='industrial',name='Industrial yard',description='Loading lanes, cargo, parked transport and narrow clearances.',ground='#87918d',sky='#b7c9ce',base=[2.,2.],goal=[18.,18.],
     surfaces=[surface('Loading lane','road',10,6,20,5),surface('Transit corridor','road',14,12,4,16),surface('Cargo pad','paving',5,14,7,8)],
     obstacles=[obj('crate','CR01',4,12),obj('crate','CR02',6,12),obj('crate','CR03',4,15),obj('vehicle','V01',10,6),obj('barrier','BR01',14,12),obj('pedestrian','P01',16,7),obj('building','B01',8,17),obj('cone','C01',17,14)]),
}

def load_world(ident):
    if ident not in WORLDS:
        raise ValueError('Unknown environment.')
    return copy.deepcopy(WORLDS[ident])

def visible_objects(pose, yaw, obstacles, camera_lost=False):
    """Range/FOV/occlusion model, not a neural detector. Never fabricate confidence."""
    if camera_lost:
        return []
    result=[]
    heading=math.radians(yaw)
    for o in obstacles:
        dx,dy=o['x']-pose[0],o['y']-pose[1]
        distance=math.hypot(dx,dy)
        bearing=(math.atan2(dy,dx)-heading+math.pi)%(2*math.pi)-math.pi
        if distance>12 or abs(bearing)>math.radians(38):
            continue
        blocked=False
        for other in obstacles:
            if other['id']==o['id'] or other.get('height',1)<.5 or distance<.01:
                continue
            ox,oy=other['x']-pose[0],other['y']-pose[1]
            along=(ox*dx+oy*dy)/distance
            lateral=abs(ox*dy-oy*dx)/distance
            if .1<along<distance-o['radius'] and lateral<other['radius']*.65:
                blocked=True
                break
        if not blocked:
            result.append(dict(o, distance_m=round(distance,2), bearing_deg=round(math.degrees(bearing),1), source='simulated_sensor', confidence=None))
    return sorted(result,key=lambda o:o['distance_m'])
