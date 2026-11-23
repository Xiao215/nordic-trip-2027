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
var S=load(KEY)||{};S.msgs=S.msgs||[];
function save(){keep(KEY,{code:S.code,msgs:S.msgs.slice(-60)});}

var $=function(id){return document.getElementById(id);};
var chat=$("chat"),log=$("chatLog"),form=$("chatForm"),text=$("chatText"),join=$("chatJoin"),sub=$("chatSub"),badge=$("chatBadge"),send=$("chatSend"),fab=$("askBtn"),scrim=$("chatScrim");
var cur=null,busy=false,checked=false,needCode=false,pending=null,ctrl=null,queue=[],gen=0,stick=true,openSteps={};
if(!/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent))$("chatKbd").textContent="Ctrl K";

var IC={check:'<svg viewBox="0 0 20 20"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',x:'<svg viewBox="0 0 20 20"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  clock:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5"/><path d="M10 6.5V10l2.5 1.5"/></svg>',search:'<svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/></svg>',
  chev:'<svg viewBox="0 0 20 20"><path d="M8 5l5 5-5 5"/></svg>',edit:'<svg viewBox="0 0 20 20"><path d="M4 16l.8-3.4L13 4.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L7.4 15.2zM11.5 6l2.5 2.5"/></svg>',
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
    setBadge();scroll(true);if(!checked)health();}
  if(focus!==false&&matchMedia("(hover:hover)").matches)setTimeout(function(){text.focus({preventScroll:true});},60);}
function closeChat(){if(!isOpen())return;chat.dataset.open="false";chat.setAttribute("aria-hidden","true");scrim.classList.remove("open");fab.setAttribute("aria-expanded","false");text.blur();setBadge();}
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
document.addEventListener("keydown",function(e){
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openChat();}
  else if(e.key==="Escape"&&isOpen()){e.preventDefault();closeChat();}
});

/* ---------- the conversation ----------
   A user message is {role, content}. An answer is {role:"assistant", content (its text), parts, ts}: parts in the order
   they arrived, {t:"steps", items:[{id,label,state,ts}]}, {t:"text", text}, {t:"card", card}. */
log.addEventListener("scroll",function(){stick=log.scrollHeight-log.scrollTop-log.clientHeight<48;});
function scroll(force){if(force||stick)log.scrollTop=log.scrollHeight;}
function add(el){var e0=log.querySelector(".l-empty");if(e0)e0.remove();log.appendChild(el);return el;}
function userLine(m){var d=document.createElement("div");d.className="l-user appear";d.textContent=m.content;return add(d);}
function botLine(m,live){var d=document.createElement("div");d.className="l-bot appear";add(d);paintBot(d,m,live);return d;}

