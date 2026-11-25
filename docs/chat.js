(function(){
"use strict";
/* Trip assistant, in a drawer: the 问助手 button (or Ctrl/⌘+K) opens it with the recent conversation; Esc, the ×
   or a click outside closes it, and an answer keeps streaming while it's closed (the button says when it's ready).
   Each answer shows what the assistant looked at as it works (searches, parts of the plan it read), and any change
   it wants to make to the plan as a card: nothing changes until someone presses 确认 on it. History lives in this
   browser only; each question sends the recent conversation to the backend, which streams the answer back as
   server-sent events: text, step (a tool call starting, getting its label, finishing), approval (a card), error. */
// An empty apiBase means "same server as this page" (the backend serves the site too).
var API=((window.TRIP_CONFIG||{}).apiBase||"").replace(/\/$/,"");
var override=new URLSearchParams(location.search).get("api");
if(override&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override))API=override;

var KEY="nt-chat-v1",HISTORY=20;
// the page language comes from the planner (中文 / EN switch); Z picks the matching string
function isEn(){return !!(window.tripApp&&window.tripApp.lang&&window.tripApp.lang()==="en");}
function Z(zh,en){return isEn()?en:zh;}
var SUGGEST={zh:["F208 进高地，我们的车能开吗？要注意什么？","我们订好奥达的住宿了，标记一下","7 月冰岛要带哪些衣服？","持中国护照的人申根签证什么时候递交？"],
  en:["Can our car handle F208 into the Highlands? What should we watch for?","We booked the Odda stay, mark it as booked","What clothes do we need for Iceland in July?","When should the Chinese-passport holders apply for the Schengen visa?"]};

function load(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}
function keep(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
// S.chats: the conversations on this device, each {id, msgs, ts (last activity)}; S.at: the one on screen
var S=load(KEY)||{};
if(!S.chats){S.chats=S.msgs&&S.msgs.length?[{id:uid(),msgs:S.msgs,ts:Date.now()}]:[];delete S.msgs;}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function active(){var c=S.chats.filter(function(x){return x.id===S.at;})[0];
  if(!c){c=S.chats.slice().sort(function(a,b){return b.ts-a.ts;})[0];if(!c){c={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(c);}S.at=c.id;}return c;}
// keeps the 30 most recent conversations, 60 messages each; an empty one is kept only while it's on screen
function save(){S.chats.forEach(function(c){if(c.msgs.length>60)c.msgs=c.msgs.slice(-60);});
  var kept=S.chats.filter(function(c){return c.msgs.length||c.id===S.at;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,30);
  keep(KEY,{code:S.code,at:S.at,chats:kept});}

var $=function(id){return document.getElementById(id);};
var chat=$("chat"),log=$("chatLog"),form=$("chatForm"),text=$("chatText"),join=$("chatJoin"),sub=$("chatSub"),badge=$("chatBadge"),send=$("chatSend"),fab=$("askBtn"),scrim=$("chatScrim"),quoteBox=$("chatQuote");
if(!quoteBox){quoteBox=document.createElement("div");quoteBox.className="chat-quote";quoteBox.id="chatQuote";quoteBox.hidden=true;form.insertBefore(quoteBox,form.firstChild);}
var cur=null,listing=false,busy=false,checked=false,needCode=false,pending=null,ctrl=null,queue=[],gen=0,stick=true,openSteps={};
if(!/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent))$("chatKbd").textContent="Ctrl K";

var IC={check:'<svg viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',x:'<svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  clock:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',search:'<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/></svg>',
  chev:'<svg viewBox="0 0 20 20"><path d="M8 5l5 5-5 5"/></svg>',edit:'<svg viewBox="0 0 20 20"><path d="M4 16l.8-3.4L13 4.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L7.4 15.2zM11.5 6l2.5 2.5"/></svg>',
  cash:'<svg viewBox="0 0 20 20"><path d="M5 2.5h10v15l-2-1.3-1.7 1.3L10 16.2l-1.3 1.3L7 16.2l-2 1.3z"/><path d="M7.5 7h5M7.5 10h5M7.5 13h3"/></svg>',
  undo:'<svg viewBox="0 0 20 20"><path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9"/></svg>'};

/* ---------- tiny markdown: paragraphs, lists, headings, bold, italics, code, links ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function inline(s){
  var held=[];function hold(h){held.push(h);return "\u0000"+(held.length-1)+"\u0000";}
  s=s.replace(/`([^`]+)`/g,function(_,c){return hold("<code>"+esc(c)+"</code>");});
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,function(_,t,u){return hold('<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(t)+"</a>");});
  s=s.replace(/https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g,function(u){return hold('<a href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(u.replace(/^https?:\/\/(www\.)?/,"").slice(0,48))+"</a>");});
  s=esc(s).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/(^|[\s(])[*_]([^*_\s][^*_]*)[*_](?=[\s).,;:!?]|$)/g,"$1<i>$2</i>");
  return s.replace(/\u0000(\d+)\u0000/g,function(_,i){return held[+i];});
}
function md(src){
  var out=[],para=[],list=null;
  function flush(){if(para.length){out.push("<p>"+para.map(inline).join("<br>")+"</p>");para=[];}if(list){out.push("<"+list.t+">"+list.items.map(function(i){return "<li>"+inline(i)+"</li>";}).join("")+"</"+list.t+">");list=null;}}
  src.split("\n").forEach(function(line){
    var m;
    if(!line.trim()){flush();return;}
    if((m=line.match(/^\s*#{1,6}\s+(.*)/))){flush();out.push("<h4>"+inline(m[1])+"</h4>");return;}
    if((m=line.match(/^\s*[-*•]\s+(.*)/))){if(para.length||(list&&list.t!=="ul"))flush();list=list||{t:"ul",items:[]};list.items.push(m[1]);return;}
    if((m=line.match(/^\s*\d+[.)]\s+(.*)/))){if(para.length||(list&&list.t!=="ol"))flush();list=list||{t:"ol",items:[]};list.items.push(m[1]);return;}
    if(list&&/^\s{2,}/.test(line)){list.items[list.items.length-1]+=" "+line.trim();return;}
    if(list)flush();para.push(line);
  });
  flush();return out.join("");
}
function clock(ts){return ts?new Date(ts).toLocaleTimeString(isEn()?"en-CA":"zh-CN",{hour:"2-digit",minute:"2-digit"}):"";}

/* ---------- open / close (closing never interrupts an answer) ---------- */
function isOpen(){return chat.dataset.open==="true";}
function openChat(focus){if(!isOpen()){chat.dataset.open="true";chat.setAttribute("aria-hidden","false");scrim.classList.add("open");fab.setAttribute("aria-expanded","true");
    if(phone.matches)sheetOn();setBadge();scroll(true);if(!checked)health();}
  // straight away, not after a delay: iOS only raises the keyboard for a focus inside the tap itself
  if(focus!==false)typeHere();}
function closeChat(){if(!isOpen())return;chat.dataset.open="false";chat.setAttribute("aria-hidden","true");scrim.classList.remove("open");fab.setAttribute("aria-expanded","false");text.blur();
  sheetOff();setBadge();}
function typeHere(){if(isOpen()&&!listing)(join.hidden?text:$("joinCode")).focus({preventScroll:true});}

/* ---------- phones: the assistant is a full-screen sheet ----------
   The page underneath is held still (only the conversation scrolls), the sheet follows the part of the screen the
   keyboard leaves free, dragging it down by its top bar (or pulling down on a conversation already at its start)
   puts it away, and the phone's back gesture closes it instead of leaving the site. */
var phone=matchMedia("(max-width:900px)"),layer=chat.parentNode,vv=window.visualViewport,heldY=0,held=false,pushed=false;
function sheetOn(){
  // the history entry first: it keeps the page's scroll position, which back (or closing) brings back
  if(!pushed){pushed=true;window.history.pushState({chat:1},"");}
  if(!held){held=true;heldY=window.scrollY;document.body.style.top=-heldY+"px";document.documentElement.classList.add("chat-held");}
  fit();
}
function sheetOff(){
  if(held){held=false;document.documentElement.classList.remove("chat-held");document.body.style.top="";window.scrollTo({top:heldY,behavior:"instant"});}
  layer.style.removeProperty("--vvh");layer.style.removeProperty("--vvt");chat.classList.remove("kb");
  if(pushed){pushed=false;window.history.back();}
}
window.addEventListener("popstate",function(){if(pushed){pushed=false;closeChat();}});
// closes the chat, then runs fn: on a phone only once the history step back is done, or that step would undo
// whatever fn changes in the address (a day of the plan) and put the page back where it was
function closeThen(fn){if(!pushed){closeChat();fn();return;}var done=false;
  function go(){if(done)return;done=true;window.removeEventListener("popstate",go);fn();}
  window.addEventListener("popstate",go);closeChat();setTimeout(go,500);}
// the keyboard shrinks what's visible without (on iOS) resizing the page: keep the sheet in the visible part
var kbH=0; // the keyboard's height, once seen, so the sheet can move together with it next time
function setSheet(h,top){layer.style.setProperty("--vvh",h+"px");layer.style.setProperty("--vvt",(top||0)+"px");}
function fit(){if(!held||!vv)return;
  var up=vv.height<window.innerHeight-120;if(up)kbH=window.innerHeight-vv.height;
  setSheet(vv.height,vv.offsetTop);chat.classList.toggle("kb",up);follow();}
if(vv){vv.addEventListener("resize",fit);vv.addEventListener("scroll",fit);}
// iOS can report the keyboard's new size only once it has finished moving: start the sheet (its height animates,
// see .drawer) as the keyboard starts, so the two move together instead of the conversation jumping afterwards
text.addEventListener("focus",function(){if(held&&kbH&&!chat.classList.contains("kb")){setSheet(window.innerHeight-kbH);chat.classList.add("kb");follow();}});
text.addEventListener("blur",function(){if(held&&chat.classList.contains("kb")){setSheet(window.innerHeight);chat.classList.remove("kb");follow();}});
// while the height animates, a conversation that was at its newest message stays there
var followTill=0;
function follow(){var idle=!followTill;followTill=Date.now()+450;if(!idle)return;
  (function f(){if(stick)log.scrollTop=log.scrollHeight;if(Date.now()<followTill)requestAnimationFrame(f);else followTill=0;})();}
phone.addEventListener&&phone.addEventListener("change",function(){if(!isOpen())return;if(phone.matches)sheetOn();else sheetOff();});
// tapping send (or stop) keeps the keyboard up
send.addEventListener("mousedown",function(e){e.preventDefault();});

/* Touch: drag the top bar down (or a conversation already at its start) to put the sheet away; drag the
   conversation down with the keyboard up to put the keyboard away, as in Messages, while it scrolls on.
   Every listener is passive, so scrolling never waits for this script: the top bar takes no native scrolling
   (touch-action:none), and a list at its start has no overscroll (.at-top), so moving the sheet by hand
   doesn't fight the browser's own bounce. */
var drag=null,head=chat.querySelector(".drawer-head");
function atTop(box){box.classList.toggle("at-top",box.scrollTop<=0);}
[log,$("chatList")].forEach(function(b){b.addEventListener("scroll",function(){atTop(b);},{passive:true});});
chat.addEventListener("touchstart",function(e){
  drag=null;if(!phone.matches||e.touches.length!==1)return;
  var t=e.target,box=t.closest(".chat-log,.chat-list"),onHead=head.contains(t);
  if(!onHead&&!box)return;
  if(box)atTop(box);
  drag={y:e.touches[0].clientY,x:e.touches[0].clientX,t:Date.now(),dy:0,on:false,head:onHead,top:!!box&&box.scrollTop<=0,kb:document.activeElement===text};
},{passive:true});
chat.addEventListener("touchmove",function(e){
  if(!drag)return;var p=e.touches[0],dy=p.clientY-drag.y,dx=p.clientX-drag.x;
  if(!drag.on){
    if(Math.abs(dy)<8&&Math.abs(dx)<8)return;
    // only a downward, mostly vertical pull; anything else is an ordinary scroll or tap
    if(dy<=0||Math.abs(dx)>Math.abs(dy)){drag=null;return;}
    if(!drag.head&&drag.kb){text.blur();drag=null;return;}
    if(!drag.head&&!drag.top){drag=null;return;}
    drag.on=true;drag.y=p.clientY;drag.t=Date.now();dy=0;chat.classList.add("dragging");scrim.style.transition="none";
  }
  drag.dy=Math.max(0,dy);
  chat.style.transform="translateY("+drag.dy+"px)";scrim.style.opacity=String(Math.max(0,1-drag.dy/(chat.offsetHeight||600)));
},{passive:true});
function dragEnd(){
  if(!drag)return;var d=drag;drag=null;if(!d.on)return;
  chat.classList.remove("dragging");chat.style.transform="";scrim.style.opacity="";scrim.style.transition="";
  var fast=d.dy/Math.max(1,Date.now()-d.t)>.6;
  if(d.dy>Math.min(140,chat.offsetHeight*.22)||(fast&&d.dy>40))closeChat();
}
chat.addEventListener("touchend",dragEnd);chat.addEventListener("touchcancel",dragEnd);
// the 问助手 button says when an answer is still coming, has arrived while closed, or a change waits for approval
function setBadge(fresh){
  var waiting=cardsWaiting();
  if(isOpen()){badge.hidden=true;return;}
  if(busy){badge.hidden=false;badge.className="ask-badge";badge.textContent=Z("回答中…","Answering…");}
  else if(waiting){badge.hidden=false;badge.className="ask-badge new";badge.textContent=Z("等你确认","Needs you");}
  else if(fresh){badge.hidden=false;badge.className="ask-badge new";badge.textContent=Z("有新回复","New reply");}
  else if(fresh===undefined)return;
  else badge.hidden=true;
}
fab.addEventListener("click",function(){if(isOpen())closeChat();else openChat();});
scrim.addEventListener("click",closeChat);
$("chatHide").addEventListener("click",closeChat);
$("chatNew").addEventListener("click",newChat);
// ‹ in a conversation goes to the list of all of them; picking one (or +) comes back
$("chatBack").addEventListener("click",function(){showList(true);});
document.addEventListener("keydown",function(e){
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openChat();}
  else if(e.key==="Escape"&&isOpen()){e.preventDefault();closeChat();}
});

/* ---------- the conversation ----------
   A user message is {role, content}. An answer is {role:"assistant", content (its text), parts, ts}: parts in the order
   they arrived, {t:"steps", items:[{id,label,state,ts}]}, {t:"text", text}, {t:"card", card} and at most one
   {t:"tasks", items:[{text,status}]} (its checklist for a request that takes several steps, updated in place). */
log.addEventListener("scroll",function(){stick=log.scrollHeight-log.scrollTop-log.clientHeight<48;});
function scroll(force){if(force||stick)log.scrollTop=log.scrollHeight;}
function add(el){var e0=log.querySelector(".l-empty");if(e0)e0.remove();log.appendChild(el);return el;}
function quotePick(q){return (isEn()&&q.en)||q.zh||q;}
function quoteBody(q){var p=quotePick(q);
  return (p.meta?"<small>"+esc(p.meta)+"</small>":"")+"<b>"+esc(p.title||"")+"</b>"+(p.sub?"<span>"+esc(p.sub)+"</span>":"");}
function quoteLine(q){var p=quotePick(q),head=[q.ref||p.meta,p.title].filter(Boolean).join(" — "),body=(p.full||p.sub||"").trim();
  return "<quoted_plan_item>\n"+head+(body?"\n"+body:"")+"\n</quoted_plan_item>";}
function paintQuote(){
  var q=active().quote;quoteBox.hidden=!q;
  text.placeholder=q?Z("关于这一项，想问什么或怎么改…","Ask about this, or say what to change…"):Z("问问助手，或发张小票让它记账…","Ask anything, or send a receipt to log it…");
  if(!q){quoteBox.innerHTML="";return;}
  quoteBox.innerHTML='<div class="cq-in"'+(q.color?' style="--k:'+esc(q.color)+'"':"")+'><div class="cq-txt">'+quoteBody(q)+
    '</div><button type="button" class="cq-x" data-unquote="1" aria-label="'+Z("去掉引用","Remove quote")+'" title="'+Z("去掉引用","Remove quote")+'">'+IC.x+"</button></div>";
}
quoteBox.addEventListener("click",function(e){if(e.target.closest("[data-unquote]")){active().quote=null;save();render();if(isOpen())text.focus({preventScroll:true});}});
function userLine(m){var w=document.createElement("div");w.className="l-me appear";
  if(m.quote){var q=document.createElement("div");q.className="l-quote";if(m.quote.color)q.style.setProperty("--k",m.quote.color);
    q.innerHTML=quoteBody(m.quote);w.appendChild(q);}
  if(m.thumbs&&m.thumbs.length){var g=document.createElement("div");g.className="l-pics";
    m.thumbs.forEach(function(t){var i=document.createElement("img");i.src=t;i.alt=Z("附的图片","Attached photo");g.appendChild(i);});w.appendChild(g);}
  if(m.content){var d=document.createElement("div");d.className="l-user";d.textContent=m.content;w.appendChild(d);}
  return add(w);}
function botLine(m,live){var d=document.createElement("div");d.className="l-bot appear";add(d);paintBot(d,m,live);return d;}

/* What the assistant did on the way to its answer: the tool calls (searches, parts of the plan it read) and any
   text it wrote before a tool call. That pre-tool text folds away with the steps once the tool call starts; text
   with no tool call after it is the answer and streams directly. While a tool runs, the fold's head shows its label. */
function procHtml(run,key){
  var items=[],notes=0;run.forEach(function(p){if(p.t==="steps")items=items.concat(p.items);else notes++;});
  var running=items.filter(function(s){return s.state==="running";}),n=items.length,last=running[running.length-1];
  var head=running.length?'<span class="spin"></span><span>'+esc(last.label||Z("正在处理","Working"))+"</span>"
    :IC.search+"<span>"+(n?Z("看了 <b>"+n+" 项</b>","Looked at <b>"+n+" thing"+(n>1?"s":"")+"</b>"):"")+(n&&notes?" · ":"")+(notes?Z("思考过程","Thought process"):"")+"</span>";
  return '<details class="steps'+(running.length?" live":"")+'" data-steps="'+esc(key)+'"'+(openSteps[key]?" open":"")+"><summary>"+head+'<span class="chev">'+IC.chev+"</span></summary>"+
    run.map(function(p){
      if(p.t!=="steps")return '<div class="step-note">'+md(p.text)+"</div>";
      return p.items.map(function(s){var st=s.state||"running";
        return '<div class="step '+st+'">'+(st==="running"?'<span class="spin"></span>':st==="error"?IC.x:IC.check)+"<code>"+esc(s.label||"…")+'</code><span class="t">'+esc(clock(s.ts))+"</span></div>";}).join("");}).join("")+"</details>";
}
// the answer's own text: what's left once the working notes before its last tool call are set aside
function isNote(parts,i){var p=parts[i];if(p.t!=="text")return false;for(var j=i+1;j<parts.length;j++)if(parts[j].t==="steps")return true;return false;}
function answerText(m){var ps=m.parts;if(!ps)return m.content||"";
  return ps.filter(function(p,i){return p.t==="text"&&!isNote(ps,i);}).map(function(p){return p.text.trim();}).filter(Boolean).join("\n\n");}
function tasksHtml(items,live){
  var done=items.filter(function(t){return t.status==="done";}).length;
  return '<div class="tasks"><div class="tasks-head"><span>'+Z("步骤","Steps")+'</span><span class="n">'+done+" / "+items.length+"</span></div><ul>"+
    items.map(function(t){var st=t.status==="in_progress"&&!live?"pending":t.status;
      return '<li class="'+st+'">'+(st==="done"?IC.check:st==="in_progress"?'<span class="spin"></span>':'<i class="dot"></i>')+"<span>"+esc(t.text)+"</span></li>";}).join("")+"</ul></div>";
}
function cardHtml(c){
  var undo=c.kind==="undo",cash=c.kind==="expense",st=c.state;
  var right=st==="waiting"?'<span class="wait"><span class="live-dot busy"></span>'+Z("等你确认","Waiting for you")+"</span>"
    :st==="applied"?'<span class="wait ok">'+IC.check+Z("已确认","Approved")+(c.decided_by?" · "+esc(c.decided_by):"")+" · "+esc(clock(c.decided*1000))+"</span>"
    :st==="declined"?'<span class="wait">'+Z("没采用","Not applied")+"</span>"
    :st==="failed"?'<span class="wait bad">'+Z("没改成","Couldn't apply")+"</span>"
    :st==="sending"?'<span class="wait"><span class="spin"></span>'+Z("正在改…","Applying…")+"</span>"
    :'<span class="wait">'+Z("已失效","Expired")+"</span>";
  var byDay=c.kind==="edit"&&c.days&&c.days.length;
  var rows=(c.changes||[]).filter(function(x){return !byDay||!DAYPART.test(x.path||"");}).map(function(x){
    if(undo)return '<li><span class="where">'+IC.undo+esc(x.before)+"</span></li>";
    if(cash)return '<li class="kv"><span class="where">'+esc(x.where)+"</span><span>"+esc(x.after)+"</span></li>";
    var verb=x.op==="remove"?Z("删掉","Remove"):x.op==="insert"?Z("新加","Add"):x.before?Z("改","Change"):Z("加上","Set");
    return '<li><span class="where"><b>'+esc(verb)+"</b>"+esc(x.where||x.path)+"</span>"+
      (x.before&&x.op!=="insert"?'<span class="ba"><del>'+esc(x.before)+"</del>"+(x.op!=="remove"&&x.after?'<span class="arr">→</span><ins>'+esc(x.after)+"</ins>":"")+"</span>"
        :x.after?'<span class="ba"><ins>'+esc(x.after)+"</ins></span>":"")+"</li>";}).join("");
  var foot=st==="waiting"?'<div class="ask-foot"><span class="grow">'+(cash?Z("确认后记进账本，大家都看得到；记错了可以在账本里删掉。","Once approved it goes in the shared log; delete it there if it's wrong."):"")+'</span>'+
      '<button type="button" class="btn" data-decide="0">'+(cash?Z("不记","Don't add"):Z("先不改","Not now"))+'</button><button type="button" class="btn accent" data-decide="1">'+IC.check+(cash?Z("确认记账","Add it"):Z("确认修改","Approve"))+"</button></div>"
    :st==="failed"?'<p class="ask-err">'+esc(c.error||"")+"</p>":st==="expired"?'<p class="ask-err">'+esc(c.error||Z("这个提议已经失效了，请让助手再提一次。","This proposal has expired; ask the assistant again."))+"</p>":"";
  return '<div class="ask-card'+(st==="waiting"||st==="sending"?"":" settled")+'" data-card="'+esc(c.id)+'"><div class="ask-head"><h4>'+esc(c.title)+'</h4><span class="badge">'+(undo?IC.undo+Z("撤销","Undo"):cash?IC.cash+Z("记账","Expense"):IC.edit+Z("改行程","Plan change"))+"</span>"+right+"</div>"+
    (byDay?daysHtml(c,rows):rows?'<ul class="diff">'+rows+"</ul>":"")+foot+"</div>";
}

/* ---------- a map card (the assistant's show_map) ----------
   {title, mode, stops:[{name, sub?, ll?:[lat,lng], q?, gid?}]}: plan places come with their coordinates, anything
   else is a name Google looks up. Google's keyless embed draws the route; the whole map is a link that opens Google
   Maps (the app, on a phone) ready to navigate, so a finger scrolling the conversation never gets caught in the map.
   While the answer is still streaming the frame waits: each repaint would reload it. */
var MODES={driving:["驾车","Drive","d"],walking:["步行","Walk","w"],transit:["公共交通","Transit","r"],bicycling:["骑行","Bike","b"]};
var MODEIC={driving:'<svg viewBox="0 0 20 20"><path d="M4 13.5V10l1.6-4.2A1.5 1.5 0 0 1 7 4.8h6a1.5 1.5 0 0 1 1.4 1L16 10v3.5"/><path d="M3.5 10h13v3.5h-13zM5.5 13.5v1.7M14.5 13.5v1.7"/></svg>',
  walking:'<svg viewBox="0 0 20 20"><circle cx="10.5" cy="3.8" r="1.6"/><path d="M8 17l1.8-5.2L12 13.5V17M9.8 11.8l.8-4.3-2.8 1.3-1 2.6M10.6 7.5l1.6 2.2 2.3.8"/></svg>',
  transit:'<svg viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="11" rx="2.5"/><path d="M5 9h10M7.5 17l1-3M12.5 17l-1-3"/><circle cx="7.8" cy="11.5" r=".4"/><circle cx="12.2" cy="11.5" r=".4"/></svg>',
  bicycling:'<svg viewBox="0 0 20 20"><circle cx="5" cy="13" r="3"/><circle cx="15" cy="13" r="3"/><path d="M5 13l3-6h5l2 6M8 7l2.5 6H15M7 5h2.5"/></svg>',
  pin:'<svg viewBox="0 0 20 20"><path d="M10 17.5s5.5-5 5.5-9.3A5.5 5.5 0 0 0 4.5 8.2c0 4.3 5.5 9.3 5.5 9.3z"/><circle cx="10" cy="8.2" r="2"/></svg>',
  dir:'<svg viewBox="0 0 20 20"><path d="M10 2.5l7.5 7.5-7.5 7.5L2.5 10z"/><path d="M8 12.5V10.5a1.5 1.5 0 0 1 1.5-1.5H13M11.5 7.2L13.3 9l-1.8 1.8"/></svg>',
  cal:'<svg viewBox="0 0 20 20"><rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/></svg>'};
function mapPt(s){return s.ll?s.ll[0]+","+s.ll[1]:s.q||s.name;}
function mapLink(M){var st=M.stops,pts=st.map(mapPt);
  if(st.length===1)return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(pts[0])+(st[0].gid?"&query_place_id="+encodeURIComponent(st[0].gid):"");
  return "https://www.google.com/maps/dir/?api=1&travelmode="+(MODES[M.mode]?M.mode:"driving")+"&origin="+encodeURIComponent(pts[0])+"&destination="+encodeURIComponent(pts[pts.length-1])+
    (pts.length>2?"&waypoints="+encodeURIComponent(pts.slice(1,-1).join("|")):"");}
function mapEmbed(M){var st=M.stops,pts=st.map(mapPt),tail="&hl="+(isEn()?"en":"zh-CN")+"&output=embed";
  if(st.length===1)return "https://maps.google.com/maps?q="+encodeURIComponent(pts[0])+"&z="+(st[0].ll?12:11)+tail;
  var f=(MODES[M.mode]||MODES.driving)[2];
  return "https://maps.google.com/maps?saddr="+encodeURIComponent(pts[0])+"&daddr="+pts.slice(1).map(encodeURIComponent).join("+to:")+(f!=="d"?"&dirflg="+f:"")+mapFit(st)+tail;}
// the embed frames a route as if the map were square: with every stop's coordinates, centre and zoom it for the card
function mapFit(st){if(!st.every(function(s){return s.ll;}))return "";
  var w=Math.max(240,(log.clientWidth||380)-40),h=180,P=36,my=function(la){return Math.log(Math.tan(Math.PI/4+la*Math.PI/360));},
    la=st.map(function(s){return s.ll[0];}),lo=st.map(function(s){return s.ll[1];}),
    y1=my(Math.min.apply(0,la)),y2=my(Math.max.apply(0,la)),x1=Math.min.apply(0,lo),x2=Math.max.apply(0,lo),
    fx=(w-2*P)/(256*Math.max((x2-x1)/360,1e-6)),fy=(h-2*P)/(256*Math.max((y2-y1)/(2*Math.PI),1e-6)),
    z=Math.max(3,Math.min(15,Math.floor(Math.log(Math.min(fx,fy))/Math.LN2)));
  return "&ll="+(Math.atan(Math.sinh((y1+y2)/2))*180/Math.PI).toFixed(4)+","+((x1+x2)/2).toFixed(4)+"&z="+z;}
/* A stop that is a place in the plan gets a pop-up over the bottom of the map, the way Google shows a place: its
   name, what kind of stop it is, Directions / Open in Google Maps / the day it's on in the plan, and its photos
   (tap one for the full-screen viewer). A one-place card opens with it; on a route, tapping a stop opens its own. */
function placeOf(s){try{return window.tripApp&&window.tripApp.place?window.tripApp.place(s):null;}catch(e){return null;}}
function popHtml(s,i,p,fixed){
  var dir="https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(mapPt(s))+(s.gid?"&destination_place_id="+encodeURIComponent(s.gid):"");
  var meta=[p.kind,p.local].filter(Boolean).join(" · "),n=Math.min(p.photos.length,3);
  return '<div class="mc-pop"'+(fixed?"":" hidden")+' data-mc-pop="'+i+'">'+
    '<div class="mp-head"><div class="mp-t"><h5>'+esc(p.name)+"</h5>"+(meta?"<p>"+MODEIC.pin+esc(meta)+"</p>":"")+"</div>"+
      (fixed?"":'<button type="button" class="mp-x" data-mc-close aria-label="'+esc(Z("关闭","Close"))+'">'+IC.x+"</button>")+"</div>"+
    '<div class="mp-acts"><a class="mp-chip" href="'+esc(dir)+'" target="_blank" rel="noopener">'+MODEIC.dir+esc(Z("路线","Directions"))+"</a>"+
      '<a class="mp-chip" href="'+esc(mapLink({stops:[s]}))+'" target="_blank" rel="noopener">'+MODEIC.pin+esc(Z("在 Google 地图打开","Open in Google Maps"))+"</a>"+
      (p.days.length?'<button type="button" class="mp-chip" data-mc-go="'+esc(p.id)+'" data-date="'+esc(p.days[0].date)+'">'+MODEIC.cal+esc(Z("行程里 · ","In the plan · ")+p.days.map(function(d){return d.label;}).join(", "))+"</button>":"")+"</div>"+
    (n?'<div class="mp-photos n'+n+'">'+p.photos.slice(0,3).map(function(h,k){
      return '<figure class="mp-ph" role="button" tabindex="0" data-mc-photo="'+esc(p.id)+'" data-k="'+k+'" aria-label="'+esc(Z("看大图","View photo"))+'">'+h+(k?"":"<figcaption>"+p.credit+"</figcaption>")+"</figure>";}).join("")+"</div>":"")+
    "</div>";}
function mapHtml(M,live){
  var one=M.stops.length===1,md=MODES[M.mode]||MODES.driving,href=esc(mapLink(M));
  // while the answer streams each repaint would reload the photos, so the pop-ups wait for it to finish
  var P=M.stops.map(function(s){return live?null:placeOf(s);}),solo=one&&P[0];
  var stops=M.stops.map(function(s,i){var p=P[i],name=p?p.name:s.name,sub=p?p.local:s.sub;
    var h='<span class="mc-n">'+(one?MODEIC.pin:String.fromCharCode(65+i))+'</span><span class="mc-nm"><b>'+esc(name)+"</b>"+(sub?"<small>"+esc(sub)+"</small>":"")+"</span>";
    return "<li>"+(p?'<button type="button" class="mc-stop" data-mc-stop="'+i+'" aria-expanded="false">'+h+(p.thumb?'<span class="mc-thumb">'+p.thumb+"</span>":"")+"</button>":h)+"</li>";}).join("");
  return '<div class="map-card'+(solo?" solo":"")+'"><div class="mc-head">'+(one?MODEIC.pin:MODEIC[M.mode]||MODEIC.driving)+"<h4>"+esc(M.title)+"</h4>"+(one?"":'<span class="badge">'+esc(Z(md[0],md[1]))+"</span>")+"</div>"+
    '<a class="mc-frame" href="'+href+'" target="_blank" rel="noopener" aria-label="'+esc(Z("在 Google 地图里打开","Open in Google Maps"))+'">'+
      (live?'<span class="mc-wait">'+MODEIC.pin+"</span>":'<iframe src="'+esc(mapEmbed(M))+'" loading="lazy" tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer-when-downgrade"></iframe><span class="mc-attr">'+esc(Z("地图数据 © Google","Map data © Google"))+"</span>")+"</a>"+
    (solo?popHtml(M.stops[0],0,solo,true):
      P.map(function(p,i){return p?popHtml(M.stops[i],i,p,false):"";}).join("")+
      '<ol class="mc-stops'+(one?" one":"")+'">'+stops+"</ol>"+
      '<div class="mc-foot"><a class="btn accent" href="'+href+'" target="_blank" rel="noopener">'+MODEIC.pin+esc(one?Z("在 Google 地图里打开","Open in Google Maps"):Z("用 Google 地图导航","Directions in Google Maps"))+"</a></div>")+
    "</div>";
}
// on a route, a stop opens its pop-up (and closes the one that was open); tapping it again or × closes it
function togglePop(card,i){
  card.querySelectorAll("[data-mc-pop]").forEach(function(p){p.hidden=p.dataset.mcPop!==String(i)||!p.hidden;});
  card.querySelectorAll("[data-mc-stop]").forEach(function(b){var p=card.querySelector('[data-mc-pop="'+b.dataset.mcStop+'"]');b.setAttribute("aria-expanded",p&&!p.hidden?"true":"false");});}
function mapClick(e){var t;
  if((t=e.target.closest("[data-mc-stop]"))){togglePop(t.closest(".map-card"),t.dataset.mcStop);return true;}
  if((t=e.target.closest("[data-mc-close]"))){togglePop(t.closest(".map-card"),-1);return true;}
  if((t=e.target.closest("[data-mc-photo]"))&&!e.target.closest(".credit")){if(window.tripApp&&window.tripApp.photos)window.tripApp.photos(t.dataset.mcPhoto,+t.dataset.k);return true;}
  if((t=e.target.closest("[data-mc-go]"))){if(!window.tripApp||!window.tripApp.goTo)return true;
    var id=t.dataset.mcGo,date=t.dataset.date,go=function(){window.tripApp.goTo(id,date);};
    if(phone.matches)closeThen(go);else go(); // on a phone the chat covers the plan
    return true;}
  return false;}

/* ---------- a plan change, read as days ----------
   An edit card comes with the days whose schedule it touches, before and after ({date, before, after}, each
   {title, short, stay, segs}, place names already in words). The card says what that means first: how the days
   start, end and how long the driving is, then per day what was added, taken out, moved to another day or
   retimed. "See every change" opens each day as a timeline like the day page, the changes marked in place
   and unchanged stretches folded; edits outside the schedule (titles, bookings…) are listed there too. */
var DAYPART=/^\/?days\/[^/]+\/(segs|stay)(\/|$)/,openMore={};
var KCOL={visit:"#1F4E6B",hike:"#3D7A4F",glacier:"#3F8FB5",water:"#2B7A8C",city:"#7A5C9E",food:"#C9711C",shop:"#C9711C",stay:"#5D6B73",camp:"#6B7F3A",start:"#5D6B73"};
var MIC={drive:'<svg viewBox="0 0 20 20"><path d="M4 13V9.5L5.6 5h8.8L16 9.5V13M4 13h12M4 13v2M16 13v2"/></svg>',
  walk:'<svg viewBox="0 0 20 20"><circle cx="11" cy="3.8" r="1.6"/><path d="M8 18l2-6 3 3v3M10 12l1-5-3 1.5L7 11M11 7l2 3 2.5 1"/></svg>',
  other:'<svg viewBox="0 0 20 20"><path d="M4 10h11M11 6l4 4-4 4"/></svg>',
  plus:'<svg viewBox="0 0 20 20"><path d="M10 5v10M5 10h10"/></svg>',minus:'<svg viewBox="0 0 20 20"><path d="M5 10h10"/></svg>',
  home:'<svg viewBox="0 0 20 20"><path d="M3.5 16V8.5L10 4l6.5 4.5V16"/><path d="M8 16v-4.5h4V16"/></svg>'};
function mdd(d){return (+d.slice(5,7))+"/"+(+d.slice(8,10));}
function wkd(d){var w=new Date(d+"T12:00:00Z").getUTCDay();return isEn()?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][w]:"周"+"日一二三四五六"[w];}
function toMin(s){var m=/^(\d{1,2}):(\d\d)/.exec(s||"");return m?+m[1]*60+ +m[2]:null;}
function segMins(s){if(s.mins)return s.mins;var a=toMin(s.start),b=toMin(s.end);if(a==null||b==null)return 0;return (b-a+1440)%1440;}
function hmT(m){m=Math.round(Math.abs(m));var h=Math.floor(m/60),r=m%60;
  return isEn()?((h?h+" h ":"")+(r?r+" min":"")).trim()||"0 min":((h?h+" 小时":"")+(r?(h?" ":"")+r+" 分":"")).trim()||"0 分";}
function firstT(segs){for(var i=0;i<segs.length;i++)if(segs[i].start)return segs[i].start;return "";}
function lastT(segs){for(var i=segs.length-1;i>=0;i--){var s=segs[i];if(s.end||s.start)return s.end||s.start;}return "";}
function driveMins(segs){return segs.reduce(function(n,s){return n+(s.t==="move"&&s.mode!=="walk"?segMins(s):0);},0);}
function segKey(s){return s.t==="move"?"m|"+(s.mode||"")+"|"+(s.ends||[]).join(">"):"s|"+(s.place||s.name);}
// pairs each seg after the change with the same one before (same place, or same route for a move; the n-th with the n-th)
function dayDiff(D){
  var B=(D.before&&D.before.segs)||[],A=(D.after&&D.after.segs)||[],pool={},rows=[];
  B.forEach(function(s,i){var k=segKey(s);(pool[k]=pool[k]||[]).push(i);});
  var used={};
  A.forEach(function(s){var k=segKey(s),q=pool[k],j=q&&q.length?q.shift():null,o=j==null?null:B[j];if(j!=null)used[j]=1;
    var st=!o?"add":(o.start||"")!==(s.start||"")||(o.end||"")!==(s.end||"")||(s.mins||0)!==(o.mins||0)||(o.name||o.label)!==(s.name||s.label)||o.kind!==s.kind?"chg":"same";
    rows.push({s:s,o:o,st:st,j:j});});
  var gone=[];B.forEach(function(s,i){if(!used[i])gone.push({s:s,o:s,st:"del",j:i});});
  return {rows:rows,gone:gone};
}
function impacts(days){
  var out=[],dB=0,dA=0;
  days.forEach(function(D){if(!D.before||!D.after)return;var B=D.before.segs,A=D.after.segs,md=mdd(D.date);
    dB+=driveMins(B);dA+=driveMins(A);
    var s0=toMin(firstT(B)),s1=toMin(firstT(A)),e0=toMin(lastT(B)),e1=toMin(lastT(A));
    if(e0!=null&&e1!=null&&e0!==e1)out.push({p:0,label:Z(md+" 结束",md+" ends"),from:lastT(B),val:lastT(A),
      note:e1<e0?Z("早 "+hmT(e0-e1),hmT(e0-e1)+" earlier"):Z("晚 "+hmT(e1-e0),hmT(e1-e0)+" later"),good:e1<e0});
    if(s0!=null&&s1!=null&&s0!==s1)out.push({p:1,label:Z(md+" 出发",md+" starts"),from:firstT(B),val:firstT(A),
      note:s1<s0?Z("早 "+hmT(s0-s1),hmT(s0-s1)+" earlier"):Z("晚 "+hmT(s1-s0),hmT(s1-s0)+" later"),good:s1>s0});});
  if(Math.abs(dA-dB)>=5)out.push({p:2,label:Z("开车","Driving"),val:(dA>dB?"+":"−")+hmT(dA-dB),note:dA>dB?Z("多开","more driving"):Z("少开","less driving"),good:dA<dB});
  return out.sort(function(a,b){return a.p-b.p;}).slice(0,3);
}
function tag(t,cls){return '<span class="cc-tag'+(cls?" "+cls:"")+'">'+esc(t)+"</span>";}
function daysHtml(c,rows){
  var days=c.days,diffs=days.map(dayDiff),moved={};
  // a stop taken out of one day and added to another was moved there
  diffs.forEach(function(d,i){d.gone.forEach(function(r){if(r.s.t!=="stop"||!r.s.place)return;
    diffs.forEach(function(e,j){if(j!==i&&e.rows.some(function(x){return x.st==="add"&&x.s.place===r.s.place;}))moved[r.s.place]={from:days[i].date,to:days[j].date};});});});
  var chips=impacts(days).map(function(x){return '<div class="cc-chip"><span>'+esc(x.label)+'</span><b>'+(x.from?'<s>'+esc(x.from)+"</s> ":"")+esc(x.val)+'</b><i class="'+(x.good?"good":"warn")+'">'+esc(x.note)+"</i></div>";}).join("");
  var sum=days.map(function(D,i){return dayHead(D)+'<ul class="cc-sum">'+sumRows(D,diffs[i],moved)+"</ul>";}).join("");
  var tl=days.map(function(D,i){return dayHead(D)+'<ol class="cc-tl">'+tlRows(D,diffs[i],moved)+"</ol>";}).join("");
  var nOther=(rows.match(/<li/g)||[]).length;
  return (chips?'<div class="cc-chips">'+chips+"</div>":"")+'<div class="cc-days">'+sum+"</div>"+
    '<details class="cc-more" data-more="'+esc(c.id)+'"'+(openMore[c.id]?" open":"")+"><summary>"+IC.chev+"<span>"+Z("逐条看改动","See every change")+
      (nOther?'<small>'+Z(" · 另有 "+nOther+" 处标题、说明等改动"," · plus "+nOther+" other edit"+(nOther>1?"s":""))+"</small>":"")+"</span></summary>"+
      '<div class="cc-more-in">'+tl+(rows?'<h5 class="cc-h">'+Z("其他改动","Other edits")+'</h5><ul class="diff">'+rows+"</ul>":"")+"</div></details>";
}
function dayHead(D){var A=D.after||D.before||{},B=D.before||{},short=A.short||A.title||"";
  return '<div class="cc-day"><b>'+esc(mdd(D.date)+" "+wkd(D.date))+"</b><span>"+(B.short&&D.after&&B.short!==A.short?"<s>"+esc(B.short)+"</s> ":"")+esc(short)+"</span>"+
    (!D.before?tag(Z("新的一天","New day"),"add"):!D.after?tag(Z("这天拿掉","Day removed"),"del"):"")+"</div>";}
function stopName(s){return s.name||s.place||"";}
function movedTag(r,moved){var m=r.s.place&&moved[r.s.place];if(!m)return "";
  return r.st==="del"?Z("挪到 "+mdd(m.to)+" →","Moved to "+mdd(m.to)+" →"):Z("← 从 "+mdd(m.from),"← from "+mdd(m.from));}
function timeChg(o,s){return '<span class="cc-t"><s>'+esc(o.start||"")+"</s> "+esc(s.start||"")+"</span>";}
function sumRows(D,d,moved){
  if(!D.after)return '<li class="del"><span class="cc-ic">'+MIC.minus+"</span><span>"+Z("这一天的安排都拿掉了","This day's plan is taken out")+"</span></li>";
  var h="",same=0,addPl={};
  d.rows.forEach(function(r){if(r.st==="add"&&r.s.t==="stop")addPl[r.s.place]=1;});
  d.gone.forEach(function(r){if(r.s.t!=="stop")return;var mv=movedTag(r,moved);
    h+='<li class="del"><span class="cc-ic">'+MIC.minus+'</span><span class="cc-n"><s>'+esc(stopName(r.s))+"</s>"+(r.s.start?' <span class="cc-t">'+esc(r.s.start)+"</span>":"")+"</span>"+tag(mv||Z("拿掉","Removed"),"del")+"</li>";});
  d.rows.forEach(function(r){var s=r.s,o=r.o;
    if(r.st==="same"){if(s.t==="stop")same++;return;}
    if(s.t==="move"){
      // a new drive between stops that were already there: the route changed
      if(r.st==="add"&&!(s.ends||[]).some(function(p){return addPl[p];}))
        h+='<li class="chg"><span class="cc-ic">'+(MIC[s.mode]||MIC.other)+'</span><span class="cc-n">'+esc(s.label)+' <span class="cc-t">'+esc(hmT(segMins(s)))+"</span></span>"+tag(Z("新路线","New route"))+"</li>";
      return;}
    if(r.st==="add"){var mv=movedTag(r,moved);
      h+='<li class="add"><span class="cc-ic">'+MIC.plus+'</span><span class="cc-n"><b>'+esc(stopName(s))+"</b>"+(s.start?' <span class="cc-t">'+esc(s.start+(s.end&&s.end!==s.start?"–"+s.end:""))+"</span>":"")+"</span>"+tag(mv||Z("新加","New"),"add")+"</li>";return;}
    var renamed=stopName(o)!==stopName(s);
    h+='<li class="chg"><span class="cc-ic">'+(s.kind==="start"||s.kind==="stay"?MIC.home:IC.edit)+'</span><span class="cc-n">'+(renamed?"<s>"+esc(stopName(o))+"</s> ":"")+esc(stopName(s))+"</span>"+
      ((o.start||"")!==(s.start||"")?timeChg(o,s):"")+"</li>";});
  if(D.before&&D.after&&D.before.stay!==D.after.stay)h+='<li class="chg"><span class="cc-ic">'+MIC.home+'</span><span class="cc-n">'+Z("住：","Sleep: ")+(D.before.stay?"<s>"+esc(D.before.stay)+"</s> ":"")+esc(D.after.stay||Z("（没有）","(none)"))+"</span></li>";
  if(same)h+='<li class="same"><span class="cc-ic">'+IC.check+"</span><span>"+(h?Z("其余 "+same+" 站不变",same+" other stop"+(same>1?"s":"")+" unchanged"):Z(same+" 站都不变","All "+same+" stops unchanged"))+"</span></li>";
  return h;
}
function tlRow(r,num,moved){var s=r.s,o=r.o||s,st=r.st,mv=movedTag(r,moved);
  var t=st==="del"?"<s>"+esc(s.start||"")+"</s>":esc(s.start||"")+(st==="chg"&&(o.start||"")!==(s.start||"")?"<s>"+esc(o.start||"")+"</s>":"");
  var badge=st==="add"?tag(mv||Z("新加","New"),"add"):st==="del"?tag(mv||Z("拿掉","Removed"),"del"):st==="chg"?tag(Z("改了","Changed")):"";
  if(s.t==="move")return '<li class="mv '+st+'"><span class="t"></span><span class="num">'+(MIC[s.mode]||MIC.other)+'</span><span class="n">'+
    (st==="del"?"<s>":"")+esc((segMins(s)?hmT(segMins(s))+" · ":"")+s.label)+(st==="del"?"</s>":"")+(st==="chg"&&segMins(o)!==segMins(s)?'<small>'+Z("原来 ","was ")+esc(hmT(segMins(o)))+"</small>":"")+"</span>"+badge+"</li>";
  var name=stopName(s),was=st==="chg"&&stopName(o)!==name?stopName(o):"",d=s.start&&s.end&&s.start!==s.end?hmT(segMins(s)):s.mins?hmT(s.mins):"";
  return '<li class="'+st+'"><span class="t">'+t+'</span><span class="num" style="--k:'+(KCOL[s.kind]||KCOL.visit)+'">'+(st==="del"?"":num)+'</span><span class="n">'+
    (st==="del"?"<s>"+esc(name)+"</s>":"<b>"+esc(name)+"</b>")+((was||d)?"<small>"+esc([d,was?Z("原：","was: ")+was:""].filter(Boolean).join(" · "))+"</small>":"")+"</span>"+badge+"</li>";}
function tlRows(D,d,moved){
  // a removed stop goes back right after what came before it in the old schedule; unchanged stretches of three or more fold away
  var list=d.rows.slice(),n=0;
  d.gone.forEach(function(g){if(g.s.t!=="stop")return;var at=0;
    for(var i=0;i<list.length;i++)if(list[i].j!=null&&list[i].j<g.j)at=i+1;
    list.splice(at,0,g);});
  var html=[],run=[];
  function flush(){if(run.length>=3){var st=run.filter(function(x){return x.r.s.t==="stop";}).length,a=firstT(run.map(function(x){return x.r.s;})),b=lastT(run.map(function(x){return x.r.s;}));
      html.push('<li class="fold"><details><summary><span class="t">'+esc(a&&b?a+"–"+b:"")+"</span><span>"+Z(st+" 站不变",st+" stop"+(st===1?"":"s")+" unchanged")+"</span>"+IC.chev+"</summary><ol>"+run.map(function(x){return x.h;}).join("")+"</ol></details></li>");}
    else run.forEach(function(x){html.push(x.h);});run=[];}
  list.forEach(function(r){var num=r.st!=="del"&&r.s.t==="stop"?++n:0,h=tlRow(r,num,moved);
    if(r.st==="same")run.push({r:r,h:h});else{flush();html.push(h);}});
  flush();
  return html.join("")||'<li class="same"><span class="n">'+Z("这一天没有安排","Nothing planned this day")+"</span></li>";
}
function paintBot(d,m,live){
  var parts=m.parts||[{t:"text",text:m.content||""}],h="",run=[],runAt=0;
  function flush(){if(run.length)h+=procHtml(run,(m.ts||0)+"-"+runAt);run=[];}
  parts.forEach(function(p,i){
    if(p.t==="steps"||(isNote(parts,i)&&p.text.trim())){if(!run.length)runAt=i;run.push(p);return;}
    if(p.t==="text"&&!p.text.trim())return; // a blank between notes and steps keeps them in one fold
    if(p.t==="note")return;
    flush();
    if(p.t==="card")h+=cardHtml(p.card);
    else if(p.t==="map")h+=mapHtml(p.map,live);
    else if(p.t==="tasks")h+=tasksHtml(p.items,live);
    else if(p.text)h+='<div class="m-content">'+md(p.text)+"</div>";});
  flush();
  var lastPart=parts[parts.length-1];
  var working=parts.some(function(p){return p.t==="tasks"&&p.items.some(function(t){return t.status==="in_progress";});})||
    (lastPart&&lastPart.t==="steps"&&lastPart.items.some(function(s){return s.state==="running";}));
  if(live&&(!lastPart||lastPart.t!=="text"||!lastPart.text.trim())&&!working)
    h+='<div class="l-status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>'+Z("思考中","Thinking")+"</span></div>";
  if(!live){h+='<div class="l-tools"><span>'+esc(clock(m.ts))+(m.stopped?Z(" · 中途停止"," · stopped early"):"")+"</span></div>";}
  d.innerHTML=h;d._m=m;
}
log.addEventListener("toggle",function(e){var ds=e.target.dataset||{};if(ds.steps)openSteps[ds.steps]=e.target.open;if(ds.more)openMore[ds.more]=e.target.open;},true);
log.addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-decide]"))){decide(t.closest("[data-card]").dataset.card,t.dataset.decide==="1");return;}
  if((t=e.target.closest("[data-suggest]"))){ask(t.textContent);return;}
  mapClick(e);
});
log.addEventListener("keydown",function(e){if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("[data-mc-photo]")){e.preventDefault();mapClick(e);}});
function errLine(msg,retry){var d=document.createElement("div");d.className="l-err appear";d.textContent=msg;
  if(retry){var b=document.createElement("button");b.type="button";b.className="cli-link";b.textContent=Z("重试","Try again");b.onclick=function(){d.remove();retry();};d.appendChild(b);}
  add(d);scroll(true);}
