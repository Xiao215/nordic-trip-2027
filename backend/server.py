"""Chat backend for the Nordic Trip 2027 planner.

One job: answer questions about the trip. The plan itself is read from ../docs/trip.json
(the same file the page renders), so editing the itinerary updates both.
Exposed to the internet through Tailscale Funnel; see ../README.md.
"""

import hmac
import json
import os
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name(".env"), override=True)  # .env wins over the shell

DOCS = Path(__file__).resolve().parent.parent / "docs"
TRIP_FILE = DOCS / "trip.json"
MODEL = os.getenv("MODEL", "claude-opus-5-5")
EFFORT = os.getenv("EFFORT", "low")
BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "")
# A local Anthropic-compatible server (e.g. claude-api on :8787) answers on your own Pro/Max plan.
LOCAL_AI = bool(re.match(r"https?://(localhost|127\.0\.0\.1)(:|/|$)", BASE_URL))
FALLBACKS = os.getenv("FALLBACKS", "off" if LOCAL_AI else "default")  # "off" disables server-side refusal fallback
# The backend is public through Funnel, so the access code is always required.
REQUIRE_CODE = True
ACCESS_CODE = os.getenv("ACCESS_CODE", "")
if not ACCESS_CODE or ACCESS_CODE == "change-me":
    raise SystemExit("Set ACCESS_CODE in backend/.env (the code you type into the chat).")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
DAILY_LIMIT = int(os.getenv("DAILY_LIMIT", "1000"))
TZ = ZoneInfo("America/Toronto")
TRIP_TZ = ZoneInfo("Atlantic/Reykjavik")


if LOCAL_AI:
    print(f"Using the local AI server at {BASE_URL} (personal use; access code required).", flush=True)
elif not os.getenv("ANTHROPIC_API_KEY"):
    print("Warning: ANTHROPIC_API_KEY is not set in backend/.env; chat requests will fail.", flush=True)
client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY") or ("unused" if LOCAL_AI else None))

app = FastAPI(title="Nordic trip chat", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Access-Code"],
)


# ---------- trip context ----------

PLACE = re.compile(r"\[\[([\w-]+)\]\]")


def _maps(ll) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={ll[0]}%2C{ll[1]}"


