# Nordic Trip 2027 · 北欧之旅 2027

Trip planner for Jul 4 – Aug 1, 2027 (Iceland → Norway → Stockholm → Visby → Copenhagen). The page is in Chinese or English (中文 / EN switch in the sticky bar). In Chinese, place names show in Chinese and hovering one shows its local spelling; in English, the whole page is English and place names are written the way signs and maps show them (Icelandic, Norwegian, Swedish, Danish). The chat answers in the page's language.

A currency menu next to the language switch shows every price in the local currency as written (ISK, NOK, SEK, DKK, €) or converted to CAD, CNY or USD with the latest rates from [open.er-api.com](https://open.er-api.com) (cached for 12 hours, with a fallback in `trip.json` under `fx`). Hover a converted price to see the original.

What's on it: an overview (route ribbon, 4-week calendar with how full each day is, driver rotation, route legs), one day at a time (forecast or July normals, sunrise and sunset, transport and outdoor totals, the day's pace, who drives, what to bring, the timeline), a Google map that shows whatever you open (on phones it opens inside the stop you tap), booking cards grouped into "do now", "opens later" and "booked" (days and calendar cells flag anything still unbooked), a shared options board (候选) for choosing hotels and tours together, checklists, a shared expense log (账本), plus a floating chat assistant (Ctrl/⌘+K) that knows the plan, searches the web and answers in Chinese.

The expense log (账本 tab) is one shared ledger for the group: add the people, then log each expense with who paid and who shares it, in any currency. It totals spending by category, shows each person's balance and the fewest transfers to settle up, in the currency picked in the top bar (CAD when that's "local"). It lives on the backend in `expenses.json` in the Pi's data folder (back it up) behind the same access code as the chat. Each device keeps the last copy it saw, so the log still reads with no signal, and anything added offline waits on that device and syncs once the backend answers again.

The options board (候选 tab) is where the group chooses things together without editing `trip.json`, and it's filled by talking to the chat assistant rather than by filling in a form. Type a rough line in the box at the top of the tab (or in the chat anywhere): paste a link and say what you think ("this Flåm place looks good https://… about 2,400 NOK a night, right by the pier"), and the assistant works out which booking from `trip.json` it belongs to, fills in the name, photo and price from the link, and files it there. When it can't tell where something goes, it asks. The same goes for decisions: "pick Flåmsbrygga for Flåm and drop the rest", "move that one to Oslo", "I vote for the hostel, and note it's far from the station". Anyone can also start a topic that isn't a booking ("Lofoten cabin"). On the board itself everyone can still vote 👍/👎, comment, pick or delete with one tap; votes and comments carry the name written at the top of the tab. The booking card on the prep tab shows how many options there are, or which one the group picked. The board lives on the backend in `options.json` in the Pi's data folder (back it up), behind the same access code as the chat. It reads and queues changes offline like the expense log. Link previews are fetched by the backend, which only fetches public web addresses, never your own machine or local network.

Each day gets a pace, 轻松 / 适中 / 很满 (easy / moderate / full), shown as three bars on the calendar, the day strip and the day card. It's worked out from the plan: hours driving (buses, trains and ferries count about half), hours on foot, how long the day runs, and early starts or late finishes. The day card says why ("7 h driving · leave 05:30") and flags a run of full days, and the overview names the longest run. To override a day, add `"pace": 1`–`3` and an optional `"paceNote"` to it in `trip.json`.

The day card also lists what to bring (带上), worked out from the day: passport on flight or border days, licence and a physical card when a new rental car starts, boots and snacks for long walks, swimsuit for hot pools, a waterproof for waterfalls, gloves and sunglasses for glacier walks, camping gear, seasickness tablets for long ferries, and rain or warm layers once the forecast says so. Add your own with `"bring": ["..."]` on a day. Tapping an item ticks it off on that device.

