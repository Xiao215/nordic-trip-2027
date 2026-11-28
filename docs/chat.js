(function(){
"use strict";
/* Trip assistant drawer (⌘K / Ask button in top bar).
 * Preserves streaming SSE answers, tool-step disclosure, plan-edit & expense approval cards,
 * map cards, quoted items, and receipt uploads — restyled to quiet architectural rules.
 */
var API=((window.TRIP_CONFIG||{}).apiBase||"").replace(/\/$/,"");
var override=new URLSearchParams(location.search).get("api");
var HAS_OVERRIDE=!!(override&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override));
if(HAS_OVERRIDE)API=override;
var LOCALDEV=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);

var KEY="nt-chat-v1",HISTORY=20;
function isEn(){
  if(window.tripApp&&window.tripApp.lang)return window.tripApp.lang()==="en";
  try{var nm=JSON.parse(localStorage.getItem("nt-names"));return nm==="local"||nm==="en";}catch(e){return false;}
}
function Z(zh,en){return isEn()?en:zh;}
var SUGGEST={
  zh:[
    "F208 进高地，我们的车能开吗？要注意什么？",
    "我们订好奥达的住宿了，标记已订",
    "7 月冰岛和挪威峡湾要带哪些衣物？",
    "持中国护照在多伦多什么时候递交申根签？"
  ],
  en:[
    "Can our 4x4 handle F208 into the Highlands? What should we watch for?",
    "We booked the Odda stay — mark it as booked",
    "What layers do we need for Iceland and Norwegian fjords in July?",
    "When should Chinese-passport holders in Toronto submit the Schengen visa?"
  ]
};

