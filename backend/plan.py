"""The live trip plan: the copy the page shows and the chat assistant can change.

The plan lives only in the data folder on the Pi (data/plan/trip.json and en.json), never in the public repo: the
page fetches it with the access code. An edit made in the chat shows up on everyone's page at once. Every change keeps
the version before it, so any change can be undone. A whole new version (edited on a laptop, see scripts/plan.sh)
comes in through replace(), checked the same way and undoable too. scripts/pi-backup-plan.sh keeps a git history of
the data folder on the Pi itself.

On a fresh data folder the plan starts from docs/trip.json and docs/i18n/en.json if they exist (a local copy, never
committed), and the server refuses to start without either.

Edits are small operations on paths such as "bookings/odda-stay/cost" or "days/2027-07-19/segs/3/body": a segment
picks a list item by its "id" or "date", or by its position. Before anything is saved the new plan is checked against
the shape of the current one (no unknown fields, no wrong types, no missing required fields), every [[place]] and
place id must exist, and every new piece of Chinese text needs its English for the English page.
"""

import copy
import gzip
import hashlib
import json
import os
import re
import secrets
import time
from pathlib import Path

PLACE = re.compile(r"\[\[([\w-]+)\]\]")
CJK = re.compile(r"[㐀-鿿]")
MAPS = {"/places", "/countries", "/kinds"}  # objects keyed by id rather than records with fixed fields
# Chinese text the page doesn't look up in en.json (place and country names carry their own English)
NO_EN = {"/places/{}/zh", "/countries/{}/zh"}
# fields the page understands that the plan may not use yet: pattern -> {field: kinds}
EXTRA = {"/bookings/[]": {"booked": {"bool"}}, "/days/[]": {"options": {"list"}, "tips": {"list"}}, "/days/[]/segs/[]": {"group": {"str"}},
         "/days/[]/options/[]": {"geom": {"str"}},
         "/places/{}": {"story": {"list"}, "gid": {"str"}}, "/places/{}/photos/[]": {"license": {"str"}}}
# fields that may be left out even where every record so far has them: a photo from Wikimedia Commons has a
# license and no author_link (that one is Unsplash's photographer page)
OPTIONAL = {"/places/{}/photos/[]": {"author_link"}}
MODES = {"drive", "flight", "ferry", "train", "bus", "walk", "bike"}
KEEP = 400  # snapshots kept for undo
# field names in words, for the approval card
FIELD = {
    "days": ("每日行程", "Days"), "bookings": ("预订", "Bookings"), "places": ("地点", "Places"), "prep": ("准备清单", "Checklists"),
    "legs": ("路线分段", "Route legs"), "entry": ("签证和入境", "Visas and entry"), "segs": ("安排", "Schedule"),
    "booked": ("已订", "Booked"), "cost": ("费用", "Cost"), "links": ("链接", "Links"), "tip": ("提示", "Tip"), "summary": ("简介", "Summary"),
    "what": ("名称", "Name"), "when": ("什么时候订", "When to book"), "for": ("日期", "Dates"), "steps": ("步骤", "Steps"), "key": ("要点", "Key facts"),
    "title": ("标题", "Title"), "short": ("短标题", "Short title"), "sub": ("副标题", "Subtitle"), "stay": ("住宿", "Sleep"), "stayNote": ("住宿备注", "Sleep note"),
    "start": ("开始时间", "Start"), "end": ("结束时间", "End"), "name": ("名称", "Name"), "body": ("说明", "Details"), "tips": ("提示", "Tips"),
    "note": ("备注", "Note"), "facts": ("信息", "Facts"), "place": ("地点", "Place"), "path": ("路线", "Route"), "mode": ("交通方式", "Mode"),
    "mins": ("时长", "Duration"), "kind": ("类型", "Kind"), "verb": ("动作", "Action"), "items": ("条目", "Items"), "t": ("内容", "Text"),
    "more": ("详情", "More"), "pace": ("节奏", "Pace"), "paceNote": ("节奏说明", "Pace note"), "zh": ("中文名", "Chinese name"),
    "local": ("当地名", "Local name"), "en": ("英文名", "English name"), "ll": ("坐标", "Coordinates"), "photos": ("照片", "Photos"), "license": ("授权", "License"),
    "options": ("可选", "Optional"), "after": ("放在哪站后面", "After stop"), "why": ("为什么没排", "Why not planned"),
    "in": ("怎么过去", "Getting there"), "out": ("怎么回来", "Getting back"),
    "group": ("步行路线", "Walk"), "story": ("背景和小知识", "Background & fun facts"), "geom": ("轨迹", "Geometry"),
}