function stepsHtml(items,key,live){
  var running=items.filter(function(s){return s.state==="running";}),n=items.length,last=running[running.length-1]||items[n-1];
  var head=running.length?'<span class="spin"></span><span>'+esc(last.label||Z("正在处理","Working"))+"</span>"
    :IC.search+"<span>"+Z("看了 <b>"+n+" 项</b>","Looked at <b>"+n+" thing"+(n>1?"s":"")+"</b>")+"</span>";
  return '<details class="steps'+(running.length?" live":"")+'" data-steps="'+esc(key)+'"'+(openSteps[key]?" open":"")+"><summary>"+head+'<span class="chev">'+IC.chev+"</span></summary>"+
    items.map(function(s){var st=s.state||"running";
      return '<div class="step '+st+'">'+(st==="running"?'<span class="spin"></span>':st==="error"?IC.x:IC.check)+"<code>"+esc(s.label||"…")+'</code><span class="t">'+esc(clock(s.ts))+"</span></div>";}).join("")+"</details>";
}
function cardHtml(c){
  var undo=c.kind==="undo",st=c.state;
  var right=st==="waiting"?'<span class="wait"><span class="live-dot busy"></span>'+Z("等你确认","Waiting for you")+"</span>"
    :st==="applied"?'<span class="wait ok">'+IC.check+Z("已确认","Approved")+(c.decided_by?" · "+esc(c.decided_by):"")+" · "+esc(clock(c.decided*1000))+"</span>"
    :st==="declined"?'<span class="wait">'+Z("没采用","Not applied")+"</span>"
    :st==="failed"?'<span class="wait bad">'+Z("没改成","Couldn't apply")+"</span>"
    :st==="sending"?'<span class="wait"><span class="spin"></span>'+Z("正在改…","Applying…")+"</span>"
    :'<span class="wait">'+Z("已失效","Expired")+"</span>";
  var rows=(c.changes||[]).map(function(x){
    if(undo)return '<li><span class="where">'+IC.undo+esc(x.before)+"</span></li>";
    var verb=x.op==="remove"?Z("删掉","Remove"):x.op==="insert"?Z("新加","Add"):x.before?Z("改","Change"):Z("加上","Set");
    return '<li><span class="where"><b>'+esc(verb)+"</b>"+esc(x.where||x.path)+"</span>"+
      (x.before&&x.op!=="insert"?'<span class="ba"><del>'+esc(x.before)+"</del>"+(x.op!=="remove"&&x.after?'<span class="arr">→</span><ins>'+esc(x.after)+"</ins>":"")+"</span>"
        :x.after?'<span class="ba"><ins>'+esc(x.after)+"</ins></span>":"")+"</li>";}).join("");
  var foot=st==="waiting"?'<div class="ask-foot"><span class="grow">'+Z("确认后大家的网页都会更新；之后说“撤销”就能改回去。","Once approved, everyone's page updates. Say “undo” to put it back.")+'</span>'+
      '<button type="button" class="btn" data-decide="0">'+Z("先不改","Not now")+'</button><button type="button" class="btn accent" data-decide="1">'+IC.check+Z("确认修改","Approve")+"</button></div>"
    :st==="failed"?'<p class="ask-err">'+esc(c.error||"")+"</p>":st==="expired"?'<p class="ask-err">'+esc(c.error||Z("这个提议已经失效了，请让助手再提一次。","This proposal has expired; ask the assistant again."))+"</p>":"";
  return '<div class="ask-card'+(st==="waiting"||st==="sending"?"":" settled")+'" data-card="'+esc(c.id)+'"><div class="ask-head"><h4>'+esc(c.title)+'</h4><span class="badge">'+(undo?IC.undo+Z("撤销","Undo"):IC.edit+Z("改行程","Plan change"))+"</span>"+right+"</div>"+
    (rows?'<ul class="diff">'+rows+"</ul>":"")+foot+"</div>";
}
function paintBot(d,m,live){
  var parts=m.parts||[{t:"text",text:m.content||""}],h="";
  parts.forEach(function(p,i){
    if(p.t==="steps")h+=stepsHtml(p.items,(m.ts||0)+"-"+i,live);
    else if(p.t==="card")h+=cardHtml(p.card);
    else if(p.text)h+='<div class="m-content">'+md(p.text)+"</div>";});
  var lastPart=parts[parts.length-1];
  if(live&&(!lastPart||lastPart.t!=="text"||!lastPart.text)&&!(lastPart&&lastPart.t==="steps"&&lastPart.items.some(function(s){return s.state==="running";})))
    h+='<div class="l-status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>'+Z("思考中","Thinking")+"</span></div>";
  if(!live){h+='<div class="l-tools"><span>'+esc(clock(m.ts))+(m.stopped?Z(" · 中途停止"," · stopped early"):"")+'</span><button type="button" data-copy="1">'+Z("复制","Copy")+"</button></div>";}
  d.innerHTML=h;d._m=m;
}
log.addEventListener("toggle",function(e){var k=e.target.dataset&&e.target.dataset.steps;if(k)openSteps[k]=e.target.open;},true);
log.addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-copy]"))){var m=t.closest(".l-bot")._m;
    (navigator.clipboard?navigator.clipboard.writeText(m.content):Promise.reject()).then(function(){t.textContent=Z("已复制","Copied");setTimeout(function(){t.textContent=Z("复制","Copy");},1500);}).catch(function(){});return;}
  if((t=e.target.closest("[data-decide]"))){decide(t.closest("[data-card]").dataset.card,t.dataset.decide==="1");return;}
  if((t=e.target.closest("[data-suggest]"))){ask(t.textContent);}
});
function errLine(msg,retry){var d=document.createElement("div");d.className="l-err appear";d.textContent=msg;
  if(retry){var b=document.createElement("button");b.type="button";b.className="cli-link";b.textContent=Z("重试","Try again");b.onclick=function(){d.remove();retry();};d.appendChild(b);}
  add(d);scroll(true);}