function load(k){try{return JSON.parse(localStorage.getItem(k));}catch(e){return null;}}
function keep(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
var S=load(KEY)||{};
if(!S.chats){S.chats=S.msgs&&S.msgs.length?[{id:uid(),msgs:S.msgs,ts:Date.now()}]:[];delete S.msgs;}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function active(){var c=S.chats.filter(function(x){return x.id===S.at;})[0];
  if(!c){c=S.chats.slice().sort(function(a,b){return b.ts-a.ts;})[0];if(!c){c={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(c);}S.at=c.id;}return c;}
function save(){S.chats.forEach(function(c){if(c.msgs.length>60)c.msgs=c.msgs.slice(-60);});
  var kept=S.chats.filter(function(c){return c.msgs.length||c.id===S.at;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,30);
  keep(KEY,{code:S.code,at:S.at,chats:kept});}

var $=function(id){return document.getElementById(id);};
var chat=$("chat"),log=$("chatLog"),form=$("chatForm"),text=$("chatText"),join=$("chatJoin"),sub=$("chatSub"),badge=$("chatBadge"),send=$("chatSend"),fab=$("askBtn"),scrim=$("chatScrim"),quoteBox=$("chatQuote");
var cur=null,listing=false,busy=false,checked=false,needCode=false,pending=null,ctrl=null,queue=[],gen=0,stick=true,openSteps={};
if(!/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent))$("chatKbd").textContent="Ctrl K";

var IC={
  check:'<svg viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
  x:'<svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  search:'<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/></svg>',
  chev:'<svg viewBox="0 0 20 20"><path d="M8 5l5 5-5 5"/></svg>',
  edit:'<svg viewBox="0 0 20 20"><path d="M4 16l.8-3.4L13 4.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L7.4 15.2z"/></svg>',
  cash:'<svg viewBox="0 0 20 20"><path d="M5 2.5h10v15l-2-1.3-1.7 1.3L10 16.2l-1.3 1.3L7 16.2l-2 1.3z"/><path d="M7.5 7h5M7.5 10h5"/></svg>',
  undo:'<svg viewBox="0 0 20 20"><path d="M7 5L3.5 8.5 7 12"/><path d="M4 8.5h8a4.5 4.5 0 0 1 0 9H9"/></svg>'
};

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

/* ---------- Open / Close ---------- */
function isOpen(){return chat.dataset.open==="true";}
function openChat(focus){
  if(!isOpen()){
    chat.dataset.open="true";chat.setAttribute("aria-hidden","false");
    scrim.classList.add("open");fab.setAttribute("aria-expanded","true");
    if(phone.matches)sheetOn();
    setBadge();scroll(true);
    if(!checked&&canProbeHealth())health();
  }
  if(focus!==false)typeHere();
}
function closeChat(){
  if(!isOpen())return;
  chat.dataset.open="false";chat.setAttribute("aria-hidden","true");
  scrim.classList.remove("open");fab.setAttribute("aria-expanded","false");
  text.blur();sheetOff();setBadge();
}
function typeHere(){if(isOpen()&&!listing)(join.hidden?text:$("joinCode")).focus({preventScroll:true});}

var phone=matchMedia("(max-width:820px)"),layer=chat.parentNode,vv=window.visualViewport,heldY=0,held=false,pushed=false;
function sheetOn(){
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
function closeThen(fn){if(!pushed){closeChat();fn();return;}var done=false;
  function go(){if(done)return;done=true;window.removeEventListener("popstate",go);fn();}
  window.addEventListener("popstate",go);closeChat();setTimeout(go,300);}
var kbH=0;
function setSheet(h,top){layer.style.setProperty("--vvh",h+"px");layer.style.setProperty("--vvt",(top||0)+"px");}
function fit(){if(!held||!vv)return;
  var up=vv.height<window.innerHeight-120;if(up)kbH=window.innerHeight-vv.height;
  setSheet(vv.height,vv.offsetTop);chat.classList.toggle("kb",up);}
if(vv){vv.addEventListener("resize",fit);vv.addEventListener("scroll",fit);}
phone.addEventListener&&phone.addEventListener("change",function(){if(!isOpen())return;if(phone.matches)sheetOn();else sheetOff();});
send.addEventListener("mousedown",function(e){e.preventDefault();});

function setBadge(fresh){
  var waiting=cardsWaiting();
  if(isOpen()){badge.hidden=true;return;}
  if(busy){badge.hidden=false;badge.textContent=Z("回答中","Busy");}
  else if(waiting){badge.hidden=false;badge.textContent=Z("待确认","Review");}
  else if(fresh){badge.hidden=false;badge.textContent=Z("新回复","Reply");}
  else if(fresh===undefined)return;
  else badge.hidden=true;
}
fab.addEventListener("click",function(){if(isOpen())closeChat();else openChat();});
scrim.addEventListener("click",closeChat);
$("chatHide").addEventListener("click",closeChat);
$("chatNew").addEventListener("click",newChat);
$("chatBack").addEventListener("click",function(){showList(true);});
document.addEventListener("keydown",function(e){
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(isOpen())closeChat();else openChat();}
  else if(e.key==="Escape"&&isOpen()){e.preventDefault();closeChat();}
});

/* ---------- Conversation Rendering ---------- */
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
  text.placeholder=q?Z("关于这一项，想问什么或怎么改…","Ask about this item, or describe a change…"):Z("提问或发张小票记账…","Ask about the itinerary, or attach a receipt…");
  if(!q){quoteBox.innerHTML="";return;}
  quoteBox.innerHTML='<div class="cq-in" style="margin-bottom:8px"><div class="cq-txt" style="flex:1;min-width:0">'+quoteBody(q)+
    '</div><button type="button" class="icon-btn" style="width:22px;height:22px" data-unquote="1" aria-label="'+Z("移除引用","Remove quote")+'">'+IC.x+"</button></div>";
}
quoteBox.addEventListener("click",function(e){if(e.target.closest("[data-unquote]")){active().quote=null;save();render();if(isOpen())text.focus({preventScroll:true});}});

function userLine(m){
  var w=document.createElement("div");w.className="l-me";
  if(m.quote){var q=document.createElement("div");q.className="l-quote";q.innerHTML=quoteBody(m.quote);w.appendChild(q);}
  if(m.thumbs&&m.thumbs.length){var g=document.createElement("div");g.className="chat-pics";
    m.thumbs.forEach(function(t){var s=document.createElement("span");s.className="pic";var i=document.createElement("img");i.src=t;i.alt=Z("附图","Photo");s.appendChild(i);g.appendChild(s);});w.appendChild(g);}
  if(m.content){var d=document.createElement("div");d.className="l-user";d.textContent=m.content;w.appendChild(d);}
  return add(w);
}
function botLine(m,live){var d=document.createElement("div");d.className="l-bot";add(d);paintBot(d,m,live);return d;}

function procHtml(run,key){
  var items=[],notes=0;run.forEach(function(p){if(p.t==="steps")items=items.concat(p.items);else notes++;});
  var running=items.filter(function(s){return s.state==="running";}),n=items.length,last=running[running.length-1];
  var head=running.length?'<span class="spin"></span><span>'+esc(last.label||Z("正在处理","Working"))+"</span>"
    :IC.search+"<span>"+(n?Z("查阅 "+n+" 项","Checked "+n+" item"+(n>1?"s":"")):"")+(n&&notes?" · ":"")+(notes?Z("推理记录","Notes"):"")+"</span>";
  return '<details class="steps" data-steps="'+esc(key)+'"'+(openSteps[key]?" open":"")+"><summary>"+head+"</summary>"+
    run.map(function(p){
      if(p.t!=="steps")return '<div class="step">'+md(p.text)+"</div>";
      return p.items.map(function(s){var st=s.state||"running";
        return '<div class="step">'+(st==="running"?'<span class="spin"></span>':st==="error"?IC.x:IC.check)+"<code>"+esc(s.label||"…")+'</code><span class="mono" style="margin-left:auto">'+esc(clock(s.ts))+"</span></div>";}).join("");}).join("")+"</details>";
}
function isNote(parts,i){var p=parts[i];if(p.t!=="text")return false;for(var j=i+1;j<parts.length;j++)if(parts[j].t==="steps")return true;return false;}
function tasksHtml(items,live){
  var done=items.filter(function(t){return t.status==="done";}).length;
  return '<div class="tasks"><div class="ask-head"><span class="mono">'+Z("步骤","STEPS")+'</span><span class="mono" style="margin-left:auto">'+done+"/"+items.length+"</span></div><ul class=\"diff\">"+
    items.map(function(t){var st=t.status==="in_progress"&&!live?"pending":t.status;
      return '<li style="display:flex;gap:8px;align-items:center">'+(st==="done"?'<span class="dot emerald"></span>':st==="in_progress"?'<span class="spin"></span>':'<span class="dot"></span>')+"<span>"+esc(t.text)+"</span></li>";}).join("")+"</ul></div>";
}
function cardHtml(c){
  var undo=c.kind==="undo",cash=c.kind==="expense",st=c.state;
  var right=st==="waiting"?'<span class="wait"><span class="dot amber"></span>'+Z("待确认","Pending")+"</span>"
    :st==="applied"?'<span class="wait" style="color:var(--emerald)">'+IC.check+Z("已应用","Applied")+"</span>"
    :st==="declined"?'<span class="wait">'+Z("已跳过","Skipped")+"</span>"
    :st==="failed"?'<span class="wait" style="color:var(--rose)">'+Z("未成功","Failed")+"</span>"
    :st==="sending"?'<span class="wait"><span class="spin"></span>'+Z("提交中","Applying")+"</span>"
    :'<span class="wait">'+Z("已过期","Expired")+"</span>";
  var rows=(c.changes||[]).map(function(x){
    if(undo)return '<li><span>'+esc(x.before)+"</span></li>";
    if(cash)return '<li><span class="mono">'+esc(x.where)+": </span><span>"+esc(x.after)+"</span></li>";
    var verb=x.op==="remove"?Z("移除","Remove"):x.op==="insert"?Z("新增","Add"):x.before?Z("修改","Update"):Z("设置","Set");
    return '<li><span class="mono">'+esc(verb)+" · "+esc(x.where||x.path)+"</span> "+
      (x.before&&x.op!=="insert"?'<div><del>'+esc(x.before)+"</del>"+(x.op!=="remove"&&x.after?" → <ins>"+esc(x.after)+"</ins>":"")+"</div>"
        :x.after?'<div><ins>'+esc(x.after)+"</ins></div>":"")+"</li>";}).join("");
  var foot=st==="waiting"?'<div class="ask-foot">'+
      '<button type="button" class="btn-secondary" data-decide="0">'+(cash?Z("不记","Skip"):Z("先不改","Not now"))+'</button>'+
      '<button type="button" class="btn-primary" data-decide="1">'+(cash?Z("确认记账","Log expense"):Z("确认修改","Approve"))+"</button></div>"
    :st==="failed"||st==="expired"?'<div class="ask-foot" style="justify-content:flex-start"><span class="l-err">'+esc(c.error||Z("提议已过期，请重试。","Proposal expired."))+"</span></div>":"";
  return '<div class="ask-card" data-card="'+esc(c.id)+'"><div class="ask-head"><h4>'+esc(c.title)+'</h4><span class="badge">'+(undo?Z("撤销","UNDO"):cash?Z("记账","EXPENSE"):Z("行程变更","PLAN EDIT"))+"</span>"+right+"</div>"+
    (rows?'<ul class="diff">'+rows+"</ul>":"")+foot+"</div>";
}

var MODES={driving:["驾车","Drive","d"],walking:["步行","Walk","w"],transit:["公交","Transit","r"],bicycling:["骑行","Bike","b"]};
function mapPt(s){return s.ll?s.ll[0]+","+s.ll[1]:s.q||s.name;}
function mapLink(M){var st=M.stops,pts=st.map(mapPt);
  if(st.length===1)return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(pts[0])+(st[0].gid?"&query_place_id="+encodeURIComponent(st[0].gid):"");
  return "https://www.google.com/maps/dir/?api=1&travelmode="+(MODES[M.mode]?M.mode:"driving")+"&origin="+encodeURIComponent(pts[0])+"&destination="+encodeURIComponent(pts[pts.length-1])+
    (pts.length>2?"&waypoints="+encodeURIComponent(pts.slice(1,-1).join("|")):"");}
function mapEmbed(M){var st=M.stops,pts=st.map(mapPt),tail="&hl="+(isEn()?"en":"zh-CN")+"&output=embed";
  if(st.length===1)return "https://maps.google.com/maps?q="+encodeURIComponent(pts[0])+"&z="+(st[0].ll?12:11)+tail;
  var f=(MODES[M.mode]||MODES.driving)[2];
  return "https://maps.google.com/maps?saddr="+encodeURIComponent(pts[0])+"&daddr="+pts.slice(1).map(encodeURIComponent).join("+to:")+(f!=="d"?"&dirflg="+f:"")+tail;}
function mapHtml(M,live){
  var one=M.stops.length===1,mdMode=MODES[M.mode]||MODES.driving,href=esc(mapLink(M));
  var stops=M.stops.map(function(s,i){
    return '<li style="display:flex;gap:8px;font-size:13px"><span class="mono">'+(one?"01":String.fromCharCode(65+i))+'</span><span><b>'+esc(s.name)+"</b>"+(s.sub?" <span class=\"mono\">"+esc(s.sub)+"</span>":"")+"</span></li>";
  }).join("");
  return '<div class="map-card"><div class="mc-head"><h4>'+esc(M.title)+'</h4>'+(one?"":'<span class="badge">'+esc(Z(mdMode[0],mdMode[1]))+"</span>")+"</div>"+
    '<a class="mc-frame" href="'+href+'" target="_blank" rel="noopener">'+
      (live?'<span class="mono" style="display:grid;place-items:center;height:100%">LOADING MAP…</span>':'<iframe src="'+esc(mapEmbed(M))+'" loading="lazy" tabindex="-1" aria-hidden="true" referrerpolicy="no-referrer-when-downgrade"></iframe>')+"</a>"+
    '<ol class="mc-stops">'+stops+'</ol><div class="mc-foot"><a class="text-link" href="'+href+'" target="_blank" rel="noopener">'+esc(Z("在 Google 地图打开 ↗","Open in Google Maps ↗"))+"</a></div></div>";
}

function paintBot(d,m,live){
  var parts=m.parts||[{t:"text",text:m.content||""}],h="",run=[],runAt=0;
  function flush(){if(run.length)h+=procHtml(run,(m.ts||0)+"-"+runAt);run=[];}
  parts.forEach(function(p,i){
    if(p.t==="steps"||(isNote(parts,i)&&p.text.trim())){if(!run.length)runAt=i;run.push(p);return;}
    if(p.t==="text"&&!p.text.trim())return;
    if(p.t==="note")return;
    flush();
    if(p.t==="card")h+=cardHtml(p.card);
    else if(p.t==="map")h+=mapHtml(p.map,live);
    else if(p.t==="tasks")h+=tasksHtml(p.items,live);
    else if(p.text)h+='<div class="m-content">'+md(p.text)+"</div>";
  });
  flush();
  var lastPart=parts[parts.length-1];
  var working=parts.some(function(p){return p.t==="tasks"&&p.items.some(function(t){return t.status==="in_progress";});})||
    (lastPart&&lastPart.t==="steps"&&lastPart.items.some(function(s){return s.state==="running";}));
  if(live&&(!lastPart||lastPart.t!=="text"||!lastPart.text.trim())&&!working)
    h+='<div class="l-status"><span class="spin"></span><span>'+Z("思考中…","Thinking…")+"</span></div>";
  if(!live)h+='<div class="l-tools">'+esc(clock(m.ts))+(m.stopped?Z(" · 已停止"," · stopped"):"")+"</div>";
  d.innerHTML=h;d._m=m;
}

log.addEventListener("toggle",function(e){var ds=e.target.dataset||{};if(ds.steps)openSteps[ds.steps]=e.target.open;},true);
log.addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-decide]"))){decide(t.closest("[data-card]").dataset.card,t.dataset.decide==="1");return;}
  if((t=e.target.closest("[data-suggest]"))){ask(t.textContent);return;}
});