function note(msg){var d=document.createElement("div");d.className="l-note";d.textContent=msg;add(d);scroll(true);return d;}
function empty(){var e=document.createElement("div");e.className="l-empty";e.innerHTML="<div class=\"l-hello\">"+IC.search.replace("<svg",'<svg aria-hidden="true"')+"<p>"+
    Z("关于这趟旅行，随便问；也可以让我改行程，比如标记已订、改时间、加个酒店链接。改之前会先请你确认。","Ask anything about the trip, or ask me to change the plan: mark something booked, move a time, add a hotel link. I'll ask you to approve each change first.")+"</p></div>"+
    SUGGEST[isEn()?"en":"zh"].map(function(q){return '<button type="button" data-suggest="1">'+esc(q)+"</button>";}).join("");log.appendChild(e);}
function render(){
  var C=active();log.innerHTML="";
  if(!C.msgs.length&&!C.quote)empty();
  C.msgs.forEach(function(m){if(m.role==="user")userLine(m);else botLine(m,false);});
  if(cur&&cur.C===C)add(cur.el); // its answer is still coming
  log.querySelectorAll(".appear").forEach(function(x){x.classList.remove("appear");});
  paintQuote();busyUI();scroll(true);
}
function waitingIn(C){var n=0;C.msgs.forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.state==="waiting")n++;});});return n;}
function cardsWaiting(){return S.chats.reduce(function(n,C){return n+waitingIn(C);},0);}

