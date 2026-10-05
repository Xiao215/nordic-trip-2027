(function(){
"use strict";
/* Trip planner for a month: an overview (route ribbon, 4-week calendar, legs), one day at a time
   (day-at-a-glance card with forecast or July normals, sunrise/sunset, timeline), and the prep tab
   (bookings + checklists), next to a Google map that shows whatever you open.
   The page is in Chinese or English (中文 / EN switch). Place names are written as [[place_id]] in
   trip.json: Chinese shows the Chinese name (hover for the local spelling), English shows the local
   spelling. The rest of the English text comes from i18n/en.json, keyed by the Chinese original, and
   interface strings from UIEN below. All content comes from trip.json (the chat backend reads it too). */
var CFG=window.TRIP_CONFIG||{};
var wide=window.matchMedia?matchMedia("(min-width: 901px)"):{matches:true};
var KCOL={visit:"#1F4E6B",hike:"#3D7A4F",glacier:"#3F8FB5",water:"#2B7A8C",city:"#7A5C9E",food:"#C9711C",shop:"#C9711C",stay:"#5D6B73",camp:"#6B7F3A",start:"#5D6B73",move:"#5D6B73"};
var OUTDOORS={hike:1,glacier:1,visit:1,water:1,city:1};
var WK=["周日","周一","周二","周三","周四","周五","周六"],WKEN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MODE={drive:"开车",flight:"飞机",ferry:"渡轮",train:"火车",bus:"巴士",walk:"步行",bike:"骑车"};
var MODEEN={drive:"drive",flight:"flight",ferry:"ferry",train:"train",bus:"bus",walk:"walk",bike:"bike ride"};

/* ---------- language ---------- */
// "zh", or "local" for the English page (place names in their local spelling); kept under the old key
var NM=store("nt-names")==="local"||store("nt-names")==="en"?"local":"zh";
function en(){return NM==="local";}
var EN={}; // trip.json text in English, {"中文原文": "English"}, loaded from i18n/en.json
function L(s){return en()&&s!=null&&EN[s]!=null?EN[s]:s;}
var UIEN={
  "规划中":"Being planned","草案":"draft","现在":"NOW","下一站":"NEXT","：":": ","住 ":"Sleep: ",
  "{n} 天":"{n} days","还有 {n} 天出发":"{n} days to go","明天出发":"Leaving tomorrow","旅行第 {n} 天":"Day {n} of the trip",
  "今天可订：{w}":"Book today: {w}","明天可订：{w}":"Book tomorrow: {w}","{n} 天后可订：{w}":"Book in {n} days: {w}",
  "已排好 {a} 天，其余 {b} 天规划中":"{a} days planned, {b} still being planned","全部 {n} 天已排好":"All {n} days planned",
  "{n} 天后开放预订":"Opens in {n} days","明天开放预订":"Opens tomorrow","今天开放预订":"Opens today","现在可以订":"Open now",
  "尽早":"Early","已订":"Booked","标记已订":"Mark booked","打开 ":"Open ","问助手":"Ask","全部步骤":"All steps","展开说明":"More",
  "已订 {a} / {b} · 勾选只保存在这台设备上":"{a} of {b} booked · ticks are saved on this device",
  "签证和入境":"Visas and entry","护照和勾选只保存在这台设备上":"Your passport and ticks are saved on this device","护照":"Passport","住在":"Living in",
  "选一下你的护照，只看跟你有关的签证和入境步骤。":"Pick your passport to see only the visa and entry steps that apply to you.",
  "{p} · 住在 {l}":"{p} · living in {l}","查看预订":"See the booking","显示全部":"Show all","只看我的":"Only mine",
  "已隐藏 {n} 项只适用于其他护照的预订":"{n} bookings for other passports are hidden","已隐藏 1 项只适用于其他护照的预订":"1 booking for another passport is hidden",
  "正在显示所有护照的预订":"Showing bookings for every passport",
  "资料来源：":"Sources: ","天气预报：Open-Meteo":"Forecast: Open-Meteo",
  "一步步教我怎么订「{w}」，有什么要注意的？":"Walk me through booking {w}. Anything to watch out for?",
  "全天":"Whole day","全程":"Whole trip","全程路线":"Whole route","{d}：全天":"{d}: whole day",
  "这一天还在规划中":"This day is still being planned","草案：":"Draft: ",
  "属于「{l}」（{a} – {b}）。":"Part of “{l}” ({a} – {b}). ","还没排进任何路线分段。":"Not part of any leg yet.",
  "问助手这天可以怎么安排":"Ask what to do this day",
  "{d}（{w}）还没排，按目前的路线，这天可以怎么安排？":"{d} ({w}) isn't planned yet. Given the current route, what could we do that day?",
  "交通":"Transport","户外":"Outdoors","住宿":"Stay","日落":"Sunset"," · 约 {n} 公里":" · about {n} km",
  "在 Google 地图打开":"Open in Google Maps","导航":"Directions","问问这个":"Ask about this",
  "{w} 这段{m}有什么要注意的？":"Anything to know about the {m} {w}?","多讲讲「{w}」，有什么要注意的？":"Tell me more about {w}. Anything to watch out for?",
  "晴":"Clear","晴间多云":"Partly cloudy","阴":"Overcast","雾":"Fog","毛毛雨":"Drizzle","雨":"Rain","雪":"Snow","阵雨":"Showers","阵雪":"Snow showers","雷雨":"Thunderstorms",
  " · 降水概率 {n}%":" · {n}% chance of rain","风速最高 {n} m/s":"Wind up to {n} m/s","7 月常年":"Typical July"," · 约 {n} 天有雨":" · ~{n} rainy days",
  "正在载入预报…":"Loading forecast…","出发前约 16 天出现预报":"Forecast appears ~16 days before","暂无预报":"No forecast",
  "不挪地方":"Staying put","景点、徒步、冰川、逛城":"Sights, hikes, glaciers, town","极昼":"Midnight sun","日出 {r} · 日照 {l}":"Sunrise {r} · {l} of daylight",
  "（{t}后）":" (in {t})",
  "北欧之旅":"Nordic Trip","照片：":"Photo: ","摄影：":"Photo: ","照片待定":"Photo TBD","照片":"Photo","关闭":"Close","上一张":"Previous","下一张":"Next","主导航":"Main navigation","路线":"Route","货币":"Currency","当地货币":"Local","当地":"Local","价格换算":"Currency","按原价显示，不换算":"As written, no conversion","汇率更新于 {d} · 约数":"Rates from {d} · approximate","汇率为约数":"Rates are approximate",
  "总览":"Overview","每日":"Daily","准备":"Prep","四周日历":"4-week calendar","点任意一天看当天安排":"Tap a day to see its plan","路线分段":"Route legs",
  "点一站看详情，地图会跳过去":"Tap a stop for details and to see it on the map","预订":"Bookings","前一天":"Previous day","后一天":"Next day",
  "视图":"View","选择日期":"Choose a day","语言":"Language","地图":"Map","行程地图":"Trip map","看全天 / 全程":"Show the whole day / trip",
  "在 Google 地图里打开当天路线":"Open the day's route in Google Maps","行程助手":"Trip assistant","输入访问码：":"Enter the access code:",
  "访问码":"Access code","确定":"Enter","问问行程助手…":"Ask about the trip…","问行程助手":"Ask the trip assistant",
  "新对话":"New chat","清空对话，重新开始":"Clear this conversation and start over","收起对话":"Hide chat",
  "收起（Esc）。收起后回答会继续。":"Hide (Esc). Answers keep coming while hidden.",
  "回车发送 · Shift+回车换行 · Esc 收起":"Enter to send · Shift+Enter for a new line · Esc to hide","正在载入行程…":"Loading the plan…","按计划现在在这":"Here now (per plan)","Google 地图":"Google Map",
  "行程没载入（{e}）。如果是直接从硬盘打开的 index.html，请改用本地服务器：python3 -m http.server":"Couldn't load the plan ({e}). If you opened index.html from disk, serve the folder instead: python3 -m http.server"
};
/* ---------- currency ---------- */
// Prices stay as written in trip.json (ISK, NOK, SEK, DKK, €, US$). With CAD, CNY or USD picked, every
// amount is converted on the page with the latest rates (per US dollar), and hovering shows the original.
var CUR=["CAD","CNY","USD"].indexOf(store("nt-cur"))>=0?store("nt-cur"):"local";
var FX=null,FXAT=null,CSYM={CAD:"C$",CNY:"¥",USD:"US$"},SYMCODE={"US$":"USD","C$":"CAD","CA$":"CAD","€":"EUR"};
var NUM="(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
var RE_PRE=new RegExp("(US\\$|CA\\$|C\\$|€)\\s?"+NUM+"(?:\\s*[–-]\\s*(?:US\\$|CA\\$|C\\$|€)?"+NUM+")?","g");
var RE_SUF=new RegExp(NUM+"(?:\\s*[–-]\\s*"+NUM+")?\\s?(ISK|NOK|SEK|DKK|EUR|CAD|USD|CNY)(?![A-Za-z])","g");
function fmtMoney(v){var a=Math.abs(v),r=a>=1000?Math.round(v/10)*10:a>=10?Math.round(v):a>=1?Math.round(v*10)/10:Math.round(v*100)/100;
  return CSYM[CUR]+r.toLocaleString("en-US",{maximumFractionDigits:2});}
// converts the amounts in s; hold() keeps the converted markup out of later escaping (tx), or plain text when hold is absent
function money(s,hold){if(CUR==="local"||!FX)return s;
  function conv(m,code,a,b){if(code===CUR||!FX[code]||!FX[CUR])return m;
    var f=function(x){return +x.replace(/,/g,"")/FX[code]*FX[CUR];},t=fmtMoney(f(a))+(b?"–"+fmtMoney(f(b)).replace(CSYM[CUR],""):"");
    return hold?hold('<span class="pl money" data-lo="'+esc(m)+'">'+esc(t)+"</span>"):t;}
  return s.replace(RE_PRE,function(m,sym,a,b){return conv(m,SYMCODE[sym],a,b);}).replace(RE_SUF,function(m,a,b,code){return conv(m,code,a,b);});}
// for the chat: the picked currency and the page's own rates, so its conversions match the page
function curContext(){if(CUR==="local"||!FX)return "";
  return CUR+" (1 "+CUR+" = "+["ISK","NOK","SEK","DKK","EUR"].map(function(k){return (FX[k]/FX[CUR]).toFixed(2)+" "+k;}).join(", ")+")";}
function loadFx(){
  var c=store("nt-fx");if(c&&Date.now()-c.t<12*36e5){FX=c.rates;FXAT=c.t;return;}
  FX=(T.fx||{}).rates||null;FXAT=T.fx&&T.fx.date?Date.parse(T.fx.date+"T12:00:00Z"):null;
  fetch("https://open.er-api.com/v6/latest/USD").then(function(r){return r.ok?r.json():Promise.reject();}).then(function(j){
    if(j.result!=="success")return;FX=j.rates;FXAT=Date.now();store("nt-fx",{t:FXAT,rates:j.rates});renderCur();if(CUR!=="local")rerender();}).catch(function(){});}

// an interface string in the current language, with {name} placeholders filled from v
function U(s,v){var r=en()&&UIEN[s]!=null?UIEN[s]:s;return v?r.replace(/\{(\w+)\}/g,function(_,k){return v[k];}):r;}
function wk(d){return (en()?WKEN:WK)[wkday(d)];}
function mode(m){return en()?MODEEN[m]||m:MODE[m]||m;}

/* ---------- small helpers ---------- */
var $=function(id){return document.getElementById(id);};
function mins(s){var p=s.split(":");return +p[0]*60+ +p[1];}
function fmt(m){m=Math.round(m);var h=Math.floor(m/60)%24,mm=m%60;return (h<10?"0":"")+h+":"+(mm<10?"0":"")+mm;}
function hm(d){var h=Math.floor(d/60),m=d%60;if(en())return ((h?h+" h ":"")+(m?m+" min":"")).trim()||"0 min";return ((h?h+" 小时 ":"")+(m?m+" 分":"")).trim()||"0 分";}
function hmS(d){var h=Math.floor(d/60),m=d%60;return h?h+"h"+(m?(m<10?"0":"")+m:""):m+"min";}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
function decode(s){var pts=[],i=0,lat=0,lng=0;while(i<s.length){for(var n=0;n<2;n++){var sh=0,r=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);var v=r&1?~(r>>1):r>>1;if(n)lng+=v;else lat+=v;}pts.push([lat/1e5,lng/1e5]);}return pts;}
function km(a,b){var k=Math.cos((a[0]+b[0])/2*Math.PI/180);return Math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*111.32*k);}
function along(pts,f){if(pts.length<2)return pts[0];var seg=[],tot=0;for(var i=1;i<pts.length;i++){var d=km(pts[i-1],pts[i]);seg.push(d);tot+=d;}
  var t=Math.max(0,Math.min(1,f))*tot;for(var j=0;j<seg.length;j++){if(t<=seg[j]||j===seg.length-1){var u=seg[j]?Math.min(1,t/seg[j]):0,a=pts[j],b=pts[j+1];return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}t-=seg[j];}return pts[pts.length-1];}
