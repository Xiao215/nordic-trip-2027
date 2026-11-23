"""Chat backend for the Nordic Trip 2027 planner.

Answers questions about the trip, and keeps the live plan: the page loads it from here and the assistant can
change it in the chat (see plan.py). The repo's docs/trip.json is where it starts and where it's backed up.
Exposed to the internet through Tailscale Funnel; see ../README.md.
"""

import asyncio
import gzip
import hmac
import json
import os
import re
import secrets
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from plan import Plan, PlanError

load_dotenv(Path(__file__).with_name(".env"), override=True)  # .env wins over the shell (on the Pi there is none: systemd passes it)

DOCS = Path(__file__).resolve().parent.parent / "docs"
# The group's shared data (expense log, drivers, the live plan). On the Pi it lives outside the git checkout
# (~/services/nordic-trip/data) so deploys never touch it; locally it defaults to this folder.
DATA = Path(os.getenv("DATA_DIR") or Path(__file__).parent).expanduser()
DATA.mkdir(parents=True, exist_ok=True)
PLAN = Plan(DATA, DOCS)  # the live plan, in DATA/plan
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
        for o in d.get("options", []):
            when = o.get("start", "") + (f"–{o['end']}" if o.get("end") and o.get("end") != o.get("start") else "")
            where = f" after {name(o['after'])}" if o.get("after") else ""
            line = f"- OPTIONAL{where} (not in the plan, shown folded under 可选): {(when + ' ') if when else ''}{tx(o.get('name') or '[[' + o['place'] + ']]')} [{t['kinds'].get(o.get('kind'), o.get('kind'))}]"
            if o.get("why"):
                line += f". Why not planned: {tx(o['why'])}"
            out.append(line)
            if o.get("body"):
                out.append(f"    {tx(o['body'])}")
            for side in ("in", "out"):
                m = o.get(side)
                if m:
                    out.append(f"    {'Getting there' if side == 'in' else 'Getting back'}: {m.get('mode', '')} {m.get('mins', '')} min" + (f". {tx(m['note'])}" if m.get("note") else ""))
    out += ["", "## Bookings"]
    for b in t["bookings"]:
        out.append(f"### {tx(b['what'])} (id: {b['id']}; for {tx(b.get('for', ''))}; book: {tx(b.get('when', b.get('opens', '')))})"
                   + (" BOOKED" if b.get("booked") else ""))
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

回答要短而实用：先用一两句话给出答案，确实有帮助时再加几条要点。时间用当地时间、24 小时制（冰岛 UTC+0，挪威、瑞典、丹麦夏令时 UTC+2）。有人问某地在哪，就附上 Google 地图链接。价格用当地货币（ISK、NOK、SEK、DKK）；如果 <context> 里有 currency（CAD、CNY 或 USD），在括号里附上大约的换算。有人想改行程时，说明改动会影响什么（时间、预订、还车地点等）。

网页上的行程你可以改：你用 edit_plan 提出改动，网页上会出现一张确认卡片，列出每处改动的前后对比，对方点“确认”才会真正改，大家的网页随即更新。大家会跟你说得很随意，比如“我们订好 Odda 的住宿了”、“第 12 天下午改成去看冰川”、“这家酒店不错 https://…，一晚 1,890 NOK，加到弗洛姆的住宿里”。
- 改之前先用 read_plan 读出要改的那部分原样的 JSON，再用 edit_plan 提出改动，沿用原来的字段和写法。一件事的改动放在一次 edit_plan 里。
- 意思明确就直接提出改动，不用先口头问“要不要改”，卡片就是确认。把别人贴的链接加进对应预订的 links（标签写名字和价格，比如 ["Flåmsbrygga · 约 2,400 NOK/晚", "https://…"]），需要的话在 tip 里加一句为什么不错。
- 大一点的改动（删掉或挪动景点、换住的地方、调整好几天的安排、改路线）提出之前，先用一两句话说清楚会影响什么（时间、预订、还车地点、开车时间）；有几种改法时先问对方选哪种。
- 改哪里、改成什么拿不准时，先简短问一句，给出最可能的一两个选项。只是问建议时先回答，对方说要改再提。
- 提出后用一两句话说你提议了什么；之后对话里会写明对方确认了还是没采用。有人要撤销时，用 plan_history 找到那次改动，再用 undo_plan_change（也会出确认卡片）。
- 行程网页要访问码才能看，但知道访问码的人都能看到，所以绝不要把预订确认号、护照号、电话、住址、付款信息写进行程；有人发来这些，就提醒他们自己保存。
- 新加或改动的中文文字，要在 en 里给出英文（英文网页用），地名标记 [[id]] 原样保留。
账本（大家共用的记账，网页上的“账本”页）你可以读、也可以记：
- 问到花了多少、谁欠谁、谁付了什么，就用 read_expenses 读账本（里面有每人付了多少、该摊多少、怎么结清），按它的数字回答，不要自己估。货币用 <context> 里的 currency，没有就用 CAD。
- 有人让你记一笔账，或者发来小票、收据、账单的照片，就用 add_expense 提出记账：网页上会出现一张确认卡片，对方点“确认”才记进账本。先用 read_expenses 看成员名字（付款人和平摊的人必须是成员，名字要完全一致）和有没有记过同一笔。
- 看照片时读出商家、日期、总金额（含税的实付总额，不是小计）和货币；冰岛小票上 kr 是 ISK，挪威是 NOK，瑞典是 SEK，丹麦是 DKK。类别从 food（吃饭）、groceries（超市）、fuel（油费）、transport（交通）、stay（住宿）、tickets（门票活动）、other 里选。what 写简短的商家或内容，比如“Bónus 超市”“N1 加油”。
- 谁付的：对方说了就用；没说就先问一句是谁付的（列出账本成员让对方选），不要猜，也不要默认是提问的人。平摊：对方没说就默认所有成员平摊，并在回答里提一句。日期：小票上有就用小票上的，没有就用今天（行程当地日期）。
- 照片看不清、金额或货币拿不准时，先问，不要猜。一张小票只记一笔，除非对方说要拆开。

