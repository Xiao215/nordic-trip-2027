# Nordic Trip 2027 · 北欧之旅 2027

Trip planner for Jul 4 – Aug 1, 2027 (Iceland → Norway → Stockholm → Visby → Copenhagen). The page is in Chinese or English (中文 / EN switch in the sticky bar). In Chinese, place names show in Chinese and hovering one shows its local spelling; in English, the whole page is English and place names are written the way signs and maps show them (Icelandic, Norwegian, Swedish, Danish). The chat answers in the page's language.

A currency menu next to the language switch shows every price in the local currency as written (ISK, NOK, SEK, DKK, €) or converted to CAD, CNY or USD with the latest rates from [open.er-api.com](https://open.er-api.com) (cached for 12 hours, with a fallback in `trip.json` under `fx`). Hover a converted price to see the original.

What's on it: an overview (route ribbon, 4-week calendar with how full each day is, route legs), one day at a time (forecast or July normals, sunrise and sunset, transport and outdoor totals, the day's pace, what to bring, the timeline), a Google map that shows whatever you open (on phones it opens inside the stop you tap), booking cards grouped into "do now", "opens later" and "booked" (days and calendar cells flag anything still unbooked), checklists, a shared expense log (账本), plus a floating chat assistant (Ctrl/⌘+K) that knows the plan, searches the web and answers in Chinese.

The expense log (账本 tab) is one shared ledger for the group: add the people, then log each expense with who paid and who shares it, in any currency. It totals spending by category, shows each person's balance and the fewest transfers to settle up, in the currency picked in the top bar (CAD when that's "local"). It lives on the backend in `expenses.json` in the Pi's data folder (back it up) behind the same access code as the chat. Each device keeps the last copy it saw, so the log still reads with no signal, and anything added offline waits on that device and syncs once the backend answers again. The assistant can read it too ("who owes whom?", "how much have we spent on fuel?"), and it can log expenses: tell it ("I paid 2,400 ISK for gas, split four ways") or attach a photo of a receipt with the 📷 button in the chat (it offers the camera or the photo library; pasting or dropping an image works too). It reads the shop, total, currency and date, and proposes the expense as a card; it goes in the log only when someone presses 确认记账. Photos are shrunk on the phone before they're sent, only go to the AI with that one question, and only a small thumbnail stays in the conversation.

The plan is live: it's kept on the backend, and the chat assistant can change it. Tell it in plain words ("we booked the Odda stay, 3,200 NOK for both nights", "this Flåm hotel looks good https://… add it to the Flåm stay", "swap 7/12 for whale watching in Húsavík") and it proposes the change as a card in the chat: what changes where, before → after. Nothing changes until someone presses 确认修改 (Approve) on it; 先不改 (Not now) drops it. Bigger changes (moving or dropping stops, changing where you sleep, reshaping days) it talks through first, then proposes. Once approved, everyone's page shows the change within a minute, or at once for whoever approved it. Each change says who approved it (the "我是" name under the chat box), and "撤销" (undo) puts any change back, again through a card. A booking it marks booked shows as booked for everyone (ticks you set yourself stay on your device). The assistant lives behind the 问助手 (Ask) button, or Ctrl/⌘+K: it opens a side panel with the current conversation; + starts a new one and ‹ lists all of them (kept on this device, the latest 30), and while it works it shows what it's looking at (web searches, the parts of the plan it read) in a line you can expand. Closing the panel doesn't stop an answer; the button says when a reply came in or a change is waiting for approval. How it works: the page loads the plan from the backend (`/api/plan`), falling back to the copy it saw last and then to the copy published with the site, so it still opens offline. The assistant reads the exact JSON of a part, then proposes small edits (set, insert, remove on paths like `bookings/odda-stay/cost`); before showing the card the backend checks them against the plan's existing shape and requires English for any new Chinese text. It applies them only when someone approves (`POST /api/plan/proposals/{id}`), keeps the version before each change for undo, and commits the live plan back to `docs/` on GitHub every 15 minutes when it changed. The plan is public (GitHub Pages and the repo are), so the assistant won't write confirmation numbers, passport numbers or other private details into it.

Each day gets a pace, 轻松 / 适中 / 很满 (easy / moderate / full), shown as three bars on the calendar, the day strip and the day card. It's worked out from the plan: hours driving (buses, trains and ferries count about half), hours on foot, how long the day runs, and early starts or late finishes. The day card says why ("7 h driving · leave 05:30") and flags a run of full days, and the overview names the longest run. To override a day, add `"pace": 1`–`3` and an optional `"paceNote"` to it in `trip.json`.