function errLine(msg,retry){
  var d=document.createElement("div");d.className="l-err";d.textContent=msg;
  if(retry){var b=document.createElement("button");b.type="button";b.className="text-link";b.style.marginLeft="8px";b.textContent=Z("重试","Retry");b.onclick=function(){d.remove();retry();};d.appendChild(b);}
  add(d);scroll(true);
}
function note(msg){var d=document.createElement("div");d.className="mono";d.textContent=msg;add(d);scroll(true);return d;}
function empty(){
  var e=document.createElement("div");e.className="l-empty";
  e.innerHTML='<div class="l-hello">'+IC.search+'<p>'+
    Z("可询问路线细节、行前准备，或让助手修改行程与记录开销（所有修改均需确认后生效）。",
      "Ask about routes, logistics, or ask to update the plan or log a receipt. Every edit waits for your approval.")+
    '</p></div><div class="l-suggest-list">'+
    SUGGEST[isEn()?"en":"zh"].map(function(q){return '<button type="button" data-suggest="1">'+esc(q)+"</button>";}).join("")+
    "</div>";
  log.appendChild(e);
}
function render(){
  var C=active();log.innerHTML="";
  if(!C.msgs.length&&!C.quote)empty();
  C.msgs.forEach(function(m){if(m.role==="user")userLine(m);else botLine(m,false);});
  if(cur&&cur.C===C)add(cur.el);
  paintQuote();busyUI();scroll(true);
}
function waitingIn(C){var n=0;C.msgs.forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.state==="waiting")n++;});});return n;}
function cardsWaiting(){return S.chats.reduce(function(n,C){return n+waitingIn(C);},0);}