整个行程都还是初步的，欢迎帮忙出主意、调整，但不要说哪部分“已定”或“是草案”。

签证、入境、TRV、ETIAS 这类问题要看对方用哪本护照、住在哪里：<context> 里有 passport 时，按 trip_plan 里对应那本护照的步骤回答；没有时先问一句，或者把中国护照和加拿大护照的情况分开说。

Latency-sensitive: a quick question gets its answer right away.

要上网查、要对比好几样东西、或者要动行程和账本的事，对方会在网页上等好一会儿，所以先让对方看到你打算怎么做：
- 第一件事是调用 update_tasks，列出 2 到 5 步，每步十来个字，用对方的语言，比如“对比 7/5 和 7/6 的车程”“查 F208 七月开放情况”“回答”。第一步标 in_progress，其余 pending。在上网查、读行程这些之前做。
- 做完一步、开始下一步时再调用一次：做完的标 done，下一步标 in_progress，每次发整份清单；计划变了就改清单。能和下一步的工具调用放在同一次回复里就放在一起。
- 最后一步通常是“回答”：标成 in_progress 之后直接写回答，写完网页会自动勾上，不用再调用。
- 不用工具、直接就能答的问题不要列清单。

<trip_plan>
{plan}
</trip_plan>"""

_cache: dict = {"rev": None, "system": None}


def system_prompt() -> str:
    """Re-rendered only when the plan changes, so the cached prompt prefix stays byte-identical."""
    if _cache["rev"] != PLAN.rev:
        _cache.update(rev=PLAN.rev, system=SYSTEM_TEMPLATE.format(plan=render_trip(PLAN.trip)))
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
    # photos attached to this turn (receipts…), as data: URLs the page has already shrunk; only the newest turn sends them
    images: list[str] = Field(default_factory=list, max_length=4)


IMAGE_URL = re.compile(r"^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$")


def image_blocks(urls: list[str]) -> list[dict]:
    out = []
    for u in urls:
        m = IMAGE_URL.match(u)
        if not m or len(u) > 6_000_000:
            raise HTTPException(400, "图片格式不对或太大了。")
        out.append({"type": "image", "source": {"type": "base64", "media_type": m.group(1), "data": m.group(2)}})
    return out


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
            merged[-1]["images"] += m["images"]
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
    # photos go with the question they came with; older turns keep only their text
    for i, m in enumerate(merged):
        imgs = m.pop("images", [])
        if imgs and i == len(merged) - 1 and m["role"] == "user":
            m["content"] = [*image_blocks(imgs[:4]), {"type": "text", "text": m["content"]}]

    lang_en = bool(body.context and body.context.get("lang") == "en")
    return StreamingResponse(
        answer(merged, lang_en, body.name.strip()),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


INTERRUPTED = "This part of the response was interrupted before it finished."
# Now and then a reply through the local bridge opens with a stray mode tag; it's held back and dropped.
STRAY_TAG = "<thinking_mode>"
STRAY = re.compile(r"^\s*<thinking_mode>[^<]{0,40}</thinking_mode>\s*")


def unstray(hold: str) -> tuple[str | None, str]:
    """For the start of a run of text: (text to send now, or None to keep holding; what is still held)."""
    head = hold.lstrip()
    if not (head.startswith(STRAY_TAG) or STRAY_TAG.startswith(head)):
        return hold, ""
    m = STRAY.match(hold)
    if m:
        return hold[m.end():], ""
    return (hold, "") if len(hold) > 80 else (None, hold)


async def answer(messages: list[dict], lang_en: bool = False, asker: str = ""):
    betas, extra = [], {}
    if FALLBACKS != "off":
        betas.append("server-side-fallback-2026-07-01")
        extra["fallbacks"] = FALLBACKS
    # The short notes the model writes between tool calls ("found it, now checking the ferry") come back as thinking
    # blocks, empty unless asked for: "updates" returns those notes as text and keeps the reasoning itself hidden.
    thinking = None
    if not LOCAL_AI:
        betas.append("thinking-display-updates-2026-08-18")
        thinking = {"type": "adaptive", "display": "updates"}
    # tool inputs here are short, so they stream as generated (and are validated before running); a local
    # Anthropic-compatible server may not know the field, so it's left off there
    mine = [TASK_TOOL, *PLAN_TOOLS, *EXPENSE_TOOLS]
    own = [dict(t, eager_input_streaming=True) for t in mine] if not LOCAL_AI else mine
    tools = [WEB_SEARCH, *own]
    wrote = False
    try:
        # a long web search can pause the turn, and each round of tool calls takes another request
        for rnd in range(12):
            try:
                stream_cm = client.beta.messages.stream(
                    model=MODEL,
                    max_tokens=16000,
                    system=[{"type": "text", "text": system_prompt(), "cache_control": {"type": "ephemeral"}}],
                    messages=messages,
                    tools=tools,
                    output_config={"effort": EFFORT},
                    **({"thinking": thinking} if thinking else {}),
                    **({"betas": betas} if betas else {}),
                    **extra,
                )
                stream = await stream_cm.__aenter__()
            except anthropic.BadRequestError as e:
                # a model that doesn't offer progress notes (a refusal fallback, say): carry on without them
                if thinking and ("display" in str(e) or "thinking" in str(e)):
                    print(f"[chat] progress notes not available: {e.message}", flush=True)
                    thinking = None
                    betas = [b for b in betas if not b.startswith("thinking-display")]
                    continue
                # Some local servers don't offer web search; answer from the plan alone instead.
                if tools and "tool" in str(e).lower():
                    if WEB_SEARCH in tools:
                        print("[chat] web search not available on this AI server; continuing without it", flush=True)
                        tools = [t for t in tools if t is not WEB_SEARCH]
                    else:
                        print("[chat] tools not available on this AI server; answering from the plan alone", flush=True)
                        tools = []
                    continue
                raise
            try:
                fresh, hold = True, ""
                async for event in stream:
                    if event.type == "content_block_delta" and event.delta.type == "thinking_delta":
                        # a progress note; a reasoning block streams no text under "updates"
                        if event.delta.thinking and event.delta.thinking != INTERRUPTED:
                            yield sse({"type": "note", "id": f"{rnd}-{event.index}", "text": event.delta.thinking})
                    elif event.type == "text":
                        out = event.text
                        if fresh:
                            out, hold = unstray(hold + out)
                            if not out:
                                continue
                            if wrote:  # text after a tool call starts a new paragraph
                                yield sse({"type": "text", "text": "\n\n"})
                        fresh, wrote = False, True
                        yield sse({"type": "text", "text": out})
                    # each tool call shows as a step: started, then labelled with what it looked at, then done
                    elif event.type == "content_block_start":
                        b = event.content_block
                        if b.type != "text" and hold.strip():  # a short run of text that never left the hold
                            yield sse({"type": "text", "text": ("\n\n" if wrote else "") + hold})
                            fresh, wrote, hold = False, True, ""
                        if b.type == "tool_use" and b.name == TASK_TOOL["name"]:
                            pass  # the checklist shows once its input is complete
                        elif b.type in ("server_tool_use", "tool_use"):
                            yield sse({"type": "step", "id": b.id, "label": step_label(b.name, None, lang_en), "state": "running"})
                        elif b.type in ("web_search_tool_result", "web_fetch_tool_result"):
                            yield sse({"type": "step", "id": b.tool_use_id, "state": "done"})
                    elif event.type == "content_block_stop":
                        b = getattr(event, "content_block", None)
                        if b is not None and b.type == "tool_use" and b.name == TASK_TOOL["name"]:
                            items = task_items(b.input)
                            if items:
                                yield sse({"type": "tasks", "items": items})
                        elif b is not None and b.type in ("server_tool_use", "tool_use"):
                            yield sse({"type": "step", "id": b.id, "label": step_label(b.name, b.input if isinstance(b.input, dict) else {}, lang_en)})
                if hold.strip():
                    yield sse({"type": "text", "text": ("\n\n" if wrote else "") + hold})
                    wrote = True
                final = await stream.get_final_message()
            except ValueError:
                # a tool call whose streamed input isn't JSON at all: nothing to answer, so ask again
                print("[chat] unreadable tool input; asking again", flush=True)
                continue
            finally:
                await stream_cm.__aexit__(None, None, None)

            u = final.usage
            print(f"[chat] stop={final.stop_reason} in={u.input_tokens} cache_read={u.cache_read_input_tokens} out={u.output_tokens}", flush=True)
            if final.stop_reason == "pause_turn":
                messages.append({"role": "assistant", "content": final.content})
                continue
            if final.stop_reason == "tool_use":
                messages.append({"role": "assistant", "content": final.content})
                results = []
                for b in final.content:
                    if b.type != "tool_use":
                        continue
                    if b.name == TASK_TOOL["name"]:
                        ok = task_items(b.input) is not None
                        results.append({"type": "tool_result", "tool_use_id": b.id,
                                        **({"content": "Shown."} if ok else {"content": "Each task needs text and a status of pending, in_progress or done; at most 8.", "is_error": True})})
                        continue
                    text, err, card = await run_plan_tool(b.name, b.input if isinstance(b.input, dict) else {}, asker, lang_en)
                    yield sse({"type": "step", "id": b.id, "state": "error" if err else "done"})
                    if card:
                        yield sse({"type": "approval", "card": card})
                    results.append({"type": "tool_result", "tool_use_id": b.id, "content": text, **({"is_error": True} if err else {})})
                messages.append({"role": "user", "content": results})
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


# ---------- shared expense log ----------
# One small JSON file next to this script holds who's on the trip and every expense. The page keeps
# a copy for offline reading and queues new entries until it can reach this server again, so adding
# is idempotent (the page picks the id) and every write answers with the whole log.

EXPENSES_FILE = DATA / "expenses.json"
CURRENCIES = ("ISK", "NOK", "SEK", "DKK", "EUR", "CAD", "USD", "CNY")
CATEGORIES = ("food", "groceries", "fuel", "transport", "stay", "tickets", "other")
_ledger_lock = asyncio.Lock()


def read_ledger() -> dict:
    try:
        data = json.loads(EXPENSES_FILE.read_text())
    except FileNotFoundError:
        data = {}
    return {"people": data.get("people", []), "items": data.get("items", [])}


def write_json(path: Path, data: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    os.replace(tmp, path)


def write_ledger(data: dict) -> None:
    write_json(EXPENSES_FILE, data)


class ExpenseIn(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,40}$")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    what: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, lt=1e9)
    currency: str = Field(pattern="^(" + "|".join(CURRENCIES) + ")$")
    cat: str = Field(default="other", pattern="^(" + "|".join(CATEGORIES) + ")$")
    paidBy: str = Field(min_length=1, max_length=24)
    split: list[str] = Field(min_length=1, max_length=20)


class PersonIn(BaseModel):
    name: str = Field(min_length=1, max_length=24)


@app.get("/api/expenses")
async def expenses(x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    return read_ledger()


@app.post("/api/expenses")
async def add_expense(body: ExpenseIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    async with _ledger_lock:
        data = read_ledger()
        if any(x["id"] == body.id for x in data["items"]):
            return data  # already saved (the page retried after a dropped connection)
        people = set(data["people"])
        if body.paidBy not in people or not set(body.split) <= people:
            raise HTTPException(400, "付款人和平摊的人都要先加进成员里。")
        if len(data["items"]) >= 5000:
            raise HTTPException(400, "账本满了。")
        item = body.model_dump()
        item["what"] = item["what"].strip()
        item["split"] = list(dict.fromkeys(item["split"]))
        item["ts"] = int(datetime.now(TZ).timestamp() * 1000)
        data["items"].append(item)
        write_ledger(data)
        return data


@app.post("/api/expenses/people")
async def add_person(body: PersonIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "名字不能是空的。")
    async with _ledger_lock:
        data = read_ledger()
        if name not in data["people"]:
            if len(data["people"]) >= 20:
                raise HTTPException(400, "最多 20 个人。")
            data["people"].append(name)
            write_ledger(data)
        return data


@app.post("/api/expenses/people/delete")
async def delete_person(body: PersonIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    async with _ledger_lock:
        data = read_ledger()
        if any(x["paidBy"] == body.name or body.name in x["split"] for x in data["items"]):
            raise HTTPException(409, "这个人还有账目，先删掉相关的账再移除。")
        data["people"] = [p for p in data["people"] if p != body.name]
        write_ledger(data)
        return data


# after the /people routes, or "people" would be taken for an expense id
@app.post("/api/expenses/{item_id}/delete")
async def delete_expense(item_id: str, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    async with _ledger_lock:
        data = read_ledger()
        data["items"] = [x for x in data["items"] if x["id"] != item_id]
        write_ledger(data)
        return data


# ---------- driver rotation ----------
# Who can drive and who drives each leg, keyed by the page as "date|from>to" (see app.js boot). Picks arrive in
# batches (the page queues them offline), and every write answers with the whole list.

DRIVERS_FILE = DATA / "drivers.json"
DRIVE_KEY = re.compile(r"^\d{4}-\d{2}-\d{2}\|[\w>.#-]{1,120}$")
_drivers_lock = asyncio.Lock()


def read_drivers() -> dict:
    try:
        data = json.loads(DRIVERS_FILE.read_text())
    except FileNotFoundError:
        data = {}
    return {"drivers": data.get("drivers", []), "assign": data.get("assign", {})}


class AssignIn(BaseModel):
    assign: dict[str, str | None] = Field(max_length=300)


@app.get("/api/drivers")
async def drivers(x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    return read_drivers()


@app.post("/api/drivers/assign")
async def assign_drivers(body: AssignIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    async with _drivers_lock:
        data = read_drivers()
        for key, name in body.assign.items():
            if not DRIVE_KEY.match(key):
                raise HTTPException(400, "车程编号不对。")
            if name is None:
                data["assign"].pop(key, None)
            elif name in data["drivers"]:
                data["assign"][key] = name
            # a driver removed meanwhile on another phone: leave that drive as it is
        write_json(DRIVERS_FILE, data)
        return data


@app.post("/api/drivers/people")
async def add_driver(body: PersonIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "名字不能是空的。")
    async with _drivers_lock:
        data = read_drivers()
        if name not in data["drivers"]:
            if len(data["drivers"]) >= 10:
                raise HTTPException(400, "最多 10 个司机。")
            data["drivers"].append(name)
            write_json(DRIVERS_FILE, data)
        return data


@app.post("/api/drivers/people/delete")
async def delete_driver(body: PersonIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    async with _drivers_lock:
        data = read_drivers()
        data["drivers"] = [p for p in data["drivers"] if p != body.name]
        data["assign"] = {k: v for k, v in data["assign"].items() if v != body.name}
        write_json(DRIVERS_FILE, data)
        return data


# ---------- the live plan ----------
# The page loads the plan from here (falling back to this device's last copy offline), and the assistant changes it
# with the tools below. Reading needs the access code: the plan is only here, not on GitHub. A whole new version
# (edited on a laptop) comes in through /api/plan/replace, with the admin token that only the Pi itself knows.

_plan_lock = asyncio.Lock()
_plan_gz: dict = {"rev": None, "body": b""}


def plan_meta() -> dict:
    return {"rev": PLAN.rev, "last": PLAN.last()}


@app.get("/api/plan/rev")
async def plan_rev(x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    return Response(json.dumps(plan_meta(), ensure_ascii=False), media_type="application/json", headers={"Cache-Control": "no-store"})


@app.get("/api/plan")
async def plan(if_none_match: str | None = Header(default=None), accept_encoding: str | None = Header(default=None),
               x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    etag = f'"{PLAN.rev}"'
    if if_none_match == etag:
        return Response(status_code=304, headers={"ETag": etag})
    if _plan_gz["rev"] != PLAN.rev:  # about 450 KB of JSON, 100 KB gzipped: compressed once per version
        body = json.dumps({**plan_meta(), "trip": PLAN.trip, "en": PLAN.en}, ensure_ascii=False, separators=(",", ":")).encode()
        _plan_gz.update(rev=PLAN.rev, raw=body, body=gzip.compress(body, 6))
    headers = {"Cache-Control": "no-cache", "ETag": etag, "Vary": "Accept-Encoding"}
    if "gzip" in (accept_encoding or ""):
        return Response(_plan_gz["body"], media_type="application/json", headers={**headers, "Content-Encoding": "gzip"})
    return Response(_plan_gz["raw"], media_type="application/json", headers=headers)


# The admin token: ADMIN_TOKEN in .env, or one made on first start in DATA/admin.token (readable only on the Pi).
# scripts/plan.sh push reads it over ssh and calls /api/plan/replace from the Pi itself.
def admin_token() -> str:
    t = os.getenv("ADMIN_TOKEN", "").strip()
    if t:
        return t
    f = DATA / "admin.token"
    if not f.exists():
        f.write_text(secrets.token_urlsafe(32))
        f.chmod(0o600)
    return f.read_text().strip()


ADMIN_TOKEN = admin_token()


class ReplaceIn(BaseModel):
    trip: dict
    en: dict
    summary: str = Field(default="", max_length=200)


@app.post("/api/plan/replace")
async def replace_plan(body: ReplaceIn, x_admin_token: str | None = Header(default=None)):
    if not x_admin_token or not hmac.compare_digest(x_admin_token.strip().encode(), ADMIN_TOKEN.encode()):
        raise HTTPException(401, "admin token required")
    async with _plan_lock:
        try:
            out = PLAN.replace(body.trip, body.en, "laptop", body.summary.strip(), validate=render_trip)
        except PlanError as e:
            raise HTTPException(422, str(e))
    return out


class PlanChange(BaseModel):
    op: str = Field(pattern="^(set|insert|remove)$")
    path: str = Field(min_length=1, max_length=200)
    value: Any = None


class EditPlanIn(BaseModel):
    summary: str = Field(min_length=1, max_length=300)
    changes: list[PlanChange] = Field(min_length=1, max_length=40)
    en: dict[str, str] = Field(default_factory=dict)


class ReadPlanIn(BaseModel):
    path: str = Field(default="", max_length=200)


class UndoIn(BaseModel):
    change_id: str = Field(min_length=1, max_length=40)
    also_later: bool = False


TASK_TOOL = {
    "name": "update_tasks",
    "description": "Show the person a short checklist above your answer of the steps you're taking for this request, and "
                   "keep it current. Send the whole list every time: each step's text (a few words, in the person's language) "
                   "and its status. Call it first, before searching or reading anything, then again as you move to each next "
                   "step. Nothing else happens: it only updates what the page shows.",
    "input_schema": {
        "type": "object",
        "properties": {"tasks": {"type": "array", "maxItems": 8, "items": {
            "type": "object",
            "properties": {"text": {"type": "string"}, "status": {"type": "string", "enum": ["pending", "in_progress", "done"]}},
            "required": ["text", "status"], "additionalProperties": False}}},
        "required": ["tasks"], "additionalProperties": False,
    },
}


def task_items(raw) -> list[dict] | None:
    """The checklist update_tasks asked to show, or None when its input isn't one."""
    items = raw.get("tasks") if isinstance(raw, dict) else None
    if not isinstance(items, list) or not 1 <= len(items) <= 8:
        return None
    out = []
    for t in items:
        if not isinstance(t, dict) or not str(t.get("text", "")).strip() or t.get("status") not in ("pending", "in_progress", "done"):
            return None
        out.append({"text": str(t["text"]).strip()[:80], "status": t["status"]})
    return out