function note(msg){var d=document.createElement("div");d.className="l-note";d.textContent=msg;add(d);scroll(true);return d;}
function empty(){var e=document.createElement("div");e.className="l-empty";e.innerHTML="<div class=\"l-hello\">"+IC.search.replace("<svg",'<svg aria-hidden="true"')+"<p>"+
    Z("关于这趟旅行，随便问；也可以让我改行程，比如标记已订、改时间、加个酒店链接。改之前会先请你确认。","Ask anything about the trip, or ask me to change the plan: mark something booked, move a time, add a hotel link. I'll ask you to approve each change first.")+"</p></div>"+
    SUGGEST[isEn()?"en":"zh"].map(function(q){return '<button type="button" data-suggest="1">'+esc(q)+"</button>";}).join("");log.appendChild(e);}
function render(){
  log.innerHTML="";
  if(!S.msgs.length)empty();
  S.msgs.forEach(function(m){if(m.role==="user")userLine(m);else botLine(m,false);});
  log.querySelectorAll(".appear").forEach(function(x){x.classList.remove("appear");});
  scroll(true);
}
function cardsWaiting(){var n=0;S.msgs.forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.state==="waiting")n++;});});return n;}

function showJoin(){join.hidden=!(needCode&&!S.code);}
var status={state:"",local:false};
function showStatus(){var st=status.state;$("chatDot").className="live-dot"+(st==="ok"?"":st==="down"?" bad":" off");
  sub.textContent=st==="ok"?(status.local?Z("在线（本地）","Online (local)"):Z("在线","Online")):st==="down"?Z("离线","Offline"):Z("连接中…","Connecting…");}
function health(){
  fetch(API+"/api/health").then(function(r){return r.ok?r.json():Promise.reject();})
    .then(function(j){checked=true;needCode=!!j.code;status={state:"ok",local:j.local};showStatus();showJoin();})
    .catch(function(){status={state:"down"};showStatus();});
}
function myName(){try{return String(JSON.parse(localStorage.getItem("nt-me"))||"").slice(0,40);}catch(e){return "";}}
var me=$("chatMe");me.value=myName();
me.addEventListener("change",function(){keep("nt-me",me.value.trim());});
showStatus();render();health();setBadge(false);
// the page switched language: redraw the status, the button and (unless an answer is streaming) the transcript
document.addEventListener("trip:lang",function(){showStatus();if(!busy)render();setBadge(badge.classList.contains("new")&&!cardsWaiting());sendLabel();});

/* ---------- approving a change ---------- */
// a card can be pressed while its answer is still streaming (cur), before that answer is saved
function findCard(id){var hit=null;S.msgs.concat(cur?[cur.m]:[]).forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.id===id)hit={m:m,p:p};});});return hit;}
function repaint(m){if(cur&&cur.m===m){paintBot(cur.el,m,true);return;}
  var el=[].slice.call(log.querySelectorAll(".l-bot")).filter(function(x){return x._m===m;})[0];if(el)paintBot(el,m,false);}