/* ---------- past conversations ---------- */
function chatTitle(C){var u=C.msgs.filter(function(m){return m.role==="user";})[0];if(!u)return Z("新对话","New chat");
  var t=u.content.replace(/\s+/g," ").trim(),qt=u.quote&&quotePick(u.quote).title;
  return qt&&t?qt+" · "+t:qt||t||Z("📷 图片","📷 Photo");}
function when(ts){var d=new Date(ts),now=new Date(),L=isEn()?"en-CA":"zh-CN";
  if(d.toDateString()===now.toDateString())return clock(ts);
  var y=new Date(now);y.setDate(now.getDate()-1);if(d.toDateString()===y.toDateString())return Z("昨天 ","Yesterday ")+clock(ts);
  return d.toLocaleDateString(L,{month:"short",day:"numeric"});}
function showList(on){listing=on;chat.classList.toggle("listing",on);headTitle();
  if(on){if(phone.matches)text.blur();paintList();var f=$("chatList").querySelector("[data-go]");if(f&&matchMedia("(hover:hover)").matches)f.focus({preventScroll:true});}else{scroll(true);typeHere();}}
function headTitle(){$("chatTitle").textContent=listing?Z("历史对话","Past chats"):Z("行程助手","Trip assistant");}
function paintList(){
  var list=S.chats.filter(function(c){return c.msgs.length||(cur&&cur.C===c);}).sort(function(a,b){return b.ts-a.ts;});
  $("chatList").innerHTML='<button type="button" class="btn new-chat" data-new="1"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>'+Z("新对话","New chat")+"</button>"+
    (list.length?list.map(function(c){var w=waitingIn(c),n=c.msgs.filter(function(m){return m.role==="user";}).length;
      var meta=esc(when(c.ts))+" · "+Z(n+" 个问题",n+" question"+(n===1?"":"s"))+(cur&&cur.C===c?' · <span class="hot">'+Z("回答中…","Answering…")+"</span>":"")+(w?' · <span class="hot">'+Z("等你确认","Needs you")+"</span>":"");
      return '<div class="chat-item'+(c.id===S.at?" on":"")+'"><button type="button" class="ci-open" data-go="'+c.id+'"><b>'+esc(chatTitle(c))+"</b><span>"+meta+"</span></button>"+
        '<button type="button" class="icon-btn ci-del" data-del="'+c.id+'" aria-label="'+Z("删除这个对话","Delete this chat")+'" title="'+Z("删除这个对话","Delete this chat")+'"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6h10M8 6V4.5h4V6M6.5 6l.7 9.5h5.6l.7-9.5"/></svg></button></div>';}).join("")
      :'<p class="l-note">'+Z("还没有过往对话。","No past chats yet.")+"</p>");
}
function goChat(id){queue.forEach(function(n){n.el.remove();});queue=[];S.at=id;openSteps={};save();render();showList(false);}
function dropChat(id){
  var C=S.chats.filter(function(c){return c.id===id;})[0];if(!C)return;
  if(!confirm(Z("删除这个对话？只会从这台设备上删掉。","Delete this chat? It's only removed from this device.")))return;
  if(cur&&cur.C===C){gen++;if(ctrl)ctrl.abort();cur=null;ctrl=null;setBusy(false);}
  S.chats.splice(S.chats.indexOf(C),1);
  if(S.at===id){S.at=null;openSteps={};active();render();}
  save();paintList();setBadge(false);
}
$("chatList").addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-del]")))dropChat(t.dataset.del);
  else if((t=e.target.closest("[data-go]")))goChat(t.dataset.go);
  else if(e.target.closest("[data-new]"))newChat();});

