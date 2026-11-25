#!/usr/bin/env bash
# Keeps a git history of the trip's data on the Pi (~/services/nordic-trip/data: the live plan and the expense log),
# committed every 15 minutes by nordic-trip-backup.timer when something changed. Nothing goes to the
# public repo. If BACKUP_REMOTE is set in ~/services/nordic-trip/.env (a PRIVATE git repo), it's pushed there too.
set -euo pipefail
S=~/services/nordic-trip
cd "$S/data"
[ -d .git ] || { git init -q; printf 'plan/snapshots/\n*.tmp\nadmin.token\n' > .gitignore; }
git add -A
git diff --cached --quiet && exit 0
last=$(tail -n 1 plan/history.jsonl 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("summary",""))' 2>/dev/null || true)
git -c user.name="nordic-trip pi" -c user.email="pi@localhost" commit -q -m "Backup $(date -Is)" -m "Latest plan change: ${last:-none}"
echo "backed up: $(git rev-parse --short HEAD)"
remote=$(grep -s '^BACKUP_REMOTE=' "$S/.env" | cut -d= -f2- || true)
if [ -n "$remote" ]; then git push -q "$remote" HEAD:main && echo "pushed to the backup remote"; fi