/* ---------- Past Conversations ---------- */
function chatTitle(C){var u=C.msgs.filter(function(m){return m.role==="user";})[0];if(!u)return Z("新对话","New chat");
  var t=u.content.replace(/\s+/g," ").trim(),qt=u.quote&&quotePick(u.quote).title;
  return qt&&t?qt+" · "+t:qt||t||Z("图片收据","Receipt photo");}
function when(ts){var d=new Date(ts),now=new Date(),L=isEn()?"en-CA":"zh-CN";
  if(d.toDateString()===now.toDateString())return clock(ts);
  return d.toLocaleDateString(L,{month:"short",day:"numeric"});}
function showList(on){listing=on;chat.classList.toggle("listing",on);headTitle();
  if(on){if(phone.matches)text.blur();paintList();}else{scroll(true);typeHere();}}
function headTitle(){$("chatTitle").textContent=listing?Z("历史对话","Conversations"):Z("行程助手","Trip assistant");}
function paintList(){
  var list=S.chats.filter(function(c){return c.msgs.length||(cur&&cur.C===c);}).sort(function(a,b){return b.ts-a.ts;});
  $("chatList").innerHTML='<div style="padding-bottom:10px;border-bottom:1px solid var(--hairline)"><button type="button" class="btn-secondary" data-new="1">+ '+Z("新对话","New chat")+"</button></div>"+
    (list.length?list.map(function(c){var w=waitingIn(c),n=c.msgs.filter(function(m){return m.role==="user";}).length;
      var meta=esc(when(c.ts))+" · "+Z(n+" 条",n+" msg"+(n===1?"":"s"))+(w?" · "+Z("待确认","Pending"):"");
      return '<div class="chat-item"><button type="button" class="ci-open" data-go="'+c.id+'"><b>'+esc(chatTitle(c))+"</b><span>"+meta+"</span></button>"+
        '<button type="button" class="text-link" data-del="'+c.id+'" aria-label="'+Z("删除","Delete")+'">×</button></div>';}).join("")
      :'<p class="mono" style="padding-top:16px">'+Z("暂无历史对话","No past conversations")+"</p>");
}
function goChat(id){queue.forEach(function(n){n.el.remove();});queue=[];S.at=id;openSteps={};save();render();showList(false);}
function dropChat(id){
  var C=S.chats.filter(function(c){return c.id===id;})[0];if(!C)return;
  if(!confirm(Z("确定从此设备删除该对话？","Delete this conversation from this device?")))return;
  if(cur&&cur.C===C){gen++;if(ctrl)ctrl.abort();cur=null;ctrl=null;setBusy(false);}
  S.chats.splice(S.chats.indexOf(C),1);
  if(S.at===id){S.at=null;openSteps={};active();render();}
  save();paintList();setBadge(false);
}
$("chatList").addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-del]")))dropChat(t.dataset.del);
  else if((t=e.target.closest("[data-go]")))goChat(t.dataset.go);
  else if(e.target.closest("[data-new]"))newChat();
});