class PlanError(ValueError):
    """A change that can't be made, with a message for the assistant."""


def dumps(o) -> str:
    return json.dumps(o, ensure_ascii=False, indent=1)


def _kind(v) -> str:
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, (int, float)):
        return "num"
    if v is None:
        return "null"
    return {str: "str", list: "list", dict: "dict"}[type(v)]


def _children(v, pat: str):
    """(key, child, child pattern) for each child of v."""
    if isinstance(v, dict):
        for k, x in v.items():
            yield k, x, f"{pat}/{{}}" if pat in MAPS else f"{pat}/{k}"
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield i, x, f"{pat}/[]"


def derive_shape(trip: dict) -> dict:
    """pattern -> {"kinds": set, "fields": {field: times seen}, "n": records seen}"""
    shape: dict = {}

    def walk(v, pat):
        s = shape.setdefault(pat, {"kinds": set(), "fields": {}, "n": 0})
        s["kinds"].add(_kind(v))
        if isinstance(v, dict) and pat not in MAPS:
            s["n"] += 1
            for k in v:
                s["fields"][k] = s["fields"].get(k, 0) + 1
        for _, x, cp in _children(v, pat):
            walk(x, cp)

    walk(trip, "")
    for pat, fields in EXTRA.items():
        if pat in shape:
            for f, kinds in fields.items():
                shape[pat]["fields"].setdefault(f, 0)
                shape.setdefault(f"{pat}/{f}", {"kinds": set(), "fields": {}, "n": 0})["kinds"] |= kinds
    return shape


def check(trip: dict, shape: dict) -> list[str]:
    errors: list[str] = []

    def walk(v, pat, where):
        s = shape.get(pat)
        if s is None:
            return  # reported by its parent as an unknown field
        if _kind(v) not in s["kinds"]:
            errors.append(f"{where or '/'}: should be {' or '.join(sorted(s['kinds']))}, not {_kind(v)}")
            return
        if isinstance(v, dict) and pat not in MAPS:
            for k in v:
                if k not in s["fields"]:
                    errors.append(f"{where}/{k}: unknown field (fields here: {', '.join(sorted(s['fields']))})")
            need = [k for k, c in s["fields"].items() if c == s["n"] and s["n"] > 1 and k not in v and k not in OPTIONAL.get(pat, ())]
            if need:
                errors.append(f"{where or '/'}: missing {', '.join(need)}")
        for k, x, cp in _children(v, pat):
            walk(x, cp, f"{where}/{k}")

    walk(trip, "", "")
    places, countries = trip.get("places", {}), trip.get("countries", {})

    def strings(v, where=""):
        if isinstance(v, str):
            yield where, v
        for k, x, _ in _children(v, ""):
            yield from strings(x, f"{where}/{k}")

    for where, s in strings(trip):
        for pid in PLACE.findall(s):
            if pid not in places and pid not in countries:
                errors.append(f"{where}: [[{pid}]] is not a place id (add it to places first)")
    start, end = trip.get("dates", {}).get("start", ""), trip.get("dates", {}).get("end", "")
    seen = []
    for d in trip.get("days", []):
        date = d.get("date", "")
        if date in seen:
            errors.append(f"days: {date} appears twice")
        if not (start <= date <= end):
            errors.append(f"days/{date}: outside the trip ({start} to {end})")
        seen.append(date)
        if d.get("c") and d["c"] not in countries:
            errors.append(f"days/{date}/c: {d['c']} is not a country id")
        if isinstance(d.get("stay"), str) and d["stay"] not in places:
            errors.append(f"days/{date}/stay: {d['stay']} is not a place id")
        for i, sg in enumerate(d.get("segs", [])):
            if sg.get("t") == "stop" and sg.get("place") not in places:
                errors.append(f"days/{date}/segs/{i}/place: {sg.get('place')} is not a place id")
            for p in sg.get("path", []) if sg.get("t") == "move" else []:
                if isinstance(p, str) and p not in places:
                    errors.append(f"days/{date}/segs/{i}/path: {p} is not a place id")
        # optional extras: {after?, place, name?, kind, start?, end?, mins?, body?, facts?, tips?, why?, in?, out?}
        for i, o in enumerate(d.get("options", []) if isinstance(d.get("options"), list) else []):
            w = f"days/{date}/options/{i}"
            if not isinstance(o, dict):
                errors.append(f"{w}: should be an object")
                continue
            if o.get("place") not in places:
                errors.append(f"{w}/place: {o.get('place')} is not a place id")
            if "after" in o and o["after"] not in places:
                errors.append(f"{w}/after: {o['after']} is not a place id (use the place of a stop that day)")
            if o.get("kind") not in trip.get("kinds", {}):
                errors.append(f"{w}/kind: {o.get('kind')} is not one of {', '.join(trip.get('kinds', {}))}")
            for side in ("in", "out"):
                m = o.get(side)
                if m is None:
                    continue
                if not isinstance(m, dict) or m.get("mode") not in MODES:
                    errors.append(f"{w}/{side}: needs mode, one of {', '.join(sorted(MODES))}")
                    continue
                for p in m.get("path", []):
                    if isinstance(p, str) and p not in places:
                        errors.append(f"{w}/{side}/path: {p} is not a place id")
    if seen != sorted(seen):
        errors.append("days: must stay in date order")
    for name in ("bookings", "legs", "prep"):
        ids = [x.get("id") for x in trip.get(name, []) if isinstance(x, dict) and x.get("id")]
        if len(ids) != len(set(ids)):
            errors.append(f"{name}: two items share an id")
    items = [i.get("id") for c in trip.get("prep", []) for i in c.get("items", []) if i.get("id")]
    if len(items) != len(set(items)):
        errors.append("prep: two checklist items share an id")
    return errors


