#!/usr/bin/env bash
# Brings the Pi's trip backend up to the checkout in ~/services/nordic-trip/repo: Python packages from
# backend/pyproject.toml, the systemd units (the backend and the plan backup timer), then a restart. pi-dash
# runs this after `git pull` whenever main on GitHub has new commits (see the nordic-trip entry in ~/services/services.json).
set -euo pipefail
cd ~/services/nordic-trip
.venv/bin/python - <<'PY'
import subprocess, sys, tomllib
deps = tomllib.load(open("repo/backend/pyproject.toml", "rb"))["project"]["dependencies"]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-U", *deps])
PY
mkdir -p ~/.config/systemd/user
changed=0
for u in nordic-trip.service nordic-trip-backup.service nordic-trip-backup.timer; do
  if ! cmp -s "repo/deploy/$u" ~/.config/systemd/user/"$u"; then cp "repo/deploy/$u" ~/.config/systemd/user/"$u"; changed=1; fi
done
[ "$changed" = 1 ] && systemctl --user daemon-reload
systemctl --user enable -q --now nordic-trip-backup.timer
systemctl --user restart nordic-trip