/* ---------- Status & Health (No unprompted local CORS spam) ---------- */
function canProbeHealth(){
  if(window.__NT_BACKEND_UP===false)return false;
  if(LOCALDEV&&!HAS_OVERRIDE&&!S.code)return false;
  return true;
}
function showJoin(){join.hidden=!(needCode&&!S.code);}
var status={state:canProbeHealth()?"":"local",local:false};
function showStatus(){
  var st=status.state;
  $("chatDot").className="live-dot"+(st==="ok"?"":st==="down"?" bad":" off");
  sub.textContent=st==="ok"?(status.local?Z("在线 · 本地","ONLINE · LOCAL"):Z("在线","ONLINE"))
    :st==="local"?Z("本地预览","LOCAL PREVIEW")
    :st==="down"?Z("离线","OFFLINE")
    :Z("就绪","READY");
}
function health(){
  if(!canProbeHealth()){status={state:"local"};showStatus();return;}
  fetch(API+"/api/health").then(function(r){return r.ok?r.json():Promise.reject();})
    .then(function(j){checked=true;needCode=!!j.code;status={state:"ok",local:j.local};window.__NT_BACKEND_UP=true;showStatus();showJoin();})
    .catch(function(){checked=true;window.__NT_BACKEND_UP=false;status={state:LOCALDEV?"local":"down"};showStatus();});
}
showStatus();render();
if(canProbeHealth())health();
setBadge(false);
document.addEventListener("trip:lang",function(){showStatus();headTitle();if(listing)paintList();if(!busy)render();else paintQuote();setBadge(false);sendLabel();});

