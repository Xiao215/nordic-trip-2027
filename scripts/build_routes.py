"""Fill in real map geometry for docs/trip.json.

Each drive ({"t":"move","mode":"drive"}) gets a road route from OSRM (OpenStreetMap data, F-roads
included). Results are stored as Google encoded polylines in a "geom" field, plus the distance in
"km", so the page can draw them on Google Maps.

Re-run after changing a drive's start/end:  python3 scripts/build_routes.py
"""

import json
import math
import time
import urllib.request
from pathlib import Path

TRIP = Path(__file__).resolve().parent.parent / "docs" / "trip.json"
UA = {"User-Agent": "nordic-trip-planner/1.0 (personal trip page)", "Accept": "application/json"}


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def encode(points):
    """Google encoded polyline, precision 5."""
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


def decode(s):
    pts, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        vals = []
        for _ in range(2):
            shift = res = 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                res |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            vals.append(~(res >> 1) if res & 1 else res >> 1)
        lat += vals[0]
        lon += vals[1]
        pts.append((lat / 1e5, lon / 1e5))
    return pts


def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111.2, (a[1] - b[1]) * 111.32 * k)


def drive(points):
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    r = get(f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=polyline")
    route = r["routes"][0]
    pts = decode(route["geometry"])
    # thin long routes: keep a point every ~300 m (a month of driving adds up)
    keep = [pts[0]]
    for p in pts[1:-1]:
        if dist(keep[-1], p) > 0.3:
            keep.append(p)
    keep.append(pts[-1])
    return keep, route["distance"] / 1000, route["duration"] / 60


def main():
    trip = json.loads(TRIP.read_text())
    places = trip["places"]
    ll = lambda x: tuple(places[x]["ll"]) if isinstance(x, str) else tuple(x)

    for day in trip["days"]:
        for s in day["segs"]:
            # flights are drawn as great circles by the page; ferries and trains as listed waypoints
            if s["t"] != "move" or s["mode"] != "drive":
                continue
            pts, km, mins = drive([ll(p) for p in s["path"]])
            s["geom"] = encode(pts)
            s["km"] = round(km)
            plan = f"{s['start']}-{s['end']}" if s.get("end") else f"{s.get('mins', '?')} min"
            print(f"{day['date']} {s['path'][0]:>12} → {s['path'][-1]:<12} {km:6.1f} km  {mins:5.0f} min  (plan {plan})")
            time.sleep(1)

    TRIP.write_text(json.dumps(trip, indent=1, ensure_ascii=False))
    print("wrote", TRIP)


if __name__ == "__main__":
    main()