function showJoin(){join.hidden=!(needCode&&!S.code);}
var status={state:"",local:false};
function showStatus(){var st=status.state;$("chatDot").className="live-dot"+(st==="ok"?"":st==="down"?" bad":" off");
  sub.textContent=st==="ok"?(status.local?Z("在线（本地）","Online (local)"):Z("在线","Online")):st==="down"?Z("离线","Offline"):Z("连接中…","Connecting…");}
function health(){
  fetch(API+"/api/health").then(function(r){return r.ok?r.json():Promise.reject();})
    .then(function(j){checked=true;needCode=!!j.code;status={state:"ok",local:j.local};showStatus();showJoin();})
    .catch(function(){status={state:"down"};showStatus();});
}
showStatus();render();health();setBadge(false);
// the page switched language: redraw the status, the button and (unless an answer is streaming) the transcript
document.addEventListener("trip:lang",function(){showStatus();headTitle();if(listing)paintList();if(!busy)render();else paintQuote();setBadge(badge.classList.contains("new")&&!cardsWaiting());sendLabel();});

/* ---------- approving a change ---------- */
// a card can be pressed while its answer is still streaming (cur), before that answer is saved
function findCard(id){var hit=null;S.chats.reduce(function(a,C){return a.concat(C.msgs);},[]).concat(cur?[cur.m]:[]).forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.id===id)hit={m:m,p:p};});});return hit;}
function repaint(m){if(cur&&cur.m===m){paintBot(cur.el,m,true);return;}
  var el=[].slice.call(log.querySelectorAll(".l-bot")).filter(function(x){return x._m===m;})[0];if(el)paintBot(el,m,false);}
