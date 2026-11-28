"""Fill in real map geometry for docs/trip.json.

- drive: OSRM driving (OpenStreetMap roads, F-roads included)
- bus:   OSRM driving (real road & tunnel routes)
- walk:  OSM Germany OSRM foot router (real streets, bridges, park paths)
- bike:  OSM Germany OSRM bike router
- train: Transitous (MOTIS) pan-European GTFS/OSM rail, metro & tram router
         (falls back to OSRM driving if no transit itinerary is returned)

Results are stored as Google encoded polylines (precision 5) in "geom", plus "km" for drives.

Usage:
  python3 scripts/build_routes.py                 # rebuild all non-flight/ferry moves
  python3 scripts/build_routes.py --missing-only  # only fill moves currently missing geom
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

TRIP = Path(__file__).resolve().parent.parent / "docs" / "trip.json"
UA = {"User-Agent": "nordic-trip-planner/1.0 (personal trip page)", "Accept": "application/json"}


def get(url, data=None, timeout=45):
    req = urllib.request.Request(url, data=data, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
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


def decode(s, precision=5):
    scale = 10 ** precision
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
        pts.append((lat / scale, lon / scale))
    return pts


def dist(a, b):
    k = math.cos(math.radians((a[0] + b[0]) / 2))
    return math.hypot((a[0] - b[0]) * 111.2, (a[1] - b[1]) * 111.32 * k)


def thin(pts, min_km):
    if len(pts) <= 2:
        return pts
    keep = [pts[0]]
    for p in pts[1:-1]:
        if dist(keep[-1], p) >= min_km:
            keep.append(p)
    if dist(keep[-1], pts[-1]) > 0.001 or len(keep) == 1:
        keep.append(pts[-1])
    return keep


def path_km(pts):
    return sum(dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def osrm_route(points, profile="driving"):
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)
    if profile == "foot":
        url = f"https://routing.openstreetmap.de/routed-foot/route/v1/foot/{coords}?overview=full&geometries=polyline"
    elif profile == "bike":
        url = f"https://routing.openstreetmap.de/routed-bike/route/v1/bike/{coords}?overview=full&geometries=polyline"
    else:
        url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=polyline"
    r = get(url)
    route = r["routes"][0]
    pts = decode(route["geometry"], precision=5)
    km = route["distance"] / 1000
    mins = route["duration"] / 60
    min_km = 0.025 if profile in ("foot", "bike") else (0.3 if km > 40 else 0.08)
    return thin(pts, min_km), km, mins


def transit_route(points):
    """Query Transitous (MOTIS) for real rail/metro/tram/bus track geometry."""
    (lat1, lon1), (lat2, lon2) = points[0], points[-1]
    rail_modes = {"SUBWAY", "TRAM", "RAIL", "REGIONAL_RAIL", "HIGHSPEED_RAIL", "LONG_DISTANCE", "METRO", "REGIONAL_FAST_RAIL"}

    for extra in (
        "&transitModes=TRAM,SUBWAY,RAIL,REGIONAL_RAIL,REGIONAL_FAST_RAIL,HIGHSPEED_RAIL,LONG_DISTANCE",
        "",
    ):
        url = (
            f"https://api.transitous.org/api/v1/plan?"
            f"fromPlace={lat1},{lon1}&toPlace={lat2},{lon2}"
            f"&time=2026-12-01T10:00:00Z&numItineraries=3{extra}"
        )
        try:
            j = get(url, timeout=30)
        except Exception:
            continue
        its = j.get("itineraries") or []
        if not its:
            continue
        # Prefer an itinerary that actually uses rail/metro/tram (not pure walking)
        def score(it):
            modes = {l.get("mode", "") for l in it.get("legs", [])}
            has_rail = bool(modes & rail_modes)
            has_transit = any(m != "WALK" for m in modes)
            return (0 if has_rail else (1 if has_transit else 2), it.get("duration", 999999))

        best = min(its, key=score)
        modes = {l.get("mode", "") for l in best.get("legs", [])}
        if not any(m != "WALK" for m in modes):
            continue

        pts = []
        leg_tags = []
        for leg in best["legs"]:
            lg = leg.get("legGeometry") or {}
            enc = lg.get("points")
            if not enc:
                continue
            prec = lg.get("precision", 7)
            leg_pts = decode(enc, precision=prec)
            if pts and leg_pts and dist(pts[-1], leg_pts[0]) < 0.01:
                leg_pts = leg_pts[1:]
            pts.extend(leg_pts)
            m = leg.get("mode", "")
            sn = leg.get("routeShortName", "")
            if m != "WALK":
                leg_tags.append(f"{m}:{sn}" if sn else m)
        if len(pts) >= 2:
            km = path_km(pts)
            min_km = 0.35 if km > 50 else 0.04
            return thin(pts, min_km), km, best.get("duration", 0) / 60, ",".join(leg_tags)
    return None


def main():
    missing_only = "--missing-only" in sys.argv
    trip = json.loads(TRIP.read_text(encoding="utf-8"))
    places = trip["places"]
    ll = lambda x: tuple(places[x]["ll"]) if isinstance(x, str) else tuple(x)

    updated = 0
    for day in trip["days"]:
        for s in day["segs"]:
            if s.get("t") != "move":
                continue
            mode = s.get("mode")
            if mode not in ("drive", "bus", "walk", "bike", "train"):
                continue
            if missing_only and s.get("geom"):
                continue

            pts_in = [ll(p) for p in s["path"]]
            src = mode
            try:
                if mode == "drive":
                    pts, km, mins = osrm_route(pts_in, "driving")
                    s["km"] = round(km)
                elif mode == "bus":
                    pts, km, mins = osrm_route(pts_in, "driving")
                elif mode in ("walk", "bike"):
                    try:
                        pts, km, mins = osrm_route(pts_in, "foot" if mode == "walk" else "bike")
                    except Exception:
                        pts, km, mins = osrm_route(pts_in, "driving")
                        src = f"{mode}->drive"
                elif mode == "train":
                    res = transit_route(pts_in)
                    if res:
                        pts, km, mins, tags = res
                        src = f"transit({tags})"
                    else:
                        pts, km, mins = osrm_route(pts_in, "driving")
                        src = "train->drive"
            except Exception as e:
                print(f"WARN {day['date']} {mode} {s['path']}: {e}")
                continue

            s["geom"] = encode(pts)
            updated += 1
            print(f"{day['date']} [{mode:5}] {s['path'][0]:>18} → {s['path'][-1]:<18} {km:6.1f} km  {len(pts):4d} pts  {src}")
            time.sleep(0.35)

    TRIP.write_text(json.dumps(trip, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nUpdated {updated} move geometries -> {TRIP}")


if __name__ == "__main__":
    main()
