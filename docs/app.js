(function(){
"use strict";
/* Nordic Trip 2027 — Tailored Nordic Cards & Route Planner
 * Views: Overview (#all), Itinerary / Day (#YYYY-MM-DD), Photos (#photos), Prep (#prep), Ledger (#money).
 * Combines clean Inter + JetBrains Mono typography with structured 8-10px cards,
 * country-colored route ribbon & map polylines, photo-topped 4-week calendar,
 * highlights strip, weather/glance card, color-coded timeline badges, and boarding-pass flight blocks.
 */

var CFG=window.TRIP_CONFIG||{};
var wide=window.matchMedia?matchMedia("(min-width: 821px)"):{matches:true};
var OUTDOORS={hike:1,glacier:1,visit:1,sight:1,water:1,city:1};
var SCENIC={visit:1,sight:1,hike:1,glacier:1,water:1,camp:1,city:1};
var WK=["周日","周一","周二","周三","周四","周五","周六"],WKEN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MODE={drive:"开车",flight:"航班",ferry:"渡轮",train:"火车",bus:"巴士",walk:"步行",bike:"骑行"};
var MODEEN={drive:"drive",flight:"flight",ferry:"ferry",train:"train",bus:"bus",walk:"walk",bike:"bike"};

/* Activity / stop kind colors (--k) */
var KCOL={
  visit:"#25638a",
  sight:"#25638a",
  hike:"#2b7a52",
  glacier:"#2882a6",
  water:"#237a82",
  city:"#6f4e96",
  food:"#c46816",
  meal:"#c46816",
  shop:"#c46816",
  stay:"#526470",
  camp:"#4d7c32",
  start:"#526470",
  move:"#526470"
};

/* ---------- Small Utilities ---------- */
var $=function(id){return document.getElementById(id);};
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function pad2(n){return (n<10?"0":"")+n;}
function mins(s){var p=s.split(":");return +p[0]*60+ +p[1];}
function fmt(m){m=Math.round(m);var h=Math.floor(m/60)%24,mm=m%60;return pad2(h)+":"+pad2(mm);}
function hm(d){var h=Math.floor(d/60),m=d%60;if(en())return ((h?h+"h ":"")+(m?m+"m":"")).trim()||"0m";return ((h?h+" 小时 ":"")+(m?m+" 分":"")).trim()||"0 分";}
function hmS(d){var h=Math.floor(d/60),m=d%60;return h?h+"h"+(m?"\u00a0"+pad2(m)+"m":""):m+"m";}
function decode(s){var pts=[],i=0,lat=0,lng=0;while(i<s.length){for(var n=0;n<2;n++){var sh=0,r=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5;}while(b>=32);var v=r&1?~(r>>1):r>>1;if(n)lng+=v;else lat+=v;}pts.push([lat/1e5,lng/1e5]);}return pts;}
function km(a,b){var k=Math.cos((a[0]+b[0])/2*Math.PI/180);return Math.hypot((a[0]-b[0])*111.2,(a[1]-b[1])*111.32*k);}
function along(pts,f){
  if(!pts||pts.length<2)return pts&&pts[0];
  var seg=[],tot=0;
  for(var i=1;i<pts.length;i++){var d=km(pts[i-1],pts[i]);seg.push(d);tot+=d;}
  var t=Math.max(0,Math.min(1,f))*tot;
  for(var j=0;j<seg.length;j++){
    if(t<=seg[j]||j===seg.length-1){var u=seg[j]?Math.min(1,t/seg[j]):0,a=pts[j],b=pts[j+1];return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}
    t-=seg[j];
  }
  return pts[pts.length-1];
}
function nowIn(tz){var p={};new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
  return {date:p.year+"-"+p.month+"-"+p.day,mins:+p.hour*60+ +p.minute};}
function homeToday(){return nowIn("America/Toronto").date;}
function daysBetween(a,b){return Math.round((Date.parse(b+"T12:00:00Z")-Date.parse(a+"T12:00:00Z"))/864e5);}
function addDays(d,n){return new Date(Date.parse(d+"T12:00:00Z")+n*864e5).toISOString().slice(0,10);}
function wkday(d){return new Date(d+"T12:00:00Z").getUTCDay();}
function md(d){return (+d.slice(5,7))+"/"+(+d.slice(8,10));}
function mdPad(d){return d.slice(5,7)+"/"+d.slice(8,10);}
function cnDate(d){return en()?MON[+d.slice(5,7)-1]+" "+(+d.slice(8,10)):(+d.slice(5,7))+"月"+(+d.slice(8,10))+"日";}

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

/* ---------- Theme (Fjord Mist Light default + Polar Night Dark toggle) ---------- */
var THEME=store("nt-theme")==="dark"?"dark":"light";
function applyTheme(){
  document.documentElement.dataset.theme=THEME;
  var m=$("themeMeta");if(m)m.content=THEME==="dark"?"#0b1015":"#eef2f5";
  var lbl=$("themeLabel");
  if(lbl)lbl.textContent=THEME==="dark"?(en()?"Light":"浅色"):(en()?"Dark":"深色");
}
$("themeBtn").addEventListener("click",function(){
  THEME=THEME==="dark"?"light":"dark";
  store("nt-theme",THEME);
  applyTheme();
});

/* ---------- Language & Localization ---------- */
var NM=store("nt-names")==="local"||store("nt-names")==="en"?"local":"zh";
function en(){return NM==="local";}
var EN={};
function normEnPunct(s){return en()?String(s).replace(/、/g,", "):String(s);}
function L(s){if(s==null)return "";var r=en()&&EN[s]!=null?EN[s]:s;return normEnPunct(r);}

var UIEN={
  "北欧之旅":"Nordic Trip","北欧 2027":"NORDIC 2027","北欧之旅 2027":"Nordic Trip 2027",
  "总览":"Overview","行程":"Itinerary","影像":"Photos","准备":"Prep","账本":"Ledger",
  "主导航":"Main navigation","视图":"Views","价格换算":"Currency","货币":"Currency","语言":"Language",
  "切换深浅主题":"Switch theme","问助手":"Ask","问行程助手（⌘K）":"Ask trip assistant (⌘K)",
  "前一天":"Previous day","后一天":"Next day","选择日期":"Choose a day","前后日期导航":"Previous and next day",
  "离线模式：已缓存行程与照片可读；地图、助手与同步需联网":"Offline: cached itinerary and photos available; map, assistant, and sync require signal",
  "正在载入行程…":"Loading itinerary…",
  "行程数字总览":"Trip by the numbers","路线分段":"Route legs",
  "01 / 路线与日历":"01 / ROUTE & CALENDAR","01 / 路线与四周日历":"01 / ROUTE & CALENDAR",
  "全程路线与日历":"Route & daily calendar","四周行程总览":"Route & daily calendar","日历":"Calendar","四周日历":"Calendar","列表":"List",
  "02 / 沿途高光":"02 / HIGHLIGHTS","高光时刻":"Highlights along the route","往左翻":"Scroll left","往右翻":"Scroll right",
  "03 / 筹备与预算":"03 / READINESS & BUDGET","行前雷达与人均预算":"Booking radar & cost estimate",
  "04 / 路线分段":"04 / ROUTE LEGS","路线分段详情":"Route legs","{c} 国 {l} 段详情":"{l} legs across {c} countries","五国六段详情":"Route legs",
  "当日时间轴":"DAILY TIMELINE","在地图打开路线":"Open route in Maps","显示地图":"Show map","收起地图":"Hide map",
  "影像档案":"PHOTOGRAPHIC ARCHIVE","沿途风物影像志":"Places along the route","按国家筛选":"Filter by country",
  "01 / 签证与入境":"01 / ENTRY & VISAS","签证与入境":"Visas and entry",
  "02 / 预订清单":"02 / BOOKINGS","预订":"Bookings",
  "03 / 行装核对":"03 / CHECKLISTS","出发前核对":"Pre-departure checklists",
  "04 / 离线缓存":"04 / OFFLINE ACCESS","离线使用":"Offline access",
  "共享账本":"SHARED LEDGER",
  "地图":"Map","行程地图":"Trip map","地图控制":"Map controls","看全天 / 全程":"Reset map view","在 Google 地图打开":"Open in Google Maps",
  "照片查看":"Photo viewer","关闭":"Close","上一张":"Previous","下一张":"Next",
  "行程助手":"Trip assistant","所有对话":"All chats","新对话":"New chat","关闭（Esc）":"Close (Esc)",
  "访问码":"Access code","验证":"Verify","输入访问码":"Enter access code",
  "添加收据或图片":"Attach receipt or photo","添加收据或截图":"Attach receipt or screenshot",
  "提问或发张小票记账…":"Ask about the itinerary, or attach a receipt…","输入问题":"Message trip assistant",
  "浏览每日行程":"Explore itinerary","查看今日行程":"Open today's schedule",
  "全部预订":"Bookings","影像 · {n}":"Photos · {n}","距离出发 {n} 天":"{n}d to go","明天出发":"Departs tomorrow","旅途第 {n} 天":"Day {n} on the road",
  "行程跨度":"Trip span","{d} 天 · {c} 国":"{d}d · {c} countries","{n} 晚 · {u} 种货币":"{n} nights · {u} currencies",
  "公路自驾":"Road trip","约 {h}h 车程 · {s} 段":"~{h}h · {s} drives",
  "航海与铁道":"Air, sea & rail","{f} 航班 · {b} 渡轮":"{f} flights · {b} ferries","{t} 趟火车 · 1 晚过夜邮轮":"{t} rail legs · 1n ship",
  "徒步与冰川":"Trails & ice","{h} 段徒步":"{h} hikes","{w} 座瀑布 · {g} 处冰川":"{w} waterfalls · {g} glaciers",
  "最北纬度":"Northernmost","{p} · 距北极圈 {k} km":"{p} · {k} km to 66.6°N",
  "盛夏日照":"Summer daylight","最长白昼 {t}（{d}）":"Peak {t} ({d})",
  "{d} 天 · {n} 晚（{s} 晚住宿 + 1 晚过夜邮轮） · 自驾 {k} km · {f} 趟航班 · {b} 趟渡轮":"{d} days · {n} nights ({s} stays + 1 overnight ferry) · {k} km driving · {f} flights · {b} ferries",
  "{d} 天 · {n} 晚 · 自驾 {k} km · {f} 趟航班":"{d} days · {n} nights · {k} km driving · {f} flights",
  "进入该段 →":"Open leg →","展开详情":"Details","规划中":"Being planned","草案":"Draft","当日返程":"Fly home",
  "住 ":"Stay: ","不挪地方":"Local day","无自驾":"No driving","{n} 处站点":"{n} stops",
  "节奏":"PACE","轻松":"Easy","适中":"Moderate","很满":"Full",
  "开车 {t}":"{t} drive","走路 {t}":"{t} walk","在路上 {t}":"{t} transit","{t} 出发":"dep {t}","{t} 结束":"ends {t}",
  "连续 {n} 天高强度（{a}–{b}）":"{n} consecutive full days ({a}–{b})",
  "预订与截止日":"Bookings & deadlines","已订 {a} / {b}":"{a} / {b} booked","查看全部预订与清单 →":"All bookings & checklists →",
  "{h} 项抢手 · {l} 项待开放":"{h} priority · {l} opening later","点击色条查看分项占比":"Click a color bar to inspect share",
  "开放预订":"Open now","尽早":"ASAP","{n} 天后开放":"Opens in {n}d","明天开放":"Opens tomorrow","今天开放":"Opens today",
  "人均费用估算":"Estimated cost per person","{n}人":"{n}p","约 {a}–{b} / 天 · {c}":"~{a}–{b}/day · {c}",
  "机票与邮轮":"Flights & ferry","{n} 晚住宿（另 1 晚邮轮）":"{n}n stays (+1n ferry)","租车与油费 ÷{n}":"Car & fuel ÷{n}","餐饮与超市":"Food & groceries","门票与活动":"Tours & activities",
  "打开共享账本 →":"Open shared ledger →","已记 {n} 笔 · 共 {t}":"{n} logged · {t}",
  "第 {i} / {n} 天":"DAY {i} OF {n}","天气":"Weather","日照":"Daylight","交通":"Transit","户外":"Outdoors","住宿":"Stay",
  "7 月常年":"Typical July","约 {n} 天有雨":"~{n} rainy days","风速 {n} m/s":"Wind {n} m/s","降水 {n}%":"{n}% rain","极昼":"Midnight sun",
  "注意":"HEADS-UP","带上":"BRING","当日预订":"BOOKINGS","已订":"Booked","待订":"Open",
  "{n} 个节点":"{n} STOPS","现在":"NOW","直飞":"Nonstop","官网":"Official site","导航":"Directions","询问助手":"Ask assistant",
  "背景与考据":"Background","可选":"Optional","回到起点":"loop to start","{n} 站":"{n} stops","步行 {t}":"{t} walk","整条步行导航":"Walk directions",
  "正在载入第 {d} 天照片 · {a} / {b}":"Loading Day {d} · {a} / {b} photos",
  "正在载入影像 · {a} / {b}":"Loading archive · {a} / {b} photos",
  "{p} 张照片 · 覆盖 {s} 处地点 · {a} – {b}":"{p} photographs across {s} places · {a} – {b}",
  "多伦多":"Toronto","凯夫拉维克":"Keflavík","伦敦":"London","英国":"UK","奥斯陆":"Oslo","卑尔根":"Bergen","斯德哥尔摩":"Stockholm","哥本哈根":"Copenhagen","塔林":"Tallinn","格但斯克":"Gdańsk","赫尔辛基":"Helsinki",
  "全部":"All","全部照片":"All plates","每处一张":"One per place","第 {n} 天 →":"Day {n} →",
  "全部同行人":"All travelers","中国护照 · 加拿大":"Chinese · Canada","中国护照 · 英国":"Chinese · UK","中国护照 · 中国":"Chinese · China","加拿大护照":"Canadian",
  "选择护照类型以筛选对应的签证、ETIAS 与入境步骤（仅保存在本设备）。":"Select a passport profile above to filter visa, ETIAS, and entry steps (saved on this device).",
  "查看对应预订 →":"Open booking →",
  "现在可订":"Do now","稍后开放":"Opens later","已完成":"Booked",
  "打开 {w}":"Open {w}","标记已订":"Mark booked","取消已订":"Unmark booked","全员已订":"Booked (shared)","展开步骤":"All steps",
  "暂无该分类下的预订项目。":"No bookings in this filter.","显示全部预订 →":"Show all bookings →",
  "当地":"LOCAL","当地货币":"Local currency","按原价显示，不换算":"Original currencies as written","汇率约数 · {d}":"Approx. rates · {d}","汇率为约数":"Approximate rates",
  "已缓存 {a} / {b} 张高清照片":"{a} / {b} offline photos cached","正在下载 {a} / {b}…":"Downloading {a} / {b}…","下载离线照片（约 {m} MB）":"Cache photos offline (~{m} MB)",
  "{n} 张下载失败，联网后可重试":"{n} failed; retry with a stronger connection",
  "行程、最近看过的天气与汇率在首次打开后自动保存在本设备":"Itinerary, recent weather, and FX rates save automatically on first visit",
  "地图底图与行程助手需联网；出发前请在 Google Maps 下载五国离线地图":"Interactive map tiles and assistant need signal; download offline country maps in Google Maps before departure",
  "资料来源：":"Sources: ","天气数据：Open-Meteo":"Weather: Open-Meteo",
  "按 {c} 折算结算":"Settled in {c}",
  "共享账本需要行程访问码才能同步团队账目。":"Shared group ledger requires your trip access code to sync expenses.",
  "解锁账本":"Unlock ledger","验证中…":"Checking…","访问码不正确。":"Incorrect access code.","无法连接行程服务器。":"Cannot reach the trip server.",
  "离线模式：显示上次同步记录；新记账目将在联网后自动同步。":"Offline: showing last synced ledger; new entries queue locally and sync when online.",
  "{n} 笔改动等待同步":"{n} change(s) waiting to sync",
  "同行成员":"Travelers","+ 添加成员":"+ Add name","添加":"Add",
  "先在上方添加同行成员，即可开始记录每笔开销与分摊。":"Add travelers above to start logging shared expenses.",
  "累计支出":"Total spent","{n} 笔记录":"{n} entries","成员":"Traveler","已付":"Paid","应摊":"Share","差额":"Balance",
  "结清方案":"Settlement","{a} 支付给 {b}":"{a} → {b}","账目已平，无需转账。":"All balances settled.",
  "记一笔开销":"Log an expense","项目说明（例：Bónus 超市采购）":"Description (e.g. groceries at Bónus)","金额":"Amount","日期":"Date","谁付的":"Paid by","平摊给":"Split","保存记录":"Save expense",
  "暂无开销记录。":"No expenses logged yet.","{p} 付款":"Paid by {p}","全员平摊":"split equally","个人消费":"personal","{n} 人平摊（{w}）":"split {n} ways ({w})","待同步":"pending",
  "请输入大于 0 的金额。":"Enter an amount greater than 0.","请至少选择一人分摊。":"Select at least one person.",
  "确定删除「{w}」？":"Delete “{w}”?","确定移除成员 {p}？":"Remove {p}?","{p} 名下仍有账目，请先删除相关记录。":"{p} still has logged expenses.",
  "晴":"Clear","晴间多云":"Partly cloudy","阴":"Overcast","雾":"Fog","毛毛雨":"Drizzle","雨":"Rain","雪":"Snow","阵雨":"Showers","阵雪":"Snow showers","雷雨":"Thunderstorm",
  "摄影：":"Photo: ","照片：":"Photo: ","进入":"Unlock","这一天尚在规划中":"This day is not yet scheduled","让助手草拟当天安排":"Ask assistant to draft this day"
};

function U(s,v){
  var r=en()&&UIEN[s]!=null?UIEN[s]:s;
  return v?r.replace(/\{(\w+)\}/g,function(_,k){return v[k];}):r;
}
function wk(d){return (en()?WKEN:WK)[wkday(d)];}
function mode(m){return en()?MODEEN[m]||m:MODE[m]||m;}
function kindLabel(k){
  if(!k)return "";
  if(T&&T.kinds&&T.kinds[k])return L(T.kinds[k]);
  if(k==="sight")return en()?"Sights":"景点";
  if(k==="meal")return en()?"Dining":"吃饭";
  return L(k);
}

/* ---------- Currency ---------- */
var CUR=["CAD","CNY","USD"].indexOf(store("nt-cur"))>=0?store("nt-cur"):"local";
var FX=null,FXAT=null,CSYM={CAD:"C$",CNY:"¥",USD:"US$"},SYMCODE={"US$":"USD","C$":"CAD","CA$":"CAD","€":"EUR"};
var NUM="(\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)";
var RE_PRE=new RegExp("(US\\$|CA\\$|C\\$|€)\\s?"+NUM+"(?:\\s*[–-]\\s*(?:US\\$|CA\\$|C\\$|€)?"+NUM+")?","g");
var RE_SUF=new RegExp(NUM+"(?:\\s*[–-]\\s*"+NUM+")?\\s?(ISK|NOK|SEK|DKK|EUR|PLN|CAD|USD|CNY)(?![A-Za-z])","g");

function fmtMoney(v){
  var a=Math.abs(v),r=a>=1000?Math.round(v/10)*10:a>=10?Math.round(v):a>=1?Math.round(v*10)/10:Math.round(v*100)/100;
  return CSYM[CUR]+r.toLocaleString("en-US",{maximumFractionDigits:2});
}
function money(s,hold){
  if(CUR==="local"||!FX)return s;
  function conv(m,code,a,b){
    if(code===CUR||!FX[code]||!FX[CUR])return m;
    var f=function(x){return +x.replace(/,/g,"")/FX[code]*FX[CUR];},t=fmtMoney(f(a))+(b?"–"+fmtMoney(f(b)).replace(CSYM[CUR],""):"");
    return hold?hold('<span class="pl money" data-lo="'+esc(m)+'">'+esc(t)+"</span>"):t;
  }
  return s.replace(RE_PRE,function(m,sym,a,b){return conv(m,SYMCODE[sym],a,b);}).replace(RE_SUF,function(m,a,b,code){return conv(m,code,a,b);});
}
function curContext(){
  if(CUR==="local"||!FX)return "";
  return CUR+" (1 "+CUR+" = "+["ISK","NOK","SEK","DKK","EUR","PLN"].filter(function(k){return FX[k];}).map(function(k){return (FX[k]/FX[CUR]).toFixed(2)+" "+k;}).join(", ")+")";
}
function loadFx(){
  var c=store("nt-fx");if(c&&Date.now()-c.t<12*36e5){FX=Object.assign({PLN:3.92},c.rates);FXAT=c.t;return;}
  FX=Object.assign({PLN:3.92},(T.fx||{}).rates||{});FXAT=T.fx&&T.fx.date?Date.parse(T.fx.date+"T12:00:00Z"):null;
  fetch("https://open.er-api.com/v6/latest/USD").then(function(r){return r.ok?r.json():Promise.reject();}).then(function(j){
    if(j.result!=="success")return;FX=j.rates;FXAT=Date.now();store("nt-fx",{t:FXAT,rates:j.rates});renderCur();if(CUR!=="local")rerender();
  }).catch(function(){});
}

/* ---------- Icons & Weather SVGs ---------- */
var ICON={
  check:'<svg viewBox="0 0 20 20"><path d="M4 10.5l4 4 8-9"/></svg>',
  chev:'<svg class="chev" viewBox="0 0 20 20"><path d="M5 8l5 5 5-5"/></svg>',
  map:'<svg viewBox="0 0 20 20"><path d="M10 17.5s5.5-5 5.5-9.2a5.5 5.5 0 1 0-11 0c0 4.2 5.5 9.2 5.5 9.2z"/><circle cx="10" cy="8.3" r="1.9"/></svg>',
  dir:'<svg viewBox="0 0 20 20"><path d="M4 15.5V9.5a2.5 2.5 0 0 1 2.5-2.5H15"/><path d="M12 4l3.5 3-3.5 3"/></svg>',
  ask:'<svg viewBox="0 0 20 20"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6A1.5 1.5 0 0 1 14.5 13H9l-3.5 3v-3H5.5A1.5 1.5 0 0 1 4 11.5z"/></svg>',
  globe:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.2"/><path d="M2.8 10h14.4M10 2.8c2.1 2 3.2 4.5 3.2 7.2s-1.1 5.2-3.2 7.2c-2.1-2-3.2-4.5-3.2-7.2S7.9 4.8 10 2.8z"/></svg>',
  peak:'<svg viewBox="0 0 20 20"><path d="M2.5 15.5l5.2-9 3.2 5.2 2.2-3.5 4.4 7.3z"/></svg>',
  north:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.2"/><path d="M10 5l2.2 5-2.2 5-2.2-5z"/></svg>',
  sun:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.6"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4"/></svg>',
  drive:'<svg viewBox="0 0 20 20"><path d="M4 13V9.5L5.6 5h8.8L16 9.5V13M4 13h12M4 13v2M16 13v2"/></svg>',
  flight:'<svg viewBox="0 0 20 20"><path d="M2.5 11.5l15-5.5-1-2-5.5 2.5L6 3.5 4.5 4l3 4-3.5 1.5L2.5 8l-1 .5zM4 16.5h12"/></svg>',
  ferry:'<svg viewBox="0 0 20 20"><path d="M3 12h14l-2 4H5zM6 12V8h8v4M9 8V5h2v3"/></svg>',
  train:'<svg viewBox="0 0 20 20"><rect x="5" y="3" width="10" height="11" rx="2"/><path d="M5 9h10M8 17l-2 1.5M12 17l2 1.5"/></svg>',
  bus:'<svg viewBox="0 0 20 20"><rect x="4" y="3" width="12" height="12" rx="2"/><path d="M4 10h12M6 15v2M14 15v2"/></svg>',
  bike:'<svg viewBox="0 0 20 20"><circle cx="5" cy="13.5" r="3"/><circle cx="15" cy="13.5" r="3"/><path d="M5 13.5l3-6h5l2 6"/></svg>',
  walk:'<svg viewBox="0 0 20 20"><circle cx="11" cy="3.8" r="1.6"/><path d="M8 18l2-5 2 2v3M10 13l1-5-3 2-1 3M11 8l2 3h2.5"/></svg>'
};

var WX_SVG={
  clear:'<svg viewBox="0 0 32 32"><circle class="sun" cx="16" cy="16" r="6"/><path class="sun" d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2.1 2.1M22.4 22.4l2.1 2.1M24.5 7.5l-2.1 2.1M9.6 22.4l-2.1 2.1"/></svg>',
  partly:'<svg viewBox="0 0 32 32"><path class="sun" d="M11 6v2M5 12h2M6.8 7.8l1.4 1.4M15.2 7.8l-1.4 1.4"/><path class="sun" d="M9.2 15.5a4 4 0 1 1 5.6-4.5"/><path d="M11 23h12a4.2 4.2 0 0 0 .4-8.4A5.8 5.8 0 0 0 12.3 13a4.6 4.6 0 0 0-1.3 10z"/></svg>',
  cloud:'<svg viewBox="0 0 32 32"><path d="M9.5 23.5h13.5a4.5 4.5 0 0 0 .5-9A6.5 6.5 0 0 0 11 12.8a5 5 0 0 0-1.5 10.7z"/></svg>',
  rain:'<svg viewBox="0 0 32 32"><path d="M9.5 20.5h13.5a4.2 4.2 0 0 0 .4-8.4A6 6 0 0 0 11.4 10.5a4.6 4.6 0 0 0-1.9 10z"/><path d="M12 24l-1.2 3.2M17 24l-1.2 3.2M22 24l-1.2 3.2"/></svg>',
  snow:'<svg viewBox="0 0 32 32"><path d="M9.5 20.5h13.5a4.2 4.2 0 0 0 .4-8.4A6 6 0 0 0 11.4 10.5a4.6 4.6 0 0 0-1.9 10z"/><circle cx="12" cy="25.5" r="1"/><circle cx="16.5" cy="26.5" r="1"/><circle cx="21" cy="25.5" r="1"/></svg>',
  fog:'<svg viewBox="0 0 32 32"><path d="M7 13h18M5 17.5h22M8 22h16"/></svg>'
};
function wxIconFor(code,clim){
  if(code!=null){
    if(code===0)return WX_SVG.clear;
    if(code<=2)return WX_SVG.partly;
    if(code===3)return WX_SVG.cloud;
    if(code<=48)return WX_SVG.fog;
    if((code>=71&&code<=77)||(code>=85&&code<=86))return WX_SVG.snow;
    return WX_SVG.rain;
  }
  if(clim&&clim.rain>=14)return WX_SVG.rain;
  if(clim&&clim.hi>=19)return WX_SVG.partly;
  return WX_SVG.partly;
}
function wmo(c){
  var w=c===0?"晴":c<=2?"晴间多云":c===3?"阴":c<=48?"雾":c<=57?"毛毛雨":c<=67?"雨":c<=77?"雪":c<=82?"阵雨":c<=86?"阵雪":"雷雨";
  return U(w);
}

/* ---------- Place Names & Inline Markup ---------- */
function names(id){
  var p=T.places[id]||T.countries[id];if(!p)return null;
  return {zh:p.zh||p.local||p.en,lo:p.local||p.en||p.zh,en:p.en||p.local||p.zh};
}
function pn(id,plain){
  var n=names(id);if(!n)return plain?id:esc(id);
  if(NM==="local")return plain?n.lo:esc(n.lo);
  if(plain||n.lo===n.zh)return plain?n.zh:esc(n.zh);
  return '<span class="pl" data-lo="'+esc(n.lo)+'">'+esc(n.zh)+"</span>";
}
function tx(s){
  if(s==null)return "";
  s=L(s);
  var held=[];function hold(h){held.push(h);return "\u0001"+(held.length-1)+"\u0001";}
  s=String(s).replace(/\[\[([\w-]+)\]\]/g,function(_,id){return hold(pn(id));});
  s=money(s,hold);
  s=esc(s).replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0001(\d+)\u0001/g,function(_,i){return held[+i];});
}
function plain(s){
  return normEnPunct(money(String(L(s)||"")).replace(/\[\[([\w-]+)\]\]/g,function(_,id){return pn(id,true);}).replace(/\*\*|`/g,"").replace(/\[([^\]]+)\]\([^)]+\)/g,"$1"));
}

/* Hover tooltip for Chinese place names & converted amounts */
var tip=document.createElement("div");tip.className="pl-tip";tip.hidden=true;document.body.appendChild(tip);
var tipT=null;
function showTip(p){
  var r=p.getBoundingClientRect();tip.textContent=p.dataset.lo;tip.hidden=false;
  tip.style.left=Math.max(8+tip.offsetWidth/2,Math.min(innerWidth-8-tip.offsetWidth/2,r.left+r.width/2))+"px";
  tip.style.top=(r.top-6)+"px";
}
document.addEventListener("mouseover",function(e){var p=e.target.closest&&e.target.closest(".pl");if(p)showTip(p);else tip.hidden=true;});
document.addEventListener("pointerdown",function(e){if(e.pointerType!=="touch")return;var p=e.target.closest&&e.target.closest(".pl");if(!p)return;
  showTip(p);clearTimeout(tipT);tipT=setTimeout(function(){tip.hidden=true;},1600);});
document.addEventListener("scroll",function(){tip.hidden=true;},true);

/* ---------- State ---------- */
var T,DATES=[],BYDATE={},N={},GPID={},PACE={},TRIP_STATS=null;
var state={view:"all",date:null,sel:null,itin:"cal",phFilter:"all",phUnique:true,bkFilter:"all",bgtFocus:null,mobileMap:false};
var weather={};
var VIEWS={all:1,photos:1,prep:1,money:1};

function LL(x){return typeof x==="string"?N[x]:x;}
function gPlace(id){var ll=N[id];var u="https://www.google.com/maps/search/?api=1&query="+ll[0]+"%2C"+ll[1];if(GPID[id])u+="&query_place_id="+GPID[id];return u;}
function gRoute(ids,m){var c=ids.map(function(id){var p=LL(id);return p[0]+","+p[1];});return "https://www.google.com/maps/dir/?api=1&travelmode="+(m||"driving")+"&origin="+encodeURIComponent(c[0])+"&destination="+encodeURIComponent(c[c.length-1])+(c.length>2?"&waypoints="+encodeURIComponent(c.slice(1,-1).join("|")):"");}
function legOf(d){return T.legs.filter(function(l){return d>=l.from&&d<=l.to;})[0]||null;}
function cOf(d){var D=BYDATE[d];return D?D.c:(legOf(d)||{}).c;}
function colorOf(d){var c=cOf(d);return (T&&T.countries&&T.countries[c]&&T.countries[c].color)||"#1f5678";}
function tzOf(d){var c=T.countries[cOf(d)];return (c&&c.tz)||"Atlantic/Reykjavik";}
function day(){return BYDATE[state.date]||null;}
function dayNum(d){var i=DATES.indexOf(d);return i>=0?i+1:1;}
function dur(s){if(s.mins)return s.mins;if(!s.start||!s.end)return 0;var d=mins(s.end)-mins(s.start);return d<0?d+1440:d;}
function liveDate(){for(var i=0;i<DATES.length;i++){if(nowIn(tzOf(DATES[i])).date===DATES[i])return DATES[i];}return null;}
function dayLabel(d){var D=BYDATE[d];return D?plain(D.short||D.title):U("规划中");}

/* Truthful stay helper: fly-home day (2027-08-01) has stay="cph" only for weather coordinates */
function stayOf(D){
  if(!D||!D.stay)return null;
  if(D.date===T.dates.end||/^无|^none/i.test(D.stayNote||""))return null;
  return D.stay;
}

/* ---------- Informative Image Loading Progress ---------- */
function trackImages(rootEl,barId,labelFn){
  var bar=$(barId);if(!bar||!rootEl)return;
  var vh=(window.innerHeight||900)*1.5;
  var imgs=[].slice.call(rootEl.querySelectorAll("img")).filter(function(im){
    if(im.complete)return false;
    var r=im.getBoundingClientRect();
    return r.bottom>0&&r.top<vh;
  });
  if(!imgs.length){bar.hidden=true;return;}
  var total=imgs.length,done=0,shown=false,tm=setTimeout(function(){
    if(done<total){shown=true;bar.hidden=false;paint();}
  },220);
  function paint(){
    var pct=Math.max(10,Math.round(done/total*100));
    bar.innerHTML='<div class="load-bar-head"><span class="mono">'+esc(labelFn(done,total))+'</span><span class="mono">'+pct+'%</span></div><div class="progress-line"><span style="width:'+pct+'%"></span></div>';
  }
  function tick(){
    done++;
    if(shown)paint();
    if(done>=total){clearTimeout(tm);setTimeout(function(){bar.hidden=true;},160);}
  }
  imgs.forEach(function(im){
    im.addEventListener("load",tick,{once:true});
    im.addEventListener("error",tick,{once:true});
  });
}

/* ---------- Index & Boot ---------- */
function index(trip){
  T=trip;N={};GPID={};DATES=[];BYDATE={};PACE={};
  Object.keys(T.places).forEach(function(k){N[k]=T.places[k].ll;if(T.places[k].gid)GPID[k]=T.places[k].gid;});
  for(var d=T.dates.start;d<=T.dates.end;d=addDays(d,1))DATES.push(d);
  T.days.forEach(function(D){
    BYDATE[D.date]=D;var n=0;
    D.segs.forEach(function(s,i){
      s.i=i;if(s.t==="stop")s.num=++n;
      s.pts=s.geom?decode(s.geom):(s.t==="move"?s.path.map(LL):null);
    });
    (D.options||[]).forEach(function(o){o.pts=o.geom?decode(o.geom):null;});
    PACE[D.date]=pace(D);
  });
  TRIP_STATS=calcTripStats();
}

function boot(trip){
  var bs=$("bootState");if(bs)bs.hidden=true;
  index(trip);
  loadFx();renderCur();applyTheme();applyNames();applyStatic();
  renderHeader();renderAll();renderStrip();renderPhotos();renderPrep();renderMoney();

  var h=decodeURIComponent(location.hash.slice(1)),saved=store("nt-pos")||{};
  var live=liveDate(),date=BYDATE[h]||DATES.indexOf(h)>=0?h:live||saved.date||T.dates.start;
  var view=VIEWS[h]?h:DATES.indexOf(h)>=0||live?"day":VIEWS[saved.view]||saved.view==="day"?saved.view:"all";
  setView(view,date);
  loadMap();
  if(OUT.length&&auth().code())flush();
  paintOnline();
  setInterval(function(){if(state.view==="day"&&liveDate()===state.date)renderGlance();},60000);
  window.addEventListener("hashchange",function(){
    var hh=decodeURIComponent(location.hash.slice(1));
    if(DATES.indexOf(hh)>=0&&!(state.view==="day"&&state.date===hh))setView("day",hh);
    else if(VIEWS[hh]&&state.view!==hh)setView(hh);
  });

  window.tripApp={
    context:function(){var c=viewContext(),pp=passportText();if(pp)c.passport=pp;return c;},
    lang:function(){return en()?"en":"zh";},
    place:mapPlace,
    photos:function(id,k){var phs=photosOf(id);if(phs.length)openLb(phs.map(function(ph){return {s:{place:id},ph:ph};}),k||0);},
    goTo:goToPlace
  };
  function viewContext(){
    var D=day(),s=D&&state.sel!=null?D.segs[state.sel]:null;
    var lang=en()?"en":"zh",curTxt=curContext();
    if(state.view==="prep")return {lang:lang,currency:curTxt,day:"Prep",looking_at:"visas, bookings and checklists"};
    if(state.view==="photos")return {lang:lang,currency:curTxt,day:"Photos",looking_at:"photographic archive"};
    if(state.view==="all")return {lang:lang,currency:curTxt,day:"Overview",looking_at:"route legs, 29-day calendar, highlights, readiness and cost estimate"};
    if(state.view==="money")return {lang:lang,currency:curTxt,day:"Ledger",looking_at:"shared expense ledger"};
    return {lang:lang,currency:curTxt,day:state.date+" · "+(D?plain(D.title):"being planned"),looking_at:s?(s.t==="move"?mode(s.mode)+" "+moveLabel(s,true):s.num+". "+plain(s.name||"[["+s.place+"]]")):"whole day"};
  }
  document.dispatchEvent(new CustomEvent("trip:lang"));
  document.dispatchEvent(new CustomEvent("trip:view"));
}

/* ---------- Trip Stats & Overview Header ---------- */
function bookedIds(){var d=store("nt-booked")||{},o={};T.bookings.forEach(function(b){if(b.booked||d[b.id])o[b.id]=1;});return o;}

function calcTripStats(){
  var days=DATES.length,nights=Math.max(1,days-1),cList=[],cSeen={},curMap={is:"ISK",fo:"DKK",no:"NOK",se:"SEK",ee:"EUR",fi:"EUR",pl:"PLN",dk:"DKK"},curSeen={};
  DATES.forEach(function(d){var c=cOf(d);if(c&&!cSeen[c]){cSeen[c]=1;cList.push(c);}if(c&&curMap[c])curSeen[curMap[c]]=1;});
  var driveKm=0,driveMins=0,driveCnt=0,flights=0,ferries=0,trains=0,hikes=0,glaciers=0,falls=0;
  var seenGl={},seenFall={},maxLat=-90,northPlace="dettifoss",northDate=T.dates.start,firstHikeDate=T.dates.start,hasHike=false;
  T.days.forEach(function(D){
    D.segs.forEach(function(s){
      var m=dur(s);
      if(s.t==="move"){
        if(s.mode==="drive"){
          driveCnt++;driveMins+=m;var k=s.km||0;
          if(!k&&s.pts&&s.pts.length>1){for(var p=1;p<s.pts.length;p++)k+=km(s.pts[p-1],s.pts[p]);}
          driveKm+=k;
        }else if(s.mode==="flight")flights++;
        else if(s.mode==="ferry")ferries++;
        else if(s.mode==="train")trains++;
      }else{
        if(s.kind==="hike"){hikes++;if(!hasHike){hasHike=true;firstHikeDate=D.date;}}
        if(s.kind==="glacier"&&s.place&&!seenGl[s.place]){seenGl[s.place]=1;glaciers++;}
        var pl=T.places[s.place]||{};
        if(s.place&&!seenFall[s.place]&&(/foss|fossen|waterfall/i.test(s.place+" "+(pl.en||"")+" "+(pl.local||""))||/瀑布/.test(pl.zh||""))){
          seenFall[s.place]=1;falls++;
        }
        if(s.place&&N[s.place]&&N[s.place][0]>maxLat){
          maxLat=N[s.place][0];northPlace=s.place;northDate=D.date;
        }
      }
    });
  });
  var sunTotalMins=0,maxSunLen=0,maxSunDate=T.dates.start;
  DATES.forEach(function(d){
    var id=wxPlace(d);
    if(id&&N[id]){
      var st=sunTimes(d,N[id][0],N[id][1],tzOf(d));
      var len=st.polar==="day"?1440:(st.len||0);
      sunTotalMins+=len;
      if(len>maxSunLen){maxSunLen=len;maxSunDate=d;}
    }
  });
  var arcticKm=Math.max(1,Math.round((66.563-maxLat)*111.2));
  var overnightCruise=(T.bookings||[]).some(function(b){return /tallink|过夜邮轮|overnight/i.test(b.id+" "+(b.what||""));});
  var stayNights=Math.max(1,nights-(overnightCruise?1:0));
  return {
    days:days,nights:nights,stayNights:stayNights,overnightCruise:overnightCruise,
    countries:cList,currencies:Object.keys(curSeen).length||5,
    driveKm:Math.round(driveKm),driveHrs:Math.round(driveMins/60),driveCnt:driveCnt,
    flights:flights,ferries:ferries,trains:trains,hikes:hikes,glaciers:glaciers,falls:falls,
    maxLat:maxLat>0?maxLat:65.82,northPlace:northPlace,northDate:northDate,arcticKm:arcticKm,
    sunHrs:Math.round(sunTotalMins/60),maxSunLen:maxSunLen,maxSunDate:maxSunDate,firstHikeDate:firstHikeDate
  };
}

function renderHeader(){
  var S=TRIP_STATS||calcTripStats();
  document.title=en()&&T.titleEn?T.titleEn:T.title;
  document.documentElement.lang=en()?"en":"zh-Hans";

  var cHtml=S.countries.map(function(c){
    var co=T.countries[c]||{};
    var col=co.color||"#1f5678";
    var nm=en()?(co.en||c).toUpperCase():(co.zh||c);
    return '<span class="c-tag"><span class="dot" style="--c:'+esc(col)+'"></span>'+esc(nm)+'</span>';
  }).join('<span aria-hidden="true">→</span>');
  var d0=T.dates.start,d1=T.dates.end;
  var span=en()?(MON[+d0.slice(5,7)-1].toUpperCase()+" "+(+d0.slice(8,10))+" – "+MON[+d1.slice(5,7)-1].toUpperCase()+" "+(+d1.slice(8,10))+", "+d1.slice(0,4)+" · "+S.days+" DAYS")
               :(d0.replace(/-/g,".")+" – "+mdPad(d1).replace("/",".")+" · "+S.days+" 天");
  $("eyebrow").innerHTML=cHtml+'<span aria-hidden="true">·</span><span>'+esc(span)+'</span>';

  $("title").innerHTML=en()&&T.titleEn?esc(T.titleEn):esc(T.title)+(T.titleEn?'<span class="en">'+esc(T.titleEn)+"</span>":"");
  $("lede").innerHTML=tx(T.lede);

  var live=liveDate(),today=homeToday(),dGo=daysBetween(today,T.dates.start);
  var P=prepStats(),archiveList=archivePhotos(false);
  var ctaDate=live||T.dates.start;
  var ctaLabel=live?U("查看今日行程"):U("浏览每日行程");
  var statusTxt=dGo>1?U("距离出发 {n} 天",{n:dGo}):dGo===1?U("明天出发"):today<=T.dates.end?U("旅途第 {n} 天",{n:1-dGo}):"";

  var nextBk=P.later[0]||P.now[0]||null;
  var bkChip="";
  if(nextBk){
    var shortBk=plain(nextBk.what).split(/[:：]/)[0].trim();
    var bkSub=nextBk.opens&&nextBk.opens.slice(0,10)>today?(en()?"Opens "+md(nextBk.opens.slice(0,10)):md(nextBk.opens.slice(0,10))+" 开放"):U("开放预订");
    bkChip='<button type="button" class="status-chip amber" data-booking="'+esc(nextBk.id)+'"><span class="dot amber"></span>'+esc(shortBk)+' · '+esc(bkSub)+'</button>';
  }else{
    bkChip='<button type="button" class="status-chip" data-go-view="prep"><span class="dot emerald"></span>'+esc(U("全部预订"))+' · '+P.booked.length+'/'+P.shown.length+'</button>';
  }

  $("heroActions").innerHTML=
    '<button type="button" class="btn-primary" data-date="'+esc(ctaDate)+'">'+esc(ctaLabel)+' →</button>'+
    (statusTxt?'<span class="status-chip"><span class="dot sky"></span>'+esc(statusTxt)+'</span>':'')+
    '<button type="button" class="status-chip" data-go-view="photos"><span class="dot emerald"></span>'+esc(U("影像 · {n}",{n:archiveList.length}))+'</button>'+
    bkChip;

  $("mapDirBtn").href="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=Reykjavik,Iceland&destination=Copenhagen,Denmark";
}

/* ---------- 6-Tile Telemetry Card (#funNums) ---------- */
function renderFunNums(){
  var box=$("funNums");if(!box||!T)return;
  var S=TRIP_STATS||calcTripStats();
  var tiles=[
    {cls:"",ic:ICON.globe,act:'data-scroll="itinSec"',lbl:U("行程跨度"),val:U("{d} 天 · {c} 国",{d:S.days,c:S.countries.length}),sub:U("{n} 晚 · {u} 种货币",{n:S.nights,u:S.currencies})},
    {cls:"ice",ic:ICON.drive,act:'data-scroll="routeSec"',lbl:U("公路自驾"),val:S.driveKm.toLocaleString("en-US")+" km",sub:U("约 {h}h 车程 · {s} 段",{h:S.driveHrs,s:S.driveCnt})},
    {cls:"",ic:ICON.ferry,act:'data-go-view="prep"',lbl:U("航海与铁道"),val:U("{f} 航班 · {b} 渡轮",{f:S.flights,b:S.ferries}),sub:U("{t} 趟火车 · 1 晚过夜邮轮",{t:S.trains})},
    {cls:"moss",ic:ICON.peak,act:'data-scroll="jewelsSec"',lbl:U("徒步与冰川"),val:U("{h} 段徒步",{h:S.hikes}),sub:U("{w} 座瀑布 · {g} 处冰川",{w:S.falls,g:S.glaciers})},
    {cls:"ice",ic:ICON.north,act:'data-jewel="'+esc(S.northPlace)+'" data-jdate="'+esc(S.northDate)+'"',lbl:U("最北纬度"),val:S.maxLat.toFixed(1)+"°N",sub:U("{p} · 距北极圈 {k} km",{p:pn(S.northPlace,true),k:S.arcticKm})},
    {cls:"sun",ic:ICON.sun,act:'data-date="'+esc(S.maxSunDate)+'"',lbl:U("盛夏日照"),val:"~"+S.sunHrs+" h",sub:U("最长白昼 {t}（{d}）",{t:hmS(S.maxSunLen),d:md(S.maxSunDate)})}
  ];
  box.innerHTML=tiles.map(function(t){
    return '<button type="button" class="fn-cell'+(t.cls?" "+t.cls:"")+'" '+t.act+'>'+
      '<span class="fn-top"><span class="fn-ic">'+t.ic+'</span><span class="fn-lbl">'+esc(t.lbl)+'</span></span>'+
      '<span class="fn-val">'+esc(t.val)+'</span>'+
      '<span class="fn-sub">'+esc(t.sub)+'</span></button>';
  }).join("");
}

/* ---------- Highlights Strip (#jewelsSec — Chronological along the route) ---------- */
var HERO_PLATES=[
  ["mons_klint","波罗的海 120 米白垩海崖 · 丹麦","120 m chalk sea cliffs · Baltic coast"],
  ["gamla_stan","斯德哥尔摩中世纪老城岛","Medieval island streets · Stockholm"],
  ["toompea","波罗的海中世纪古城墙 · 塔林","Medieval upper town walls · Tallinn"],
  ["gdansk_crane","莫特拉瓦河畔中世纪木制起重机 · 格但斯克","Medieval port crane on the Motława · Gdańsk"],
  ["gudvangen","世界遗产纳柔依峡湾航道","Nærøyfjord narrow-channel cruise"],
  ["trolltunga","悬于湖面 700 米岩舌 · 28 km 徒步","700 m cliff overhang · 28 km hike"],
  ["loen_skylift","诺德峡湾千米俯瞰 · 洛恩","1,011 m fjord panorama · Loen"],
  ["trollstigen","11 道发卡弯山路 · 西部峡湾","11 mountain hairpins · West Norway"],
  ["blahnukur","流纹岩彩山双峰 · 兰德曼纳劳卡","Rhyolite twin peaks · Landmannalaugar"],
  ["svartifoss","六棱玄武岩柱瀑布 · 瓦特纳冰川","Basalt-column waterfall · Vatnajökull"],
  ["jokulsarlon","杰古沙龙冰河湖浮冰","Glacier lagoon icebergs · South Coast"],
  ["studlagil","玄武岩柱峡谷 · 东部冰岛","Basalt-column canyon · East Iceland"],
  ["kirkjufellsfoss","草帽山瀑布 · 斯奈山半岛","Kirkjufell & falls · Snæfellsnes"]
];

function pickHeroPlates(){
  var byPlace={},out=[];
  T.days.forEach(function(D){D.segs.forEach(function(s){
    if(s.t==="stop"&&s.place&&!byPlace[s.place]&&SCENIC[s.kind])byPlace[s.place]={date:D.date,c:D.c,kind:s.kind,s:s};
  });});
  HERO_PLATES.forEach(function(c){
    var id=c[0],hit=byPlace[id],phs=hit&&photosOf(id);
    if(!hit||!phs||!phs.length)return;
    out.push({id:id,date:hit.date,dayIdx:dayNum(hit.date),c:hit.c,ph:phs[0],note:en()?c[2]:c[1]});
  });
  out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  return out;
}

function renderJewels(){
  var box=$("jewels"),sec=$("jewelsSec");if(!box||!sec)return;
  var plates=pickHeroPlates();
  if(!plates.length){sec.hidden=true;return;}
  sec.hidden=false;
  box.innerHTML=plates.map(function(p){
    var col=(T.countries[p.c]||{}).color||"#1f5678";
    var tag=md(p.date)+" · "+pn(p.c,true);
    return '<button type="button" class="jewel" role="listitem" style="--c:'+esc(col)+'" data-jewel="'+esc(p.id)+'" data-jdate="'+esc(p.date)+'">'+
      '<div class="jw-img"><span class="img-tag"><span class="dot" style="--c:'+esc(col)+'"></span>'+esc(tag)+'</span>'+img(p.ph,500)+'</div>'+
      '<div class="jw-body"><b>'+esc(pn(p.id,true))+'</b><small>'+esc(p.note)+'</small></div></button>';
  }).join("");
  syncJewelArrows();
}
function syncJewelArrows(){
  var box=$("jewels"),p=$("jPrev"),n=$("jNext");if(!box||!p||!n)return;
  p.disabled=box.scrollLeft<=4;
  n.disabled=box.scrollLeft+box.clientWidth>=box.scrollWidth-4;
}
$("jPrev").addEventListener("click",function(){$("jewels").scrollBy({left:-440,behavior:"smooth"});});
$("jNext").addEventListener("click",function(){$("jewels").scrollBy({left:440,behavior:"smooth"});});
$("jewels").addEventListener("scroll",syncJewelArrows,{passive:true});

/* ---------- Overview Render ---------- */
function renderAll(){
  var S=TRIP_STATS||calcTripStats();
  renderHeader();
  renderFunNums();

  /* Colored Route Leg Ribbon (#ribbon) */
  $("ribbon").innerHTML=T.legs.map(function(l){
    var n=daysBetween(l.from,l.to)+1;
    var col=(T.countries[l.c]||{}).color||"#1f5678";
    var shortName=plain(l.short||l.title);
    var sameDay=l.from===l.to,sameMon=l.from.slice(5,7)===l.to.slice(5,7);
    var dateRng=sameDay?md(l.from):(md(l.from)+"–"+(sameMon?(+l.to.slice(8,10)):md(l.to)));
    var sub=dateRng+" · "+(en()?n+"d":n+"天");
    return '<button type="button" class="rt" data-date="'+esc(l.from)+'" style="--c:'+esc(col)+'">'+
      '<span class="rt-bar"></span>'+
      '<b>'+esc(shortName)+'</b>'+
      '<small>'+esc(sub)+'</small>'+
    '</button>';
  }).join("");

  renderItinerarySection();
  renderPaceSum();
  renderJewels();
  renderReady();
  renderBudget();

  /* 04 / ROUTE LEGS */
  var lh=$("legsHeading");
  if(lh)lh.textContent=U("{c} 国 {l} 段详情",{c:S.countries.length,l:T.legs.length});
  $("routeSummary").textContent=S.overnightCruise
    ?U("{d} 天 · {n} 晚（{s} 晚住宿 + 1 晚过夜邮轮） · 自驾 {k} km · {f} 趟航班 · {b} 趟渡轮",{d:S.days,n:S.nights,s:S.stayNights,k:S.driveKm.toLocaleString("en-US"),f:S.flights,b:S.ferries})
    :U("{d} 天 · {n} 晚 · 自驾 {k} km · {f} 趟航班",{d:S.days,n:S.nights,k:S.driveKm.toLocaleString("en-US"),f:S.flights});

  $("legs").innerHTML=T.legs.map(function(l,li){
    var n=daysBetween(l.from,l.to)+1,lp=legPhotos(l).slice(0,4);
    var col=(T.countries[l.c]||{}).color||"#1f5678";
    var spanMono="0"+(li+1)+" · "+mdPad(l.from)+"–"+mdPad(l.to)+" · "+n+"D";
    return '<details class="leg-row" style="--c:'+esc(col)+'" data-leg-idx="'+li+'">'+
      '<summary class="leg-sum">'+
        '<span class="leg-meta mono">'+esc(spanMono)+'</span>'+
        '<span class="leg-main"><span class="leg-title">'+tx(l.title)+'</span>'+(l.body?'<span class="leg-brief">'+tx(l.body)+'</span>':'')+'</span>'+
        '<span class="leg-right"><span class="mono">'+esc(U("展开详情"))+'</span><svg class="b-chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg></span>'+
      '</summary>'+
      '<div class="leg-body">'+
        (lp.length?'<div class="leg-imgs">'+lp.map(function(x,k){
          return '<figure class="img-frame leg-img" data-leg="'+li+'" data-k="'+k+'"><span class="img-tag">'+esc(mdPad(x.date||l.from))+'</span>'+img(x.ph,600)+'</figure>';
        }).join("")+'</div>':'')+
        (l.items&&l.items.length?'<ul class="leg-days-ul">'+l.items.map(function(x){return '<li>'+tx(x)+'</li>';}).join("")+'</ul>':'')+
        '<div><button type="button" class="text-link" data-date="'+esc(l.from)+'">'+esc(U("进入该段 →"))+' ('+cnDate(l.from)+')</button></div>'+
      '</div></details>';
  }).join("");
}

function dayTransitTile(D){
  if(!D)return {ic:ICON.globe,txt:""};
  for(var i=0;i<D.segs.length;i++){
    var s=D.segs[i];
    if(s.t==="move"&&s.mode==="flight"&&s.path&&s.path.length>=2){
      return {ic:ICON.flight,txt:String(s.path[0]).toUpperCase()+" → "+String(s.path[s.path.length-1]).toUpperCase()};
    }
    var fl=extractFlights(s);
    if(fl.flights.length)return {ic:ICON.flight,txt:fl.flights[0].from+" → "+fl.flights[0].to};
  }
  for(var j=0;j<D.segs.length;j++){
    var sf=D.segs[j];
    if(sf.t==="move"&&sf.mode==="ferry"){
      var co=T.countries[D.c]||{};
      return {ic:ICON.ferry,txt:(en()?(co.en||D.c):(co.zh||D.c)).toUpperCase()};
    }
  }
  var cObj=T.countries[D.c]||{};
  return {ic:ICON.globe,txt:(en()?(cObj.en||D.c):(cObj.zh||D.c)).toUpperCase()};
}

function renderItinerarySection(){
  $("itinListCnt").textContent=DATES.length;
  document.querySelectorAll("#itinTabs [data-itin]").forEach(function(b){
    b.setAttribute("aria-selected",b.dataset.itin===state.itin?"true":"false");
  });
  var box=$("itinBody"),live=liveDate();
  if(state.itin==="list"){
    box.innerHTML='<ol class="itin-list">'+DATES.map(function(d,i){
      var D=BYDATE[d],col=colorOf(d),stId=stayOf(D),stName=stId?names(stId):null;
      var openBk=dayBookings(d).filter(function(b){return !b.done;}).length;
      var dk=D?dayDriveKm(D):0,hero=D?heroOf(D):null,tt=!hero?dayTransitTile(D):null;
      var thumb=hero&&hero.ph
        ?'<div class="img-frame itin-thumb">'+img(hero.ph,240)+'</div>'
        :'<div class="img-frame itin-thumb"><span class="cd-transit" style="--c:'+esc(col)+'">'+(tt?tt.ic:ICON.globe)+'</span></div>';
      var stayTxt=stName?(U("住 ")+esc(en()?stName.lo:stName.zh)):(d===T.dates.end?esc(U("当日返程")):"");
      return '<li><button type="button" class="itin-row'+(d===live?" today":"")+'" data-date="'+d+'">'+
        '<span class="itin-cbar" style="--c:'+esc(col)+'"></span>'+
        '<span class="mono">D'+pad2(i+1)+' · '+mdPad(d)+'</span>'+
        thumb+
        '<span class="itin-main"><span class="itin-title">'+(D?tx(D.short||D.title):esc(U("规划中")))+'</span>'+(stayTxt?'<span class="itin-stay">'+stayTxt+'</span>':'')+'</span>'+
        '<span class="itin-meta">'+(dk?'<span class="mono">'+dk+' KM</span>':'')+(D?paceMeter(d,true):'')+(openBk?'<span class="dot amber" title="'+openBk+' unbooked"></span>':'')+'</span>'+
      '</button></li>';
    }).join("")+'</ol>';
  }else{
    var h=(en()?WKEN:WK).map(function(w){return '<div class="cal-h">'+(en()?w:w.slice(1))+'</div>';}).join("");
    for(var p=0;p<wkday(DATES[0]);p++)h+='<div class="cal-pad"></div>';
    DATES.forEach(function(d){
      var D=BYDATE[d],col=colorOf(d),stId=stayOf(D),stName=stId?names(stId):null;
      var openBk=dayBookings(d).filter(function(b){return !b.done;}).length;
      var hero=D?heroOf(D):null,tt=!hero?dayTransitTile(D):null;
      var topMedia=hero&&hero.ph
        ?'<span class="cd-img">'+img(hero.ph,320)+'</span>'
        :'<span class="cd-img"><span class="cd-transit">'+(tt?tt.ic:ICON.globe)+(tt&&tt.txt?'<span>'+esc(tt.txt)+'</span>':'')+'</span></span>';
      var stayLine=stName?(U("住 ")+(en()?stName.lo:stName.zh)):(d===T.dates.end?U("当日返程"):"");
      h+='<button type="button" class="cd'+(d===live?" today":"")+'" style="--c:'+esc(col)+'" data-date="'+d+'">'+
        topMedia+
        '<span class="cd-d"><span>'+md(d)+'<small class="cd-wk"> '+esc(wk(d))+'</small></span><span style="display:inline-flex;align-items:center;gap:4px">'+(D?paceMeter(d,true):"")+(openBk?'<span class="dot amber"></span>':'')+'</span></span>'+
        '<span class="cd-t">'+(D?tx(D.short||D.title):esc(U("规划中")))+'</span>'+
        '<span class="cd-s">'+esc(stayLine)+'</span>'+
      '</button>';
    });
    box.innerHTML='<div class="cal">'+h+'</div>';
  }
}

function dayDriveKm(D){
  var k=0;
  D.segs.forEach(function(s){
    if(s.t==="move"&&s.mode==="drive"){
      var sk=s.km||0;
      if(!sk&&s.pts&&s.pts.length>1){for(var p=1;p<s.pts.length;p++)sk+=km(s.pts[p-1],s.pts[p]);}
      k+=sk;
    }
  });
  return Math.round(k);
}

/* ---------- Overview Readiness & Budget Bento Cards ---------- */
function prepStats(){
  var today=homeToday(),done=bookedIds(),shown=shownBookings(),now=[],later=[],booked=[];
  shown.forEach(function(b){
    if(done[b.id])booked.push(b);
    else if(b.opens&&b.opens.slice(0,10)>today)later.push(b);
    else now.push(b);
  });
  later.sort(function(a,b){return a.opens<b.opens?-1:1;});
  now.sort(function(a,b){return (b.hot?1:0)-(a.hot?1:0);});
  return {today:today,shown:shown,now:now,later:later,booked:booked};
}

function renderReady(){
  var box=$("bentoReady");if(!box||!T)return;
  var P=prepStats(),hotCnt=P.now.filter(function(b){return b.hot;}).length,openNorm=Math.max(0,P.now.length-hotCnt);
  var h='<div class="log-col-head"><h3>'+esc(U("预订与截止日"))+'</h3><span class="mono">'+esc(U("{h} 项抢手 · {l} 项待开放",{h:hotCnt,l:P.later.length}))+'</span></div>';
  h+='<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px">'+
       '<span class="log-stat-big">'+esc(U("已订 {a} / {b}",{a:P.booked.length,b:P.shown.length}))+'</span>'+
     '</div>';

  h+='<div class="rdy-bar" aria-hidden="true">'+
       (P.booked.length?'<span class="rb-done" style="flex:'+P.booked.length+'"></span>':'')+
       (hotCnt?'<span class="rb-hot" style="flex:'+hotCnt+'"></span>':'')+
       (openNorm?'<span class="rb-open" style="flex:'+openNorm+'"></span>':'')+
       (P.later.length?'<span class="rb-later" style="flex:'+P.later.length+'"></span>':'')+
     '</div>';

  var rows=[];
  P.later.slice(0,2).forEach(function(b){
    var dt=b.opens.slice(0,10),n=daysBetween(P.today,dt);
    rows.push('<button type="button" class="kv-row" data-booking="'+esc(b.id)+'">'+
      '<span class="kv-label"><span class="dot sky"></span><span>'+esc(plain(b.what))+'</span></span>'+
      '<span class="kv-right">'+mdPad(dt)+' · '+(n<=0?U("今天开放"):n+"D")+'</span></button>');
  });
  P.now.slice(0,4).forEach(function(b){
    rows.push('<button type="button" class="kv-row" data-booking="'+esc(b.id)+'">'+
      '<span class="kv-label"><span class="dot '+(b.hot?"amber":"sky")+'"></span><span>'+esc(plain(b.what))+'</span></span>'+
      '<span class="kv-right">'+esc(plain(b.for||U("开放预订")))+'</span></button>');
  });
  if(rows.length)h+='<div class="kv-rows">'+rows.join("")+'</div>';

  h+='<div class="card-foot"><button type="button" class="text-link" data-go-view="prep">'+esc(U("查看全部预订与清单 →"))+'</button></div>';
  box.innerHTML=h;
}

var BGT_COL={fly:"#2b7da3",stay:"#6f4e96",car:"#1f5678",food:"#c46816",fun:"#2b7a52"};
function bgtGroupSize(){
  var s=+store("nt-bgt-n");if(s===2||s===3||s===4)return s;
  var p=MNY&&MNY.people?MNY.people.length:0;
  return p>=2&&p<=4?p:4;
}

function calcBudget(n){
  var S=TRIP_STATS||calcTripStats(),sc=settleCur();
  var rates=FX||(T.fx&&T.fx.rates)||{USD:1,CAD:1.4248,CNY:6.71,ISK:121.9,NOK:9.62,SEK:10.04,DKK:6.65,EUR:0.89};
  var mult=(rates[sc]||1)/(rates.USD||1),cStep=sc==="CNY"?100:50,tStep=sc==="CNY"?500:100,dStep=sc==="CNY"?10:5;
  function rnd(u,st){return Math.round(u*mult/st)*st;}
  var kmBase=Math.max(1500,S.driveKm||4201);
  var raw=[
    {k:"fly",lbl:U("机票与邮轮"),uLo:1160+120/n,uHi:1810+220/n},
    {k:"stay",lbl:U("{n} 晚住宿（另 1 晚邮轮）",{n:S.stayNights}),uLo:S.stayNights*(59+16/n),uHi:S.stayNights*(88+26/n)},
    {k:"car",lbl:U("租车与油费 ÷{n}",{n:n}),uLo:(kmBase*0.84)/n,uHi:(kmBase*1.14)/n},
    {k:"food",lbl:U("餐饮与超市"),uLo:S.days*38,uHi:S.days*62},
    {k:"fun",lbl:U("门票与活动"),uLo:520,uHi:690}
  ];
  var sumLo=0,sumHi=0,cats=raw.map(function(c){
    var lo=rnd(c.uLo,cStep),hi=Math.max(lo,rnd(c.uHi,cStep));
    sumLo+=lo;sumHi+=hi;
    return {k:c.k,lbl:c.lbl,lo:lo,hi:hi,mid:(lo+hi)/2,col:BGT_COL[c.k]||"#1f5678"};
  });
  var totLo=Math.round(sumLo/tStep)*tStep,totHi=Math.round(sumHi/tStep)*tStep;
  var dayLo=Math.round(totLo/Math.max(1,S.days)/dStep)*dStep,dayHi=Math.round(totHi/Math.max(1,S.days)/dStep)*dStep;
  return {sc:sc,sym:CSYM[sc]||(sc+" "),totLo:totLo,totHi:totHi,dayLo:dayLo,dayHi:dayHi,cats:cats};
}

function budgetTableHtml(includeLedgerLink){
  var n=bgtGroupSize(),B=calcBudget(n),sym=B.sym,foc=state.bgtFocus;
  function rng(a,b){return sym+a.toLocaleString("en-US")+"–"+b.toLocaleString("en-US");}
  var midSum=B.cats.reduce(function(a,c){return a+c.mid;},0)||1;
  var focCat=foc?B.cats.filter(function(c){return c.k===foc;})[0]:null;

  var h='<div class="log-col-head"><h3>'+esc(U("人均费用估算"))+'</h3>'+
    '<div class="seg-box" role="radiogroup">'+[2,3,4].map(function(k){
      return '<button type="button" role="radio" class="seg-opt" aria-checked="'+(k===n)+'" data-bgt-n="'+k+'">'+esc(U("{n}人",{n:k}))+'</button>';
    }).join("")+'</div></div>';

  h+='<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">'+
       '<span class="log-stat-big tabular">'+esc(rng(B.totLo,B.totHi))+'</span>'+
       '<span class="mono">'+esc(U("约 {a}–{b} / 天 · {c}",{a:sym+B.dayLo.toLocaleString("en-US"),b:B.dayHi.toLocaleString("en-US"),c:B.sc}))+'</span>'+
     '</div>';

  h+='<div class="bgt-bar">'+B.cats.map(function(c){
    var dim=foc&&foc!==c.k?" dim":"";
    return '<button type="button" class="bb-seg'+dim+'" data-bgt-cat="'+c.k+'" style="--k:'+c.col+';flex:'+Math.round(c.mid)+' 1 0" title="'+esc(c.lbl+": "+rng(c.lo,c.hi))+'" aria-label="'+esc(c.lbl)+'"></button>';
  }).join("")+'</div>';

  if(focCat){
    var share=Math.round(focCat.mid/midSum*100);
    h+='<div class="bgt-focus on"><b>'+esc(focCat.lbl)+'</b> · '+esc(rng(focCat.lo,focCat.hi))+' ('+share+'%)</div>';
  }

  h+='<div class="kv-rows">'+B.cats.map(function(c){
    return '<button type="button" class="kv-row" data-bgt-cat="'+c.k+'">'+
      '<span class="kv-label"><span class="dot" style="--c:'+c.col+'"></span><span>'+esc(c.lbl)+'</span></span>'+
      '<span class="kv-right">'+esc(rng(c.lo,c.hi))+'</span></button>';
  }).join("")+'</div>';

  if(includeLedgerLink){
    var items=mItems(),logged=items.length?balances(items).total:0;
    h+='<div class="card-foot">'+
      '<button type="button" class="text-link" data-go-view="money">'+esc(U("打开共享账本 →"))+'</button>'+
      (items.length?'<span class="mono">'+esc(U("已记 {n} 笔 · 共 {t}",{n:items.length,t:fmtC(logged,B.sc)}))+'</span>':'')+
    '</div>';
  }
  return h;
}

function renderBudget(){
  var box=$("bentoBudget");if(box&&T)box.innerHTML=budgetTableHtml(true);
  var fb=$("moneyEstFallback");if(fb&&T)fb.innerHTML=budgetTableHtml(false);
}

/* Overview event listeners */
$("allView").addEventListener("click",function(e){
  var sc=e.target.closest("[data-scroll]");
  if(sc){var tgt=$(sc.dataset.scroll);if(tgt)tgt.scrollIntoView({behavior:"smooth",block:"start"});return;}
  var li=e.target.closest(".leg-img");
  if(li){openLb(legPhotos(T.legs[+li.dataset.leg]),+li.dataset.k);return;}
  var it=e.target.closest("[data-itin]");
  if(it){state.itin=it.dataset.itin;renderItinerarySection();return;}
  var bk=e.target.closest("[data-booking]");
  if(bk){openBooking(bk.dataset.booking);return;}
  var gv=e.target.closest("[data-go-view]");
  if(gv){setView(gv.dataset.goView);window.scrollTo({top:0,behavior:"instant"});return;}
  var bn=e.target.closest("[data-bgt-n]");
  if(bn){store("nt-bgt-n",+bn.dataset.bgtN);renderBudget();return;}
  var bc=e.target.closest("[data-bgt-cat]");
  if(bc){state.bgtFocus=state.bgtFocus===bc.dataset.bgtCat?null:bc.dataset.bgtCat;renderBudget();return;}
  var jw=e.target.closest("[data-jewel]");
  if(jw){goToPlace(jw.dataset.jewel,jw.dataset.jdate);return;}
  var b=e.target.closest("[data-date]");
  if(b){setView("day",b.dataset.date);window.scrollTo({top:0,behavior:"instant"});}
});

/* ---------- Country-Colored Day Strip ---------- */
function renderStrip(){
  var live=liveDate();
  $("strip").innerHTML=DATES.map(function(d){
    var col=colorOf(d),D=BYDATE[d];
    return '<button type="button" role="tab" class="sd'+(d===live?" today":"")+'" style="--c:'+esc(col)+'" data-date="'+d+'" aria-selected="false" title="'+esc(dayLabel(d))+'">'+
      '<b>'+mdPad(d)+'</b><small>'+wk(d)+'</small>'+(D?paceMeter(d):"")+'</button>';
  }).join("");
}
$("strip").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b)setView("day",b.dataset.date);});
$("prevDay").addEventListener("click",function(){var i=DATES.indexOf(state.date);if(i>0)setView("day",DATES[i-1]);});
$("nextDay").addEventListener("click",function(){var i=DATES.indexOf(state.date);if(i<DATES.length-1)setView("day",DATES[i+1]);});
document.addEventListener("keydown",function(e){
  if(state.view!=="day"||e.metaKey||e.ctrlKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||""))return;
  if(e.key==="ArrowLeft")$("prevDay").click();else if(e.key==="ArrowRight")$("nextDay").click();
});
function markStrip(){
  var i=DATES.indexOf(state.date);$("prevDay").disabled=i<=0;$("nextDay").disabled=i>=DATES.length-1;
  document.querySelectorAll(".sd").forEach(function(b){
    var on=b.dataset.date===state.date;b.setAttribute("aria-selected",on);
    if(on&&state.view==="day"){var s=$("strip"),x=b.offsetLeft-s.offsetLeft-(s.clientWidth-b.offsetWidth)/2;s.scrollTo({left:x,behavior:"smooth"});}
  });
}

/* ---------- Views, Routing & Smooth View Transitions ---------- */
function prefersStill(){return !!(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches);}
function morph(fn){
  if(!document.startViewTransition||document.hidden||prefersStill()){fn();return;}
  var t=document.startViewTransition(fn),noop=function(){};
  t.ready.catch(noop);t.finished.catch(noop);
}

/* Sticky topbar subtle scroll shadow */
addEventListener("scroll",function(){
  var st=$("sticky");if(st)st.classList.toggle("stuck",window.scrollY>8);
},{passive:true});

function setView(v,date){
  var was={view:state.view,date:state.date};
  state.view=v;
  if(date)state.date=date;
  if(!state.date)state.date=T.dates.start;
  state.sel=null;
  placeMap(null,true);
  store("nt-pos",{view:v,date:state.date});

  var hash=v==="day"?state.date:v;
  if(decodeURIComponent(location.hash.slice(1))!==hash)history.replaceState(null,"","#"+hash);

  document.querySelectorAll(".seg-btn").forEach(function(b){b.setAttribute("aria-selected",b.dataset.view===v?"true":"false");});
  $("daySub").textContent=DATES.length;

  var showMap=(v==="all"||v==="day");
  var shell=$("appShell");
  shell.classList.toggle("no-map",!showMap);
  shell.classList.toggle("day-mode",v==="day");
  shell.classList.toggle("wide-archive",v==="photos");
  $("mapCol").hidden=!showMap;
  $("mapDirBtn").hidden=(v==="day");

  $("allView").hidden=v!=="all";
  $("dayView").hidden=v!=="day";
  $("photosView").hidden=v!=="photos";
  $("prepView").hidden=v!=="prep";
  $("moneyView").hidden=v!=="money";
  $("stripWrap").hidden=v!=="day";
  $("fitLabel").textContent=en()?(v==="day"?"Whole day":"Whole route"):(v==="day"?"全天":"全程");

  if(was.view!==v||was.date!==state.date){
    var vEl=$(v+"View");
    if(vEl){
      vEl.dataset.dir=was.view===v&&v==="day"?(state.date>was.date?"next":"prev"):"";
      vEl.classList.remove("enter");void vEl.offsetWidth;vEl.classList.add("enter");
    }
  }

  markStrip();
  if(v==="all")setTimeout(syncJewelArrows,30);
  if(v==="money")loadMoney();
  if(v==="photos")renderPhotos();
  if(v==="day"){
    renderDay();
    var D=day(),cur=D&&liveDate()===state.date?nowSeg():null;
    if(cur){select(cur.i,false);return;}
  }
  placeMap();
  if(showMap){
    setTimeout(function(){if(lMap)lMap.invalidateSize();fitView();},30);
  }
  document.dispatchEvent(new CustomEvent("trip:view"));
}

document.querySelectorAll(".seg-btn").forEach(function(b){
  b.addEventListener("click",function(){
    var v=b.dataset.view;
    if(state.view!==v){
      morph(function(){setView(v);window.scrollTo({top:0,behavior:"instant"});});
    }
  });
});

/* ---------- View 2: Daily Itinerary & Stop Detail ---------- */
function moveLabel(s,asText){
  var t=s.label||("[["+s.path[0]+"]] → [["+s.path[s.path.length-1]+"]]");
  return asText?plain(t):tx(t);
}
function nowSeg(){
  var D=day(),t=nowIn(tzOf(state.date)).mins,segs=D.segs.filter(function(s){return s.start;}),best=null;
  if(!segs.length)return null;
  for(var i=0;i<segs.length;i++){var s=segs[i],e=s.end||s.start;if(t>=mins(s.start)&&t<=mins(e)){if(s.t==="stop"&&s.start!==e)return s;best=best||s;}}
  if(best)return best;if(t<mins(segs[0].start))return segs[0];return segs[segs.length-1];
}

function updateMobileMapBtn(){
  var btn=$("mobileMapToggle");
  if(btn)btn.textContent=state.mobileMap?U("收起地图"):U("显示地图");
  var slot=$("dayMapSlot");
  if(slot)slot.hidden=!state.mobileMap||state.sel!=null;
}
$("mobileMapToggle").addEventListener("click",function(){
  state.mobileMap=!state.mobileMap;
  if(state.mobileMap&&state.sel!=null){state.sel=null;paintOpen();markSel();}
  updateMobileMapBtn();
  placeMap();
  setTimeout(function(){if(lMap)lMap.invalidateSize();fitView();},40);
});

function renderDay(){
  var D=day(),d=state.date,lg=legOf(d),idx=dayNum(d),col=colorOf(d);
  var dk=D?dayDriveKm(D):0,dm=D?driveOf(D):0;
  var legShort=lg?plain(lg.short||lg.title):"";
  var eyeBits=[
    U("第 {i} / {n} 天",{i:pad2(idx),n:DATES.length}),
    (en()?WKEN[wkday(d)].toUpperCase()+" "+MON[+d.slice(5,7)-1].toUpperCase()+" "+(+d.slice(8,10)):cnDate(d)+" "+wk(d)),
    legShort,
    dk?dk+" KM":"",
    dm?hmS(dm)+" "+(en()?"DRIVE":"车程"):""
  ].filter(Boolean);
  var pill=$("dayEyebrow");
  pill.style.setProperty("--c",col);
  pill.innerHTML='<span class="dot" style="--c:'+esc(col)+'"></span><span>'+esc(eyeBits.join(" · "))+'</span>';
  $("dayTitle").innerHTML=D?tx(D.title):esc(U("规划中"));

  var rt=D?(D.route||embedDayRoute(D)):null;
  $("dayRoute").href=rt&&rt.length>1?gRoute(rt,D.routeMode):"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(((T.countries[cOf(d)]||{}).en)||"Iceland");

  updateMobileMapBtn();
  renderHero();
  renderGlance();
  renderRows();
  renderDayNav();

  var box=$("draftBox");
  if(D){
    box.hidden=true;
    var stopCnt=D.segs.filter(function(s){return s.t==="stop";}).length;
    $("tlCount").textContent=U("{n} 个节点",{n:stopCnt});
    $("tlHead").hidden=false;
    trackImages($("dayView"),"dayPhotoLoad",function(a,b){return U("正在载入第 {d} 天照片 · {a} / {b}",{d:pad2(idx),a:a,b:b});});
    return;
  }
  $("tlHead").hidden=true;
  box.hidden=false;
  box.innerHTML='<h3>'+esc(U("这一天尚在规划中"))+'</h3>'+
    '<div style="margin-top:10px"><button type="button" class="btn-secondary" id="draftAsk">'+esc(U("让助手草拟当天安排"))+'</button></div>';
  $("draftAsk").addEventListener("click",function(){
    if(window.tripChat)window.tripChat.ask(cnDate(d)+" ("+wk(d)+") "+U("这一天尚在规划中"));
  });
}

function renderRows(){
  var D=day(),ol=$("rows");
  placeMap(null,true);
  ol.innerHTML="";
  if(!D)return;
  var cur=liveDate()===state.date?nowSeg():null,opts=optGroups(D),optDone={},segs=D.segs;
  function after(s,to){
    if(s.t==="stop"&&opts[s.place]&&!optDone[s.place]){
      optDone[s.place]=1;
      opts[s.place].forEach(function(o,j){to.appendChild(optRow(o,s.place+"#"+j));});
    }
  }
  for(var i=0;i<segs.length;i++){
    var s=segs[i];
    if(s.group){
      var run=[s];while(i+1<segs.length&&segs[i+1].group===s.group)run.push(segs[++i]);
      if(run.some(function(x){return x.t==="stop";})){
        var g=grpRow(run,cur);ol.appendChild(g);run.forEach(function(x){after(x,ol);});continue;
      }
      i-=run.length-1;
    }
    ol.appendChild(segLi(s,cur));after(s,ol);
  }
  Object.keys(opts).forEach(function(k){if(!optDone[k])opts[k].forEach(function(o,j){ol.appendChild(optRow(o,k+"#"+j));});});
}

function segLi(s,cur,inGrp){
  var li=document.createElement("li");li.dataset.i=s.i;
  if(cur&&cur.i===s.i)li.classList.add("now");
  if(s.t!=="move")li.style.setProperty("--k",KCOL[s.kind]||"#1f5678");
  var b=document.createElement("div");b.className="row"+(s.t==="move"?" move":"");
  b.setAttribute("role","button");b.tabIndex=0;b.setAttribute("aria-expanded","false");

  if(s.t==="move"){
    var dm=dur(s),wkm=inGrp&&s.mode==="walk"?walkKm(s):0,alCodes=s.mode==="flight"?detectAirlines(s.note||""):[];
    var alTag=alCodes.length?'<span class="mv-al">'+alCodes.map(function(c){return airlineBadge(c,"","mv-logo");}).join("")+esc(alCodes.map(function(c){return AIRLINES[c].name;}).join("/"))+"</span> · ":"";
    var distPart=s.km?s.km+"\u00a0km":(wkm?wkm+"\u00a0km":"");
    b.innerHTML='<span class="t">'+(s.mode==="flight"&&s.start?esc(s.start):"")+'</span>'+
      '<span class="num" title="'+esc(mode(s.mode))+'">'+(ICON[s.mode]||ICON.drive)+'</span>'+
      '<span class="n">'+alTag+moveLabel(s)+(dm||distPart?' <span class="mv-meta">· '+esc([dm?hmS(dm):"",distPart].filter(Boolean).join(" · "))+'</span>':'')+'</span>'+
      ICON.chev;
  }else{
    var bits=[s.start&&s.end&&s.start!==s.end?hmS(dur(s)):s.mins?hmS(s.mins):"",kindLabel(s.kind)].filter(Boolean).join(" · ");
    var nowBadge=cur&&cur.i===s.i?' <span class="fl-badge" style="margin-left:6px;vertical-align:1px">'+esc(U("现在"))+'</span>':"";
    b.innerHTML='<span class="t">'+(s.start?esc(s.start):"")+'</span>'+
      '<span class="num">'+pad2(s.num)+'</span>'+
      '<span class="n">'+tx(s.name||"[["+s.place+"]]")+nowBadge+'</span>'+
      ICON.chev+
      (bits?'<span class="s">'+esc(bits)+'</span>':'');
  }
  b.addEventListener("click",function(){
    var sel=getSelection();if(sel&&!sel.isCollapsed&&b.contains(sel.anchorNode))return;
    if(state.sel===s.i){state.sel=null;paintOpen();markSel();fitView();}else select(s.i,true);
  });
  b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();b.click();}});
  li.appendChild(b);
  return li;
}

/* ---------- Walking Route Groups & Optional Extras ---------- */
var GOPEN={},OPTOPEN={};
function hav(a,b){var R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x));}
function walkKm(s){if(s.km)return s.km;var ps=(s.path||[]).map(function(x){return typeof x==="string"?(N[x]||null):x;}).filter(Boolean),k=0;
  for(var j=1;j<ps.length;j++)k+=hav(ps[j-1],ps[j]);return Math.round(k*1.25*10)/10;}
function inLang(l,fn){var was=NM;NM=l;try{return fn();}finally{NM=was;}}
function quoteEvent(ref,fn){return {ref:ref,zh:inLang("zh",fn),en:inLang("local",fn)};}
function itemLines(x){
  var out=[],sto=x.place&&T.places[x.place]&&T.places[x.place].story;
  if(x.why)out.push(plain(x.why));
  if(x.body||x.note)out.push(plain(x.body||x.note));
  (x.facts||[]).forEach(function(f){out.push(L(f[0])+": "+plain(f[1]));});
  (x.tips||[]).forEach(function(t){out.push("• "+plain(t));});
  (sto||[]).forEach(function(p){out.push(L(p[0])+": "+plain(p[1]));});
  return out.join("\n").slice(0,1800);
}

function grpRow(run,cur){
  var li=document.createElement("li"),first=run[0],last=run[run.length-1],id=state.date+"|"+first.i;
  var open=!!GOPEN[id]||run.some(function(x){return x.i===state.sel;});
  li.className="grp"+(open?" open":"");li.dataset.g=first.i;
  li.style.setProperty("--k",KCOL.hike);
  var st=run.filter(function(x){return x.t==="stop";}),walks=run.filter(function(x){return x.t==="move"&&x.mode==="walk";}),wm=0,wkm=0;
  walks.forEach(function(w){wm+=dur(w);wkm+=walkKm(w);});
  var t0=first.start||"",t1=last.end||last.start||"",span=t0&&t1?(mins(t1)-mins(t0)+1440)%1440:0;
  var bits=[span?hmS(span):"",U("{n} 站",{n:st.length}),wm?U("步行 {t}",{t:hmS(wm)}):"",wkm?Math.round(wkm*10)/10+" km":""].filter(Boolean).join(" · ");
  var ends=[];run.forEach(function(x){var p=x.t==="stop"?x.place:null;if(p&&ends[ends.length-1]!==p)ends.push(p);});
  var loop=false;if(last.t==="move"){var e=last.path[last.path.length-1],b0=first.t==="move"?first.path[0]:first.place;if(e===b0)loop=true;else if(typeof e==="string"&&ends[ends.length-1]!==e)ends.push(e);}
  var chips=ends.map(function(p){return '<span class="grp-chip">'+tx("[["+p+"]]")+'</span>';}).concat(loop?['<span class="grp-chip back">'+esc(U("回到起点"))+'</span>']:[]).join('<span class="grp-ar">→</span>');

  var b=document.createElement("div");b.className="row grp-row";b.setAttribute("role","button");b.tabIndex=0;b.setAttribute("aria-expanded",open);
  b.innerHTML='<span class="t">'+esc(t0)+'</span><span class="num">'+ICON.walk+'</span><span class="n">'+tx(first.group)+'</span>'+ICON.chev+
    '<span class="s">'+esc(bits)+'</span><span class="grp-chips">'+chips+'</span>';
  li.appendChild(b);

  var fold=document.createElement("div");fold.className="grp-fold";fold.inert=!open;
  var inn=document.createElement("div");inn.className="grp-in";
  var box=document.createElement("div");box.className="grp-box";
  var ul=document.createElement("ol");ul.className="grp-list";
  run.forEach(function(x){ul.appendChild(segLi(x,cur,true));});
  var pts=[];run.forEach(function(x){(x.t==="stop"?[x.place]:x.path).forEach(function(p){if(typeof p==="string"&&pts[pts.length-1]!==p)pts.push(p);});});
  var acts=document.createElement("div");acts.className="grp-acts";
  acts.innerHTML=(pts.length>1?'<a class="btn-secondary" target="_blank" rel="noopener" href="'+esc(gRoute(pts.slice(0,10),"walking"))+'">'+ICON.dir+esc(U("整条步行导航"))+' ↗</a>':'')+
    '<button type="button" class="btn-secondary grp-ask">'+ICON.ask+esc(U("询问助手"))+'</button>';
  acts.querySelector(".grp-ask").addEventListener("click",function(){
    if(!window.tripChat)return;
    var dt=state.date;
    window.tripChat.quote(quoteEvent(dt+" · WALK [group="+first.group+"]",function(){
      var rt=ends.map(function(p){return plain("[["+p+"]]");}).join(" → ");
      return {meta:md(dt)+" · "+U("{n} 站",{n:st.length}),title:plain(first.group),sub:rt,full:rt};
    }));
  });
  box.appendChild(ul);box.appendChild(acts);inn.appendChild(box);fold.appendChild(inn);li.appendChild(fold);

  b.addEventListener("click",function(){
    var sel=getSelection();if(sel&&!sel.isCollapsed&&b.contains(sel.anchorNode))return;
    var on=!li.classList.contains("open");
    if(on){closeGroups(li);closeOpts(null);if(state.sel!=null){state.sel=null;paintOpen();markSel();}}
    else if(run.some(function(x){return x.i===state.sel;})){state.sel=null;paintOpen();markSel();}
    GOPEN[id]=on;li.classList.toggle("open",on);b.setAttribute("aria-expanded",on);fold.inert=!on;
    if(on)frameGroup(pts);else if(state.sel==null)fitView();
  });
  b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();b.click();}});
  return li;
}
function closeGroups(keep){
  document.querySelectorAll("#rows li.grp.open").forEach(function(el){
    if(el===keep)return;
    el.classList.remove("open");el.querySelector(".grp-row").setAttribute("aria-expanded","false");
    var gf=el.querySelector(":scope > .grp-fold");if(gf)gf.inert=true;
    GOPEN[state.date+"|"+el.dataset.g]=false;
  });
}
function closeOpts(keep){
  document.querySelectorAll("#rows li.opts.open").forEach(function(el){
    if(el===keep)return;
    el.classList.remove("open");el.querySelector(".opt-toggle").setAttribute("aria-expanded","false");
    var of=el.querySelector(":scope > .opt-fold");if(of)of.inert=true;
    OPTOPEN[state.date+"|"+el.dataset.opt]=false;
  });
}
function frameGroup(ids){
  hideHikeMap();var ps=ids.map(LL);caption();
  if(embed){if(ps.length>1)embedRoute(ps,true);else embedPlace(ps[0],15);return;}
  if(map||lMap)fitPts(ps,16);
}

function optGroups(D){var g={};(D.options||[]).forEach(function(o){var k=o.after||"";(g[k]=g[k]||[]).push(o);});return g;}
function optMove(m){
  if(!m)return "";
  var bits=[mode(m.mode),m.mins?hmS(m.mins):""];
  var ids=(m.path||[]).filter(function(x){return typeof x==="string";});
  if(ids.length>1)bits.push(plain("[["+ids[0]+"]] → [["+ids[ids.length-1]+"]]"));
  return '<div class="mono" style="display:inline-flex;align-items:center;gap:6px"><span>'+esc(bits.filter(Boolean).join(" · "))+'</span></div>';
}
function optCard(o,k){
  var when=o.start?(o.end&&o.end!==o.start?o.start+"–"+o.end:o.start):o.mins?hmS(o.mins):"";
  var kind=kindLabel(o.kind),phs=o.place?photosOf(o.place):[],col=KCOL[o.kind]||"#1f5678";
  var h='<div class="opt-card" style="--k:'+esc(col)+'">';
  h+='<div class="mono">'+esc([U("可选"),when,kind].filter(Boolean).join(" · "))+'</div>';
  h+='<h4>'+tx(o.name||"[["+o.place+"]]")+'</h4>';
  if(phs.length)h+=photoGrid(phs,k);
  if(o.why)h+='<p style="color:var(--text-dim);font-size:13px">'+tx(o.why)+'</p>';
  if(o.body)h+='<p class="body">'+tx(o.body)+'</p>';
  if(o.facts&&o.facts.length)h+='<dl class="facts">'+o.facts.map(function(f){return '<div><dt>'+esc(L(f[0]))+'</dt><dd>'+tx(f[1])+'</dd></div>';}).join("")+'</dl>';
  h+='<div class="item-actions">'+(o.place&&N[o.place]?'<a class="btn-secondary" target="_blank" rel="noopener" href="'+esc(gPlace(o.place))+'">'+ICON.map+esc(U("在 Google 地图打开"))+' ↗</a>':'')+
     '<button type="button" class="btn-secondary" data-opt-ask="'+esc(k)+'">'+ICON.ask+esc(U("询问助手"))+'</button></div></div>';
  return optMove(o["in"])+h+optMove(o.out);
}
function optByKey(k){var p=k.split("#");return (optGroups(day())[p[0]]||[])[+p[1]];}
function optRow(o,k){
  var li=document.createElement("li"),id=state.date+"|"+k,open=!!OPTOPEN[id];
  li.className="opts"+(open?" open":"");li.dataset.opt=k;
  var label=plain(o.name||"[["+o.place+"]]");
  li.innerHTML='<button type="button" class="opt-toggle" aria-expanded="'+open+'"><span class="opt-ar">›</span>'+esc(U("可选"))+' · '+esc(label)+'</button>'+
    '<div class="opt-fold"'+(open?"":" inert")+'><div class="opt-in"><div class="opt-list">'+optCard(o,k)+'</div></div></div>';
  return li;
}

$("rows").addEventListener("click",function(e){
  var t=e.target.closest(".opt-toggle");
  if(t){
    var li=t.closest("li.opts"),id=state.date+"|"+li.dataset.opt,on=!OPTOPEN[id];
    if(on){closeOpts(li);closeGroups(null);if(state.sel!=null){state.sel=null;paintOpen();markSel();}}
    OPTOPEN[id]=on;li.classList.toggle("open",on);t.setAttribute("aria-expanded",on);
    var of=li.querySelector(":scope > .opt-fold");if(of)of.inert=!on;
    if(on){var o=optByKey(li.dataset.opt);if(o&&(o.kind==="hike"||(o.pts&&o.pts.length>1)))frameOptHike(o);else if(o&&o.place&&N[o.place])frameOpt(o);}
    else if(state.sel==null)fitView();
    return;
  }
  var a=e.target.closest("[data-opt-ask]");
  if(a){
    var k=a.dataset.optAsk.split("#"),o=optGroups(day())[k[0]][+k[1]],dt=state.date;
    if(o&&window.tripChat)window.tripChat.quote(quoteEvent(dt+" · OPTIONAL",function(){
      return {meta:md(dt)+" · "+U("可选"),title:plain(o.name||"[["+o.place+"]]"),sub:plain(o.body||o.why||"").slice(0,180),full:itemLines(o)};
    }));
    return;
  }
  var pf=e.target.closest(".d-photo[data-opt-k]");
  if(pf&&!e.target.closest(".credit")){
    var kk=pf.dataset.optK.split("#"),oo=optGroups(day())[kk[0]][+kk[1]];
    if(oo&&oo.place){var phs=photosOf(oo.place);if(phs.length)openLb(phs.map(function(p){return {s:{place:oo.place,name:oo.name},ph:p,date:state.date};}),+pf.dataset.k||0);}
  }
});

function select(i,scroll){
  state.sel=i;
  updateMobileMapBtn();
  paintOpen();
  var s=day().segs[i];
  markSel();frame(s);caption();
  if(scroll===false){var li=document.querySelector('#rows li[data-i="'+i+'"]');if(li)li.scrollIntoView({block:"center"});}
}

function paintOpen(){
  var from=STAGE.closest("#rows li[data-i]");
  var nextLi=state.sel!=null?document.querySelector('#rows li[data-i="'+state.sel+'"]'):null;
  var prevY=nextLi?nextLi.getBoundingClientRect().top:null;
  var closingAboveH=0;

  document.querySelectorAll("#rows li[data-i]").forEach(function(li){
    var i=+li.dataset.i,on=i===state.sel;
    li.querySelector(".row").setAttribute("aria-expanded",on);
    var fold=li.querySelector(":scope > .detail-fold");
    if(on){
      clearTimeout(li._closeT);
      li.classList.remove("closing");
      if(!fold){
        fold=document.createElement("div");fold.className="detail-fold";
        var inn=document.createElement("div");inn.className="detail-in";
        inn.appendChild(detail(day().segs[i]));
        fold.appendChild(inn);
        li.appendChild(fold);
      }
      fold.inert=false;
    }else if(fold){
      if(li.classList.contains("open")&&nextLi&&(li.compareDocumentPosition(nextLi)&Node.DOCUMENT_POSITION_FOLLOWING)){
        closingAboveH+=fold.offsetHeight;
      }
      li.classList.remove("open");
      fold.inert=true;
      if(prefersStill()){
        if(fold.contains(STAGE))MAPHOME.appendChild(STAGE);
        fold.remove();
      }else{
        li.classList.add("closing");
        clearTimeout(li._closeT);
        li._closeT=setTimeout(function(){
          if(li.classList.contains("open"))return;
          li.classList.remove("closing");
          if(fold.contains(STAGE))MAPHOME.appendChild(STAGE);
          fold.remove();
        },300);
      }
    }
  });

  var gl=nextLi&&nextLi.closest("li.grp");
  if(state.sel!=null){closeGroups(gl);closeOpts(null);}
  if(gl&&!gl.classList.contains("open")){
    gl.classList.add("open");
    gl.querySelector(".grp-row").setAttribute("aria-expanded",true);
    var gf=gl.querySelector(":scope > .grp-fold");if(gf)gf.inert=false;
    GOPEN[state.date+"|"+gl.dataset.g]=true;
  }

  if(nextLi){
    var nf=nextLi.querySelector(":scope > .detail-fold");
    placeMap(nextLi);
    if(!prefersStill()&&nf&&!nextLi.classList.contains("open"))void nf.offsetHeight;
    nextLi.classList.add("open");
    if(closingAboveH>0&&prevY!=null){
      var stickyBottom=($("sticky")?$("sticky").getBoundingClientRect().bottom:96)+12;
      if(prevY-closingAboveH<stickyBottom){
        setTimeout(function(){
          if(state.sel!=null&&nextLi.isConnected){
            var r=nextLi.getBoundingClientRect();
            if(r.top<stickyBottom)window.scrollBy({top:r.top-stickyBottom,behavior:"smooth"});
          }
        },290);
      }
    }
  }else{
    placeMap(from);
  }
  document.dispatchEvent(new CustomEvent("trip:view"));
}

/* Smooth <details> Accordion Animator (Route Legs, Bookings, Steps) */
function toggleDetails(det,wantOpen){
  if(prefersStill()||!det.animate){det.open=wantOpen;return;}
  if(det._anim){det._anim.cancel();det._anim=null;}
  var sum=det.querySelector(":scope > summary");if(!sum)return;
  var cs=getComputedStyle(det),bt=parseFloat(cs.borderTopWidth)||0,bb=parseFloat(cs.borderBottomWidth)||0;
  if(!wantOpen){
    if(!det.open)return;
    var h0=det.offsetHeight,h1=sum.offsetHeight+bt+bb;
    det.classList.add("is-closing");
    det.style.overflow="hidden";
    var a=det.animate([{height:h0+"px"},{height:h1+"px"}],{duration:240,easing:"cubic-bezier(0.22, 1, 0.36, 1)"});
    det._anim=a;
    a.onfinish=function(){det._anim=null;det.open=false;det.classList.remove("is-closing");det.style.height="";det.style.overflow="";};
    a.oncancel=function(){det._anim=null;det.classList.remove("is-closing");det.style.height="";det.style.overflow="";};
  }else{
    var s0=det.open?det.offsetHeight:(sum.offsetHeight+bt+bb);
    det.classList.remove("is-closing");
    det.open=true;
    var s1=det.offsetHeight;
    det.style.overflow="hidden";
    var a2=det.animate([{height:s0+"px"},{height:s1+"px"}],{duration:260,easing:"cubic-bezier(0.22, 1, 0.36, 1)"});
    det._anim=a2;
    a2.onfinish=a2.oncancel=function(){det._anim=null;det.style.height="";det.style.overflow="";};
  }
}
document.addEventListener("click",function(e){
  var sum=e.target.closest("summary");
  if(!sum||e.target.closest("a,button,input"))return;
  var det=sum.parentElement;
  if(!det||det.tagName!=="DETAILS")return;
  e.preventDefault();
  var want=!det.open||det.classList.contains("is-closing");
  if(want&&det.classList.contains("booking")){
    OPEN_BK_ID=det.id.slice(3);
    var bkBox=$("bkList");
    if(bkBox)bkBox.querySelectorAll("details.booking[open]").forEach(function(other){if(other!==det)toggleDetails(other,false);});
  }else if(!want&&det.classList.contains("booking")&&OPEN_BK_ID===det.id.slice(3)){
    OPEN_BK_ID="";
  }
  toggleDetails(det,want);
});

/* ---------- Responsive Map Slot Placement ---------- */
var STAGE=$("mapStage"),MAPHOME=$("mapCol");
function placeMap(anchor,home){
  var to=MAPHOME;
  if(!home&&!wide.matches){
    if(state.view==="all")to=$("overviewMapSlot")||MAPHOME;
    else if(state.view==="day"){
      if(state.sel!=null){var slot=document.querySelector('#rows li[data-i="'+state.sel+'"] .detail-map');if(slot)to=slot;}
      else if(state.mobileMap)to=$("dayMapSlot")||MAPHOME;
      else if(STAGE.closest("#rows li.closing"))return;
    }
  }
  if(STAGE.parentNode===to)return;
  var a=anchor&&anchor.isConnected?anchor:$("rows"),y0=a?a.getBoundingClientRect().top:0;
  to.appendChild(STAGE);
  if(lMap)setTimeout(function(){lMap.invalidateSize();},40);
  if(a&&a.offsetParent){var dy=a.getBoundingClientRect().top-y0;if(Math.abs(dy)>4)scrollBy(0,dy);}
}
if(wide.addEventListener)wide.addEventListener("change",function(){placeMap();if(lMap)setTimeout(function(){lMap.invalidateSize();fitView();},50);});

/* ---------- Airlines & Boarding-Pass Flight Cards ---------- */
var AIRLINES={
  FI:{name:"Icelandair",logo:"img/airlines/FI.png",color:"#00468B"},
  BA:{name:"British Airways",logo:"img/airlines/BA.png",color:"#C8102E"},
  SK:{name:"SAS",logo:"img/airlines/SK.png",color:"#00205B"},
  DY:{name:"Norwegian",logo:"img/airlines/DY.png",color:"#D81939",full:true},
  AC:{name:"Air Canada",logo:"img/airlines/AC.png",color:"#D80621"},
  W6:{name:"Wizz Air",badge:"W6",color:"#C6007E"}
};
var IATA_CITY={YYZ:"多伦多",KEF:"凯夫拉维克",LHR:"伦敦",UK:"英国",OSL:"奥斯陆",BGO:"卑尔根",ARN:"斯德哥尔摩",CPH:"哥本哈根",TLL:"塔林",GDN:"格但斯克",HEL:"赫尔辛基"};
function airlineBadge(code,alt,cls){
  var al=AIRLINES[code],c=cls||"fl-logo";
  if(al&&al.logo)return '<span class="'+c+(al.full?" full":"")+'"><img src="'+al.logo+'" alt="'+esc(alt||al.name)+'" loading="lazy"></span>';
  if(al&&al.badge)return '<span class="'+c+' code" style="--al:'+esc(al.color)+'">'+esc(al.badge)+'</span>';
  return "";
}
function detectAirlines(str){
  var out=[];
  if(/icelandair|冰岛航空/i.test(str))out.push("FI");
  if(/british\s*airways|英航/i.test(str))out.push("BA");
  if(/\bsas\b|斯堪的纳维亚/i.test(str))out.push("SK");
  if(/norwegian|挪威航空/i.test(str))out.push("DY");
  if(/air\s*canada|加航/i.test(str))out.push("AC");
  if(/wizz\s*air|威兹/i.test(str))out.push("W6");
  return out;
}
function parseFlightFact(f){
  var val=String(f[1]||""),m=val.match(/(?:^|\s)(?:(\d+\/\d+)\s+)?(\d{1,2}:\d{2})\s+([A-Z]{2,3})\s*(?:→|->)\s*(?:(\d+\/\d+)\s+)?(\d{1,2}:\d{2})\s+([A-Z]{2,3})/);
  if(!m)return null;
  var codes=detectAirlines(val),d1=m[1]||"",d2=m[4]||"",nextDay=!!(d1&&d2&&d1!==d2);
  var pm=val.match(/(?:~?\$|USD\s*|CAD\s*|NOK\s*|SEK\s*)\d[\d,]*/i);
  var dm=val.match(/(\d+\s*h(?:\s*\d+\s*m(?:in)?)?)/i);
  var tm=val.match(/([+-]\d+\s*h)/i);
  var aname=codes.length?codes.map(function(c){return AIRLINES[c].name;}).join(" / "):val.split(/\s+/)[0];
  return {codes:codes,airline:aname,tag:f[0],from:m[3],fromCity:IATA_CITY[m[3]]||"",to:m[6],toCity:IATA_CITY[m[6]]||"",
    dep:m[2],arr:m[5],dateDep:d1,dateArr:d2,nextDay:nextDay,dur:dm?dm[1].replace(/min/i,"m"):"",tz:tm?tm[1]:"",price:pm?pm[0]:"",direct:/直飞|nonstop|direct/i.test(val)};
}
function flightFromMove(s,dt){
  if(!s||s.t!=="move"||s.mode!=="flight"||!s.path||s.path.length<2)return null;
  var note=s.note||"",codes=detectAirlines(note),p0=String(s.path[0]).toUpperCase(),p1=String(s.path[s.path.length-1]).toUpperCase();
  var dr=s.mins?(Math.floor(s.mins/60)+"h"+(s.mins%60?" "+(s.mins%60)+"m":"")):"";
  var tm=note.match(/([+-]\s*\d+\s*h)/i),pm=note.match(/(?:~?\$|USD\s*)\d[\d,]*/i),mdStr=dt?md(dt):"";
  var aname=codes.length?codes.map(function(c){return AIRLINES[c].name;}).join(" / "):"Flight";
  return {codes:codes,airline:aname,tag:"",from:p0,fromCity:IATA_CITY[p0]||"",to:p1,toCity:IATA_CITY[p1]||"",
    dep:s.start||"",arr:s.end||"",dateDep:mdStr,dateArr:mdStr,dur:dr,tz:tm?tm[1].replace(/\s+/g,""):"",price:pm?pm[0]:"",direct:/直飞|nonstop|direct/i.test(note)};
}
var TRANSIT_OPS={
  SJ:{name:"SJ 高速铁路 · X2000",enName:"SJ High-Speed · X2000",badge:"SJ",color:"#1A7F37",tag:"高铁",enTag:"High-speed"},
  DSB:{name:"DSB 丹麦铁路",enName:"DSB Rail",badge:"DSB",color:"#B41730",tag:"城际/沿海线",enTag:"Rail"},
  PKP:{name:"PKP / SKM 波兰铁路",enName:"PKP / SKM Rail",badge:"PKP",color:"#1D4ED8",tag:"城铁/快车",enTag:"Rail"},
  FLY:{name:"Flytoget 机场快线",enName:"Flytoget Airport Express",badge:"FLY",color:"#E85D04",tag:"机场快线",enTag:"Express"},
  BYB:{name:"Bybanen 轻轨 1 号线",enName:"Bybanen Light Rail",badge:"BYB",color:"#C8102E",tag:"轻轨",enTag:"Light rail"},
  HSL:{name:"HSL 赫尔辛基电车",enName:"HSL Helsinki Tram",badge:"HSL",color:"#007AC9",tag:"电车",enTag:"Tram"},
  SL:{name:"SL 斯德哥尔摩地铁",enName:"SL Stockholm Metro",badge:"SL",color:"#0077C8",tag:"地铁",enTag:"Metro"},
  RUT:{name:"Ruter 奥斯陆电车",enName:"Ruter Oslo Tram",badge:"RUT",color:"#D90429",tag:"电车",enTag:"Tram"},
  TLLT:{name:"塔林有轨电车",enName:"Tallinn Tram",badge:"TRM",color:"#007A5E",tag:"电车",enTag:"Tram"},
  METRO_CPH:{name:"哥本哈根地铁",enName:"Copenhagen Metro",badge:"M",color:"#0F766E",tag:"地铁",enTag:"Metro"},
  TALLINK_SHIP:{name:"Tallink Silja · Silja Symphony",enName:"Tallink Silja · Silja Symphony",badge:"TS",color:"#003B71",tag:"旗舰过夜邮轮",enTag:"Overnight cruise"},
  TALLINK_FAST:{name:"Tallink Shuttle · Megastar",enName:"Tallink Shuttle · Megastar",badge:"TS",color:"#0055A4",tag:"高速快船",enTag:"Fast ferry"},
  FJORDS:{name:"The Fjords 全电动游船",enName:"The Fjords Electric Cruise",badge:"FJ",color:"#0F766E",tag:"峡湾观光船",enTag:"Fjord cruise"},
  WAX:{name:"Waxholmsbolaget 群岛船",enName:"Waxholmsbolaget",badge:"WAX",color:"#0369A1",tag:"群岛渡轮",enTag:"Archipelago ferry"},
  DJU:{name:"Djurgårdsfärjan 渡轮",enName:"Djurgårdsfärjan Ferry",badge:"SL",color:"#0077C8",tag:"市内渡轮",enTag:"City ferry"},
  BYG:{name:"Bygdøy 博物馆渡轮",enName:"Bygdøy Museum Ferry",badge:"BYG",color:"#1E40AF",tag:"博物馆渡轮",enTag:"Museum ferry"}
};
function detectTransitOp(mode,note){
  var s=note||"";
  if(mode==="ferry"){
    if(/silja\s*symphony|过夜邮轮|baltic\s*queen/i.test(s))return "TALLINK_SHIP";
    if(/megastar|mystar|tallink\s*shuttle|快船/i.test(s))return "TALLINK_FAST";
    if(/the\s*fjords|电动|纳柔依/i.test(s))return "FJORDS";
    if(/waxholm/i.test(s))return "WAX";
    if(/djurgård/i.test(s))return "DJU";
    if(/bygdø|博物馆渡轮/i.test(s))return "BYG";
    return null;
  }
  if(/\bsj\b|x2000/i.test(s))return "SJ";
  if(/flytoget|机场快线/i.test(s))return "FLY";
  if(/bybanen/i.test(s))return "BYB";
  if(/pkm|skm|malbork|城际\/区域火车|火车回格但斯克/i.test(s))return "PKP";
  if(/kystbanen|dsb|沿海火车|沿海铁路|s-tog/i.test(s))return "DSB";
  if(/地铁\s*m[234]|frederiksberg|nordhavn/i.test(s))return "METRO_CPH";
  if(/ruter|12\s*路电车/i.test(s))return "RUT";
  if(/gärdet|zinkensdamm|地铁红线/i.test(s))return "SL";
  if(/2\s*路电车|7\/9\s*路电车|hernesaari/i.test(s))return "HSL";
  if(/kadriorg|linnahall|有轨电车/i.test(s))return "TLLT";
  return null;
}
function transitFromMove(s,dt){
  if(!s||s.t!=="move"||(s.mode!=="train"&&s.mode!=="ferry")||!s.path||s.path.length<2)return null;
  var note=s.note||"",opKey=detectTransitOp(s.mode,note),op=opKey&&TRANSIT_OPS[opKey];
  var p0=s.path[0],p1=s.path[s.path.length-1];
  var n0=typeof p0==="string"?plain("[["+p0+"]]"):"",n1=typeof p1==="string"?plain("[["+p1+"]]"):"";
  var dep=s.start||"",arr=s.end||"",nextDay=false;
  if(s.mode==="ferry"&&arr==="23:59"){
    var nm=note.match(/次日\s*(\d{1,2}:\d{2})/);
    if(nm){arr=nm[1];nextDay=true;}
  }
  var minsVal=s.mins||dur(s);
  if(nextDay&&dep&&arr){
    var m1=mins(dep),m2=mins(arr);
    if(m1!=null&&m2!=null)minsVal=(1440-m1)+m2+(note.indexOf("+1")>=0?-60:0);
  }
  var dr=minsVal?(minsVal>=60?(Math.floor(minsVal/60)+"h"+(minsVal%60?" "+(minsVal%60)+"m":"")):minsVal+"m"):"";
  var tm=note.match(/([+-]\s*\d+\s*h)/i);
  var pm=note.match(/(?:€|US\$|\$)\s*\d[\d.,]*(?:\s*[–-]\s*(?:€|US\$|\$)?\d[\d.,]*)?|\d[\d,]*(?:\s*[–-]\s*\d[\d,]*)?\s*(?:SEK|NOK|DKK|EUR|PLN|USD)/i);
  var mdStr=dt?md(dt):"",arrDate=nextDay&&dt?md(addDays(dt,1)):mdStr;
  return {
    kind:s.mode,
    badge:op?op.badge:(s.mode==="ferry"?"船":"轨"),
    color:op?op.color:(s.mode==="ferry"?"#0369A1":"#1A7F37"),
    airline:op?(en()&&op.enName?op.enName:op.name):(s.mode==="ferry"?U("渡轮"):U("火车")),
    tag:op?(en()&&op.enTag?op.enTag:op.tag):"",
    fromName:n0,toName:n1,
    dep:dep,arr:arr,dateDep:mdStr,dateArr:arrDate,nextDay:nextDay,
    dur:dr,tz:tm?tm[1].replace(/\s+/g,""):"",price:pm?pm[0]:"",direct:false
  };
}
function extractFlights(s){
  if(s.flights&&s.flights.length)return {flights:s.flights,facts:s.facts||[]};
  var flights=[],rest=[];
  (s.facts||[]).forEach(function(f){var fl=parseFlightFact(f);if(fl)flights.push(fl);else rest.push(f);});
  if(!flights.length&&s.t==="move"&&s.mode==="flight"){var fm=flightFromMove(s,state.date);if(fm)flights.push(fm);}
  if(!flights.length&&s.t==="move"&&(s.mode==="train"||s.mode==="ferry")){var tm=transitFromMove(s,state.date);if(tm)flights.push(tm);}
  if(!flights.length&&s.t==="stop"&&day()&&s.i!=null){
    var segs=day().segs,nx=segs[s.i+1],pv=segs[s.i-1];
    var adj=(nx&&nx.t==="move"&&(nx.mode==="flight"||nx.mode==="ferry"||(nx.mode==="train"&&dur(nx)>=120))&&nx.path&&nx.path[0]===s.place)?nx:
            (pv&&pv.t==="move"&&(pv.mode==="flight"||pv.mode==="ferry"||(pv.mode==="train"&&dur(pv)>=120))&&pv.path&&pv.path[pv.path.length-1]===s.place)?pv:null;
    var af=adj?(adj.mode==="flight"?flightFromMove(adj,state.date):transitFromMove(adj,state.date)):null;
    if(af)flights.push(af);
  }
  return {flights:flights,facts:rest};
}
function flightCards(list){
  if(!list||!list.length)return "";
  var ICON_PLANE='<svg class="fl-plane" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>';
  var ICON_TRAIN='<svg class="fl-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h2.2l2-2h3.6l2 2H18v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>';
  var ICON_SHIP='<svg class="fl-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21c-1.39 0-2.78-.47-4-1.32-2.44 1.71-5.56 1.71-8 0C6.78 20.53 5.39 21 4 21H2v2h2c1.38 0 2.74-.35 4-.99 2.52 1.29 5.48 1.29 8 0 1.26.65 2.62.99 4 .99h2v-2h-2zM3.95 19H4c1.6 0 3.02-.88 4-2 .98 1.12 2.4 2 4 2s3.02-.88 4-2c.98 1.12 2.4 2 4 2h.05l1.89-6.68c.08-.26.06-.54-.06-.78s-.34-.42-.6-.5L20 10.62V6c0-1.1-.9-2-2-2h-3V1H9v3H6c-1.1 0-2 .9-2 2v4.62l-1.29.42c-.26.08-.48.26-.6.5s-.15.52-.06.78L3.95 19zM6 6h12v3.97L12 8 6 9.97V6z"/></svg>';
  return '<div class="fl-grid'+(list.length>1?" multi":"")+'">'+list.map(function(f){
    var isTransit=f.kind==="train"||f.kind==="ferry";
    var codes=f.codes||[],alCol=f.color||(codes[0]&&AIRLINES[codes[0]]&&AIRLINES[codes[0]].color)||"#1f5678";
    var brand=f.airline||(codes.length?codes.map(function(c){return (AIRLINES[c]||{}).name||c;}).join(" / "):"Flight");
    var logos=isTransit
      ?'<span class="fl-logo code" style="--al:'+esc(alCol)+'">'+esc(f.badge||"")+'</span>'
      :codes.map(function(c){return airlineBadge(c,brand);}).join("");
    var badges=[];
    if(isTransit&&f.tag)badges.push('<span class="fl-badge">'+esc(f.tag)+'</span>');
    else if(!isTransit&&f.direct!==false)badges.push('<span class="fl-badge">'+esc(U("直飞"))+'</span>');
    if(f.price)badges.push('<span class="fl-badge price">'+esc(money(f.price))+'</span>');
    var midMeta=[f.dur,f.tz].filter(Boolean).join(" · ");
    var midIcon=f.kind==="train"?ICON_TRAIN:(f.kind==="ferry"?ICON_SHIP:ICON_PLANE);
    var leftCode=isTransit?'<div class="fl-place">'+esc(f.fromName||"")+'</div>':'<div class="fl-iata">'+esc(f.from)+'</div>';
    var rightCode=isTransit?'<div class="fl-place">'+esc(f.toName||"")+'</div>':'<div class="fl-iata">'+esc(f.to)+'</div>';
    var fCity=isTransit?"":(f.fromCity?(UIEN[f.fromCity]&&en()?UIEN[f.fromCity]:L(f.fromCity)):"");
    var tCity=isTransit?"":(f.toCity?(UIEN[f.toCity]&&en()?UIEN[f.toCity]:L(f.toCity)):"");
    return '<div class="fl-card" style="--al:'+esc(alCol)+'">'+
      '<div class="fl-top"><div class="fl-brand"><span class="fl-logos">'+logos+'</span><span class="fl-aname">'+esc(brand)+'</span>'+(!isTransit&&f.tag?'<span class="fl-tag">· '+esc(L(f.tag))+'</span>':'')+'</div>'+
      '<div class="fl-badges">'+badges.join("")+'</div></div>'+
      '<div class="fl-route">'+
        '<div class="fl-end"><div class="fl-time">'+esc(f.dep)+'</div>'+leftCode+'<div class="fl-city">'+esc([fCity,f.dateDep||""].filter(Boolean).join(" · "))+'</div></div>'+
        '<div class="fl-mid">'+(midMeta?'<div class="fl-dur">'+esc(midMeta)+'</div>':'')+'<div class="fl-track"><span class="fl-dot"></span><span class="fl-line"></span>'+midIcon+'<span class="fl-line"></span><span class="fl-dot"></span></div></div>'+
        '<div class="fl-end right"><div class="fl-time">'+esc(f.arr)+(f.nextDay?'<sup>+1</sup>':'')+'</div>'+rightCode+'<div class="fl-city">'+esc([tCity,f.dateArr||""].filter(Boolean).join(" · "))+'</div></div>'+
      '</div></div>';
  }).join("")+'</div>';
}

function detail(s){
  var d=document.createElement("div");d.className="detail";
  var kind=s.t==="move"?"move":s.kind;
  var when=s.start?(s.end&&s.end!==s.start?s.start+"–"+s.end:s.start):"";
  var phs=s.t==="stop"?photosOf(s.place):[],h="";

  if(phs.length)h+=photoGrid(phs);
  var metaBits=[s.t==="move"?mode(s.mode):kindLabel(kind),when,s.t==="move"&&s.km?s.km+" km":""].filter(Boolean);
  if(metaBits.length)h+='<div class="mono kind-line">'+esc(metaBits.join(" · "))+'</div>';
  h+='<div class="detail-map"></div>';

  var fl=extractFlights(s);
  if(fl.flights.length)h+=flightCards(fl.flights);
  if(fl.facts.length)h+='<dl class="facts">'+fl.facts.map(function(f){return '<div><dt>'+esc(L(f[0]))+'</dt><dd>'+tx(f[1])+'</dd></div>';}).join("")+'</dl>';
  var body=s.body||s.note;if(body)h+='<p class="body">'+tx(body)+'</p>';
  if(s.tips&&s.tips.length)h+='<ul class="tips">'+s.tips.map(function(t){return '<li>'+tx(t)+'</li>';}).join("")+'</ul>';

  var sto=s.t==="stop"&&T.places[s.place]&&T.places[s.place].story;
  if(sto&&sto.length){
    h+='<section class="story"><h5>'+esc(U("背景与考据"))+'</h5><dl>'+sto.map(function(x){
      return '<div><dt>'+esc(L(x[0]))+'</dt><dd>'+tx(x[1])+'</dd></div>';
    }).join("")+'</dl></section>';
  }

  var acts=[];
  if(s.t==="stop")acts.push('<a class="btn-secondary" target="_blank" rel="noopener" href="'+esc(gPlace(s.place))+'">'+ICON.map+esc(U("在 Google 地图打开"))+' ↗</a>');
  if(s.t==="move"&&(s.mode==="drive"||s.mode==="walk"||s.mode==="bike"||s.mode==="train"||s.mode==="bus")){
    var ends=[s.path[0],s.path[s.path.length-1]].filter(function(x){return typeof x==="string";});
    if(ends.length===2)acts.push('<a class="btn-secondary" target="_blank" rel="noopener" href="'+esc(gRoute(s.path.filter(function(x){return typeof x==="string";}),s.mode==="drive"?"driving":s.mode==="walk"?"walking":s.mode==="bike"?"bicycling":"transit"))+'">'+ICON.dir+esc(U("导航"))+' ↗</a>');
  }
  acts.push('<button type="button" class="btn-secondary ask">'+ICON.ask+esc(U("询问助手"))+'</button>');
  h+='<div class="item-actions actions">'+acts.join("")+'</div>';
  d.innerHTML=h;

  function bindPhotos(){
    var cur=s.t==="stop"?photosOf(s.place):[];
    d.querySelectorAll(".d-photo[data-k]").forEach(function(fig){
      fig.addEventListener("click",function(e){
        if(e.target.closest(".credit"))return;
        var ph=cur[+fig.dataset.k];if(!ph)return;
        var g=cur.length>3?cur.map(function(p){return {s:s,ph:p,date:state.date};}):dayGallery(day());
        if(!g.length)g=cur.map(function(p){return {s:s,ph:p,date:state.date};});
        openLb(g,galleryIndex(g,ph));
      });
    });
  }
  bindPhotos();

  if(s.t==="stop"&&s.place&&SCENIC[s.kind]){
    loadGooglePhotos(s.place,function(added){
      if(!added||!d.isConnected)return;
      var cur=photosOf(s.place);if(!cur.length)return;
      var old=d.querySelector(".d-photos-block")||d.querySelector(".d-photos");
      var wrap=document.createElement("div");wrap.innerHTML=photoGrid(cur);
      var fresh=wrap.firstChild;
      if(old)old.replaceWith(fresh);else d.insertBefore(fresh,d.firstChild);
      bindPhotos();
      if(day())renderHero();
    });
  }
  if(s.t==="stop"&&s.place){
    var stopDate=state.date;
    loadPlaceInfo(s.place,function(info){
      if(!info||!d.isConnected)return;
      var badge=renderPlaceHours(info,s,stopDate);
      if(badge){var kl=d.querySelector(".kind-line");if(kl&&!d.querySelector(".g-hours"))kl.insertAdjacentHTML("afterend",badge);}
      if(info.website){
        var actsEl=d.querySelector(".actions");
        if(actsEl&&!actsEl.querySelector(".g-web")){
          var a=document.createElement("a");a.className="btn-secondary g-web";a.target="_blank";a.rel="noopener";a.href=info.website;
          a.textContent=U("官网")+" ↗";
          actsEl.insertBefore(a,actsEl.lastChild);
        }
      }
    });
  }

  d.querySelector(".ask").addEventListener("click",function(){
    if(!window.tripChat)return;
    var dt=state.date;
    if(s.t==="move"){
      window.tripChat.quote(quoteEvent(dt+" · "+s.mode.toUpperCase()+" [path=days/"+dt+"/segs/"+s.i+"]",function(){
        return {meta:md(dt)+" · "+mode(s.mode),title:moveLabel(s,true),sub:plain(s.note||s.body||"").slice(0,180),full:itemLines(s)};
      }));
    }else{
      window.tripChat.quote(quoteEvent(dt+" · STOP "+(s.num||"")+" [place="+s.place+"]",function(){
        return {meta:md(dt)+" · "+L(T.kinds[s.kind]),title:plain(s.name||"[["+s.place+"]]"),sub:plain(s.body||"").slice(0,180),full:itemLines(s)};
      }));
    }
  });
  return d;
}

function renderDayNav(){
  var i=DATES.indexOf(state.date),h="";
  [[i-1,"prev","←"],[i+1,"next","→"]].forEach(function(x){
    var d=DATES[x[0]];
    if(!d){h+="<span></span>";return;}
    var col=colorOf(d);
    var lbl=x[1]==="prev"?x[2]+" "+(en()?"DAY "+pad2(x[0]+1):"第 "+pad2(x[0]+1)+" 天")+" · "+mdPad(d)+" "+wk(d)
                         :(en()?"DAY "+pad2(x[0]+1):"第 "+pad2(x[0]+1)+" 天")+" · "+mdPad(d)+" "+wk(d)+" "+x[2];
    h+='<button type="button" class="dn '+x[1]+'" style="--c:'+esc(col)+'" data-date="'+d+'"><small>'+esc(lbl)+'</small><b>'+esc(dayLabel(d))+'</b></button>';
  });
  $("dayNav").innerHTML=h;
}
$("dayNav").addEventListener("click",function(e){
  var b=e.target.closest("[data-date]");
  if(b){setView("day",b.dataset.date);window.scrollTo({top:0,behavior:"instant"});}
});

/* ---------- Photos, Hero & Lightbox ---------- */
var UTM="utm_source=nordic_trip_2027&utm_medium=referral";
var GPHOTOS={},GPHOTOS_WAIT={},GPHOTOS_OFF=false;
var GINFO={},GINFO_WAIT={},GINFO_OFF=false;

function backendAvailable(){
  if(window.__NT_BACKEND_UP===false)return false;
  if(LOCALDEV&&!HAS_API_PARAM&&!accessCode())return false;
  return true;
}

function loadPlaceInfo(id,cb){
  if(!id||GINFO_OFF||!backendAvailable()){if(cb)cb(null);return;}
  if(GINFO[id]){if(cb)cb(GINFO[id]);return;}
  if(GINFO_WAIT[id]){if(cb)GINFO_WAIT[id].push(cb);return;}
  GINFO_WAIT[id]=cb?[cb]:[];
  fetch(planApi()+"/api/place-info/"+encodeURIComponent(id),{headers:{"X-Access-Code":accessCode()}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){
      if(j&&j.enabled===false)GINFO_OFF=true;
      var info=(j&&(j.website||j.status||(j.hours&&j.hours.periods)))?j:null;
      GINFO[id]=info||{};
      var cbs=GINFO_WAIT[id]||[];delete GINFO_WAIT[id];
      cbs.forEach(function(fn){fn(info);});
    })
    .catch(function(){var cbs=GINFO_WAIT[id]||[];delete GINFO_WAIT[id];cbs.forEach(function(fn){fn(null);});});
}

function renderPlaceHours(info,s,date){
  if(!info||s.kind==="start")return "";
  if(info.status==="CLOSED_PERMANENTLY")return '<div class="tag-chip warn g-hours">'+(en()?"Marked permanently closed (Google)":"Google 标记永久停业")+"</div>";
  if(info.status==="CLOSED_TEMPORARILY")return '<div class="tag-chip warn g-hours">'+(en()?"Marked temporarily closed (Google)":"Google 标记暂时歇业")+"</div>";
  var periods=(info.hours&&info.hours.periods)||[];
  if(!periods.length)return "";
  if(periods.length===1&&periods[0].open&&periods[0].open.day===0&&periods[0].open.hour===0&&!periods[0].close)return '<div class="tag-chip ok g-hours">'+(en()?"Open 24h":"24h 开放")+"</div>";
  var dow=new Date(date+"T12:00:00").getDay(),dn=(en()?WKEN:WK)[dow];
  var slots=periods.filter(function(p){return p.open&&p.open.day===dow;});
  var checkKind=/^(visit|city|food|shop|water)$/.test(s.kind||"");
  if(!slots.length)return '<div class="tag-chip '+(checkKind?"warn":"")+' g-hours">'+(en()?"Closed on "+dn:"周"+dn.slice(-1)+"休息")+"</div>";
  var spans=slots.map(function(p){
    var o=p.open.hour*60+(p.open.minute||0);
    var c=p.close?(p.close.day===dow?p.close.hour*60+(p.close.minute||0):1440+p.close.hour*60+(p.close.minute||0)):1440;
    return {o:o,c:c,label:pad2(p.open.hour)+":"+pad2(p.open.minute||0)+"–"+(p.close?pad2(p.close.hour)+":"+pad2(p.close.minute||0):"24:00")};
  });
  var txt=spans.map(function(x){return x.label;}).join(", ");
  var conflict=checkKind&&s.start&&!spans.some(function(x){var st=mins(s.start),enM=s.end&&s.end!==s.start?mins(s.end):st;return st>=x.o&&enM<=x.c;});
  return '<div class="tag-chip '+(conflict?"warn":"ok")+' g-hours">'+(conflict?(en()?"Hours conflict · ":"时间冲突 · "):"")+dn+" "+txt+"</div>";
}

function photosOf(id){
  var p=T&&T.places[id],base=(p&&p.photos)||[],gp=GPHOTOS[id]||[];
  if(!gp.length)return base;if(!base.length)return gp;
  var seen={},out=[];
  base.concat(gp).forEach(function(x){if(x&&x.src&&!seen[x.src]){seen[x.src]=1;out.push(x);}});
  return out;
}
function loadGooglePhotos(id,cb){
  if(!id||GPHOTOS_OFF||GPHOTOS[id]||!backendAvailable()){if(cb)cb(0);return;}
  if(GPHOTOS_WAIT[id]){if(cb)GPHOTOS_WAIT[id].push(cb);return;}
  GPHOTOS_WAIT[id]=cb?[cb]:[];
  fetch(planApi()+"/api/place-photos/"+encodeURIComponent(id),{headers:{"X-Access-Code":accessCode()}})
    .then(function(r){return r.ok?r.json():null;})
    .then(function(j){
      if(j&&j.enabled===false)GPHOTOS_OFF=true;
      var list=(j&&Array.isArray(j.photos))?j.photos:[];
      GPHOTOS[id]=list;
      var cbs=GPHOTOS_WAIT[id]||[];delete GPHOTOS_WAIT[id];
      cbs.forEach(function(fn){fn(list.length);});
    })
    .catch(function(){var cbs=GPHOTOS_WAIT[id]||[];delete GPHOTOS_WAIT[id];cbs.forEach(function(fn){fn(0);});});
}

function sized(src,w){
  if(/googleusercontent\.com|googleapis\.com/.test(src))return src;
  if(src.indexOf("images.unsplash.com")<0)return src.replace(/\/(\d+)px-/,"/"+(w<=500?500:w<=960?960:w<=1280?1280:1920)+"px-");
  var u=src.replace(/([?&])(w|q|fm|fit|auto)=[^&]*/g,"$1").replace(/&&+/g,"&").replace(/[?&]+$/,"");
  return u+(u.indexOf("?")<0?"?":"&")+"w="+w+"&q=80&fm=jpg&fit=max";
}
function img(ph,w,cls,eager){
  return '<img class="'+(cls||"")+'" src="'+esc(sized(ph.src,w))+'" width="'+(ph.w||1200)+'" height="'+(ph.h||800)+'" alt="'+esc(ph.alt||"")+'" '+(eager?'fetchpriority="high"':'loading="lazy"')+' decoding="async" onload="this.classList.add(\'ok\')">';
}
function utm(u){return u+(u.indexOf("?")<0?"?":"&")+UTM;}
function credit(ph){
  if(ph.source==="google")return '<a class="credit" href="'+esc(ph.page||"https://maps.google.com/")+'" target="_blank" rel="noopener">'+esc(U("照片："))+esc(ph.author||"Google Maps")+"</a>";
  if(ph.author_link)return '<span class="credit">'+esc(U("摄影："))+'<a href="'+esc(utm(ph.author_link))+'" target="_blank" rel="noopener">'+esc(ph.author)+'</a> / <a href="'+esc(utm("https://unsplash.com/"))+'" target="_blank" rel="noopener">Unsplash</a></span>';
  return '<a class="credit" href="'+esc(ph.page)+'" target="_blank" rel="noopener">'+esc(U("照片："))+esc(ph.author||"")+(ph.license?" · "+esc(ph.license):"")+"</a>";
}

function photoGrid(phs,optK){
  var oa=optK!=null?' data-opt-k="'+esc(optK)+'"':"";
  var show=phs.slice(0,4),extra=phs.length-show.length;
  var tag=phs.length>1?'<span class="img-tag">'+phs.length+(en()?" PHOTOS":" 张")+'</span>':"";
  return '<div class="d-photos-block" style="display:grid;gap:6px"><div class="d-photos n'+show.length+'">'+show.map(function(ph,k){
    var more=(extra>0&&k===show.length-1)?'<span class="d-photo-more">+'+extra+'</span>':"";
    return '<div class="d-photo-wrap"><figure class="img-frame d-photo"'+oa+' data-k="'+k+'">'+(k===0?tag:"")+img(ph,k?600:1200)+more+'</figure></div>';
  }).join("")+'</div><div style="display:flex;justify-content:flex-end">'+credit(show[0])+'</div></div>';
}

function dayStops(D){
  var seen={},out=[];if(!D)return out;
  D.segs.forEach(function(s){if(s.t==="stop"&&SCENIC[s.kind]&&!seen[s.place]){seen[s.place]=1;var p=photosOf(s.place)[0]||null;if(p)out.push({s:s,ph:p,date:D.date});}});
  return out;
}
function dayGallery(D){
  var out=[];if(!D)return out;
  var seen={};
  D.segs.forEach(function(s){
    if(s.t==="stop"&&SCENIC[s.kind]&&!seen[s.place]){
      seen[s.place]=1;
      photosOf(s.s?s.s.place:s.place).forEach(function(ph){out.push({s:s,ph:ph,date:D.date});});
    }
  });
  return out;
}
function galleryIndex(list,ph){for(var i=0;i<list.length;i++)if(list[i].ph===ph)return i;return 0;}
function heroOf(D){
  var ps=dayStops(D);if(!ps.length)return null;
  if(D.hero){var h=ps.filter(function(x){return x.s.place===D.hero;})[0];if(h)return h;}
  return ps.filter(function(x){return x.s.kind==="hike"||x.s.kind==="glacier"||x.s.kind==="water";})[0]||ps.filter(function(x){return x.s.kind!=="city";})[0]||ps[0];
}
function legPhotos(l){
  var seen={},out=[],ds=T.days.filter(function(D){return D.date>=l.from&&D.date<=l.to;});
  function add(x){if(x&&x.ph&&!seen[x.s.place]){seen[x.s.place]=1;out.push(x);}}
  ds.forEach(function(D){add(heroOf(D));});
  ds.forEach(function(D){dayStops(D).forEach(add);});
  return out;
}

function renderHero(){
  var D=day(),box=$("hero"),st=dayStops(D),h=D&&heroOf(D);
  if(!h){box.hidden=true;box.innerHTML="";return;}
  box.hidden=false;
  var col=KCOL[h.s.kind]||colorOf(D.date);
  var tag=(en()?"STOP ":"站 ")+pad2(h.s.num)+" · "+plain(h.s.name||"[["+h.s.place+"]]");
  var switchers=st.length>1?'<div class="hero-thumbs">'+st.map(function(x){
    return '<button type="button" class="ht'+(x.s.place===h.s.place?" on":"")+'" data-i="'+x.s.i+'" title="'+esc(plain(x.s.name||"[["+x.s.place+"]]"))+'">'+
      img(x.ph,240)+'<span>'+pad2(x.s.num)+'</span></button>';
  }).join("")+'</div>':"";
  box.innerHTML='<figure class="img-frame hero-fig" data-lb="1"><span class="img-tag"><span class="dot" style="--c:'+esc(col)+'"></span>'+esc(tag)+'</span>'+img(h.ph,1600,"hero-img",true)+'</figure>'+
    '<div class="hero-bar"><div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;font-size:12.5px"><b>'+tx(h.s.name||"[["+h.s.place+"]]")+'</b>'+credit(h.ph)+'</div>'+switchers+'</div>';
}
$("hero").addEventListener("click",function(e){
  var t=e.target.closest(".ht");if(t){select(+t.dataset.i,false);return;}
  if(e.target.closest(".credit"))return;
  if(e.target.closest("[data-lb]")){var D=day(),g=dayGallery(D);if(g.length)openLb(g,galleryIndex(g,heroOf(D).ph));}
});

/* ---------- View 3: Photographic Archive (#photosView) ---------- */
var UTIL_STOP={kef:1,osl:1,bgo:1,arn:1,cph:1,tll:1,gdn:1,hel:1,tll_airport:1,lotus_kef:1};
function archivePhotos(uniqueOnly){
  if(!T)return [];
  var out=[],seenPlace={},seenSrc={};
  T.days.forEach(function(D){
    D.segs.forEach(function(s){
      if(s.t!=="stop"||!s.place||UTIL_STOP[s.place]||!SCENIC[s.kind])return;
      var phs=photosOf(s.place);if(!phs.length)return;
      if(uniqueOnly&&seenPlace[s.place])return;
      seenPlace[s.place]=1;
      (uniqueOnly?[phs[0]]:phs).forEach(function(ph){
        if(seenSrc[ph.src])return;
        seenSrc[ph.src]=1;
        out.push({place:s.place,s:s,ph:ph,date:D.date,dayIdx:dayNum(D.date),c:D.c,kind:s.kind});
      });
    });
  });
  Object.keys(T.places).forEach(function(pid){
    if(UTIL_STOP[pid])return;
    var phs=photosOf(pid);if(!phs.length)return;
    if(uniqueOnly&&seenPlace[pid])return;
    seenPlace[pid]=1;
    var cGuess=guessPlaceCountry(pid);
    (uniqueOnly?[phs[0]]:phs).forEach(function(ph){
      if(seenSrc[ph.src])return;
      seenSrc[ph.src]=1;
      out.push({place:pid,s:{place:pid,kind:"visit"},ph:ph,date:null,dayIdx:null,c:cGuess,kind:"visit"});
    });
  });
  return out;
}

function guessPlaceCountry(pid){
  var ll=N[pid];if(!ll)return "is";
  if(ll[1]<-10)return "is";
  if(ll[0]<55.2&&ll[1]>17)return "pl";
  if(ll[0]>59.8&&ll[1]>23)return "fi";
  if(ll[1]>22)return "ee";
  if(ll[0]<56.5&&ll[1]>10&&ll[1]<16)return "dk";
  if(ll[1]>15)return "se";
  return "no";
}

function renderPhotos(){
  if(!T)return;
  var allPlates=archivePhotos(false),uniqPlates=archivePhotos(true);
  $("photosSub").textContent=allPlates.length;
  var d0=T.dates.start,d1=T.dates.end;
  var dSpanA=en()?(MON[+d0.slice(5,7)-1]+" "+(+d0.slice(8,10))):d0.replace(/-/g,".");
  var dSpanB=en()?(MON[+d1.slice(5,7)-1]+" "+(+d1.slice(8,10))+", "+d1.slice(0,4)):mdPad(d1).replace("/",".");
  $("photosDesc").textContent=U("{p} 张照片 · 覆盖 {s} 处地点 · {a} – {b}",{p:allPlates.length,s:uniqPlates.length,a:dSpanA,b:dSpanB});
  if(state.view!=="photos")return;

  var base=state.phUnique?uniqPlates:allPlates;
  var byC={},cOrder=(TRIP_STATS||calcTripStats()).countries;
  base.forEach(function(x){byC[x.c]=(byC[x.c]||0)+1;});

  var fHtml='<button type="button" role="tab" class="tab-btn" data-ph-c="all" aria-selected="'+(state.phFilter==="all")+'">'+esc(U("全部"))+' <small>'+base.length+'</small></button>';
  cOrder.forEach(function(c){
    if(!byC[c])return;
    var col=(T.countries[c]||{}).color||"#1f5678";
    var dot=state.phFilter===c?"":'<span class="dot" style="--c:'+esc(col)+'"></span>';
    fHtml+='<button type="button" role="tab" class="tab-btn" data-ph-c="'+c+'" aria-selected="'+(state.phFilter===c)+'">'+dot+esc(pn(c,true))+' <small>'+byC[c]+'</small></button>';
  });
  $("photoFilters").innerHTML=fHtml;

  $("photoMode").innerHTML=
    '<button type="button" class="seg-opt" aria-selected="'+state.phUnique+'" data-ph-u="1">'+esc(U("每处一张"))+' <small>'+uniqPlates.length+'</small></button>'+
    '<button type="button" class="seg-opt" aria-selected="'+(!state.phUnique)+'" data-ph-u="0">'+esc(U("全部照片"))+' <small>'+allPlates.length+'</small></button>';

  var shown=state.phFilter==="all"?base:base.filter(function(x){return x.c===state.phFilter;});
  ARCHIVE_CUR=shown;
  $("photoGrid").innerHTML=shown.map(function(x,k){
    var col=(T.countries[x.c]||{}).color||"#1f5678";
    var tag=x.dayIdx?(en()?"DAY "+pad2(x.dayIdx)+" · "+mdPad(x.date):"第 "+pad2(x.dayIdx)+" 天 · "+mdPad(x.date)):pn(x.c,true);
    var kindLbl=kindLabel(x.kind);
    return '<div class="plate" style="--c:'+esc(col)+'">'+
      '<figure class="img-frame" data-arch-k="'+k+'"><span class="img-tag"><span class="dot" style="--c:'+esc(col)+'"></span>'+esc(tag)+'</span>'+img(x.ph,600)+'</figure>'+
      '<div class="plate-cap">'+
        '<div class="plate-top"><span class="plate-name">'+pn(x.place)+'</span>'+
          (x.date?'<button type="button" class="text-link" style="font-size:11.5px" data-arch-go="'+esc(x.place)+'" data-date="'+esc(x.date)+'">'+esc(U("第 {n} 天 →",{n:pad2(x.dayIdx)}))+'</button>':'')+
        '</div>'+
        '<span class="mono">'+esc([pn(x.c,true),kindLbl].filter(Boolean).join(" · "))+'</span>'+
      '</div></div>';
  }).join("");

  trackImages($("photoGrid"),"archivePhotoLoad",function(a,b){return U("正在载入影像 · {a} / {b}",{a:a,b:b});});
}
var ARCHIVE_CUR=[];
$("photosView").addEventListener("click",function(e){
  var fc=e.target.closest("[data-ph-c]");if(fc){state.phFilter=fc.dataset.phC;renderPhotos();return;}
  var fu=e.target.closest("[data-ph-u]");if(fu){state.phUnique=fu.dataset.phU==="1";renderPhotos();return;}
  var go=e.target.closest("[data-arch-go]");if(go){goToPlace(go.dataset.archGo,go.dataset.date);return;}
  var fig=e.target.closest("[data-arch-k]");
  if(fig){openLb(ARCHIVE_CUR,+fig.dataset.archK||0);}
});

/* Lightbox */
var LB={list:[],i:0};
function openLb(list,i){
  if(!list||!list.length)return;
  LB.list=list;LB.i=i||0;showLb();
  $("lb").hidden=false;document.body.classList.add("lb-open");$("lbClose").focus();
}
function closeLb(){$("lb").hidden=true;document.body.classList.remove("lb-open");}
function showLb(){
  var x=LB.list[LB.i];if(!x)return;
  var im=$("lbImg");im.classList.remove("ok");im.onload=function(){im.classList.add("ok");};
  im.src=sized(x.ph.src,2000);im.alt=x.ph.alt||"";
  var pName=x.s?(x.s.name?tx(x.s.name):pn(x.s.place)):pn(x.place);
  var dt=x.date||null,dIdx=dt?dayNum(dt):null;
  $("lbCap").innerHTML='<b>'+pName+'</b>'+credit(x.ph)+
    (LB.list.length>1?'<span class="lb-n">'+pad2(LB.i+1)+' / '+pad2(LB.list.length)+'</span>':'')+
    (dt?'<button type="button" class="text-link" style="color:#67c6eb" data-lb-go="'+esc((x.s&&x.s.place)||x.place||"")+'" data-date="'+esc(dt)+'">'+esc(U("第 {n} 天 →",{n:pad2(dIdx)}))+'</button>':'');
  $("lbPrev").hidden=$("lbNext").hidden=LB.list.length<2;
}
function stepLb(d){LB.i=(LB.i+d+LB.list.length)%LB.list.length;showLb();}
$("lbClose").addEventListener("click",closeLb);
$("lbPrev").addEventListener("click",function(){stepLb(-1);});
$("lbNext").addEventListener("click",function(){stepLb(1);});
$("lbCap").addEventListener("click",function(e){
  var g=e.target.closest("[data-lb-go]");
  if(g){closeLb();goToPlace(g.dataset.lbGo,g.dataset.date);}
});
$("lb").addEventListener("click",function(e){if(e.target===this||e.target.classList.contains("lb-fig"))closeLb();});
document.addEventListener("keydown",function(e){
  if($("lb").hidden)return;
  if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();closeLb();}
  else if(e.key==="ArrowLeft"){e.preventDefault();e.stopImmediatePropagation();stepLb(-1);}
  else if(e.key==="ArrowRight"){e.preventDefault();e.stopImmediatePropagation();stepLb(1);}
},true);

function placeOf(s){
  if(!s||!T)return null;if(s.place&&T.places[s.place])return s.place;
  var hits=[];
  if(s.ll&&s.ll.length===2)Object.keys(N).forEach(function(id){var p=N[id];if(p&&Math.abs(p[0]-s.ll[0])<2e-4&&Math.abs(p[1]-s.ll[1])<2e-4)hits.push(id);});
  return hits.filter(function(id){return photosOf(id).length;})[0]||hits[0]||null;
}
function placeVisits(id){
  var out=[];
  T.days.forEach(function(D){D.segs.forEach(function(s,i){if(s.t==="stop"&&s.place===id&&!out.some(function(v){return v.date===D.date;}))out.push({date:D.date,i:i,kind:s.kind});});});
  return out;
}
function mapPlace(s){
  var id=placeOf(s);if(!id)return null;var v=placeVisits(id),phs=photosOf(id),n=names(id);
  if(!phs.length&&!v.length)return null;
  var kind=v.map(function(x){return x.kind;}).filter(function(k){return k&&T.kinds[k]&&!/^(stay|start|food|shop)$/.test(k);})[0];
  return {id:id,name:pn(id,true),local:NM!=="local"&&n.lo!==n.zh?n.lo:"",kind:kind?L(T.kinds[kind]):"",
    days:v.map(function(x){return {date:x.date,label:md(x.date)};}),
    photos:phs.map(function(ph,k){return img(ph,k?500:960);}),thumb:phs.length?img(phs[0],500):"",credit:phs.length?credit(phs[0]):""};
}
function goToPlace(id,date){
  if(DATES.indexOf(date)<0)return;
  setView("day",date);
  var D=day(),i=-1;
  if(D)D.segs.forEach(function(s,k){if(i<0&&s.t==="stop"&&s.place===id)i=k;});
  if(i>=0)select(i,false);
  else window.scrollTo({top:0,behavior:"instant"});
}

/* ---------- Pace, Bring & Day-at-a-Glance Card (#glance) ---------- */
var PACEM={drive:1.15,bus:.6,train:.6,ferry:.5,flight:.6,walk:1.1,bike:1.1},PACEK={hike:1.1,glacier:.7,city:.4,visit:.25,sight:.25,water:.3};
var PACEN=["","轻松","适中","很满"];
function pace(D){
  var p={drive:0,ride:0,foot:0,a:null,b:null,sc:0};
  D.segs.forEach(function(s){
    var m=dur(s);
    if(s.start){var a=mins(s.start),b=s.end?mins(s.end):a;if(b<a)b+=1440;if(p.a==null||a<p.a)p.a=a;if(p.b==null||b>p.b)p.b=b;}
    if(s.t==="move"){p.sc+=m/60*(PACEM[s.mode]||.6)+(s.mode==="flight"?1:0);if(s.mode==="drive")p.drive+=m;else if(s.mode==="walk"||s.mode==="bike")p.foot+=m;else p.ride+=m;}
    else{p.sc+=m/60*(PACEK[s.kind]||0);if(s.kind==="hike")p.foot+=m;}
  });
  p.span=p.a!=null?(p.b-p.a)/60:0;
  p.sc+=Math.max(0,p.span-10)*.5+(p.drive+p.ride>=360?1:0);
  if(p.a!=null){if(p.a<420)p.sc+=1;if(p.a<360)p.sc+=1;if(p.b>1260)p.sc+=.7;}
  p.lv=D.pace>=1&&D.pace<=3?Math.round(D.pace):p.sc<5.5?1:p.sc<9.5?2:3;
  return p;
}
function lvOf(d){return PACE[d]?PACE[d].lv:0;}
function paceWhy(d){
  var p=PACE[d],D=BYDATE[d],r=[];if(!p)return r;
  if(D.paceNote)r.push([99,plain(D.paceNote)]);
  if(p.drive>=90)r.push([p.drive/60,U("开车 {t}",{t:hmS(p.drive)})]);
  if(p.foot>=90)r.push([p.foot/60,U("走路 {t}",{t:hmS(p.foot)})]);
  if(p.ride>=150)r.push([p.ride/90,U("在路上 {t}",{t:hmS(p.ride)})]);
  if(p.a!=null&&p.a<420)r.push([5,U("{t} 出发",{t:fmt(p.a)})]);
  if(p.a!=null&&p.b>1260)r.push([3,U("{t} 结束",{t:fmt(p.b)})]);
  return r.sort(function(x,y){return y[0]-x[0];}).slice(0,3).map(function(x){return x[1];});
}
function fullRun(d){
  var i=DATES.indexOf(d),a=i,b=i;if(lvOf(d)!==3)return null;
  while(a>0&&lvOf(DATES[a-1])===3)a--;while(b<DATES.length-1&&lvOf(DATES[b+1])===3)b++;
  return {n:b-a+1,i:i-a+1,from:DATES[a],to:DATES[b]};
}
function paceMeter(d,tip){
  var lv=typeof d==="number"?d:lvOf(d);
  var t=tip&&typeof d==="string"?U(PACEN[lv])+(paceWhy(d).length?" · "+paceWhy(d).join(" · "):""):"";
  return '<span class="pm p'+lv+'"'+(t?' title="'+esc(t)+'"':' aria-hidden="true"')+'><i></i><i></i><i></i></span>';
}
function renderPaceSum(){
  var c=[0,0,0,0],best=null;
  DATES.forEach(function(d){c[lvOf(d)]++;var r=fullRun(d);if(r&&(!best||r.n>best.n))best=r;});
  var h='<span class="mono">'+esc(U("节奏"))+'</span>'+[1,2,3].map(function(lv){
    return '<span class="mono" style="display:inline-flex;align-items:center;gap:6px">'+paceMeter(lv)+' '+esc(U(PACEN[lv]))+' '+c[lv]+'D</span>';
  }).join("");
  if(best&&best.n>=3)h+='<button type="button" class="text-link" data-date="'+best.from+'">'+esc(U("连续 {n} 天高强度（{a}–{b}）",{n:best.n,a:md(best.from),b:md(best.to)}))+' →</button>';
  $("paceSum").innerHTML=h;
}

var SWIM=/温泉|泻湖|浴场|沙滩|海滩|lagoon|baths|beach|hot ?spring/i;
function placeText(s){var p=T.places[s.place]||{};return [s.name,s.body,s.place,p.zh,p.en,p.local].join(" ");}
function bringList(d){
  var D=BYDATE[d];if(!D)return [];
  var out=[],seen={},w=weather[d],c=T.countries[cOf(d)]||{},id=wxPlace(d),clim=(id&&T.places[id].climate)||c.climate;
  var BR_EN={"护照":"Passport","驾照和实体信用卡":"Licence & physical card","充电宝放随身行李":"Power bank in carry-on",
    "登山鞋":"Hiking boots","水和路上吃的":"Water & trail food","好走的鞋":"Walking shoes","泳衣和毛巾":"Swimsuit & towel",
    "防水外套":"Waterproof shell","手套和帽子":"Gloves & warm hat","墨镜和防晒":"Sunglasses & SPF","睡袋和防潮垫":"Sleeping bag & pad",
    "眼罩":"Sleep mask","晕船药":"Seasickness tablets","雨衣雨裤":"Rain shell","保暖层":"Thermal layer","防风外套":"Windproof layer"};
  function add(k,why){if(!seen[k]){seen[k]=1;out.push([k,esc(en()&&BR_EN[k]?BR_EN[k]:k),why||""]);}}
  function sum(f){return D.segs.reduce(function(a,s){return a+(f(s)?dur(s):0);},0);}
  function has(f){return D.segs.some(f);}
  var drives=function(X){return X&&X.segs.some(function(s){return s.mode==="drive";});};
  var flight=has(function(s){return s.mode==="flight";});
  if(flight||d===T.dates.start||d===T.dates.end||(has(function(s){return s.mode==="ferry"||s.mode==="train"||s.mode==="bus";})&&cOf(addDays(d,1))&&cOf(addDays(d,1))!==cOf(d)))add("护照","");
  if(drives(D)&&!drives(BYDATE[addDays(d,-1)]))add("驾照和实体信用卡","");
  if(flight)add("充电宝放随身行李","");
  var foot=sum(function(s){return s.kind==="hike"||s.kind==="glacier"&&dur(s)>=90||s.mode==="walk"&&dur(s)>=45;});
  if(foot>=60)add("登山鞋","");
  if(foot>=180)add("水和路上吃的","");
  var town=sum(function(s){return s.kind==="city";});
  if(foot<60&&town>=180)add("好走的鞋","");
  if(has(function(s){return s.kind==="water"&&SWIM.test(placeText(s));}))add("泳衣和毛巾","");
  if(has(function(s){return s.t==="stop"&&(/foss/.test(s.place||"")||/瀑布/.test(((T.places[s.place]||{}).zh)||""));}))add("防水外套","");
  if(has(function(s){return s.kind==="glacier"&&dur(s)>=90;})){add("手套和帽子","");add("墨镜和防晒","");}
  var boat=sum(function(s){return s.mode==="ferry";});
  if(boat>=120)add("晕船药","");
  if(w&&w!=="loading"&&w.hi!=null){
    if(w.rain>=50)add("雨衣雨裤","");if(w.hi<=10)add("保暖层","");if(w.wind/3.6>=12)add("防风外套","");
  }else if(clim&&clim.hi<=10)add("保暖层","");
  (D.bring||[]).forEach(function(x){if(!seen[x]){seen[x]=1;out.push([x,tx(x),""]);}});
  return out;
}

function wxPlace(d){var D=BYDATE[d];var id=D&&(D.wx||D.stay);if(id&&T.places[id])return id;var l=legOf(d);return l&&l.wx;}
function loadWeather(d){
  var id=wxPlace(d);if(!id||weather[d]!==undefined)return;
  var dd=daysBetween(homeToday(),d);if(dd<0||dd>15){weather[d]=null;return;}
  weather[d]="loading";var ll=N[id];
  fetch("https://api.open-meteo.com/v1/forecast?latitude="+ll[0]+"&longitude="+ll[1]+"&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&start_date="+d+"&end_date="+d)
    .then(function(r){return r.ok?r.json():Promise.reject(r.status);})
    .then(function(j){var x=j.daily;weather[d]={code:x.weather_code[0],hi:x.temperature_2m_max[0],lo:x.temperature_2m_min[0],rain:x.precipitation_probability_max[0],wind:x.wind_speed_10m_max[0]};})
    .catch(function(){weather[d]=null;})
    .then(function(){if(state.view==="day"&&state.date===d)renderGlance();});
}

function renderGlance(){
  var d=state.date,D=day(),id=wxPlace(d),c=T.countries[cOf(d)]||{};
  loadWeather(d);
  var w=weather[d],clim=(id&&T.places[id].climate)||c.climate,wxTemp="—",wxDesc="",wxMeta="",wxCode=null;
  var locName=id?pn(id,true):(en()?(c.en||""):(c.zh||""));
  if(w&&w!=="loading"&&w.hi!=null){
    wxCode=w.code;
    wxTemp=Math.round(w.hi)+"° <small>/ "+Math.round(w.lo)+"°C</small>";
    wxDesc=esc(wmo(w.code)+(locName?" · "+locName:""));
    wxMeta=[w.rain!=null?U("降水 {n}%",{n:w.rain}):"",U("风速 {n} m/s",{n:Math.round(w.wind/3.6)})].filter(Boolean).join(" · ");
  }else if(clim){
    wxTemp=clim.hi+"° <small>/ "+clim.lo+"°C</small>";
    wxDesc=esc(U("7 月常年")+(locName?" · "+locName:""));
    wxMeta=clim.rain?U("约 {n} 天有雨",{n:clim.rain}):"";
  }

  var segs=D?D.segs:[],move=0,byMode={},out=0,stopCnt=0;
  segs.forEach(function(s){
    var m=dur(s);
    if(s.t==="move"){move+=m;byMode[s.mode]=(byMode[s.mode]||0)+m;}
    else{stopCnt++;if(OUTDOORS[s.kind])out+=m;}
  });
  var dk=D?dayDriveKm(D):0;
  var sortedModes=Object.keys(byMode).sort(function(a,b){return byMode[b]-byMode[a];});
  var modeSub=sortedModes.map(function(k){return mode(k)+" "+hmS(byMode[k]);}).join(" · ");
  if(dk&&sortedModes.length===1&&byMode.drive)modeSub=dk+" km";
  var sun=id&&N[id]?sunTimes(d,N[id][0],N[id][1],tzOf(d)):null;
  var stayId=stayOf(D);
  var stayVal=stayId?pn(stayId):(d===T.dates.end?esc(U("当日返程")):"—");
  var staySub=D&&D.stayNote&&stayId?plain(D.stayNote):"";
  var sunMain=sun?(sun.polar==="day"?esc(U("极昼")):esc(hmS(sun.len))):"—";
  var sunSub=sun&&sun.rise?sun.rise+" – "+sun.set:"";

  var h='<div class="glance-top">'+
    '<div class="wx-box">'+
      '<div class="wx-icon">'+wxIconFor(wxCode,clim)+'</div>'+
      '<div style="min-width:0"><div class="wx-temp">'+wxTemp+'</div>'+
        (wxDesc?'<div class="wx-desc">'+wxDesc+'</div>':'')+
        (wxMeta?'<div class="wx-meta">'+esc(wxMeta)+'</div>':'')+
      '</div>'+
    '</div>'+
    '<dl class="stats-grid">'+
      '<div class="stat-cell"><dt>'+esc(U("交通"))+'</dt><dd>'+(D?(move?esc(hmS(move)):esc(U("不挪地方"))):"—")+'</dd>'+(modeSub?'<div class="sub">'+esc(modeSub)+'</div>':'')+'</div>'+
      '<div class="stat-cell"><dt>'+esc(U("户外"))+'</dt><dd>'+(D?esc(hmS(out)):"—")+'</dd>'+(stopCnt?'<div class="sub">'+esc(U("{n} 处站点",{n:stopCnt}))+'</div>':'')+'</div>'+
      '<div class="stat-cell"><dt>'+esc(U("日照"))+'</dt><dd>'+sunMain+'</dd>'+(sunSub?'<div class="sub tabular">'+esc(sunSub)+'</div>':'')+'</div>'+
      '<div class="stat-cell"><dt>'+esc(U("住宿"))+'</dt><dd class="txt">'+stayVal+'</dd>'+(staySub?'<div class="sub">'+esc(staySub)+'</div>':'')+'</div>'+
    '</dl>'+
  '</div>';

  if(D&&PACE[d]){
    var p=PACE[d],why=paceWhy(d),run=fullRun(d);
    h+='<div class="glance-bar'+(p.lv===3?" p3":"")+'">'+
      '<span class="glance-lbl">'+esc(U("节奏"))+'</span>'+
      paceMeter(d)+' <b>'+esc(U(PACEN[p.lv]))+'</b>'+
      (why.length?'<span style="color:var(--text-dim)">'+esc(why.join(" · "))+'</span>':'')+
      (run&&run.n>=3?'<span class="mono" style="margin-left:auto">'+esc(U("连续 {n} 天高强度（{a}–{b}）",{n:run.n,a:md(run.from),b:md(run.to)}))+'</span>':'')+
    '</div>';
  }

  if(D&&D.tips&&D.tips.length){
    h+='<div class="glance-bar"><span class="glance-lbl">'+esc(U("注意"))+'</span><ul class="tips" style="flex:1 1 260px">'+D.tips.map(function(t){return '<li>'+tx(t)+'</li>';}).join("")+'</ul></div>';
  }

  var br=D?bringList(d):[],got=(store("nt-bring")||{})[d]||{};
  if(br.length){
    h+='<div class="glance-bar"><span class="glance-lbl">'+esc(U("带上"))+'</span>'+br.map(function(x){
      var on=!!got[x[0]];
      return '<button type="button" class="tag-chip'+(on?" got":"")+'" data-bring="'+esc(x[0])+'" aria-pressed="'+on+'"'+(x[2]?' title="'+esc(x[2])+'"':'')+'>'+
        (on?ICON.check:"")+'<span>'+x[1]+'</span></button>';
    }).join("")+'</div>';
  }

  var bk=D?dayBookings(d):[];
  if(bk.length){
    h+='<div class="glance-bar"><span class="glance-lbl">'+esc(U("当日预订"))+'</span>'+bk.map(function(x){
      var fullWhat=plain(x.b.what),shortWhat=fullWhat.split(/[:：]/)[0].trim();
      return '<button type="button" class="tag-chip '+(x.done?"ok":"warn")+'" data-booking="'+esc(x.b.id)+'" title="'+esc(fullWhat)+'">'+
        '<span class="dot '+(x.done?"emerald":"amber")+'"></span><span>'+esc(shortWhat)+' · '+esc(U(x.done?"已订":"待订"))+'</span></button>';
    }).join("")+'</div>';
  }

  $("glance").innerHTML=h;
}

$("glance").addEventListener("click",function(e){
  var b=e.target.closest("[data-booking]");if(b){openBooking(b.dataset.booking);return;}
  var br=e.target.closest("[data-bring]");
  if(br){
    var all=store("nt-bring")||{},mine=all[state.date]=all[state.date]||{},k=br.dataset.bring;
    if(mine[k])delete mine[k];else mine[k]=1;
    store("nt-bring",all);
    renderGlance();
  }
});

/* ---------- View 4: Prep — Visas, Bookings, Checklists, Offline ---------- */
var PASS=store("nt-passport")||{};
function profile(){return PASS.p==="ca"?"ca":PASS.p==="cn"?"cn-"+(PASS.live||"ca"):null;}
function forMe(b){var pr=profile();return !b.who||!pr||b.who.indexOf(pr)>=0||b.who.indexOf(pr.split("-")[0])>=0;}
function shownBookings(){return T.bookings.filter(forMe);}
function passportText(){var pr=profile();return pr?(pr==="ca"?"Canadian passport":"Chinese passport, lives in "+{ca:"Canada",uk:"the UK",cn:"China"}[PASS.live||"ca"]):"";}

function setProfileKey(k){
  if(k==="all")PASS={};
  else if(k==="ca")PASS={p:"ca"};
  else PASS={p:"cn",live:k.slice(3)};
  store("nt-passport",PASS);
  renderPrep();renderHeader();renderReady();
}

function renderEntry(){
  var E=T.entry,pr=profile(),checked=store("nt-check")||{},shown=shownBookings();
  var profTabs=[
    ["all",U("全部同行人")],
    ["cn-ca",U("中国护照 · 加拿大")],
    ["cn-uk",U("中国护照 · 英国")],
    ["cn-cn",U("中国护照 · 中国")],
    ["ca",U("加拿大护照")]
  ];
  var curKey=pr||"all";
  var h='<div class="sec-head"><span class="eyebrow">'+esc(U("01 / 签证与入境"))+'</span><h2>'+esc(U("签证与入境"))+'</h2></div>';
  h+='<div class="entry-box"><div class="tab-row" role="tablist">'+profTabs.map(function(pt){
    return '<button type="button" role="tab" class="tab-btn" data-prof-tab="'+pt[0]+'" aria-selected="'+(curKey===pt[0])+'">'+esc(pt[1])+'</button>';
  }).join("")+'</div>';

  if(!pr){
    h+='<p class="entry-summary">'+esc(U("选择护照类型以筛选对应的签证、ETIAS 与入境步骤（仅保存在本设备）。"))+'</p></div>';
    return h;
  }
  var P=E.profiles[pr];
  h+='<div class="entry-summary"><b>'+tx(P.head)+'</b> · '+tx(P.sub)+'</div>';
  h+='<ol class="entry-steps">'+P.steps.map(function(st,i){
    var id="entry-"+pr+"-"+st.id,more=st.more?plain(st.more):"",long=more.length>150;
    var li='<li class="citem estep'+(st.hot?" hot":"")+'"><div class="citem-row"><label class="echeck"><input type="checkbox" data-id="'+esc(id)+'"'+(checked[id]?" checked":"")+'>';
    li+='<span class="et">'+pad2(i+1)+'. '+tx(st.t)+'</span><span class="ewhen">'+tx(st.when)+'</span></label>';
    if(long)li+='<button class="more-btn" type="button" aria-expanded="false" aria-label="Details">'+ICON.chev.replace(' class="chev"',"")+'</button>';
    li+='</div>';
    if(more||st.booking){
      li+='<div class="ebody"'+(long&&!st.booking?" hidden":"")+'>';
      if(more)li+='<p class="more-txt"'+(long?" hidden":"")+'>'+tx(st.more)+'</p>';
      if(st.booking&&shown.some(function(b){return b.id===st.booking;}))li+='<div><button type="button" class="text-link" data-open-booking="'+esc(st.booking)+'">'+esc(U("查看对应预订 →"))+'</button></div>';
      li+='</div>';
    }
    return li+'</li>';
  }).join("")+'</ol></div>';
  return h;
}

function dayBookings(d){
  var done=bookedIds();
  return T.bookings.filter(function(b){return forMe(b)&&b.days&&b.days.indexOf(d)>=0;}).map(function(b){return {b:b,done:!!done[b.id]};});
}

var OPEN_BK_ID="";
function renderPrep(){
  var today=homeToday(),done=bookedIds(),shown=shownBookings();
  $("entry").innerHTML=renderEntry();

  var now=[],later=[],booked=[];
  shown.forEach(function(b){(done[b.id]?booked:b.opens&&b.opens.slice(0,10)>today?later:now).push(b);});
  later.sort(function(a,b){return a.opens<b.opens?-1:1;});

  var nDone=booked.length,pct=shown.length?Math.round(nDone/shown.length*100):0;
  $("bookedCount").textContent=U("已订 {a} / {b}",{a:nDone,b:shown.length});
  $("prepCount").textContent=nDone+"/"+shown.length;

  var groups={all:now.concat(later).concat(booked),now:now,later:later,done:booked};
  var curList=groups[state.bkFilter]||groups.all;

  var tabsHtml=[
    ["all",U("全部"),shown.length],
    ["now",U("现在可订"),now.length],
    ["later",U("稍后开放"),later.length],
    ["done",U("已完成"),booked.length]
  ].map(function(tb){
    return '<button type="button" role="tab" class="tab-btn" data-bk-f="'+tb[0]+'" aria-selected="'+(state.bkFilter===tb[0])+'">'+esc(tb[1])+' <small>'+tb[2]+'</small></button>';
  }).join("");

  function rowHtml(b){
    var isDone=!!done[b.id],statusLbl="",dotCls="";
    if(isDone){statusLbl=U("已订");dotCls="emerald";}
    else if(b.opens){
      var dt=b.opens.slice(0,10),n=daysBetween(today,dt);
      statusLbl=n>0?mdPad(dt):U("今天开放");
      dotCls=n>0?"sky":"amber";
    }else{
      statusLbl=b.badge?L(b.badge):U("尽早");
      dotCls=b.hot?"amber":"sky";
    }
    var subBits=[b.for,b.cost].filter(Boolean).map(function(x){return tx(x);}).join(" · ");
    var isOpen=OPEN_BK_ID===b.id;

    var h='<details class="booking'+(b.hot?" hot":"")+(isDone?" done":"")+'" id="bk-'+esc(b.id)+'"'+(isOpen?" open":"")+'>';
    h+='<summary><span class="b-badge"><span class="dot '+dotCls+'"></span>'+esc(statusLbl)+'</span>';
    h+='<span class="b-main"><span class="b-title">'+tx(b.what)+'</span>'+(subBits?'<span class="b-line">'+subBits+'</span>':'')+'</span>';
    h+='<svg class="b-chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 8l5 5 5-5"/></svg></summary>';
    h+='<div class="b-body">';
    if(b.summary)h+='<p>'+tx(b.summary)+'</p>';
    if(b.select&&b.select.length)h+='<ol class="select">'+b.select.map(function(x){return '<li><small>'+esc(L(x[0]))+'</small><b>'+tx(x[1])+'</b></li>';}).join("")+'</ol>';
    var bFl=[],bRest=[];(b.key||[]).forEach(function(f){var fl=parseFlightFact(f);if(fl)bFl.push(fl);else bRest.push(f);});
    if(bFl.length)h+=flightCards(bFl);
    if(bRest.length)h+='<dl class="facts">'+bRest.map(function(f){return '<div><dt>'+esc(L(f[0]))+'</dt><dd>'+tx(f[1])+'</dd></div>';}).join("")+'</dl>';
    if(b.tip)h+='<p>'+tx(b.tip)+'</p>';

    var link=(b.links||[])[0],extraLinks=(b.links||[]).slice(1);
    var acts='<div class="b-acts">';
    if(link)acts+='<a class="btn-primary" target="_blank" rel="noopener" href="'+esc(link[1])+'">'+esc(U("打开 {w}",{w:L(link[0])}))+' ↗</a>';
    acts+=b.booked
      ?'<span class="tag-chip ok">'+esc(U("全员已订"))+'</span>'
      :'<button type="button" class="btn-secondary" data-done="'+esc(b.id)+'">'+esc(U(isDone?"取消已订":"标记已订"))+'</button>';
    extraLinks.forEach(function(l){acts+='<a class="btn-secondary" target="_blank" rel="noopener" href="'+esc(l[1])+'">'+esc(L(l[0]))+' ↗</a>';});
    acts+='<button type="button" class="btn-secondary" data-ask="'+esc(b.id)+'">'+ICON.ask+esc(U("询问助手"))+'</button>';
    acts+='</div>';
    h+=acts;
    if(b.steps&&b.steps.length)h+='<details class="allsteps"><summary>'+esc(U("展开步骤"))+' ('+b.steps.length+') ▾</summary><ol class="steps-ol">'+b.steps.map(function(s){return '<li>'+tx(s)+'</li>';}).join("")+'</ol></details>';
    h+='</div></details>';
    return h;
  }

  var listHtml=curList.length?curList.map(rowHtml).join("")
    :'<div class="card" style="padding:18px;font-size:13.5px;color:var(--text-dim)">'+esc(U("暂无该分类下的预订项目。"))+' <button type="button" class="text-link" data-bk-f="all">'+esc(U("显示全部预订 →"))+'</button></div>';

  $("bookings").innerHTML=
    '<div class="bk-bar-wrap"><div class="progress-line" role="progressbar" aria-valuemin="0" aria-valuemax="'+shown.length+'" aria-valuenow="'+nDone+'"><span style="width:'+pct+'%"></span></div>'+
    '<div class="tab-row" role="tablist">'+tabsHtml+'</div></div>'+
    '<div class="bk-list" id="bkList">'+listHtml+'</div>';

  /* Packing & Prep Checklists */
  var checked=store("nt-check")||{};
  $("prepLists").innerHTML=T.prep.map(function(card,ci){
    var items=card.items.map(function(it,ii){
      var id=it.id||(card.id||ci)+"-"+ii;
      var h='<li class="citem"><div class="citem-row"><label class="check"><input type="checkbox" data-id="'+esc(id)+'"'+(checked[id]?" checked":"")+'><span>'+tx(it.t)+'</span></label>';
      if(it.more)h+='<button class="more-btn" type="button" aria-expanded="false" aria-label="Details">'+ICON.chev.replace(' class="chev"',"")+'</button>';
      h+='</div>';
      if(it.more)h+='<div class="more" hidden>'+tx(it.more)+'</div>';
      return h+'</li>';
    }).join("");
    return '<div class="prep-card"><div class="list-head"><h3>'+esc(L(card.title))+'</h3><span class="mono" data-count="'+ci+'"></span></div><ul class="checklist" data-card="'+ci+'">'+items+'</ul></div>';
  }).join("");

  $("footnote").innerHTML=tx(T.footnote);
  renderOffline();
  $("sources").innerHTML=esc(U("资料来源："))+T.sources.concat([[U("天气数据：Open-Meteo"),"https://open-meteo.com/"]]).map(function(s){
    return '<a href="'+esc(s[1])+'" target="_blank" rel="noopener">'+esc(L(s[0]))+'</a>';
  }).join(" · ");
  countPrep();
}

function countPrep(){
  T.prep.forEach(function(card,ci){
    var c=0,list=document.querySelector('[data-card="'+ci+'"]');
    if(list)list.querySelectorAll("input").forEach(function(el){if(el.checked)c++;});
    var lab=document.querySelector('[data-count="'+ci+'"]');
    if(lab)lab.textContent=c+" / "+card.items.length;
  });
  var done=bookedIds(),shown=shownBookings(),b=shown.filter(function(x){return done[x.id];}).length;
  $("prepCount").textContent=b+"/"+shown.length;
  renderReady();
}

$("prepView").addEventListener("change",function(e){
  var id=e.target.dataset&&e.target.dataset.id;if(!id)return;
  var d=store("nt-check")||{};d[id]=e.target.checked;store("nt-check",d);countPrep();
});
$("prepView").addEventListener("click",function(e){
  var pt=e.target.closest("[data-prof-tab]");if(pt){setProfileKey(pt.dataset.profTab);return;}
  var bf=e.target.closest("[data-bk-f]");if(bf){state.bkFilter=bf.dataset.bkF;OPEN_BK_ID="";renderPrep();return;}
  var ob=e.target.closest("[data-open-booking]");if(ob){openBooking(ob.dataset.openBooking);return;}
  var mb=e.target.closest(".more-btn");
  if(mb){
    var ci=mb.closest(".citem"),p=ci.querySelector(".more")||ci.querySelector(".more-txt"),eb=ci.querySelector(".ebody");
    var on=mb.getAttribute("aria-expanded")!=="true";mb.setAttribute("aria-expanded",on);
    if(p)p.hidden=!on;if(eb&&!ci.querySelector("[data-open-booking]"))eb.hidden=!on;
    return;
  }
  var dn=e.target.closest("[data-done]");
  if(dn){
    var d=store("nt-booked")||{},id=dn.dataset.done;d[id]=!d[id];store("nt-booked",d);
    OPEN_BK_ID=d[id]?"":id;
    renderPrep();renderHeader();renderAll();
    return;
  }
  var ak=e.target.closest("[data-ask]");
  if(ak){
    var b=T.bookings.filter(function(x){return x.id===ak.dataset.ask;})[0];
    if(b&&window.tripChat)window.tripChat.ask(plain(b.what));
  }
});

function openBooking(id){
  state.bkFilter="all";OPEN_BK_ID=id;
  setView("prep");
  renderPrep();
  var el=$("bk-"+id);
  if(el)setTimeout(function(){el.scrollIntoView({block:"center",behavior:"smooth"});},40);
}

/* ---------- Map Engine (Country-Colored Route Polylines & Color-Coded Stop Badges) ---------- */
var G=null,map=null,Marker=null,lines=[],markers=[],you=null,embed=null,lMap=null,lLayer=null;
function driveOf(D){return D.segs.reduce(function(a,s){return a+(s.t==="move"&&s.mode==="drive"?dur(s):0);},0);}

function caption(){
  var S=TRIP_STATS||calcTripStats();
  var D=day(),s=state.view==="day"&&D&&state.sel!=null?D.segs[state.sel]:null;
  if(s)setCaption(s.t==="move"?moveLabel(s,true):pad2(s.num)+" · "+plain(s.name||"[["+s.place+"]]"),s.t==="move"&&dur(s)?mode(s.mode)+" "+hmS(dur(s)):"");
  else if(state.view==="day")setCaption(mdPad(state.date)+" · "+(D?plain(D.short||D.title):U("规划中")),D&&driveOf(D)?hmS(driveOf(D)):"");
  else setCaption(en()?(S.countries.length+" COUNTRIES · "+S.days+" DAYS"):(S.countries.length+" 国全程路线 · "+S.days+" 天"));
}
function setCaption(label,t){
  var c=$("mapCaption");if(!c)return;
  c.innerHTML='<span class="cap-l">'+esc(label)+'</span>'+(t?'<span class="cap-t">'+esc(t)+'</span>':'');
}

window.gm_authFailure=function(){useLeaflet();};
function useLeaflet(){
  if(lMap||embed)return;map=null;you=null;markers=[];lines=[];
  ensureLeaflet().then(function(Lf){
    if(lMap||map)return;
    var box=$("map");box.innerHTML="";
    lMap=Lf.map(box,{center:[62,5],zoom:4,minZoom:2,maxZoom:21,zoomSnap:0,zoomDelta:.75,scrollWheelZoom:false,zoomControl:false,attributionControl:true});
    Lf.control.zoom({position:"bottomright"}).addTo(lMap);
    Lf.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",{maxNativeZoom:20,maxZoom:21,attribution:"Map data &copy; Google"}).addTo(lMap);
    box.addEventListener("wheel",function(e){
      if(!lMap)return;
      e.preventDefault();e.stopPropagation();
      var dy=e.deltaMode===1?e.deltaY*24:e.deltaY;
      var k=e.ctrlKey?.018:(Math.abs(dy)>=40&&dy%1===0?.004:.0055);
      var dz=Math.max(-.45,Math.min(.45,-dy*k));if(!dz)return;
      var z=Math.max(lMap.getMinZoom(),Math.min(lMap.getMaxZoom(),lMap.getZoom()+dz));
      lMap.setZoomAround(lMap.mouseEventToContainerPoint(e),z,{animate:false});
    },{passive:false});
    lLayer=Lf.layerGroup().addTo(lMap);
    drawnFor=null;redrawMap();
    var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
  }).catch(function(){useEmbed();});
}

function useEmbed(){
  if(embed)return;map=null;lMap=null;you=null;markers=[];lines=[];
  var box=$("map");box.innerHTML="";
  embed=document.createElement("iframe");embed.title=U("行程地图");embed.setAttribute("allowfullscreen","");box.appendChild(embed);
  var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
}
var reloadEmbed=false;
function embedTo(src){if(embed&&(reloadEmbed||embed.getAttribute("src")!==src))embed.setAttribute("src",src);reloadEmbed=false;}
function ll2(p){return p[0]+","+p[1];}
function embedTail(){return "&t=k&hl="+(NM==="zh"?"zh-CN":"en")+"&output=embed";}
function embedPlace(ll,z){embedTo("https://maps.google.com/maps?q="+ll2(ll)+"&z="+z+embedTail());}
function embedRoute(stops,walk){embedTo("https://maps.google.com/maps?saddr="+ll2(stops[0])+"&daddr="+stops.slice(1).map(ll2).join("+to:")+(walk?"&dirflg=w":"")+embedTail());}
function embedArea(q,z){embedTo("https://maps.google.com/maps?q="+encodeURIComponent(q)+"&z="+z+embedTail());}

function loadMap(){
  caption();
  if(!CFG.googleMapsKey){useLeaflet();return;}
  var params={v:"weekly",key:CFG.googleMapsKey,language:"zh-CN"};
  (function(g){var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b[c].maps||(b[c].maps={}),r=new Set,e=new URLSearchParams,u=function(){return h||(h=new Promise(function(f,n){a=m.createElement("script");e.set("libraries",Array.from(r)+"");for(k in g)e.set(k.replace(/[A-Z]/g,function(t){return "_"+t[0].toLowerCase();}),g[k]);e.set("callback",c+".maps."+q);a.src="https://maps."+c+"apis.com/maps/api/js?"+e;d[q]=f;a.onerror=function(){h=n(Error(p+" could not load."));};m.head.append(a);}));};d[l]?console.warn(p+" only loads once."):d[l]=function(f){var rest=Array.from(arguments).slice(1);return r.add(f)&&u().then(function(){return d[l].apply(d,[f].concat(rest));});};})(params);
  Promise.all([google.maps.importLibrary("maps"),google.maps.importLibrary("marker"),google.maps.importLibrary("core")]).then(function(libs){
    if(embed||lMap)return;
    G=google.maps;Marker=libs[1].AdvancedMarkerElement;
    map=new libs[0].Map($("map"),{
      center:{lat:62,lng:5},zoom:4,mapId:CFG.googleMapId||"DEMO_MAP_ID",mapTypeId:"hybrid",
      disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:G.ControlPosition.RIGHT_BOTTOM},
      clickableIcons:false,gestureHandling:wide.matches?"greedy":"cooperative"
    });
    redrawMap();
    var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
  }).catch(function(){useLeaflet();});
}

function bounds(pts){var b=new G.LatLngBounds();pts.forEach(function(p){b.extend({lat:p[0],lng:p[1]});});return b;}
function fitPts(pts,maxZoom){
  if(lMap){
    if(!pts.length)return;
    lMap.invalidateSize();
    if(pts.length===1){lMap.setView(pts[0],maxZoom||13);return;}
    lMap.fitBounds(pts,{paddingTopLeft:[28,52],paddingBottomRight:[28,42],maxZoom:maxZoom||16});
    return;
  }
  if(!map||!pts.length)return;
  if(pts.length===1){map.panTo({lat:pts[0][0],lng:pts[0][1]});map.setZoom(maxZoom||13);return;}
  map.fitBounds(bounds(pts),{top:52,right:28,bottom:42,left:28});
  if(maxZoom)G.event.addListenerOnce(map,"idle",function(){if(map.getZoom()>maxZoom)map.setZoom(maxZoom);});
}
function dayPts(D){var a=[];D.segs.forEach(function(s){if(s.t==="move"&&s.mode==="flight")return;if(s.pts)a=a.concat(s.pts);else if(s.place)a.push(LL(s.place));});return a;}
function allPts(){var a=[];T.days.forEach(function(D){a=a.concat(dayPts(D));});T.legs.forEach(function(l){if(l.wx&&N[l.wx])a.push(N[l.wx]);});return a;}

var ROADS={drive:1,walk:1,bike:1};
function embedDayRoute(D){
  if(D.route)return D.route.map(LL);
  var groups=[[]],vias={};
  D.segs.forEach(function(s){
    var g=groups[groups.length-1];
    if(s.t==="move"&&!ROADS[s.mode]){groups.push([]);g=groups[groups.length-1];add(g,s.path[s.path.length-1]);return;}
    if(s.t==="move"){add(g,s.path[0]);if(s.mode==="drive")s.path.slice(1,-1).forEach(function(x){add(g,x,1);});add(g,s.path[s.path.length-1]);}
    else add(g,s.place);
  });
  function add(g,x,via){if(typeof x==="string"&&g[g.length-1]!==x){g.push(x);if(via)vias[x]=1;}}
  var best=groups.reduce(function(a,g){return g.length>a.length?g:a;},[]);
  for(var j=best.length-2;best.length>10&&j>0;j--)if(vias[best[j]])best.splice(j,1);
  if(best.length>10){var keep=[best[0]],n=best.length-1;for(var k=1;k<9;k++)keep.push(best[Math.round(k*n/9)]);keep.push(best[n]);best=keep;}
  return best.map(LL);
}

function fitView(){
  if(state.view!=="all"&&state.view!=="day")return;
  hideHikeMap();caption();redrawMap();
  var D=day();
  if(embed){
    if(state.view!=="day"){var l=legOf(state.date)||T.legs[0],c=T.countries[l.c]||{};embedArea(c.en||"Iceland",c.zoom||5);return;}
    if(!D){var lw=wxPlace(state.date);if(lw)embedPlace(N[lw],7);return;}
    var r=embedDayRoute(D);if(r.length>1)embedRoute(r);else embedPlace(LL(D.stay||D.wx||(D.segs[0]||{}).place),10);
    return;
  }
  if(state.view!=="day"){fitPts(allPts());return;}
  if(!D){var p=wxPlace(state.date);fitPts(p?[N[p]]:allPts(),7);return;}
  fitPts(dayPts(D),13);
}

function around(pts,c){return pts.concat(pts.map(function(p){return [2*c[0]-p[0],2*c[1]-p[1]];}));}
function stopOnRoute(s){
  var D=day();if(!D||s.t!=="stop"||!s.place)return null;
  var r=embedDayRoute(D),at=LL(s.place),i=-1;
  r.forEach(function(p,k){if(i<0&&p[0]===at[0]&&p[1]===at[1])i=k;});
  return r.length>1&&i>=0?{route:r,i:i,at:at}:null;
}
function optRoute(o){
  var D=day(),m=(o["in"]||{}).mode||"drive",at=o.after&&N[o.after];
  if(!D||!o.place||!N[o.place]||!ROADS[m]||!at)return null;
  var r=m==="walk"?[]:embedDayRoute(D),i=-1;
  r.forEach(function(p,k){if(i<0&&p[0]===at[0]&&p[1]===at[1])i=k;});
  return {pts:(i>=0?r.slice(0,i+1):[at]).concat([N[o.place]]).slice(-10),walk:m==="walk"};
}
function putOptMark(o){
  if(!o||!o.place||!N[o.place])return;
  var el=document.createElement("div");el.className="mk sel";
  el.style.setProperty("--k",KCOL[o.kind]||"#1f5678");
  var b=document.createElement("span");b.className="mk-badge";b.textContent="+";
  var nm=document.createElement("span");nm.className="mk-name";nm.textContent=plain(o.name||"[["+o.place+"]]");
  el.append(b,nm);
  if(lMap&&window.L){var w=document.createElement("div");w.appendChild(el);
    optMark=window.L.marker(N[o.place],{icon:window.L.divIcon({className:"l-mk",html:w,iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:1000,interactive:false}).addTo(lMap);}
  else if(map&&Marker){optMark=new Marker({map:map,position:{lat:N[o.place][0],lng:N[o.place][1]},content:el,zIndex:1000});}
}
function frameOpt(o){
  var r=optRoute(o);if(!r)frameGroup([o.place]);
  else{hideHikeMap();if(embed)embedRoute(r.pts,r.walk);else if(map||lMap)fitPts(r.pts,14);}
  putOptMark(o);
  var m=o["in"]||{};setCaption(U("可选")+" · "+plain(o.name||"[["+o.place+"]]"),m.mins&&m.mode?mode(m.mode)+" "+hmS(m.mins):"");
}
function frameOptHike(o){
  showHikeMap(o.pts,o.place&&N[o.place],16);
  putOptMark(o);
  var m=o["in"]||{};setCaption(U("可选")+" · "+plain(o.name||"[["+o.place+"]]"),m.mins&&m.mode?mode(m.mode)+" "+hmS(m.mins):"");
}
function frame(s){
  if(s&&s.t==="stop"&&(s.kind==="hike"||(s.pts&&s.pts.length>1))){caption();showHikeMap(s.pts,LL(s.place),s.zoom||16);return;}
  hideHikeMap();
  var on=stopOnRoute(s);caption();
  if(embed){
    if(on&&on.i>0){embedRoute(on.route.slice(0,on.i+1));return;}
    if(s.t==="move"){var ids=s.path.filter(function(x){return typeof x==="string";});if(s.mode==="drive"&&ids.length>1)embedRoute(ids.map(LL));else embedPlace(LL(ids[ids.length-1]),s.mode==="flight"?6:9);}
    else embedPlace(LL(s.place),s.zoom||14);
    return;
  }
  if(!map&&!lMap)return;
  if(on){fitPts(around(dayPts(day()),on.at),14);return;}
  if(s.pts&&s.pts.length>1)fitPts(s.pts,s.t==="move"?13:15);else fitPts([LL(s.place)],s.zoom||14);
}

var tLoadP=null,gHikeLines=[],lHikeLines=[],optMark=null;
function hideHikeMap(){
  gHikeLines.forEach(function(l){l.setMap(null);});gHikeLines=[];
  lHikeLines.forEach(function(l){l.remove();});lHikeLines=[];
  if(optMark){if(optMark.remove)optMark.remove();else optMark.map=null;optMark=null;}
}
function ensureLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(tLoadP)return tLoadP;
  tLoadP=new Promise(function(ok,err){
    var css=document.createElement("link");css.rel="stylesheet";css.href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css";document.head.appendChild(css);
    var js=document.createElement("script");js.src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js";
    js.onload=function(){ok(window.L);};
    js.onerror=function(){
      var js2=document.createElement("script");js2.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      js2.onload=function(){ok(window.L);};js2.onerror=err;document.head.appendChild(js2);
    };
    document.head.appendChild(js);
  });
  return tLoadP;
}
function showHikeMap(pts,center,zoom){
  hideHikeMap();
  if(embed){embedPlace(center||(pts&&pts[0]),zoom||14);return;}
  if(pts&&pts.length>1){
    if(lMap&&window.L){
      lHikeLines.push(window.L.polyline(pts,{color:"#ffffff",weight:6.5,opacity:.92,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lMap));
      lHikeLines.push(window.L.polyline(pts,{color:"#16a34a",weight:3.5,opacity:1,dashArray:"2,7",interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lMap));
    }else if(map){
      gHikeLines.push(new G.Polyline({map:map,path:pts.map(function(p){return {lat:p[0],lng:p[1]};}),strokeColor:"#ffffff",strokeOpacity:.92,strokeWeight:6,clickable:false,zIndex:900}));
    }
    fitPts(pts,zoom||16);
  }else if(center)fitPts([center],zoom||15);
}

$("fitBtn").addEventListener("click",function(){
  if(state.view==="day"&&state.sel!=null){state.sel=null;paintOpen();markSel();}
  fitView();
});

var drawnFor=null;
function gc(a,b,n){
  var r=Math.PI/180,la1=a[0]*r,lo1=a[1]*r,la2=b[0]*r,lo2=b[1]*r,out=[];
  var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((la2-la1)/2),2)+Math.cos(la1)*Math.cos(la2)*Math.pow(Math.sin((lo2-lo1)/2),2)));if(!d)return [a,b];
  for(var i=0;i<=n;i++){var f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
    var x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2),y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2),z=A*Math.sin(la1)+B*Math.sin(la2);
    out.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r,Math.atan2(y,x)/r]);}
  return out;
}
function bindTip(pl,tp){if(tp&&pl&&pl.bindTooltip)pl.bindTooltip(tp,{sticky:true,className:"rt-tip",direction:"top",offset:[0,-8]});return pl;}
function moveLine(s,col,strong,casingW,pick,tp){
  var pts=s.mode==="flight"?gc(s.pts[0],s.pts[s.pts.length-1],48):s.pts;
  var walk=s.mode==="walk"||s.mode==="bike";
  if(lMap){
    var Lf=window.L;
    if(walk){
      Lf.polyline(pts,{color:"#ffffff",weight:5,opacity:.85,interactive:false,lineCap:"round"}).addTo(lLayer);
      var lw=Lf.polyline(pts,{color:"#16a34a",weight:3,opacity:1,dashArray:"2,6",lineCap:"round"}).addTo(lLayer);
      if(pick)lw.on("click",pick);return;
    }
    if(s.mode==="flight"||s.mode==="ferry"){
      if(strong&&s.mode==="ferry")Lf.polyline(pts,{color:"rgba(255,255,255,0.7)",weight:4.2,opacity:.75,interactive:false,lineCap:"round"}).addTo(lLayer);
      var lf=bindTip(Lf.polyline(pts,{color:col,weight:strong?2.5:1.5,opacity:strong?.92:.42,dashArray:s.mode==="flight"?"6,7":"4,6",lineCap:"round"}).addTo(lLayer),tp);
      if(pick)lf.on("click",pick);return;
    }
    if(strong&&casingW){
      Lf.polyline(pts,{color:"#ffffff",weight:casingW,opacity:.9,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lLayer);
    }
    var lr=bindTip(Lf.polyline(pts,{color:col,weight:strong?3.4:1.8,opacity:strong?1:.4,interactive:!!pick,lineCap:"round",lineJoin:"round"}).addTo(lLayer),tp);
    if(pick)lr.on("click",pick);
  }
}

function redrawMap(){
  if(!map&&!lMap)return;
  var key=state.view==="day"?state.date+NM:"all"+NM;if(drawnFor===key)return;drawnFor=key;
  if(lMap){lLayer.clearLayers();markers=[];you=null;}
  else{lines.forEach(function(l){l.setMap(null);});lines=[];markers.forEach(function(m){m.map=null;});markers=[];}

  var D=state.view==="day"?day():null;
  T.days.forEach(function(X){
    var mine=D===X;
    var cCol=(T.countries[X.c]||{}).color||"#2F6C8F";
    var col=!D?cCol:(mine?"#f59e0b":"rgba(255,255,255,0.42)");
    var casingW=!D?5.2:(mine?6.5:0);
    var tp=!D?mdPad(X.date)+" · "+plain(X.short||X.title):"";
    X.segs.forEach(function(s,si){
      if(s.t!=="move"||!s.pts||s.pts.length<2)return;
      if(s.mode==="walk"||s.mode==="bike"){
        if(!mine)return;
        if(s.mode==="walk"){
          var pv=X.segs[si-1],nx=X.segs[si+1];
          if((pv&&pv.t==="stop"&&pv.pts&&pv.pts.length>1)||(nx&&nx.t==="stop"&&nx.pts&&nx.pts.length>1))return;
        }
      }
      moveLine(s,col,mine||!D,casingW,mine?function(){select(s.i);}:function(){setView("day",X.date);},tp);
    });
    if(mine)X.segs.forEach(function(s){
      if(s.t==="stop"&&s.pts&&s.pts.length>1&&lMap){
        window.L.polyline(s.pts,{color:"#ffffff",weight:5.8,opacity:.88,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lLayer);
        window.L.polyline(s.pts,{color:"#16a34a",weight:3.5,opacity:1,dashArray:"2,7",lineCap:"round",lineJoin:"round"}).addTo(lLayer).on("click",function(){select(s.i);});
      }
    });
  });

  if(D){
    var groups={};D.segs.forEach(function(s){if(s.t!=="stop")return;(groups[s.place]=groups[s.place]||[]).push(s);});
    Object.keys(groups).forEach(function(pl){
      var stops=groups[pl];
      var mCol=KCOL[stops[0].kind]||colorOf(D.date);
      addMarker(N[pl],stops.map(function(s){return pad2(s.num);}).join("·"),plain(stops[0].name||"[["+pl+"]]"),mCol,function(){
        var cur=state.sel!=null?D.segs[state.sel]:null,idx=stops.indexOf(cur),next=stops[(idx+1)%stops.length];
        select(next.i);var li=document.querySelector('#rows li[data-i="'+next.i+'"]');if(li)li.scrollIntoView({block:"nearest",behavior:"smooth"});
      }).stops=stops;
    });
  }
  if(you&&!lMap){you.map=null;you=null;}
  if(D&&liveDate()===state.date){
    var curNow=nowSeg();
    if(curNow){
      var tn=nowIn(tzOf(state.date)).mins,a0=mins(curNow.start),b0=mins(curNow.end||curNow.start);
      var pos=curNow.pts&&curNow.pts.length>1?along(curNow.pts,b0>a0?(tn-a0)/(b0-a0):1):LL(curNow.place);
      if(pos){
        var yel=document.createElement("div");yel.className="you";yel.innerHTML='<span class="you-tag">'+esc(U("现在"))+'</span>';
        if(lMap){var yw=document.createElement("div");yw.appendChild(yel);you=window.L.marker(pos,{icon:window.L.divIcon({className:"l-mk",html:yw,iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:1000,interactive:false}).addTo(lLayer);}
        else if(map&&Marker)you=new Marker({map:map,position:{lat:pos[0],lng:pos[1]},content:yel,zIndex:1000});
      }
    }
  }
  markSel();
}

function addMarker(ll,badgeTxt,nameTxt,col,onClick){
  var el=document.createElement("div");el.className="mk";
  el.style.setProperty("--k",col||"#1f5678");
  var badge=document.createElement("span");badge.className="mk-badge";badge.textContent=badgeTxt;
  var name=document.createElement("span");name.className="mk-name";name.textContent=nameTxt;
  el.append(badge,name);
  if(lMap){
    var w=document.createElement("div");w.appendChild(el);
    var lm=window.L.marker(ll,{icon:window.L.divIcon({className:"l-mk",html:w,iconSize:[0,0],iconAnchor:[0,0]}),title:nameTxt}).addTo(lLayer);
    lm.el=el;lm.nameEl=name;el.addEventListener("click",function(e){e.stopPropagation();onClick(lm);});markers.push(lm);return lm;
  }
  var m=new Marker({map:map,position:{lat:ll[0],lng:ll[1]},content:el,title:nameTxt,gmpClickable:true});
  m.el=el;m.nameEl=name;m.addEventListener("gmp-click",function(){onClick(m);});markers.push(m);return m;
}
function markSel(){
  var D=day(),sel=state.view==="day"&&D&&state.sel!=null&&D.segs[state.sel];
  markers.forEach(function(m){
    var on=!!(sel&&m.stops&&m.stops.indexOf(sel)>=0);
    m.el.classList.toggle("sel",on);
    if(on)m.nameEl.textContent=plain(sel.name||"[["+sel.place+"]]");
    if(m.setZIndexOffset)m.setZIndexOffset(on?999:0);else m.zIndex=on?999:null;
  });
}

/* ---------- Static UI, Language & Currency Switchers ---------- */
function applyStatic(){
  document.querySelectorAll("[data-i18n]").forEach(function(el){el.textContent=U(el.dataset.i18n);});
  ["placeholder","title","aria-label"].forEach(function(at){
    document.querySelectorAll("[data-i18n-"+at+"]").forEach(function(el){el.setAttribute(at,U(el.getAttribute("data-i18n-"+at)));});
  });
}
function applyNames(){
  document.querySelectorAll(".names button").forEach(function(b){b.setAttribute("aria-checked",b.dataset.nm===NM);});
}
document.querySelectorAll(".names button").forEach(function(b){
  b.addEventListener("click",function(){
    if(NM===b.dataset.nm)return;
    NM=b.dataset.nm;store("nt-names",NM);applyNames();applyTheme();rerender(true);ensureEn();
  });
});

function rerender(lang){
  var sel=state.sel;
  applyStatic();renderCur();renderHeader();renderAll();renderStrip();markStrip();renderPhotos();renderPrep();renderMoney();
  $("fitLabel").textContent=en()?(state.view==="day"?"Whole day":"Whole route"):(state.view==="day"?"全天":"全程");
  if(state.view==="day"){renderDay();if(sel!=null&&day()){state.sel=sel;paintOpen();}}
  if(lang){redrawMap();caption();document.dispatchEvent(new CustomEvent("trip:lang"));}
}

var CURS=[["local","KR","当地货币","Local currency"],["CAD","C$","加元","Canadian dollar"],["CNY","¥","人民币","Chinese yuan"],["USD","US$","美元","US dollar"]];
function renderCur(){
  $("curLabel").textContent=CUR==="local"?U("当地"):CUR;
  var h=CURS.map(function(c){
    var on=c[0]===CUR,sub=c[0]==="local"?U("按原价显示，不换算"):(FX&&FX[c[0]]?"1 "+c[1]+" ≈ "+(FX.ISK/FX[c[0]]).toFixed(c[0]==="CNY"?1:0)+" ISK":"");
    return '<button type="button" class="cur-opt" role="option" data-cur="'+c[0]+'" aria-selected="'+on+'">'+
      '<span class="cur-badge">'+esc(c[1])+'</span>'+
      '<span class="cur-txt"><b>'+esc(en()?c[3]:c[2])+(c[0]!=="local"?'<small>'+c[0]+'</small>':'')+'</b><small>'+esc(sub)+'</small></span>'+
      '<svg class="cur-check" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg></button>';
  }).join("");
  var when=FXAT?new Date(FXAT):null;
  h+='<div class="cur-foot">'+esc(when?U("汇率约数 · {d}",{d:when.toISOString().slice(0,10)}):U("汇率为约数"))+'</div>';
  $("curMenu").innerHTML=h;
}
function curOpen(on){
  var m=$("curMenu"),b=$("curBtn");if(on===!m.hidden)return;
  b.setAttribute("aria-expanded",on);$("curBox").classList.toggle("open",on);
  m.hidden=!on;
  if(on){var sel=m.querySelector('[aria-selected="true"]');(sel||m).focus({preventScroll:true});}
}
$("curBtn").addEventListener("click",function(){curOpen($("curMenu").hidden);});
$("curMenu").addEventListener("click",function(e){var o=e.target.closest(".cur-opt");if(o){if(o.dataset.cur!==CUR){CUR=o.dataset.cur;store("nt-cur",CUR);rerender(false);}renderCur();curOpen(false);$("curBtn").focus();}});
document.addEventListener("pointerdown",function(e){if(!$("curBox").contains(e.target))curOpen(false);});
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!$("curMenu").hidden)curOpen(false);});

/* ---------- View 5: Shared Expense Ledger ---------- */
var MCAT=[
  ["food","餐饮","Dining","#c46816"],
  ["groceries","超市","Groceries","#d97706"],
  ["fuel","油费","Fuel","#1f5678"],
  ["transport","交通","Transit","#2b7da3"],
  ["stay","住宿","Lodging","#6f4e96"],
  ["tickets","门票","Tickets","#2b7a52"],
  ["other","其他","Other","#647684"]
];
var MCUR=["ISK","NOK","SEK","DKK","EUR","PLN","CAD","USD","CNY"],CCUR={is:"ISK",fo:"DKK",no:"NOK",se:"SEK",ee:"EUR",fi:"EUR",pl:"PLN",dk:"DKK"},MSYM={CAD:"C$",USD:"US$",CNY:"¥",EUR:"€"};
var MNY=store("nt-money")||{people:[],items:[]},OUT=store("nt-money-out")||[],mState={status:"",err:""},mTimer=null,flushing=null,formKey=null;
function auth(){return window.tripAuth||{api:"",code:function(){return "";},setCode:function(){}};}
function settleCur(){return CUR==="local"?"CAD":CUR;}
function fxTo(v,from,to){return FX&&FX[from]&&FX[to]?v/FX[from]*FX[to]:null;}
function fmtC(v,code,typed){
  var dec=code==="ISK"?0:typed?(Math.round(v*100)%100?2:0):Math.abs(v)<1000?2:0;
  var t=(Math.round(v*Math.pow(10,dec))/Math.pow(10,dec)).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return MSYM[code]?MSYM[code]+t:t+" "+code;
}
function mcat(k){return MCAT.filter(function(c){return c[0]===k;})[0]||MCAT[MCAT.length-1];}
function mDay(){return liveDate()||homeToday();}
function mItems(){
  var del={},have={};OUT.forEach(function(o){if(o.op==="del")del[o.id]=1;});
  var list=MNY.items.filter(function(x){have[x.id]=1;return !del[x.id];});
  OUT.forEach(function(o){if(o.op==="add"&&!have[o.item.id])list.push(Object.assign({pending:true},o.item));});
  return list;
}
function balances(items){
  var sc=settleCur(),ppl={},total=0,byCat={};
  MNY.people.forEach(function(p){ppl[p]={paid:0,share:0};});
  items.forEach(function(x){
    var v=fxTo(x.amount,x.currency,sc);if(v==null)return;
    total+=v;byCat[x.cat]=(byCat[x.cat]||0)+v;
    (ppl[x.paidBy]=ppl[x.paidBy]||{paid:0,share:0}).paid+=v;
    x.split.forEach(function(p){(ppl[p]=ppl[p]||{paid:0,share:0}).share+=v/x.split.length;});
  });
  return {total:total,byCat:byCat,people:ppl};
}
function settleUp(ppl){
  var cr=[],dr=[],out=[],i=0,j=0;
  Object.keys(ppl).forEach(function(p){var n=ppl[p].paid-ppl[p].share;if(n>.01)cr.push([p,n]);else if(n<-.01)dr.push([p,-n]);});
  cr.sort(function(a,b){return b[1]-a[1];});dr.sort(function(a,b){return b[1]-a[1];});
  while(i<dr.length&&j<cr.length){var v=Math.min(dr[i][1],cr[j][1]);if(v>=.5)out.push([dr[i][0],cr[j][0],v]);dr[i][1]-=v;cr[j][1]-=v;if(dr[i][1]<.01)i++;if(cr[j][1]<.01)j++;}
  return out;
}

function mApi(path,opts){
  var A=auth();opts=opts||{};var h={"X-Access-Code":A.code()};if(opts.body)h["Content-Type"]="application/json";
  return fetch(A.api+path,{method:opts.body||opts.post?"POST":"GET",headers:h,body:opts.body?JSON.stringify(opts.body):undefined}).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){
      if(r.ok)return j;
      if(r.status===401)A.setCode(null);
      var e=new Error(j.detail||String(r.status));e.code=r.status;throw e;
    });
  });
}
function gotLedger(j){MNY={people:j.people||[],items:j.items||[]};store("nt-money",MNY);}
function offlineLedger(e){mState.status=e&&e.code===401?"code":"off";}

function loadMoney(){
  clearInterval(mTimer);
  mTimer=setInterval(function(){if(state.view==="money"&&document.visibilityState==="visible"&&backendAvailable())loadMoney();},60000);
  if(!auth().code()){mState.status="code";renderMoney();return;}
  if(!backendAvailable()){mState.status="off";renderMoney();return;}
  if(mState.status!=="ok")mState.status="loading";renderMoney();
  mApi("/api/expenses").then(function(j){gotLedger(j);mState.status="ok";return flush();}).catch(offlineLedger).then(renderMoney);
}
function flush(){
  if(flushing||!backendAvailable())return flushing||Promise.resolve();
  flushing=(function step(){
    if(!OUT.length)return Promise.resolve();
    var o=OUT[0];
    var p=o.op==="add"?mApi("/api/expenses",{body:o.item}):mApi("/api/expenses/"+encodeURIComponent(o.id)+"/delete",{post:true});
    return p.then(function(j){gotLedger(j);OUT.shift();store("nt-money-out",OUT);return step();},function(e){
      if(e.code&&e.code!==401&&e.code!==429&&e.code<500){OUT.shift();store("nt-money-out",OUT);mState.err=e.message;return step();}throw e;
    });
  })().then(function(){mState.status="ok";},offlineLedger).then(function(){flushing=null;renderMoney();});
  return flushing;
}
document.addEventListener("trip:money",function(){if(auth().code())loadMoney();});

function addExpense(item){mState.err="";OUT.push({op:"add",item:item});store("nt-money-out",OUT);renderMoney();if(auth().code())flush();}
function delExpense(id){
  mState.err="";var i=-1;OUT.forEach(function(o,k){if(o.op==="add"&&o.item.id===id)i=k;});
  if(i>=0)OUT.splice(i,1);else OUT.push({op:"del",id:id});
  store("nt-money-out",OUT);renderMoney();if(auth().code())flush();
}
function personOp(path,name){
  mState.err="";
  mApi(path,{body:{name:name}}).then(function(j){gotLedger(j);mState.status="ok";},function(e){
    mState.err=e.code===409?U("{p} 名下仍有账目，请先删除相关记录。",{p:name}):U("无法连接行程服务器。");
  }).then(renderMoney);
}

function renderMoney(){
  if(!T)return;
  var items=mItems(),sc=settleCur(),B=balances(items),st=mState.status,P=MNY.people,pend=OUT.length;
  $("moneySub").textContent=items.length?items.length:"";
  renderBudget();
  $("moneyHint").textContent=U("按 {c} 折算结算",{c:sc});

  var g="";
  if(st==="code"){
    g='<form class="mny-gate" id="mnyCode">'+
      '<p style="color:var(--text-dim);font-size:13.5px">'+esc(U("共享账本需要行程访问码才能同步团队账目。"))+'</p>'+
      '<div class="mny-row">'+
        '<input class="field" type="password" id="mnyCodeIn" autocomplete="off" placeholder="'+esc(U("输入访问码"))+'" aria-label="'+esc(U("访问码"))+'" style="width:220px">'+
        '<button class="btn-primary" type="submit">'+esc(U("解锁账本"))+'</button>'+
      '</div>'+
      '<span class="mny-err" id="mnyCodeErr" role="alert"></span></form>';
  }else if(st==="off"){
    g='<p class="mny-note warn" style="margin-bottom:12px">'+esc(U("离线模式：显示上次同步记录；新记账目将在联网后自动同步。"))+'</p>';
  }
  if(pend&&st!=="code")g+='<p class="mny-note" style="margin-bottom:10px">'+esc(U("{n} 笔改动等待同步",{n:pend}))+'</p>';
  if(mState.err)g+='<p class="mny-note warn" style="margin-bottom:10px">'+esc(mState.err)+'</p>';
  $("moneyGate").innerHTML=g;

  var locked=st==="code"&&!P.length;
  $("moneySum").hidden=locked;
  $("moneyAdd").hidden=locked||!P.length;
  $("moneyList").hidden=locked;
  $("moneyEstFallback").hidden=!locked;
  if(locked)return;

  var h='<div class="mny-box"><div class="mny-people"><span class="mono">'+esc(U("同行成员"))+'</span>'+P.map(function(p){
    return '<span class="mny-person-tag">'+esc(p)+'<button type="button" data-unperson="'+esc(p)+'" aria-label="Remove '+esc(p)+'">×</button></span>';
  }).join("")+
  '<form class="mny-row" id="mnyPerson" style="margin-left:auto"><input class="field" id="mnyPersonIn" maxlength="24" placeholder="'+esc(U("+ 添加成员"))+'" style="width:140px">'+
  '<button type="submit" class="'+(P.length?"btn-secondary":"btn-primary")+'">'+esc(U("添加"))+'</button></form></div>';

  if(!P.length){
    h+='<p class="mny-note">'+esc(U("先在上方添加同行成员，即可开始记录每笔开销与分摊。"))+'</p>';
  }else if(items.length){
    h+='<div class="mny-total-row"><span class="mono">'+esc(U("累计支出"))+' · '+esc(U("{n} 笔记录",{n:items.length}))+'</span><b>'+esc(fmtC(B.total,sc))+'</b></div>';
    h+='<ul class="mny-legend">'+MCAT.filter(function(c){return B.byCat[c[0]];}).map(function(c){
      return '<li><span class="dot" style="--c:'+c[3]+'"></span>'+esc(en()?c[2]:c[1])+' <span class="mono">'+esc(fmtC(B.byCat[c[0]],sc))+'</span></li>';
    }).join("")+'</ul>';
    h+='<table class="mny-tbl"><thead><tr><th>'+esc(U("成员"))+'</th><th>'+esc(U("已付"))+'</th><th>'+esc(U("应摊"))+'</th><th>'+esc(U("差额"))+'</th></tr></thead><tbody>'+Object.keys(B.people).map(function(p){
      var x=B.people[p],n=x.paid-x.share;
      return '<tr><td>'+esc(p)+'</td><td>'+esc(fmtC(x.paid,sc))+'</td><td>'+esc(fmtC(x.share,sc))+'</td><td class="'+(n>.5?"pos":n<-.5?"neg":"")+'">'+(n>.5?"+":n<-.5?"−":"")+esc(fmtC(Math.abs(n),sc))+'</td></tr>';
    }).join("")+'</tbody></table>';
    var tr=settleUp(B.people);
    h+='<div class="mny-settle"><span class="mono">'+esc(U("结清方案"))+'</span>'+(tr.length?'<ul>'+tr.map(function(t){
      return '<li>'+U("{a} 支付给 {b}",{a:'<b>'+esc(t[0])+'</b>',b:'<b>'+esc(t[1])+'</b>'})+' <span class="mono">'+esc(fmtC(t[2],sc))+'</span></li>';
    }).join("")+'</ul>':'<p style="font-size:13px;color:var(--text-dim)">'+esc(U("账目已平，无需转账。"))+'</p>')+'</div>';
  }
  h+='</div>';
  $("moneySum").innerHTML=h;
  renderMoneyForm();

  var byDay={};items.forEach(function(x){(byDay[x.date]=byDay[x.date]||[]).push(x);});
  $("moneyList").innerHTML=Object.keys(byDay).sort().reverse().map(function(d){
    var list=byDay[d].sort(function(a,b){return (b.ts||9e15)-(a.ts||9e15);}),D=BYDATE[d];
    var sum=list.reduce(function(a,x){return a+(fxTo(x.amount,x.currency,sc)||0);},0);
    return '<div class="mny-day"><div class="mny-dh"><span class="mono">'+mdPad(d)+' '+wk(d)+'</span>'+(D?'<span style="font-size:13px;color:var(--text-dim)">'+esc(plain(D.short||D.title))+'</span>':'')+'<small>'+esc(fmtC(sum,sc))+'</small></div><ul>'+list.map(function(x){
      var c=mcat(x.cat),v=fxTo(x.amount,x.currency,sc),all=x.split.length===P.length&&P.every(function(p){return x.split.indexOf(p)>=0;});
      var who=U("{p} 付款",{p:esc(x.paidBy)})+" · "+(all?U("全员平摊"):x.split.length===1&&x.split[0]===x.paidBy?U("个人消费"):U("{n} 人平摊（{w}）",{n:x.split.length,w:x.split.join(", ")}));
      return '<li class="mny-it"><span class="dot" style="--c:'+c[3]+'" title="'+esc(en()?c[2]:c[1])+'"></span>'+
        '<div class="mny-w"><b>'+esc(x.what)+'</b><small>'+esc(who)+(x.pending?' · '+esc(U("待同步")):"")+'</small></div>'+
        '<div class="mny-amt"><b>'+esc(fmtC(x.amount,x.currency,true))+'</b>'+(x.currency!==sc&&v!=null?'<small>≈ '+esc(fmtC(v,sc))+'</small>':'')+'</div>'+
        '<button type="button" class="mny-del" data-del="'+esc(x.id)+'" aria-label="Delete">×</button></li>';
    }).join("")+'</ul></div>';
  }).join("")||(P.length?'<p class="mny-note">'+esc(U("暂无开销记录。"))+'</p>':"");
}

function renderMoneyForm(){
  var P=MNY.people,f=$("moneyAdd"),key=P.join("\u0001")+"|"+NM;if(!P.length||key===formKey)return;formKey=key;
  var me=store("nt-me"),day0=mDay(),cur=CCUR[cOf(day0)]||"CAD";
  f.innerHTML='<span class="mono">'+esc(U("记一笔开销"))+'</span>'+
    '<input class="field" name="what" required maxlength="80" placeholder="'+esc(U("项目说明（例：Bónus 超市采购）"))+'" style="width:100%">'+
    '<div class="mny-row">'+
      '<input class="field tabular" name="amount" required inputmode="decimal" placeholder="'+esc(U("金额"))+'" style="width:130px">'+
      '<select class="field" name="currency">'+MCUR.map(function(c){return '<option'+(c===cur?' selected':'')+'>'+c+'</option>';}).join("")+'</select>'+
      '<input class="field tabular" type="date" name="date" value="'+esc(day0)+'">'+
    '</div>'+
    '<div class="mny-cats" role="radiogroup">'+MCAT.map(function(c,i){
      return '<label><input type="radio" name="cat" value="'+c[0]+'"'+(i===0?' checked':'')+'><span><i class="dot" style="--c:'+c[3]+'"></i>'+esc(en()?c[2]:c[1])+'</span></label>';
    }).join("")+'</div>'+
    '<div class="mny-row"><span class="mono">'+esc(U("谁付的"))+'</span><select class="field" name="paidBy">'+P.map(function(p){return '<option'+(p===me?' selected':'')+'>'+esc(p)+'</option>';}).join("")+'</select></div>'+
    '<div class="mny-split"><span class="mono">'+esc(U("平摊给"))+'</span>'+P.map(function(p){return '<label class="check" style="display:inline-flex;width:auto"><input type="checkbox" name="split" value="'+esc(p)+'" checked><span>'+esc(p)+'</span></label>';}).join("")+'</div>'+
    '<div class="mny-row"><button class="btn-primary" type="submit">'+esc(U("保存记录"))+'</button><span class="mny-err" id="mnyAddErr" role="alert"></span></div>';
}

$("moneyAdd").addEventListener("submit",function(e){
  e.preventDefault();var f=this,err=$("mnyAddErr");
  var amt=+String(f.amount.value).replace(/[,\s]/g,""),split=[].slice.call(f.querySelectorAll("[name=split]:checked")).map(function(x){return x.value;});
  if(!(amt>0)){err.textContent=U("请输入大于 0 的金额。");f.amount.focus();return;}
  if(!split.length){err.textContent=U("请至少选择一人分摊。");return;}
  err.textContent="";store("nt-me",f.paidBy.value);
  addExpense({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),date:f.date.value||mDay(),what:f.what.value.trim(),amount:amt,currency:f.currency.value,
    cat:(f.querySelector("[name=cat]:checked")||{}).value||"other",paidBy:f.paidBy.value,split:split,ts:Date.now()});
  f.what.value="";f.amount.value="";f.what.focus();
});
$("moneyView").addEventListener("submit",function(e){
  if(e.target.id==="mnyPerson"){e.preventDefault();var v=$("mnyPersonIn").value.trim();if(v)personOp("/api/expenses/people",v);}
  else if(e.target.id==="mnyCode"){
    e.preventDefault();var code=$("mnyCodeIn").value.trim(),er=$("mnyCodeErr"),A=auth();if(!code)return;
    er.textContent=U("验证中…");
    fetch(A.api+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
      if(r.status===401){er.textContent=U("访问码不正确。");return;}
      if(!r.ok){er.textContent=U("无法连接行程服务器。");return;}
      window.__NT_BACKEND_UP=true;A.setCode(code);loadMoney();
    },function(){er.textContent=U("无法连接行程服务器。");});
  }
});
$("moneyView").addEventListener("click",function(e){
  var bn=e.target.closest("[data-bgt-n]");if(bn){store("nt-bgt-n",+bn.dataset.bgtN);renderBudget();return;}
  var bc=e.target.closest("[data-bgt-cat]");if(bc){state.bgtFocus=state.bgtFocus===bc.dataset.bgtCat?null:bc.dataset.bgtCat;renderBudget();return;}
  var d=e.target.closest("[data-del]");if(d){var x=mItems().filter(function(i){return i.id===d.dataset.del;})[0];if(x&&confirm(U("确定删除「{w}」？",{w:x.what})))delExpense(x.id);return;}
  var u=e.target.closest("[data-unperson]");if(u&&confirm(U("确定移除成员 {p}？",{p:u.dataset.unperson})))personOp("/api/expenses/people/delete",u.dataset.unperson);
});

/* ---------- Offline Photo Cache (#offline on Prep) ---------- */
var PHOTOC="nt-photos",OFF={busy:false,have:null,done:0,todo:0,fail:0};
function allPhotos(){
  var seen={},out=[];
  Object.keys(T.places).forEach(function(k){
    photosOf(k).forEach(function(ph){var u=new URL(sized(ph.src,1200)).href;if(!seen[u]){seen[u]=1;out.push(u);}});
  });
  return out;
}
function savedUrls(c){return c.keys().then(function(ks){var have={};ks.forEach(function(r){have[r.url]=1;});return have;});}
function countPhotos(){
  if(!window.caches)return Promise.resolve(null);
  return caches.open(PHOTOC).then(savedUrls).then(function(have){return allPhotos().filter(function(u){return have[u];}).length;}).catch(function(){return null;});
}
function getPhotos(){
  if(OFF.busy)return;OFF.busy=true;OFF.done=OFF.fail=0;renderOffline();
  caches.open(PHOTOC).then(function(c){return savedUrls(c).then(function(have){
    var list=allPhotos().filter(function(u){return !have[u];}),i=0;OFF.todo=list.length;
    function next(){if(i>=list.length)return Promise.resolve();var u=list[i++];
      return fetch(u,{mode:"cors",credentials:"omit"}).then(function(r){if(!r.ok)throw new Error(r.status);return c.put(u,r);})
        .catch(function(){OFF.fail++;}).then(function(){OFF.done++;renderOffline();return next();});}
    return Promise.all([next(),next(),next(),next()]);
  });}).catch(function(){}).then(function(){OFF.busy=false;return countPhotos();}).then(function(n){OFF.have=n;renderOffline();});
}
function renderOffline(){
  var box=$("offline");if(!box||!T)return;
  var h='<div class="sec-head"><span class="eyebrow">'+esc(U("04 / 离线缓存"))+'</span><h2>'+esc(U("离线使用"))+'</h2></div>';
  if(!("serviceWorker" in navigator)||!window.caches){box.innerHTML=h;return;}
  if(OFF.have==null&&!OFF.busy)countPhotos().then(function(n){if(n!=null&&OFF.have!==n){OFF.have=n;renderOffline();}});
  var n=allPhotos().length,all=OFF.have===n;
  var pct=OFF.busy&&OFF.todo?Math.round(OFF.done/OFF.todo*100):(OFF.have!=null&&n?Math.round(OFF.have/n*100):0);

  h+='<div class="off-card">';
  if(OFF.busy){
    h+='<div class="load-bar" style="margin-top:6px"><div class="load-bar-head"><span class="mono">'+esc(U("正在下载 {a} / {b}…",{a:OFF.done,b:OFF.todo}))+'</span><span class="mono">'+pct+'%</span></div><div class="progress-line"><span style="width:'+pct+'%"></span></div></div>';
  }
  h+='<ul class="off-list">'+
    '<li><span class="off-item-l"><span class="dot emerald"></span><span>'+esc(U("行程、最近看过的天气与汇率在首次打开后自动保存在本设备"))+'</span></span></li>'+
    '<li><span class="off-item-l"><span class="dot '+(all?"emerald":"sky")+'"></span><span>'+esc(U("已缓存 {a} / {b} 张高清照片",{a:OFF.have==null?"0":OFF.have,b:n}))+
      (OFF.fail&&!OFF.busy?' · <span style="color:var(--rose)">'+esc(U("{n} 张下载失败，联网后可重试",{n:OFF.fail}))+'</span>':'')+'</span></span>'+
      (all?'':'<button type="button" class="btn-secondary" id="offGet"'+(OFF.busy?" disabled":"")+'>'+esc(OFF.busy?U("正在下载 {a} / {b}…",{a:OFF.done,b:OFF.todo}):U("下载离线照片（约 {m} MB）",{m:Math.max(1,Math.round((n-(OFF.have||0))*0.27))}))+'</button>')+
    '</li>'+
    '<li><span class="off-item-l"><span class="dot amber"></span><span>'+esc(U("地图底图与行程助手需联网；出发前请在 Google Maps 下载五国离线地图"))+'</span></span></li>'+
  '</ul></div>';
  box.innerHTML=h;
}
$("offline").addEventListener("click",function(e){if(e.target.closest("#offGet"))getPhotos();});

function paintOnline(){$("offlineBar").hidden=navigator.onLine!==false;}
addEventListener("offline",paintOnline);
addEventListener("online",paintOnline);
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register("sw.js").then(function(reg){reg.update();}).catch(function(){});
}

/* ---------- Live Plan Loading & Local Fallback ---------- */
var PLAN={rev:null,last:null},planTimer=null;
function accessCode(){try{return (JSON.parse(localStorage.getItem("nt-chat-v1"))||{}).code||"";}catch(e){return "";}}
function setAccessCode(c){
  if(window.tripAuth){window.tripAuth.setCode(c);return;}
  try{var s=JSON.parse(localStorage.getItem("nt-chat-v1"))||{};s.code=c;localStorage.setItem("nt-chat-v1",JSON.stringify(s));}catch(e){}
}
var LOCALDEV=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
var HAS_API_PARAM=!!new URLSearchParams(location.search).get("api");
function planApi(){
  var a=((window.TRIP_CONFIG||{}).apiBase||"").replace(/\/$/,""),o=new URLSearchParams(location.search).get("api");
  return o&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)?o:a;
}

var STALL=15000;
function httpErr(n){var e=new Error(n);e.code=n;return e;}
function fetchPlan(stall,progress,path){
  var c=window.AbortController?new AbortController():null,t=null;
  function wait(ms){clearTimeout(t);if(c)t=setTimeout(function(){c.abort();},ms||stall||STALL);}
  wait();
  return fetch(planApi()+(path||"/api/plan"+(en()?"":"?en=0")),{cache:"no-cache",signal:c&&c.signal,headers:{"X-Access-Code":accessCode()}}).then(function(r){
    if(!r.ok)throw httpErr(r.status);
    var total=+r.headers.get("X-Raw-Length")||0;
    if(!r.body||!r.body.getReader||!window.TextDecoder){wait(60000);return r.json();}
    var rd=r.body.getReader(),dec=new TextDecoder(),txt="",got=0;wait();
    function pump(){return rd.read().then(function(x){
      if(x.done)return JSON.parse(txt+dec.decode());
      got+=x.value.length;txt+=dec.decode(x.value,{stream:true});wait();if(progress)progress(got,total);return pump();
    });}
    return pump();
  }).then(function(p){clearTimeout(t);if(!p||!p.rev||!(path?p.en:p.trip))throw new Error("no plan");window.__NT_BACKEND_UP=true;return p;},function(e){clearTimeout(t);throw e;});
}
function kb(got,total){return Math.round(got/1024)+(total?" / "+Math.round(total/1024):"")+" KB";}

var ENREV=null,enBusy=false;
function keepPlan(p){
  PLAN={rev:p.rev,last:p.last};if(p.en){EN=p.en;ENREV=p.rev;}
  try{localStorage.setItem("nt-plan",JSON.stringify({rev:p.rev,last:p.last,trip:p.trip,en:EN,enRev:ENREV}));}catch(e){}
}
function keepEn(){
  try{var k=JSON.parse(localStorage.getItem("nt-plan"));if(k&&k.rev===PLAN.rev){k.en=EN;k.enRev=ENREV;localStorage.setItem("nt-plan",JSON.stringify(k));}}catch(e){}
}
function ensureEn(later){
  if(!PLAN.rev||ENREV===PLAN.rev||enBusy||!backendAvailable())return;
  if(later&&!en()){setTimeout(function(){ensureEn();},5000);return;}
  enBusy=true;
  fetchPlan(0,null,"/api/plan/en").then(function(j){EN=j.en;ENREV=j.rev;keepEn();if(en())rerender(true);})
    .catch(function(){}).then(function(){enBusy=false;});
}
function publishedPlan(){
  if(!LOCALDEV)return Promise.reject(new Error("offline"));
  var bar=$("bootBar"),bytes=$("bootBytes");
  if(bar)bar.style.width="65%";
  return Promise.all([
    fetch("trip.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}),
    fetch("i18n/en.json",{cache:"no-cache"}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};})
  ]).then(function(x){
    if(bar)bar.style.width="100%";if(bytes)bytes.textContent="READY";
    return {trip:x[0],en:x[1]||{}};
  });
}

function checkPlan(){
  if(navigator.onLine===false||!backendAvailable())return;
  fetch(planApi()+"/api/plan/rev",{cache:"no-store",headers:{"X-Access-Code":accessCode()}}).then(function(r){
    if(r.status===401){if(!LOCALDEV)lockOut();return null;}
    return r.ok?r.json():null;
  }).then(function(j){if(j&&j.rev&&j.rev!==PLAN.rev)return fetchPlan().then(applyPlan);}).catch(function(){});
}
function applyPlan(p){
  if(!p||p.rev===PLAN.rev)return;
  var quiet=!PLAN.rev;keepPlan(p);
  index(p.trip);
  if(DATES.indexOf(state.date)<0)state.date=DATES[0];
  var D=day();if(state.sel!=null&&(!D||state.sel>=D.segs.length))state.sel=null;
  rerender();redrawMap();caption();
  ensureEn(true);
  if(!quiet)planToast(p.last);
}
function planToast(last){
  var t=$("planToast");
  if(!t){t=document.createElement("button");t.type="button";t.id="planToast";t.className="plan-toast";document.body.appendChild(t);t.addEventListener("click",function(){t.classList.remove("show");});}
  t.innerHTML=ICON.check+'<span><b>'+esc(last&&last.by?last.by+" updated the plan":"Plan updated")+'</b>'+(last&&last.summary?' · <span class="mono">'+esc(last.summary)+'</span>':'')+'</span>';
  t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("show");},6000);
}
function watchPlan(){
  if(!backendAvailable())return;
  clearInterval(planTimer);planTimer=setInterval(function(){if(document.visibilityState==="visible")checkPlan();},60000);checkPlan();
}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&T&&backendAvailable())checkPlan();});
addEventListener("online",function(){if(T&&backendAvailable())checkPlan();});
document.addEventListener("trip:plan",function(){if(T&&backendAvailable())fetchPlan().then(applyPlan).catch(function(){});});

function lockOut(){try{localStorage.removeItem("nt-plan");}catch(e){}setAccessCode(null);location.reload();}
function showLock(msg){
  var box=$("lock");if(!box){box=document.createElement("div");box.id="lock";box.className="lock";document.body.appendChild(box);}
  document.documentElement.classList.add("locked");
  box.innerHTML='<form class="lock-card" id="lockForm"><span class="eyebrow">NORDIC TRIP 2027</span><h1>'+esc(U("北欧之旅 2027"))+'</h1>'+
    '<div class="lock-row"><input class="field" id="lockIn" type="password" autocomplete="current-password" placeholder="'+esc(U("输入访问码"))+'" aria-label="'+esc(U("访问码"))+'" required>'+
    '<button type="submit" class="btn-primary">'+esc(U("进入"))+'</button></div>'+
    '<div class="load-bar" id="lockLoad" hidden><div class="load-bar-head"><span class="mono" id="lockProgTxt"></span></div><div class="progress-line"><span id="lockProgBar" style="width:15%"></span></div></div>'+
    '<p class="lock-err" id="lockErr">'+esc(msg||"")+'</p></form>';
  var inp=$("lockIn");inp.focus();
  $("lockForm").addEventListener("submit",function(e){
    e.preventDefault();var code=inp.value.trim(),er=$("lockErr"),ll=$("lockLoad"),lt=$("lockProgTxt"),lb=$("lockProgBar");
    if(!code)return;
    er.textContent="";ll.hidden=false;lt.textContent=U("验证中…");lb.style.width="25%";
    fetch(planApi()+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
      if(r.status===401){ll.hidden=true;er.textContent=U("访问码不正确。");inp.select();return;}
      if(!r.ok){ll.hidden=true;er.textContent=U("无法连接行程服务器。");return;}
      setAccessCode(code);window.__NT_BACKEND_UP=true;lt.textContent=U("正在载入行程…");lb.style.width="45%";
      return fetchPlan(0,function(g,n){lt.textContent=U("正在载入行程…")+" "+kb(g,n);if(n)lb.style.width=Math.min(98,Math.round(g/n*100))+"%";}).then(function(p){
        keepPlan(p);box.remove();document.documentElement.classList.remove("locked");start(p);
      },function(){ll.hidden=true;er.textContent=U("无法连接行程服务器。");});
    },function(){ll.hidden=true;er.textContent=U("无法连接行程服务器。");});
  });
}

function start(p){
  if(p.en&&Object.keys(p.en).length){EN=p.en;ENREV="enRev" in p?p.enRev:p.rev;}
  if(p.rev)PLAN={rev:p.rev,last:p.last};
  boot(p.trip);watchPlan();ensureEn(true);
}

applyTheme();
applyStatic();

var kept=null;try{kept=JSON.parse(localStorage.getItem("nt-plan"));}catch(e){}
if(kept&&kept.trip&&accessCode()){
  start(kept);
}else if(LOCALDEV&&!HAS_API_PARAM&&!accessCode()){
  /* Local preview: load publishedPlan() directly without hitting remote Tailscale 401 */
  window.__NT_BACKEND_UP=false;
  publishedPlan().then(start).catch(function(e){console.error(e);});
}else if(!accessCode()&&!LOCALDEV){
  showLock();
}else{
  fetchPlan(LOCALDEV?3500:0,function(g,n){
    var bb=$("bootBytes"),br=$("bootBar");
    if(bb)bb.textContent=kb(g,n);
    if(br&&n)br.style.width=Math.min(96,Math.max(20,Math.round(g/n*100)))+"%";
  }).then(function(p){keepPlan(p);return p;}).catch(function(e){
    window.__NT_BACKEND_UP=false;
    if(e.code===401&&!LOCALDEV){setAccessCode(null);showLock();return null;}
    return publishedPlan();
  }).then(function(p){if(p)start(p);}).catch(function(e){
    console.error(e);
    var bm=$("bootMsg");if(bm)bm.textContent=U("无法连接行程服务器。");
  });
}
})();