The day card also lists what to bring (带上), worked out from the day: passport on flight or border days, licence and a physical card when a new rental car starts, boots and snacks for long walks, swimsuit for hot pools, a waterproof for waterfalls, gloves and sunglasses for glacier walks, camping gear, seasickness tablets for long ferries, and rain or warm layers once the forecast says so. Add your own with `"bring": ["..."]` on a day. Tapping an item ticks it off on that device.

The site works offline once it's been opened (`docs/sw.js`): the page, the plan, the last forecast and exchange rates come from the device when there's no signal, and an orange bar says so. Photos are kept once seen, and 准备 → 离线使用 (Prep → Offline use) downloads all of them ahead of time (about 35 MB). Google Maps and the chat still need a connection.

**Private:** the site's code is public (GitHub Pages), but the plan and the expense log live only on the Pi, behind the access code. The page has no data of its own: the first time a device opens it, it asks for the code, then remembers it (the same code unlocks the chat). Without it the page shows only the lock screen. Don't put booking references, passport numbers or payment details in the plan anyway: everyone with the code can read it.

The forecast comes from [Open-Meteo](https://open-meteo.com/) (free, no key) and appears about 16 days before each day; until then the day shows typical July temperatures. Sunrise and sunset are calculated on the page.

```
docs/                 static site (code only, no trip data), served by GitHub Pages
  index.html          page shell, map column, assistant button and panel
  sw.js               offline copy (service worker)
  styles.css
  trip.json, i18n/    a local copy of the plan from scripts/plan.sh pull, for editing (gitignored, never committed)
  app.js              overview, day view, pace, what to bring, names switch, Google map, bookings + checklists, expense log, live plan updates
  chat.js             trip assistant: the panel, its steps and approval cards
  config.js           backend URL + Google Maps key
backend/
  server.py           FastAPI + Claude API, streams answers; serves the live plan and the assistant's tools to change it; stores the expense log
  plan.py             the live plan: checks, history, undo, replacing it with a version edited on a laptop
  .env                secrets (not committed)
scripts/
  build_routes.py     regenerates the drive lines in trip.json
  plan.sh             pull the live plan from the Pi to edit it, push it back
deploy/                the backend's systemd unit on the Pi, and the 15-minute backup timer
scripts/pi-setup.sh   one-time setup on the Pi; scripts/pi-update.sh   what each deploy runs;
scripts/pi-backup-plan.sh   commits the Pi's data folder (plan, expenses) to a git history on the Pi
```

## Edit the plan

Usually you just ask the chat assistant (see above). To edit the file by hand, or to change many things at once:

The plan is never committed: it lives only on the Pi. With ssh access to the Pi:

1. `scripts/plan.sh pull` copies the live plan into `docs/trip.json` and `docs/i18n/en.json` (both gitignored). Pull right before editing, so you have the chat's latest changes.
2. Edit them (and run `scripts/build_routes.py`, `scripts/i18n_strings.py` as needed).
3. `scripts/plan.sh push "what changed"` uploads it. The backend checks it (shape, place ids, English for every Chinese string, the assistant can read it) and refuses it with the reasons if not. The version it replaces stays in the history, so asking the assistant to undo that change brings it back. The upload goes from the Pi itself with the admin token in `data/admin.token`, which never leaves the Pi.

The plan's format (`docs/trip.json`):

- `places`: `{"gullfoss": {"zh": "黄金瀑布", "local": "Gullfoss", "en": "Gullfoss", "ll": [lat, lon]}}`. Write `[[gullfoss]]` anywhere in text (titles, bodies, tips, bookings) and the page renders it as 黄金瀑布 (hover: Gullfoss) or Gullfoss.
- `legs`: the overview segments, `{"c": "no", "from": "2027-07-16", "to": "2027-07-20", "title": "...", "draft": true}`.
- `days`: one entry per planned date. Dates with no entry show as 规划中 (being planned).
  - Stops: `{"t":"stop", "place", "start":"HH:MM", "end", "kind", "name", "verb", "body", "facts", "tips"}`. Times are optional.
  - Moves: `{"t":"move", "mode":"drive|flight|ferry|train|bus|walk", "path":[place ids], "start", "end"}` or `"mins"` instead of times.
  - Optional extras: `"options": [...]` on a day holds things left out of the plan, kept for spare time. Each is `{"after": place id of the stop it follows, "place", "name", "kind", "start", "end"` (or `"mins"`), `"body", "facts", "tips", "why"` (why it isn't in the plan), `"in"` and `"out": {"mode", "mins", "path":[from, to], "note"}}`. The day view shows them as one folded "可选 · N" line after that stop (at the end of the day without `after`); opening it shows each as a card with its time, travel there and back, and details. They never count toward the day's pace, map or drives. The assistant adds them the same way.
  - Walking routes: consecutive segs (stops and the walk moves between them) that share a `"group"` name, e.g. `"group": "市中心步行一圈"`, fold into one row in the day view: the name, the time it all takes, the number of stops, the walking in total (a walk's `km`, or the straight line plus a quarter) and the stops as a little route. Opening it lists the stops and walks; each stop opens on its own as usual.
  - Place stories: `places.<id>.story` is a list of `[label, text]` pairs (label `历史`, `冷知识` or `名字的来历`), shown under 背景和小知识 in that stop's details.
- `kinds`, `countries` (colour, time zone, July normals), `bookings`, `prep`, `sources`.
- A booking's `"days": ["2027-07-06", ...]` are the dates it's for (nights for a stay, the pickup day for a car). Those days show it in their day card, booked or not, and the calendar marks days with anything still unbooked.
- `entry`: visa and entry steps per passport, shown on the prep tab once a visitor picks theirs (saved on that device). Profiles are `ca` (Canadian passport) and `cn-ca`, `cn-uk`, `cn-cn` (Chinese passport, by country of residence). A booking with `"who": ["cn-ca"]` or `["ca"]` only shows for those passports (`"cn"` would mean every Chinese passport).

### Photos

Scenic stops show up to three photos from [Unsplash](https://unsplash.com) (`places[id].photos`), each checked by eye against reference photos of the place before it's added. They load straight from Unsplash's image servers and every one credits the photographer and Unsplash. Stops still waiting for photos show a grey 照片待定 / Photo TBD tile.

### English text

The English page reads `docs/i18n/en.json`, a map from each Chinese string in `trip.json` to its English version (interface strings live in `UIEN` in `app.js`). After editing the plan, list what still needs translating:

```bash
python3 scripts/i18n_strings.py
```

It writes the untranslated strings to `plan/i18n-todo.json` (not committed). Until a line is translated, the English page shows it in Chinese.

### Routes

After changing where a drive starts or ends, rebuild the route lines (free OSRM service):

```bash
python3 scripts/build_routes.py
```

## Run the backend

The backend runs on the Raspberry Pi (`ssh pi`), set up like the Pi's other services, and nothing runs on the Mac:

- It's the user service `nordic-trip` on `127.0.0.1:8791`, public through Tailscale Funnel at `https://pi.tail3d8516.ts.net/nordic` (the address in `docs/config.js`).
- The chat answers through cli-bridge on the Pi (`ANTHROPIC_BASE_URL=http://127.0.0.1:8787`), so it uses the Claude Code sign-in there, not an API key.
- Everything lives in `~/services/nordic-trip`: `repo` (a checkout of `main`), `.venv`, `.env` (settings and secrets, from `backend/.env.example`) and `data` (the expense log and `plan/`: the live plan, its change history and the versions kept for undo; back this folder up).
- The user timer `nordic-trip-backup.timer` runs `scripts/pi-backup-plan.sh` every 15 minutes: when anything in `data` changed, it commits it to a git history in `data` itself (nothing goes to the public repo). Set `BACKUP_REMOTE` in `.env` to a private repo to also push it off the Pi.
- **Deploys are automatic:** it's listed in `~/services/services.json`, so pi-dash checks GitHub every 5 minutes. When `main` has new commits, pi-dash pulls them, runs `scripts/pi-update.sh` (Python packages, systemd units, restart) and health-checks it. The page itself is on GitHub Pages and updates on push too.

Useful commands on the Pi:

```bash
journalctl --user -u nordic-trip -f
```

```bash
systemctl --user restart nordic-trip
```

To set it up on a fresh Pi, put the `.env` in `~/services/nordic-trip/.env`, then run (safe to run again):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Xiao215/nordic-trip-2027/main/scripts/pi-setup.sh)
```

## Google Maps

Without a key the page uses Google's basic embedded map: one day's drive at a time (opening a stop shows the drive from the day's start to it, with the red pin on it), and a country view on the overview. With a key (Maps JavaScript API, restricted to `https://xiao215.github.io/*`, `https://pi.tail3d8516.ts.net/*` and `http://localhost:8001/*`) you get every drive on real roads, flights as great circles, numbered stop pins and where-you-sleep pins for the whole month; opening a stop highlights its pin on the whole day's route. Paste it into `googleMapsKey` in `docs/config.js`.

## Local testing

```bash
python3 -m http.server 8001 --directory docs
```

Then open `http://localhost:8001/?api=http://localhost:8791` to point the chat at a backend you run yourself with `cd backend && uv run python server.py` (it needs a `backend/.env`; its data files and live plan go in `backend/`). The backend also serves the site itself at `http://localhost:8791/`.

## Host the frontend

GitHub Pages serving `docs/` from `main`, at `https://xiao215.github.io/nordic-trip-2027/`.
