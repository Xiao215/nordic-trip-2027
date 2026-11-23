#!/usr/bin/env bash
# Edit the trip plan on a laptop. The plan lives only on the Pi (never in this public repo), so:
#
#   scripts/plan.sh pull                  # copy the live plan to docs/trip.json and docs/i18n/en.json (gitignored)
#   ... edit, run scripts/build_routes.py, scripts/i18n_strings.py ...
#   scripts/plan.sh push "what changed"   # upload it; the server checks it and keeps the old version for undo
#
# Pull right before editing: anything changed in the chat since your pull is replaced by your push (it stays in the
# history on the Pi and can be undone from the chat). Needs `ssh` access to the Pi (PI_HOST, default the Tailscale name).
set -euo pipefail
PI_HOST=${PI_HOST:-xiao215@pi.tail3d8516.ts.net}
S='~/services/nordic-trip'
cd "$(dirname "$0")/.."
mkdir -p docs/i18n
case "${1:-}" in
  pull)
    ssh "$PI_HOST" "cat $S/data/plan/trip.json" > docs/trip.json.tmp
    ssh "$PI_HOST" "cat $S/data/plan/en.json" > docs/i18n/en.json.tmp
    mv docs/trip.json.tmp docs/trip.json
    mv docs/i18n/en.json.tmp docs/i18n/en.json
    echo "pulled the live plan into docs/trip.json and docs/i18n/en.json"
    ;;
  push)
    summary=${2:-"Edited on a laptop"}
    up=$(mktemp)
    python3 - "$summary" > "$up" <<'PY'
import json, sys
print(json.dumps({"trip": json.load(open("docs/trip.json")), "en": json.load(open("docs/i18n/en.json")), "summary": sys.argv[1][:200]}, ensure_ascii=False))
PY
    # the admin token never leaves the Pi: the upload is sent to the backend from the Pi itself
    ssh "$PI_HOST" "curl -sS -X POST http://127.0.0.1:8791/api/plan/replace -H 'Content-Type: application/json' \
      -H \"X-Admin-Token: \$(cat $S/data/admin.token 2>/dev/null || grep -s '^ADMIN_TOKEN=' $S/.env | cut -d= -f2-)\" \
      --data-binary @- -w '\nHTTP %{http_code}\n'" < "$up"
    rm -f "$up"
    ;;
  *) echo "usage: scripts/plan.sh pull | push \"what changed\"" >&2; exit 2 ;;
esac
