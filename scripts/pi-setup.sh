#!/usr/bin/env bash
# One-time setup of the trip backend on the Raspberry Pi, laid out like the other services there:
#   ~/services/nordic-trip/repo    checkout of main; pi-dash pulls it and runs scripts/pi-update.sh on new commits
#   ~/services/nordic-trip/.venv   Python packages
#   ~/services/nordic-trip/.env    settings and secrets (from backend/.env.example; never in git)
#   ~/services/nordic-trip/data    the group's expense log, drivers and options board: back this up
# It runs as the user service nordic-trip on 127.0.0.1:8791, answers through cli-bridge (127.0.0.1:8787),
# and is public through Tailscale Funnel at https://pi.tail3d8516.ts.net/nordic (docs/config.js points there).
# Run on the Pi (safe to run again):  bash <(curl -fsSL https://raw.githubusercontent.com/Xiao215/nordic-trip-2027/main/scripts/pi-setup.sh)
set -euo pipefail
DIR=~/services/nordic-trip
mkdir -p "$DIR/data"
chmod 700 "$DIR/data"
cd "$DIR"

[ -d repo/.git ] || git clone -q git@github.com:Xiao215/nordic-trip-2027.git repo
[ -x .venv/bin/python ] || python3 -m venv .venv

if [ ! -f .env ]; then
  cp repo/backend/.env.example .env && chmod 600 .env
  echo "Wrote $DIR/.env from the example. Fill in ACCESS_CODE (and keep ANTHROPIC_BASE_URL=http://127.0.0.1:8787), then run this again." >&2
  exit 1
fi

bash repo/scripts/pi-update.sh
systemctl --user enable -q nordic-trip

# public at /nordic on the Pi's Funnel (443); ports 8443 and 10000 are taken on the Pi
sudo tailscale funnel --bg --set-path /nordic http://127.0.0.1:8791 >/dev/null

# list it on pi-dash, which health-checks it and deploys new commits from GitHub
python3 - <<'PY'
import json, os, shutil, time
p = os.path.expanduser("~/services/services.json")
d = json.load(open(p))
if not any(s["name"] == "nordic-trip" for s in d["services"]):
    shutil.copy(p, p + time.strftime(".bak-%Y%m%d-%H%M%S"))
    d["services"].append({
        "name": "nordic-trip",
        "kind": "systemd-user",
        "description": "Nordic Trip 2027 backend: trip chat, shared expense log, drivers and options board (public at /nordic)",
        "dir": "~/services/nordic-trip",
        "repo": "repo",
        "unit": "nordic-trip.service",
        "health": "http://127.0.0.1:8791/api/health",
        "url": "https://pi.tail3d8516.ts.net/nordic/api/health",
        "update": ["git -C repo pull --ff-only", "bash repo/scripts/pi-update.sh"],
    })
    with open(p + ".tmp", "w") as f:
        json.dump(d, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(p + ".tmp", p)
PY
echo "Running: $(curl -fsS http://127.0.0.1:8791/api/health || echo 'not answering yet')"