def zh_strings(v, pat: str = "") -> set[str]:
    out = set()
    if isinstance(v, str):
        if CJK.search(v) and pat not in NO_EN:
            out.add(v)
    for _, x, cp in _children(v, pat):
        out |= zh_strings(x, cp)
    return out


# ---------- paths ----------

def _index(lst: list, tok: str, where: str) -> int:
    if re.fullmatch(r"\d+", tok):
        i = int(tok)
        if i >= len(lst):
            raise PlanError(f"{where}: there are only {len(lst)} items")
        return i
    for i, x in enumerate(lst):
        if isinstance(x, dict) and tok in (x.get("id"), x.get("date")):
            return i
    ids = [x.get("id") or x.get("date") for x in lst if isinstance(x, dict) and (x.get("id") or x.get("date"))]
    raise PlanError(f"{where}: no item {tok!r}" + (f" (there are: {', '.join(ids[:40])})" if ids else ""))


def resolve(root, path: str):
    """The value at a path."""
    node, where = root, ""
    for tok in [t for t in path.strip("/").split("/") if t]:
        where += "/" + tok
        if isinstance(node, dict):
            if tok not in node:
                raise PlanError(f"{where}: not found (fields here: {', '.join(list(node)[:60])})")
            node = node[tok]
        elif isinstance(node, list):
            node = node[_index(node, tok, where)]
        else:
            raise PlanError(f"{where}: {where.rsplit('/', 1)[0] or '/'} is a {_kind(node)}, not a list or object")
    return node