function decide(id,approve){
  var hit=findCard(id);if(!hit||hit.p.card.state!=="waiting")return;
  var c=hit.p.card;c.state="sending";repaint(hit.m);
  fetch(API+"/api/plan/proposals/"+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({approve:approve,name:""})})
  .then(function(r){return r.json().catch(function(){return {};}).then(function(j){
    if(r.status===410){c.state="expired";c.error=j.detail;return;}
    if(!r.ok||!j.card)throw new Error(j.detail||Z("行程服务器出错了（"+r.status+"）。","The trip server had a problem ("+r.status+")."));
    hit.p.card=j.card;
    if(j.card.state==="applied")document.dispatchEvent(j.card.kind==="expense"?new CustomEvent("trip:money"):new CustomEvent("trip:plan",{detail:{rev:j.rev}}));});})
  .catch(function(e){c.state="waiting";errLine(e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("连不上行程服务器，等有网了再按一次。","Can't reach the trip server. Try again once you're online."));})
  .then(function(){save();repaint(hit.m);setBadge(false);});
}

/* ---------- start over ---------- */
// the conversation on screen is kept (see 历史对话); an answer still coming keeps going into its own conversation
function newChat(){
  queue.forEach(function(n){n.el.remove();});queue=[];pending=null;openSteps={};
  var C=active();if(C.msgs.length||(cur&&cur.C===C)){C={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(C);S.at=C.id;}
  else C.quote=null;
  save();render();showList(false);openChat();
}
// 问问这个 on a stop, walk, drive or optional item: always starts a fresh chat quoting that item, without assuming a question
function startQuote(q){
  if(!q)return;
  queue.forEach(function(n){n.el.remove();});queue=[];pending=null;openSteps={};
  var C=active();if(C.msgs.length||(cur&&cur.C===C)){C={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(C);S.at=C.id;}
  C.quote=q;C.ts=Date.now();
  text.value="";pics=[];paintPics();grow();
  save();render();showList(false);openChat();
}

/* ---------- access code ---------- */
join.addEventListener("submit",function(e){
  e.preventDefault();var code=$("joinCode").value.trim(),err=$("joinErr");if(!code)return;err.textContent=Z("验证中…","Checking…");
  fetch(API+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
    if(r.status===401){err.textContent=Z("访问码不对。","That code didn't work.");return;}
    if(!r.ok)throw new Error();
    S.code=code;save();err.textContent="";join.hidden=true;
    if(pending){var w=pending;pending=null;ask(w.q,w.imgs,w.qte);}else text.focus();
  }).catch(function(){err.textContent=Z("连不上服务器。","Can't reach the server.");});
});

/* ---------- ask ---------- */
// what the assistant reads back: the text of each turn, plus what became of the changes it proposed
function history(C){
  var h=C.msgs.filter(function(m){return m.content||m.quote||(m.thumbs&&m.thumbs.length)||(m.parts&&m.parts.length);}).slice(-HISTORY).map(function(m){
    var c=m.content||"";
    if(m.quote)c=quoteLine(m.quote)+(c?"\n"+c:"");
    if(m.thumbs&&m.thumbs.length)c+=(c?"\n":"")+"[附了 "+m.thumbs.length+" 张图片]";
    (m.parts||[]).forEach(function(p){if(p.t==="map")c+="\n\n[地图卡片："+p.map.stops.map(function(s){return s.name;}).join(" → ")+"]";if(p.t!=="card")return;var k=p.card,st=k.state;
      c+="\n\n["+(st==="applied"?"提议「"+k.title+"」：已确认，已经改好":st==="declined"?"提议「"+k.title+"」：对方没采用":st==="failed"?"提议「"+k.title+"」：确认了但没改成（"+(k.error||"")+"）":st==="expired"?"提议「"+k.title+"」：已失效，没有改":"提议「"+k.title+"」：还在等对方确认")+"]";});
    return {role:m.role,content:c.trim().slice(0,7800)||"…"};});
  while(h.length&&h[0].role!=="user")h.shift();
  return h;
}
// the newest question carries its photos in full (older ones only say they had some)
function withPhotos(h,q,imgs,qte){var last=h[h.length-1];
  if(imgs.length&&last&&last.role==="user"){var body=q||Z("（见图片）","(see the photo)");last.content=(qte?quoteLine(qte)+"\n"+body:body).slice(0,7800);last.images=imgs.map(function(i){return i.full;});}
  return h;}
function setBusy(on){busy=on;fab.classList.toggle("busy",on);busyUI();setBadge(false);if(listing)paintList();}
// the Stop button belongs to the conversation that's answering, not to whichever one is on screen
function busyUI(){chat.classList.toggle("busy",busyHere());sendLabel();}
function busyHere(){return busy&&!!cur&&cur.C===active();}
function sendLabel(){var b=busyHere();send.setAttribute("aria-label",b?Z("停止回答","Stop answering"):Z("发送","Send"));send.title=b?Z("停止","Stop"):Z("发送","Send");}
// a question asked mid-answer waits its turn instead of cutting the answer off
function enqueue(q,imgs,qte){queue.push({q:q,imgs:imgs,qte:qte,el:note(Z("排队中：","Up next: ")+(q||Z("图片","photo")))});}
function next(){if(busy||!queue.length)return;var n=queue.shift();n.el.remove();ask(n.q,n.imgs,n.qte);}
// imgs: photos to send with this question, [{full, thumb}] (data: URLs); only the thumbnails are kept in the history
function ask(q,imgs,qte){
  q=(q||"").trim();imgs=imgs||[];if(!q&&!imgs.length)return;
  openChat(false);
  if(q==="/clear"||q==="/new"){newChat();return;}
  if(listing)showList(false);
  var C=active();
  if(qte===undefined){qte=C.quote||null;if(C.quote){C.quote=null;save();paintQuote();}}
  if(busy){enqueue(q,imgs,qte);return;}
  if(needCode&&!S.code){pending={q:q,imgs:imgs,qte:qte};showJoin();$("joinCode").focus();return;}
  var my=gen;stick=true;
  var um={role:"user",content:q,ts:Date.now()};if(qte)um.quote=qte;if(imgs.length)um.thumbs=imgs.map(function(i){return i.thumb;});
  C.msgs.push(um);C.ts=Date.now();save();
  var uEl=userLine(um);
  var m={role:"assistant",content:"",parts:[],ts:Date.now()},el=botLine(m,true),ctx=null;cur={m:m,el:el,C:C};setBusy(true);scroll(true);
  function here(){return active()===C;}
  try{ctx=window.tripApp&&window.tripApp.context();}catch(e){}
  ctrl=window.AbortController?new AbortController():null;
  var raf=0;function paint(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;if(my===gen){paintBot(el,m,true);if(here())scroll();}});}
  function textPart(){var p=m.parts[m.parts.length-1];if(!p||p.t!=="text"){p={t:"text",text:""};m.parts.push(p);}return p;}
  function step(ev){var p=m.parts[m.parts.length-1];
    var item=null;m.parts.forEach(function(x){if(x.t==="steps")x.items.forEach(function(s){if(s.id===ev.id)item=s;});});
    if(!item){if(!p||p.t!=="steps"){p={t:"steps",items:[]};m.parts.push(p);}item={id:ev.id,label:"",state:"running",ts:Date.now()};p.items.push(item);}
    if(ev.label)item.label=ev.label;if(ev.state)item.state=ev.state;}
  function tasks(items){var p=m.parts.filter(function(x){return x.t==="tasks";})[0];
    if(p)p.items=items;else m.parts.push({t:"tasks",items:items});}
  function progress(ev){var p=m.parts.filter(function(x){return x.t==="note"&&x.id===ev.id;})[0];
    if(!p){p={t:"note",id:ev.id,text:""};m.parts.push(p);}p.text+=ev.text;}
  function finish(stopped,failed){
    m.parts.forEach(function(p){if(p.t==="steps")p.items.forEach(function(s){if(s.state==="running")s.state=stopped?"error":"done";});
      // a complete answer means the list is done: the assistant doesn't spend a round trip ticking the last steps
      if(p.t==="tasks"&&!stopped&&!failed)p.items.forEach(function(t){t.status="done";});});
    m.parts=m.parts.filter(function(p){return p.t!=="note"&&(p.t!=="text"||p.text.trim());});
    if(raf){cancelAnimationFrame(raf);raf=0;} // a repaint still queued from the stream would draw it as unfinished again
    m.ts=Date.now();m.stopped=stopped||undefined;cur=null;C.msgs.push(m);C.ts=Date.now();save();paintBot(el,m,false);}
  fetch(API+"/api/chat",{method:"POST",signal:ctrl&&ctrl.signal,headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({name:"",messages:withPhotos(history(C),q,imgs,qte),context:ctx})})
  .then(function(r){
    if(r.status===401){S.code=null;needCode=true;save();throw new Error(Z("这个服务器需要访问码。","This server needs the access code."));}
    if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.detail||Z("行程服务器出错了（"+r.status+"）。","The trip server had a problem ("+r.status+")."));});
    var reader=r.body.getReader(),dec=new TextDecoder(),buf="";
    function handle(ev){
      if(my!==gen)return;
      if(ev.type==="text"){textPart().text+=ev.text;m.content+=ev.text;}
      else if(ev.type==="step")step(ev);
      else if(ev.type==="tasks"&&ev.items&&ev.items.length)tasks(ev.items);
      else if(ev.type==="note"&&ev.text)progress(ev);
      else if(ev.type==="approval"){m.parts.push({t:"card",card:ev.card});}
      else if(ev.type==="map"&&ev.map&&ev.map.stops){m.parts.push({t:"map",map:ev.map});}
      else if(ev.type==="error"){throw new Error(ev.message);}
      paint();
    }
    function pump(){return reader.read().then(function(res){
      buf+=dec.decode(res.value||new Uint8Array(),{stream:!res.done});
      var parts=buf.split("\n\n");buf=parts.pop();
      parts.forEach(function(p){var line=p.split("\n").filter(function(l){return l.indexOf("data:")===0;}).map(function(l){return l.slice(5).trim();}).join("");if(line)handle(JSON.parse(line));});
      if(!res.done)return pump();
    });}
    return pump();
  })
  .then(function(){if(my!==gen)return;if(!m.content&&!m.parts.some(function(p){return p.t==="card"||p.t==="map";}))throw new Error(Z("没有收到回答。","No answer came back."));finish();})
  .catch(function(e){
    if(my!==gen)return; // its conversation was deleted
    if(e&&e.name==="AbortError"){if(m.parts.length)finish(true);else{cur=null;el.remove();uEl.remove();C.msgs.pop();if(qte&&!C.msgs.length&&!C.quote)C.quote=qte;save();if(here()){paintQuote();note(Z("还没回答就停止了。","Stopped before an answer came back."));}}return;}
    var msg=e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("连不上行程服务器，可能离线了。","Can't reach the trip server. It may be offline.");
    if(m.parts.length){finish(false,true);if(here())errLine(msg);}
    else{cur=null;el.remove();C.msgs.pop();save();
      if(!here())return;
      if(needCode&&!S.code){uEl.remove();pending={q:q,imgs:imgs,qte:qte};showJoin();errLine(msg);}
      else errLine(msg,function(){uEl.remove();ask(q,imgs,qte);});}
  })
  .then(function(){if(my!==gen)return;ctrl=null;setBusy(false);setBadge(true);scroll();next();});
}

