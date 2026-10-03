"""Measures actual local A* planning latency; does not claim perception performance."""
import statistics
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'edge_backend'))
from app.planner import plan, OBSTACLES
durations=[]
for _ in range(100):
    start=time.perf_counter()
    route,_=plan([2,2],[17.5,17.5],OBSTACLES)
    durations.append((time.perf_counter()-start)*1000)
    assert route
print(f'A* on this computer: p50={statistics.median(durations):.2f} ms; p95={sorted(durations)[94]:.2f} ms; n=100')