def render_trip(t: dict) -> str:
    """Turn trip.json into plain text the model can read. [[place]] becomes "中文名 (Local name)"."""
    places, countries = t["places"], t["countries"]

    def name(pid: str) -> str:
        p = places.get(pid) or countries.get(pid)
        if not p:
            return pid
        zh, local, en = p.get("zh"), p.get("local"), p.get("en")
        others = [x for x in dict.fromkeys([local, en]) if x and x != zh]
        return f"{zh} ({' / '.join(others)})" if zh and others else (zh or local or en or pid)

    def tx(s) -> str:
        return PLACE.sub(lambda m: name(m.group(1)), str(s or ""))

    wk = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    out = [f"# {t['title']} ({t.get('titleEn', '')})", t["eyebrow"], tx(t["lede"])]
    out += ["", "## Countries and time zones"]
    out += [f"- {c['zh']} ({c['local']} / {c['en']}): time zone {c['tz']}" for c in countries.values()]
    if t.get("conditions"):
        out += ["", "## Notes"]
        out += [f"- {tx(c[0])}: {tx(c[1])}" for c in t["conditions"]]
    out += ["", "## Route legs (overview)"]
    for leg in t["legs"]:
        out.append(f"### {tx(leg['title'])}: {leg['from']} to {leg['to']}")
        if leg.get("body"):
            out.append(tx(leg["body"]))
        out += [f"- {tx(x)}" for x in leg.get("items", [])]
    out += ["", "## Day by day (dates without an entry here are still being planned)"]
    for d in t["days"]:
        dt = datetime.strptime(d["date"], "%Y-%m-%d")
        out += ["", f"### {d['date']} {wk[dt.weekday()]}: {tx(d['title'])}"]
        if d.get("sub"):
            out.append(tx(d["sub"]))
        if d.get("stay"):
            out.append(f"Sleep: {name(d['stay'])}" + (f" ({tx(d['stayNote'])})" if d.get("stayNote") else ""))
        n = 0
        for s in d["segs"]:
            when = s.get("start", "") + (f"–{s['end']}" if s.get("end") and s.get("end") != s.get("start") else "")
            when = f"{when} " if when else ""
            if s["t"] == "move":
                label = tx(s.get("label") or f"[[{s['path'][0]}]] → [[{s['path'][-1]}]]")
                line = f"- {when}{s['mode'].upper()} {label}"
                if s.get("mins"):  # real length; flights cross time zones, start/end are local
                    line += f" (about {s['mins']} min)"
                if s.get("note"):
                    line += f". {tx(s['note'])}"
                out.append(line)
                continue
            n += 1
            out.append(f"- {when}STOP {n}. {tx(s.get('name') or '[[' + s['place'] + ']]')} [{t['kinds'].get(s['kind'], s['kind'])}]")
            for k, v in s.get("facts", []):
                out.append(f"    {k}: {tx(v)}")
            if s.get("body"):
                out.append(f"    {tx(s['body'])}")
            for tip in s.get("tips", []):
                out.append(f"    Tip: {tx(tip)}")
            out.append(f"    Map: {_maps(places[s['place']]['ll'])}")
    out += ["", "## Bookings"]
    for b in t["bookings"]:
        out.append(f"### {tx(b['what'])} (for {tx(b.get('for', ''))}; book: {tx(b.get('when', b.get('opens', '')))})")
        if b.get("cost"):
            out.append(f"Cost: {tx(b['cost'])}")
        if b.get("summary"):
            out.append(tx(b["summary"]))
        out += [f"{i}. {tx(step)}" for i, step in enumerate(b.get("steps", []), 1)]
        out += [f"- {k}: {tx(v)}" for k, v in b.get("key", [])]
        if b.get("tip"):
            out.append(f"- Tip: {tx(b['tip'])}")
        out += [f"- Link: {n} {u}" for n, u in b.get("links", [])]
    if t.get("entry"):
        e = t["entry"]
        out += ["", "## Visas and entry, by passport (the viewer's passport is in <context> when they've picked one)"]
        for k, p in e["profiles"].items():
            who = e["passports"]["ca"] if k == "ca" else f"{e['passports']['cn']}，住在{e['live'][k[3:]]}"
            out.append(f"### {who}: {tx(p['head'])}")
            out.append(tx(p["sub"]))
            out += [f"{i}. {tx(st['t'])} ({tx(st['when'])})" + (f": {tx(st['more'])}" if st.get("more") else "") for i, st in enumerate(p["steps"], 1)]
    out += ["", "## Before you go"]
    for card in t["prep"]:
        out.append(f"### {card['title']}")
        out += [f"- {tx(i['t'])}" + (f" ({tx(i['more'])})" if i.get("more") else "") for i in card["items"]]
    out += ["", "## Sources"]
    out += [f"- {n}: {u}" for n, u in t["sources"]]
    out += ["", tx(t["footnote"])]
    return "\n".join(out)


