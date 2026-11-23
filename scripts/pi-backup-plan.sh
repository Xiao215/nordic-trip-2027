#!/usr/bin/env bash
# Commits the live plan (~/services/nordic-trip/data/plan, changed through the chat) back to docs/trip.json and
# docs/i18n/en.json, so GitHub keeps its history and the copy on GitHub Pages (the page's offline fallback) stays
# current. Run every 15 minutes by nordic-trip-backup.timer; does nothing when nothing changed.
#
# It never pulls: pi-dash does that, and restarts the backend after. If GitHub has commits this checkout doesn't
# yet, or the repo's plan changed since the backend last read it (a trip.json someone pushed, which the backend takes
# on its next start), it waits for the next run.
set -euo pipefail
S=~/services/nordic-trip
P=$S/data/plan
cd "$S/repo"
[ -f "$P/trip.json" ] && [ -f "$P/en.json" ] || exit 0
if cmp -s "$P/trip.json" docs/trip.json && cmp -s "$P/en.json" docs/i18n/en.json; then exit 0; fi
git fetch -q origin
if [ "$(git rev-parse HEAD)" != "$(git rev-parse '@{u}')" ]; then echo "waiting for pi-dash to deploy the new commits"; exit 0; fi
if [ -n "$(git status --porcelain)" ]; then echo "the checkout has local changes; not backing up"; exit 0; fi
repo_hash=$(cat docs/trip.json docs/i18n/en.json | sha256sum | cut -d' ' -f1)
if [ "$repo_hash" != "$(cat "$P/seed.sha" 2>/dev/null)" ]; then echo "the repo's plan changed; the backend takes it on its next start"; exit 0; fi
cp "$P/trip.json" docs/trip.json
cp "$P/en.json" docs/i18n/en.json
last=$(tail -n 1 "$P/history.jsonl" 2>/dev/null | python3 -c 'import json,sys; r=json.load(sys.stdin); print(r.get("summary",""))' 2>/dev/null || true)
git add docs/trip.json docs/i18n/en.json
git commit -q -m "Plan changes made in the chat (backup from the Pi)" -m "Latest: ${last:-see data/plan/history.jsonl on the Pi}"
if git push -q origin HEAD; then
  cat docs/trip.json docs/i18n/en.json | sha256sum | cut -d' ' -f1 > "$P/seed.sha"
  echo "backed up: $(git rev-parse --short HEAD)"
else
  git reset -q --hard HEAD~1  # someone pushed meanwhile: try again after pi-dash deploys it
  echo "push refused; will retry"
fi