form.addEventListener("submit",function(e){e.preventDefault();
  var q=text.value,imgs=pics.filter(function(p){return p.full;});
  if(busy&&!q.trim()&&!imgs.length){if(ctrl&&busyHere())ctrl.abort();return;} // the send button doubles as Stop
  if(pics.some(function(p){return !p.full;}))return; // a photo is still being shrunk
  if(!q.trim()&&!imgs.length)return;text.value="";pics=[];paintPics();grow();ask(q,imgs);typeHere();});
text.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(text.value.trim()||pics.length)form.requestSubmit();}});
function grow(){text.style.height="auto";text.style.height=Math.min(text.scrollHeight,150)+"px";chat.classList.toggle("typed",!!text.value.trim()||pics.length>0);}

/* ---------- photos (a receipt, a sign, a screenshot) ----------
   The 📎 button opens the phone's picker, which offers the camera or the photo library. Each photo is shrunk here
   (1600 px on the long side, JPEG) before it's sent, plus a small thumbnail kept in the conversation. Pasting or
   dropping an image into the panel works too. Up to 4 per question. */
var pics=[],MAXPICS=4,fileIn=$("chatFile");
$("chatAttach").addEventListener("click",function(){fileIn.click();});
fileIn.addEventListener("change",function(){addFiles(fileIn.files);fileIn.value="";});
text.addEventListener("paste",function(e){var f=[].slice.call((e.clipboardData||{}).files||[]).filter(function(x){return /^image\//.test(x.type);});if(f.length){e.preventDefault();addFiles(f);}});
chat.addEventListener("dragover",function(e){if([].slice.call(e.dataTransfer.types||[]).indexOf("Files")>=0){e.preventDefault();chat.classList.add("drop");}});
chat.addEventListener("dragleave",function(e){if(e.target===chat||!chat.contains(e.relatedTarget))chat.classList.remove("drop");});
chat.addEventListener("drop",function(e){e.preventDefault();chat.classList.remove("drop");addFiles(e.dataTransfer.files);});
function addFiles(list){
  [].slice.call(list||[]).filter(function(f){return /^image\//.test(f.type);}).forEach(function(f){
    if(pics.length>=MAXPICS){errLine(Z("一次最多 "+MAXPICS+" 张图片。","Up to "+MAXPICS+" photos at a time."));return;}
    var p={name:f.name};pics.push(p);
    shrink(f).then(function(r){p.full=r.full;p.thumb=r.thumb;},function(){pics.splice(pics.indexOf(p),1);errLine(Z("这张图片读不了，换一张试试。","Couldn't read that image; try another."));})
      .then(function(){paintPics();grow();});});
  paintPics();grow();if(isOpen())text.focus({preventScroll:true});
}
function shrink(file){return new Promise(function(ok,no){
  var url=URL.createObjectURL(file),img=new Image();
  img.onload=function(){URL.revokeObjectURL(url);
    function draw(max,q){var k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement("canvas");
      c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
      var g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);return c.toDataURL("image/jpeg",q);}
    try{ok({full:draw(1600,.85),thumb:draw(240,.7)});}catch(e){no(e);}};
  img.onerror=function(){URL.revokeObjectURL(url);no();};img.src=url;});}
function paintPics(){var box=$("chatPics");box.hidden=!pics.length;
  box.innerHTML=pics.map(function(p,i){return '<span class="pic'+(p.thumb?"":" loading")+'">'+(p.thumb?'<img src="'+p.thumb+'" alt="">':'<span class="spin"></span>')+
    '<button type="button" data-unpic="'+i+'" aria-label="'+Z("去掉这张","Remove this photo")+'">'+IC.x+"</button></span>";}).join("");}
$("chatPics").addEventListener("click",function(e){var b=e.target.closest("[data-unpic]");if(b){pics.splice(+b.dataset.unpic,1);paintPics();grow();}});
text.addEventListener("input",grow);

window.tripChat={ask:function(q){var C=active();if(C.quote&&!C.msgs.length){C.quote=null;save();paintQuote();}ask(q,null,null);},quote:startQuote,open:function(){openChat();}};
// the expense log talks to the same server with the same access code (typed once, in either place)
window.tripAuth={api:API,code:function(){return S.code||"";},
  setCode:function(c){S.code=c||null;save();if(c){join.hidden=true;}else{needCode=true;showJoin();}}};
})();
