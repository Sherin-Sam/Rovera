"""Deterministic metric-grid A* with footprint inflation. Simulation only."""
import heapq
import math

SIZE = 40
RESOLUTION = 0.5
OBSTACLES = [
    {"id": "R01", "x": 7.5, "y": 6.0, "radius": 1.0, "kind": "rock"},
    {"id": "T01", "x": 12.0, "y": 11.5, "radius": 0.8, "kind": "tree"},
    {"id": "R02", "x": 5.0, "y": 13.0, "radius": 1.1, "kind": "rock"},
    {"id": "T02", "x": 15.5, "y": 5.0, "radius": 0.8, "kind": "tree"},
    {"id": "R03", "x": 16.0, "y": 15.0, "radius": 1.0, "kind": "rock"},
]

def clearance(x, y, o):
    if o.get('shape') == 'box':
        dx=abs(x-o['x'])-o['width']/2
        dy=abs(y-o['y'])-o['length']/2
        return math.hypot(max(dx,0),max(dy,0))+min(max(dx,dy),0)
    return math.hypot(x-o['x'], y-o['y'])-o['radius']

def costs(obstacles):
    grid = []
    for y in range(SIZE):
        row = []
        for x in range(SIZE):
            gap = min((clearance(x * RESOLUTION,y * RESOLUTION,o) for o in obstacles), default=99)
            row.append(100 if gap <= .65 else 65 if gap < 1.0 else 25 if gap < 1.6 else 0)
        grid.append(row)
    return grid

def plan(start, goal, obstacles):
    grid = costs(obstacles)
    cell = lambda p: (round(p[0] / RESOLUTION), round(p[1] / RESOLUTION))
    s, g = cell(start), cell(goal)
    valid = lambda p: 0 <= p[0] < SIZE and 0 <= p[1] < SIZE and grid[p[1]][p[0]] < 100
    if not valid(s) or not valid(g):
        return [], grid
    queue, distance, parent = [(0, s)], {s: 0.0}, {}
    while queue:
        _, current = heapq.heappop(queue)
        if current == g:
            path = [g]
            while path[-1] != s:
                path.append(parent[path[-1]])
            return [[x * RESOLUTION, y * RESOLUTION] for x, y in reversed(path)], grid
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            nxt = (current[0] + dx, current[1] + dy)
            if not valid(nxt) or (dx and dy and (not valid((current[0] + dx, current[1])) or not valid((current[0], current[1] + dy)))):
                continue
            cost = distance[current] + math.hypot(dx, dy) * (1 + grid[nxt[1]][nxt[0]] / 30)
            if cost < distance.get(nxt, float('inf')):
                distance[nxt], parent[nxt] = cost, current
                heapq.heappush(queue, (cost + math.dist(nxt, g), nxt))
    return [], grid