PLAN_TOOLS = [
    {
        "name": "read_plan",
        "description": "Read the exact JSON of part of the trip plan the page shows, before changing it. path picks the "
                       "part: \"days/2027-07-19\", \"days/2027-07-19/segs/2\", \"bookings/odda-stay\", \"places/flam\", "
                       "\"prep\", \"legs/2\", \"entry\". A list item is picked by its id or date, or by its position from 0. "
                       "An empty path gives an outline (day dates, booking ids, place ids). Comes back with \"en\": the English "
                       "the page shows for each piece of Chinese text in it.",
        "input_schema": {"type": "object", "properties": {"path": {"type": "string"}}, "additionalProperties": False},
    },
    {
        "name": "edit_plan",
        "description": "Propose a change to the trip plan. The person gets an approval card on the page listing each "
                       "change (before and after) and it's applied, for everyone, only when they approve it. Each change is one op on a path "
                       "(the same paths as read_plan): set replaces a value or adds a field, insert puts a new item into a "
                       "list before the item at the path (\"-\" as the last segment appends), remove deletes it. Keep the "
                       "fields and formats the plan already uses (read the part first): text can use [[place_id]], **bold** "
                       "and [text](https://url); a new place goes in places first ({zh, local, en, ll: [lat, lng]}). For "
                       "every new or changed Chinese text, give its English in en, keyed by the exact Chinese, with the same "
                       "[[place_id]] markers. Mark a booking booked for everyone with set bookings/<id>/booked true. Something worth doing that isn't in the day's plan (left out, or for spare time) goes in that day's options list, never in segs: {after: place id of the stop it follows, place, name, kind, start/end or mins, body, facts, tips, why (why it's not in the plan), in and out: {mode, mins, path: [from, to], note}}; the page shows them folded under 可选 after that stop. Stops a short walk apart, with the walk moves between them, can share a group name (e.g. group: 市中心步行一圈 on each of those consecutive segs): the page folds them into one walking-route row; keep the group's segs consecutive and give a new walk stop the same group. A place's history and fun facts go in places/<id>/story: [[label, text]] with label 历史, 冷知识 or 名字的来历; they show in that stop's details. All "
                       "changes are checked now and applied together on approval, or none are. summary: one short line in the asker's "
                       "language saying what changed, shown in the history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "changes": {"type": "array", "maxItems": 40, "items": {
                    "type": "object",
                    "properties": {"op": {"type": "string", "enum": ["set", "insert", "remove"]},
                                   "path": {"type": "string"},
                                   "value": {"description": "The new value (any JSON) for set and insert."}},
                    "required": ["op", "path"], "additionalProperties": False}},
                "en": {"type": "object", "additionalProperties": {"type": "string"},
                       "description": "English for each new Chinese text: {\"中文\": \"English\"}."},
            },
            "required": ["summary", "changes"],
            "additionalProperties": False,
        },
    },
    {
        "name": "plan_history",
        "description": "The latest changes to the plan, newest first: id, when (Toronto time), who asked, what changed, and "
                       "whether it was undone. Use it to find a change to undo, or when asked what changed.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "undo_plan_change",
        "description": "Propose putting the plan back to how it was before a change (an id from plan_history); like "
                       "edit_plan it waits for the person to approve a card. If later changes "
                       "exist they'd be undone too, so the first call is refused with the list; check with the person, then "
                       "call again with also_later true. An undo can itself be undone.",
        "input_schema": {"type": "object", "properties": {"change_id": {"type": "string"}, "also_later": {"type": "boolean"}},
                         "required": ["change_id"], "additionalProperties": False},
    },
]
EXPENSE_TOOLS = [
    {
        "name": "read_expenses",
        "description": "Read the group's shared expense log (the page's 账本 tab): the members, totals by category, what "
                       "each person paid and owes, the fewest transfers to settle up, and the expenses themselves, newest "
                       "first. Amounts are converted to `currency` at today's exchange rates for the totals; each expense "
                       "also shows what was typed. Filter the list with person (paid by or shared by) or cat.",
        "input_schema": {"type": "object", "properties": {
            "currency": {"type": "string", "enum": ["CAD", "USD", "CNY", "EUR", "ISK", "NOK", "SEK", "DKK"]},
            "person": {"type": "string"},
            "cat": {"type": "string", "enum": ["food", "groceries", "fuel", "transport", "stay", "tickets", "other"]},
            "limit": {"type": "integer", "minimum": 1, "maximum": 300, "description": "How many expenses to list (default 60)."},
        }, "additionalProperties": False},
    },
    {
        "name": "add_expense",
        "description": "Propose adding one expense to the shared log, e.g. from a receipt photo. The person gets an "
                       "approval card showing it; it's saved only when they approve. paidBy and every name in split must be "
                       "members exactly as read_expenses lists them; split is who shares it equally (all members unless "
                       "told otherwise). amount is the total actually paid, in the receipt's currency.",
        "input_schema": {"type": "object", "properties": {
            "what": {"type": "string", "description": "Short: the shop or what it was, e.g. \"Bónus 超市\"."},
            "amount": {"type": "number"},
            "currency": {"type": "string", "enum": ["ISK", "NOK", "SEK", "DKK", "EUR", "CAD", "USD", "CNY"]},
            "cat": {"type": "string", "enum": ["food", "groceries", "fuel", "transport", "stay", "tickets", "other"]},
            "date": {"type": "string", "description": "YYYY-MM-DD, from the receipt when it shows one."},
            "paidBy": {"type": "string"},
            "split": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        }, "required": ["what", "amount", "currency", "cat", "date", "paidBy", "split"], "additionalProperties": False},
    },
]
CAT_NAMES = {"food": ("吃饭", "Eating out"), "groceries": ("超市", "Groceries"), "fuel": ("油费", "Fuel"),
             "transport": ("交通", "Transport"), "stay": ("住宿", "Lodging"), "tickets": ("门票活动", "Tickets"), "other": ("其他", "Other")}