/* ---------- Proposals & Messaging ---------- */
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
    if(!r.ok||!j.card)throw new Error(j.detail||Z("服务器返回错误（"+r.status+"）","Server error ("+r.status+")"));
    hit.p.card=j.card;
    if(j.card.state==="applied")document.dispatchEvent(j.card.kind==="expense"?new CustomEvent("trip:money"):new CustomEvent("trip:plan",{detail:{rev:j.rev}}));});})
  .catch(function(e){c.state="waiting";errLine(e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("无法连接行程服务器，请联网后重试。","Could not reach the trip server."));})
  .then(function(){save();repaint(hit.m);setBadge(false);});
}

function newChat(){
  queue.forEach(function(n){n.el.remove();});queue=[];pending=null;openSteps={};
  var C=active();if(C.msgs.length||(cur&&cur.C===C)){C={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(C);S.at=C.id;}
  else C.quote=null;
  save();render();showList(false);openChat();
}
function startQuote(q){
  if(!q)return;
  queue.forEach(function(n){n.el.remove();});queue=[];pending=null;openSteps={};
  var C=active();if(C.msgs.length||(cur&&cur.C===C)){C={id:uid(),msgs:[],ts:Date.now()};S.chats.unshift(C);S.at=C.id;}
  C.quote=q;C.ts=Date.now();
  text.value="";pics=[];paintPics();grow();
  save();render();showList(false);openChat();
}

join.addEventListener("submit",function(e){
  e.preventDefault();var code=$("joinCode").value.trim(),err=$("joinErr");if(!code)return;err.textContent=Z("验证中…","Checking…");
  fetch(API+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
    if(r.status===401){err.textContent=Z("访问码不正确","Incorrect access code");return;}
    if(!r.ok)throw new Error();
    S.code=code;window.__NT_BACKEND_UP=true;status={state:"ok"};showStatus();save();err.textContent="";join.hidden=true;
    if(pending){var w=pending;pending=null;ask(w.q,w.imgs,w.qte);}else text.focus();
  }).catch(function(){err.textContent=Z("连不上行程服务器","Cannot reach server");});
});