def apply_op(root: dict, op: str, path: str, value=None) -> None:
    toks = [t for t in path.strip("/").split("/") if t]
    if not toks:
        raise PlanError("a change needs a path inside the plan; the whole plan can't be replaced at once")
    parent, last = resolve(root, "/".join(toks[:-1])), toks[-1]
    where = "/" + "/".join(toks)
    if op == "set":
        if isinstance(parent, dict):
            parent[last] = value
        elif isinstance(parent, list):
            parent[_index(parent, last, where)] = value
        else:
            raise PlanError(f"{where}: its parent is a {_kind(parent)}")
    elif op == "insert":
        if not isinstance(parent, list):
            raise PlanError(f"{where}: insert works in lists; use set to add a field")
        if last == "-":
            parent.append(value)
        else:
            parent.insert(_index(parent, last, where) if not re.fullmatch(r"\d+", last) else min(int(last), len(parent)), value)
    elif op == "remove":
        if isinstance(parent, dict):
            if last not in parent:
                raise PlanError(f"{where}: not found")
            del parent[last]
        elif isinstance(parent, list):
            parent.pop(_index(parent, last, where))
        else:
            raise PlanError(f"{where}: its parent is a {_kind(parent)}")
    else:
        raise PlanError(f"unknown op {op!r}")


# ---------- the store ----------