_fx: dict = {"t": 0.0, "rates": None}


async def fx_rates() -> dict | None:
    """Exchange rates against USD (the same source the page uses), fetched at most every 12 hours."""
    if _fx["rates"] and time.time() - _fx["t"] < 12 * 3600:
        return _fx["rates"]
    def get() -> dict:
        with urllib.request.urlopen("https://open.er-api.com/v6/latest/USD", timeout=6) as r:
            return json.loads(r.read())
    try:
        j = await asyncio.to_thread(get)
        if j.get("result") == "success":
            _fx.update(t=time.time(), rates=j["rates"])
    except (OSError, ValueError):
        pass
    return _fx["rates"]


def fmt_amount(v: float, cur: str) -> str:
    return f"{v:,.0f} {cur}" if cur == "ISK" or abs(v) >= 1000 else f"{v:,.2f} {cur}"


async def expenses_text(raw: dict) -> str:
    data = read_ledger()
    sc = raw.get("currency") or "CAD"
    rates = await fx_rates()
    conv = (lambda v, c: v / rates[c] * rates[sc]) if rates and sc in rates else None
    items = data["items"]
    lines = [f"Members: {', '.join(data['people']) or '(none yet: people are added on the 账本 tab)'}",
             f"{len(items)} expenses."]
    if items and conv:
        ppl = {p: [0.0, 0.0] for p in data["people"]}
        total, cats = 0.0, {}
        for x in items:
            v = conv(x["amount"], x["currency"]) if x["currency"] in rates else 0.0
            total += v
            cats[x["cat"]] = cats.get(x["cat"], 0.0) + v
            ppl.setdefault(x["paidBy"], [0.0, 0.0])[0] += v
            for p in x["split"]:
                ppl.setdefault(p, [0.0, 0.0])[1] += v / len(x["split"])
        lines.append(f"Totals in {sc} at today's rates: {fmt_amount(total, sc)}; by category: "
                     + ", ".join(f"{k} {fmt_amount(v, sc)}" for k, v in sorted(cats.items(), key=lambda kv: -kv[1])))
        lines.append("Each person (paid / their share / net, + means others owe them): " + "; ".join(
            f"{p} {fmt_amount(a, sc)} / {fmt_amount(b, sc)} / {'+' if a - b >= 0 else '-'}{fmt_amount(abs(a - b), sc)}" for p, (a, b) in ppl.items()))
        # fewest transfers: the biggest debtor pays the biggest creditor, repeat (as the page does)
        cr = sorted([[p, a - b] for p, (a, b) in ppl.items() if a - b > .01], key=lambda r: -r[1])
        dr = sorted([[p, b - a] for p, (a, b) in ppl.items() if b - a > .01], key=lambda r: -r[1])
        moves, i, j = [], 0, 0
        while i < len(dr) and j < len(cr):
            v = min(dr[i][1], cr[j][1])
            if v >= .5:
                moves.append(f"{dr[i][0]} → {cr[j][0]} {fmt_amount(v, sc)}")
            dr[i][1] -= v
            cr[j][1] -= v
            i += dr[i][1] < .01
            j += cr[j][1] < .01
        lines.append("To settle up: " + ("; ".join(moves) or "everyone is square"))
    elif items:
        lines.append("(Exchange rates unavailable right now: totals per currency only.)")
    who, cat = (raw.get("person") or "").strip(), raw.get("cat")
    shown = [x for x in items if (not who or x["paidBy"] == who or who in x["split"]) and (not cat or x["cat"] == cat)]
    shown = sorted(shown, key=lambda x: (x["date"], x.get("ts", 0)), reverse=True)[: int(raw.get("limit") or 60)]
    if shown:
        lines += ["", "Expenses, newest first (date · what · amount · category · paid by · shared by):"]
        lines += [f"{x['date']} · {x['what']} · {fmt_amount(x['amount'], x['currency'])} · {x['cat']} · {x['paidBy']} · {', '.join(x['split'])}" for x in shown]
    return "\n".join(lines)


