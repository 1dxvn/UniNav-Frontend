"""Logs in to the local campus API with the project's seed demo user and prints routes. Args: base_url seed_py out_json"""
import json, re, sys, urllib.request

BASE, SEED, OUT = sys.argv[1:4]
password = re.search(r'DEMO_PASSWORD: str = "([^"]+)"', open(SEED, encoding="utf-8").read()).group(1)

def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"{}")

_, tok = call("POST", "/auth/login", {"username": "student", "password": password})
token = tok["access_token"]
_, places = call("GET", "/buildings")
ids = {p["name"]: p["id"] for p in places}
results = {}
pairs = [("Hall Acceso", d) for d in ("ICETEX", "Morphology Laboratory", "Elevator and Restroom Hall", "Preclinic / Dentistry Coordination")]
pairs += [(d, "Hall Acceso") for d in ("Preclinic / Dentistry Coordination",)]
pairs += [("ICETEX", "Preclinic / Dentistry Coordination"), ("Morphology Laboratory", "Preclinic / Dentistry Coordination")]
for a, b in pairs:
    status, r = call("POST", "/routes/calculate", {"origin_id": ids[a], "destination_id": ids[b], "avoid": ["stairs"]}, token)
    results[f"{a} -> {b}"] = {"status": status, "path": r.get("path"), "distance": r.get("distance"), "detail": r.get("detail")}
    print(status, f"{a} -> {b}", round(r.get("distance") or 0, 2), "|", " > ".join(r.get("path") or [str(r.get("detail"))]))
json.dump(results, open(OUT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
