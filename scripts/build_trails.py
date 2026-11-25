"""Fetch real OpenStreetMap hiking trail geometry for hike stops in docs/trip.json.

Uses the official OpenStreetMap 0.6 bbox JSON API to load all footways/paths/tracks/steps
around each hike, snaps waypoints to the trail network, runs Dijkstra along real trail
nodes, and stores the encoded polyline in `geom` on the hike stop (and optional hikes).

Usage:
  python3 scripts/build_trails.py
"""

import heapq
import json
import math
import time
import urllib.request
from pathlib import Path

TRIP = Path(__file__).resolve().parent.parent / "docs" / "trip.json"
UA = {"User-Agent": "nordic-trip-planner/1.0 (personal trip page)", "Accept": "application/json"}
WALK_HW = {"path", "footway", "steps", "track", "bridleway", "pedestrian", "cycleway", "service", "unclassified", "tertiary", "residential"}


def dist_km(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111.2, (a[1] - b[1]) * 111.32 * k)


def encode(points):
    out, plat, plon = [], 0, 0
    for lat, lon in points:
        ilat, ilon = round(lat * 1e5), round(lon * 1e5)
        for v in (ilat - plat, ilon - plon):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        plat, plon = ilat, ilon
    return "".join(out)


def load_osm_graph(bbox):
    min_lon, min_lat, max_lon, max_lat = bbox
    url = f"https://api.openstreetmap.org/api/0.6/map.json?bbox={min_lon:.5f},{min_lat:.5f},{max_lon:.5f},{max_lat:.5f}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    nodes = {}
    for el in data["elements"]:
        if el["type"] == "node":
            nodes[el["id"]] = (el["lat"], el["lon"])
    adj = {}
    for el in data["elements"]:
        if el["type"] != "way":
            continue
        hw = el.get("tags", {}).get("highway")
        if hw not in WALK_HW:
            continue
        # Prefer genuine footpaths/trails slightly over paved roads when parallel
        penalty = 1.0 if hw in {"path", "footway", "steps", "track"} else 1.25
        nds = [n for n in el.get("nodes", []) if n in nodes]
        for a, b in zip(nds, nds[1:]):
            d = dist_km(nodes[a], nodes[b]) * penalty
            adj.setdefault(a, []).append((b, d))
            adj.setdefault(b, []).append((a, d))
    return nodes, adj


def nearest_node(pt, nodes, adj):
    best_id, best_d = None, 1e9
    for nid in adj:
        d = dist_km(pt, nodes[nid])
        if d < best_d:
            best_id, best_d = nid, d
    return best_id


def shortest_path(start, goal, nodes, adj):
    pq = [(0.0, start)]
    cost = {start: 0.0}
    prev = {}
    while pq:
        c, u = heapq.heappop(pq)
        if u == goal:
            break
        if c > cost.get(u, 1e9):
            continue
        for v, w in adj.get(u, ()):
            nc = c + w
            if nc < cost.get(v, 1e9):
                cost[v] = nc
                prev[v] = u
                heapq.heappush(pq, (nc, v))
    if goal not in cost:
        return [nodes[start], nodes[goal]]
    cur, rev = goal, [goal]
    while cur in prev:
        cur = prev[cur]
        rev.append(cur)
    rev.reverse()
    return [nodes[n] for n in rev]


def route_trail(waypoints, pad=0.015):
    lats = [p[0] for p in waypoints]
    lons = [p[1] for p in waypoints]
    bbox = (min(lons) - pad, min(lats) - pad, max(lons) + pad, max(lats) + pad)
    nodes, adj = load_osm_graph(bbox)
    if not adj:
        return waypoints, sum(dist_km(a, b) for a, b in zip(waypoints, waypoints[1:]))
    snapped = [nearest_node(p, nodes, adj) for p in waypoints]
    full = []
    for a, b in zip(snapped, snapped[1:]):
        seg = shortest_path(a, b, nodes, adj)
        full.extend(seg if not full else seg[1:])
    # Thin points to ~25 m spacing so polylines stay crisp and compact
    thin = [full[0]]
    for p in full[1:-1]:
        if dist_km(thin[-1], p) >= 0.025:
            thin.append(p)
    thin.append(full[-1])
    total_km = sum(dist_km(a, b) for a, b in zip(full, full[1:]))
    return thin, total_km


# Curated trail waypoints for hikes: (date, place_or_opt) -> list of (lat, lon)
TRAILS = {
    # Day 1: Þingvellir Hakið -> Almannagjá -> Öxarárfoss
    ("2027-07-04", "oxararfoss"): [
        (64.2554, -21.1297), (64.2610, -21.1235), (64.2659, -21.1173)
    ],
    # Day 2: Bláhnúkur + Brennisteinsalda Combined Loop (counter-clockwise)
    ("2027-07-05", "blahnukur"): [
        (63.9909, -19.0605), (63.9855, -19.0618), (63.9768, -19.0692),
        (63.9786, -19.0835), (63.9809, -19.0955), (63.9852, -19.0815),
        (63.9896, -19.0760), (63.9909, -19.0605)
    ],
    # Day 3: Skógafoss + Waterfall Way (first ~1.5 km upstream & back)
    ("2027-07-06", "skogafoss"): [
        (63.5313, -19.5113), (63.5325, -19.5097), (63.5415, -19.5025), (63.5313, -19.5113)
    ],
    # Day 3 Option: Kvernufoss Gorge Walk (out & back from Skógar Museum)
    ("2027-07-06", "opt:kvernufoss"): [
        (63.5262, -19.4883), (63.5290, -19.4804), (63.5262, -19.4883)
    ],
    # Day 4: Fjaðrárgljúfur Rim Walk, Svartifoss + Sjónarnípa Loop, Múlagljúfur
    ("2027-07-07", "fjadrargljufur"): [
        (63.7712, -18.1718), (63.7785, -18.1628), (63.7712, -18.1718)
    ],
    ("2027-07-07", "svartifoss"): [
        (64.0158, -16.9665), (64.0275, -16.9753), (64.03044, -16.93679), (64.0158, -16.9665)
    ],
    ("2027-07-07", "mulagljufur"): [
        (63.9910, -16.4309), (63.98846, -16.46577), (63.9910, -16.4309)
    ],
    ("2027-07-09", "opt:hengifoss"): [
        (65.0736, -14.8805), (65.0836, -14.8831), (65.0942, -14.8888), (65.0736, -14.8805)
    ],
}


def main():
    trip = json.loads(TRIP.read_text(encoding="utf-8"))
    for day in trip["days"]:
        d = day["date"]
        for s in day.get("segs", []):
            if s.get("t") == "stop" and s.get("kind") == "hike":
                key = (d, s["place"])
                if key not in TRAILS:
                    continue
                pts, km = route_trail(TRAILS[key])
                s["geom"] = encode(pts)
                print(f"{d} hike {s['place']:<18} -> {len(pts):3d} pts, {km:5.2f} km")
                time.sleep(0.3)
        for o in day.get("options", []):
            key = (d, f"opt:{o.get('place')}")
            if key in TRAILS:
                pts, km = route_trail(TRAILS[key])
                o["geom"] = encode(pts)
                print(f"{d} opt  {o['place']:<18} -> {len(pts):3d} pts, {km:5.2f} km")
                time.sleep(0.3)

    TRIP.write_text(json.dumps(trip, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Updated hike trail geometries in", TRIP)


if __name__ == "__main__":
    main()