class ExpenseProposal(BaseModel):
    what: str = Field(min_length=1, max_length=80)
    amount: float = Field(gt=0, lt=1e9)
    currency: str = Field(pattern="^(" + "|".join(CURRENCIES) + ")$")
    cat: str = Field(pattern="^(" + "|".join(CATEGORIES) + ")$")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    paidBy: str = Field(min_length=1, max_length=24)
    split: list[str] = Field(min_length=1, max_length=20)


def expense_card_rows(e: dict, lang_en: bool) -> list[dict]:
    share = e["amount"] / len(e["split"])
    L = (lambda zh, en: en if lang_en else zh)
    return [{"op": "field", "path": "what", "where": L("内容", "What"), "before": "", "after": e["what"]},
            {"op": "field", "path": "amount", "where": L("金额", "Amount"), "before": "", "after": fmt_amount(e["amount"], e["currency"])},
            {"op": "field", "path": "cat", "where": L("类别", "Category"), "before": "", "after": CAT_NAMES[e["cat"]][1 if lang_en else 0]},
            {"op": "field", "path": "date", "where": L("日期", "Date"), "before": "", "after": e["date"]},
            {"op": "field", "path": "paidBy", "where": L("谁付的", "Paid by"), "before": "", "after": e["paidBy"]},
            {"op": "field", "path": "split", "where": L("平摊", "Shared by"), "before": "",
             "after": f"{', '.join(e['split'])}" + L(f"（每人 {fmt_amount(share, e['currency'])}）", f" ({fmt_amount(share, e['currency'])} each)")}]