function decide(id,approve){
  var hit=findCard(id);if(!hit||hit.p.card.state!=="waiting")return;
  var c=hit.p.card;c.state="sending";repaint(hit.m);
  fetch(API+"/api/plan/proposals/"+encodeURIComponent(id),{method:"POST",headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({approve:approve,name:me.value.trim()||myName()})})
  .then(function(r){return r.json().catch(function(){return {};}).then(function(j){
    if(r.status===410){c.state="expired";c.error=j.detail;return;}
    if(!r.ok||!j.card)throw new Error(j.detail||Z("行程服务器出错了（"+r.status+"）。","The trip server had a problem ("+r.status+")."));
    hit.p.card=j.card;
    if(j.card.state==="applied")document.dispatchEvent(new CustomEvent("trip:plan",{detail:{rev:j.rev}}));});})
  .catch(function(e){c.state="waiting";errLine(e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("连不上行程服务器，等有网了再按一次。","Can't reach the trip server. Try again once you're online."));})
  .then(function(){save();repaint(hit.m);setBadge(false);});
}

/* ---------- start over ---------- */
function newChat(){
  gen++;if(ctrl)ctrl.abort();
  queue=[];pending=null;cur=null;S.msgs=[];openSteps={};save();setBusy(false);ctrl=null;
  render();openChat();
}

/* ---------- access code ---------- */
join.addEventListener("submit",function(e){
  e.preventDefault();var code=$("joinCode").value.trim(),err=$("joinErr");if(!code)return;err.textContent=Z("验证中…","Checking…");
  fetch(API+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
    if(r.status===401){err.textContent=Z("访问码不对。","That code didn't work.");return;}
    if(!r.ok)throw new Error();
    S.code=code;save();err.textContent="";join.hidden=true;
    if(pending){var q=pending;pending=null;ask(q);}else text.focus();
  }).catch(function(){err.textContent=Z("连不上服务器。","Can't reach the server.");});
});

