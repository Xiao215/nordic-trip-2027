"""List the Chinese text in docs/trip.json that the English page needs, and which are still untranslated.

Translations live in docs/i18n/en.json as {"中文原文": "English"}, keyed by the exact Chinese string,
so reordering or editing other parts of the plan never breaks them. A changed sentence simply shows
in Chinese on the English page until it's translated again.

  python3 scripts/i18n_strings.py            # writes plan/i18n-todo.json with the untranslated strings
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRIP = ROOT / "docs/trip.json"
EN = ROOT / "docs/i18n/en.json"
TODO = ROOT / "plan/i18n-todo.json"

# keys whose values are data, not prose
SKIP = {"ll", "geom", "date", "start", "end", "c", "kind", "mode", "path", "place", "stay", "wx", "id", "opens",
        "color", "tz", "center", "zoom", "climate", "local", "en", "zh", "from", "to", "km", "mins", "route",
        "routeMode", "dates", "hot", "draft", "gid"}
CJK = re.compile(r"[㐀-鿿]")


def strings(node, key=None, out=None):
    out = [] if out is None else out
    if isinstance(node, dict):
        for k, v in node.items():
            if k in SKIP:
                continue
            if k == "links" or k == "sources":  # [name, url]: only the name is text
                for pair in v:
                    strings(pair[0], k, out)
                continue
            strings(v, k, out)
    elif isinstance(node, list):
        for v in node:
            strings(v, key, out)
    elif isinstance(node, str) and CJK.search(node):
        out.append(node)
    return out


def main():
    trip = json.loads(TRIP.read_text())
    # place and country names are handled by the names switch (local spelling), so skip "places"/"countries"
    found = strings({k: v for k, v in trip.items() if k not in ("places", "countries")})
    found = list(dict.fromkeys(found))
    have = json.loads(EN.read_text()) if EN.exists() else {}
    todo = [s for s in found if s not in have]
    TODO.parent.mkdir(exist_ok=True)
    TODO.write_text(json.dumps(todo, ensure_ascii=False, indent=1))
    stale = [k for k in have if k not in set(found)]
    print(f"{len(found)} strings, {len(found) - len(todo)} translated, {len(todo)} to do -> {TODO.relative_to(ROOT)}"
          + (f"; {len(stale)} translations no longer used" if stale else ""))


if __name__ == "__main__":
    main()
