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
var chat=$("chat"),log=$("chatLog"),form=$("chatForm"),text=$("chatText"),join=$("chatJoin"),sub=$("chatSub"),badge=$("chatBadge"),send=$("chatSend"),fab=$("askBtn"),scrim=$("chatScrim");
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
// ‹ in a conversation goes to the list of all of them; picking one (or +) comes back
$("chatBack").addEventListener("click",function(){showList(true);});
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
function userLine(m){var w=document.createElement("div");w.className="l-me appear";
  if(m.thumbs&&m.thumbs.length){var g=document.createElement("div");g.className="l-pics";
    m.thumbs.forEach(function(t){var i=document.createElement("img");i.src=t;i.alt=Z("附的图片","Attached photo");g.appendChild(i);});w.appendChild(g);}
  if(m.content){var d=document.createElement("div");d.className="l-user";d.textContent=m.content;w.appendChild(d);}
  return add(w);}
function botLine(m,live){var d=document.createElement("div");d.className="l-bot appear";add(d);paintBot(d,m,live);return d;}

/* What the assistant did on the way to its answer: the tool calls (searches, parts of the plan it read) and any
   text it wrote between them ("let me check the opening hours…"). That text is working notes, not the answer, so it
   folds away with the steps, like a thinking block; text with no tool call after it is the answer and stays open.
   While it works, the fold's head shows the step that's running. */
