#!/usr/bin/env bash
# Brings the Pi's trip backend up to the checkout in ~/services/nordic-trip/repo: Python packages from
# backend/pyproject.toml, the systemd unit, then a restart. pi-dash runs this after `git pull` whenever
# main on GitHub has new commits (see the nordic-trip entry in ~/services/services.json).
set -euo pipefail
cd ~/services/nordic-trip
.venv/bin/python - <<'PY'
import subprocess, sys, tomllib
deps = tomllib.load(open("repo/backend/pyproject.toml", "rb"))["project"]["dependencies"]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check", "-U", *deps])
PY
mkdir -p ~/.config/systemd/user
if ! cmp -s repo/deploy/nordic-trip.service ~/.config/systemd/user/nordic-trip.service; then
  cp repo/deploy/nordic-trip.service ~/.config/systemd/user/nordic-trip.service
  systemctl --user daemon-reload
fi
systemctl --user restart nordic-trip
