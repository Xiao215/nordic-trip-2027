# Nordic Trip 2027 · 北欧之旅 2027

Trip planner for Jul 4 – Aug 1, 2027 (Iceland → Norway → Stockholm → Visby → Copenhagen). The page is in Chinese or English (中文 / EN switch in the sticky bar). In Chinese, place names show in Chinese and hovering one shows its local spelling; in English, the whole page is English and place names are written the way signs and maps show them (Icelandic, Norwegian, Swedish, Danish). The chat answers in the page's language.

A currency menu next to the language switch shows every price in the local currency as written (ISK, NOK, SEK, DKK, €) or converted to CAD, CNY or USD with the latest rates from [open.er-api.com](https://open.er-api.com) (cached for 12 hours, with a fallback in `trip.json` under `fx`). Hover a converted price to see the original.

What's on it: an overview (route ribbon, 4-week calendar, route legs), one day at a time (forecast or July normals, sunrise and sunset, transport and outdoor totals, the timeline), a Google map that shows whatever you open (on phones it opens inside the stop you tap), booking cards grouped into "do now", "opens later" and "booked" (days and calendar cells flag anything still unbooked), checklists, a shared expense log (账本), plus a floating chat assistant (Ctrl/⌘+K) that knows the plan, searches the web and answers in Chinese.

The expense log (账本 tab) is one shared ledger for the group: add the people, then log each expense with who paid and who shares it, in any currency. It totals spending by category, shows each person's balance and the fewest transfers to settle up, in the currency picked in the top bar (CAD when that's "local"). It lives on the backend in `backend/expenses.json` (not committed; back it up) behind the same access code as the chat. Each device keeps the last copy it saw, so the log still reads with no signal, and anything added offline waits on that device and syncs once the backend answers again.

The forecast comes from [Open-Meteo](https://open-meteo.com/) (free, no key) and appears about 16 days before each day; until then the day shows typical July temperatures. Sunrise and sunset are calculated on the page.

```
docs/                 static site, served by GitHub Pages
  index.html          page shell, map column, chat bar
  styles.css
  trip.json           THE PLAN: legs, days, places, bookings, checklists (page and AI both read this)
  app.js              overview, day view, names switch, Google map, bookings + checklists, expense log
  chat.js             trip assistant
  config.js           backend URL + Google Maps key
backend/
  server.py           FastAPI + Claude API, streams answers; stores the shared expense log
  .env                secrets (not committed)
scripts/
  build_routes.py     regenerates the drive lines in trip.json
start.sh              runs the backend and publishes it with Tailscale Funnel
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

1. Copy `backend/.env.example` to `backend/.env`, set `ACCESS_CODE` (the chat asks for it once per device), and either `ANTHROPIC_BASE_URL=http://127.0.0.1:8787` (your local claude-api, personal use) or `ANTHROPIC_API_KEY`.
2. Make sure the Tailscale app is running, then:

   ```bash
   ./start.sh
   ```

   This serves the backend on `127.0.0.1:8791` and publishes it with Tailscale Funnel on port **10000** (443 and 8443 are used by other apps), at `https://xiaos-macbook-pro.tail3d8516.ts.net:10000`.

The chat only works while your Mac is awake, online and running `start.sh`; the rest of the page always works. To unpublish:

```bash
tailscale funnel --https=10000 off
```

## Google Maps

Without a key the page uses Google's basic embedded map: one stop or one day's drive at a time, and a country view on the overview. With a key (Maps JavaScript API, restricted to `https://xiao215.github.io/*` and `http://localhost:8001/*`) you get every drive on real roads, flights as great circles, numbered stop pins and where-you-sleep pins for the whole month. Paste it into `googleMapsKey` in `docs/config.js`.

## Local testing

```bash
python3 -m http.server 8001 --directory docs
```

Then open `http://localhost:8001/?api=http://localhost:8791` to point the chat at a local backend. The backend also serves the site itself at `http://localhost:8791/`.

## Host the frontend

GitHub Pages serving `docs/` from `main`, at `https://xiao215.github.io/nordic-trip-2027/`.