SYSTEM_TEMPLATE = """你是「北欧之旅 2027」的行程助手。这是一趟 2027 年 7 月 4 日到 8 月 1 日、为期四周的自助游：冰岛自驾环岛，然后挪威峡湾和奥斯陆、斯德哥尔摩、哥特兰岛的维斯比，最后到哥本哈根。旅行者大多是住在多伦多的大学生，喜欢徒步、冰川和自驾，预算有限；有人持中国护照、有人持加拿大护照，也可能有人住在英国或中国。他们从行程网页上打开你，通常用手机，有时在车上或步道上。

默认用简体中文回答。如果 <context> 里写着 lang=en（对方在看英文版网页），就用英文回答，地名直接写当地原名（Mývatn、Bergen、København），不要写中文。用中文回答时，地名第一次出现时写中文名，后面括号里写当地语言的原名（冰岛语、挪威语、瑞典语、丹麦语），例如：黄金瀑布 (Gullfoss)、卑尔根 (Bergen)。路牌和导航上都是原名，所以原名一定要拼对，包括 þ、ð、æ、ø、å、ö 这些字母。

先根据下面的行程回答。行程里没有的（天气、营业时间、路况和 F 路开放情况、价格、渡轮和航班时刻、门票），就上网查，并简短说明来源；冰岛路况以 road.is 和 safetravel.is 为准。行程和网上信息不一致时要指出来。不知道就说不知道，绝不编造时间、价格或电话。

回答要短而实用：先用一两句话给出答案，确实有帮助时再加几条要点。时间用当地时间、24 小时制（冰岛 UTC+0，挪威、瑞典、丹麦夏令时 UTC+2）。有人问某地在哪，就附上 Google 地图链接。价格用当地货币（ISK、NOK、SEK、DKK）；如果 <context> 里有 currency（CAD、CNY 或 USD），在括号里附上大约的换算。有人想改行程时，说明改动会影响什么（时间、预订、还车地点等），并提醒网页只有在行程作者修改 trip.json 后才会更新。整个行程都还是初步的，欢迎帮忙出主意、调整，但不要说哪部分“已定”或“是草案”。

签证、入境、TRV、ETIAS 这类问题要看对方用哪本护照、住在哪里：<context> 里有 passport 时，按 trip_plan 里对应那本护照的步骤回答；没有时先问一句，或者把中国护照和加拿大护照的情况分开说。

Latency-sensitive; begin your visible answer immediately.

<trip_plan>
{plan}
</trip_plan>"""

_cache: dict = {"mtime": None, "system": None}


def system_prompt() -> str:
    """Re-read trip.json only when it changes, so the cached prompt prefix stays byte-identical."""
    mtime = TRIP_FILE.stat().st_mtime
    if _cache["mtime"] != mtime:
        trip = json.loads(TRIP_FILE.read_text())
        _cache.update(mtime=mtime, system=SYSTEM_TEMPLATE.format(plan=render_trip(trip)))
    return _cache["system"]


WEB_SEARCH = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 4,
    "user_location": {
        "type": "approximate",
        "city": "Reykjavik",
        "country": "IS",
        "timezone": "Atlantic/Reykjavik",
    },
}


# ---------- guard rails: access code + daily limit ----------

_daily = {"day": None, "count": 0}


def check_code(code: str | None) -> None:
    if not REQUIRE_CODE:
        return
    if not code or not hmac.compare_digest(code.strip().encode(), ACCESS_CODE.encode()):
        raise HTTPException(401, "访问码不对。")


def daily_limit() -> None:
    today = datetime.now(TZ).date()
    if _daily["day"] != today:
        _daily.update(day=today, count=0)
    if _daily["count"] >= DAILY_LIMIT:
        raise HTTPException(429, "行程助手今天的提问次数用完了。")
    _daily["count"] += 1


# ---------- API ----------

class Msg(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=8000)


class ChatIn(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=40)
    name: str = Field(default="", max_length=40)
    context: dict | None = None


@app.get("/api/health")
async def health():
    return {"ok": True, "model": MODEL, "local": LOCAL_AI, "code": REQUIRE_CODE}