# Changes wait for a person: edit_plan and undo_plan_change check the change and turn it into a proposal, which the
# chat shows as a card with Approve / Not now. Only the card's Approve applies it (POST /api/plan/proposals/<id>).
# Proposals live in memory: after a restart (a deploy) an old card says to ask again.
PROPOSALS: dict[str, dict] = {}


def step_label(name: str, inp: dict | None, lang_en: bool) -> str:
    inp = inp or {}
    if name == "web_search":
        q = str(inp.get("query", ""))
        return (f"Searched the web: {q}" if lang_en else f"上网查：{q}") if q else ("Searching the web" if lang_en else "上网查")
    if name == "web_fetch":
        site = re.sub(r"^https?://(www\.)?", "", str(inp.get("url", ""))).split("/")[0]
        return (f"Read a page: {site}" if lang_en else f"读网页：{site}") if site else ("Reading a page" if lang_en else "读网页")
    if name == "read_plan":
        path = str(inp.get("path", "")) or ("outline" if lang_en else "概览")
        return f"Read the plan: {path}" if lang_en else f"读行程：{path}"
    if name == "edit_plan":
        return f"Prepared a change: {inp.get('summary', '')}" if lang_en else f"准备改动：{inp.get('summary', '')}"
    if name == "plan_history":
        return "Read the change history" if lang_en else "看改动记录"
    if name == "read_expenses":
        return "Read the expense log" if lang_en else "读账本"
    if name == "add_expense":
        amt = f" · {inp.get('amount', '')} {inp.get('currency', '')}" if inp.get("amount") else ""
        return (f"Prepared an expense: {inp.get('what', '')}{amt}" if lang_en else f"准备记账：{inp.get('what', '')}{amt}")
    if name == "undo_plan_change":
        return f"Prepared an undo: {inp.get('change_id', '')}" if lang_en else f"准备撤销：{inp.get('change_id', '')}"
    return name