class Plan:
    def __init__(self, data_dir: Path, docs: Path):
        self.dir = data_dir / "plan"
        (self.dir / "snapshots").mkdir(parents=True, exist_ok=True)
        self.trip_file, self.en_file = self.dir / "trip.json", self.dir / "en.json"
        self.repo_trip, self.repo_en = docs / "trip.json", docs / "i18n" / "en.json"
        self.log_file = self.dir / "history.jsonl"
        self._seed()
        self._load()
        self.shape = derive_shape(self.trip)

    # files
    @staticmethod
    def _hash(trip: bytes, en: bytes) -> str:
        return hashlib.sha256(trip + en).hexdigest()

    def _live_bytes(self) -> tuple[bytes, bytes]:
        return self.trip_file.read_bytes(), self.en_file.read_bytes()

    def _write(self, trip: bytes, en: bytes) -> None:
        for path, data in ((self.trip_file, trip), (self.en_file, en)):
            tmp = path.with_suffix(".tmp")
            tmp.write_bytes(data)
            os.replace(tmp, path)

    def _load(self) -> None:
        t, e = self._live_bytes()
        self.trip, self.en = json.loads(t), json.loads(e)
        self.rev = self._hash(t, e)[:12]

    def _seed(self) -> None:
        if self.trip_file.exists() and self.en_file.exists():
            return
        if not self.repo_trip.exists():
            raise SystemExit(f"No plan in {self.dir}: copy trip.json and en.json there (or into docs/ for a local run).")
        self._write(self.repo_trip.read_bytes(), self.repo_en.read_bytes() if self.repo_en.exists() else b"{}")
        self._log({"id": self._id(), "ts": time.time(), "by": "", "kind": "start", "summary": "Started from a local copy of the plan"})

    def _id(self) -> str:
        return f"{int(time.time()):x}{secrets.token_hex(2)}"

    def _snapshot(self, cid: str) -> None:
        t, e = self._live_bytes()
        (self.dir / "snapshots" / f"{cid}.json.gz").write_bytes(gzip.compress(json.dumps({"trip": t.decode(), "en": e.decode()}).encode()))
        snaps = sorted((self.dir / "snapshots").glob("*.json.gz"), key=lambda p: p.stat().st_mtime)
        for old in snaps[:-KEEP]:
            old.unlink(missing_ok=True)

    def _log(self, entry: dict) -> None:
        with self.log_file.open("a") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def entries(self) -> list[dict]:
        """Every change, oldest first, each marked undone when a later undo (not itself undone) covers it."""
        try:
            rows = [json.loads(line) for line in self.log_file.read_text().splitlines() if line.strip()]
        except FileNotFoundError:
            rows = []
        undone: set[str] = set()
        for r in reversed(rows):
            if r["id"] in undone:
                continue
            if r.get("kind") == "undo":
                undone |= set(r.get("undoes", []))
        for r in rows:
            r["undone"] = r["id"] in undone
        return rows

    def last(self) -> dict | None:
        rows = [r for r in self.entries() if r.get("kind") != "start"]
        return {k: rows[-1].get(k) for k in ("id", "ts", "by", "summary", "kind", "approved_by")} if rows else None

    # changes
    def _commit(self, trip: dict, en: dict, entry: dict) -> dict:
        cid = self._id()
        self._snapshot(cid)
        self._write(dumps(trip).encode(), dumps(en).encode())
        self._log({"id": cid, "ts": time.time(), **entry})
        self._load()
        return {"change_id": cid, "rev": self.rev}

    def edit(self, changes: list[dict], en: dict[str, str], by: str, summary: str, validate=None, extra: dict | None = None) -> dict:
        new, new_en = self.try_edit(changes, en, validate)
        return self._commit(new, new_en, {"by": by, "kind": "edit", "summary": summary, "paths": [c["path"] for c in changes][:40], **(extra or {})})

    def try_edit(self, changes: list[dict], en: dict[str, str], validate=None) -> tuple[dict, dict]:
        """The plan and its English after these changes, checked but not saved; PlanError if they can't be made."""
        new = copy.deepcopy(self.trip)
        for i, c in enumerate(changes):
            try:
                apply_op(new, c["op"], c["path"], copy.deepcopy(c.get("value")))
            except PlanError as e:
                raise PlanError(f"change {i + 1} ({c['op']} {c['path']}): {e}")
        new_en = {**self.en, **{k: v for k, v in en.items() if k and v}}
        errors = check(new, self.shape)
        missing = sorted(zh_strings(new) - zh_strings(self.trip) - set(new_en))
        if missing:
            errors.append("English needed in en for each new Chinese text, keyed by the exact Chinese (keep [[place]] "
                          "markers in the English too): " + json.dumps(missing[:20], ensure_ascii=False))
        if not errors and validate:
            try:
                validate(new)
            except Exception as e:  # the page and the assistant must be able to read it
                errors.append(f"the plan can't be read after this change: {type(e).__name__}: {e}")
        if errors:
            raise PlanError("Nothing was changed:\n- " + "\n- ".join(errors[:25]))
        if new == self.trip and new_en == self.en:
            raise PlanError("Nothing was changed: the plan already says this.")
        return new, new_en

    def replace(self, trip: dict, en: dict, by: str, summary: str, validate=None) -> dict:
        """A whole new version of the plan (edited elsewhere), checked like an edit; the old one stays in the history."""
        if not isinstance(trip, dict) or not isinstance(en, dict):
            raise PlanError("trip and en must both be objects")
        errors = check(trip, self.shape)  # the same fields the page and the assistant know (plus EXTRA)
        missing = sorted(s for s in zh_strings(trip) if s not in en)
        if missing:
            errors.append("English missing in en for: " + json.dumps(missing[:20], ensure_ascii=False))
        if not errors and validate:
            try:
                validate(trip)
            except Exception as e:
                errors.append(f"the plan can't be read: {type(e).__name__}: {e}")
        if errors:
            raise PlanError("Nothing was changed:\n- " + "\n- ".join(errors[:25]))
        if trip == self.trip and en == self.en:
            raise PlanError("Nothing was changed: the live plan is already this version.")
        out = self._commit(trip, en, {"by": by, "kind": "upload", "summary": summary or "Uploaded a new version of the plan"})
        self.shape = derive_shape(self.trip)
        return out

    def preview(self, changes: list[dict], lang_en: bool = False) -> list[dict]:
        """Each change as {op, path, before, after} in plain words, for the approval card."""
        cur, out = copy.deepcopy(self.trip), []
        for c in changes:
            try:
                before = resolve(cur, c["path"]) if c["op"] != "insert" else None
            except PlanError:
                before = None
            out.append({"op": c["op"], "path": c["path"], "where": self.where(c["path"], lang_en), "before": self.words(before, lang_en),
                        "after": self.words(c.get("value"), lang_en) if c["op"] != "remove" else ""})
            try:
                apply_op(cur, c["op"], c["path"], copy.deepcopy(c.get("value")))
            except PlanError:
                pass
        return out

    def where(self, path: str, lang_en: bool = False) -> str:
        """A path in words: "bookings/odda-stay/cost" -> "奥达 两晚住宿 · 费用"."""
        toks = [t for t in path.strip("/").split("/") if t]
        out, node = [], self.trip
        for i, tok in enumerate(toks):
            if isinstance(node, list):
                try:
                    k = _index(node, tok, "")
                except PlanError:
                    out.append("new" if lang_en else "新的") if tok == "-" else out.append(tok)
                    break
                item = node[k]
                if isinstance(item, dict) and item.get("date") == tok:
                    out.append(f"{int(tok[5:7])}/{int(tok[8:10])}")
                elif isinstance(item, dict) and (item.get("what") or item.get("title")) and toks[i - 1] != "segs":
                    out.append(self.words(item.get("what") or item.get("title"), lang_en, 40))
                elif toks[i - 1] == "segs":
                    label = self.words(item, lang_en, 30) if isinstance(item, dict) else ""
                    out.append((f"stop {k + 1}" if lang_en else f"第 {k + 1} 段") + (f" ({label})" if label else ""))
                else:
                    out.append(f"#{k + 1}")
                node = item
            elif isinstance(node, dict):
                if i == 1 and toks[0] in ("places", "countries"):
                    p = node.get(tok)
                    out.append(self.words(f"[[{tok}]]", lang_en) if p else tok)
                elif tok not in ("days", "bookings", "segs", "places", "countries"):
                    out.append(FIELD.get(tok, (tok, tok))[1 if lang_en else 0])
                elif i == 0:
                    out.append(FIELD.get(tok, (tok, tok))[1 if lang_en else 0])
                node = node.get(tok) if tok in node else None
                if node is None:
                    out += [FIELD.get(t, (t, t))[1 if lang_en else 0] for t in toks[i + 1:]]
                    break
            else:
                break
        return " · ".join(x for x in out if x)

    def days_preview(self, new: dict, new_en: dict, lang_en: bool = False, most: int = 6) -> list[dict]:
        """The days whose schedule a change touches, as they read before and after it, for the approval card:
        [{date, before, after}], each side {title, short, stay, segs} in words, or None for a day added or taken out."""
        old = {d["date"]: d for d in self.trip.get("days", [])}
        nxt = {d["date"]: d for d in new.get("days", [])}
        out = []
        for date in sorted(set(old) | set(nxt)):
            a, b = old.get(date), nxt.get(date)
            if a is not None and b is not None and a.get("segs") == b.get("segs") and a.get("stay") == b.get("stay"):
                continue
            out.append({"date": date, "before": self._day_words(a, self.trip, self.en, lang_en),
                        "after": self._day_words(b, new, new_en, lang_en)})
        return out[:most]

    def _day_words(self, d: dict | None, trip: dict, en: dict, lang_en: bool) -> dict | None:
        if d is None:
            return None
        W = lambda v, n=80: self.words(v, lang_en, n, trip, en)  # noqa: E731
        segs = []
        for s in d.get("segs", []):
            x = {k: s[k] for k in ("start", "end", "mins", "kind", "mode") if s.get(k) is not None}
            if s.get("t") == "move":
                path = [p for p in s.get("path", []) if isinstance(p, str)]
                ends = [path[0], path[-1]] if path else []
                x.update(t="move", ends=ends, label=W(s.get("label") or " → ".join(f"[[{p}]]" for p in ends)))
            else:
                x.update(t="stop", place=s.get("place", ""), name=W(s.get("name") or f"[[{s.get('place', '')}]]"))
            segs.append(x)
        stay = d.get("stay")
        return {"title": W(d.get("title", "")), "short": W(d.get("short", "")),
                "stay": W(f"[[{stay}]]") if isinstance(stay, str) and stay else "", "segs": segs}

    def words(self, v, lang_en: bool = False, n: int = 160, trip: dict | None = None, en: dict | None = None) -> str:
        """A value as short readable text: place names filled in, objects by their title. trip and en: the version of
        the plan to read place names and English from (the live one if not given)."""
        trip, en = trip or self.trip, en if en is not None else self.en
        if v is None:
            return ""
        if isinstance(v, bool):
            return ("yes" if v else "no") if lang_en else ("是" if v else "否")
        if isinstance(v, dict):
            if v.get("t") == "move":  # a schedule move: its label, else where it goes ("t" is only its type)
                if isinstance(v.get("label"), str):
                    return self.words(v["label"], lang_en, n, trip, en)
                ends = [x for x in v.get("path", []) if isinstance(x, str)][::max(1, len(v.get("path", [])) - 1)][:2]
                return " → ".join(self.words(f"[[{x}]]", lang_en, n, trip, en) for x in ends) or ("move" if lang_en else "移动")
            if v.get("t") == "stop" and not v.get("name") and v.get("place"):
                return self.words(f"[[{v['place']}]]", lang_en, n, trip, en)
            for k in ("title", "name", "what", "t", "zh", "label"):
                if isinstance(v.get(k), str):
                    return self.words(v[k], lang_en, n, trip, en)
            return json.dumps(v, ensure_ascii=False)[:n]
        if isinstance(v, list):
            return " · ".join(self.words(x, lang_en, 60, trip, en) for x in v[:6])[:n]
        if not isinstance(v, str):
            return str(v)
        s = (en.get(v) or v) if lang_en else v
        places, countries = trip["places"], trip["countries"]

        def name(m):
            p = places.get(m.group(1)) or countries.get(m.group(1)) or {}
            return ((p.get("local") or p.get("en")) if lang_en else (p.get("zh") or p.get("local"))) or m.group(1)
        s = re.sub(r"\*\*|`", "", PLACE.sub(name, s))
        s = re.sub(r"\[([^\]]+)\]\((https?://[^)]+)\)", r"\1", s)
        return s if len(s) <= n else s[: n - 1] + "…"

    def undo(self, change_id: str, by: str, also_later: bool = False, extra: dict | None = None) -> dict:
        r, later, old = self.try_undo(change_id, also_later)
        return self._commit(json.loads(old["trip"]), json.loads(old["en"]),
                            {"by": by, "kind": "undo", "undoes": [change_id] + [x["id"] for x in later],
                             "summary": "Undid: " + "; ".join(x.get("summary", "") for x in [r] + later)[:300], **(extra or {})})

    def try_undo(self, change_id: str, also_later: bool = False) -> tuple[dict, list[dict], dict]:
        """(the change, the later ones undone with it, the version to go back to); PlanError if it can't be undone."""
        rows = self.entries()
        i = next((k for k, r in enumerate(rows) if r["id"] == change_id), None)
        if i is None:
            raise PlanError(f"no change with id {change_id!r}; use plan_history for the ids")
        r = rows[i]
        if r.get("kind") == "start":
            raise PlanError("that's where the plan started; there's nothing before it")
        if r["undone"]:
            raise PlanError("that change has already been undone")
        later = [x for x in rows[i + 1:] if not x["undone"]]
        if later and not also_later:
            raise PlanError("Nothing was changed: these later changes would be undone too, so check with the person "
                            "first and then call again with also_later: " +
                            json.dumps([{k: x.get(k) for k in ("id", "by", "summary")} for x in later], ensure_ascii=False))
        snap = self.dir / "snapshots" / f"{change_id}.json.gz"
        if not snap.exists():
            raise PlanError("that change is too old to undo (its earlier version is no longer kept)")
        return r, later, json.loads(gzip.decompress(snap.read_bytes()))

    def history(self, n: int = 15) -> list[dict]:
        rows = [r for r in self.entries() if r.get("kind") != "start"][-n:]
        return [{"id": r["id"], "when": time.strftime("%Y-%m-%d %H:%M", time.localtime(r["ts"])), "by": r.get("by", ""),
                 "kind": r.get("kind"), "summary": r.get("summary", ""), "undone": r["undone"]} for r in reversed(rows)]

    def part(self, path: str) -> dict:
        """The raw JSON at a path, with the English of its Chinese text."""
        v = resolve(self.trip, path)
        if not path.strip("/"):  # an outline instead of the whole plan
            v = {k: (f"{len(x)} items" if isinstance(x, (list, dict)) else x) for k, x in self.trip.items()}
            v["days"] = [d["date"] for d in self.trip["days"]]
            v["bookings"] = [b["id"] for b in self.trip["bookings"]]
            v["places"] = {k: p.get("zh") or p.get("en") for k, p in self.trip["places"].items()}
            v["prep"] = [c.get("id") for c in self.trip["prep"]]
            v["legs"] = [(i, l.get("title")) for i, l in enumerate(self.trip["legs"])]
        en = {s: self.en[s] for s in sorted(zh_strings(v)) if s in self.en}
        return {"path": path, "value": v, "en": en}