function nowIn(tz){var p={};new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
  return {date:p.year+"-"+p.month+"-"+p.day,mins:+p.hour*60+ +p.minute};}
function homeToday(){return nowIn("America/Toronto").date;}
function daysBetween(a,b){return Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/864e5);}
function addDays(d,n){return new Date(Date.parse(d+"T12:00:00Z")+n*864e5).toISOString().slice(0,10);}
function wkday(d){return new Date(d+"T12:00:00Z").getUTCDay();}
function md(d){return (+d.slice(5,7))+"/"+(+d.slice(8,10));}
function cnDate(d){return en()?MON[+d.slice(5,7)-1]+" "+(+d.slice(8,10)):(+d.slice(5,7))+"月"+(+d.slice(8,10))+"日";}
// Sunrise/sunset from the standard sunrise equation (good to a few minutes); null times = midnight sun.
function sunTimes(date,lat,lon,tz){
  var r=Math.PI/180,J=Date.parse(date+"T12:00:00Z")/864e5+2440587.5,n=Math.ceil(J-2451545+0.0008),Js=n-lon/360;
  var M=(357.5291+0.98560028*Js)%360,C=1.9148*Math.sin(M*r)+0.02*Math.sin(2*M*r)+0.0003*Math.sin(3*M*r);
  var L=(M+C+180+102.9372)%360,Jt=2451545+Js+0.0053*Math.sin(M*r)-0.0069*Math.sin(2*L*r);
  var sd=Math.sin(L*r)*Math.sin(23.4397*r),cd=Math.cos(Math.asin(sd));
  var cw=(Math.sin(-0.833*r)-Math.sin(lat*r)*sd)/(Math.cos(lat*r)*cd);
  if(cw<-1)return {polar:"day"};if(cw>1)return {polar:"night"};
  var w=Math.acos(cw)/r/360,f=new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  function t(j){return f.format(new Date((j-2440587.5)*864e5));}
  return {rise:t(Jt-w),set:t(Jt+w),len:Math.round(w*2*1440)};
}
var ICON={
  maps:'<svg viewBox="0 0 20 20"><path d="M10 18s-5.5-5.2-5.5-9.5a5.5 5.5 0 0 1 11 0C15.5 12.8 10 18 10 18z"/><circle cx="10" cy="8.5" r="2"/></svg>',
  dir:'<svg viewBox="0 0 20 20"><path d="M8 4H4v12h12v-4M11 3h6v6M17 3l-8 8"/></svg>',
  ask:'<svg viewBox="0 0 20 20"><path d="M4 4.5h12v8H9l-4 3v-3H4z"/></svg>',
  check:'<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>',
  visa:'<svg viewBox="0 0 20 20"><path d="M10 3l7.5 13h-15zM10 8.5v3.5M10 14.5h.01"/></svg>',
  free:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M6.5 10.2l2.4 2.4 4.6-5"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 20 20"><path d="M5 8l5 5 5-5"/></svg>',
  drive:'<svg viewBox="0 0 20 20"><path d="M4 13V9.5L5.6 5h8.8L16 9.5V13M4 13h12M4 13v2M16 13v2"/></svg>',
  flight:'<svg viewBox="0 0 20 20"><path d="M2.5 11.5l15-5.5-1-2-5.5 2.5L6 3.5 4.5 4l3 4-3.5 1.5L2.5 8l-1 .5zM4 16.5h12"/></svg>',
  ferry:'<svg viewBox="0 0 20 20"><path d="M3 12h14l-2 4H5zM6 12V8h8v4M9 8V5h2v3M2 17.5c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/></svg>',
  train:'<svg viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="11" rx="2.5"/><path d="M5 9h10M8 17l-2 1.5M12 17l2 1.5M7.5 12h.01M12.5 12h.01"/></svg>',
  bus:'<svg viewBox="0 0 20 20"><rect x="4" y="3" width="12" height="12" rx="2"/><path d="M4 10h12M6 15v2M14 15v2M7 12.5h.01M13 12.5h.01"/></svg>',
  bike:'<svg viewBox="0 0 20 20"><circle cx="5" cy="13.5" r="3"/><circle cx="15" cy="13.5" r="3"/><path d="M5 13.5l3-6h5l2 6M8 7.5L10 13.5h0M11.5 5.5H14"/></svg>',
  walk:'<svg viewBox="0 0 20 20"><circle cx="11" cy="3.8" r="1.6"/><path d="M8 18l2-5 2 2v3M10 13l1-5-3 2-1 3M11 8l2 3h2.5"/></svg>'
};
var WX={sun:'<svg viewBox="0 0 48 48"><g class="sun"><circle cx="24" cy="24" r="8"/><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l3.5 3.5M33.5 33.5 37 37M11 37l3.5-3.5M33.5 14.5 37 11"/></g></svg>',
  part:'<svg viewBox="0 0 48 48"><g class="sun"><circle cx="18" cy="17" r="6"/><path d="M18 5v3M6 17h3M9.5 8.5l2 2M26.5 8.5l-2 2"/></g><path d="M16 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19 3 5.5 5.5 0 0 0-1 11z"/></svg>',
  cloud:'<svg viewBox="0 0 48 48"><path d="M13 36h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-1 13z"/></svg>',
  rain:'<svg viewBox="0 0 48 48"><path d="M13 30h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-1 13z"/><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5"/></svg>',
  snow:'<svg viewBox="0 0 48 48"><path d="M13 30h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-1 13z"/><path d="M17 37h.01M24 40h.01M31 37h.01"/></svg>',
  fog:'<svg viewBox="0 0 48 48"><path d="M10 20h28M6 27h36M10 34h28"/></svg>',
  storm:'<svg viewBox="0 0 48 48"><path d="M13 30h22a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-1 13z"/><path d="M25 32l-4 6h6l-4 6"/></svg>'};
function wmo(c){var w=c===0?["晴","sun"]:c<=2?["晴间多云","part"]:c===3?["阴","cloud"]:c<=48?["雾","fog"]:c<=57?["毛毛雨","rain"]:c<=67?["雨","rain"]:c<=77?["雪","snow"]:c<=82?["阵雨","rain"]:c<=86?["阵雪","snow"]:["雷雨","storm"];return [U(w[0]),w[1]];}

/* ---------- place names ---------- */
// Chinese page: the Chinese name (hover shows the local spelling). English page: the name as it's
// written on signs and maps there (Mývatn, Þingvellir, Flåm, København).
function names(id){var p=T.places[id]||T.countries[id];if(!p)return null;
  return {zh:p.zh||p.local||p.en,lo:p.local||p.en||p.zh};}
// one place name in the current mode; plain=true gives text without markup (map labels, chat)
function pn(id,plain){var n=names(id);if(!n)return plain?id:esc(id);
  if(NM==="local")return plain?n.lo:esc(n.lo);
  if(plain||n.lo===n.zh)return plain?n.zh:esc(n.zh);
  return '<span class="pl" data-lo="'+esc(n.lo)+'">'+esc(n.zh)+"</span>";}
// inline markup used in trip.json: [[place]], `code`, **bold** and [text](https://url)
function tx(s){if(s==null)return "";s=L(s);var held=[];function hold(h){held.push(h);return "\u0001"+(held.length-1)+"\u0001";}
  s=String(s).replace(/\[\[([\w-]+)\]\]/g,function(_,id){return hold(pn(id));});
  s=money(s,hold);
  s=esc(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0001(\d+)\u0001/g,function(_,i){return held[+i];});}
// hovering a Chinese place name shows its local spelling in one floating label (cards clip anything inside them)
var tip=document.createElement("div");tip.className="pl-tip";tip.hidden=true;document.body.appendChild(tip);
var tipT=null;
function showTip(p){var r=p.getBoundingClientRect();tip.textContent=p.dataset.lo;tip.hidden=false;
  tip.style.left=Math.max(8+tip.offsetWidth/2,Math.min(innerWidth-8-tip.offsetWidth/2,r.left+r.width/2))+"px";tip.style.top=(r.top-6)+"px";}
document.addEventListener("mouseover",function(e){var p=e.target.closest&&e.target.closest(".pl");if(p)showTip(p);else tip.hidden=true;});
// phones have no hover: a tap on a name shows it for a moment (the tap still does whatever it normally does)
document.addEventListener("pointerdown",function(e){if(e.pointerType!=="touch")return;var p=e.target.closest&&e.target.closest(".pl");if(!p)return;
  showTip(p);clearTimeout(tipT);tipT=setTimeout(function(){tip.hidden=true;},1800);});