/* ---------- ask ---------- */
// what the assistant reads back: the text of each turn, plus what became of the changes it proposed
function history(){
  var h=S.msgs.filter(function(m){return m.content||(m.parts&&m.parts.length);}).slice(-HISTORY).map(function(m){
    var c=m.content||"";
    (m.parts||[]).forEach(function(p){if(p.t!=="card")return;var k=p.card,st=k.state;
      c+="\n\n["+(st==="applied"?"提议「"+k.title+"」：已确认，已经改好":st==="declined"?"提议「"+k.title+"」：对方没采用":st==="failed"?"提议「"+k.title+"」：确认了但没改成（"+(k.error||"")+"）":st==="expired"?"提议「"+k.title+"」：已失效，没有改":"提议「"+k.title+"」：还在等对方确认")+"]";});
    return {role:m.role,content:c.trim()||"…"};});
  while(h.length&&h[0].role!=="user")h.shift();
  return h;
}
function setBusy(on){busy=on;chat.classList.toggle("busy",on);fab.classList.toggle("busy",on);sendLabel();setBadge(false);}
function sendLabel(){send.setAttribute("aria-label",busy?Z("停止回答","Stop answering"):Z("发送","Send"));send.title=busy?Z("停止","Stop"):Z("发送","Send");}
// a question asked mid-answer waits its turn instead of cutting the answer off
function enqueue(q){queue.push({q:q,el:note(Z("排队中：","Up next: ")+q)});}
function next(){if(busy||!queue.length)return;var n=queue.shift();n.el.remove();ask(n.q);}
function ask(q){
  q=q.trim();if(!q)return;
  openChat(false);
  if(q==="/clear"||q==="/new"){newChat();return;}
  if(busy){enqueue(q);return;}
  if(needCode&&!S.code){pending=q;showJoin();$("joinCode").focus();return;}
  var my=gen;setBusy(true);stick=true;
  var um={role:"user",content:q,ts:Date.now()};S.msgs.push(um);save();
  var uEl=userLine(um);
  var m={role:"assistant",content:"",parts:[],ts:Date.now()},el=botLine(m,true),ctx=null;cur={m:m,el:el};scroll(true);
  try{ctx=window.tripApp&&window.tripApp.context();}catch(e){}
  ctrl=window.AbortController?new AbortController():null;
  var raf=0;function paint(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;if(my===gen){paintBot(el,m,true);scroll();}});}
  function textPart(){var p=m.parts[m.parts.length-1];if(!p||p.t!=="text"){p={t:"text",text:""};m.parts.push(p);}return p;}
  function step(ev){var p=m.parts[m.parts.length-1];
    var item=null;m.parts.forEach(function(x){if(x.t==="steps")x.items.forEach(function(s){if(s.id===ev.id)item=s;});});
    if(!item){if(!p||p.t!=="steps"){p={t:"steps",items:[]};m.parts.push(p);}item={id:ev.id,label:"",state:"running",ts:Date.now()};p.items.push(item);}
    if(ev.label)item.label=ev.label;if(ev.state)item.state=ev.state;}
  function finish(stopped){
    m.parts.forEach(function(p){if(p.t==="steps")p.items.forEach(function(s){if(s.state==="running")s.state=stopped?"error":"done";});});
    m.parts=m.parts.filter(function(p){return p.t!=="text"||p.text.trim();});
    m.ts=Date.now();m.stopped=stopped||undefined;cur=null;S.msgs.push(m);save();paintBot(el,m,false);}
  fetch(API+"/api/chat",{method:"POST",signal:ctrl&&ctrl.signal,headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({name:me.value.trim()||myName(),messages:history(),context:ctx})})
  .then(function(r){
    if(r.status===401){S.code=null;needCode=true;save();throw new Error(Z("这个服务器需要访问码。","This server needs the access code."));}
    if(!r.ok)return r.json().catch(function(){return {};}).then(function(j){throw new Error(j.detail||Z("行程服务器出错了（"+r.status+"）。","The trip server had a problem ("+r.status+")."));});
    var reader=r.body.getReader(),dec=new TextDecoder(),buf="";
    function handle(ev){
      if(my!==gen)return;
      if(ev.type==="text"){textPart().text+=ev.text;m.content+=ev.text;}
      else if(ev.type==="step")step(ev);
      else if(ev.type==="approval"){m.parts.push({t:"card",card:ev.card});}
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
  .then(function(){if(my!==gen)return;if(!m.content&&!m.parts.some(function(p){return p.t==="card";}))throw new Error(Z("没有收到回答。","No answer came back."));finish();})
  .catch(function(e){
    if(my!==gen)return; // "New chat" already cleared everything
    if(e&&e.name==="AbortError"){if(m.parts.length)finish(true);else{cur=null;el.remove();uEl.remove();S.msgs.pop();save();note(Z("还没回答就停止了。","Stopped before an answer came back."));}return;}
    var msg=e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("连不上行程服务器，可能离线了。","Can't reach the trip server. It may be offline.");
    if(m.parts.length){finish();errLine(msg);}
    else{cur=null;el.remove();S.msgs.pop();save();
      if(needCode&&!S.code){uEl.remove();pending=q;showJoin();errLine(msg);}
      else errLine(msg,function(){uEl.remove();ask(q);});}
  })
  .then(function(){if(my!==gen)return;ctrl=null;setBusy(false);setBadge(true);scroll();next();});
}

form.addEventListener("submit",function(e){e.preventDefault();
  var q=text.value;
  if(busy&&!q.trim()){if(ctrl)ctrl.abort();return;} // the send button doubles as Stop
  if(!q.trim())return;text.value="";grow();ask(q);});
text.addEventListener("keydown",function(e){if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(text.value.trim())form.requestSubmit();}});
function grow(){text.style.height="auto";text.style.height=Math.min(text.scrollHeight,150)+"px";chat.classList.toggle("typed",!!text.value.trim());}
text.addEventListener("input",grow);

window.tripChat={ask:function(q){ask(q);},open:function(){openChat();}};
// the expense log talks to the same server with the same access code (typed once, in either place)
window.tripAuth={api:API,code:function(){return S.code||"";},
  setCode:function(c){S.code=c||null;save();if(c){join.hidden=true;}else{needCode=true;showJoin();}}};
})();