def _propose(kind: str, payload: dict, title: str, changes: list[dict], by: str) -> dict:
    now = time.time()
    for k in [k for k, v in PROPOSALS.items() if now - v["ts"] > 3 * 86400] + list(PROPOSALS)[:-200]:
        PROPOSALS.pop(k, None)
    pid = secrets.token_urlsafe(8)
    card = {"id": pid, "kind": kind, "title": title, "changes": changes, "by": by, "ts": now, "state": "waiting"}
    PROPOSALS[pid] = {**card, "payload": payload}
    return card


def _card(p: dict) -> dict:
    return {k: v for k, v in p.items() if k != "payload"}


async def run_plan_tool(name: str, raw: dict, asker: str, lang_en: bool) -> tuple[str, bool, dict | None]:
    """Runs one of the assistant's tools: (result for the model, is_error, an approval card when it proposed a change)."""
    by = (asker or "").strip()[:24]
    waiting = ("Proposal {id} is waiting for approval: the page shows the person a card listing these changes, with "
               "Approve and Not now. Nothing is applied until they approve it there. In a sentence or two, say what you "
               "proposed and what it affects; don't ask them to type yes.")
    try:
        if name == "read_plan":
            part = PLAN.part(ReadPlanIn.model_validate(raw).path)
            text = json.dumps(part, ensure_ascii=False, indent=1)
            if len(text) > 60000:
                return f"That part is {len(text)} characters: read a smaller part (one day, one booking).", True, None
            return text, False, None
        if name == "plan_history":
            return json.dumps(PLAN.history(), ensure_ascii=False), False, None
        if name == "edit_plan":
            body = EditPlanIn.model_validate(raw)
            changes = [c.model_dump() for c in body.changes]
            PLAN.try_edit(changes, body.en, validate=render_trip)  # refuse now what couldn't be applied later
            card = _propose("edit", {"changes": changes, "en": body.en, "summary": body.summary.strip()},
                            body.summary.strip(), PLAN.preview(changes, lang_en), by)
            print(f"[plan] proposal {card['id']} by {by or '?'}: {body.summary}", flush=True)
            return waiting.format(id=card["id"]), False, card
        if name == "read_expenses":
            return await expenses_text(raw), False, None
        if name == "add_expense":
            e = ExpenseProposal.model_validate(raw).model_dump()
            e["what"], e["split"] = e["what"].strip(), list(dict.fromkeys(s.strip() for s in e["split"]))
            data = read_ledger()
            missing = [n for n in [e["paidBy"], *e["split"]] if n not in data["people"]]
            if missing:
                return (f"Not members of the log: {', '.join(missing)}. Members are: {', '.join(data['people']) or '(none)'}. "
                        "Use their names exactly, or ask; new people are added on the 账本 tab."), True, None
            same = [x for x in data["items"] if x["date"] == e["date"] and x["currency"] == e["currency"] and abs(x["amount"] - e["amount"]) < .01]
            title = f"{e['what']} · {fmt_amount(e['amount'], e['currency'])}"
            card = _propose("expense", e, ("Expense: " if lang_en else "记账：") + title, expense_card_rows(e, lang_en), by)
            print(f"[money] proposal {card['id']} by {by or '?'}: {title}", flush=True)
            note = (f" Note: the log already has {same[0]['what']} for the same amount on that day; mention it in case it's a duplicate." if same else "")
            return ("Proposal {id} is waiting for approval: the page shows the person a card with this expense, with "
                    "Approve and Not now. Nothing is saved until they approve it. In a sentence, say what you read and "
                    "proposed, in the language they wrote in; don't ask them to type yes.").format(id=card["id"]) + note, False, card
        if name == "undo_plan_change":
            body = UndoIn.model_validate(raw)
            r, later, _ = PLAN.try_undo(body.change_id, body.also_later)
            undone = [{"op": "undo", "path": x["id"], "before": x.get("summary", ""), "after": ""} for x in [r] + later]
            card = _propose("undo", {"change_id": body.change_id, "also_later": body.also_later},
                            ("Undo: " if lang_en else "撤销：") + r.get("summary", ""), undone, by)
            print(f"[plan] proposal {card['id']} by {by or '?'}: undo {body.change_id}", flush=True)
            return waiting.format(id=card["id"]), False, card
    except PlanError as e:
        return str(e), True, None
    except ValueError as e:  # the input didn't match the tool's schema
        return json.dumps({"INVALID_INPUT": str(e)[:800]}), True, None
    return f"Unknown tool {name}.", True, None


