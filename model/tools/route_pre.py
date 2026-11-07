"""A* over free space (clearance >= CLR from walls/columns/glass) from Elevator Hall to the Preclinic, then simplify."""
import sys, json, heapq, math
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely.prepared import prep
W = json.load(open(sys.argv[1], encoding="utf-8")); X = json.load(open(sys.argv[2], encoding="utf-8"))
P = lambda k: unary_union([Polygon(p["outer"], p["holes"]).buffer(0) for p in W[k]])
solid = unary_union([P("walls"), P("columns"), P("glass")])
foot = unary_union([Polygon(p["outer"], p["holes"]).buffer(0) for p in X["footprint"]])
CLR = 0.45
ok = prep(foot.difference(solid.buffer(CLR)))
x0, x1, y0, y1, h = 20, 62, 46, 58, 0.1
start, goal = (25.77, 51.97), (56.84, 51.96)
nx, ny = int((x1 - x0) / h), int((y1 - y0) / h)
cell = lambda p: (round((p[0] - x0) / h), round((p[1] - y0) / h))
pt = lambda c: (x0 + c[0] * h, y0 + c[1] * h)
free = {}
def isfree(c):
    if c not in free: free[c] = ok.contains(Point(pt(c)))
    return free[c]
s, gl = cell(start), cell(goal)
print("start free", isfree(s), "goal free", isfree(gl))
openq = [(0, s)]; came = {s: None}; cost = {s: 0}
while openq:
    _, c = heapq.heappop(openq)
    if c == gl: break
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == dy == 0: continue
            n = (c[0] + dx, c[1] + dy)
            if not (0 <= n[0] <= nx and 0 <= n[1] <= ny) or not isfree(n): continue
            nc = cost[c] + math.hypot(dx, dy)
            if nc < cost.get(n, 1e9):
                cost[n] = nc; came[n] = c
                heapq.heappush(openq, (nc + math.hypot(n[0] - gl[0], n[1] - gl[1]), n))
if gl not in came: print("no path"); sys.exit()
path = []; c = gl
while c: path.append(pt(c)); c = came[c]
path = path[::-1]
# greedy simplification: keep straight segments whose clearance stays >= CLR
wall = solid
simp = [path[0]]; i = 0
while i < len(path) - 1:
    j = len(path) - 1
    while j > i + 1 and LineString([path[i], path[j]]).distance(wall) < CLR: j -= 1
    simp.append(path[j]); i = j
print("length", round(cost[gl] * h, 2))
for p in simp: print([round(v, 2) for v in p], round(Point(p).distance(wall), 2))
for a, b in zip(simp, simp[1:]): print("seg clearance", round(LineString([a, b]).distance(wall), 3))