function procHtml(run,key,live,writing){
  var items=[],notes=0;run.forEach(function(p){if(p.t==="steps")items=items.concat(p.items);else notes++;});
  var running=items.filter(function(s){return s.state==="running";}),n=items.length,last=running[running.length-1];
  var head=writing?'<span class="spin"></span><span class="say">'+esc(latestLine(writing))+"</span>"
    :running.length?'<span class="spin"></span><span>'+esc(last.label||Z("正在处理","Working"))+"</span>"
    :IC.search+"<span>"+(n?Z("看了 <b>"+n+" 项</b>","Looked at <b>"+n+" thing"+(n>1?"s":"")+"</b>"):"")+(n&&notes?" · ":"")+(notes?Z("思考过程","Thought process"):"")+"</span>";
  return '<details class="steps'+(running.length||writing?" live":"")+'" data-steps="'+esc(key)+'"'+(openSteps[key]?" open":"")+"><summary>"+head+'<span class="chev">'+IC.chev+"</span></summary>"+
    run.map(function(p){
      if(p.t!=="steps")return '<div class="step-note">'+md(p.text)+"</div>";
      return p.items.map(function(s){var st=s.state||"running";
        return '<div class="step '+st+'">'+(st==="running"?'<span class="spin"></span>':st==="error"?IC.x:IC.check)+"<code>"+esc(s.label||"…")+'</code><span class="t">'+esc(clock(s.ts))+"</span></div>";}).join("");}).join("")+"</details>";
}
// the sentence being written (or the last one), for the fold's one-line head
function latestLine(s){var bits=s.replace(/\*\*|`|#/g,"").trim().split(/(?<=[。！？.!?])\s*|\n+/).filter(function(x){return x.trim();});
  var l=bits.pop()||"";if(l.length<12&&bits.length)l=bits.pop()+" "+l;return l.trim();}
// While a reply is coming in, its newest text might be a note on the way to a tool call or the start of the answer.
// Until it's clearly the answer (the reply ends, or it runs past WRITING characters) it streams in the fold's head,
// one line, the way a thinking block does, so notes never fill the screen for the moment before they fold away.
var WRITING=300;
// the answer's own text: what's left once the working notes before its last tool call are set aside
function isNote(parts,i){var p=parts[i];if(p.t!=="text")return false;for(var j=i+1;j<parts.length;j++)if(parts[j].t==="steps")return true;return false;}
function answerText(m){var ps=m.parts;if(!ps)return m.content||"";
  return ps.filter(function(p,i){return p.t==="text"&&!isNote(ps,i);}).map(function(p){return p.text.trim();}).filter(Boolean).join("\n\n");}
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
  var parts=m.parts||[{t:"text",text:m.content||""}],h="",run=[],runAt=0,end=parts.length-1;
  var tail=live&&parts[end]&&parts[end].t==="text"&&parts[end].text.trim(),writing=tail&&tail.length<WRITING?tail:"";
  function flush(){if(run.length)h+=procHtml(run,(m.ts||0)+"-"+runAt,live,writing&&run[run.length-1]===parts[end]?writing:"");run=[];}
  parts.forEach(function(p,i){
    if(p.t==="steps"||(isNote(parts,i)&&p.text.trim())||(writing&&i===end)){if(!run.length)runAt=i;run.push(p);return;}
    if(p.t==="text"&&!p.text.trim())return; // a blank between notes and steps keeps them in one fold
    flush();
    if(p.t==="card")h+=cardHtml(p.card);
    else if(p.text)h+='<div class="m-content">'+md(p.text)+"</div>";});
  flush();
  var lastPart=parts[parts.length-1];
  if(live&&(!lastPart||lastPart.t!=="text"||!lastPart.text)&&!(lastPart&&lastPart.t==="steps"&&lastPart.items.some(function(s){return s.state==="running";})))
    h+='<div class="l-status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>'+Z("思考中","Thinking")+"</span></div>";
  if(!live){h+='<div class="l-tools"><span>'+esc(clock(m.ts))+(m.stopped?Z(" · 中途停止"," · stopped early"):"")+'</span><button type="button" data-copy="1">'+Z("复制","Copy")+"</button></div>";}
  d.innerHTML=h;d._m=m;
}
log.addEventListener("toggle",function(e){var ds=e.target.dataset||{};if(ds.steps)openSteps[ds.steps]=e.target.open;if(ds.more)openMore[ds.more]=e.target.open;},true);
log.addEventListener("click",function(e){var t;
  if((t=e.target.closest("[data-copy]"))){var m=t.closest(".l-bot")._m;
    (navigator.clipboard?navigator.clipboard.writeText(answerText(m)):Promise.reject()).then(function(){t.textContent=Z("已复制","Copied");setTimeout(function(){t.textContent=Z("复制","Copy");},1500);}).catch(function(){});return;}
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
  var C=active();log.innerHTML="";
  if(!C.msgs.length)empty();
  C.msgs.forEach(function(m){if(m.role==="user")userLine(m);else botLine(m,false);});
  if(cur&&cur.C===C)add(cur.el); // its answer is still coming
  log.querySelectorAll(".appear").forEach(function(x){x.classList.remove("appear");});
  busyUI();scroll(true);
}
function waitingIn(C){var n=0;C.msgs.forEach(function(m){(m.parts||[]).forEach(function(p){if(p.t==="card"&&p.card.state==="waiting")n++;});});return n;}
function cardsWaiting(){return S.chats.reduce(function(n,C){return n+waitingIn(C);},0);}

/* ---------- past conversations ---------- */
function chatTitle(C){var u=C.msgs.filter(function(m){return m.role==="user";})[0];return u?(u.content.replace(/\s+/g," ").trim()||Z("📷 图片","📷 Photo")):Z("新对话","New chat");}
function when(ts){var d=new Date(ts),now=new Date(),L=isEn()?"en-CA":"zh-CN";
  if(d.toDateString()===now.toDateString())return clock(ts);
  var y=new Date(now);y.setDate(now.getDate()-1);if(d.toDateString()===y.toDateString())return Z("昨天 ","Yesterday ")+clock(ts);
  return d.toLocaleDateString(L,{month:"short",day:"numeric"});}
function showList(on){listing=on;chat.classList.toggle("listing",on);headTitle();
  if(on){paintList();var f=$("chatList").querySelector("[data-go]");if(f&&matchMedia("(hover:hover)").matches)f.focus({preventScroll:true});}else{scroll(true);}}
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
document.addEventListener("trip:lang",function(){showStatus();headTitle();if(listing)paintList();if(!busy)render();setBadge(badge.classList.contains("new")&&!cardsWaiting());sendLabel();});

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
  save();render();showList(false);openChat();
}

/* ---------- access code ---------- */
join.addEventListener("submit",function(e){
  e.preventDefault();var code=$("joinCode").value.trim(),err=$("joinErr");if(!code)return;err.textContent=Z("验证中…","Checking…");
  fetch(API+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
    if(r.status===401){err.textContent=Z("访问码不对。","That code didn't work.");return;}
    if(!r.ok)throw new Error();
    S.code=code;save();err.textContent="";join.hidden=true;
    if(pending){var w=pending;pending=null;ask(w.q,w.imgs);}else text.focus();
  }).catch(function(){err.textContent=Z("连不上服务器。","Can't reach the server.");});
});

/* ---------- ask ---------- */
// what the assistant reads back: the text of each turn, plus what became of the changes it proposed
function history(C){
  var h=C.msgs.filter(function(m){return m.content||(m.thumbs&&m.thumbs.length)||(m.parts&&m.parts.length);}).slice(-HISTORY).map(function(m){
    var c=m.content||"";
    if(m.thumbs&&m.thumbs.length)c+=(c?"\n":"")+"[附了 "+m.thumbs.length+" 张图片]";
    (m.parts||[]).forEach(function(p){if(p.t!=="card")return;var k=p.card,st=k.state;
      c+="\n\n["+(st==="applied"?"提议「"+k.title+"」：已确认，已经改好":st==="declined"?"提议「"+k.title+"」：对方没采用":st==="failed"?"提议「"+k.title+"」：确认了但没改成（"+(k.error||"")+"）":st==="expired"?"提议「"+k.title+"」：已失效，没有改":"提议「"+k.title+"」：还在等对方确认")+"]";});
    return {role:m.role,content:c.trim()||"…"};});
  while(h.length&&h[0].role!=="user")h.shift();
  return h;
}
// the newest question carries its photos in full (older ones only say they had some)
function withPhotos(h,q,imgs){var last=h[h.length-1];
  if(imgs.length&&last&&last.role==="user"){last.content=q||Z("（见图片）","(see the photo)");last.images=imgs.map(function(i){return i.full;});}
  return h;}
function setBusy(on){busy=on;fab.classList.toggle("busy",on);busyUI();setBadge(false);if(listing)paintList();}
// the Stop button belongs to the conversation that's answering, not to whichever one is on screen
function busyUI(){chat.classList.toggle("busy",busyHere());sendLabel();}
function busyHere(){return busy&&!!cur&&cur.C===active();}
function sendLabel(){var b=busyHere();send.setAttribute("aria-label",b?Z("停止回答","Stop answering"):Z("发送","Send"));send.title=b?Z("停止","Stop"):Z("发送","Send");}
// a question asked mid-answer waits its turn instead of cutting the answer off
function enqueue(q,imgs){queue.push({q:q,imgs:imgs,el:note(Z("排队中：","Up next: ")+(q||Z("图片","photo")))});}
function next(){if(busy||!queue.length)return;var n=queue.shift();n.el.remove();ask(n.q,n.imgs);}
// imgs: photos to send with this question, [{full, thumb}] (data: URLs); only the thumbnails are kept in the history
function ask(q,imgs){
  q=(q||"").trim();imgs=imgs||[];if(!q&&!imgs.length)return;
  openChat(false);
  if(q==="/clear"||q==="/new"){newChat();return;}
  if(listing)showList(false);
  if(busy){enqueue(q,imgs);return;}
  if(needCode&&!S.code){pending={q:q,imgs:imgs};showJoin();$("joinCode").focus();return;}
  var C=active(),my=gen;stick=true;
  var um={role:"user",content:q,ts:Date.now()};if(imgs.length)um.thumbs=imgs.map(function(i){return i.thumb;});
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
  function finish(stopped){
    m.parts.forEach(function(p){if(p.t==="steps")p.items.forEach(function(s){if(s.state==="running")s.state=stopped?"error":"done";});});
    m.parts=m.parts.filter(function(p){return p.t!=="text"||p.text.trim();});
    if(raf){cancelAnimationFrame(raf);raf=0;} // a repaint still queued from the stream would draw it as unfinished again
    m.ts=Date.now();m.stopped=stopped||undefined;cur=null;C.msgs.push(m);C.ts=Date.now();save();paintBot(el,m,false);}
  fetch(API+"/api/chat",{method:"POST",signal:ctrl&&ctrl.signal,headers:{"Content-Type":"application/json","X-Access-Code":S.code||""},
    body:JSON.stringify({name:"",messages:withPhotos(history(C),q,imgs),context:ctx})})
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
    if(my!==gen)return; // its conversation was deleted
    if(e&&e.name==="AbortError"){if(m.parts.length)finish(true);else{cur=null;el.remove();uEl.remove();C.msgs.pop();save();if(here())note(Z("还没回答就停止了。","Stopped before an answer came back."));}return;}
    var msg=e&&e.message&&e.message!=="Failed to fetch"?e.message:Z("连不上行程服务器，可能离线了。","Can't reach the trip server. It may be offline.");
    if(m.parts.length){finish();if(here())errLine(msg);}
    else{cur=null;el.remove();C.msgs.pop();save();
      if(!here())return;
      if(needCode&&!S.code){uEl.remove();pending={q:q,imgs:imgs};showJoin();errLine(msg);}
      else errLine(msg,function(){uEl.remove();ask(q,imgs);});}
  })
  .then(function(){if(my!==gen)return;ctrl=null;setBusy(false);setBadge(true);scroll();next();});
}

form.addEventListener("submit",function(e){e.preventDefault();
  var q=text.value,imgs=pics.filter(function(p){return p.full;});
  if(busy&&!q.trim()&&!imgs.length){if(ctrl&&busyHere())ctrl.abort();return;} // the send button doubles as Stop
  if(pics.some(function(p){return !p.full;}))return; // a photo is still being shrunk
  if(!q.trim()&&!imgs.length)return;text.value="";pics=[];paintPics();grow();ask(q,imgs);});
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

window.tripChat={ask:function(q){ask(q);},open:function(){openChat();}};
// the expense log talks to the same server with the same access code (typed once, in either place)
window.tripAuth={api:API,code:function(){return S.code||"";},
  setCode:function(c){S.code=c||null;save();if(c){join.hidden=true;}else{needCode=true;showJoin();}}};
})();