@app.post("/api/check")
async def check(x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    return {"ok": True}


def sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/api/chat")
async def chat(body: ChatIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    daily_limit()

    msgs = [m.model_dump() for m in body.messages][-20:]
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    if not msgs or msgs[-1]["role"] != "user":
        raise HTTPException(400, "最后一条消息必须是提问。")
    # merge accidental back-to-back turns from the same role (e.g. after a failed request)
    merged: list[dict] = []
    for m in msgs:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] += "\n\n" + m["content"]
        else:
            merged.append(dict(m))

    # Per-request details go in the latest user turn, never in the system prompt (keeps it cacheable).
    now = datetime.now(TZ).strftime("%A %B %-d, %Y, %H:%M")
    trip_now = datetime.now(TRIP_TZ).strftime("%H:%M")
    ctx = [f"Right now it is {now} in Toronto ({trip_now} in Iceland)."]
    if body.name.strip():
        ctx.append(f"Asked by {body.name.strip()}.")
    if body.context:
        view = {k: str(v)[:160] for k, v in body.context.items() if k in ("lang", "currency", "day", "time", "looking_at", "passport") and v}
        if view:
            ctx.append("On the planner they're viewing: " + ", ".join(f"{k}={v}" for k, v in view.items()) + ".")
    merged[-1]["content"] = f"<context>{' '.join(ctx)}</context>\n\n{merged[-1]['content']}"

    lang_en = bool(body.context and body.context.get("lang") == "en")
    return StreamingResponse(
        answer(merged, lang_en),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def answer(messages: list[dict], lang_en: bool = False):
    extra = {}
    if FALLBACKS != "off":
        extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": FALLBACKS}
    tools = [WEB_SEARCH]
    try:
        for _ in range(4):  # a long web search can pause the turn; resume it a few times at most
            try:
                stream_cm = client.beta.messages.stream(
                    model=MODEL,
                    max_tokens=16000,
                    system=[{"type": "text", "text": system_prompt(), "cache_control": {"type": "ephemeral"}}],
                    messages=messages,
                    tools=tools,
                    output_config={"effort": EFFORT},
                    **extra,
                )
                stream = await stream_cm.__aenter__()
            except anthropic.BadRequestError as e:
                # Some local servers don't offer web search; answer from the plan alone instead.
                if tools and "tool" in str(e).lower():
                    print("[chat] web search not available on this AI server; continuing without it", flush=True)
                    tools = []
                    continue
                raise
            try:
                async for event in stream:
                    if event.type == "text":
                        yield sse({"type": "text", "text": event.text})
                    elif event.type == "content_block_start":
                        kind = event.content_block.type
                        if kind == "server_tool_use":
                            yield sse({"type": "status", "text": "Searching the web" if lang_en else "正在上网查"})
                        elif kind == "web_search_tool_result":
                            yield sse({"type": "status", "text": "Reading results" if lang_en else "正在看搜索结果"})
                final = await stream.get_final_message()
            finally:
                await stream_cm.__aexit__(None, None, None)

            u = final.usage
            print(f"[chat] stop={final.stop_reason} in={u.input_tokens} cache_read={u.cache_read_input_tokens} out={u.output_tokens}", flush=True)
            if final.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": final.content})
                continue
            if final.stop_reason == "refusal":
                yield sse({"type": "error", "message": "助手没法回答这个问题，换个说法试试。"})
            break
    except anthropic.RateLimitError:
        yield sse({"type": "error", "message": "AI 服务正忙，过一分钟再试。"})
    except anthropic.AuthenticationError:
        print("[chat] Anthropic authentication failed: check ANTHROPIC_API_KEY in backend/.env", flush=True)
        yield sse({"type": "error", "message": "行程服务器的 AI 密钥没配置好。"})
    except anthropic.APIStatusError as e:
        print(f"[chat] API error {e.status_code}: {e.message}", flush=True)
        yield sse({"type": "error", "message": f"AI 服务返回了错误（{e.status_code}）。"})
    except anthropic.APIConnectionError:
        yield sse({"type": "error", "message": "行程服务器连不上 AI 服务。"})
    except Exception as e:  # e.g. no API key configured: the SDK raises before sending anything
        print(f"[chat] {type(e).__name__}: {e}", flush=True)
        yield sse({"type": "error", "message": "行程服务器出错了，告诉行程作者。"})
    yield sse({"type": "done"})


# ---------- the site itself ----------
# The backend also serves docs/, so one address gives you the page and the chat.

@app.get("/config.js", include_in_schema=False)
async def config_js():
    # Served from here, the page should talk to this same server rather than the URL in config.js.
    js = (DOCS / "config.js").read_text()
    js = re.sub(r'apiBase:\s*"[^"]*"', 'apiBase: ""', js)
    return Response(js, media_type="text/javascript", headers={"Cache-Control": "no-cache"})


app.mount("/", StaticFiles(directory=DOCS, html=True), name="site")


if __name__ == "__main__":
    import uvicorn

    # Bind to localhost only; Tailscale Funnel is what makes it reachable from outside.
    port = int(os.getenv("PORT", "8791"))
    print(f"Site + chat: http://localhost:{port}/", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port)
