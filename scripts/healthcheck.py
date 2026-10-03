import json
from urllib.request import urlopen
with urlopen('http://127.0.0.1:8000/api/health',timeout=5) as response:
    health=json.load(response)
    print(json.dumps(health,indent=2))
    assert health['status']=='ok'