Driver rotation (司机轮换, on the overview) is shared by the group: add who can drive, then pick a driver in each drive on the day view, or let 把没排的自动排上 (fill in the rest) hand over every ~2.5 hours to whoever has driven least. It shows each driver's total and longest day. It lives on the backend in `drivers.json` in the Pi's data folder, behind the same access code; drives are keyed by date and start/end place, so renaming a drive's places in `trip.json` drops its driver. Picks made offline wait on the device and sync later.

The site works offline once it's been opened (`docs/sw.js`): the page, the plan, the last forecast and exchange rates come from the device when there's no signal, and an orange bar says so. Photos are kept once seen, and 准备 → 离线使用 (Prep → Offline use) downloads all of them ahead of time (about 35 MB). Google Maps and the chat still need a connection.

The forecast comes from [Open-Meteo](https://open-meteo.com/) (free, no key) and appears about 16 days before each day; until then the day shows typical July temperatures. Sunrise and sunset are calculated on the page.

```
docs/                 static site, served by GitHub Pages
  index.html          page shell, map column, chat bar
  sw.js               offline copy (service worker)
  styles.css
  trip.json           THE PLAN: legs, days, places, bookings, checklists (page and AI both read this)
  app.js              overview, day view, pace, what to bring, names switch, Google map, bookings + checklists, options board, expense log, drivers
  chat.js             trip assistant
  config.js           backend URL + Google Maps key
backend/
  server.py           FastAPI + Claude API, streams answers; stores the shared expense log, drivers and options board, fetches link previews
  .env                secrets (not committed)
scripts/
  build_routes.py     regenerates the drive lines in trip.json
deploy/nordic-trip.service   the backend's systemd unit on the Pi
scripts/pi-setup.sh   one-time setup on the Pi; scripts/pi-update.sh   what each deploy runs
```

## Edit the plan

Everything lives in `docs/trip.json`:

- `places`: `{"gullfoss": {"zh": "黄金瀑布", "local": "Gullfoss", "en": "Gullfoss", "ll": [lat, lon]}}`. Write `[[gullfoss]]` anywhere in text (titles, bodies, tips, bookings) and the page renders it as 黄金瀑布 (hover: Gullfoss) or Gullfoss.
- `legs`: the overview segments, `{"c": "no", "from": "2027-07-16", "to": "2027-07-20", "title": "...", "draft": true}`.
- `days`: one entry per planned date. Dates with no entry show as 规划中 (being planned).
  - Stops: `{"t":"stop", "place", "start":"HH:MM", "end", "kind", "name", "verb", "body", "facts", "tips"}`. Times are optional.
  - Moves: `{"t":"move", "mode":"drive|flight|ferry|train|bus|walk", "path":[place ids], "start", "end"}` or `"mins"` instead of times.
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
- Everything lives in `~/services/nordic-trip`: `repo` (a checkout of `main`), `.venv`, `.env` (settings and secrets, from `backend/.env.example`) and `data` (the expense log, drivers and options board; back this folder up).
- **Deploys are automatic:** it's listed in `~/services/services.json`, so pi-dash checks GitHub every 5 minutes. When `main` has new commits, pi-dash pulls them, runs `scripts/pi-update.sh` (Python packages, systemd unit, restart) and health-checks it. The page itself is on GitHub Pages and updates on push too.

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

Without a key the page uses Google's basic embedded map: one stop or one day's drive at a time, and a country view on the overview. With a key (Maps JavaScript API, restricted to `https://xiao215.github.io/*` and `http://localhost:8001/*`) you get every drive on real roads, flights as great circles, numbered stop pins and where-you-sleep pins for the whole month. Paste it into `googleMapsKey` in `docs/config.js`.

## Local testing

```bash
python3 -m http.server 8001 --directory docs
```

Then open `http://localhost:8001/?api=http://localhost:8791` to point the chat at a backend you run yourself with `cd backend && uv run python server.py` (it needs a `backend/.env`; its data files go in `backend/`). The backend also serves the site itself at `http://localhost:8791/`.

## Host the frontend

GitHub Pages serving `docs/` from `main`, at `https://xiao215.github.io/nordic-trip-2027/`.