class DecideIn(BaseModel):
    approve: bool
    name: str = Field(default="", max_length=40)


@app.post("/api/plan/proposals/{pid}")
async def decide(pid: str, body: DecideIn, x_access_code: str | None = Header(default=None)):
    check_code(x_access_code)
    p = PROPOSALS.get(pid)
    if not p:
        raise HTTPException(410, "这个提议已经失效了（服务器重启过），请让助手再提一次。")
    if p["state"] == "waiting":
        who = body.name.strip()[:24]
        p.update(decided=time.time(), decided_by=who)
        if not body.approve:
            p["state"] = "declined"
        elif p["kind"] == "expense":
            async with _ledger_lock:
                e, data = p["payload"], read_ledger()
                missing = [n for n in [e["paidBy"], *e["split"]] if n not in data["people"]]
                if missing:
                    p.update(state="failed", error=f"{', '.join(missing)} 已经不在账本成员里了。")
                else:
                    iid = secrets.token_urlsafe(9)
                    data["items"].append({"id": iid, **e, "ts": int(time.time() * 1000), **({"addedBy": who} if who else {})})
                    write_ledger(data)
                    p.update(state="applied", change_id=iid)
                    print(f"[money] {iid} added from proposal {pid} (approved by {who or '?'})", flush=True)
        else:
            async with _plan_lock:
                try:
                    q, extra = p["payload"], {"approved_by": who} if who else {}
                    if p["kind"] == "edit":
                        out = PLAN.edit(q["changes"], q["en"], p["by"], q["summary"], validate=render_trip, extra=extra)
                    else:
                        out = PLAN.undo(q["change_id"], p["by"], q["also_later"], extra=extra)
                    p.update(state="applied", change_id=out["change_id"])
                    print(f"[plan] {out['change_id']} applied proposal {pid} (approved by {who or '?'})", flush=True)
                except PlanError as e:
                    p.update(state="failed", error=str(e)[:600])
    return {"card": _card(p), **plan_meta()}


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