document.addEventListener("scroll",function(){tip.hidden=true;},true);
// text with every place in its local spelling (tooltips on cells too small for the hover label)
function localText(s){return String(s||"").replace(/\[\[([\w-]+)\]\]/g,function(_,id){var n=names(id);return n?n.lo:id;});}
function plain(s){return money(String(L(s)||"")).replace(/\[\[([\w-]+)\]\]/g,function(_,id){return pn(id,true);}).replace(/\*\*|`/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1");}

/* ---------- state ---------- */
var T,DATES=[],BYDATE={},N={},GPID={};
var state={view:"all",date:null,sel:null},weather={};

function LL(x){return typeof x==="string"?N[x]:x;}
function gPlace(id){var ll=N[id];var u="https://www.google.com/maps/search/?api=1&query="+ll[0]+"%2C"+ll[1];if(GPID[id])u+="&query_place_id="+GPID[id];return u;}
function gRoute(ids,mode){var c=ids.map(function(id){var p=LL(id);return p[0]+","+p[1];});return "https://www.google.com/maps/dir/?api=1&travelmode="+(mode||"driving")+"&origin="+encodeURIComponent(c[0])+"&destination="+encodeURIComponent(c[c.length-1])+(c.length>2?"&waypoints="+encodeURIComponent(c.slice(1,-1).join("|")):"");}
function legOf(d){return T.legs.filter(function(l){return d>=l.from&&d<=l.to;})[0]||null;}
function cOf(d){var D=BYDATE[d];return D?D.c:(legOf(d)||{}).c;}
function colorOf(d){var c=T.countries[cOf(d)];return c?c.color:"#8A99A3";}
function tzOf(d){var c=T.countries[cOf(d)];return c&&c.tz||"Atlantic/Reykjavik";}
function day(){return BYDATE[state.date]||null;}
// "mins" wins: flights cross time zones, so local start/end don't give the real length
function dur(s){if(s.mins)return s.mins;if(!s.start||!s.end)return 0;var d=mins(s.end)-mins(s.start);return d<0?d+1440:d;}
function liveDate(){for(var i=0;i<DATES.length;i++){if(nowIn(tzOf(DATES[i])).date===DATES[i])return DATES[i];}return null;}
function dayLabel(d){var D=BYDATE[d];return D?plain(D.short||D.title):U("规划中");}

function boot(trip){
  T=trip;
  Object.keys(T.places).forEach(function(k){N[k]=T.places[k].ll;if(T.places[k].gid)GPID[k]=T.places[k].gid;});
  for(var d=T.dates.start;d<=T.dates.end;d=addDays(d,1))DATES.push(d);
  T.days.forEach(function(D){BYDATE[D.date]=D;var n=0;
    D.segs.forEach(function(s,i){s.i=i;if(s.t==="stop")s.num=++n;
      s.pts=s.geom?decode(s.geom):(s.t==="move"?s.path.map(LL):null);});});
  loadFx();renderCur();
  applyNames();renderHeader();renderAll();renderStrip();renderPrep();
  var h=decodeURIComponent(location.hash.slice(1)),saved=store("nt-pos")||{};
  var live=liveDate(),date=BYDATE[h]||DATES.indexOf(h)>=0?h:live||saved.date||T.dates.start;
  var view=h==="prep"||h==="all"?h:DATES.indexOf(h)>=0||live?"day":saved.view||"all";
  setView(view,date);
  loadMap();
  setInterval(function(){if(state.view==="day"&&liveDate()===state.date)renderGlance();},60000);
  window.addEventListener("hashchange",function(){var h=decodeURIComponent(location.hash.slice(1));
    if(DATES.indexOf(h)>=0&&!(state.view==="day"&&state.date===h))setView("day",h);else if((h==="all"||h==="prep")&&state.view!==h)setView(h);});
  window.tripApp={context:function(){var c=viewContext(),pp=passportText();if(pp)c.passport=pp;return c;},
    lang:function(){return en()?"en":"zh";}};
  function viewContext(){var D=day(),s=D&&state.sel!=null?D.segs[state.sel]:null;
    var lang=en()?"en":"zh",curTxt=curContext();
    if(state.view==="prep")return {lang:lang,currency:curTxt,day:"Prep tab",looking_at:"visas, bookings and checklists"};
    if(state.view==="all")return {lang:lang,currency:curTxt,day:"Overview",looking_at:"the whole trip's calendar and route legs"};
    return {lang:lang,currency:curTxt,day:state.date+" · "+(D?plain(D.title):"being planned"),looking_at:s?(s.t==="move"?mode(s.mode)+" "+moveLabel(s,true):s.num+". "+plain(s.name||"[["+s.place+"]]")+(s.start?" ("+s.start+")":"")):"the whole day"};}
  document.dispatchEvent(new CustomEvent("trip:view"));
}

/* ---------- header ---------- */
function nextBooking(){var today=homeToday(),done=store("nt-booked")||{};
  return T.bookings.filter(function(b){return forMe(b)&&b.opens&&!done[b.id]&&b.opens.slice(0,10)>=today;}).sort(function(a,b){return a.opens<b.opens?-1:1;})[0];}
function renderHeader(){
  document.title=en()&&T.titleEn?T.titleEn:T.title;document.documentElement.lang=en()?"en":"zh-Hans";
  $("eyebrow").textContent=L(T.eyebrow);$("title").innerHTML=en()&&T.titleEn?esc(T.titleEn):esc(T.title)+(T.titleEn?'<span class="en">'+esc(T.titleEn)+"</span>":"");
  $("lede").innerHTML=tx(T.lede);
  var today=homeToday(),d=daysBetween(today,T.dates.start),chips=[];
  if(d>1)chips.push('<span class="chip count">'+U("还有 {n} 天出发",{n:d})+'</span>');
  else if(d===1)chips.push('<span class="chip count">'+U("明天出发")+'</span>');
  else if(today<=T.dates.end)chips.push('<span class="chip count">'+U("旅行第 {n} 天",{n:1-d})+'</span>');
  var nb=nextBooking();
  if(nb){var n=daysBetween(today,nb.opens.slice(0,10));
    chips.push('<button class="chip due" data-booking="'+esc(nb.id)+'">'+esc(U(n===0?"今天可订：{w}":n===1?"明天可订：{w}":"{n} 天后可订：{w}",{n:n,w:plain(nb.what)}))+" →</button>");}
  (T.conditions||[]).forEach(function(c){chips.push('<span class="chip'+(c[2]==="warn"?" warn":"")+'"><b>'+tx(c[0])+U("：")+'</b>'+tx(c[1])+'</span>');});
  $("chips").innerHTML=chips.join("");
  var due=$("chips").querySelector(".due");if(due)due.addEventListener("click",function(){openBooking(due.dataset.booking);});
  var planned=DATES.filter(function(x){return BYDATE[x];}).length;
  $("allSub").textContent=U("{n} 天",{n:DATES.length});
}

/* ---------- overview: ribbon, calendar, legs ---------- */
function renderAll(){
  var total=DATES.length;
  $("ribbon").innerHTML=T.legs.map(function(l){var n=daysBetween(l.from,l.to)+1,c=T.countries[l.c]||{};
    return '<button type="button" class="rt" style="--c:'+esc(c.color||"#8A99A3")+';flex:'+n+' 1 0" data-date="'+esc(l.from)+'" title="'+esc(plain(l.title))+'"><span class="rt-bar"></span><b>'+esc(plain(l.short||l.title))+'</b><small>'+md(l.from)+"–"+md(l.to)+" · "+U("{n} 天",{n:n})+"</small></button>";}).join("");
  var live=liveDate(),h=(en()?WKEN:WK).map(function(w){return '<div class="cal-h">'+(en()?w:w.slice(1))+"</div>";}).join("");
  for(var i=0;i<wkday(DATES[0]);i++)h+="<div></div>";
  DATES.forEach(function(d,i){var D=BYDATE[d],stay=D&&D.stay?names(D.stay):null;
    h+='<button type="button" class="cd'+(D?"":" draft")+(d===live?" today":"")+'" style="--c:'+colorOf(d)+';--n:'+i+'" data-date="'+d+'"'+(D&&NM==="zh"?' title="'+esc(localText(D.short||D.title))+'"':"")+'>'+
      '<span class="cd-img">'+(D&&heroOf(D)?img(heroOf(D).ph,400):D&&dayStops(D).length?tbd("mini"):"")+'</span><span class="cd-d">'+md(d)+"</span>"+
      '<span class="cd-t">'+(D?tx(D.short||D.title):U("规划中"))+"</span>"+
      (stay?'<span class="cd-s">'+U("住 ")+esc(NM==="local"?stay.lo:stay.zh)+"</span>":(!D&&legOf(d)?'<span class="cd-s">'+esc(plain(legOf(d).short||legOf(d).title))+"</span>":""))+"</button>";});
  $("cal").innerHTML=h;
  $("legs").innerHTML=T.legs.map(function(l,li){var n=daysBetween(l.from,l.to)+1,c=T.countries[l.c]||{},lp=legPhotos(l);
    return '<div class="leg" style="--c:'+esc(c.color||"#8A99A3")+'">'+('<div class="leg-imgs">'+lp.slice(0,4).map(function(x,k){return '<button type="button" class="leg-img" data-leg="'+li+'" data-k="'+k+'" aria-label="'+esc(plain(x.s.name||"[["+x.s.place+"]]"))+'">'+img(x.ph,600)+"</button>";}).join("")+(lp.length<4?new Array(5-lp.length).join('<span class="leg-img">'+tbd()+"</span>"):"")+"</div>")+'<div class="leg-h"><h3>'+tx(l.title)+'</h3><span class="when">'+cnDate(l.from)+" – "+cnDate(l.to)+" · "+U("{n} 天",{n:n})+"</span>"+(l.draft?'<span class="leg-tag">'+U("草案")+'</span>':"")+"</div>"+
      (l.body?"<p>"+tx(l.body)+"</p>":"")+(l.items&&l.items.length?"<ul>"+l.items.map(function(x){return "<li>"+tx(x)+"</li>";}).join("")+"</ul>":"")+"</div>";}).join("");
  var drafts=DATES.filter(function(d){return !BYDATE[d];}).length;
  $("legHint").textContent=drafts?U("已排好 {a} 天，其余 {b} 天规划中",{a:total-drafts,b:drafts}):U("全部 {n} 天已排好",{n:total});
}
$("allView").addEventListener("click",function(e){var li=e.target.closest(".leg-img");if(li){openLb(legPhotos(T.legs[+li.dataset.leg]),+li.dataset.k);return;}
  var b=e.target.closest("[data-date]");if(b)setView("day",b.dataset.date);});

/* ---------- day strip ---------- */
function renderStrip(){
  var live=liveDate();
  $("strip").innerHTML=DATES.map(function(d){return '<button type="button" role="tab" class="sd'+(BYDATE[d]?"":" draft")+(d===live?" today":"")+'" style="--c:'+colorOf(d)+'" data-date="'+d+'" aria-selected="false" title="'+esc(dayLabel(d))+'"><b>'+md(d)+"</b><small>"+wk(d)+"</small></button>";}).join("");
}
$("strip").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b)setView("day",b.dataset.date);});
$("prevDay").addEventListener("click",function(){var i=DATES.indexOf(state.date);if(i>0)setView("day",DATES[i-1]);});
$("nextDay").addEventListener("click",function(){var i=DATES.indexOf(state.date);if(i<DATES.length-1)setView("day",DATES[i+1]);});
document.addEventListener("keydown",function(e){
  if(state.view!=="day"||e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||""))return;
  if(e.key==="ArrowLeft")$("prevDay").click();else if(e.key==="ArrowRight")$("nextDay").click();});
function markStrip(){
  var i=DATES.indexOf(state.date);$("prevDay").disabled=i<=0;$("nextDay").disabled=i>=DATES.length-1;
  document.querySelectorAll(".sd").forEach(function(b){var on=b.dataset.date===state.date;b.setAttribute("aria-selected",on);
    if(on&&state.view==="day"){var s=$("strip"),x=b.offsetLeft-s.offsetLeft-(s.clientWidth-b.offsetWidth)/2;s.scrollTo({left:x,behavior:"smooth"});}});
}

/* ---------- static text in index.html ---------- */
// Elements marked data-i18n="中文" get that text (or its English from UIEN); data-i18n-placeholder,
// -title and -aria-label do the same for attributes.
function applyStatic(){
  document.querySelectorAll("[data-i18n]").forEach(function(el){el.textContent=U(el.dataset.i18n);});
  ["placeholder","title","aria-label"].forEach(function(at){document.querySelectorAll("[data-i18n-"+at+"]").forEach(function(el){el.setAttribute(at,U(el.getAttribute("data-i18n-"+at)));});});
}

/* ---------- language switch ---------- */
function applyNames(){document.querySelectorAll(".names button").forEach(function(b){b.setAttribute("aria-checked",b.dataset.nm===NM);});slideInd(".names",'[aria-checked="true"]');}
document.querySelectorAll(".names button").forEach(function(b){b.addEventListener("click",function(){
  if(NM===b.dataset.nm)return;NM=b.dataset.nm;store("nt-names",NM);applyNames();rerender(true);});});
// redraw everything that shows text (after a language or currency change), keeping the open stop
function rerender(lang){
  var sel=state.sel;applyStatic();renderCur();renderHeader();renderAll();renderStrip();markStrip();renderPrep();$("fitLabel").textContent=U(state.view==="day"?"全天":"全程");
  if(state.view==="day"){renderDay();if(sel!=null&&day()){state.sel=sel;paintOpen();}}
  if(lang){redrawMap();caption();document.dispatchEvent(new CustomEvent("trip:lang"));if(embed){var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();}}}
/* ---------- currency menu ---------- */
var CURS=[["local","kr","当地货币","Local currency"],["CAD","C$","加元","Canadian dollar"],["CNY","¥","人民币","Chinese yuan"],["USD","US$","美元","US dollar"]];
function renderCur(){
  var cur=CURS.filter(function(c){return c[0]===CUR;})[0];
  $("curSym").textContent=cur[1];$("curLabel").textContent=CUR==="local"?U("当地"):CUR;
  var h=CURS.map(function(c){var on=c[0]===CUR,sub;
    if(c[0]==="local")sub=U("按原价显示，不换算");
    else sub=FX&&FX[c[0]]?"1 "+c[1]+" ≈ "+(FX.ISK/FX[c[0]]).toFixed(c[0]==="CNY"?1:0)+" ISK":"";
    return '<button type="button" class="cur-opt" role="option" data-cur="'+c[0]+'" aria-selected="'+on+'">'+
      '<span class="cur-badge">'+esc(c[1])+'</span><span class="cur-txt"><b>'+esc(en()?c[3]:c[2])+(c[0]!=="local"?' <small>'+c[0]+"</small>":"")+"</b><small>"+esc(sub)+"</small></span>"+
      '<svg class="cur-check" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg></button>';}).join("");
  var when=FXAT?new Date(FXAT):null;
  h+='<div class="cur-foot">'+esc(when?U("汇率更新于 {d} · 约数",{d:cnDate(when.toISOString().slice(0,10))}):U("汇率为约数"))+"</div>";
  $("curMenu").innerHTML=h;}
function curOpen(on){var m=$("curMenu"),b=$("curBtn");if(on===!m.hidden)return;
  b.setAttribute("aria-expanded",on);$("curBox").classList.toggle("open",on);
  if(on){m.hidden=false;var sel=m.querySelector('[aria-selected="true"]');(sel||m).focus({preventScroll:true});}
  else{m.hidden=true;}}
function curPick(v){if(v!==CUR){CUR=v;store("nt-cur",CUR);rerender(false);}renderCur();curOpen(false);$("curBtn").focus();}
$("curBtn").addEventListener("click",function(){curOpen($("curMenu").hidden);});
$("curMenu").addEventListener("click",function(e){var o=e.target.closest(".cur-opt");if(o)curPick(o.dataset.cur);});
$("curMenu").addEventListener("keydown",function(e){var opts=[].slice.call(this.querySelectorAll(".cur-opt")),i=opts.indexOf(document.activeElement);
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();opts[(i+(e.key==="ArrowDown"?1:opts.length-1))%opts.length].focus();}
  else if(e.key==="Escape"){e.preventDefault();curOpen(false);$("curBtn").focus();}
  else if(e.key==="Tab")curOpen(false);});
$("curBtn").addEventListener("keydown",function(e){if(e.key==="ArrowDown"){e.preventDefault();curOpen(true);}});
document.addEventListener("pointerdown",function(e){if(!$("curBox").contains(e.target))curOpen(false);});

/* ---------- prep ---------- */
// The visa section follows the passport picked on this device ({p:"cn"|"ca", live:"ca"|"uk"|"cn"}). A Chinese
// passport's steps depend on where you live; a Canadian one's don't. Bookings tagged "who" (a passport like "cn",
// or a profile like "cn-ca") are hidden from everyone else unless they ask to see all.
var PASS=store("nt-passport")||{},SHOWALL=false;
function profile(){return PASS.p==="ca"?"ca":PASS.p==="cn"?"cn-"+(PASS.live||"ca"):null;}
function forMe(b){var pr=profile();return !b.who||!pr||b.who.indexOf(pr)>=0||b.who.indexOf(pr.split("-")[0])>=0;}
function shownBookings(){return SHOWALL?T.bookings:T.bookings.filter(forMe);}
function profLabel(k){var E=T.entry;return k==="ca"?L(E.passports.ca):U("{p} · 住在 {l}",{p:L(E.passports.cn),l:L(E.live[k.slice(3)])});}
function passportText(){var pr=profile();return pr?(pr==="ca"?"Canadian passport":"Chinese passport, lives in "+{ca:"Canada",uk:"the UK",cn:"China"}[PASS.live||"ca"]):"";}
function setPassport(p,live){PASS={p:p,live:live||PASS.live||"ca"};store("nt-passport",PASS);SHOWALL=false;renderPrep();renderHeader();}
function renderEntry(){
  var E=T.entry,pr=profile(),checked=store("nt-check")||{},shown=shownBookings();
  var h='<div class="tl-head"><h2>'+U("签证和入境")+'</h2><span class="hint">'+U("护照和勾选只保存在这台设备上")+'</span></div>';
  h+='<div class="entry-pick"><div class="pp" role="radiogroup" aria-label="'+U("护照")+'">'+["cn","ca"].map(function(k){
    return '<button type="button" role="radio" data-pp="'+k+'" aria-checked="'+(PASS.p===k)+'">'+esc(L(E.passports[k]))+"</button>";}).join("")+"</div>";
  h+='<label class="pp-live"'+(PASS.p==="cn"?"":" hidden")+'>'+U("住在")+'<span class="pp-sel"><select id="ppLive">'+Object.keys(E.live).map(function(k){
    return '<option value="'+k+'"'+((PASS.live||"ca")===k?" selected":"")+">"+esc(L(E.live[k]))+"</option>";}).join("")+"</select>"+ICON.chev+"</span></label></div>";
  if(!pr){
    h+='<div class="entry-card"><p class="entry-empty">'+U("选一下你的护照，只看跟你有关的签证和入境步骤。")+'</p><div class="entry-opts">'+Object.keys(E.profiles).map(function(k){
      return '<button type="button" data-prof="'+k+'"><b>'+esc(profLabel(k))+"</b><span>"+tx(E.profiles[k].head)+"</span></button>";}).join("")+"</div></div>";
    return h;
  }
  var P=E.profiles[pr];
  h+='<div class="entry-card'+(P.visa?" visa":"")+'"><div class="entry-top"><span class="entry-ic'+(P.visa?"":" free")+'">'+(P.visa?ICON.visa:ICON.free)+"</span><div><b>"+tx(P.head)+"</b><p>"+tx(P.sub)+"</p></div></div>";
  h+='<ol class="entry-steps">'+P.steps.map(function(st,i){var id="entry-"+pr+"-"+st.id,more=st.more?plain(st.more):"",long=more.length>140;
    var li='<li class="citem estep'+(st.hot?" hot":"")+'"><div class="citem-row"><label class="echeck"><input type="checkbox" data-id="'+esc(id)+'" data-n="'+(i+1)+'"'+(checked[id]?" checked":"")+">";
    li+='<span class="et">'+tx(st.t)+'</span><span class="ewhen">'+tx(st.when)+"</span></label>";
    if(long)li+='<button class="more-btn" type="button" aria-expanded="false" aria-label="'+U("展开说明")+'">'+ICON.chev.replace(' class="chev"',"")+"</button>";
    li+='</div><div class="ebody">';
    if(more)li+=long?'<p class="more" hidden>'+tx(st.more)+"</p>":'<p class="emore">'+tx(st.more)+"</p>";
    if(st.booking&&shown.some(function(b){return b.id===st.booking;}))li+='<button type="button" class="elink" data-open-booking="'+esc(st.booking)+'">'+U("查看预订")+" →</button>";
    return li+"</div></li>";}).join("")+"</ol></div>";
  var hid=T.bookings.length-T.bookings.filter(forMe).length;
  if(hid)h+='<p class="entry-foot">'+(SHOWALL?U("正在显示所有护照的预订")+' · <button type="button" data-showall="0">'+U("只看我的")+"</button>":
    U(hid===1?"已隐藏 1 项只适用于其他护照的预订":"已隐藏 {n} 项只适用于其他护照的预订",{n:hid})+' · <button type="button" data-showall="1">'+U("显示全部")+"</button>")+"</p>";
  return h;
}
function renderPrep(){
  var today=homeToday(),done=store("nt-booked")||{},nb=nextBooking(),shown=shownBookings();
  $("entry").innerHTML=renderEntry();
  $("bookings").innerHTML=shown.map(function(b){
    var badge,due="",isDone=!!done[b.id];
    if(b.opens){var dt=b.opens.slice(0,10),n=daysBetween(today,dt);badge="<small>"+(en()?MON[+dt.slice(5,7)-1]:(+dt.slice(5,7))+"月")+"</small><b>"+(+dt.slice(8,10))+"</b>";
      due=n>1?U("{n} 天后开放预订",{n:n}):n===1?U("明天开放预订"):n===0?U("今天开放预订"):U("现在可以订");}
    else{badge="<b>!</b><small>"+esc(b.badge?L(b.badge):U("尽早"))+"</small>";due=plain(b.when);}
    if(isDone){badge=ICON.check.replace("<svg",'<svg style="width:26px;height:26px;fill:none;stroke:#fff;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"');due=U("已订");}
    var h='<details class="booking'+(b.hot?" hot":"")+(isDone?" done":"")+'" id="bk-'+esc(b.id)+'"'+(nb&&nb.id===b.id?" open":"")+'>';
    h+='<summary><span class="b-date">'+badge+'</span><span class="b-title">'+tx(b.what)+'</span>';
    h+='<span class="b-line"><span class="due">'+esc(due)+'</span>'+[b.for,b.cost].filter(Boolean).map(function(x){return " · "+tx(x);}).join("")+'</span>';
    h+='<svg class="b-chev" viewBox="0 0 20 20"><path d="M5 8l5 5 5-5"/></svg></summary><div class="b-body">';
    if(b.summary)h+='<p>'+tx(b.summary)+"</p>";
    if(b.select&&b.select.length)h+='<ol class="select">'+b.select.map(function(x){return '<li><small>'+esc(L(x[0]))+'</small><b>'+tx(x[1])+'</b></li>';}).join("")+"</ol>";
    if(b.key&&b.key.length)h+='<dl class="keyfacts">'+b.key.map(function(f){return "<div><dt>"+esc(L(f[0]))+"</dt><dd>"+tx(f[1])+"</dd></div>";}).join("")+"</dl>";
    if(b.tip)h+='<p class="b-tip">'+tx(b.tip)+"</p>";
    var acts=[],link=(b.links||[])[0];
    if(link)acts.push('<a class="pill primary" target="_blank" rel="noopener" href="'+esc(link[1])+'">'+ICON.dir+U("打开 ")+esc(L(link[0]))+"</a>");
    (b.links||[]).slice(1).forEach(function(l){acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(l[1])+'">'+esc(L(l[0]))+"</a>");});
    acts.push('<button class="pill'+(isDone?" on":"")+'" type="button" data-done="'+esc(b.id)+'">'+ICON.check+U(isDone?"已订":"标记已订")+"</button>");
    acts.push('<button class="pill ask" type="button" data-ask="'+esc(b.id)+'">'+ICON.ask+U("问助手")+"</button>");
    h+='<div class="actions">'+acts.join("")+"</div>";
    if(b.steps&&b.steps.length)h+='<details class="allsteps"><summary>'+U("全部步骤")+'</summary><ol class="steps">'+b.steps.map(function(s){return "<li><span>"+tx(s)+"</span></li>";}).join("")+"</ol></details>";
    h+="</div></details>";
    return h;
  }).join("");
  var nDone=shown.filter(function(b){return done[b.id];}).length;
  $("bookedCount").textContent=U("已订 {a} / {b} · 勾选只保存在这台设备上",{a:nDone,b:shown.length});

  var checked=store("nt-check")||{};
  $("prepLists").innerHTML=T.prep.map(function(card,ci){
    var items=card.items.map(function(it,ii){var id=it.id||(card.id||ci)+"-"+ii;
      var h='<li class="citem"><div class="citem-row"><label class="check"><input type="checkbox" data-id="'+esc(id)+'"'+(checked[id]?" checked":"")+'><span>'+tx(it.t)+'</span></label>';
      if(it.more)h+='<button class="more-btn" type="button" aria-expanded="false" aria-label="'+U("展开说明")+'">'+ICON.chev.replace(' class="chev"',"")+"</button>";
      h+="</div>";if(it.more)h+='<p class="more" hidden>'+tx(it.more)+"</p>";
      return h+"</li>";}).join("");
    return '<div class="list-head"><h2>'+esc(L(card.title))+'</h2><small data-count="'+ci+'"></small></div><ul class="checklist" data-card="'+ci+'">'+items+'</ul>';
  }).join("");
  $("footnote").innerHTML=tx(T.footnote);
  $("sources").innerHTML=U("资料来源：")+T.sources.concat([[U("天气预报：Open-Meteo"),"https://open-meteo.com/"]]).map(function(s){return '<a href="'+esc(s[1])+'" target="_blank" rel="noopener">'+esc(L(s[0]))+'</a>';}).join(" · ");
  countPrep();
}
function countPrep(){var all=0,on=0;
  T.prep.forEach(function(card,ci){var c=0,list=document.querySelector('[data-card="'+ci+'"]');
    if(list)list.querySelectorAll("input").forEach(function(el){if(el.checked)c++;});
    all+=card.items.length;on+=c;var lab=document.querySelector('[data-count="'+ci+'"]');if(lab)lab.textContent=c+" / "+card.items.length;});
  $("entry").querySelectorAll("input[data-id]").forEach(function(el){all++;if(el.checked)on++;});
  var done=store("nt-booked")||{},shown=shownBookings(),b=shown.filter(function(x){return done[x.id];}).length;
  $("prepCount").textContent=(b+on)+"/"+(shown.length+all);}
$("prepView").addEventListener("change",function(e){if(e.target.id==="ppLive"){setPassport("cn",e.target.value);return;}var id=e.target.dataset&&e.target.dataset.id;if(!id)return;var d=store("nt-check")||{};d[id]=e.target.checked;store("nt-check",d);countPrep();});
$("prepView").addEventListener("click",function(e){
  var pp=e.target.closest("[data-pp]");if(pp){if(PASS.p!==pp.dataset.pp)setPassport(pp.dataset.pp);return;}
  var pf=e.target.closest("[data-prof]");if(pf){var k=pf.dataset.prof;setPassport(k==="ca"?"ca":"cn",k==="ca"?null:k.slice(3));return;}
  var sa=e.target.closest("[data-showall]");if(sa){SHOWALL=sa.dataset.showall==="1";renderPrep();return;}
  var ob=e.target.closest("[data-open-booking]");if(ob){openBooking(ob.dataset.openBooking);return;}
  var mb=e.target.closest(".more-btn");
  if(mb){var p=mb.closest(".citem").querySelector(".more"),on=mb.getAttribute("aria-expanded")!=="true";mb.setAttribute("aria-expanded",on);p.hidden=!on;return;}
  var dn=e.target.closest("[data-done]");
  if(dn){var d=store("nt-booked")||{},id=dn.dataset.done;d[id]=!d[id];store("nt-booked",d);renderPrep();renderHeader();var el=$("bk-"+id);if(el)el.open=true;return;}
  var ak=e.target.closest("[data-ask]");
  if(ak){var b=T.bookings.filter(function(x){return x.id===ak.dataset.ask;})[0];if(b&&window.tripChat)window.tripChat.ask(U("一步步教我怎么订「{w}」，有什么要注意的？",{w:plain(b.what)}));}
});
function openBooking(id){setView("prep");T.bookings.forEach(function(b){var el=$("bk-"+b.id);if(el)el.open=b.id===id;});
  var el=$("bk-"+id);if(el)el.scrollIntoView({block:"start",behavior:"smooth"});}

/* ---------- views ---------- */
function setView(v,date){
  var was={view:state.view,date:state.date};
  state.view=v;if(date)state.date=date;if(!state.date)state.date=T.dates.start;state.sel=null;
  store("nt-pos",{view:v,date:state.date});
  var hash=v==="day"?state.date:v;if(decodeURIComponent(location.hash.slice(1))!==hash)history.replaceState(null,"","#"+hash);
  document.querySelectorAll(".seg-btn").forEach(function(b){b.setAttribute("aria-selected",b.dataset.view===v?"true":"false");});
  $("daySub").textContent=md(state.date);
  $("top").hidden=v!=="all";$("allView").hidden=v!=="all";$("dayView").hidden=v!=="day";$("prepView").hidden=v!=="prep";$("stripWrap").hidden=v!=="day";
  $("fitLabel").textContent=U(v==="day"?"全天":"全程");
  markStrip();slideInd(".seg",'.seg-btn[aria-selected="true"]');
  // entrance animation: a new tab fades up; another day slides in from the side it came from
  if(was.view!==v||was.date!==state.date){var el=$({all:"allView",day:"dayView",prep:"prepView"}[v]);
    el.dataset.dir=was.view===v&&v==="day"?(state.date>was.date?"next":"prev"):"";
    el.classList.remove("enter");void el.offsetWidth;el.classList.add("enter");}
  if(v==="day"){renderDay();
    var D=day(),cur=D&&liveDate()===state.date?nowSeg():null;
    if(cur){select(cur.i,false);return;}}
  fitView();
}
document.querySelectorAll(".seg-btn").forEach(function(b){b.addEventListener("click",function(){setView(b.dataset.view);});});

/* ---------- one day ---------- */
function moveLabel(s,asText){var t=s.label||("[["+s.path[0]+"]] → [["+s.path[s.path.length-1]+"]]");return asText?plain(t):tx(t);}
function nowSeg(){var D=day(),t=nowIn(tzOf(state.date)).mins,segs=D.segs.filter(function(s){return s.start;}),best=null;if(!segs.length)return null;
  for(var i=0;i<segs.length;i++){var s=segs[i],e=s.end||s.start;if(t>=mins(s.start)&&t<=mins(e)){if(s.t==="stop"&&s.start!==e)return s;best=best||s;}}
  if(best)return best;if(t<mins(segs[0].start))return segs[0];return segs[segs.length-1];}
function renderDay(){
  var D=day(),d=state.date;
  var lg=legOf(d);
  $("dayTitle").innerHTML=cnDate(d)+" "+wk(d)+" · "+(D?tx(D.title):U("规划中"))+(D&&lg&&lg.draft?' <span class="leg-tag">'+U("草案")+'</span>':"");
  $("daySubtitle").innerHTML=D&&D.sub?tx(D.sub):"";
  var rt=D?(D.route||embedDayRoute(D)):null;
  $("dayRoute").href=rt&&rt.length>1?gRoute(rt,D.routeMode):"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(((T.countries[cOf(d)]||{}).en)||"Iceland");
  renderHero();renderGlance();renderRows();renderDayNav();
  var box=$("draftBox");
  if(D){box.hidden=true;return;}
  var l=legOf(d);box.hidden=false;
  // the leg's line for this date, e.g. "7/12 ..." or "7/17–7/18 ..."
  var mine=l&&(l.items||[]).filter(function(x){var m=x.match(/^(\d+)\/(\d+)(?:–(\d+)\/(\d+))?\s/);if(!m)return false;
    var a="2027-"+("0"+m[1]).slice(-2)+"-"+("0"+m[2]).slice(-2),b=m[3]?"2027-"+("0"+m[3]).slice(-2)+"-"+("0"+m[4]).slice(-2):a;return d>=a&&d<=b;})[0];
  box.innerHTML="<h3>"+U("这一天还在规划中")+"</h3>"+(mine?"<p><b>"+U("草案：")+tx(mine)+"</b></p>":"")+(l?"<p>"+U("属于「{l}」（{a} – {b}）。",{l:tx(l.title),a:cnDate(l.from),b:cnDate(l.to)})+(l.body?tx(l.body):"")+"</p>":"<p>"+U("还没排进任何路线分段。")+"</p>")+
    '<div class="actions"><button class="pill ask" type="button" id="draftAsk">'+ICON.ask+U("问助手这天可以怎么安排")+"</button></div>";
  $("draftAsk").addEventListener("click",function(){if(window.tripChat)window.tripChat.ask(U("{d}（{w}）还没排，按目前的路线，这天可以怎么安排？",{d:cnDate(d),w:wk(d)}));});
}
function renderRows(){
  var D=day(),ol=$("rows");ol.innerHTML="";if(!D)return;
  var cur=liveDate()===state.date?nowSeg():null;
  D.segs.forEach(function(s){
    var li=document.createElement("li");li.dataset.i=s.i;li.style.setProperty("--n",Math.min(s.i,14));if(cur&&cur.i===s.i)li.classList.add("now");
    var b=document.createElement("button");b.className="row"+(s.t==="move"?" move":"");b.setAttribute("aria-expanded","false");
    if(s.t==="move"){var dm=dur(s);
      b.innerHTML='<span class="t"></span><span class="num" title="'+esc(mode(s.mode))+'">'+(ICON[s.mode]||ICON.drive)+'</span><span class="n">'+(dm?esc(hm(dm))+" · ":"")+moveLabel(s)+"</span>"+ICON.chev;}
    else{b.style.setProperty("--k",KCOL[s.kind]||KCOL.visit);
      var bits=[s.start&&s.end&&s.start!==s.end?hm(dur(s)):s.mins?hm(s.mins):"",L(T.kinds[s.kind])].filter(Boolean).join(" · ");
      b.innerHTML='<span class="t">'+(s.start?esc(s.start):"")+'</span><span class="num">'+s.num+'</span><span class="n">'+tx(s.name||"[["+s.place+"]]")+(cur&&cur.i===s.i?'<span class="now-tag">'+U("现在")+'</span>':"")+"</span>"+ICON.chev+'<span class="s">'+esc(bits)+"</span>";}
    b.addEventListener("click",function(){if(state.sel===s.i){state.sel=null;paintOpen();markSel();fitView();}else select(s.i,true);});
    li.appendChild(b);ol.appendChild(li);
  });
}
function select(i,scroll){state.sel=i;paintOpen();var s=day().segs[i];
  markSel();frame(s);caption();
  if(scroll===false){var li=document.querySelector('#rows>li[data-i="'+i+'"]');if(li)li.scrollIntoView({block:"center"});}}
function paintOpen(){
  document.querySelectorAll("#rows>li").forEach(function(li){var i=+li.dataset.i,on=i===state.sel;
    li.classList.toggle("open",on);li.querySelector(".row").setAttribute("aria-expanded",on);
    var d=li.querySelector(".detail");if(on&&!d){li.appendChild(detail(day().segs[i]));}else if(!on&&d)d.remove();});
  document.dispatchEvent(new CustomEvent("trip:view"));
}
function detail(s){
  var d=document.createElement("div");d.className="detail";var kind=s.t==="move"?"move":s.kind;
  var when=s.start?(s.end&&s.end!==s.start?s.start+" – "+s.end:s.start):"";
  var phs=s.t==="stop"?photosOf(s.place):[],h="";
  if(phs.length)h+='<div class="d-photos n'+phs.length+'">'+phs.map(function(ph,k){return '<figure class="d-photo" data-k="'+k+'">'+img(ph,k?600:1200)+(k?"":"<figcaption>"+credit(ph)+"</figcaption>")+"</figure>";}).join("")+"</div>";
  else if(s.t==="stop"&&SCENIC[s.kind])h+='<div class="d-photos n1"><figure class="d-photo empty">'+tbd()+"</figure></div>";
  h+='<span class="kind" style="--k:'+(KCOL[kind]||KCOL.visit)+'">'+esc(s.t==="move"?mode(s.mode):L(T.kinds[kind])||"")+(when?" · "+esc(when):"")+(s.t==="move"&&s.km?U(" · 约 {n} 公里",{n:s.km}):"")+'</span>';
  if(s.facts&&s.facts.length)h+='<dl class="facts">'+s.facts.map(function(f){return "<div><dt>"+esc(L(f[0]))+"</dt><dd>"+tx(f[1])+"</dd></div>";}).join("")+"</dl>";
  var body=s.body||s.note;if(body)h+='<p class="body">'+tx(body)+"</p>";
  if(s.tips&&s.tips.length)h+='<ul class="tips">'+s.tips.map(function(t){return "<li>"+tx(t)+"</li>";}).join("")+"</ul>";
  var acts=[];
  if(s.t==="stop")acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(gPlace(s.place))+'">'+ICON.maps+U("在 Google 地图打开")+"</a>");
  if(s.t==="move"&&(s.mode==="drive"||s.mode==="walk"||s.mode==="bike"||s.mode==="train"||s.mode==="bus")){var ends=[s.path[0],s.path[s.path.length-1]].filter(function(x){return typeof x==="string";});
    if(ends.length===2)acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(gRoute(s.path.filter(function(x){return typeof x==="string";}),s.mode==="drive"?"driving":s.mode==="walk"?"walking":s.mode==="bike"?"bicycling":"transit"))+'">'+ICON.dir+U("导航")+"</a>");}
  acts.push('<button class="pill ask" type="button">'+ICON.ask+U("问问这个")+"</button>");
  h+='<div class="actions">'+acts.join("")+"</div>";
  d.innerHTML=h;
  d.querySelectorAll(".d-photo[data-k]").forEach(function(fig){fig.addEventListener("click",function(e){if(e.target.closest(".credit"))return;
    var g=dayGallery(day()),ph=phs[+fig.dataset.k];if(!g.length)g=phs.map(function(p){return {s:s,ph:p};});openLb(g,galleryIndex(g,ph));});});
  d.querySelector(".ask").addEventListener("click",function(){
    var q=s.t==="move"?U("{w} 这段{m}有什么要注意的？",{w:moveLabel(s,true),m:mode(s.mode)}):U("多讲讲「{w}」，有什么要注意的？",{w:plain(s.name||"[["+s.place+"]]")});
    if(window.tripChat)window.tripChat.ask(q);});
  return d;
}

// previous / next day at the end of the timeline
function renderDayNav(){var i=DATES.indexOf(state.date),h="";
  [[i-1,"prev","‹ "+U("前一天")],[i+1,"next",U("后一天")+" ›"]].forEach(function(x){var d=DATES[x[0]];
    if(!d){h+="<span></span>";return;}
    h+='<button type="button" class="dn '+x[1]+'" data-date="'+d+'" style="--c:'+colorOf(d)+'"><small>'+esc(x[2])+" · "+md(d)+" "+wk(d)+"</small><b>"+esc(dayLabel(d))+"</b></button>";});
  $("dayNav").innerHTML=h;}
$("dayNav").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b){setView("day",b.dataset.date);window.scrollTo({top:Math.min(scrollY,$("dayView").offsetTop-130),behavior:"smooth"});}});
// swipe left / right on the day view (phones) changes the day
(function(){var x0=null,y0=0;
  $("dayView").addEventListener("touchstart",function(e){var t=e.touches[0];x0=t.clientX;y0=t.clientY;},{passive:true});
  $("dayView").addEventListener("touchend",function(e){if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>70&&Math.abs(dy)<45)$(dx<0?"nextDay":"prevDay").click();},{passive:true});})();

/* ---------- motion helpers ---------- */
// the highlight pill under the selected tab (or language) slides to it
function slideInd(box,sel){var c=document.querySelector(box),b=c&&c.querySelector(sel);if(!b)return;
  var ind=c.querySelector(".ind");if(!ind){ind=document.createElement("span");ind.className="ind";ind.setAttribute("aria-hidden","true");c.prepend(ind);}
  ind.style.width=b.offsetWidth+"px";ind.style.height=b.offsetHeight+"px";ind.style.transform="translate("+b.offsetLeft+"px,"+b.offsetTop+"px)";}
window.addEventListener("resize",function(){slideInd(".seg",'.seg-btn[aria-selected="true"]');slideInd(".names",'[aria-checked="true"]');});
// the sticky bar gets a soft shadow once the page scrolls under it
(function(){var st=$("sticky"),on=null;function f(){var v=scrollY>8;if(v!==on){on=v;st.classList.toggle("stuck",v);}}addEventListener("scroll",f,{passive:true});f();})();
// re-run a CSS entrance animation on an element
function replay(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}

/* ---------- photos ---------- */
// Up to three photos per place from Unsplash (places[id].photos: src = the photo's raw URL, w, h, author,
// author_link, page, alt), each checked by eye against reference photos of the place. Unsplash serves any
// width from the same URL; the credit links the photographer and Unsplash, as its API guidelines ask.
// Scenic stops still waiting for photos show a grey "TBD" tile.
var SCENIC={visit:1,hike:1,glacier:1,water:1,camp:1,city:1};
var UTM="utm_source=nordic_trip_2027&utm_medium=referral";
function photosOf(id){var p=T.places[id];return p&&p.photos||[];}
function sized(src,w){if(src.indexOf("images.unsplash.com")<0)return src.replace(/\/(\d+)px-/,"/"+w+"px-");
  var u=src.replace(/([?&])(w|q|fm|fit|auto)=[^&]*/g,"$1").replace(/&&+/g,"&").replace(/[?&]+$/,"");
  return u+(u.indexOf("?")<0?"?":"&")+"w="+w+"&q=80&fm=jpg&fit=max";}
function img(ph,w,cls){return '<img class="'+(cls||"")+'" src="'+esc(sized(ph.src,w))+'" width="'+ph.w+'" height="'+ph.h+'" alt="'+esc(ph.alt||"")+'" loading="lazy" decoding="async" onload="this.classList.add(\'ok\')">';}
function utm(u){return u+(u.indexOf("?")<0?"?":"&")+UTM;}
function credit(ph){
  if(ph.author_link)return '<span class="credit">'+esc(U("摄影："))+'<a href="'+esc(utm(ph.author_link))+'" target="_blank" rel="noopener">'+esc(ph.author)+'</a> / <a href="'+esc(utm("https://unsplash.com/"))+'" target="_blank" rel="noopener">Unsplash</a></span>';
  return '<a class="credit" href="'+esc(ph.page)+'" target="_blank" rel="noopener">'+esc(U("照片："))+esc(ph.author||"")+(ph.license?" · "+esc(ph.license):"")+"</a>";}
function tbd(cls){return '<span class="tbd'+(cls?" "+cls:"")+'"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/></svg><span>'+esc(U("照片待定"))+"</span></span>";}
// one entry per scenic stop of the day (photo = its first one, or none yet)
function dayStops(D){var seen={},out=[];if(!D)return out;
  D.segs.forEach(function(s){if(s.t==="stop"&&SCENIC[s.kind]&&!seen[s.place]){seen[s.place]=1;out.push({s:s,ph:photosOf(s.place)[0]||null});}});return out;}
// every photo of the day, for the full-screen viewer
function dayGallery(D){var out=[];dayStops(D).forEach(function(x){photosOf(x.s.place).forEach(function(ph){out.push({s:x.s,ph:ph});});});return out;}
function galleryIndex(list,ph){for(var i=0;i<list.length;i++)if(list[i].ph===ph)return i;return 0;}
// the day's banner: D.hero if set, else its first nature stop with a photo, else any photo
function heroOf(D){var ps=dayStops(D).filter(function(x){return x.ph;});if(!ps.length)return null;
  if(D.hero){var h=ps.filter(function(x){return x.s.place===D.hero;})[0];if(h)return h;}
  return ps.filter(function(x){return x.s.kind!=="city";})[0]||ps[0];}
function legPhotos(l){var seen={},out=[],ds=T.days.filter(function(D){return D.date>=l.from&&D.date<=l.to;});
  function add(x){if(x&&x.ph&&!seen[x.s.place]){seen[x.s.place]=1;out.push(x);}}
  ds.forEach(function(D){add(heroOf(D));});ds.forEach(function(D){dayStops(D).forEach(add);});return out;}
function renderHero(){
  var D=day(),box=$("hero"),st=dayStops(D),h=D&&heroOf(D);
  if(!st.length){box.hidden=true;box.innerHTML="";return;}
  box.hidden=false;
  var html=h?'<figure class="hero-fig" data-lb="1">'+img(h.ph,1600,"hero-img")+'<figcaption><b>'+tx(h.s.name||"[["+h.s.place+"]]")+"</b>"+credit(h.ph)+"</figcaption></figure>"
           :'<figure class="hero-fig empty">'+tbd("big")+"</figure>";
  if(st.length>1)html+='<div class="hero-thumbs">'+st.map(function(x){
    return '<button type="button" class="ht'+(h&&x.s.place===h.s.place?" on":"")+'" data-i="'+x.s.i+'" title="'+esc(plain(x.s.name||"[["+x.s.place+"]]"))+'">'+(x.ph?img(x.ph,400):tbd("mini"))+"<span>"+x.s.num+"</span></button>";}).join("")+"</div>";
  box.innerHTML=html;}
$("hero").addEventListener("click",function(e){
  var t=e.target.closest(".ht");if(t){select(+t.dataset.i,false);return;}
  if(e.target.closest(".credit"))return;
  if(e.target.closest("[data-lb]")){var D=day(),g=dayGallery(D);openLb(g,galleryIndex(g,heroOf(D).ph));}});

/* lightbox: a photo full screen; arrows and swipe step through the photos it was opened with */
var LB={list:[],i:0};
function openLb(list,i){if(!list.length)return;LB.list=list;LB.i=i;showLb();$("lb").hidden=false;document.body.classList.add("lb-open");$("lbClose").focus();}
function closeLb(){$("lb").hidden=true;document.body.classList.remove("lb-open");}
function showLb(){var x=LB.list[LB.i];if(!x)return;var im=$("lbImg");im.classList.remove("ok");im.onload=function(){im.classList.add("ok");};
  im.src=sized(x.ph.src,2000);im.alt=x.ph.alt||"";
  $("lbCap").innerHTML="<b>"+tx(x.s.name||"[["+x.s.place+"]]")+"</b>"+credit(x.ph)+(LB.list.length>1?'<span class="lb-n">'+(LB.i+1)+" / "+LB.list.length+"</span>":"");
  $("lbPrev").hidden=$("lbNext").hidden=LB.list.length<2;}
function stepLb(d){LB.i=(LB.i+d+LB.list.length)%LB.list.length;showLb();}
$("lbClose").addEventListener("click",closeLb);$("lbPrev").addEventListener("click",function(){stepLb(-1);});$("lbNext").addEventListener("click",function(){stepLb(1);});
$("lb").addEventListener("click",function(e){if(e.target===this||e.target.classList.contains("lb-fig"))closeLb();});
document.addEventListener("keydown",function(e){if($("lb").hidden)return;
  if(e.key==="Escape"){e.preventDefault();closeLb();}else if(e.key==="ArrowLeft"){e.preventDefault();e.stopImmediatePropagation();stepLb(-1);}else if(e.key==="ArrowRight"){e.preventDefault();e.stopImmediatePropagation();stepLb(1);}},true);
(function(){var x0=null;$("lb").addEventListener("touchstart",function(e){x0=e.touches[0].clientX;},{passive:true});
  $("lb").addEventListener("touchend",function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)stepLb(dx<0?1:-1);},{passive:true});})();

/* ---------- day at a glance ---------- */
function wxPlace(d){var D=BYDATE[d];var id=D&&(D.wx||D.stay);if(id&&T.places[id])return id;var l=legOf(d);return l&&l.wx;}
function loadWeather(d){
  var id=wxPlace(d);if(!id||weather[d]!==undefined)return;var dd=daysBetween(homeToday(),d);if(dd<0||dd>15){weather[d]=null;return;}
  weather[d]="loading";var ll=N[id];
  fetch("https://api.open-meteo.com/v1/forecast?latitude="+ll[0]+"&longitude="+ll[1]+"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date="+d+"&end_date="+d)
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(j){var x=j.daily;weather[d]={code:x.weather_code[0],hi:x.temperature_2m_max[0],lo:x.temperature_2m_min[0],rain:x.precipitation_probability_max[0],wind:x.wind_speed_10m_max[0]};})
    .catch(function(){weather[d]=null;})
    .then(function(){if(state.view==="day"&&state.date===d)renderGlance();});
}
function renderGlance(){
  var d=state.date,D=day(),id=wxPlace(d),c=T.countries[cOf(d)]||{};loadWeather(d);
  var w=weather[d],h="",dd=daysBetween(homeToday(),d),clim=(id&&T.places[id].climate)||c.climate;
  if(w&&w!=="loading"&&w.hi!=null){var k=wmo(w.code);
    h+='<div class="wx"><span class="wx-icon">'+WX[k[1]]+'</span><div><div class="wx-temp">'+Math.round(w.hi)+'°<small> / '+Math.round(w.lo)+'°</small></div>'+
       '<div class="wx-desc">'+k[0]+(w.rain!=null?U(" · 降水概率 {n}%",{n:w.rain}):"")+'</div><div class="wx-meta">'+U("风速最高 {n} m/s",{n:Math.round(w.wind/3.6)})+' · '+(id?pn(id):"")+'</div></div></div>';}
  else if(clim){
    h+='<div class="wx"><span class="wx-icon">'+WX.part+'</span><div><div class="wx-temp">'+clim.hi+'°<small> / '+clim.lo+'°</small></div>'+
       '<div class="wx-desc">'+U("7 月常年")+(clim.rain?U(" · 约 {n} 天有雨",{n:clim.rain}):"")+'</div><div class="wx-meta">'+(w==="loading"?U("正在载入预报…"):dd>15?U("出发前约 16 天出现预报"):"")+(id?" · "+pn(id):"")+'</div></div></div>';}
  else h+='<div class="wx"><span class="wx-icon">'+WX.part+'</span><div><div class="wx-temp" style="font-size:18px">'+U(dd>15?"出发前约 16 天出现预报":"暂无预报")+'</div></div></div>';
  var segs=D?D.segs:[],move=0,byMode={},out=0;
  segs.forEach(function(s){var m=dur(s);if(s.t==="move"){move+=m;byMode[s.mode]=(byMode[s.mode]||0)+m;}else if(OUTDOORS[s.kind])out+=m;});
  var modeTxt=Object.keys(byMode).map(function(k){return mode(k)+" "+hmS(byMode[k]);}).join(" · ");
  var sun=id?sunTimes(d,N[id][0],N[id][1],tzOf(d)):null,stay=D&&D.stay?D.stay:null;
  h+='<dl class="stats">'+
    '<div class="stat"><dt>'+U("交通")+'</dt><dd>'+(D?hm(move):"—")+'</dd><span class="sub">'+esc(modeTxt||U(D?"不挪地方":"规划中"))+'</span></div>'+
    '<div class="stat"><dt>'+U("户外")+'</dt><dd>'+(D?hm(out):"—")+'</dd><span class="sub">'+U("景点、徒步、冰川、逛城")+'</span></div>'+
    '<div class="stat"><dt>'+U("住宿")+'</dt><dd class="txt">'+(stay?pn(stay):"—")+'</dd><span class="sub">'+esc(D&&D.stayNote?plain(D.stayNote):"")+'</span></div>'+
    '<div class="stat"><dt>'+U("日落")+'</dt><dd>'+(sun?(sun.polar==="day"?U("极昼"):sun.set):"—")+'</dd><span class="sub">'+(sun&&sun.rise?U("日出 {r} · 日照 {l}",{r:sun.rise,l:hmS(sun.len)}):"")+'</span></div></dl>';
  if(D&&liveDate()===d){var t=nowIn(tzOf(d)).mins,cur=nowSeg(),nx=segs.filter(function(s){return s.t==="stop"&&s.start&&mins(s.start)>t;})[0];
    if(cur)h+='<div class="nownext"><span><b>'+U("现在")+'</b>'+(cur.t==="move"?esc(mode(cur.mode))+" "+moveLabel(cur):tx(cur.verb||cur.name||"[["+cur.place+"]]"))+'</span>'+
      (nx?'<span><b>'+U("下一站")+'</b>'+tx(nx.name||"[["+nx.place+"]]")+" "+esc(nx.start)+U("（{t}后）",{t:hm(mins(nx.start)-t)})+"</span>":"")+"</div>";}
  $("glance").innerHTML=h;
}

/* ---------- map ---------- */
var G=null,map=null,Marker=null,lines=[],markers=[],you=null,embed=null;
function caption(){var D=day(),s=state.view==="day"&&D&&state.sel!=null?D.segs[state.sel]:null,old=$("mapCaption").textContent;
  setTimeout(function(){if($("mapCaption").textContent!==old)replay($("mapCaption"),"pop");});
  $("mapCaption").textContent=s?(s.t==="move"?moveLabel(s,true):s.num+". "+plain(s.name||"[["+s.place+"]]")):(state.view==="day"?U("{d}：全天",{d:md(state.date)+" "+(D?plain(D.short||D.title):U("规划中"))}):U("全程路线"));}

// A bad or missing key drops back to Google's keyless embed (one place or one route at a time).
window.gm_authFailure=function(){console.warn("Google Maps rejected googleMapsKey in config.js; using the basic embed instead.");useEmbed();};
function useEmbed(){
  if(embed)return;map=null;you=null;markers=[];lines=[];
  var box=$("map");box.innerHTML="";
  embed=document.createElement("iframe");embed.title=U("Google 地图");embed.setAttribute("allowfullscreen","");box.appendChild(embed);
  var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
}
function embedTo(src){if(embed&&embed.getAttribute("src")!==src)embed.setAttribute("src",src);}
function ll2(p){return p[0]+","+p[1];}
function embedPlace(ll,z){embedTo("https://maps.google.com/maps?q="+ll2(ll)+"&z="+z+"&hl="+(NM==="zh"?"zh-CN":"en")+"&output=embed");}
function embedRoute(stops){embedTo("https://maps.google.com/maps?saddr="+ll2(stops[0])+"&daddr="+stops.slice(1).map(ll2).join("+to:")+"&hl="+(NM==="zh"?"zh-CN":"en")+"&output=embed");}
function embedArea(q,z){embedTo("https://maps.google.com/maps?q="+encodeURIComponent(q)+"&z="+z+"&hl="+(NM==="zh"?"zh-CN":"en")+"&output=embed");}

function loadMap(){
  caption();
  if(!CFG.googleMapsKey){useEmbed();return;}
  var params={v:"weekly",key:CFG.googleMapsKey,language:"zh-CN"};
  // Google's dynamic library loader (inline bootstrap from the Maps JS docs).
  (function(g){var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=function(){return h||(h=new Promise(function(f,n){a=m.createElement("script");e.set("libraries",Array.from(r)+"");for(k in g)e.set(k.replace(/[A-Z]/g,function(t){return "_"+t[0].toLowerCase();}),g[k]);e.set("callback",c+".maps."+q);a.src="https://maps."+c+"apis.com/maps/api/js?"+e;d[q]=f;a.onerror=function(){h=n(Error(p+" could not load."));};m.head.append(a);}));};d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=function(f){var rest=Array.prototype.slice.call(arguments,1);return r.add(f)&&u().then(function(){return d[l].apply(d,[f].concat(rest));});};})(params);
  Promise.all([google.maps.importLibrary("maps"),google.maps.importLibrary("marker"),google.maps.importLibrary("core")]).then(function(libs){
    if(embed)return;
    G=google.maps;Marker=libs[1].AdvancedMarkerElement;
    map=new libs[0].Map($("map"),{
      center:{lat:62,lng:5},zoom:4,mapId:CFG.googleMapId||"DEMO_MAP_ID",
      disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:G.ControlPosition.RIGHT_BOTTOM},
      clickableIcons:false,gestureHandling:wide.matches?"greedy":"cooperative",
      colorScheme:G.ColorScheme?G.ColorScheme.FOLLOW_SYSTEM:undefined
    });
    redrawMap();
    var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
  }).catch(function(e){console.warn(e);useEmbed();});
}

function bounds(pts){var b=new G.LatLngBounds();pts.forEach(function(p){b.extend({lat:p[0],lng:p[1]});});return b;}
function fitPts(pts,maxZoom){if(!map||!pts.length)return;
  if(pts.length===1){map.panTo({lat:pts[0][0],lng:pts[0][1]});map.setZoom(maxZoom||13);return;}
  map.fitBounds(bounds(pts),{top:60,right:30,bottom:50,left:30});
  if(maxZoom)G.event.addListenerOnce(map,"idle",function(){if(map.getZoom()>maxZoom)map.setZoom(maxZoom);});}
function dayPts(D){var a=[];D.segs.forEach(function(s){if(s.t==="move"&&s.mode==="flight")return;if(s.pts)a=a.concat(s.pts);else if(s.place)a.push(LL(s.place));});return a;}
function allPts(){var a=[];T.days.forEach(function(D){a=a.concat(dayPts(D));});T.legs.forEach(function(l){if(l.wx&&N[l.wx])a.push(N[l.wx]);});return a;}
// Stops of a day in order, for the keyless embed and the directions link. Google can't route across
// a flight, ferry or train, so the day splits there and the part with the most stops is used.
var ROADS={drive:1,walk:1,bike:1};
function embedDayRoute(D){if(D.route)return D.route.map(LL);var groups=[[]];
  D.segs.forEach(function(s){var g=groups[groups.length-1];
    if(s.t==="move"&&!ROADS[s.mode]){groups.push([]);g=groups[groups.length-1];add(g,s.path[s.path.length-1]);return;}
    (s.t==="move"?[s.path[0],s.path[s.path.length-1]]:[s.place]).forEach(function(x){add(g,x);});});
  function add(g,x){if(typeof x==="string"&&g[g.length-1]!==x)g.push(x);}
  var best=groups.reduce(function(a,g){return g.length>a.length?g:a;},[]);
  return best.slice(0,10).map(LL);}
function fitView(){
  caption();redrawMap();var D=day();
  if(embed){
    if(state.view!=="day"){var l=legOf(state.date)||T.legs[0],c=T.countries[l.c]||{};embedArea(c.en||"Iceland",c.zoom||5);return;}
    if(!D){var lw=wxPlace(state.date);if(lw)embedPlace(N[lw],7);else{var cc=T.countries[cOf(state.date)]||{};embedArea(cc.en||"Iceland",cc.zoom||5);}return;}
    var r=embedDayRoute(D);if(r.length>1)embedRoute(r);else embedPlace(LL(D.stay||D.wx||(D.segs[0]||{}).place),10);return;}
  if(state.view!=="day"){fitPts(allPts());return;}
  if(!D){var p=wxPlace(state.date);fitPts(p?[N[p]]:allPts(),7);return;}
  fitPts(dayPts(D),13);}
function frame(s){
  if(embed){if(s.t==="move"){var ids=s.path.filter(function(x){return typeof x==="string";});
      if(s.mode==="drive"&&ids.length>1)embedRoute(ids.map(LL));else embedPlace(LL(ids[ids.length-1]),s.mode==="flight"?6:9);}
    else embedPlace(LL(s.place),s.zoom||14);return;}
  if(!map)return;
  if(s.pts&&s.pts.length>1)fitPts(s.pts,s.t==="move"?13:15);else fitPts([LL(s.place)],s.zoom||14);}
$("fitBtn").addEventListener("click",function(){if(state.view==="day"&&state.sel!=null){state.sel=null;paintOpen();markSel();}fitView();});

var drawnFor=null;
// flights are drawn as great circles between their two airports
function gc(a,b,n){var r=Math.PI/180,la1=a[0]*r,lo1=a[1]*r,la2=b[0]*r,lo2=b[1]*r,out=[];
  var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((la2-la1)/2),2)+Math.cos(la1)*Math.cos(la2)*Math.pow(Math.sin((lo2-lo1)/2),2)));if(!d)return [a,b];
  for(var i=0;i<=n;i++){var f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
    var x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2),y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2),z=A*Math.sin(la1)+B*Math.sin(la2);
    out.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r,Math.atan2(y,x)/r]);}return out;}
function line(pts,opts){var l=new G.Polyline(Object.assign({map:map,path:pts.map(function(p){return {lat:p[0],lng:p[1]};})},opts));lines.push(l);return l;}
function moveLine(s,col,strong,pick){
  var pts=s.mode==="flight"?gc(s.pts[0],s.pts[s.pts.length-1],48):s.pts;
  if(s.mode==="flight"||s.mode==="ferry"){var l=line(pts,{strokeOpacity:0,icons:[{icon:{path:"M 0,-1 0,1",strokeOpacity:strong?1:.45,strokeColor:col,strokeWeight:strong?3:2,scale:3},offset:"0",repeat:s.mode==="flight"?"12px":"9px"}]});if(pick)l.addListener("click",pick);return;}
  if(strong)line(pts,{strokeColor:"#ffffff",strokeOpacity:.9,strokeWeight:8,clickable:false});
  var l2=line(pts,{strokeColor:col,strokeOpacity:strong?1:.45,strokeWeight:strong?4.5:2.5,clickable:!!pick});if(pick)l2.addListener("click",pick);}
function redrawMap(){
  if(!map)return;var key=state.view==="day"?state.date+NM:"all"+NM;if(drawnFor===key)return;drawnFor=key;
  lines.forEach(function(l){l.setMap(null);});lines=[];markers.forEach(function(m){m.map=null;});markers=[];
  var D=state.view==="day"?day():null;
  T.days.forEach(function(X){var col=(T.countries[X.c]||{}).color||"#5D6B73",mine=D===X;
    X.segs.forEach(function(s){if(s.t!=="move"||!s.pts||s.pts.length<2)return;
      moveLine(s,mine?"#C9711C":col,mine||!D,mine?function(){select(s.i);}:function(){setView("day",X.date);});});
    if(mine)X.segs.forEach(function(s){if(s.t==="stop"&&s.pts&&s.pts.length>1)line(s.pts,{strokeOpacity:0,icons:[{icon:{path:G.SymbolPath.CIRCLE,scale:2.6,fillColor:"#3D7A4F",fillOpacity:1,strokeColor:"#fff",strokeWeight:1},offset:"0",repeat:"10px"}]}).addListener("click",function(){select(s.i);});});});
  if(D){ // one marker per place; several stops at the same place share it ("3·9")
    var groups={};D.segs.forEach(function(s){if(s.t!=="stop")return;(groups[s.place]=groups[s.place]||[]).push(s);});
    Object.keys(groups).forEach(function(pl){var stops=groups[pl];
      addMarker(N[pl],stops.map(function(s){return s.num;}).join("·"),KCOL[stops[0].kind]||KCOL.visit,plain(stops[0].name||"[["+pl+"]]"),function(m){
        var cur=state.sel!=null?D.segs[state.sel]:null,idx=stops.indexOf(cur),next=stops[(idx+1)%stops.length];
        select(next.i);var li=document.querySelector('#rows>li[data-i="'+next.i+'"]');if(li)li.scrollIntoView({block:"nearest",behavior:"smooth"});}).stops=stops;});
  }else{ // overview: where you sleep each night
    var stays={};T.days.forEach(function(X){if(X.stay)(stays[X.stay]=stays[X.stay]||[]).push(X);});
    Object.keys(stays).forEach(function(pl){var ds=stays[pl];
      addMarker(N[pl],ds.length>2?md(ds[0].date)+"–"+md(ds[ds.length-1].date):ds.map(function(X){return md(X.date);}).join("·"),(T.countries[ds[0].c]||{}).color,pn(pl,true),function(){setView("day",ds[0].date);});});}
  if(you){you.map=null;you=null;}
  if(D&&liveDate()===state.date){var cur=nowSeg();if(cur){var t=nowIn(tzOf(state.date)).mins,a=mins(cur.start),b=mins(cur.end||cur.start);
    var pos=cur.pts&&cur.pts.length>1?along(cur.pts,b>a?(t-a)/(b-a):1):LL(cur.place);
    var yd=document.createElement("div");yd.className="you";var tag=document.createElement("span");tag.className="you-tag";tag.textContent=U("按计划现在在这");yd.appendChild(tag);
    you=new Marker({map:map,position:{lat:pos[0],lng:pos[1]},content:yd,zIndex:1000});}}
  markSel();
}
function addMarker(ll,badgeTxt,col,nameTxt,onClick){
  var el=document.createElement("div");el.className="mk";el.style.setProperty("--k",col||"#1F4E6B");
  var badge=document.createElement("span");badge.className="mk-badge";badge.textContent=badgeTxt;
  var name=document.createElement("span");name.className="mk-name";name.textContent=nameTxt;el.append(badge,name);
  var m=new Marker({map:map,position:{lat:ll[0],lng:ll[1]},content:el,title:nameTxt,gmpClickable:true});
  m.el=el;m.nameEl=name;m.addEventListener("gmp-click",function(){onClick(m);});markers.push(m);return m;}
function markSel(){var D=day(),sel=state.view==="day"&&D&&state.sel!=null&&D.segs[state.sel];
  markers.forEach(function(m){var on=!!(sel&&m.stops&&m.stops.indexOf(sel)>=0);m.el.classList.toggle("sel",on);if(on)m.nameEl.textContent=plain(sel.name||"[["+sel.place+"]]");m.zIndex=on?999:null;});}

/* ---------- start ---------- */
applyStatic();
// English translations are optional: a missing or broken file just leaves those lines in Chinese
Promise.all([
  fetch("trip.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}),
  fetch("i18n/en.json",{cache:"no-cache"}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};})
]).then(function(x){EN=x[1]||{};boot(x[0]);}).catch(function(e){
  console.error(e);$("lede").textContent=U("行程没载入（{e}）。如果是直接从硬盘打开的 index.html，请改用本地服务器：python3 -m http.server",{e:e.message});
});
})();