function history(C){
  var h=C.msgs.filter(function(m){return m.content||m.quote||(m.thumbs&&m.thumbs.length)||(m.parts&&m.parts.length);}).slice(-HISTORY).map(function(m){
    var c=m.content||"";
    if(m.quote)c=quoteLine(m.quote)+(c?"\n"+c:"");
    if(m.thumbs&&m.thumbs.length)c+=(c?"\n":"")+"[Attached "+m.thumbs.length+" image(s)]";
    (m.parts||[]).forEach(function(p){if(p.t==="map")c+="\n\n[Map: "+p.map.stops.map(function(s){return s.name;}).join(" → ")+"]";if(p.t!=="card")return;var k=p.card,st=k.state;
      c+="\n\n[Proposal "+k.title+": "+st+"]";});
    return {role:m.role,content:c.trim().slice(0,7800)||"…"};});
  while(h.length&&h[0].role!=="user")h.shift();
  return h;
}
function withPhotos(h,q,imgs,qte){var last=h[h.length-1];
  if(imgs.length&&last&&last.role==="user"){var body=q||Z("（见图片）","(see image)");last.content=(qte?quoteLine(qte)+"\n"+body:body).slice(0,7800);last.images=imgs.map(function(i){return i.full;});}
  return h;}
function setBusy(on){busy=on;busyUI();setBadge(false);if(listing)paintList();}
function busyUI(){chat.classList.toggle("busy",busyHere());sendLabel();}
function busyHere(){return busy&&!!cur&&cur.C===active();}
function sendLabel(){var b=busyHere();send.setAttribute("aria-label",b?Z("停止","Stop"):Z("发送","Send"));send.title=b?Z("停止","Stop"):Z("发送","Send");}
function enqueue(q,imgs,qte){queue.push({q:q,imgs:imgs,qte:qte,el:note(Z("排队中：","Queued: ")+(q||Z("图片","photo")))});}
function next(){if(busy||!queue.length)return;var n=queue.shift();n.el.remove();ask(n.q,n.imgs,n.qte);}

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
  function step(ev){var p=m.parts[m.parts.length-1],item=null;
    m.parts.forEach(function(x){if(x.t==="steps")x.items.forEach(function(s){if(s.id===ev.id)item=s;});});
    if(!item){if(!p||p.t!=="steps"){p={t:"steps",items:[]};m.parts.push(p);}item={id:ev.id,label:"",state:"running",ts:Date.now()};p.items.push(item);}
    if(ev.label)item.label=ev.label;if(ev.state)item.state=ev.state;}
  function tasks(items){var p=m.parts.filter(function(x){return x.t==="tasks";})[0];if(p)p.items=items;else m.parts.push({t:"tasks",items:items});}
  function progress(ev){var p=m.parts.filter(function(x){return x.t==="note"&&x.id===ev.id;})[0];if(!p){p={t:"note",id:ev.id,text:""};m.parts.push(p);}p.text+=ev.text;}
  function finish(stopped,failed){
    m.parts.forEach(function(p){if(p.t==="steps")p.items.forEach(function(s){if(s.state==="running")s.state=stopped?"error":"done";});
      if(p.t==="tasks"&&!stopped&&!failed)p.items.forEach(function(t){t.status="done";});});
    m.parts=m.parts.filter(function(p){return p.t!=="note"&&(p.t!=="text"||p.text.trim());});
    if(raf){cancelAnimationFrame(raf);raf=0;}
    m.ts=Date.now();m.stopped=stopped||undefined;cur=null;C.msgs.push(m);C.ts=Date.now();save();paintBot(el,m,false);
  }
  fetch(API+"/api/chat",{method:"POST",signal:ctrl&&ctrl.signal,headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({name:"",messages:withPhotos(history(C),q,imgs,qte),context:ctx})})
  .then(function(r){
    if(r.status===401){S.code=null;needCode=true;save();throw new Error(Z("请输入访问码后再提问。","Enter the access code to ask the assistant."));}
    if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.detail||Z("服务器错误（"+r.status+"）","Server error ("+r.status+")"));});
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
  .then(function(){if(my!==gen)return;if(!m.content&&!m.parts.some(function(p){return p.t==="card"||p.t==="map";}))throw new Error(Z("未收到回复","No response received."));finish();})
  .catch(function(e){
    if(my!==gen)return;
    if(e&&e.name==="AbortError"){if(m.parts.length)finish(true);else{cur=null;el.remove();uEl.remove();C.msgs.pop();save();}return;}
    var msg=e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("未连接行程后端（当前为本地只读预览）。","Trip backend is unreachable (running in local read-only mode).");
    if(m.parts.length){finish(false,true);if(here())errLine(msg);}
    else{cur=null;el.remove();C.msgs.pop();save();
      if(!here())return;
      if(needCode&&!S.code){uEl.remove();pending={q:q,imgs:imgs,qte:qte};showJoin();errLine(msg);}
      else errLine(msg,function(){uEl.remove();ask(q,imgs,qte);});}
  })
  .then(function(){if(my!==gen)return;ctrl=null;setBusy(false);setBadge(true);scroll();next();});
}

form.addEventListener("submit",function(e){
  e.preventDefault();
  var q=text.value,imgs=pics.filter(function(p){return p.full;});
  if(busy&&!q.trim()&&!imgs.length){if(ctrl&&busyHere())ctrl.abort();return;}
  if(pics.some(function(p){return !p.full;}))return;
  if(!q.trim()&&!imgs.length)return;
  text.value="";pics=[];paintPics();grow();ask(q,imgs);typeHere();
});
text.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(text.value.trim()||pics.length)form.requestSubmit();}});
function grow(){text.style.height="auto";text.style.height=Math.min(text.scrollHeight,140)+"px";chat.classList.toggle("typed",!!text.value.trim()||pics.length>0);}

/* ---------- Receipt / Image Attachments ---------- */
var pics=[],MAXPICS=4,fileIn=$("chatFile");
$("chatAttach").addEventListener("click",function(){fileIn.click();});
fileIn.addEventListener("change",function(){addFiles(fileIn.files);fileIn.value="";});
text.addEventListener("paste",function(e){var f=[].slice.call((e.clipboardData||{}).files||[]).filter(function(x){return /^image\//.test(x.type);});if(f.length){e.preventDefault();addFiles(f);}});
function addFiles(list){
  [].slice.call(list||[]).filter(function(f){return /^image\//.test(f.type);}).forEach(function(f){
    if(pics.length>=MAXPICS){errLine(Z("最多附 "+MAXPICS+" 张图片","Maximum "+MAXPICS+" photos"));return;}
    var p={name:f.name};pics.push(p);
    shrink(f).then(function(r){p.full=r.full;p.thumb=r.thumb;},function(){pics.splice(pics.indexOf(p),1);})
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
  box.innerHTML=pics.map(function(p,i){return '<span class="pic">'+(p.thumb?'<img src="'+p.thumb+'" alt="">':'<span class="spin"></span>')+
    '<button type="button" data-unpic="'+i+'" aria-label="'+Z("移除","Remove")+'">'+IC.x+"</button></span>";}).join("");}
$("chatPics").addEventListener("click",function(e){var b=e.target.closest("[data-unpic]");if(b){pics.splice(+b.dataset.unpic,1);paintPics();grow();}});
text.addEventListener("input",grow);

window.tripChat={ask:function(q){var C=active();if(C.quote&&!C.msgs.length){C.quote=null;save();paintQuote();}ask(q,null,null);},quote:startQuote,open:function(){openChat();}};
window.tripAuth={api:API,code:function(){return S.code||"";},
  setCode:function(c){S.code=c||null;save();if(c){window.__NT_BACKEND_UP=true;join.hidden=true;}else{needCode=true;showJoin();}}};
})();
