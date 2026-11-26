(function(){
"use strict";
/* Trip planner for a month: an overview (route ribbon, 4-week calendar, legs), one day at a time
   (day-at-a-glance card with forecast or July normals, sunrise/sunset, timeline), and the prep tab
   (bookings + checklists), next to a Google map that shows whatever you open.
   The page is in Chinese or English (中文 / EN switch). Place names are written as [[place_id]] in
   trip.json: Chinese shows the Chinese name (hover for the local spelling), English shows the local
   spelling. The rest of the English text comes from i18n/en.json, keyed by the Chinese original, and
   interface strings from UIEN below. All content comes from the trip server with the access code (see "the live plan"). */
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
var EN={}; // the plan's text in English, {"中文原文": "English"}, sent along with the plan
function L(s){return en()&&s!=null&&EN[s]!=null?EN[s]:s;}
var UIEN={
  "规划中":"Being planned","草案":"draft","现在":"NOW","下一站":"NEXT","：":": ","住 ":"Sleep: ",
  "{n} 天":"{n} days","还有 {n} 天出发":"{n} days to go","明天出发":"Leaving tomorrow","旅行第 {n} 天":"Day {n} of the trip",
  "今天可订：{w}":"Book today: {w}","明天可订：{w}":"Book tomorrow: {w}","{n} 天后可订：{w}":"Book in {n} days: {w}",
  "已排好 {a} 天，其余 {b} 天规划中":"{a} days planned, {b} still being planned","全部 {n} 天已排好":"All {n} days planned",
  "{n} 天后开放预订":"Opens in {n} days","明天开放预订":"Opens tomorrow","今天开放预订":"Opens today","现在可以订":"Open now",
  "尽早":"Early","已订":"Booked","标记已订":"Mark booked","打开 ":"Open ","问助手":"Ask","全部步骤":"All steps","展开说明":"More",
  "已订 {a} / {b} · 自己勾的只存在这台设备上，跟助手说“订好了”大家都能看到":"{a} of {b} booked · your ticks stay on this device; tell the assistant it's booked and everyone sees it",
  "签证和入境":"Visas and entry","护照和勾选只保存在这台设备上":"Your passport and ticks are saved on this device","护照":"Passport","住在":"Living in",
  "选一下你的护照，只看跟你有关的签证和入境步骤。":"Pick your passport to see only the visa and entry steps that apply to you.",
  "{p} · 住在 {l}":"{p} · living in {l}","查看预订":"See the booking","显示全部":"Show all","只看我的":"Only mine",
  "已隐藏 {n} 项只适用于其他护照的预订":"{n} bookings for other passports are hidden","已隐藏 1 项只适用于其他护照的预订":"1 booking for another passport is hidden",
  "正在显示所有护照的预订":"Showing bookings for every passport",
  "现在就能办":"Do now","之后开放":"Opens later","按开放日期排；快开放时总览页会提醒":"By opening date; the overview reminds you when one is close",
  "还没订":"Not booked yet","这天还有 1 项没订":"1 booking for this day isn't done","这天还有 {n} 项没订":"{n} bookings for this day aren't done",
  "货币和语言":"Currency and language","账本":"Expenses",
  "大家共用一本账 · 按 {c} 结算，汇率为约数":"One shared log · settled in {c} at approximate rates",
  "账本存在行程服务器上，跟行程助手用同一个访问码。":"The log lives on the trip server and uses the same access code as the assistant.",
  "连不上行程服务器。下面是这台设备上次同步的账；新记的会先存在这里，连上后自动同步。":"Can't reach the trip server. This is the log as this device last saw it; anything you add waits here and syncs once you're back online.",
  "正在载入账本…":"Loading the log…","1 笔改动等待同步":"1 change waiting to sync","{n} 笔改动等待同步":"{n} changes waiting to sync",
  "成员":"People","移除 {p}":"Remove {p}","+ 加人":"+ Add someone","加一个人":"Add a person",
  "先把一起旅行的人加进来，然后每花一笔钱就记一笔：谁付的、谁平摊。":"Add everyone on the trip, then log each expense: who paid and who shares it.",
  "一共花了":"Spent so far","{n} 笔":"{n} expenses","人":"Who","付了":"Paid","该摊":"Share","差额":"Balance",
  "怎么结清":"To settle up","{a} 给 {b}":"{a} pays {b}","现在谁也不欠谁。":"Nobody owes anybody.",
  "{p} 付":"{p} paid","大家平摊":"split by everyone","自己的":"for themselves","{n} 人平摊：{w}":"split {n} ways: {w}","等待同步":"waiting to sync",
  "删掉这笔":"Delete","还没有账。花了钱就在上面记一笔。":"Nothing logged yet. Add an expense above.",
  "记一笔":"Add an expense","买了什么？比如：Bónus 超市买菜":"What was it? e.g. groceries at Bónus","买了什么":"What","金额":"Amount","日期":"Date","类别":"Category",
  "谁付的":"Paid by","谁平摊":"Split between","记下":"Save","金额要是大于 0 的数字。":"The amount needs to be a number above 0.","至少选一个人平摊。":"Pick at least one person to share it.",
  "验证中…":"Checking…","访问码不对。":"That code didn't work.","连不上行程服务器。":"Can't reach the trip server.",
  "连不上行程服务器：这个网络可能打不开它。换个网络（Wi-Fi / 流量）或开关 VPN 再试。":"Can't reach the trip server: this network may be blocking it. Try another network (Wi-Fi / mobile data), or turn a VPN on or off.",
  "行程服务器出错了（{n}），过一会儿再试。":"The trip server had a problem ({n}). Try again in a little while.",
  "访问码没问题，正在下载行程…":"Code accepted, downloading the plan…",
  "访问码没问题，但行程没下载完（网络太慢）。到信号好一点的地方再点一次。":"The code is right, but the plan didn't finish downloading (the connection is too slow). Try again where the signal is better.",
  "删掉「{w}」这一笔？":"Delete “{w}”?","把 {p} 移出账本？":"Remove {p} from the log?",
  "{p} 还有账目，先删掉相关的几笔再移除。":"{p} still has expenses. Delete those first.",
  "连不上行程服务器，联网后才能改成员。":"Can't reach the trip server. People can be changed once you're online.",
  "资料来源：":"Sources: ","天气预报：Open-Meteo":"Forecast: Open-Meteo",
  "一步步教我怎么订「{w}」，有什么要注意的？":"Walk me through booking {w}. Anything to watch out for?",
  "全天":"Whole day","全程":"Whole trip","全程路线":"Whole route","{d}：全天":"{d}: whole day",
  "这一天还在规划中":"This day is still being planned","草案：":"Draft: ",
  "属于「{l}」（{a} – {b}）。":"Part of “{l}” ({a} – {b}). ","还没排进任何路线分段。":"Not part of any leg yet.",
  "问助手这天可以怎么安排":"Ask what to do this day",
  "{d}（{w}）还没排，按目前的路线，这天可以怎么安排？":"{d} ({w}) isn't planned yet. Given the current route, what could we do that day?",
  "交通":"Transport","户外":"Outdoors","住宿":"Stay","日落":"Sunset"," · 约 {n} 公里":" · about {n} km",
  "在 Google 地图打开":"Open in Google Maps","导航":"Directions","问问这个":"Ask about this",
  "北欧之旅 2027":"Nordic Trip 2027","访问码":"Access code","进入":"Enter","连不上行程服务器，这台设备上也还没有存过行程。有网的时候再打开一次。":"Can't reach the trip server, and this device hasn't saved the plan yet. Open it again when you're online.","回到起点":"back to the start","{n} 站":"{n} stops","走路约 {t}":"about {t} on foot","约 {n} 米":"about {n} m","约 {n} 公里":"about {n} km","导航（整条步行路线）":"Directions (whole walk)","背景和小知识":"Background & fun facts","历史":"History","冷知识":"Fun fact","名字的来历":"The name","可选":"Optional","可选 · {n}":"Optional · {n}","或":"or","没排进行程：":"Not in the plan: ",
  "晴":"Clear","晴间多云":"Partly cloudy","阴":"Overcast","雾":"Fog","毛毛雨":"Drizzle","雨":"Rain","雪":"Snow","阵雨":"Showers","阵雪":"Snow showers","雷雨":"Thunderstorms",
  " · 降水概率 {n}%":" · {n}% chance of rain","风速最高 {n} m/s":"Wind up to {n} m/s","7 月常年":"Typical July"," · 约 {n} 天有雨":" · ~{n} rainy days",
  "正在载入预报…":"Loading forecast…","出发前约 16 天出现预报":"Forecast appears ~16 days before","暂无预报":"No forecast",
  "不挪地方":"Staying put","景点、徒步、冰川、逛城":"Sights, hikes, glaciers, town","极昼":"Midnight sun","日出 {r} · 日照 {l}":"Sunrise {r} · {l} of daylight",
  "（{t}后）":" (in {t})",
  "北欧之旅":"Nordic Trip","照片：":"Photo: ","摄影：":"Photo: ","照片待定":"Photo TBD","照片":"Photo","关闭":"Close","上一张":"Previous","下一张":"Next","主导航":"Main navigation","路线":"Route","货币":"Currency","当地货币":"Local","当地":"Local","价格换算":"Currency","按原价显示，不换算":"As written, no conversion","汇率更新于 {d} · 约数":"Rates from {d} · approximate","汇率为约数":"Rates are approximate",
  "总览":"Overview","每日":"Daily","准备":"Prep","四周日历":"4-week calendar","点任意一天看当天安排":"Tap a day to see its plan","路线分段":"Route legs",
  "注意须知":"Heads-up","预订":"Bookings","前一天":"Previous day","后一天":"Next day","直飞":"Nonstop",
  "视图":"View","选择日期":"Choose a day","语言":"Language","地图":"Map","行程地图":"Trip map","看全天 / 全程":"Show the whole day / trip",
  "在 Google 地图里打开当天路线":"Open the day's route in Google Maps","行程助手":"Trip assistant","输入访问码：":"Enter the access code:",
  "访问码":"Access code","确定":"Enter","问问助手，或发张小票让它记账…":"Ask anything, or send a receipt to log it…","加图片（拍照或从相册选）":"Add a photo (camera or library)","加图片：小票、收据、截图":"Add a photo: a receipt, a bill, a screenshot","问行程助手":"Ask the trip assistant",
  "新对话":"New chat","清空对话，重新开始":"Clear this conversation and start over","关闭":"Close",
  "关闭（Esc）。关了回答也会继续。":"Close (Esc). Answers keep coming while it's closed.","问助手":"Ask","问行程助手（⌘K）":"Ask the trip assistant (⌘K)",
  "随便问 · 改行程前会先等你确认":"Ask anything · changes wait for your approval","所有对话":"All chats","历史对话":"Past chats","我是":"I'm","名字":"name","正在载入行程…":"Loading the plan…","按计划现在在这":"Here now (per plan)","Google 地图":"Google Map",
  "行程没载入（{e}）。如果是直接从硬盘打开的 index.html，请改用本地服务器：python3 -m http.server":"Couldn't load the plan ({e}). If you opened index.html from disk, serve the folder instead: python3 -m http.server",
  // pace
  "节奏":"Pace","轻松":"Easy","适中":"Moderate","很满":"Full","开车 {t}":"{t} driving","走路 {t}":"{t} on foot","在路上 {t}":"{t} in transit",
  "{t} 出发":"leave {t}","{t} 才结束":"done at {t}","从早到晚 {n} 小时":"{n} h start to finish","没有长途":"nothing long",
  "连着 {n} 天很满的第 {i} 天":"full day {i} of {n} in a row","最长连着 {n} 天很满：{a}–{b}":"Longest run of full days: {n} ({a}–{b})",
  "按开车、走路时间和起止时间估算":"Estimated from driving, time on foot, and start and finish times",
  // what to bring
  "带上":"Bring","点一下表示已装好":"Tap to mark packed","今天过境或坐飞机":"Border or flight today",
  "驾照和实体信用卡":"Driving licence and a physical credit card","今天取车":"Picking up a car today",
  "登山鞋":"Hiking boots","水和路上吃的":"Water and trail snacks","好走的鞋":"Comfortable walking shoes","逛城 {t}":"{t} around town",
  "手套和帽子":"Gloves and a hat","冰川上冷":"Cold on the ice","墨镜和防晒":"Sunglasses and sunscreen","冰面反光":"Glare off the ice","晴天":"Sunny",
  "防水外套":"Waterproof jacket","瀑布水雾大":"Waterfall spray","泳衣和毛巾":"Swimsuit and towel","要泡温泉或下水":"Hot pool or swim today",
  "睡袋和防潮垫":"Sleeping bag and mat","今晚露营":"Camping tonight","眼罩":"Eye mask","极昼，夜里也亮":"Midnight sun: bright all night",
  "零食、充电线和离线歌单":"Snacks, charging cable, offline playlist","晕船药":"Seasickness tablets","渡轮 {t}":"{t} on a ferry",
  "充电宝放随身行李":"Power bank in your carry-on","今天坐飞机":"Flying today","雨衣雨裤":"Rain jacket and trousers","降水概率 {n}%":"{n}% chance of rain",
  "保暖层":"Warm layers","最高 {n}°":"High of {n}°","防风外套":"Windproof layer","风大":"Windy",
  "加一个":"Add one","删掉":"Delete",
  "大家已订":"Booked for everyone","行程里标记了已订，大家都能看到":"Marked booked in the plan, for everyone",
  "行程更新了":"The plan was updated","{p} 刚改了行程":"{p} just changed the plan",
  // offline
  "离线使用":"Offline use","只存在这台设备上":"Saved on this device only","这个浏览器不能离线保存网页。":"This browser can't save the site for offline use.",
  "行程、上次看过的天气和汇率：打开过一次就存好了，没信号也能看":"The plan, the last forecast and exchange rates: saved after your first visit, readable with no signal",
  "照片：已存 {a} / {b} 张":"Photos: {a} of {b} saved","下载全部照片（约 {m} MB）":"Download all photos (~{m} MB)","正在下载 {a} / {b}…":"Downloading {a} of {b}…",
  "{n} 张没下载成功，有信号时再点一次":"{n} didn't download; try again with a better connection",
  "地图和行程助手要联网。出发前在 Google 地图 app 里下载冰岛、挪威、瑞典、丹麦的离线地图。":"The map and the assistant need a connection. Before you go, download offline maps of Iceland, Norway, Sweden and Denmark in the Google Maps app.",
  "离线中：行程和存好的照片都能看，地图、助手和同步要等有信号":"Offline: the plan and saved photos still work; the map, the assistant and syncing wait for signal",
  "等高线图":"Topo map","卫星徒步图":"Satellite trails","切换到等高线地形图":"Switch to topographic contour map","切回卫星徒步图":"Switch back to satellite trail view",
  // overview bento: fun numbers, readiness, budget box, crown jewels, folded legs
  "行程数字总览":"Trip by the numbers","全程跨度":"Trip span","{d} 天 · {c} 国":"{d}d · {c} countries","{n} 晚 · {k} 种货币":"{n}n · {k} currencies",
  "自驾里程":"Road-tripping","约 {h}h · {n} 趟车程":"~{h}h driving · {n} legs",
  "海陆空接力":"Air, sea & rail","{f} 飞 · {s} 船 · {t} 铁":"{f} flights · {s} boats · {t} rail","含波罗的海过夜邮轮":"Incl. Baltic night cruise","跨国航班、峡湾渡轮与火车":"Flights, ferries & trains",
  "山野与冰川":"Trails & ice","{n} 场徒步":"{n} hikes","{w} 座瀑布 · {g} 片冰川":"{w} waterfalls · {g} glaciers",
  "最北足迹":"Northernmost","{p} · 距北极圈 {k} km":"{p} · {k} km to Arctic Circle",
  "盛夏日照":"Summer daylight","约 {h} 小时":"~{h} h","日均 {a}h · {r} 日出":"~{a}h/day · {r} sunrise",
  "行前雷达":"Trip readiness","选护照看签证":"Pick passport","项已订":"booked","项现在可订":"open now","即将开放":"Opening soon","现在先盯":"Do now",
  "今天开放":"Opens today","明天开放":"Tomorrow","{n} 天后":"in {n}d","全部订好了！":"All bookings done!","清单 {a}/{b}":"Checklist {a}/{b}",
  "全部预订与准备":"All bookings & prep","今日行程":"Today on the trip","看今天":"Open today",
  "预算小账箱":"Budget box","人均全包估算":"Est. / person","{n}人":"{n}p","分摊人数":"Group split","/ 人":"/ person",
  "约 {a}–{b} / 天 · 按 {c} 折算":"~{a}–{b}/day · in {c}","点细项看包含什么 · 货币随右上角切换":"Tap a row for details · currency follows top bar",
  "机票邮轮":"Flights & sea","跨大西洋往返 + 欧内直飞 + 波罗的海过夜船 + 火车":"Transatlantic + intra-Europe flights + Baltic cruise + rail",
  "{n} 晚住宿":"{n}n stays","青旅床位、峡湾营地木屋与老城公寓":"Hostels, fjord cabins & apartments",
  "租车油费 ÷{n}":"Car & gas ÷{n}","{k} km 租车、保险、油费、停车与过路费（{n} 人平摊）":"{k} km rentals, full cover, fuel, tolls & parking (÷{n})",
  "吃饭超市":"Food & groceries","{d} 天超市采买做饭、面包房与特色正餐":"{d}d groceries, bakeries & local meals",
  "冰川门票":"Tours & sights","快艇、冰川徒步、峡湾游船、温泉与博物馆":"Zodiac, glacier hike, fjord cruise, baths & museums",
  "各国物价":"Price vibe","偏高":"High","中高":"Mid-high","回血站":"Chill",
  "账本已记 {t}（{n} 笔）":"Logged {t} ({n})","去账本":"Expenses","出发后拍小票就能自动记账平摊":"Snap receipts on the road to log & split costs",
  "高光时刻":"Crown jewels","点任意明信片直达当天该站":"Tap a postcard to jump straight to that stop","往左翻":"Scroll left","往右翻":"Scroll right",
  "展开文字与照片":"Show leg notes & photos","收起":"Hide"
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
  walk:'<svg viewBox="0 0 20 20"><circle cx="11" cy="3.8" r="1.6"/><path d="M8 18l2-5 2 2v3M10 13l1-5-3 2-1 3M11 8l2 3h2.5"/></svg>',
  down:'<svg viewBox="0 0 20 20"><path d="M10 3v10M5.5 9l4.5 4.5L14.5 9M4 16.5h12"/></svg>',
  globe:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2.2 2.2 2.2 12.8 0 15M10 2.5c-2.2 2.2-2.2 12.8 0 15"/></svg>',
  peak:'<svg viewBox="0 0 20 20"><path d="M2.5 16L8 7l3.2 4.5 2.6-3.5 3.7 8z"/><circle cx="14.5" cy="5.2" r="1.5"/></svg>',
  north:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><path d="M10 4.5l2.2 5.5-2.2 5.5-2.2-5.5z"/></svg>',
  sun:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="3.5"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.5 1.5M13.8 13.8l1.5 1.5M4.7 15.3l1.5-1.5M13.8 6.2l1.5-1.5"/></svg>',
  radar:'<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3.2"/><path d="M10 10l5.2-5.2"/></svg>',
  coin:'<svg viewBox="0 0 20 20"><rect x="2.5" y="5" width="15" height="11" rx="2.6"/><path d="M12.8 10.5h4.7"/><circle cx="13" cy="10.5" r="1"/></svg>',
  idcard:'<svg viewBox="0 0 20 20"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><circle cx="7.2" cy="9.2" r="1.6"/><path d="M4.8 13.2c.6-1.2 1.5-1.8 2.4-1.8s1.8.6 2.4 1.8M11.5 8.5h3.5M11.5 11.5h2.5"/></svg>'
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
var T,DATES=[],BYDATE={},N={},GPID={},PACE={};
var state={view:"all",date:null,sel:null},weather={};
var VIEWS={all:1,prep:1,money:1}; // tabs addressed by name in the URL (#prep); a day is #2027-07-06

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

// look-up tables for the plan: places, dates, days, pace (redone when a new version of the plan arrives)
function index(trip){
  T=trip;N={};GPID={};DATES=[];BYDATE={};PACE={};
  Object.keys(T.places).forEach(function(k){N[k]=T.places[k].ll;if(T.places[k].gid)GPID[k]=T.places[k].gid;});
  for(var d=T.dates.start;d<=T.dates.end;d=addDays(d,1))DATES.push(d);
  T.days.forEach(function(D){BYDATE[D.date]=D;var n=0;
    D.segs.forEach(function(s,i){s.i=i;if(s.t==="stop")s.num=++n;
      s.pts=s.geom?decode(s.geom):(s.t==="move"?s.path.map(LL):null);});
    (D.options||[]).forEach(function(o){o.pts=o.geom?decode(o.geom):null;});
    PACE[D.date]=pace(D);});
}
function boot(trip){
  index(trip);
  loadFx();renderCur();
  applyNames();renderHeader();renderAll();renderStrip();renderPrep();
  var h=decodeURIComponent(location.hash.slice(1)),saved=store("nt-pos")||{};
  var live=liveDate(),date=BYDATE[h]||DATES.indexOf(h)>=0?h:live||saved.date||T.dates.start;
  var view=VIEWS[h]?h:DATES.indexOf(h)>=0||live?"day":VIEWS[saved.view]||saved.view==="day"?saved.view:"all"; // a tab that no longer exists (候选) opens the overview
  setView(view,date);
  loadMap();
  if(OUT.length&&auth().code())flush(); // expenses logged offline last time go out as soon as the page is back
  paintOnline();
  setInterval(function(){if(state.view==="day"&&liveDate()===state.date)renderGlance();},60000);
  window.addEventListener("hashchange",function(){var h=decodeURIComponent(location.hash.slice(1));
    if(DATES.indexOf(h)>=0&&!(state.view==="day"&&state.date===h))setView("day",h);else if(VIEWS[h]&&state.view!==h)setView(h);});
  window.tripApp={context:function(){var c=viewContext(),pp=passportText();if(pp)c.passport=pp;return c;},
    lang:function(){return en()?"en":"zh";},
    place:mapPlace,
    photos:function(id,k){var phs=photosOf(id);if(phs.length)openLb(phs.map(function(ph){return {s:{place:id},ph:ph};}),k||0);},
    goTo:goToPlace};
  function viewContext(){var D=day(),s=D&&state.sel!=null?D.segs[state.sel]:null;
    var lang=en()?"en":"zh",curTxt=curContext();
    if(state.view==="prep")return {lang:lang,currency:curTxt,day:"Prep tab",looking_at:"visas, bookings and checklists"};
    if(state.view==="all")return {lang:lang,currency:curTxt,day:"Overview",looking_at:"the trip summary numbers, readiness & deadlines, budget estimate, crown-jewel highlights, calendar and route legs"};
    if(state.view==="money")return {lang:lang,currency:curTxt,day:"Expenses tab",looking_at:"the group's shared expense log"};
    return {lang:lang,currency:curTxt,day:state.date+" · "+(D?plain(D.title):"being planned"),looking_at:s?(s.t==="move"?mode(s.mode)+" "+moveLabel(s,true):s.num+". "+plain(s.name||"[["+s.place+"]]")+(s.start?" ("+s.start+")":"")):"the whole day"};}
  document.dispatchEvent(new CustomEvent("trip:view"));
}

/* ---------- header ---------- */
// booked: marked in the plan for everyone (through the assistant), or ticked on this device
function bookedIds(){var d=store("nt-booked")||{},o={};T.bookings.forEach(function(b){if(b.booked||d[b.id])o[b.id]=1;});return o;}
function nextBooking(){var today=homeToday(),done=bookedIds();
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

/* ---------- overview: fun numbers, bento (readiness + budget), crown jewels, calendar, folded legs ---------- */
var CFLAG={is:"🇮🇸",fo:"🇫🇴",no:"🇳🇴",se:"🇸🇪",ee:"🇪🇪",dk:"🇩🇰"};
var CVIBE={is:[4,"偏高"],fo:[4,"偏高"],no:[4,"偏高"],dk:[3,"中高"],se:[3,"中高"],ee:[2,"回血站"]};
var BGT_CAT=null,TRIP_STATS=null;

function calcTripStats(){
  var days=DATES.length,nights=Math.max(1,days-1),cList=[],cSeen={},curMap={is:"ISK",fo:"DKK",no:"NOK",se:"SEK",ee:"EUR",dk:"DKK"},curSeen={};
  DATES.forEach(function(d){var c=cOf(d);if(c&&!cSeen[c]){cSeen[c]=1;cList.push(c);}if(c&&curMap[c])curSeen[curMap[c]]=1;});
  var driveKm=0,driveMins=0,driveCnt=0,flights=0,ferries=0,trains=0,hikes=0,wfSet={},glSet={};
  var maxLat=-90,northDate=DATES[0],northStopId=null,northStopLat=-90,bossDate=null,ferryDate=null;
  T.days.forEach(function(D){
    var dayMax=-90,dayStop=null,dayStopLat=-90;
    D.segs.forEach(function(s){
      var m=dur(s);
      if(s.t==="move"){
        if(s.mode==="drive"){driveCnt++;driveMins+=m;var k=s.km||0;
          if(!k&&s.pts&&s.pts.length>1){for(var p=1;p<s.pts.length;p++)k+=km(s.pts[p-1],s.pts[p]);}
          driveKm+=k;}
        else if(s.mode==="flight")flights++;
        else if(s.mode==="ferry"){ferries++;if(!ferryDate||/tallink|过夜|overnight/i.test(s.note||""))ferryDate=D.date;}
        else if(s.mode==="train")trains++;
        (s.pts||[]).forEach(function(pt){if(pt&&pt[0]>dayMax)dayMax=pt[0];});
      }else{
        var pid=s.place,pl=pid&&T.places[pid];
        if(s.kind==="hike"){hikes++;if(pid==="trolltunga"||(!bossDate&&pid==="blahnukur"))bossDate=D.date;}
        if(pl){
          var nm=(pid+" "+(pl.zh||"")+" "+(pl.local||"")+" "+(pl.en||"")),scenicStop=!/^(start|stay|shop|food)$/.test(s.kind||"");
          if(scenicStop&&(/foss/i.test(pid)||/瀑布/.test(pl.zh||"")))wfSet[pid]=1;
          if(scenicStop&&(s.kind==="glacier"||/jokull|jokulsarlon|fjallsarlon|breen|冰川|冰河/i.test(nm)))glSet[pid]=1;
          if(pl.ll&&pl.ll[0]>dayMax)dayMax=pl.ll[0];
          if(pl.ll&&scenicStop&&pl.ll[0]>dayStopLat){dayStopLat=pl.ll[0];dayStop=pid;}
        }
      }
    });
    if(dayMax>maxLat){maxLat=dayMax;northDate=D.date;northStopId=dayStop||D.stay;}
    if(dayStopLat>northStopLat&&dayStop){northStopLat=dayStopLat;if(D.date===northDate)northStopId=dayStop;}
  });
  var sunMins=0,earliest="99:99",earliestDate=DATES[0];
  DATES.forEach(function(d){
    var D=BYDATE[d],c=cOf(d),nxC=cOf(addDays(d,1));
    var sid=(D&&D.wx)||(D&&D.stay&&nxC===c?D.stay:(D&&D.segs[0]&&D.segs[0].place)||(D&&D.stay))||(legOf(d)&&legOf(d).wx);
    if(sid&&N[sid]){var st=sunTimes(d,N[sid][0],N[sid][1],tzOf(d));
      var len=st.polar==="day"?1440:st.polar==="night"?0:(st.len||0);
      sunMins+=len;if(st.rise&&st.rise<earliest){earliest=st.rise;earliestDate=d;}}
  });
  var overnightCruise=(T.bookings||[]).some(function(b){return /tallink|过夜邮轮|overnight/i.test(b.id+" "+(b.what||""));});
  if(overnightCruise){var tb=(T.bookings||[]).filter(function(b){return /tallink/i.test(b.id);})[0];if(tb&&tb.days&&tb.days[0])ferryDate=tb.days[0];}
  var stayNights=Math.max(1,nights-(overnightCruise?1:0));
  var arcticKm=Math.max(0,Math.round((66.5622-(maxLat>-90?maxLat:65.7))*111.2));
  return {
    days:days,nights:nights,stayNights:stayNights,countries:cList,currencies:Object.keys(curSeen).length||5,
    driveKm:Math.round(driveKm),driveHrs:Math.round(driveMins/60),driveCnt:driveCnt,
    flights:flights,ferries:ferries,trains:trains,overnightCruise:overnightCruise,ferryDate:ferryDate||DATES[0],
    hikes:hikes,waterfalls:Object.keys(wfSet).length,glaciers:Object.keys(glSet).length,bossDate:bossDate||DATES[0],
    maxLat:maxLat>-90?maxLat:65.8,northDate:northDate,northStopId:northStopId,arcticKm:arcticKm,
    sunHrs:Math.round(sunMins/60),sunAvg:(sunMins/60/Math.max(1,days)).toFixed(1),earliest:earliest<"99:99"?earliest:"02:30",earliestDate:earliestDate
  };
}

function renderFunNums(){
  var S=TRIP_STATS||calcTripStats(),box=$("funNums");if(!box)return;
  var flags=S.countries.map(function(c){return CFLAG[c]||"";}).filter(Boolean).join(" ");
  var nPlace=S.northStopId?pn(S.northStopId,true):"Akureyri";
  var items=[
    {ic:ICON.globe,k:"fjord",dt:DATES[0],lbl:U("全程跨度"),val:U("{d} 天 · {c} 国",{d:S.days,c:S.countries.length}),sub:(flags?flags+" · ":"")+U("{n} 晚 · {k} 种货币",{n:S.nights,k:S.currencies})},
    {ic:ICON.drive,k:"road",dt:DATES[0],lbl:U("自驾里程"),val:S.driveKm.toLocaleString("en-US")+" km",sub:U("约 {h}h · {n} 趟车程",{h:S.driveHrs,n:S.driveCnt})},
    {ic:ICON.ferry,k:"ice",dt:S.ferryDate,lbl:U("海陆空接力"),val:U("{f} 飞 · {s} 船 · {t} 铁",{f:S.flights,s:S.ferries,t:S.trains}),sub:U(S.overnightCruise?"含波罗的海过夜邮轮":"跨国航班、峡湾渡轮与火车")},
    {ic:ICON.peak,k:"moss",dt:S.bossDate,lbl:U("山野与冰川"),val:U("{n} 场徒步",{n:S.hikes}),sub:U("{w} 座瀑布 · {g} 片冰川",{w:S.waterfalls,g:S.glaciers})},
    {ic:ICON.north,k:"ice",dt:S.northDate,lbl:U("最北足迹"),val:S.maxLat.toFixed(1)+"°N",sub:U("{p} · 距北极圈 {k} km",{p:nPlace,k:S.arcticKm})},
    {ic:ICON.sun,k:"sun",dt:S.earliestDate,lbl:U("盛夏日照"),val:U("约 {h} 小时",{h:S.sunHrs}),sub:U("日均 {a}h · {r} 日出",{a:S.sunAvg,r:S.earliest})}
  ];
  box.innerHTML=items.map(function(x,i){
    return '<button type="button" class="fn-cell '+x.k+'" style="--n:'+i+'" data-date="'+esc(x.dt)+'" title="'+esc(x.lbl+" · "+x.sub)+'">'+
      '<span class="fn-top"><span class="fn-ic">'+x.ic+'</span><span class="fn-lbl">'+esc(x.lbl)+'</span></span>'+
      '<b class="fn-val">'+esc(x.val)+'</b>'+
      '<span class="fn-sub">'+esc(x.sub)+'</span></button>';
  }).join("");
}

function prepStats(){
  var today=homeToday(),done=bookedIds(),shown=shownBookings(),now=[],hotNow=[],later=[],booked=[];
  shown.forEach(function(b){
    if(done[b.id])booked.push(b);
    else if(b.opens&&b.opens.slice(0,10)>today)later.push(b);
    else{now.push(b);if(b.hot)hotNow.push(b);}
  });
  later.sort(function(a,b){return a.opens<b.opens?-1:1;});
  now.sort(function(a,b){return (b.hot?1:0)-(a.hot?1:0);});
  var checked=store("nt-check")||{},checkAll=0,checkOn=0;
  (T.prep||[]).forEach(function(card,ci){(card.items||[]).forEach(function(it,ii){
    var id=it.id||(card.id||ci)+"-"+ii;checkAll++;if(checked[id])checkOn++;});});
  var pr=profile(),P=pr&&T.entry&&T.entry.profiles&&T.entry.profiles[pr];
  if(P&&P.steps)P.steps.forEach(function(st){var id="entry-"+pr+"-"+st.id;checkAll++;if(checked[id])checkOn++;});
  return {today:today,shown:shown,now:now,hotNow:hotNow,later:later,booked:booked,checkAll:checkAll,checkOn:checkOn};
}

function renderReady(){
  var box=$("bentoReady");if(!box||!T)return;
  var P=prepStats(),pr=profile(),total=Math.max(1,P.shown.length),live=liveDate();
  var ppTxt=pr?profLabel(pr):U("选护照看签证");
  var h='<div class="bc-head"><div class="bc-title"><span class="bc-ic fjord">'+ICON.radar+'</span><h3>'+esc(U("行前雷达"))+'</h3></div>'+
    '<button type="button" class="bc-pill'+(pr?"":" warn")+'" data-jump-entry="1">'+ICON.idcard+'<span>'+esc(ppTxt)+'</span></button></div>';
  if(live&&BYDATE[live]){
    h+='<button type="button" class="rdy-live" data-date="'+esc(live)+'"><span class="live-dot"></span><span class="rl-txt"><b>'+esc(U("今日行程"))+" · "+md(live)+'</b><small>'+esc(dayLabel(live))+'</small></span><span class="rl-go">'+esc(U("看今天"))+' →</span></button>';
  }
  var pDone=P.booked.length/total*100,pHot=P.hotNow.length/total*100,pOpen=Math.max(0,P.now.length-P.hotNow.length)/total*100,pLater=P.later.length/total*100;
  h+='<div class="rdy-hero"><div class="rdy-num"><b>'+P.booked.length+'</b><span>/ '+P.shown.length+' '+esc(U("项已订"))+'</span></div>'+
    (P.now.length?'<span class="rdy-open-tag">'+P.now.length+' '+esc(U("项现在可订"))+'</span>':'<span class="rdy-open-tag ok">'+esc(U("全部订好了！"))+'</span>')+'</div>';
  h+='<div class="rdy-bar" aria-hidden="true">'+
    (pDone?'<span class="rb-done" style="flex:'+pDone+'"></span>':"")+
    (pHot?'<span class="rb-hot" style="flex:'+pHot+'"></span>':"")+
    (pOpen?'<span class="rb-open" style="flex:'+pOpen+'"></span>':"")+
    (pLater?'<span class="rb-later" style="flex:'+pLater+'"></span>':"")+'</div>';
  if(P.later.length){
    h+='<div class="rdy-sec"><div class="rdy-sh">'+esc(U("即将开放"))+'</div><div class="rdy-list">'+P.later.slice(0,2).map(function(b){
      var dt=b.opens.slice(0,10),n=daysBetween(P.today,dt);
      var when=n<=0?U("今天开放"):n===1?U("明天开放"):U("{n} 天后",{n:n});
      var dBadge=(en()?MON[+dt.slice(5,7)-1]:(+dt.slice(5,7))+"月")+" "+(+dt.slice(8,10));
      return '<button type="button" class="rdy-item later" data-booking="'+esc(b.id)+'">'+
        '<span class="ri-date">'+esc(dBadge)+'</span>'+
        '<span class="ri-txt"><b>'+esc(plain(b.what))+'</b></span>'+
        '<span class="ri-due">'+esc(when)+'</span></button>';
    }).join("")+'</div></div>';
  }
  if(P.now.length){
    h+='<div class="rdy-sec"><div class="rdy-sh">'+esc(U("现在先盯"))+'</div><div class="rdy-list">'+P.now.slice(0,3).map(function(b){
      var sub=plain(b.for||b.when||"");if(en())sub=sub.replace(/、/g,", ");
      return '<button type="button" class="rdy-item'+(b.hot?" hot":"")+'" data-booking="'+esc(b.id)+'">'+
        '<span class="ri-dot"></span>'+
        '<span class="ri-txt"><b>'+esc(plain(b.what))+'</b>'+(sub?'<small>'+esc(sub)+'</small>':"")+'</span>'+
        '<span class="ri-arr">›</span></button>';
    }).join("")+'</div></div>';
  }
  h+='<button type="button" class="bc-foot" data-go-view="prep"><span>'+esc(U("清单 {a}/{b}",{a:P.checkOn,b:P.checkAll}))+'</span><b>'+esc(U("全部预订与准备"))+' →</b></button>';
  box.innerHTML=h;
}

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
  var kmBase=Math.max(1500,S.driveKm||4214);
  var raw=[
    {k:"fly",col:"#3F8FB5",ic:ICON.flight,lbl:U("机票邮轮"),note:U("跨大西洋往返 + 欧内直飞 + 波罗的海过夜船 + 火车"),uLo:1160+120/n,uHi:1810+220/n},
    {k:"stay",col:"#7A5C9E",ic:ICON.maps,lbl:U("{n} 晚住宿",{n:S.stayNights}),note:U("青旅床位、峡湾营地木屋与老城公寓"),uLo:S.stayNights*(59+16/n),uHi:S.stayNights*(88+26/n)},
    {k:"car",col:"#1F4E6B",ic:ICON.drive,lbl:U("租车油费 ÷{n}",{n:n}),note:U("{k} km 租车、保险、油费、停车与过路费（{n} 人平摊）",{k:kmBase.toLocaleString("en-US"),n:n}),uLo:(kmBase*0.84)/n,uHi:(kmBase*1.14)/n},
    {k:"food",col:"#C9711C",ic:ICON.sun,lbl:U("吃饭超市"),note:U("{d} 天超市采买做饭、面包房与特色正餐",{d:S.days}),uLo:S.days*38,uHi:S.days*62},
    {k:"fun",col:"#3D7A4F",ic:ICON.peak,lbl:U("冰川门票"),note:U("快艇、冰川徒步、峡湾游船、温泉与博物馆"),uLo:520,uHi:690}
  ];
  var sumLo=0,sumHi=0,cats=raw.map(function(c){
    var lo=rnd(c.uLo,cStep),hi=Math.max(lo,rnd(c.uHi,cStep)),mid=(lo+hi)/2;
    sumLo+=lo;sumHi+=hi;
    return {k:c.k,col:c.col,ic:c.ic,lbl:c.lbl,note:c.note,lo:lo,hi:hi,mid:mid};
  });
  var totLo=Math.round(sumLo/tStep)*tStep,totHi=Math.round(sumHi/tStep)*tStep;
  var dayLo=Math.round(totLo/Math.max(1,S.days)/dStep)*dStep,dayHi=Math.round(totHi/Math.max(1,S.days)/dStep)*dStep;
  return {sc:sc,sym:CSYM[sc]||(sc+" "),totLo:totLo,totHi:totHi,dayLo:dayLo,dayHi:dayHi,cats:cats,countries:S.countries};
}

function paintBgtFocus(){
  var box=$("bentoBudget");if(!box)return;
  var has=!!BGT_CAT,noteEl=box.querySelector(".bgt-focus");
  box.querySelectorAll("[data-bgt-cat]").forEach(function(el){
    var on=el.dataset.bgtCat===BGT_CAT;
    el.classList.toggle("on",on);el.classList.toggle("dim",has&&!on);
  });
  if(noteEl){
    var active=has&&box.querySelector('.bgt-cat[data-bgt-cat="'+BGT_CAT+'"]');
    noteEl.textContent=active?active.dataset.note:U("点细项看包含什么 · 货币随右上角切换");
    noteEl.classList.toggle("on",has);
  }
}

function renderBudget(){
  var box=$("bentoBudget");if(!box||!T)return;
  var n=bgtGroupSize(),B=calcBudget(n),sym=B.sym;
  function rng(a,b){return sym+a.toLocaleString("en-US")+"–"+b.toLocaleString("en-US");}
  var h='<div class="bc-head"><div class="bc-title"><span class="bc-ic sun">'+ICON.coin+'</span><div><h3>'+esc(U("预算小账箱"))+'</h3></div></div>'+
    '<div class="bgt-split" role="radiogroup" aria-label="'+esc(U("分摊人数"))+'">'+[2,3,4].map(function(k){
      return '<button type="button" role="radio" data-bgt-n="'+k+'" aria-checked="'+(k===n)+'">'+esc(U("{n}人",{n:k}))+'</button>';
    }).join("")+'</div></div>';
  h+='<div class="bgt-hero"><div class="bgt-tot"><b>'+esc(rng(B.totLo,B.totHi))+'</b><span>'+esc(U("/ 人"))+'</span></div>'+
    '<div class="bgt-sub">'+esc(U("约 {a}–{b} / 天 · 按 {c} 折算",{a:sym+B.dayLo.toLocaleString("en-US"),b:B.dayHi.toLocaleString("en-US"),c:B.sc}))+'</div></div>';
  h+='<div class="bgt-bar" role="group" aria-label="'+esc(U("人均全包估算"))+'">'+B.cats.map(function(c){
    return '<button type="button" class="bb-seg" style="flex:'+Math.round(c.mid)+';--k:'+c.col+'" data-bgt-cat="'+c.k+'" title="'+esc(c.lbl+" "+rng(c.lo,c.hi))+'" aria-label="'+esc(c.lbl)+'"></button>';
  }).join("")+'</div>';
  h+='<p class="bgt-focus">'+esc(U("点细项看包含什么 · 货币随右上角切换"))+'</p>';
  h+='<div class="bgt-cats">'+B.cats.map(function(c){
    return '<button type="button" class="bgt-cat" style="--k:'+c.col+'" data-bgt-cat="'+c.k+'" data-note="'+esc(c.note)+'">'+
      '<span class="bcat-dot"></span><span class="bcat-l">'+esc(c.lbl)+'</span>'+
      '<b class="bcat-v">'+esc(rng(c.lo,c.hi))+'</b></button>';
  }).join("")+'</div>';
  h+='<div class="bgt-vibe"><span class="bv-lbl">'+esc(U("各国物价"))+'</span><div class="bv-pills">'+B.countries.map(function(c){
    var v=CVIBE[c]||[3,"中高"],lv=v[0],chill=lv<=2;
    var dots=[1,2,3,4].map(function(i){return '<i class="'+(i<=lv?"on":"")+'"></i>';}).join("");
    return '<span class="bv-pill'+(chill?" chill":"")+'" title="'+esc(pn(c,true)+" · "+U(v[1]))+'">'+(CFLAG[c]||"")+'<span>'+esc(pn(c,true))+'</span><span class="bv-dots">'+dots+'</span>'+(chill?'<em>'+esc(U("回血站"))+'</em>':"")+'</span>';
  }).join("")+'</div></div>';
  var items=mItems(),logged=items.length?balances(items).total:0;
  h+='<button type="button" class="bc-foot" data-go-view="money"><span>'+(items.length?esc(U("账本已记 {t}（{n} 笔）",{t:fmtC(logged,B.sc),n:items.length})):esc(U("出发后拍小票就能自动记账平摊")))+'</span><b>'+esc(U("去账本"))+' →</b></button>';
  box.innerHTML=h;
  if(BGT_CAT)paintBgtFocus();
}

var JEWEL_CANDS=[
  ["blahnukur","流纹岩彩山双峰与野溪温泉","Rhyolite twin peaks & hot spring"],
  ["landmannalaugar","彩色流纹岩高地与天然温泉","Colorful highlands & hot spring"],
  ["svartifoss","六棱玄武岩柱瀑布与冰川俯瞰","Basalt-column waterfall & ice"],
  ["jokulsarlon","快艇穿行浮冰与冰川徒步","Zodiac icebergs & glacier hike"],
  ["stokksnes","黑沙滩潮汐镜面与东部海鹦","Mirror black beach & puffins"],
  ["studlagil","冰川碧水切开的玄武岩峡谷","Turquoise basalt-column canyon"],
  ["kirkjufellsfoss","斯奈山草帽山瀑布与熔岩海岸","Snæfellsnes icon & lava coast"],
  ["trollstigen","11 道发卡弯翻越云端峡湾","11 hairpins into Geirangerfjord"],
  ["loen_skylift","千米高空俯瞰翡翠色峡湾湖谷","1,011 m fjord & glacier panorama"],
  ["gudvangen","世界遗产纳柔依最窄峡湾巡航","World Heritage narrow-fjord cruise"],
  ["trolltunga","悬于湖面 700 米的终极悬崖徒步","700 m cliff tongue — the boss hike"],
  ["gamla_stan","群岛之都中世纪街巷与瓦萨沉船","Old town islands & Vasa warship"],
  ["toompea","过夜邮轮醒来走进红顶中世纪城墙","Baltic ferry into medieval Tallinn"],
  ["nyhavn","彩色木船运河与哥本哈根慢生活","Colorful canal sails & bakeries"],
  ["mons_klint","波罗的海百米白垩海崖徒步","120 m white chalk sea cliffs"]
];

function pickJewels(){
  var byPlace={},out=[],seen={},legCovered={};
  T.days.forEach(function(D){D.segs.forEach(function(s){
    if(s.t==="stop"&&s.place&&!byPlace[s.place]&&SCENIC[s.kind])byPlace[s.place]={date:D.date,c:D.c,kind:s.kind,s:s};
  });});
  // avoid picking both blahnukur and landmannalaugar on the same day
  var seenDay={};
  JEWEL_CANDS.forEach(function(c){
    var id=c[0],hit=byPlace[id],phs=hit&&photosOf(id);
    if(!hit||!phs||!phs.length||seen[id])return;
    if(id==="landmannalaugar"&&seen.blahnukur)return;
    seen[id]=1;seenDay[hit.date]=(seenDay[hit.date]||0)+1;
    var lg=legOf(hit.date);if(lg)legCovered[lg.from]=1;
    out.push({id:id,date:hit.date,c:hit.c,kind:hit.kind,ph:phs[0],hook:en()?c[2]:c[1]});
  });
  // fallback: ensure every leg with photos has at least one postcard if the plan changed
  (T.legs||[]).forEach(function(l){
    if(legCovered[l.from])return;
    var lp=legPhotos(l)[0];if(!lp||seen[lp.s.place])return;
    var v=placeVisits(lp.s.place)[0];if(!v)return;
    seen[lp.s.place]=1;
    out.push({id:lp.s.place,date:v.date,c:l.c,kind:lp.s.kind||"visit",ph:lp.ph,hook:plain(l.short||l.title)});
  });
  out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  return out;
}

function syncJewelBtns(){
  var el=$("jewels"),p=$("jPrev"),n=$("jNext");if(!el||!p||!n)return;
  p.disabled=el.scrollLeft<=6;
  n.disabled=el.scrollLeft+el.clientWidth>=el.scrollWidth-6;
}

function renderJewels(){
  var sec=$("jewelsSec"),box=$("jewels");if(!sec||!box||!T)return;
  var list=pickJewels();
  if(!list.length){sec.hidden=true;return;}
  sec.hidden=false;
  box.innerHTML=list.map(function(j,i){
    var col=(T.countries[j.c]||{}).color||"#1F4E6B",cName=pn(j.c,true),kName=L(T.kinds[j.kind])||"";
    return '<button type="button" class="jewel" role="listitem" style="--c:'+esc(col)+';--n:'+i+'" data-jewel="'+esc(j.id)+'" data-jdate="'+esc(j.date)+'">'+
      img(j.ph,600,"jewel-img")+
      '<span class="jw-top"><span class="jw-when"><i class="jw-dot"></i>'+esc(md(j.date)+" · "+cName)+'</span>'+(kName?'<span class="jw-kind">'+esc(kName)+'</span>':"")+'</span>'+
      '<span class="jw-cap"><b>'+pn(j.id)+'</b><small>'+esc(j.hook)+'</small></span></button>';
  }).join("");
  setTimeout(syncJewelBtns,40);
}

function renderAll(){
  var total=DATES.length;
  TRIP_STATS=calcTripStats();
  renderFunNums();
  renderReady();
  renderBudget();
  renderJewels();
  $("ribbon").innerHTML=T.legs.map(function(l){var n=daysBetween(l.from,l.to)+1,c=T.countries[l.c]||{};
    return '<button type="button" class="rt" style="--c:'+esc(c.color||"#8A99A3")+';flex:'+n+' 1 0" data-date="'+esc(l.from)+'" title="'+esc(plain(l.title))+'"><span class="rt-bar"></span><b>'+esc(plain(l.short||l.title))+'</b><small>'+md(l.from)+"–"+md(l.to)+" · "+U("{n} 天",{n:n})+"</small></button>";}).join("");
  var live=liveDate(),h=(en()?WKEN:WK).map(function(w){return '<div class="cal-h">'+(en()?w:w.slice(1))+"</div>";}).join("");
  for(var i=0;i<wkday(DATES[0]);i++)h+="<div></div>";
  DATES.forEach(function(d,i){var D=BYDATE[d],stay=D&&D.stay?names(D.stay):null,open=dayBookings(d).filter(function(b){return !b.done;}).length;
    h+='<button type="button" class="cd'+(D?"":" draft")+(d===live?" today":"")+'" style="--c:'+colorOf(d)+';--n:'+i+'" data-date="'+d+'"'+(D&&NM==="zh"?' title="'+esc(localText(D.short||D.title))+'"':"")+'>'+
      '<span class="cd-img">'+(D&&heroOf(D)?img(heroOf(D).ph,400):D&&dayStops(D).length?tbd("mini"):"")+'</span><span class="cd-d"><span>'+md(d)+(D?paceMeter(d,true):"")+"</span>"+(open?'<span class="cd-due" title="'+esc(U(open===1?"这天还有 1 项没订":"这天还有 {n} 项没订",{n:open}))+'" aria-label="'+esc(U(open===1?"这天还有 1 项没订":"这天还有 {n} 项没订",{n:open}))+'"></span>':"")+"</span>"+
      '<span class="cd-t">'+(D?tx(D.short||D.title):U("规划中"))+"</span>"+
      (stay?'<span class="cd-s">'+U("住 ")+esc(NM==="local"?stay.lo:stay.zh)+"</span>":(!D&&legOf(d)?'<span class="cd-s">'+esc(plain(legOf(d).short||legOf(d).title))+"</span>":""))+"</button>";});
  $("cal").innerHTML=h;
  renderPaceSum();
  $("legs").innerHTML=T.legs.map(function(l,li){var n=daysBetween(l.from,l.to)+1,c=T.countries[l.c]||{},lp=legPhotos(l);
    return '<div class="leg" style="--c:'+esc(c.color||"#8A99A3")+'">'+('<div class="leg-imgs">'+lp.slice(0,4).map(function(x,k){return '<button type="button" class="leg-img" data-leg="'+li+'" data-k="'+k+'" aria-label="'+esc(plain(x.s.name||"[["+x.s.place+"]]"))+'">'+img(x.ph,600)+"</button>";}).join("")+(lp.length<4?new Array(5-lp.length).join('<span class="leg-img">'+tbd()+"</span>"):"")+"</div>")+'<div class="leg-h"><h3>'+tx(l.title)+'</h3><span class="when">'+cnDate(l.from)+" – "+cnDate(l.to)+" · "+U("{n} 天",{n:n})+"</span>"+(l.draft?'<span class="leg-tag">'+U("草案")+'</span>':"")+"</div>"+
      (l.body?"<p>"+tx(l.body)+"</p>":"")+(l.items&&l.items.length?"<ul>"+l.items.map(function(x){return "<li>"+tx(x)+"</li>";}).join("")+"</ul>":"")+"</div>";}).join("");
  var drafts=DATES.filter(function(d){return !BYDATE[d];}).length;
  $("legHint").textContent=(T.legs?T.legs.length+" "+(en()?"legs · ":"段 · "):"")+(drafts?U("已排好 {a} 天，其余 {b} 天规划中",{a:total-drafts,b:drafts}):U("全部 {n} 天已排好",{n:total}));
}
$("jewels").addEventListener("scroll",syncJewelBtns,{passive:true});
window.addEventListener("resize",syncJewelBtns);
$("jPrev").addEventListener("click",function(){var el=$("jewels");el.scrollBy({left:-Math.max(240,el.clientWidth*.72),behavior:"smooth"});});
$("jNext").addEventListener("click",function(){var el=$("jewels");el.scrollBy({left:Math.max(240,el.clientWidth*.72),behavior:"smooth"});});
$("bentoBudget").addEventListener("pointerover",function(e){if(e.pointerType==="touch")return;var c=e.target.closest("[data-bgt-cat]");if(c&&BGT_CAT!==c.dataset.bgtCat){BGT_CAT=c.dataset.bgtCat;paintBgtFocus();}});
$("bentoBudget").addEventListener("pointerleave",function(e){if(e.pointerType==="touch")return;if(BGT_CAT){BGT_CAT=null;paintBgtFocus();}});
$("allView").addEventListener("click",function(e){
  var li=e.target.closest(".leg-img");if(li){openLb(legPhotos(T.legs[+li.dataset.leg]),+li.dataset.k);return;}
  var bk=e.target.closest("[data-booking]");if(bk){openBooking(bk.dataset.booking);return;}
  var je=e.target.closest("[data-jump-entry]");if(je){morph(function(){setView("prep");var el=$("entry");if(el)el.scrollIntoView({block:"start",behavior:"smooth"});},"tab");return;}
  var gv=e.target.closest("[data-go-view]");if(gv){var v=gv.dataset.goView;morph(function(){setView(v);window.scrollTo({top:0,behavior:"smooth"});},"tab");return;}
  var bn=e.target.closest("[data-bgt-n]");if(bn){store("nt-bgt-n",+bn.dataset.bgtN);renderBudget();return;}
  var bc=e.target.closest("[data-bgt-cat]");if(bc){BGT_CAT=BGT_CAT===bc.dataset.bgtCat?null:bc.dataset.bgtCat;paintBgtFocus();return;}
  var jw=e.target.closest("[data-jewel]");if(jw){var pid=jw.dataset.jewel,dt=jw.dataset.jdate;morph(function(){goToPlace(pid,dt);},"tab");return;}
  var b=e.target.closest("[data-date]");if(b)morph(function(){setView("day",b.dataset.date);},"tab");
});

/* ---------- day strip ---------- */
function renderStrip(){
  var live=liveDate();
  $("strip").innerHTML=DATES.map(function(d){return '<button type="button" role="tab" class="sd'+(BYDATE[d]?"":" draft")+(d===live?" today":"")+'" style="--c:'+colorOf(d)+'" data-date="'+d+'" aria-selected="false" title="'+esc(dayLabel(d))+'"><b>'+md(d)+"</b><small>"+wk(d)+"</small>"+(BYDATE[d]?paceMeter(d):"")+"</button>";}).join("");
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
  // a shorter English label where phones have no room (the tab names); Chinese is already short
  document.querySelectorAll("[data-i18n-sm]").forEach(function(el){el.dataset.sm=en()?el.getAttribute("data-i18n-sm"):el.textContent;});
  ["placeholder","title","aria-label"].forEach(function(at){document.querySelectorAll("[data-i18n-"+at+"]").forEach(function(el){el.setAttribute(at,U(el.getAttribute("data-i18n-"+at)));});});
}

/* ---------- language switch ---------- */
function applyNames(){document.querySelectorAll(".names button").forEach(function(b){b.setAttribute("aria-checked",b.dataset.nm===NM);});slideInd(".names",'[aria-checked="true"]');}
document.querySelectorAll(".names button").forEach(function(b){b.addEventListener("click",function(){
  if(NM===b.dataset.nm)return;NM=b.dataset.nm;store("nt-names",NM);applyNames();rerender(true);prefsOpen(false);ensureEn();});});
// redraw everything that shows text (after a language or currency change), keeping the open stop
function rerender(lang){
  var sel=state.sel;applyStatic();renderCur();renderHeader();renderAll();renderStrip();markStrip();renderPrep();renderMoney();$("fitLabel").textContent=U(state.view==="day"?"全天":"全程");
  slideInd(".seg",'.seg-btn[aria-selected="true"]',true);
  if(state.view==="day"){renderDay();if(sel!=null&&day()){state.sel=sel;paintOpen();}}
  if(lang){redrawMap();caption();document.dispatchEvent(new CustomEvent("trip:lang"));if(embed){var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();}}}
/* ---------- currency menu ---------- */
var CURS=[["local","kr","当地货币","Local currency"],["CAD","C$","加元","Canadian dollar"],["CNY","¥","人民币","Chinese yuan"],["USD","US$","美元","US dollar"]];
function renderCur(){
  var cur=CURS.filter(function(c){return c[0]===CUR;})[0];
  $("curSym").textContent=cur[1];$("curLabel").textContent=CUR==="local"?U("当地"):CUR;
  $("prefsSym").textContent=cur[1]+" · "+(en()?"EN":"中");
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
function curPick(v){if(v!==CUR){CUR=v;store("nt-cur",CUR);rerender(false);}renderCur();curOpen(false);
  if($("prefs").classList.contains("open")){prefsOpen(false);$("prefsBtn").focus();}else $("curBtn").focus();}
$("curBtn").addEventListener("click",function(){curOpen($("curMenu").hidden);});
$("curMenu").addEventListener("click",function(e){var o=e.target.closest(".cur-opt");if(o)curPick(o.dataset.cur);});
$("curMenu").addEventListener("keydown",function(e){var opts=[].slice.call(this.querySelectorAll(".cur-opt")),i=opts.indexOf(document.activeElement);
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();opts[(i+(e.key==="ArrowDown"?1:opts.length-1))%opts.length].focus();}
  else if(e.key==="Escape"){e.preventDefault();curOpen(false);$("curBtn").focus();}
  else if(e.key==="Tab")curOpen(false);});
$("curBtn").addEventListener("keydown",function(e){if(e.key==="ArrowDown"){e.preventDefault();curOpen(true);}});
document.addEventListener("pointerdown",function(e){if(!$("curBox").contains(e.target))curOpen(false);
  if(!$("prefs").contains(e.target)&&!$("prefsBtn").contains(e.target))prefsOpen(false);});
// phones: currency and language live in a small panel behind one button, so the bar fits on one line
function prefsOpen(on){var p=$("prefs");if(on===p.classList.contains("open"))return;
  p.classList.toggle("open",on);$("prefsBtn").setAttribute("aria-expanded",on);if(on)slideInd(".names",'[aria-checked="true"]',true);else curOpen(false);}
$("prefsBtn").addEventListener("click",function(){prefsOpen(!$("prefs").classList.contains("open"));});
$("prefs").addEventListener("keydown",function(e){if(e.key==="Escape"&&!e.defaultPrevented){prefsOpen(false);$("prefsBtn").focus();}});

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
function setPassport(p,live){PASS={p:p,live:live||PASS.live||"ca"};store("nt-passport",PASS);SHOWALL=false;renderPrep();renderHeader();renderAll();}
function renderEntry(){
  var E=T.entry,pr=profile(),checked=store("nt-check")||{},shown=shownBookings();
  var h='<div class="tl-head"><h2>'+U("签证和入境")+'</h2><span class="hint">'+U("护照和勾选只保存在这台设备上")+'</span></div>';
  h+='<div class="entry-pick"><div class="pp" role="radiogroup" aria-label="'+U("护照")+'">'+["cn","ca"].map(function(k){
    return '<button type="button" role="radio" data-pp="'+k+'" aria-checked="'+(PASS.p===k)+'">'+esc(L(E.passports[k]))+"</button>";}).join("")+"</div>";
  // a Chinese passport's steps depend on where you live: a second toggle, one tap per country
  h+='<div class="pp-live"'+(PASS.p==="cn"?"":" hidden")+'><span id="ppLiveLab">'+U("住在")+'</span><div class="pp sm" role="radiogroup" aria-labelledby="ppLiveLab">'+Object.keys(E.live).map(function(k){
    return '<button type="button" role="radio" data-live="'+k+'" aria-checked="'+((PASS.live||"ca")===k)+'">'+esc(L(E.live[k]))+"</button>";}).join("")+"</div></div></div>";
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
// the bookings that matter on one date (bookings tagged "days" in trip.json), each with whether it's ticked as booked
function dayBookings(d){var done=bookedIds();
  return T.bookings.filter(function(b){return forMe(b)&&b.days&&b.days.indexOf(d)>=0;}).map(function(b){return {b:b,done:!!done[b.id]};});}
// Bookings in three groups: what you can do now, what opens later (by date), and what's booked (folded away)
function renderPrep(){
  var today=homeToday(),done=bookedIds(),nb=nextBooking(),shown=shownBookings();
  $("entry").innerHTML=renderEntry();
  var now=[],later=[],booked=[],doneOpen=$("bkDone")&&$("bkDone").open;
  shown.forEach(function(b){(done[b.id]?booked:b.opens&&b.opens.slice(0,10)>today?later:now).push(b);});
  later.sort(function(a,b){return a.opens<b.opens?-1:1;});
  function group(key,list,label,hint){return list.length?'<div class="bk-group" data-group="'+key+'"><h3>'+U(label)+' <small>'+list.length+"</small></h3>"+(hint?'<p class="bk-hint">'+U(hint)+"</p>":"")+list.map(card).join("")+"</div>":"";}
  var nDone=booked.length,pct=shown.length?Math.round(nDone/shown.length*100):0;
  $("bookings").innerHTML='<div class="bk-progress" role="progressbar" aria-valuemin="0" aria-valuemax="'+shown.length+'" aria-valuenow="'+nDone+'" aria-label="'+esc(U("预订"))+'"><span style="width:'+pct+'%"></span></div>'+
    group("now",now,"现在就能办")+group("later",later,"之后开放","按开放日期排；快开放时总览页会提醒")+
    (booked.length?'<details class="bk-group bk-done" id="bkDone"'+(doneOpen?" open":"")+'><summary><h3>'+U("已订")+' <small>'+booked.length+'</small></h3><svg class="b-chev" viewBox="0 0 20 20"><path d="M5 8l5 5 5-5"/></svg></summary>'+booked.map(card).join("")+"</details>":"");
  function card(b){
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
    var bFl=[],bRest=[];(b.key||[]).forEach(function(f){var fl=parseFlightFact(f);if(fl)bFl.push(fl);else bRest.push(f);});
    if(bFl.length)h+=flightCards(bFl);
    if(bRest.length)h+='<dl class="keyfacts">'+bRest.map(function(f){return "<div><dt>"+esc(L(f[0]))+"</dt><dd>"+tx(f[1])+"</dd></div>";}).join("")+"</dl>";
    if(b.tip)h+='<p class="b-tip">'+tx(b.tip)+"</p>";
    var acts=[],link=(b.links||[])[0];
    if(link)acts.push('<a class="pill primary" target="_blank" rel="noopener" href="'+esc(link[1])+'">'+ICON.dir+U("打开 ")+esc(L(link[0]))+"</a>");
    (b.links||[]).slice(1).forEach(function(l){acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(l[1])+'">'+esc(L(l[0]))+"</a>");});
    acts.push(b.booked?'<span class="pill on" title="'+esc(U("行程里标记了已订，大家都能看到"))+'">'+ICON.check+U("大家已订")+"</span>":
      '<button class="pill'+(isDone?" on":"")+'" type="button" data-done="'+esc(b.id)+'">'+ICON.check+U(isDone?"已订":"标记已订")+"</button>");
    acts.push('<button class="pill ask" type="button" data-ask="'+esc(b.id)+'">'+ICON.ask+U("问助手")+"</button>");
    h+='<div class="actions">'+acts.join("")+"</div>";
    if(b.steps&&b.steps.length)h+='<details class="allsteps"><summary>'+U("全部步骤")+'</summary><ol class="steps">'+b.steps.map(function(s){return "<li><span>"+tx(s)+"</span></li>";}).join("")+"</ol></details>";
    h+="</div></details>";
    return h;
  }
  $("bookedCount").textContent=U("已订 {a} / {b} · 自己勾的只存在这台设备上，跟助手说“订好了”大家都能看到",{a:nDone,b:shown.length});

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
  renderOffline();
  $("sources").innerHTML=U("资料来源：")+T.sources.concat([[U("天气预报：Open-Meteo"),"https://open-meteo.com/"]]).map(function(s){return '<a href="'+esc(s[1])+'" target="_blank" rel="noopener">'+esc(L(s[0]))+'</a>';}).join(" · ");
  countPrep();
}
function countPrep(){var all=0,on=0;
  T.prep.forEach(function(card,ci){var c=0,list=document.querySelector('[data-card="'+ci+'"]');
    if(list)list.querySelectorAll("input").forEach(function(el){if(el.checked)c++;});
    all+=card.items.length;on+=c;var lab=document.querySelector('[data-count="'+ci+'"]');if(lab)lab.textContent=c+" / "+card.items.length;});
  $("entry").querySelectorAll("input[data-id]").forEach(function(el){all++;if(el.checked)on++;});
  var done=bookedIds(),shown=shownBookings(),b=shown.filter(function(x){return done[x.id];}).length;
  $("prepCount").textContent=(b+on)+"/"+(shown.length+all);
  renderReady();}
$("prepView").addEventListener("change",function(e){var id=e.target.dataset&&e.target.dataset.id;if(!id)return;var d=store("nt-check")||{};d[id]=e.target.checked;store("nt-check",d);countPrep();});
$("prepView").addEventListener("click",function(e){
  var pp=e.target.closest("[data-pp]");if(pp){if(PASS.p!==pp.dataset.pp)setPassport(pp.dataset.pp);return;}
  var lv=e.target.closest("[data-live]");if(lv){if(PASS.live!==lv.dataset.live)setPassport("cn",lv.dataset.live);$("entry").querySelector('[data-live="'+lv.dataset.live+'"]').focus();return;}
  var pf=e.target.closest("[data-prof]");if(pf){var k=pf.dataset.prof;setPassport(k==="ca"?"ca":"cn",k==="ca"?null:k.slice(3));return;}
  var sa=e.target.closest("[data-showall]");if(sa){SHOWALL=sa.dataset.showall==="1";renderPrep();return;}
  var ob=e.target.closest("[data-open-booking]");if(ob){openBooking(ob.dataset.openBooking);return;}
  var mb=e.target.closest(".more-btn");
  if(mb){var p=mb.closest(".citem").querySelector(".more"),on=mb.getAttribute("aria-expanded")!=="true";mb.setAttribute("aria-expanded",on);p.hidden=!on;return;}
  var dn=e.target.closest("[data-done]");
  if(dn){var d=store("nt-booked")||{},id=dn.dataset.done;d[id]=!d[id];store("nt-booked",d);renderPrep();renderHeader();renderAll();var el=$("bk-"+id);if(el&&!el.closest(".bk-done"))el.open=true;return;}
  var ak=e.target.closest("[data-ask]");
  if(ak){var b=T.bookings.filter(function(x){return x.id===ak.dataset.ask;})[0];if(b&&window.tripChat)window.tripChat.ask(U("一步步教我怎么订「{w}」，有什么要注意的？",{w:plain(b.what)}));}
});
function openBooking(id){setView("prep");if(!$("bk-"+id)&&!SHOWALL){SHOWALL=true;renderPrep();}T.bookings.forEach(function(b){var el=$("bk-"+b.id);if(el)el.open=b.id===id;});showBooking(id);}
// opens one booking card (unfolding the "booked" group if it's in there) and scrolls to it
function showBooking(id){var el=$("bk-"+id);if(!el)return;el.open=true;var g=el.closest(".bk-done");if(g)g.open=true;
  // wait for the other cards to finish folding (0.3s), or the scroll aims at where the card used to be
  setTimeout(function(){el.scrollIntoView({block:"start",behavior:"smooth"});},matchMedia("(prefers-reduced-motion:reduce)").matches?0:320);}

/* ---------- views ---------- */
function setView(v,date){
  var was={view:state.view,date:state.date};
  state.view=v;if(date)state.date=date;if(!state.date)state.date=T.dates.start;state.sel=null;placeMap(null,true);
  store("nt-pos",{view:v,date:state.date});
  var hash=v==="day"?state.date:v;if(decodeURIComponent(location.hash.slice(1))!==hash)history.replaceState(null,"","#"+hash);
  document.querySelectorAll(".seg-btn").forEach(function(b){b.setAttribute("aria-selected",b.dataset.view===v?"true":"false");});
  $("daySub").textContent=md(state.date);
  $("top").hidden=v!=="all";$("allView").hidden=v!=="all";$("dayView").hidden=v!=="day";$("prepView").hidden=v!=="prep";$("moneyView").hidden=v!=="money";$("stripWrap").hidden=v!=="day";
  $("fitLabel").textContent=U(v==="day"?"全天":"全程");
  markStrip();slideInd(".seg",'.seg-btn[aria-selected="true"]');
  // entrance animation: a new tab fades up; another day slides in from the side it came from
  if(was.view!==v||was.date!==state.date){var el=$(v+"View");
    el.dataset.dir=was.view===v&&v==="day"?(state.date>was.date?"next":"prev"):"";
    el.classList.remove("enter");void el.offsetWidth;el.classList.add("enter");}
  if(v==="money")loadMoney();
  if(v==="day"){renderDay();
    var D=day(),cur=D&&liveDate()===state.date?nowSeg():null;
    if(cur){select(cur.i,false);return;}}
  fitView();
}
// the switch itself runs a moment later (inside the transition), so quick clicks compare with the last one asked for
var wantView=null;
document.querySelectorAll(".seg-btn").forEach(function(b){b.addEventListener("click",function(){var v=b.dataset.view;if((wantView||state.view)===v)return;wantView=v;
  morph(function(){if(wantView===v)wantView=null;if(state.view!==v)setView(v);},"tab");});});
// a big change to the page (another tab, a new version of the plan) cross-fades where the browser can
function morph(fn,kind){
  if(!document.startViewTransition||document.hidden||matchMedia("(prefers-reduced-motion:reduce)").matches){fn();return;}
  document.documentElement.dataset.morph=kind||"";
  // a transition cut short (a second tab click, the page hidden) still runs fn; only the animation is skipped
  var t=document.startViewTransition(fn),quiet=function(){};t.ready.catch(quiet);
  t.finished.catch(quiet).then(function(){delete document.documentElement.dataset.morph;});}

/* ---------- one day ---------- */
function moveLabel(s,asText){var t=s.label||("[["+s.path[0]+"]] → [["+s.path[s.path.length-1]+"]]");return asText?plain(t):tx(t);}
function nowSeg(){var D=day(),t=nowIn(tzOf(state.date)).mins,segs=D.segs.filter(function(s){return s.start;}),best=null;if(!segs.length)return null;
  for(var i=0;i<segs.length;i++){var s=segs[i],e=s.end||s.start;if(t>=mins(s.start)&&t<=mins(e)){if(s.t==="stop"&&s.start!==e)return s;best=best||s;}}
  if(best)return best;if(t<mins(segs[0].start))return segs[0];return segs[segs.length-1];}
function renderDay(){
  var D=day(),d=state.date;
  var lg=legOf(d);
  $("dayTitle").innerHTML=cnDate(d)+" "+wk(d)+" · "+(D?tx(D.title):U("规划中"))+(D&&lg&&lg.draft?' <span class="leg-tag">'+U("草案")+'</span>':"");
  var dtips=$("dayTips");
  if(D&&D.tips&&D.tips.length){dtips.hidden=false;dtips.innerHTML='<div class="day-tips-h">'+esc(U("注意须知"))+'</div><ul class="tips">'+D.tips.map(function(t){return "<li>"+tx(t)+"</li>";}).join("")+"</ul>";}
  else{dtips.hidden=true;dtips.innerHTML="";}
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
  var D=day(),ol=$("rows");placeMap(null,true);ol.innerHTML="";if(!D)return;
  var cur=liveDate()===state.date?nowSeg():null,opts=optGroups(D),optDone={},segs=D.segs;
  function after(s,to){if(s.t==="stop"&&opts[s.place]&&!optDone[s.place]){optDone[s.place]=1;opts[s.place].forEach(function(o,j){to.appendChild(optRow(o,s.place+"#"+j));});}}
  for(var i=0;i<segs.length;i++){var s=segs[i];
    if(s.group){var run=[s];while(i+1<segs.length&&segs[i+1].group===s.group)run.push(segs[++i]);
      if(run.some(function(x){return x.t==="stop";})){var g=grpRow(run,cur);ol.appendChild(g);run.forEach(function(x){after(x,ol);});continue;}
      i-=run.length-1;}
    ol.appendChild(segLi(s,cur));after(s,ol);}
  // options whose stop isn't in the day (or that name none) go at the end
  Object.keys(opts).forEach(function(k){if(!optDone[k])opts[k].forEach(function(o,j){ol.appendChild(optRow(o,k+"#"+j));});});
}
function segLi(s,cur,inGrp){
  var li=document.createElement("li");li.dataset.i=s.i;li.style.setProperty("--n",Math.min(s.i,14));if(cur&&cur.i===s.i)li.classList.add("now");
  var b=document.createElement("div");b.className="row"+(s.t==="move"?" move":"");b.setAttribute("role","button");b.tabIndex=0;b.setAttribute("aria-expanded","false");
  if(s.t==="move"){var dm=dur(s),km=inGrp&&s.mode==="walk"?walkKm(s):0,alCodes=s.mode==="flight"?detectAirlines(s.note||""):[];
    var alTag=alCodes.length?'<span class="mv-al">'+alCodes.map(function(c){return airlineBadge(c,"","mv-logo");}).join("")+esc(alCodes.map(function(c){return AIRLINES[c].name;}).join("/"))+"</span> · ":"";
    b.innerHTML='<span class="t">'+(s.mode==="flight"&&s.start?esc(s.start):"")+'</span><span class="num" title="'+esc(mode(s.mode))+'">'+(ICON[s.mode]||ICON.drive)+'</span><span class="n">'+
      (inGrp&&s.mode==="walk"?esc([cap(mode(s.mode))+(dm?" "+hm(dm):""),km?distTxt(km):""].filter(Boolean).join(" · "))+(s.label?" · "+tx(s.label):"")
        :alTag+(dm?esc(hm(dm))+" · ":"")+moveLabel(s))+"</span>"+ICON.chev;}
  else{b.style.setProperty("--k",KCOL[s.kind]||KCOL.visit);
    var bits=[s.start&&s.end&&s.start!==s.end?hm(dur(s)):s.mins?hm(s.mins):"",L(T.kinds[s.kind])].filter(Boolean).join(" · ");
    b.innerHTML='<span class="t">'+(s.start?esc(s.start):"")+'</span><span class="num">'+s.num+'</span><span class="n">'+tx(s.name||"[["+s.place+"]]")+(cur&&cur.i===s.i?'<span class="now-tag">'+U("现在")+'</span>':"")+"</span>"+ICON.chev+'<span class="s">'+esc(bits)+"</span>";}
  b.addEventListener("click",function(){var sel=getSelection();if(sel&&!sel.isCollapsed&&b.contains(sel.anchorNode))return;if(state.sel===s.i){state.sel=null;paintOpen();markSel();fitView();}else select(s.i,true);});
  b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();b.click();}});
  li.appendChild(b);return li;}
/* ---------- a walk through several stops, shown as one row ---------- */
// Consecutive segs that share a "group" name (stops a short walk apart, and the walks between them) fold
// into one row: the name, how long it all takes, the stops as a little route, and the walking in total.
// Opening it lists the stops and walks inside; each stop opens on its own, like any other.
var GOPEN={};
function hav(a,b){var R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r,x=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)*Math.sin(dn/2);return 2*R*Math.asin(Math.sqrt(x));}
// a walk's length: its own km if the plan has one, else the straight line between its points plus a quarter for streets
function walkKm(s){if(s.km)return s.km;var ps=(s.path||[]).map(function(x){return typeof x==="string"?(N[x]||null):x;}).filter(Boolean),k=0;
  for(var j=1;j<ps.length;j++)k+=hav(ps[j-1],ps[j]);return Math.round(k*1.25*10)/10;}
function distTxt(km){return km<1?U("约 {n} 米",{n:Math.max(100,Math.round(km*10)*100)}):U("约 {n} 公里",{n:Math.round(km*10)/10});}
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1);}
function inLang(l,fn){var was=NM;NM=l;try{return fn();}finally{NM=was;}}
function quoteEvent(color,ref,fn){return {color:color,ref:ref,zh:inLang("zh",fn),en:inLang("local",fn)};}
function itemLines(x){
  var out=[],sto=x.place&&T.places[x.place]&&T.places[x.place].story;
  if(x.why)out.push(U("没排进行程：")+plain(x.why));
  if(x.body||x.note)out.push(plain(x.body||x.note));
  (x.facts||[]).forEach(function(f){out.push(L(f[0])+": "+plain(f[1]));});
  (x.tips||[]).forEach(function(t){out.push("• "+plain(t));});
  ["in","out"].forEach(function(k){var m=x[k];if(!m)return;
    var ids=(m.path||[]).filter(function(p){return typeof p==="string";});
    out.push((k==="in"?(en()?"Getting there: ":"怎么过去："):(en()?"Getting back: ":"怎么回来："))+[mode(m.mode),m.mins?hm(m.mins):"",ids.length>1?plain("[["+ids[0]+"]] → [["+ids[ids.length-1]+"]]"):"",m.note?plain(m.note):""].filter(Boolean).join(" · "));});
  (sto||[]).forEach(function(p){out.push(L(p[0])+" (places/"+x.place+"/story): "+plain(p[1]));});
  return out.join("\n").slice(0,1800);
}
function grpStops(run){return run.filter(function(x){return x.t==="stop";});}
function grpRow(run,cur){
  var li=document.createElement("li"),first=run[0],last=run[run.length-1],id=state.date+"|"+first.i,open=!!GOPEN[id]||run.some(function(x){return x.i===state.sel;});
  li.className="grp"+(open?" open":"");li.dataset.g=first.i;if(cur&&run.some(function(x){return x.i===cur.i;}))li.classList.add("now");
  var st=grpStops(run),walks=run.filter(function(x){return x.t==="move"&&x.mode==="walk";}),wm=0,km=0;
  walks.forEach(function(w){wm+=dur(w);km+=walkKm(w);});
  var t0=first.start||"",t1=last.end||last.start||"",span=t0&&t1?(mins(t1)-mins(t0)+1440)%1440:0;
  var bits=[span?hm(span):"",U("{n} 站",{n:st.length}),wm?U("走路约 {t}",{t:hm(wm)})+(km?" · "+distTxt(km):""):""].filter(Boolean).join(" · ");
  var ends=[];run.forEach(function(x){var p=x.t==="stop"?x.place:null;if(p&&ends[ends.length-1]!==p)ends.push(p);});
  // a walk that ends where it began says so instead of naming the place again
  var loop=false;if(last.t==="move"){var e=last.path[last.path.length-1],b0=first.t==="move"?first.path[0]:first.place;
    if(e===b0)loop=true;else if(typeof e==="string"&&ends[ends.length-1]!==e)ends.push(e);}
  var chips=ends.map(function(p){return '<span class="chip">'+tx("[["+p+"]]")+"</span>";}).concat(loop?['<span class="chip back">'+esc(U("回到起点"))+"</span>"]:[]).join('<span class="ar">→</span>');
  var b=document.createElement("div");b.className="row grp-row";b.setAttribute("role","button");b.tabIndex=0;b.setAttribute("aria-expanded",open);
  b.innerHTML='<span class="t">'+esc(t0)+'</span><span class="num">'+ICON.walk+'</span><span class="n">'+tx(first.group)+(li.classList.contains("now")?'<span class="now-tag">'+U("现在")+"</span>":"")+"</span>"+ICON.chev+
    '<span class="s">'+esc(bits)+'</span><span class="chips">'+chips+"</span>";
  li.appendChild(b);
  var fold=document.createElement("div");fold.className="grp-fold";fold.inert=!open;
  var inn=document.createElement("div");inn.className="grp-in";var ul=document.createElement("ol");ul.className="grp-list";
  run.forEach(function(x){ul.appendChild(segLi(x,cur,true));});
  var pts=[];run.forEach(function(x){(x.t==="stop"?[x.place]:x.path).forEach(function(p){if(typeof p==="string"&&pts[pts.length-1]!==p)pts.push(p);});});
  var acts=document.createElement("div");acts.className="actions grp-acts";
  acts.innerHTML=(pts.length>1?'<a class="pill" target="_blank" rel="noopener" href="'+esc(gRoute(pts.slice(0,10),"walking"))+'">'+ICON.dir+U("导航（整条步行路线）")+"</a>":"")+
    '<button class="pill ask" type="button">'+ICON.ask+U("问问这个")+"</button>";
  acts.querySelector(".ask").addEventListener("click",function(){if(!window.tripChat)return;
    var dt=state.date,when=t0?(t1&&t1!==t0?t0+" – "+t1:t0):"";
    window.tripChat.quote(quoteEvent(KCOL.hike,dt+(when?" "+when:"")+" · WALK [path=days/"+dt+"/segs/"+first.i+".."+last.i+", group="+first.group+"]",function(){
      var route=ends.map(function(p){return plain("[["+p+"]]");}).concat(loop?[U("回到起点")]:[]).join(" → ");
      var lines=[route].concat(run.map(function(x){
        if(x.t==="move")return "- "+mode(x.mode)+(dur(x)?" "+hm(dur(x)):"")+" "+moveLabel(x,true)+(x.note?" ("+plain(x.note)+")":"");
        var d=itemLines(x);return "- "+(x.start?x.start+" ":"")+plain(x.name||"[["+x.place+"]]")+(d?"\n  "+d.replace(/\n/g,"\n  "):"");}));
      return {meta:[md(dt)+" "+wk(dt),when,U("{n} 站",{n:st.length}),wm?U("走路约 {t}",{t:hm(wm)}):""].filter(Boolean).join(" · "),
        title:plain(first.group),sub:route,full:lines.join("\n").slice(0,1800)};}));});
  var box=document.createElement("div");box.className="grp-box";box.appendChild(ul);box.appendChild(acts);inn.appendChild(box);fold.appendChild(inn);li.appendChild(fold);
  b.addEventListener("click",function(){var sel=getSelection();if(sel&&!sel.isCollapsed&&b.contains(sel.anchorNode))return;var on=!li.classList.contains("open");
    if(on){closeGroups(li);closeOpts(null);if(state.sel!=null){state.sel=null;paintOpen();markSel();}}
    GOPEN[id]=on;
    if(!on&&run.some(function(x){return x.i===state.sel;})){state.sel=null;paintOpen();markSel();}
    li.classList.toggle("open",on);b.setAttribute("aria-expanded",on);fold.inert=!on;
    if(on)frameGroup(pts);else if(state.sel==null)fitView();});
  b.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();b.click();}});
  return li;}
function closeGroups(keep){document.querySelectorAll("#rows li.grp.open").forEach(function(el){if(el===keep)return;
  el.classList.remove("open");el.querySelector(".grp-row").setAttribute("aria-expanded","false");el.querySelector(".grp-fold").inert=true;
  GOPEN[state.date+"|"+el.dataset.g]=false;});}
function closeOpts(keep){document.querySelectorAll("#rows li.opts.open").forEach(function(el){if(el===keep)return;
  el.classList.remove("open");el.querySelector(".opt-toggle").setAttribute("aria-expanded","false");el.querySelector(".opt-fold").inert=true;
  OPTOPEN[state.date+"|"+el.dataset.opt]=false;});}
// opening a walk frames its stops on the map
function frameGroup(ids){hideHikeMap();var ps=ids.map(LL);caption();
  if(embed){if(ps.length>1)embedRoute(ps);else embedPlace(ps[0],15);return;}
  if(map||lMap)fitPts(ps,16);}
/* ---------- optional extras between stops ---------- */
// day.options: things left out of the plan, kept for when there's time. They hang after the stop they
// name ("after": a place id) as one quiet "可选 · N" line and only show in full when someone opens it.
var OPTOPEN={};
function optGroups(D){var g={};(D.options||[]).forEach(function(o){var k=o.after||"";(g[k]=g[k]||[]).push(o);});return g;}
function optMove(m){if(!m)return "";var bits=[];if(m.mins)bits.push(esc(hm(m.mins)));
  var ids=(m.path||[]).filter(function(x){return typeof x==="string";});if(ids.length>1)bits.push(tx("[["+ids[0]+"]] → [["+ids[ids.length-1]+"]]"));
  if(m.note)bits.push('<em>'+tx(m.note)+'</em>');
  return '<div class="opt-mv"><span class="opt-ic" title="'+esc(mode(m.mode))+'">'+(ICON[m.mode]||ICON.drive)+'</span><span>'+esc(mode(m.mode))+(bits.length?" "+bits.join(" · "):"")+'</span></div>';}
function optCard(o,k){
  var when=o.start?(o.end&&o.end!==o.start?o.start+" – "+o.end:o.start):o.mins?hm(o.mins):"",kind=L(T.kinds[o.kind])||"",h="";
  var phs=o.place?photosOf(o.place):[];
  h+='<div class="opt-card" style="--k:'+(KCOL[o.kind]||KCOL.visit)+'"><div class="opt-meta">'+esc([when,kind].filter(Boolean).join(" · "))+'</div>';
  h+='<h4>'+tx(o.name||"[["+o.place+"]]")+'</h4>';
  if(phs.length)h+=photoGrid(phs,k);
  if(o.why)h+='<p class="opt-why">'+U("没排进行程：")+tx(o.why)+'</p>';
  if(o.body)h+='<p class="body">'+tx(o.body)+'</p>';
  if(o.facts&&o.facts.length)h+='<dl class="facts">'+o.facts.map(function(f){return "<div><dt>"+esc(L(f[0]))+"</dt><dd>"+tx(f[1])+"</dd></div>";}).join("")+"</dl>";
  if(o.tips&&o.tips.length)h+='<ul class="tips">'+o.tips.map(function(t){return "<li>"+tx(t)+"</li>";}).join("")+"</ul>";
  var sto=o.place&&T.places[o.place]&&T.places[o.place].story;
  if(sto&&sto.length)h+='<section class="story"><h5>'+esc(U("背景和小知识"))+'</h5><dl>'+sto.map(function(x){return "<div><dt>"+esc(L(x[0]))+"</dt><dd>"+tx(x[1])+"</dd></div>";}).join("")+"</dl></section>";
  h+='<div class="actions">'+(o.place&&N[o.place]?'<a class="pill" target="_blank" rel="noopener" href="'+esc(gPlace(o.place))+'">'+ICON.maps+U("在 Google 地图打开")+"</a>":"")+
     '<button class="pill ask" type="button" data-opt-ask="'+esc(k)+'">'+ICON.ask+U("问问这个")+"</button></div></div>";
  return optMove(o["in"])+h+optMove(o.out);}
function optByKey(k){var p=k.split("#");return (optGroups(day())[p[0]]||[])[+p[1]];}
function optRow(o,k){
  var li=document.createElement("li"),id=state.date+"|"+k,open=!!OPTOPEN[id];li.className="opts"+(open?" open":"");li.dataset.opt=k;
  var label=plain(o.name||"[["+o.place+"]]");
  li.innerHTML='<button type="button" class="opt-toggle" aria-expanded="'+open+'"><span class="opt-ar">›</span>'+esc(U("可选"))+' · '+esc(label)+'</button>'+
    '<div class="opt-fold"'+(open?"":" inert")+'><div class="opt-in"><div class="opt-list">'+optCard(o,k)+'</div></div></div>';
  return li;}
$("rows").addEventListener("click",function(e){
  var t=e.target.closest(".opt-toggle");
  if(t){var li=t.closest("li.opts"),id=state.date+"|"+li.dataset.opt,on=!OPTOPEN[id];
    if(on){closeOpts(li);closeGroups(null);if(state.sel!=null){state.sel=null;paintOpen();markSel();}}
    OPTOPEN[id]=on;
    li.classList.toggle("open",on);t.setAttribute("aria-expanded",on);li.querySelector(".opt-fold").inert=!on;
    if(on){var o=optByKey(li.dataset.opt);
      if(o&&(o.kind==="hike"||(o.pts&&o.pts.length>1)))frameOptHike(o);
      else if(o&&o.place&&N[o.place])frameOpt(o);}
    else if(state.sel==null)fitView();
    return;}
  var a=e.target.closest("[data-opt-ask]");
  if(a){var k=a.dataset.optAsk.split("#"),o=optGroups(day())[k[0]][+k[1]],dt=state.date,oi=(day().options||[]).indexOf(o);
    if(o&&window.tripChat)window.tripChat.quote(quoteEvent(KCOL[o.kind]||KCOL.visit,
      dt+" · OPTIONAL [path=days/"+dt+"/options/"+(oi>=0?oi:0)+(o.place?", place="+o.place:"")+(o.after?", after="+o.after:"")+"]",function(){
        var when=o.start?(o.end&&o.end!==o.start?o.start+" – "+o.end:o.start):o.mins?hm(o.mins):"",sto=o.place&&T.places[o.place]&&T.places[o.place].story;
        return {meta:[md(dt)+" "+wk(dt),U("可选"),when,L(T.kinds[o.kind])].filter(Boolean).join(" · "),
          title:plain(o.name||"[["+o.place+"]]"),sub:plain(o.body||o.why||(sto&&sto[0]&&sto[0][1])||"").slice(0,200),full:itemLines(o)};}));return;}
  var pf=e.target.closest(".d-photo[data-opt-k]");
  if(pf&&!e.target.closest(".credit")){var k=pf.dataset.optK.split("#"),o=optGroups(day())[k[0]][+k[1]];
    if(o&&o.place){var phs=photosOf(o.place);if(phs.length)openLb(phs.map(function(p){return {s:{place:o.place,name:o.name},ph:p};}),+pf.dataset.k||0);}}});
function select(i,scroll){state.sel=i;paintOpen();var s=day().segs[i];
  markSel();frame(s);caption();
  if(scroll===false){var li=document.querySelector('#rows li[data-i="'+i+'"]');if(li)li.scrollIntoView({block:"center"});}}
function paintOpen(){
  var from=STAGE.closest("#rows li[data-i]");var added=[];
  document.querySelectorAll("#rows li[data-i]").forEach(function(li){var i=+li.dataset.i,on=i===state.sel;
    li.classList.toggle("open",on);li.querySelector(".row").setAttribute("aria-expanded",on);
    var d=li.querySelector(".detail:not(.closing)");if(on&&!d){d=detail(day().segs[i]);li.appendChild(d);added.push(d);}else if(!on&&d)foldAway(d);});
  var g=state.sel!=null&&document.querySelector('#rows li[data-i="'+state.sel+'"]'),gl=g&&g.closest("li.grp");
  if(state.sel!=null){closeGroups(gl);closeOpts(null);}
  if(gl&&!gl.classList.contains("open")){gl.classList.add("open");gl.querySelector(".grp-row").setAttribute("aria-expanded",true);gl.querySelector(".grp-fold").inert=false;GOPEN[state.date+"|"+gl.dataset.g]=true;}
  placeMap(document.querySelector("#rows li[data-i].open")||from);
  added.forEach(foldIn);
  document.dispatchEvent(new CustomEvent("trip:view"));
}
// A stop's details grow from nothing and shrink back before they go, height included, so the rows
// below slide instead of jumping (at once when motion is reduced).
function still(){return matchMedia("(prefers-reduced-motion:reduce)").matches||!Element.prototype.animate;}
function shut(d){var cs=getComputedStyle(d);
  return [{height:"0px",paddingTop:"0px",paddingBottom:"0px",marginBottom:"0px",opacity:0,transform:"translateY(-6px)"},
          {height:d.offsetHeight+"px",paddingTop:cs.paddingTop,paddingBottom:cs.paddingBottom,marginBottom:cs.marginBottom,opacity:1,transform:"none"}];}
function foldIn(d){if(still())return;d.style.overflow="hidden";
  var a=d.animate(shut(d),{duration:320,easing:"cubic-bezier(.2,.7,.2,1)"});a.onfinish=a.oncancel=function(){d.style.overflow="";};}
function foldAway(d){if(still()){d.remove();return;}
  d.classList.add("closing");d.style.overflow="hidden";
  var a=d.animate(shut(d).reverse(),{duration:240,easing:"cubic-bezier(.4,0,.6,1)",fill:"forwards"});
  a.onfinish=function(){d.remove();};setTimeout(function(){if(d.isConnected)d.remove();},600);}
/* ---------- phones: the map travels with the open stop ---------- */
// Below 900px the map sits above the plan and scrolls out of sight, so an open stop carries the map in
// its details and hands it back when it closes. The row you tapped stays where it was on screen.
var STAGE=document.querySelector(".stage"),MAPHOME=document.querySelector(".mapcol");
function placeMap(anchor,home){
  var slot=!home&&!wide.matches&&state.view==="day"&&state.sel!=null?document.querySelector("#rows li[data-i].open .detail-map"):null,to=slot||MAPHOME;
  if(STAGE.parentNode===to)return;
  var a=anchor&&anchor.isConnected?anchor:$("rows"),y0=a.getBoundingClientRect().top;
  to.appendChild(STAGE);MAPHOME.classList.toggle("away",!!slot);
  if(lMap)setTimeout(function(){lMap.invalidateSize();},50);
  var dy=a.getBoundingClientRect().top-y0;if(dy&&a.offsetParent)scrollBy(0,dy);}
if(wide.addEventListener)wide.addEventListener("change",function(){placeMap();});
// Official airline logos (docs/img/airlines/*.png) + boarding-pass cards for flight segments and airport meetups
var AIRLINES={
  FI:{name:"Icelandair",color:"#00468B",logo:"img/airlines/FI.png"},
  BA:{name:"British Airways",color:"#C8102E",logo:"img/airlines/BA.png"},
  SK:{name:"SAS",color:"#00205B",logo:"img/airlines/SK.png"},
  DY:{name:"Norwegian",color:"#D81939",logo:"img/airlines/DY.png",full:true},
  AC:{name:"Air Canada",color:"#D80621",logo:"img/airlines/AC.png"}
};
function airlineBadge(code,alt,cls){
  var al=AIRLINES[code];
  if(!al||!al.logo)return '<span class="'+(cls||"fl-logo")+'"><svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="9" fill="#1F4E6B"/><path d="M26 17l-7-1-3-6h-2l1.5 6-5 .5-1.5-2.5H8l1 4-1 4h1l1.5-2.5 5 .5L14 27h2l3-6 7-1c1 0 1.5-.7 1.5-1.5S27 17 26 17z" fill="#fff"/></svg></span>';
  return '<span class="'+(cls||"fl-logo")+' img'+(al.full?" full":"")+'"><img src="'+al.logo+'" alt="'+esc(alt||al.name)+'" loading="lazy"></span>';
}
function flightCards(list){
  if(!list||!list.length)return "";
  return '<div class="fl-grid'+(list.length>1?" multi":"")+'">'+list.map(function(f){
    var codes=(f.codes&&f.codes.length)?f.codes:(f.code?[f.code]:[]);
    var al=AIRLINES[codes[0]]||{name:f.airline||"Flight",color:"var(--ice)"};
    var brand=f.airline||(codes.length?codes.map(function(c){return (AIRLINES[c]||{}).name||c;}).join(" / "):al.name);
    var logos=codes.length?codes.map(function(c){return airlineBadge(c,brand);}).join(""):airlineBadge("",brand);
    var badges=[];
    if(f.direct!==false)badges.push('<span class="fl-badge ok">'+esc(U("直飞"))+'</span>');
    if(f.price)badges.push('<span class="fl-badge price">'+esc(f.price)+'</span>');
    var midMeta=[f.dur,f.tz].filter(Boolean).join(" · ");
    return '<div class="fl-card" style="--al:'+al.color+'">'+
      '<div class="fl-top">'+
        '<div class="fl-brand"><span class="fl-logos">'+logos+'</span>'+
          '<div class="fl-bt"><span class="fl-aname">'+esc(brand)+'</span>'+(f.tag?'<span class="fl-tag">'+esc(L(f.tag))+'</span>':'')+'</div>'+
        '</div>'+
        '<div class="fl-badges">'+badges.join("")+'</div>'+
      '</div>'+
      '<div class="fl-route">'+
        '<div class="fl-end">'+
          '<div class="fl-time">'+esc(f.dep)+'</div>'+
          '<div class="fl-iata">'+esc(f.from)+'</div>'+
          '<div class="fl-city">'+esc([f.fromCity?L(f.fromCity):"",f.dateDep||""].filter(Boolean).join(" · "))+'</div>'+
        '</div>'+
        '<div class="fl-mid">'+
          (midMeta?'<div class="fl-dur">'+esc(midMeta)+'</div>':'')+
          '<div class="fl-track"><span class="fl-dot"></span><span class="fl-line"></span><svg class="fl-plane" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg><span class="fl-line"></span><span class="fl-dot"></span></div>'+
        '</div>'+
        '<div class="fl-end right">'+
          '<div class="fl-time">'+esc(f.arr)+(f.nextDay?'<sup>+1</sup>':'')+'</div>'+
          '<div class="fl-iata">'+esc(f.to)+'</div>'+
          '<div class="fl-city">'+esc([f.toCity?L(f.toCity):"",f.dateArr||""].filter(Boolean).join(" · "))+'</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join("")+'</div>';
}
// Parse structured flight cards from s.flights, flight-formatted s.facts, mode==="flight" moves, or adjacent airport check-in stops
var IATA_CITY={YYZ:"多伦多",KEF:"凯夫拉维克",LHR:"伦敦",UK:"英国",OSL:"奥斯陆",BGO:"卑尔根",ARN:"斯德哥尔摩",CPH:"哥本哈根"};
function detectAirlines(str){
  var out=[];
  if(/icelandair|冰岛航空/i.test(str))out.push("FI");
  if(/british\s*airways|英航/i.test(str))out.push("BA");
  if(/\bsas\b|斯堪的纳维亚/i.test(str))out.push("SK");
  if(/norwegian|挪威航空/i.test(str))out.push("DY");
  if(/air\s*canada|加航/i.test(str))out.push("AC");
  return out;
}
function parseFlightFact(f){
  var val=String(f[1]||""),m=val.match(/(?:^|\s)(?:(\d+\/\d+)\s+)?(\d{1,2}:\d{2})\s+([A-Z]{2,3})\s*(?:→|->)\s*(?:(\d+\/\d+)\s+)?(\d{1,2}:\d{2})\s+([A-Z]{2,3})/);
  if(!m)return null;
  var codes=detectAirlines(val),d1=m[1]||"",d2=m[4]||"";
  var nextDay=!!(d1&&d2&&d1!==d2);
  var pm=val.match(/(?:~?\$|USD\s*|CAD\s*|NOK\s*|SEK\s*)\d[\d,]*/i);
  var dm=val.match(/(\d+\s*h(?:\s*\d+\s*m(?:in)?)?)/i);
  var tm=val.match(/([+-]\d+\s*h)/i);
  var aname=codes.length?codes.map(function(c){return AIRLINES[c].name;}).join(" / "):val.split(/\s+/)[0];
  return {codes:codes,code:codes[0]||"",airline:aname,tag:f[0],from:m[3],fromCity:IATA_CITY[m[3]]||"",to:m[6],toCity:IATA_CITY[m[6]]||"",
    dep:m[2],arr:m[5],dateDep:d1,dateArr:d2,nextDay:nextDay,dur:dm?dm[1].replace(/min/i,"m"):"",tz:tm?tm[1]:"",price:pm?pm[0]:"",direct:/直飞|nonstop|direct/i.test(val)};
}
function flightFromMove(s,dt){
  if(!s||s.t!=="move"||s.mode!=="flight"||!s.path||s.path.length<2)return null;
  var note=s.note||"",codes=detectAirlines(note),p0=String(s.path[0]).toUpperCase(),p1=String(s.path[s.path.length-1]).toUpperCase();
  var dur=s.mins?(Math.floor(s.mins/60)+"h"+(s.mins%60?" "+(s.mins%60)+"m":"")):"";
  var tm=note.match(/([+-]\s*\d+\s*h)/i),pm=note.match(/(?:~?\$|USD\s*)\d[\d,]*/i);
  var mdStr=dt?(+dt.slice(5,7))+"/"+(+dt.slice(8,10)):"";
  var aname=codes.length?codes.map(function(c){return AIRLINES[c].name;}).join(" / "):"Flight";
  var tag=/待定|以出票为准/.test(note)?"参考时刻":"";
  return {codes:codes,code:codes[0]||"",airline:aname,tag:tag,from:p0,fromCity:IATA_CITY[p0]||"",to:p1,toCity:IATA_CITY[p1]||"",
    dep:s.start||"",arr:s.end||"",dateDep:mdStr,dateArr:mdStr,dur:dur,tz:tm?tm[1].replace(/\s+/g,""):"",price:pm?pm[0]:"",direct:/直飞|nonstop|direct/i.test(note)};
}
function extractFlights(s){
  if(s.flights&&s.flights.length)return {flights:s.flights,facts:s.facts||[]};
  var flights=[],rest=[];
  (s.facts||[]).forEach(function(f){var fl=parseFlightFact(f);if(fl)flights.push(fl);else rest.push(f);});
  if(!flights.length&&s.t==="move"&&s.mode==="flight"){var fm=flightFromMove(s,state.date);if(fm)flights.push(fm);}
  // Airport check-in or arrival stop right next to a flight move also shows that flight's boarding-pass card
  if(!flights.length&&s.t==="stop"&&day()&&s.i!=null){
    var segs=day().segs,nx=segs[s.i+1],pv=segs[s.i-1];
    var adj=(nx&&nx.t==="move"&&nx.mode==="flight"&&nx.path&&nx.path[0]===s.place)?nx:
            (pv&&pv.t==="move"&&pv.mode==="flight"&&pv.path&&pv.path[pv.path.length-1]===s.place)?pv:null;
    var af=flightFromMove(adj,state.date);if(af)flights.push(af);
  }
  return {flights:flights,facts:rest};
}
function detail(s){
  var d=document.createElement("div");d.className="detail";var kind=s.t==="move"?"move":s.kind;
  var when=s.start?(s.end&&s.end!==s.start?s.start+" – "+s.end:s.start):"";
  var phs=s.t==="stop"?photosOf(s.place):[],h="";
  if(phs.length)h+=photoGrid(phs);
  else if(s.t==="stop"&&SCENIC[s.kind])h+='<div class="d-photos n1"><figure class="d-photo empty">'+tbd()+"</figure></div>";
  h+='<span class="kind" style="--k:'+(KCOL[kind]||KCOL.visit)+'">'+esc(s.t==="move"?mode(s.mode):L(T.kinds[kind])||"")+(when?" · "+esc(when):"")+(s.t==="move"&&s.km?U(" · 约 {n} 公里",{n:s.km}):"")+'</span>';
  h+='<div class="detail-map"></div>'; // phones only: the map moves in here (placeMap)
  var fl=extractFlights(s);
  if(fl.flights.length)h+=flightCards(fl.flights);
  if(fl.facts.length)h+='<dl class="facts">'+fl.facts.map(function(f){return "<div><dt>"+esc(L(f[0]))+"</dt><dd>"+tx(f[1])+"</dd></div>";}).join("")+"</dl>";
  var body=s.body||s.note;if(body)h+='<p class="body">'+tx(body)+"</p>";
  if(s.tips&&s.tips.length)h+='<ul class="tips">'+s.tips.map(function(t){return "<li>"+tx(t)+"</li>";}).join("")+"</ul>";
  // places[id].story: [label, text] pairs of history and fun facts about the place
  var sto=s.t==="stop"&&T.places[s.place]&&T.places[s.place].story;
  if(sto&&sto.length)h+='<section class="story"><h5>'+esc(U("背景和小知识"))+'</h5><dl>'+sto.map(function(x){return "<div><dt>"+esc(L(x[0]))+"</dt><dd>"+tx(x[1])+"</dd></div>";}).join("")+"</dl></section>";
  var acts=[];
  if(s.t==="stop")acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(gPlace(s.place))+'">'+ICON.maps+U("在 Google 地图打开")+"</a>");
  if(s.t==="move"&&(s.mode==="drive"||s.mode==="walk"||s.mode==="bike"||s.mode==="train"||s.mode==="bus")){var ends=[s.path[0],s.path[s.path.length-1]].filter(function(x){return typeof x==="string";});
    if(ends.length===2)acts.push('<a class="pill" target="_blank" rel="noopener" href="'+esc(gRoute(s.path.filter(function(x){return typeof x==="string";}),s.mode==="drive"?"driving":s.mode==="walk"?"walking":s.mode==="bike"?"bicycling":"transit"))+'">'+ICON.dir+U("导航")+"</a>");}
  acts.push('<button class="pill ask" type="button">'+ICON.ask+U("问问这个")+"</button>");
  h+='<div class="actions">'+acts.join("")+"</div>";
  d.innerHTML=h;
  function bindPhotos(){
    var cur=s.t==="stop"?photosOf(s.place):[];
    d.querySelectorAll(".d-photo[data-k]").forEach(function(fig){fig.addEventListener("click",function(e){if(e.target.closest(".credit"))return;
      var ph=cur[+fig.dataset.k];if(!ph)return;
      var g=cur.length>3?cur.map(function(p){return {s:s,ph:p};}):dayGallery(day());
      if(!g.length)g=cur.map(function(p){return {s:s,ph:p};});
      openLb(g,galleryIndex(g,ph));});});
  }
  bindPhotos();
  if(s.t==="stop"&&s.place&&SCENIC[s.kind]){
    loadGooglePhotos(s.place,function(added){
      if(!added||!d.isConnected)return;
      var cur=photosOf(s.place);if(!cur.length)return;
      var old=d.querySelector(".d-photos");
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
      if(badge){
        var kindEl=d.querySelector(".kind");
        if(kindEl&&!d.querySelector(".g-hours"))kindEl.insertAdjacentHTML("afterend",badge);
      }
      if(info.website){
        var actsEl=d.querySelector(".actions");
        if(actsEl&&!actsEl.querySelector(".g-web")){
          var a=document.createElement("a");a.className="pill g-web";a.target="_blank";a.rel="noopener";a.href=info.website;
          a.textContent=en()?"Official site":"官网";
          var mapBtn=actsEl.firstChild;
          if(mapBtn&&mapBtn.nextSibling)actsEl.insertBefore(a,mapBtn.nextSibling);else actsEl.appendChild(a);
        }
      }
    });
  }
  d.querySelector(".ask").addEventListener("click",function(){if(!window.tripChat)return;
    var dt=state.date;
    if(s.t==="move"){
      window.tripChat.quote(quoteEvent(KCOL.move,dt+(when?" "+when:"")+" · "+s.mode.toUpperCase()+" [path=days/"+dt+"/segs/"+s.i+"]",function(){
        var w=when||(dur(s)?hm(dur(s)):""),txt=s.note||s.body||"";
        return {meta:[md(dt)+" "+wk(dt),w,cap(mode(s.mode)),s.km?distTxt(s.km):""].filter(Boolean).join(" · "),
          title:moveLabel(s,true),sub:plain(txt).slice(0,200),full:itemLines(s)};}));
    }else{
      window.tripChat.quote(quoteEvent(KCOL[s.kind]||KCOL.visit,dt+(when?" "+when:"")+" · STOP "+(s.num||"")+" [path=days/"+dt+"/segs/"+s.i+", place="+s.place+"]",function(){
        var w=when||(s.mins?hm(s.mins):"");
        return {meta:[md(dt)+" "+wk(dt),w,L(T.kinds[s.kind])].filter(Boolean).join(" · "),
          title:plain(s.name||"[["+s.place+"]]"),sub:plain(s.body||(sto&&sto[0]&&sto[0][1])||(s.tips&&s.tips[0])||"").slice(0,200),full:itemLines(s)};}));
    }});
  return d;
}

// previous / next day at the end of the timeline
function renderDayNav(){var i=DATES.indexOf(state.date),h="";
  [[i-1,"prev","‹ "+U("前一天")],[i+1,"next",U("后一天")+" ›"]].forEach(function(x){var d=DATES[x[0]];
    if(!d){h+="<span></span>";return;}
    h+='<button type="button" class="dn '+x[1]+'" data-date="'+d+'" style="--c:'+colorOf(d)+'"><small>'+esc(x[2])+" · "+md(d)+" "+wk(d)+"</small><b>"+esc(dayLabel(d))+"</b></button>";});
  $("dayNav").innerHTML=h;}
$("glance").addEventListener("click",function(e){var b=e.target.closest("[data-booking]");if(b){openBooking(b.dataset.booking);return;}
  var br=e.target.closest("[data-bring]");if(br){var all=store("nt-bring")||{},mine=all[state.date]=all[state.date]||{},k=br.dataset.bring;
    if(mine[k])delete mine[k];else mine[k]=1;store("nt-bring",all);br.classList.toggle("got",!!mine[k]);br.setAttribute("aria-pressed",!!mine[k]);}});
$("dayNav").addEventListener("click",function(e){var b=e.target.closest("[data-date]");if(b){setView("day",b.dataset.date);window.scrollTo({top:Math.min(scrollY,$("dayView").offsetTop-130),behavior:"smooth"});}});
// swipe left / right on the day view (phones) changes the day
(function(){var x0=null,y0=0;
  $("dayView").addEventListener("touchstart",function(e){var t=e.touches[0];x0=t.clientX;y0=t.clientY;},{passive:true});
  $("dayView").addEventListener("touchend",function(e){if(x0==null)return;var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;
    if(Math.abs(dx)>70&&Math.abs(dy)<45)$(dx<0?"nextDay":"prevDay").click();},{passive:true});})();

/* ---------- motion helpers ---------- */
// the highlight pill under the selected tab (or language) slides to it; snap=true resizes in place without lagging
function slideInd(box,sel,snap){var c=document.querySelector(box),b=c&&c.querySelector(sel);if(!b||!b.offsetWidth)return;
  var ind=c.querySelector(".ind");if(!ind){ind=document.createElement("span");ind.className="ind";ind.setAttribute("aria-hidden","true");c.prepend(ind);snap=true;}
  var w=b.offsetWidth+"px",h=b.offsetHeight+"px",tr="translate("+b.offsetLeft+"px,"+b.offsetTop+"px)";
  if(ind.style.width===w&&ind.style.height===h&&ind.style.transform===tr)return;
  var now=snap&&!ind._mov;
  if(now)ind.style.transition="none";
  else{clearTimeout(ind._t);ind._mov=1;ind._t=setTimeout(function(){ind._mov=0;},360);}
  ind.style.width=w;ind.style.height=h;ind.style.transform=tr;
  if(now){void ind.offsetWidth;ind.style.transition="";}}
function syncInds(){if(!T)return;slideInd(".seg",'.seg-btn[aria-selected="true"]',true);slideInd(".names",'[aria-checked="true"]',true);}
window.addEventListener("resize",syncInds);
if(window.ResizeObserver)(function(){var ro=new ResizeObserver(syncInds);
  document.querySelectorAll(".seg,.seg-btn,.names,.names button").forEach(function(el){ro.observe(el);});})();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(syncInds);
// the sticky bar gets a soft shadow once the page scrolls under it
(function(){var st=$("sticky"),on=null;function f(){var v=scrollY>8;if(v!==on){on=v;st.classList.toggle("stuck",v);}}addEventListener("scroll",f,{passive:true});f();})();
// re-run a CSS entrance animation on an element
function replay(el,cls){if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);}

/* ---------- photos ---------- */
// Up to three photos per place (places[id].photos: src, w, h, author, page, alt), each checked by eye against
// the place. From Unsplash (author_link; any width from the same URL; the credit links the photographer and
// Unsplash, as its API guidelines ask) or Wikimedia Commons (license; a 1280px thumbnail URL, other widths
// snapped to the sizes Wikimedia serves; the credit links the file page with its author and license).
// Scenic stops still waiting for photos show a grey "TBD" tile.
var SCENIC={visit:1,hike:1,glacier:1,water:1,camp:1,city:1};
var UTM="utm_source=nordic_trip_2027&utm_medium=referral";
var GPHOTOS={},GPHOTOS_WAIT={},GPHOTOS_OFF=false;
var GINFO={},GINFO_WAIT={},GINFO_OFF=false;
function loadPlaceInfo(id,cb){
  if(!id||GINFO_OFF){if(cb)cb(null);return;}
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
    .catch(function(){
      var cbs=GINFO_WAIT[id]||[];delete GINFO_WAIT[id];
      cbs.forEach(function(fn){fn(null);});
    });
}
function pad2(n){return (n<10?"0":"")+n;}
function renderPlaceHours(info,s,date){
  if(!info)return "";
  if(info.status==="CLOSED_PERMANENTLY")return '<div class="g-hours warn">'+(en()?"⚠️ Marked permanently closed on Google Maps":"⚠️ Google 地图标记为已永久停业")+"</div>";
  if(info.status==="CLOSED_TEMPORARILY")return '<div class="g-hours warn">'+(en()?"⚠️ Marked temporarily closed on Google Maps":"⚠️ Google 地图标记为暂时歇业")+"</div>";
  var periods=(info.hours&&info.hours.periods)||[];
  if(!periods.length)return "";
  if(periods.length===1&&periods[0].open&&periods[0].open.day===0&&periods[0].open.hour===0&&!periods[0].close){
    return '<div class="g-hours ok">'+(en()?"Open 24 hours (Google)":"24 小时开放（Google）")+"</div>";
  }
  var dow=new Date(date+"T12:00:00").getDay();
  var dayNames=en()?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]:["周日","周一","周二","周三","周四","周五","周六"];
  var dn=dayNames[dow];
  var slots=periods.filter(function(p){return p.open&&p.open.day===dow;});
  var checkKind=/^(visit|city|food|shop|water)$/.test(s.kind||"");
  if(!slots.length){
    return '<div class="g-hours '+(checkKind?"warn":"ok")+'">'+(en()?"⚠️ Closed on "+dn+" (Google Maps)":"⚠️ Google 显示"+dn+"闭馆/休息")+"</div>";
  }
  var spans=slots.map(function(p){
    var o=p.open.hour*60+(p.open.minute||0);
    var c=p.close?(p.close.day===dow?p.close.hour*60+(p.close.minute||0):1440+p.close.hour*60+(p.close.minute||0)):1440;
    var label=pad2(p.open.hour)+":"+pad2(p.open.minute||0)+"–"+(p.close?pad2(p.close.hour)+":"+pad2(p.close.minute||0):"24:00");
    return {o:o,c:c,label:label};
  });
  var txt=spans.map(function(x){return x.label;}).join(", ");
  var conflict=false;
  if(checkKind&&s.start){
    var st=mins(s.start),enM=s.end&&s.end!==s.start?mins(s.end):st;
    var fits=spans.some(function(x){return st>=x.o&&enM<=x.c;});
    if(!fits)conflict=true;
  }
  if(conflict){
    return '<div class="g-hours warn">'+(en()?"⚠️ Hours conflict ("+dn+" "+txt+")":"⚠️ 与营业时间冲突（"+dn+" "+txt+"）")+"</div>";
  }
  return '<div class="g-hours ok">'+(en()?"Hours · "+dn+" "+txt:"营业时间 · "+dn+" "+txt)+"</div>";
}
function photosOf(id){
  var p=T&&T.places[id],base=(p&&p.photos)||[],gp=GPHOTOS[id]||[];
  if(!gp.length)return base;
  if(!base.length)return gp;
  var seen={},out=[];
  base.concat(gp).forEach(function(x){if(x&&x.src&&!seen[x.src]){seen[x.src]=1;out.push(x);}});
  return out;
}
function loadGooglePhotos(id,cb){
  if(!id||GPHOTOS_OFF||GPHOTOS[id]){if(cb)cb(0);return;}
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
    .catch(function(){
      var cbs=GPHOTOS_WAIT[id]||[];delete GPHOTOS_WAIT[id];
      cbs.forEach(function(fn){fn(0);});
    });
}
// Wikimedia serves fixed thumbnail widths only (photos from Commons are all at least 1920px wide)
function sized(src,w){
  if(/googleusercontent\.com|googleapis\.com/.test(src))return src;
  if(src.indexOf("images.unsplash.com")<0)return src.replace(/\/(\d+)px-/,"/"+(w<=500?500:w<=960?960:w<=1280?1280:1920)+"px-");
  var u=src.replace(/([?&])(w|q|fm|fit|auto)=[^&]*/g,"$1").replace(/&&+/g,"&").replace(/[?&]+$/,"");
  return u+(u.indexOf("?")<0?"?":"&")+"w="+w+"&q=80&fm=jpg&fit=max";}
function img(ph,w,cls){return '<img class="'+(cls||"")+'" src="'+esc(sized(ph.src,w))+'" width="'+ph.w+'" height="'+ph.h+'" alt="'+esc(ph.alt||"")+'" loading="lazy" decoding="async" onload="this.classList.add(\'ok\')">';}
function photoGrid(phs,optK){
  var oa=optK!=null?' data-opt-k="'+esc(optK)+'"':"";
  var show=phs.slice(0,4),extra=phs.length-show.length;
  var cnt=phs.length>1?'<span class="d-photo-cnt">'+(en()?phs.length+" photos":phs.length+" 张")+"</span>":"";
  return '<div class="d-photos n'+show.length+'">'+show.map(function(ph,k){
    var more=(extra>0&&k===show.length-1)?'<span class="d-photo-more">+'+extra+"</span>":"";
    return '<figure class="d-photo"'+oa+' data-k="'+k+'">'+img(ph,k?600:1200)+(k?"":cnt+"<figcaption>"+credit(ph)+"</figcaption>")+more+"</figure>";
  }).join("")+"</div>";
}
function utm(u){return u+(u.indexOf("?")<0?"?":"&")+UTM;}
function credit(ph){
  if(ph.source==="google")return '<a class="credit" href="'+esc(ph.page||"https://maps.google.com/")+'" target="_blank" rel="noopener">'+esc(U("照片："))+esc(ph.author||"Google Maps")+" · Google Maps</a>";
  if(ph.author_link)return '<span class="credit">'+esc(U("摄影："))+'<a href="'+esc(utm(ph.author_link))+'" target="_blank" rel="noopener">'+esc(ph.author)+'</a> / <a href="'+esc(utm("https://unsplash.com/"))+'" target="_blank" rel="noopener">Unsplash</a></span>';
  return '<a class="credit" href="'+esc(ph.page)+'" target="_blank" rel="noopener">'+esc(U("照片："))+esc(ph.author||"")+(ph.license?" · "+esc(ph.license):"")+"</a>";}
/* a plan place in the assistant's map cards (chat.js): the place a stop stands for (its id, else the same
   coordinates, else the same name; among places sharing a spot, one with photos), and what the card's pop-up
   shows: its name, what kind of stop it is, the days it's on and its photos */
function placeOf(s){if(!s||!T)return null;if(s.place&&T.places[s.place])return s.place;var hits=[];
  if(s.ll&&s.ll.length===2)Object.keys(N).forEach(function(id){var p=N[id];if(p&&Math.abs(p[0]-s.ll[0])<2e-4&&Math.abs(p[1]-s.ll[1])<2e-4)hits.push(id);});
  if(!hits.length&&s.name){var k=String(s.name).trim().toLowerCase();
    Object.keys(T.places).forEach(function(id){var p=T.places[id];if([p.zh,p.local,p.en].some(function(n){return n&&String(n).trim().toLowerCase()===k;}))hits.push(id);});}
  return hits.filter(function(id){return photosOf(id).length;})[0]||hits[0]||null;}
function placeVisits(id){var out=[];
  T.days.forEach(function(D){D.segs.forEach(function(s,i){if(s.t==="stop"&&s.place===id&&!out.some(function(v){return v.date===D.date;}))out.push({date:D.date,i:i,kind:s.kind});});});
  return out;}
function mapPlace(s){var id=placeOf(s);if(!id)return null;var v=placeVisits(id),phs=photosOf(id),n=names(id);
  if(!phs.length&&!v.length)return null;
  // what the place is (景点, 徒步, 冰川…); sleeping, eating or shopping there says little about the place itself
  var kind=v.map(function(x){return x.kind;}).filter(function(k){return k&&T.kinds[k]&&!/^(stay|start|food|shop)$/.test(k);})[0];
  return {id:id,name:pn(id,true),local:NM!=="local"&&n.lo!==n.zh?n.lo:"",kind:kind?L(T.kinds[kind]):"",
    days:v.map(function(x){return {date:x.date,label:md(x.date)};}),
    photos:phs.map(function(ph,k){return img(ph,k?500:960);}),thumb:phs.length?img(phs[0],500):"",credit:phs.length?credit(phs[0]):""};}
// "in the plan" on a pop-up: that day, with the stop open
function goToPlace(id,date){if(DATES.indexOf(date)<0)return;setView("day",date);
  var D=day(),i=-1;if(D)D.segs.forEach(function(s,k){if(i<0&&s.t==="stop"&&s.place===id)i=k;});
  if(i>=0)select(i,false);}
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
  if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();closeLb();/* the photo closes, not the chat under it */}else if(e.key==="ArrowLeft"){e.preventDefault();e.stopImmediatePropagation();stepLb(-1);}else if(e.key==="ArrowRight"){e.preventDefault();e.stopImmediatePropagation();stepLb(1);}},true);
(function(){var x0=null;$("lb").addEventListener("touchstart",function(e){x0=e.touches[0].clientX;},{passive:true});
  $("lb").addEventListener("touchend",function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)stepLb(dx<0?1:-1);},{passive:true});})();

/* ---------- pace: how full a day is ---------- */
// Worked out from the plan rather than tagged by hand: time behind the wheel (bus, train and ferry count about
// half, a flight a bit more plus an hour at the airport), time on foot (hikes, long walks and bike rides fully,
// glacier viewpoints, town and sightseeing a little), plus a day over 10 hours, 6+ hours in a vehicle, an early
// start or a late finish. A day in trip.json can override it with "pace": 1 (easy) to 3 (full) and say why in "paceNote".
var PACEM={drive:1.15,bus:.6,train:.6,ferry:.5,flight:.6,walk:1.1,bike:1.1},PACEK={hike:1.1,glacier:.7,city:.4,visit:.25,water:.3};
var PACEN=["","轻松","适中","很满"];
function pace(D){var p={drive:0,ride:0,foot:0,a:null,b:null,sc:0};
  D.segs.forEach(function(s){var m=dur(s);
    if(s.start){var a=mins(s.start),b=s.end?mins(s.end):a;if(b<a)b+=1440;if(p.a==null||a<p.a)p.a=a;if(p.b==null||b>p.b)p.b=b;}
    if(s.t==="move"){p.sc+=m/60*(PACEM[s.mode]||.6)+(s.mode==="flight"?1:0);
      if(s.mode==="drive")p.drive+=m;else if(s.mode==="walk"||s.mode==="bike")p.foot+=m;else p.ride+=m;}
    else{p.sc+=m/60*(PACEK[s.kind]||0);if(s.kind==="hike")p.foot+=m;}});
  p.span=p.a!=null?(p.b-p.a)/60:0;
  p.sc+=Math.max(0,p.span-10)*.5+(p.drive+p.ride>=360?1:0);
  if(p.a!=null){if(p.a<420)p.sc+=1;if(p.a<360)p.sc+=1;if(p.b>1260)p.sc+=.7;}
  p.lv=D.pace>=1&&D.pace<=3?Math.round(D.pace):p.sc<5.5?1:p.sc<9.5?2:3;
  return p;}
function lvOf(d){return PACE[d]?PACE[d].lv:0;}
// the biggest reasons, at most three
function paceWhy(d){var p=PACE[d],D=BYDATE[d],r=[];if(!p)return r;
  if(D.paceNote)r.push([99,plain(D.paceNote)]);
  if(p.drive>=90)r.push([p.drive/60,U("开车 {t}",{t:hm(p.drive)})]);
  if(p.foot>=90)r.push([p.foot/60,U("走路 {t}",{t:hm(p.foot)})]);
  if(p.ride>=150)r.push([p.ride/90,U("在路上 {t}",{t:hm(p.ride)})]);
  if(p.a!=null&&p.a<420)r.push([5,U("{t} 出发",{t:fmt(p.a)})]);
  if(p.a!=null&&p.b>1260)r.push([3,U("{t} 才结束",{t:fmt(p.b)})]);
  if(p.span>=13)r.push([2.5,U("从早到晚 {n} 小时",{n:Math.round(p.span)})]);
  return r.sort(function(x,y){return y[0]-x[0];}).slice(0,3).map(function(x){return x[1];});}
// the run of full days this one is part of
function fullRun(d){var i=DATES.indexOf(d),a=i,b=i;if(lvOf(d)!==3)return null;
  while(a>0&&lvOf(DATES[a-1])===3)a--;while(b<DATES.length-1&&lvOf(DATES[b+1])===3)b++;
  return {n:b-a+1,i:i-a+1,from:DATES[a],to:DATES[b]};}
// three bars, as many filled as the level; tip=true says the level and why on hover
function paceMeter(d,tip){var lv=typeof d==="number"?d:lvOf(d);
  var t=tip&&typeof d==="string"?U(PACEN[lv])+(paceWhy(d).length?" · "+paceWhy(d).join(" · "):""):"";
  return '<span class="pm p'+lv+'"'+(t?' title="'+esc(t)+'"':' aria-hidden="true"')+"><i></i><i></i><i></i></span>";}
// under the calendar: how many days of each, and the longest stretch of full days
function renderPaceSum(){var c=[0,0,0,0],best=null;
  DATES.forEach(function(d){c[lvOf(d)]++;var r=fullRun(d);if(r&&(!best||r.n>best.n))best=r;});
  var h="<b>"+U("节奏")+"</b>"+[1,2,3].map(function(lv){return "<span>"+paceMeter(lv)+" "+U(PACEN[lv])+" · "+U("{n} 天",{n:c[lv]})+"</span>";}).join("");
  if(best&&best.n>=3)h+='<button type="button" class="pace-run-btn" data-date="'+best.from+'">'+U("最长连着 {n} 天很满：{a}–{b}",{n:best.n,a:md(best.from),b:md(best.to)})+" →</button>";
  $("paceSum").innerHTML=h+'<span class="pace-how">'+U("按开车、走路时间和起止时间估算")+"</span>";}

/* ---------- what to bring today ---------- */
// A short list worked out from the day (hot pools, hikes, glaciers, waterfalls, camping, long drives, ferries,
// flights, a new rental car) and from the forecast once there is one. A day in trip.json can add its own with
// "bring": ["..."]. Tapping an item ticks it off on this device (nt-bring, by date).
var SWIM=/温泉|泻湖|浴场|沙滩|海滩|lagoon|baths|beach|hot ?spring/i;
function placeText(s){var p=T.places[s.place]||{};return [s.name,s.body,s.place,p.zh,p.en,p.local].join(" ");}
function bringList(d){var D=BYDATE[d];if(!D)return [];
  var out=[],seen={},p=PACE[d],w=weather[d],c=T.countries[cOf(d)]||{},id=wxPlace(d),clim=(id&&T.places[id].climate)||c.climate;
  function add(k,why){if(!seen[k]){seen[k]=1;out.push([k,esc(U(k)),why||""]);}}
  function sum(f){return D.segs.reduce(function(a,s){return a+(f(s)?dur(s):0);},0);}
  function has(f){return D.segs.some(f);}
  var drives=function(X){return X&&X.segs.some(function(s){return s.mode==="drive";});};
  var flight=has(function(s){return s.mode==="flight";});
  if(flight||d===T.dates.start||d===T.dates.end||(has(function(s){return s.mode==="ferry"||s.mode==="train"||s.mode==="bus";})&&cOf(addDays(d,1))&&cOf(addDays(d,1))!==cOf(d)))add("护照",U("今天过境或坐飞机"));
  if(drives(D)&&!drives(BYDATE[addDays(d,-1)]))add("驾照和实体信用卡",U("今天取车"));
  if(flight)add("充电宝放随身行李",U("今天坐飞机"));
  var foot=sum(function(s){return s.kind==="hike"||s.kind==="glacier"&&dur(s)>=90||s.mode==="walk"&&dur(s)>=45;});
  if(foot>=60)add("登山鞋",U("走路 {t}",{t:hm(foot)}));
  if(foot>=180)add("水和路上吃的",U("走路 {t}",{t:hm(foot)}));
  var town=sum(function(s){return s.kind==="city";});
  if(foot<60&&town>=180)add("好走的鞋",U("逛城 {t}",{t:hm(town)}));
  if(has(function(s){return s.kind==="water"&&SWIM.test(placeText(s));}))add("泳衣和毛巾",U("要泡温泉或下水"));
  if(has(function(s){return s.t==="stop"&&(/foss/.test(s.place||"")||/瀑布/.test(((T.places[s.place]||{}).zh)||""));}))add("防水外套",U("瀑布水雾大"));
  if(has(function(s){return s.kind==="glacier"&&dur(s)>=90;})){add("手套和帽子",U("冰川上冷"));add("墨镜和防晒",U("冰面反光"));}
  if(has(function(s){return s.kind==="camp"&&/扎营|营地|帐篷/.test(s.name||"");})){add("睡袋和防潮垫",U("今晚露营"));add("眼罩",U("极昼，夜里也亮"));}
  if(p&&p.drive>=240)add("零食、充电线和离线歌单",U("开车 {t}",{t:hm(p.drive)}));
  var boat=sum(function(s){return s.mode==="ferry";});
  if(boat>=120)add("晕船药",U("渡轮 {t}",{t:hm(boat)}));
  if(w&&w!=="loading"&&w.hi!=null){
    if(w.rain>=50)add("雨衣雨裤",U("降水概率 {n}%",{n:w.rain}));
    if(w.hi<=10)add("保暖层",U("最高 {n}°",{n:Math.round(w.hi)}));
    if(w.wind/3.6>=12)add("防风外套",U("风大"));
    if(w.code<=1)add("墨镜和防晒",U("晴天"));}
  else if(clim&&clim.hi<=10)add("保暖层",U("最高 {n}°",{n:clim.hi}));
  (D.bring||[]).forEach(function(x){if(!seen[x]){seen[x]=1;out.push([x,tx(x),""]);}});
  return out;}

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
  var p=PACE[d];
  if(p){var run=fullRun(d),why=paceWhy(d).join(" · ")||U("没有长途");
    h+='<div class="pace-row p'+p.lv+'">'+paceMeter(d)+"<b>"+U(PACEN[p.lv])+"</b><span>"+esc(why.charAt(0).toUpperCase()+why.slice(1))+"</span>"+
      (run&&run.n>=3?'<span class="pace-run">'+U("连着 {n} 天很满的第 {i} 天",{n:run.n,i:run.i})+"</span>":"")+"</div>";}
  if(D&&liveDate()===d){var t=nowIn(tzOf(d)).mins,cur=nowSeg(),nx=segs.filter(function(s){return s.t==="stop"&&s.start&&mins(s.start)>t;})[0];
    if(cur)h+='<div class="nownext"><span><b>'+U("现在")+'</b>'+(cur.t==="move"?esc(mode(cur.mode))+" "+moveLabel(cur):tx(cur.verb||cur.name||"[["+cur.place+"]]"))+'</span>'+
      (nx?'<span><b>'+U("下一站")+'</b>'+tx(nx.name||"[["+nx.place+"]]")+" "+esc(nx.start)+U("（{t}后）",{t:hm(mins(nx.start)-t)})+"</span>":"")+"</div>";}
  // what to bring, ticked off on this device
  var br=bringList(d),got=(store("nt-bring")||{})[d]||{};
  if(br.length)h+='<div class="bring" title="'+esc(U("点一下表示已装好"))+'"><b>'+U("带上")+"</b>"+br.map(function(x){var on=!!got[x[0]];
    return '<button type="button" class="br-i'+(on?" got":"")+'" data-bring="'+esc(x[0])+'" aria-pressed="'+on+'"'+(x[2]?' title="'+esc(x[2])+'"':"")+">"+ICON.check+"<span>"+x[1]+"</span></button>";}).join("")+"</div>";
  // what has to be booked for this day, and whether it is
  var bk=dayBookings(d);
  if(bk.length)h+='<div class="dbk"><b>'+U("预订")+"</b>"+bk.map(function(x){
    return '<button type="button" class="dbk-i'+(x.done?" ok":"")+'" data-booking="'+esc(x.b.id)+'" title="'+esc(U(x.done?"已订":"还没订"))+'">'+(x.done?ICON.check:ICON.visa)+"<span>"+esc(plain(x.b.what))+"</span></button>";}).join("")+"</div>";
  $("glance").innerHTML=h;
}

/* ---------- map ---------- */
var G=null,map=null,Marker=null,lines=[],markers=[],you=null,embed=null,lMap=null,lLayer=null;
function caption(){var D=day(),s=state.view==="day"&&D&&state.sel!=null?D.segs[state.sel]:null;
  if(s)setCaption(s.t==="move"?moveLabel(s,true):s.num+". "+plain(s.name||"[["+s.place+"]]"),s.t==="move"&&dur(s)?mode(s.mode)+" "+hmS(dur(s)):"");
  else if(state.view==="day")setCaption(U("{d}：全天",{d:md(state.date)+" "+(D?plain(D.short||D.title):U("规划中"))}),D&&driveOf(D)?U("开车 {t}",{t:hmS(driveOf(D))}):"");
  else setCaption(U("全程路线"));}
// The caption carries the time on the road after the name, kept whole when a long name is cut short: the map draws
// routes without times (Leaflet draws none; Google's keyless embed only at some zooms), so it's written here.
function setCaption(label,t){var c=$("mapCaption"),old=c.textContent;
  c.innerHTML='<span class="cap-l">'+esc(label)+"</span>"+(t?'<span class="cap-t">'+esc(t)+"</span>":"");
  if(c.textContent!==old)setTimeout(function(){replay(c,"pop");});}
function driveOf(D){return D.segs.reduce(function(a,s){return a+(s.t==="move"&&s.mode==="drive"?dur(s):0);},0);}

// Without a Google Maps JS API key, render the full interactive route map on Leaflet + Google Hybrid Satellite
// using our stored summer OSRM polylines (so winter mountain-pass closures never break Google's iframe directions).
window.gm_authFailure=function(){console.warn("Google Maps rejected googleMapsKey in config.js; using Leaflet satellite map instead.");useLeaflet();};
function useLeaflet(){
  if(lMap||embed)return;map=null;you=null;markers=[];lines=[];
  ensureLeaflet().then(function(L){
    if(lMap||map)return;
    var box=$("map");box.innerHTML="";
    lMap=L.map(box,{center:[62,5],zoom:4,minZoom:2,maxZoom:21,zoomSnap:0,zoomDelta:.75,scrollWheelZoom:false,zoomControl:false,attributionControl:true});
    L.control.zoom({position:"bottomright"}).addTo(lMap);
    L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",{maxNativeZoom:20,maxZoom:21,attribution:"Map data &copy; Google"}).addTo(lMap);
    // Smooth continuous trackpad pinch (ctrlKey) & scroll-wheel zoom anchored at the cursor, like Google Maps
    box.addEventListener("wheel",function(e){
      if(!lMap)return;
      e.preventDefault();e.stopPropagation();
      var dy=e.deltaMode===1?e.deltaY*24:e.deltaY;
      var k=e.ctrlKey?.018:(Math.abs(dy)>=40&&dy%1===0?.004:.0055);
      var dz=Math.max(-.45,Math.min(.45,-dy*k));
      if(!dz)return;
      var z=Math.max(lMap.getMinZoom(),Math.min(lMap.getMaxZoom(),lMap.getZoom()+dz));
      lMap.setZoomAround(lMap.mouseEventToContainerPoint(e),z,{animate:false});
    },{passive:false});
    lLayer=L.layerGroup().addTo(lMap);
    drawnFor=null;redrawMap();
    var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
  }).catch(function(e){console.warn(e);useEmbed();});
}
function useEmbed(){
  if(embed)return;map=null;lMap=null;you=null;markers=[];lines=[];
  var box=$("map");box.innerHTML="";
  embed=document.createElement("iframe");embed.title=U("Google 地图");embed.setAttribute("allowfullscreen","");box.appendChild(embed);
  var at=document.createElement("span");at.className="map-attr";at.textContent="© Google";box.appendChild(at);
  var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
}
// reload=true after a resize: Google's embed doesn't re-centre itself when its frame changes size
var reloadEmbed=false;
function embedTo(src){if(embed&&(reloadEmbed||embed.getAttribute("src")!==src))embed.setAttribute("src",src);reloadEmbed=false;}
function ll2(p){return p[0]+","+p[1];}
// t=k is satellite; the embed's own route framing ignores the frame's shape, so routes get an explicit ll/z
function embedTail(){return "&t=k&hl="+(NM==="zh"?"zh-CN":"en")+"&output=embed";}
function embedPlace(ll,z){embedTo("https://maps.google.com/maps?q="+ll2(ll)+"&z="+z+embedTail());}
function embedRoute(stops,walk){embedTo("https://maps.google.com/maps?saddr="+ll2(stops[0])+"&daddr="+stops.slice(1).map(ll2).join("+to:")+(walk?"&dirflg=w":"")+embedFit(stops)+embedTail());}
function embedArea(q,z){embedTo("https://maps.google.com/maps?q="+encodeURIComponent(q)+"&z="+z+embedTail());}
// Center and zoom that fit every stop in the frame, leaving room for the directions card (top) and caption (bottom).
function embedFit(pts){var box=$("map"),w=box.clientWidth||400,h=box.clientHeight||500,T0=Math.min(120,h*.3),B0=Math.min(50,h*.12),S=Math.min(40,w*.08),
    my=function(la){return Math.log(Math.tan(Math.PI/4+la*Math.PI/360));},
    la=pts.map(function(p){return p[0];}),lo=pts.map(function(p){return p[1];}),
    y1=my(Math.min.apply(0,la)),y2=my(Math.max.apply(0,la)),x1=Math.min.apply(0,lo),x2=Math.max.apply(0,lo),
    fx=(w-2*S)/(256*Math.max((x2-x1)/360,1e-6)),fy=(h-T0-B0)/(256*Math.max((y2-y1)/(2*Math.PI),1e-6)),
    z=Math.max(3,Math.min(15,Math.floor(Math.log(Math.min(fx,fy))/Math.LN2))),
    yc=(y1+y2)/2+(T0-B0)/2*2*Math.PI/(256*Math.pow(2,z));
  return "&ll="+(Math.atan(Math.sinh(yc))*180/Math.PI).toFixed(4)+","+((x1+x2)/2).toFixed(4)+"&z="+z;}

function loadMap(){
  caption();
  if(!CFG.googleMapsKey){useLeaflet();return;}
  var params={v:"weekly",key:CFG.googleMapsKey,language:"zh-CN"};
  // Google's dynamic library loader (inline bootstrap from the Maps JS docs).
  (function(g){var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b[c].maps||(b[c].maps={}),r=new Set,e=new URLSearchParams,u=function(){return h||(h=new Promise(function(f,n){a=m.createElement("script");e.set("libraries",Array.from(r)+"");for(k in g)e.set(k.replace(/[A-Z]/g,function(t){return "_"+t[0].toLowerCase();}),g[k]);e.set("callback",c+".maps."+q);a.src="https://maps."+c+"apis.com/maps/api/js?"+e;d[q]=f;a.onerror=function(){h=n(Error(p+" could not load."));};m.head.append(a);}));};d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=function(f){var rest=Array.from(arguments).slice(1);return r.add(f)&&u().then(function(){return d[l].apply(d,[f].concat(rest));});};})(params);
  Promise.all([google.maps.importLibrary("maps"),google.maps.importLibrary("marker"),google.maps.importLibrary("core")]).then(function(libs){
    if(embed||lMap)return;
    G=google.maps;Marker=libs[1].AdvancedMarkerElement;
    map=new libs[0].Map($("map"),{
      center:{lat:62,lng:5},zoom:4,mapId:CFG.googleMapId||"DEMO_MAP_ID",mapTypeId:"hybrid",
      disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:G.ControlPosition.RIGHT_BOTTOM},
      clickableIcons:false,gestureHandling:wide.matches?"greedy":"cooperative",
      colorScheme:G.ColorScheme?G.ColorScheme.FOLLOW_SYSTEM:undefined
    });
    redrawMap();
    var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();
  }).catch(function(e){console.warn(e);useLeaflet();});
}

function bounds(pts){var b=new G.LatLngBounds();pts.forEach(function(p){b.extend({lat:p[0],lng:p[1]});});return b;}
function fitPts(pts,maxZoom){
  if(lMap){if(!pts.length)return;lMap.invalidateSize();
    if(pts.length===1){lMap.setView(pts[0],maxZoom||13);return;}
    lMap.fitBounds(pts,{paddingTopLeft:[30,60],paddingBottomRight:[30,50],maxZoom:maxZoom||16});return;}
  if(!map||!pts.length)return;
  if(pts.length===1){map.panTo({lat:pts[0][0],lng:pts[0][1]});map.setZoom(maxZoom||13);return;}
  map.fitBounds(bounds(pts),{top:60,right:30,bottom:50,left:30});
  if(maxZoom)G.event.addListenerOnce(map,"idle",function(){if(map.getZoom()>maxZoom)map.setZoom(maxZoom);});}
function dayPts(D){var a=[];D.segs.forEach(function(s){if(s.t==="move"&&s.mode==="flight")return;if(s.pts)a=a.concat(s.pts);else if(s.place)a.push(LL(s.place));});return a;}
function allPts(){var a=[];T.days.forEach(function(D){a=a.concat(dayPts(D));});T.legs.forEach(function(l){if(l.wx&&N[l.wx])a.push(N[l.wx]);});return a;}
// Stops of a day in order, for the keyless embed and the directions link. Google can't route across
// a flight, ferry or train, so the day splits there and the part with the most stops is used.
var ROADS={drive:1,walk:1,bike:1};
function embedDayRoute(D){if(D.route)return D.route.map(LL);var groups=[[]],vias={};
  D.segs.forEach(function(s){var g=groups[groups.length-1];
    if(s.t==="move"&&!ROADS[s.mode]){groups.push([]);g=groups[groups.length-1];add(g,s.path[s.path.length-1]);return;}
    // a drive's named waypoints (e.g. which F-road to take) go in too, so Google takes the same road
    if(s.t==="move"){add(g,s.path[0]);if(s.mode==="drive")s.path.slice(1,-1).forEach(function(x){add(g,x,1);});add(g,s.path[s.path.length-1]);}else add(g,s.place);});
  function add(g,x,via){if(typeof x==="string"&&g[g.length-1]!==x){g.push(x);if(via)vias[x]=1;}}
  var best=groups.reduce(function(a,g){return g.length>a.length?g:a;},[]);
  // Google takes ten points at most: drop waypoints before stops, and always keep start + end
  for(var j=best.length-2;best.length>10&&j>0;j--)if(vias[best[j]])best.splice(j,1);
  if(best.length>10){var keep=[best[0]],n=best.length-1;for(var k=1;k<9;k++)keep.push(best[Math.round(k*n/9)]);keep.push(best[n]);best=keep;}
  return best.map(LL);}
function fitView(){
  hideHikeMap();caption();redrawMap();var D=day();
  if(embed){
    if(state.view!=="day"){var l=legOf(state.date)||T.legs[0],c=T.countries[l.c]||{};embedArea(c.en||"Iceland",c.zoom||5);return;}
    if(!D){var lw=wxPlace(state.date);if(lw)embedPlace(N[lw],7);else{var cc=T.countries[cOf(state.date)]||{};embedArea(cc.en||"Iceland",cc.zoom||5);}return;}
    var r=embedDayRoute(D);if(r.length>1)embedRoute(r);else embedPlace(LL(D.stay||D.wx||(D.segs[0]||{}).place),10);return;}
  if(state.view!=="day"){fitPts(allPts());return;}
  if(!D){var p=wxPlace(state.date);fitPts(p?[N[p]]:allPts(),7);return;}
  fitPts(dayPts(D),13);}
// A stop shows where it sits in the day's driving. With the map key: the whole day's route, centred on the stop
// (its marker is highlighted). On the keyless embed the red pin can only go at a route's end, so the route runs
// from the day's start to this stop, and Google's card gives the distance and time to get there. A move shows itself.
function around(pts,c){return pts.concat(pts.map(function(p){return [2*c[0]-p[0],2*c[1]-p[1]];}));}
function stopOnRoute(s){var D=day();if(!D||s.t!=="stop"||!s.place)return null;
  var r=embedDayRoute(D),at=LL(s.place),i=-1;r.forEach(function(p,k){if(i<0&&p[0]===at[0]&&p[1]===at[1])i=k;});
  return r.length>1&&i>=0?{route:r,i:i,at:at}:null;}
// An optional extra shows where it sits in the day the way a stop does: the day's route up to the stop it
// follows, then on to it, so the red pin (and Google's time to get there) is the optional. One reached on foot
// shows the walk from that stop; one reached by train or ferry, which Google can't route, just its place.
function optRoute(o){var D=day(),m=(o["in"]||{}).mode||"drive",at=o.after&&N[o.after];
  if(!D||!o.place||!N[o.place]||!ROADS[m]||!at)return null;
  var r=m==="walk"?[]:embedDayRoute(D),i=-1;r.forEach(function(p,k){if(i<0&&p[0]===at[0]&&p[1]===at[1])i=k;});
  var pts=(i>=0?r.slice(0,i+1):[at]).concat([N[o.place]]);
  return {pts:pts.slice(-10),walk:m==="walk"};}
function putOptMark(o){
  if(!o||!o.place||!N[o.place])return;
  var el=document.createElement("div");el.className="mk sel";el.style.setProperty("--k",KCOL[o.kind]||"#C9711C");
  var b=document.createElement("span");b.className="mk-badge";b.textContent="+";var nm=document.createElement("span");nm.className="mk-name";nm.textContent=plain(o.name||"[["+o.place+"]]");
  el.append(b,nm);
  if(lMap&&window.L){var w=document.createElement("div");w.appendChild(el);
    optMark=window.L.marker(N[o.place],{icon:window.L.divIcon({className:"l-mk",html:w,iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:1000,interactive:false}).addTo(lMap);}
  else if(map&&Marker){optMark=new Marker({map:map,position:{lat:N[o.place][0],lng:N[o.place][1]},content:el,zIndex:1000});}}
function frameOpt(o){var r=optRoute(o);if(!r){frameGroup([o.place]);}
  else{hideHikeMap();if(embed)embedRoute(r.pts,r.walk);else if(map||lMap)fitPts(r.pts,14);}
  putOptMark(o);
  var m=o["in"]||{};setCaption(U("可选")+" · "+plain(o.name||"[["+o.place+"]]"),m.mins&&m.mode?mode(m.mode)+" "+hmS(m.mins):"");}
function frameOptHike(o){
  showHikeMap(o.pts,o.place&&N[o.place],16);
  putOptMark(o);
  var m=o["in"]||{};setCaption(U("可选")+" · "+plain(o.name||"[["+o.place+"]]"),m.mins&&m.mode?mode(m.mode)+" "+hmS(m.mins):"");}
function frame(s){
  if(s&&s.t==="stop"&&(s.kind==="hike"||(s.pts&&s.pts.length>1))){
    caption();showHikeMap(s.pts,LL(s.place),s.zoom||16);return;}
  hideHikeMap();
  var on=stopOnRoute(s);caption();
  if(embed){
    if(on&&on.i>0){var r=on.route.slice(0,on.i+1);
      embedTo("https://maps.google.com/maps?saddr="+ll2(r[0])+"&daddr="+r.slice(1).map(ll2).join("+to:")+embedFit(r)+embedTail());return;}
    if(s.t==="move"){var ids=s.path.filter(function(x){return typeof x==="string";});
      if(s.mode==="drive"&&ids.length>1)embedRoute(ids.map(LL));else embedPlace(LL(ids[ids.length-1]),s.mode==="flight"?6:9);}
    else embedPlace(LL(s.place),s.zoom||14);return;}
  if(!map&&!lMap)return;
  if(on){fitPts(around(dayPts(day()),on.at),14);return;}
  if(s.pts&&s.pts.length>1)fitPts(s.pts,s.t==="move"?13:15);else fitPts([LL(s.place)],s.zoom||14);}
/* ---------- hike trail highlight on main Google satellite map ---------- */
var tLoadP=null,gHikeLines=[],lHikeLines=[],optMark=null;
function hideHikeMap(){
  gHikeLines.forEach(function(l){l.setMap(null);});gHikeLines=[];
  lHikeLines.forEach(function(l){l.remove();});lHikeLines=[];
  if(optMark){if(optMark.remove)optMark.remove();else optMark.map=null;optMark=null;}}
function ensureLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(tLoadP)return tLoadP;
  tLoadP=new Promise(function(ok,err){
    var css=document.createElement("link");css.rel="stylesheet";css.href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css";document.head.appendChild(css);
    var js=document.createElement("script");js.src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js";
    js.onload=function(){ok(window.L);};
    js.onerror=function(){
      var js2=document.createElement("script");js2.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      js2.onload=function(){ok(window.L);};js2.onerror=err;document.head.appendChild(js2);};
    document.head.appendChild(js);});
  return tLoadP;}
function showHikeMap(pts,center,zoom){
  hideHikeMap();
  if(embed){embedPlace(center||(pts&&pts[0]),zoom||14);return;}
  if(pts&&pts.length>1){
    if(lMap&&window.L){
      lHikeLines.push(window.L.polyline(pts,{color:"#ffffff",weight:8,opacity:.92,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lMap));
      lHikeLines.push(window.L.polyline(pts,{color:"#16a34a",weight:4.2,opacity:1,dashArray:"2,8",interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lMap));
    }else if(map){
      gHikeLines.push(new G.Polyline({map:map,path:pts.map(function(p){return {lat:p[0],lng:p[1]};}),strokeColor:"#ffffff",strokeOpacity:.9,strokeWeight:8,clickable:false,zIndex:900}));
      gHikeLines.push(new G.Polyline({map:map,path:pts.map(function(p){return {lat:p[0],lng:p[1]};}),strokeOpacity:0,icons:[{icon:{path:G.SymbolPath.CIRCLE,scale:3,fillColor:"#16a34a",fillOpacity:1,strokeColor:"#fff",strokeWeight:1.2},offset:"0",repeat:"10px"}],clickable:false,zIndex:901}));
    }
    fitPts(pts,zoom||16);
  }else if(center){
    fitPts([center],zoom||15);
  }}
// The map box follows the window (and moves into an open stop on phones). Once a resize settles, frame the same
// view again for the new size: the embed was centred and zoomed for the old one.
function refit(){reloadEmbed=true;var D=day();if(state.view==="day"&&D&&state.sel!=null)frame(D.segs[state.sel]);else fitView();}
(function(){var box=$("map"),last=null,t=null;if(!window.ResizeObserver)return;
  new ResizeObserver(function(){var w=box.clientWidth,h=box.clientHeight;
    if(!last||!w||!h){last=[w,h];return;}
    if(Math.abs(w-last[0])<40&&Math.abs(h-last[1])<40)return;
    clearTimeout(t);t=setTimeout(function(){last=[box.clientWidth,box.clientHeight];if(T)refit();},350);}).observe(box);})();
$("fitBtn").addEventListener("click",function(){if(state.view==="day"&&state.sel!=null){state.sel=null;paintOpen();markSel();}fitView();});

var drawnFor=null;
// flights are drawn as great circles between their two airports
function gc(a,b,n){var r=Math.PI/180,la1=a[0]*r,lo1=a[1]*r,la2=b[0]*r,lo2=b[1]*r,out=[];
  var d=2*Math.asin(Math.sqrt(Math.pow(Math.sin((la2-la1)/2),2)+Math.cos(la1)*Math.cos(la2)*Math.pow(Math.sin((lo2-lo1)/2),2)));if(!d)return [a,b];
  for(var i=0;i<=n;i++){var f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
    var x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2),y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2),z=A*Math.sin(la1)+B*Math.sin(la2);
    out.push([Math.atan2(z,Math.sqrt(x*x+y*y))/r,Math.atan2(y,x)/r]);}return out;}
function line(pts,opts){var l=new G.Polyline(Object.assign({map:map,path:pts.map(function(p){return {lat:p[0],lng:p[1]};})},opts));lines.push(l);return l;}
function bindTip(pl,tip){if(tip&&pl&&pl.bindTooltip)pl.bindTooltip(tip,{sticky:true,className:"rt-tip",direction:"top",offset:[0,-8]});return pl;}
function moveLine(s,col,strong,pick,tip){
  var pts=s.mode==="flight"?gc(s.pts[0],s.pts[s.pts.length-1],48):s.pts;
  var walk=s.mode==="walk"||s.mode==="bike";
  if(lMap){var L=window.L;
    if(walk){
      L.polyline(pts,{color:"#ffffff",weight:5.5,opacity:.75,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lLayer);
      var lw=L.polyline(pts,{color:"#2E7D47",weight:3.5,opacity:1,dashArray:"2,7",lineCap:"round",lineJoin:"round"}).addTo(lLayer);
      if(pick)lw.on("click",pick);return;}
    if(s.mode==="flight"||s.mode==="ferry"){var lf=bindTip(L.polyline(pts,{color:col,weight:strong?3:2,opacity:strong?.95:.5,dashArray:s.mode==="flight"?"6,8":"4,7",lineCap:"round"}).addTo(lLayer),tip);if(pick)lf.on("click",pick);return;}
    if(strong)L.polyline(pts,{color:"#ffffff",weight:7.5,opacity:.9,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lLayer);
    var lr=bindTip(L.polyline(pts,{color:col,weight:strong?4.2:2.5,opacity:strong?1:.5,interactive:!!pick,lineCap:"round",lineJoin:"round"}).addTo(lLayer),tip);if(pick)lr.on("click",pick);return;}
  if(walk){
    var gw=line(pts,{strokeOpacity:0,icons:[{icon:{path:G.SymbolPath.CIRCLE,scale:2.6,fillColor:"#2E7D47",fillOpacity:1,strokeColor:"#fff",strokeWeight:1},offset:"0",repeat:"10px"}],clickable:!!pick});
    if(pick)gw.addListener("click",pick);return;}
  if(s.mode==="flight"||s.mode==="ferry"){var l=line(pts,{strokeOpacity:0,icons:[{icon:{path:"M 0,-1 0,1",strokeOpacity:strong?1:.45,strokeColor:col,strokeWeight:strong?3:2,scale:3},offset:"0",repeat:s.mode==="flight"?"12px":"9px"}]});if(pick)l.addListener("click",pick);return;}
  if(strong)line(pts,{strokeColor:"#ffffff",strokeOpacity:.9,strokeWeight:8,clickable:false});
  var l2=line(pts,{strokeColor:col,strokeOpacity:strong?1:.45,strokeWeight:strong?4.5:2.5,clickable:!!pick});if(pick)l2.addListener("click",pick);}
function redrawMap(){
  if(!map&&!lMap)return;var key=state.view==="day"?state.date+NM:"all"+NM;if(drawnFor===key)return;drawnFor=key;
  if(lMap){lLayer.clearLayers();markers=[];you=null;}
  else{lines.forEach(function(l){l.setMap(null);});lines=[];markers.forEach(function(m){m.map=null;});markers=[];}
  var D=state.view==="day"?day():null;
  T.days.forEach(function(X){var col=(T.countries[X.c]||{}).color||"#5D6B73",mine=D===X;
    var tip=!D?md(X.date)+" · "+plain(X.short||X.title):"";
    X.segs.forEach(function(s,si){if(s.t!=="move"||!s.pts||s.pts.length<2)return;
      if(s.mode==="walk"||s.mode==="bike"){
        if(!mine)return; // keep whole-trip overview clean of tiny local walks
        if(s.mode==="walk"){
          var pv=X.segs[si-1],nx=X.segs[si+1];
          if((pv&&pv.t==="stop"&&pv.pts&&pv.pts.length>1)||(nx&&nx.t==="stop"&&nx.pts&&nx.pts.length>1))return;
        }
      }
      moveLine(s,mine?"#C9711C":col,mine||!D,mine?function(){select(s.i);}:function(){setView("day",X.date);},tip);});
    if(mine)X.segs.forEach(function(s){if(s.t==="stop"&&s.pts&&s.pts.length>1){
      if(lMap){
        window.L.polyline(s.pts,{color:"#ffffff",weight:5.8,opacity:.8,interactive:false,lineCap:"round",lineJoin:"round"}).addTo(lLayer);
        window.L.polyline(s.pts,{color:"#2E7D47",weight:3.6,opacity:1,dashArray:"2,7",lineCap:"round",lineJoin:"round"}).addTo(lLayer).on("click",function(){select(s.i);});
      }else line(s.pts,{strokeOpacity:0,icons:[{icon:{path:G.SymbolPath.CIRCLE,scale:2.6,fillColor:"#2E7D47",fillOpacity:1,strokeColor:"#fff",strokeWeight:1},offset:"0",repeat:"10px"}]}).addListener("click",function(){select(s.i);});}});});
  if(D){ // one marker per place; several stops at the same place share it ("3·9"); overview shows the route only
    var groups={};D.segs.forEach(function(s){if(s.t!=="stop")return;(groups[s.place]=groups[s.place]||[]).push(s);});
    Object.keys(groups).forEach(function(pl){var stops=groups[pl];
      addMarker(N[pl],stops.map(function(s){return s.num;}).join("·"),KCOL[stops[0].kind]||KCOL.visit,plain(stops[0].name||"[["+pl+"]]"),function(m){
        var cur=state.sel!=null?D.segs[state.sel]:null,idx=stops.indexOf(cur),next=stops[(idx+1)%stops.length];
        select(next.i);var li=document.querySelector('#rows li[data-i="'+next.i+'"]');if(li)li.scrollIntoView({block:"nearest",behavior:"smooth"});}).stops=stops;});
  }
  if(you&&!lMap){you.map=null;you=null;}
  if(D&&liveDate()===state.date){var cur=nowSeg();if(cur){var t=nowIn(tzOf(state.date)).mins,a=mins(cur.start),b=mins(cur.end||cur.start);
    var pos=cur.pts&&cur.pts.length>1?along(cur.pts,b>a?(t-a)/(b-a):1):LL(cur.place);
    var yd=document.createElement("div");yd.className="you";var tag=document.createElement("span");tag.className="you-tag";tag.textContent=U("按计划现在在这");yd.appendChild(tag);
    if(lMap){var yw=document.createElement("div");yw.appendChild(yd);you=window.L.marker(pos,{icon:window.L.divIcon({className:"l-mk",html:yw,iconSize:[0,0],iconAnchor:[0,0]}),zIndexOffset:1000}).addTo(lLayer);}
    else you=new Marker({map:map,position:{lat:pos[0],lng:pos[1]},content:yd,zIndex:1000});}}
  markSel();
}
function addMarker(ll,badgeTxt,col,nameTxt,onClick){
  var el=document.createElement("div");el.className="mk";el.style.setProperty("--k",col||"#1F4E6B");
  var badge=document.createElement("span");badge.className="mk-badge";badge.textContent=badgeTxt;
  var name=document.createElement("span");name.className="mk-name";name.textContent=nameTxt;el.append(badge,name);
  if(lMap){var w=document.createElement("div");w.appendChild(el);
    var lm=window.L.marker(ll,{icon:window.L.divIcon({className:"l-mk",html:w,iconSize:[0,0],iconAnchor:[0,0]}),title:nameTxt}).addTo(lLayer);
    lm.el=el;lm.nameEl=name;el.addEventListener("click",function(e){e.stopPropagation();onClick(lm);});markers.push(lm);return lm;}
  var m=new Marker({map:map,position:{lat:ll[0],lng:ll[1]},content:el,title:nameTxt,gmpClickable:true});
  m.el=el;m.nameEl=name;m.addEventListener("gmp-click",function(){onClick(m);});markers.push(m);return m;}
function markSel(){var D=day(),sel=state.view==="day"&&D&&state.sel!=null&&D.segs[state.sel];
  markers.forEach(function(m){var on=!!(sel&&m.stops&&m.stops.indexOf(sel)>=0);m.el.classList.toggle("sel",on);if(on)m.nameEl.textContent=plain(sel.name||"[["+sel.place+"]]");
    if(m.setZIndexOffset)m.setZIndexOffset(on?999:0);else m.zIndex=on?999:null;});}

/* ---------- shared expense log ---------- */
// Everyone's expenses live on the trip server (backend/expenses.json), behind the chat's access code.
// This device keeps the last copy it saw, so the log still reads offline (the highlands have no signal),
// and anything added or deleted offline waits in an outbox until the server answers again. Totals are
// settled in the currency picked in the top bar (CAD when that's "local"), at the page's exchange rates.
var MCAT=[["food","吃饭","Eating out","#C9711C"],["groceries","超市","Groceries","#3D7A4F"],["fuel","油费","Fuel","#5D6B73"],["transport","交通","Transport","#3F8FB5"],
  ["stay","住宿","Lodging","#7A5C9E"],["tickets","门票活动","Tickets","#2B7A8C"],["other","其他","Other","#8A99A3"]];
var MCUR=["ISK","NOK","SEK","DKK","EUR","CAD","USD","CNY"],CCUR={is:"ISK",fo:"DKK",no:"NOK",se:"SEK",ee:"EUR",dk:"DKK"},MSYM={CAD:"C$",USD:"US$",CNY:"¥",EUR:"€"};
var MNY=store("nt-money")||{people:[],items:[]},OUT=store("nt-money-out")||[],mState={status:"",err:""},mTimer=null,flushing=null,formKey=null;
function auth(){return window.tripAuth||{api:"",code:function(){return "";},setCode:function(){}};}
function settleCur(){return CUR==="local"?"CAD":CUR;}
function fxTo(v,from,to){return FX&&FX[from]&&FX[to]?v/FX[from]*FX[to]:null;}
// typed amounts show as entered (450 NOK, 39.90 SEK); totals and shares get cents below 1,000 so columns line up
function fmtC(v,code,typed){var dec=code==="ISK"?0:typed?(Math.round(v*100)%100?2:0):Math.abs(v)<1000?2:0;
  var t=(Math.round(v*Math.pow(10,dec))/Math.pow(10,dec)).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return MSYM[code]?MSYM[code]+t:t+" "+code;}
function mcat(k){return MCAT.filter(function(c){return c[0]===k;})[0]||MCAT[MCAT.length-1];}
function mDay(){return liveDate()||homeToday();}
// the server's list, plus what's waiting in the outbox
function mItems(){var del={},have={};OUT.forEach(function(o){if(o.op==="del")del[o.id]=1;});
  var list=MNY.items.filter(function(x){have[x.id]=1;return !del[x.id];});
  OUT.forEach(function(o){if(o.op==="add"&&!have[o.item.id])list.push(Object.assign({pending:true},o.item));});
  return list;}
function balances(items){var sc=settleCur(),ppl={},total=0,byCat={};
  MNY.people.forEach(function(p){ppl[p]={paid:0,share:0};});
  items.forEach(function(x){var v=fxTo(x.amount,x.currency,sc);if(v==null)return;total+=v;byCat[x.cat]=(byCat[x.cat]||0)+v;
    (ppl[x.paidBy]=ppl[x.paidBy]||{paid:0,share:0}).paid+=v;
    x.split.forEach(function(p){(ppl[p]=ppl[p]||{paid:0,share:0}).share+=v/x.split.length;});});
  return {total:total,byCat:byCat,people:ppl};}
// fewest transfers that square everyone up: the biggest debtor pays the biggest creditor, repeat
function settleUp(ppl){var cr=[],dr=[],out=[],i=0,j=0;
  Object.keys(ppl).forEach(function(p){var n=ppl[p].paid-ppl[p].share;if(n>.01)cr.push([p,n]);else if(n<-.01)dr.push([p,-n]);});
  cr.sort(function(a,b){return b[1]-a[1];});dr.sort(function(a,b){return b[1]-a[1];});
  while(i<dr.length&&j<cr.length){var v=Math.min(dr[i][1],cr[j][1]);if(v>=.5)out.push([dr[i][0],cr[j][0],v]);dr[i][1]-=v;cr[j][1]-=v;if(dr[i][1]<.01)i++;if(cr[j][1]<.01)j++;}
  return out;}

function mApi(path,opts){var A=auth();opts=opts||{};var h={"X-Access-Code":A.code()};if(opts.body)h["Content-Type"]="application/json";
  return fetch(A.api+path,{method:opts.body||opts.post?"POST":"GET",headers:h,body:opts.body?JSON.stringify(opts.body):undefined}).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){if(r.ok)return j;
      if(r.status===401)A.setCode(null);var e=new Error(j.detail||String(r.status));e.code=r.status;throw e;});});}
function gotLedger(j){MNY={people:j.people||[],items:j.items||[]};store("nt-money",MNY);}
function offline(e){mState.status=e&&e.code===401?"code":"off";}
function loadMoney(){
  clearInterval(mTimer);mTimer=setInterval(function(){if(state.view==="money"&&document.visibilityState==="visible")loadMoney();},60000);
  if(!auth().code()){mState.status="code";renderMoney();return;}
  if(mState.status!=="ok")mState.status="loading";renderMoney();
  mApi("/api/expenses").then(function(j){gotLedger(j);mState.status="ok";return flush();}).catch(offline).then(renderMoney);}
// sends the outbox in order; stops at the first network failure and tries again later
function flush(){if(flushing)return flushing;
  flushing=(function step(){if(!OUT.length)return Promise.resolve();var o=OUT[0];
    var p=o.op==="add"?mApi("/api/expenses",{body:o.item}):mApi("/api/expenses/"+encodeURIComponent(o.id)+"/delete",{post:true});
    return p.then(function(j){gotLedger(j);OUT.shift();store("nt-money-out",OUT);return step();},function(e){
      // the server said no (not a dropped connection): drop it and say why, or it would block everything behind it
      if(e.code&&e.code!==401&&e.code!==429&&e.code<500){OUT.shift();store("nt-money-out",OUT);mState.err=e.message;return step();}throw e;});})()
    .then(function(){mState.status="ok";},offline).then(function(){flushing=null;renderMoney();});
  return flushing;}
window.addEventListener("online",function(){if(OUT.length||state.view==="money")loadMoney();});
// the assistant added an expense (someone approved its card): show it
document.addEventListener("trip:money",function(){if(auth().code())loadMoney();});
function addExpense(item){mState.err="";OUT.push({op:"add",item:item});store("nt-money-out",OUT);renderMoney();if(auth().code())flush();}
function delExpense(id){mState.err="";var i=-1;OUT.forEach(function(o,k){if(o.op==="add"&&o.item.id===id)i=k;});
  if(i>=0)OUT.splice(i,1);else OUT.push({op:"del",id:id});store("nt-money-out",OUT);renderMoney();if(auth().code())flush();}
function personOp(path,name){mState.err="";var typing=document.activeElement&&document.activeElement.id==="mnyPersonIn";
  mApi(path,{body:{name:name}}).then(function(j){gotLedger(j);mState.status="ok";},function(e){
    mState.err=e.code===409?U("{p} 还有账目，先删掉相关的几笔再移除。",{p:name}):e.code?e.message:U("连不上行程服务器，联网后才能改成员。");})
    .then(function(){renderMoney();if(typing&&$("mnyPersonIn"))$("mnyPersonIn").focus();});} // keep typing the next name

function renderMoney(){
  if(!T)return;
  var items=mItems(),sc=settleCur(),B=balances(items),st=mState.status,P=MNY.people,pend=OUT.length;
  $("moneySub").textContent=items.length?items.length:"";
  renderBudget();
  $("moneyHint").textContent=U("大家共用一本账 · 按 {c} 结算，汇率为约数",{c:sc});
  var g="";
  if(st==="code")g='<form class="mny-gate" id="mnyCode"><p>'+U("账本存在行程服务器上，跟行程助手用同一个访问码。")+'</p><div class="mny-row"><input type="password" id="mnyCodeIn" autocomplete="off" placeholder="'+esc(U("访问码"))+'" aria-label="'+esc(U("访问码"))+'"><button class="pill primary" type="submit">'+U("确定")+'</button></div><span class="mny-err" id="mnyCodeErr" role="alert"></span></form>';
  else if(st==="off")g='<p class="mny-note warn">'+U("连不上行程服务器。下面是这台设备上次同步的账；新记的会先存在这里，连上后自动同步。")+"</p>";
  else if(st==="loading"&&!P.length)g='<p class="mny-note">'+U("正在载入账本…")+"</p>";
  if(pend&&st!=="code")g+='<p class="mny-note">'+U(pend===1?"1 笔改动等待同步":"{n} 笔改动等待同步",{n:pend})+"</p>";
  if(mState.err)g+='<p class="mny-note warn">'+esc(mState.err)+"</p>";
  $("moneyGate").innerHTML=g;
  var locked=st==="code"&&!P.length;
  $("moneySum").hidden=locked;$("moneyAdd").hidden=locked||!P.length;$("moneyList").hidden=locked;
  if(locked)return;

  // members, totals, who owes whom
  var h='<div class="mny-card"><div class="mny-people"><b>'+U("成员")+"</b>"+P.map(function(p){
    return '<span class="mny-chip">'+esc(p)+'<button type="button" data-unperson="'+esc(p)+'" aria-label="'+esc(U("移除 {p}",{p:p}))+'">×</button></span>';}).join("")+
    '<form class="mny-addp" id="mnyPerson"><input id="mnyPersonIn" maxlength="24" placeholder="'+esc(U("+ 加人"))+'" aria-label="'+esc(U("加一个人"))+'"></form></div>';
  if(!P.length)h+='<p class="mny-empty">'+U("先把一起旅行的人加进来，然后每花一笔钱就记一笔：谁付的、谁平摊。")+"</p>";
  if(items.length){
    h+='<div class="mny-total"><small>'+U("一共花了")+'</small><b>'+esc(fmtC(B.total,sc))+'</b><small>'+U("{n} 笔",{n:items.length})+"</small></div>";
    h+='<div class="mny-bar">'+MCAT.filter(function(c){return B.byCat[c[0]];}).map(function(c){
      return '<span style="flex:'+B.byCat[c[0]]+';--k:'+c[3]+'" title="'+esc((en()?c[2]:c[1])+" "+fmtC(B.byCat[c[0]],sc))+'"></span>';}).join("")+"</div>";
    h+='<ul class="mny-legend">'+MCAT.filter(function(c){return B.byCat[c[0]];}).map(function(c){
      return '<li style="--k:'+c[3]+'">'+esc(en()?c[2]:c[1])+" <b>"+esc(fmtC(B.byCat[c[0]],sc))+"</b></li>";}).join("")+"</ul>";
    h+='<table class="mny-tbl"><thead><tr><th>'+U("人")+"</th><th>"+U("付了")+"</th><th>"+U("该摊")+"</th><th>"+U("差额")+"</th></tr></thead><tbody>"+Object.keys(B.people).map(function(p){
      var x=B.people[p],n=x.paid-x.share;return "<tr><td>"+esc(p)+"</td><td>"+esc(fmtC(x.paid,sc))+"</td><td>"+esc(fmtC(x.share,sc))+'</td><td class="'+(n>.5?"pos":n<-.5?"neg":"")+'">'+(n>.5?"+":n<-.5?"−":"")+esc(fmtC(Math.abs(n),sc))+"</td></tr>";}).join("")+"</tbody></table>";
    var tr=settleUp(B.people);
    h+='<div class="mny-settle"><b>'+U("怎么结清")+"</b>"+(tr.length?"<ul>"+tr.map(function(t){
      return "<li>"+U("{a} 给 {b}",{a:'<span class="who">'+esc(t[0])+"</span>",b:'<span class="who">'+esc(t[1])+"</span>"})+' <b>'+esc(fmtC(t[2],sc))+"</b></li>";}).join("")+"</ul>":"<p>"+U("现在谁也不欠谁。")+"</p>")+"</div>";}
  h+="</div>";
  $("moneySum").innerHTML=h;
  renderMoneyForm();

  // the log, newest day first
  var byDay={};items.forEach(function(x){(byDay[x.date]=byDay[x.date]||[]).push(x);});
  $("moneyList").innerHTML=Object.keys(byDay).sort().reverse().map(function(d){var list=byDay[d].sort(function(a,b){return (b.ts||9e15)-(a.ts||9e15);}),D=BYDATE[d];
    var sum=list.reduce(function(a,x){return a+(fxTo(x.amount,x.currency,sc)||0);},0);
    return '<div class="mny-day"><div class="mny-dh"><b>'+cnDate(d)+" "+wk(d)+"</b>"+(D?"<span>"+esc(plain(D.short||D.title))+"</span>":"")+'<small>'+esc(fmtC(sum,sc))+"</small></div><ul>"+list.map(function(x){
      var c=mcat(x.cat),v=fxTo(x.amount,x.currency,sc),all=x.split.length===P.length&&P.every(function(p){return x.split.indexOf(p)>=0;});
      var who=U("{p} 付",{p:esc(x.paidBy)})+" · "+(all?U("大家平摊"):x.split.length===1&&x.split[0]===x.paidBy?U("自己的"):U("{n} 人平摊：{w}",{n:x.split.length,w:x.split.map(esc).join("、")}));
      return '<li class="mny-it'+(x.pending?" pending":"")+'" style="--k:'+c[3]+'"><span class="mny-dot" title="'+esc(en()?c[2]:c[1])+'"></span><div class="mny-w"><b>'+esc(x.what)+"</b><small>"+who+(x.pending?' · <span class="mny-pend">'+U("等待同步")+"</span>":"")+'</small></div><div class="mny-amt"><b>'+esc(fmtC(x.amount,x.currency,true))+"</b>"+(x.currency!==sc&&v!=null?"<small>≈ "+esc(fmtC(v,sc))+"</small>":"")+
        '</div><button type="button" class="mny-del" data-del="'+esc(x.id)+'" aria-label="'+esc(U("删掉这笔"))+'" title="'+esc(U("删掉这笔"))+'">×</button></li>';}).join("")+"</ul></div>";}).join("")||
    (P.length?'<p class="mny-empty">'+U("还没有账。花了钱就在上面记一笔。")+"</p>":"");
}
// The add form is rebuilt only when the members or the language change, so a refresh never eats what you're typing.
function renderMoneyForm(){
  var P=MNY.people,f=$("moneyAdd"),key=P.join("\u0001")+"|"+NM;if(!P.length||key===formKey)return;formKey=key;
  var old={what:f.what&&f.what.value,amount:f.amount&&f.amount.value,currency:f.currency&&f.currency.dataset.touched?f.currency.value:null,date:f.date&&f.date.value,cat:f.querySelector&&(f.querySelector('[name=cat]:checked')||{}).value};
  var me=store("nt-me"),day0=old.date||mDay(),cur=old.currency||CCUR[cOf(day0)]||"CAD";
  f.innerHTML='<h3>'+U("记一笔")+'</h3>'+
    '<input name="what" required maxlength="80" placeholder="'+esc(U("买了什么？比如：Bónus 超市买菜"))+'" aria-label="'+esc(U("买了什么"))+'">'+
    '<div class="mny-row"><input name="amount" required inputmode="decimal" placeholder="'+esc(U("金额"))+'" aria-label="'+esc(U("金额"))+'">'+
    '<select name="currency" aria-label="'+esc(U("货币"))+'">'+MCUR.map(function(c){return "<option"+(c===cur?" selected":"")+">"+c+"</option>";}).join("")+"</select>"+
    '<input type="date" name="date" value="'+esc(day0)+'" aria-label="'+esc(U("日期"))+'"></div>'+
    '<div class="mny-cats" role="radiogroup" aria-label="'+esc(U("类别"))+'">'+MCAT.map(function(c,i){
      return '<label style="--k:'+c[3]+'"><input type="radio" name="cat" value="'+c[0]+'"'+((old.cat||"food")===c[0]?" checked":"")+"><span>"+esc(en()?c[2]:c[1])+"</span></label>";}).join("")+"</div>"+
    '<div class="mny-row"><label class="mny-lab">'+U("谁付的")+' <select name="paidBy">'+P.map(function(p){return "<option"+(p===me?" selected":"")+">"+esc(p)+"</option>";}).join("")+"</select></label></div>"+
    '<div class="mny-split"><span class="mny-lab">'+U("谁平摊")+'</span>'+P.map(function(p){return '<label><input type="checkbox" name="split" value="'+esc(p)+'" checked><span>'+esc(p)+"</span></label>";}).join("")+"</div>"+
    '<div class="mny-row"><button class="pill primary" type="submit">'+ICON.check+U("记下")+'</button><span class="mny-err" id="mnyAddErr" role="alert"></span></div>';
  if(old.what)f.what.value=old.what;if(old.amount)f.amount.value=old.amount;if(old.currency)f.currency.dataset.touched="1";
}
$("moneyAdd").addEventListener("change",function(e){var f=this;
  if(e.target.name==="currency")e.target.dataset.touched="1";
  if(e.target.name==="date"&&!f.currency.dataset.touched&&e.target.value)f.currency.value=CCUR[cOf(e.target.value)]||"CAD";});
$("moneyAdd").addEventListener("submit",function(e){e.preventDefault();var f=this,err=$("mnyAddErr");
  var amt=+String(f.amount.value).replace(/[,\s]/g,""),split=[].slice.call(f.querySelectorAll("[name=split]:checked")).map(function(x){return x.value;});
  if(!(amt>0)){err.textContent=U("金额要是大于 0 的数字。");f.amount.focus();return;}
  if(!split.length){err.textContent=U("至少选一个人平摊。");return;}
  err.textContent="";store("nt-me",f.paidBy.value);
  addExpense({id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),date:f.date.value||mDay(),what:f.what.value.trim(),amount:amt,currency:f.currency.value,
    cat:(f.querySelector("[name=cat]:checked")||{}).value||"other",paidBy:f.paidBy.value,split:split,ts:Date.now()});
  f.what.value="";f.amount.value="";f.what.focus();});
$("moneyView").addEventListener("submit",function(e){
  if(e.target.id==="mnyPerson"){e.preventDefault();var v=$("mnyPersonIn").value.trim();if(v)personOp("/api/expenses/people",v);}
  else if(e.target.id==="mnyCode"){e.preventDefault();var code=$("mnyCodeIn").value.trim(),er=$("mnyCodeErr"),A=auth();if(!code)return;er.textContent=U("验证中…");
    fetch(A.api+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
      if(r.status===401){er.textContent=U("访问码不对。");return;}if(!r.ok){er.textContent=whyNot(httpErr(r.status));return;}A.setCode(code);loadMoney();},
      function(e){er.textContent=whyNot(e,false);});}});
$("moneyView").addEventListener("click",function(e){
  var d=e.target.closest("[data-del]");if(d){var x=mItems().filter(function(i){return i.id===d.dataset.del;})[0];if(x&&confirm(U("删掉「{w}」这一笔？",{w:x.what})))delExpense(x.id);return;}
  var u=e.target.closest("[data-unperson]");if(u&&confirm(U("把 {p} 移出账本？",{p:u.dataset.unperson})))personOp("/api/expenses/people/delete",u.dataset.unperson);});

/* ---------- offline ---------- */
// sw.js keeps a copy of the page, the plan, the last forecast and rates, and every photo once seen. The prep tab
// can fetch all the photos ahead of time (one 1200px copy each; the worker uses it for any other size offline).
// (smaller copies saved while browsing don't count: offline they'd stand in for the big one, blurry)
var PHOTOC="nt-photos",OFF={busy:false,have:null,done:0,todo:0,fail:0};
function allPhotos(){var seen={},out=[];Object.keys(T.places).forEach(function(k){photosOf(k).forEach(function(ph){var u=new URL(sized(ph.src,1200)).href;
  if(!seen[u]){seen[u]=1;out.push(u);}});});return out;}
function savedUrls(c){return c.keys().then(function(ks){var have={};ks.forEach(function(r){have[r.url]=1;});return have;});}
function countPhotos(){if(!window.caches)return Promise.resolve(null);
  return caches.open(PHOTOC).then(savedUrls).then(function(have){return allPhotos().filter(function(u){return have[u];}).length;}).catch(function(){return null;});}
function getPhotos(){if(OFF.busy)return;OFF.busy=true;OFF.done=OFF.fail=0;renderOffline();
  caches.open(PHOTOC).then(function(c){return savedUrls(c).then(function(have){
    var list=allPhotos().filter(function(u){return !have[u];}),i=0;OFF.todo=list.length;
    function next(){if(i>=list.length)return Promise.resolve();var u=list[i++];
      return fetch(u,{mode:"cors",credentials:"omit"}).then(function(r){if(!r.ok)throw new Error(r.status);return c.put(u,r);})
        .catch(function(){OFF.fail++;}).then(function(){OFF.done++;renderOffline();return next();});}
    return Promise.all([next(),next(),next(),next()]);});})
  .catch(function(){}).then(function(){OFF.busy=false;return countPhotos();}).then(function(n){OFF.have=n;renderOffline();});}
function renderOffline(){var box=$("offline");if(!box||!T)return;
  var h='<div class="tl-head"><h2>'+U("离线使用")+'</h2><span class="hint">'+U("只存在这台设备上")+'</span></div><div class="off-card">';
  if(!("serviceWorker" in navigator)||!window.caches){box.innerHTML=h+"<p>"+U("这个浏览器不能离线保存网页。")+"</p></div>";return;}
  if(OFF.have==null&&!OFF.busy)countPhotos().then(function(n){if(n!=null&&OFF.have!==n){OFF.have=n;renderOffline();}});
  var n=allPhotos().length,all=OFF.have===n;
  h+='<ul class="off-list"><li class="ok">'+ICON.check+"<span>"+U("行程、上次看过的天气和汇率：打开过一次就存好了，没信号也能看")+"</span></li>";
  h+='<li class="'+(all?"ok":"")+'">'+(all?ICON.check:ICON.down)+"<span>"+U("照片：已存 {a} / {b} 张",{a:OFF.have==null?"…":OFF.have,b:n})+
    (OFF.fail&&!OFF.busy?'<small class="off-err">'+U("{n} 张没下载成功，有信号时再点一次",{n:OFF.fail})+"</small>":"")+"</span>"+
    (all?"":'<button type="button" class="pill primary" id="offGet"'+(OFF.busy?" disabled":"")+">"+(OFF.busy?U("正在下载 {a} / {b}…",{a:OFF.done,b:OFF.todo}):U("下载全部照片（约 {m} MB）",{m:Math.max(1,Math.round((n-(OFF.have||0))*0.27))}))+"</button>")+"</li>";
  h+='<li class="warn">'+ICON.visa+"<span>"+U("地图和行程助手要联网。出发前在 Google 地图 app 里下载冰岛、挪威、瑞典、丹麦的离线地图。")+"</span></li></ul></div>";
  box.innerHTML=h;}
$("offline").addEventListener("click",function(e){if(e.target.closest("#offGet"))getPhotos();});
function paintOnline(){$("offlineBar").hidden=navigator.onLine!==false;}
addEventListener("offline",paintOnline);
addEventListener("online",paintOnline);
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register("sw.js").catch(function(e){console.warn("offline copy unavailable:",e);});

/* ---------- the live plan ---------- */
// The plan lives only on the trip server (not in the public repo), behind the access code. The page starts from
// this device's last copy, or from the server, and asks for the code once per device when it has neither; then it
// checks for a newer version every minute, when the page comes back into view, and right after the assistant changes it.
var PLAN={rev:null,last:null},planTimer=null;
// the code is kept with the chat (nt-chat-v1), so typing it once unlocks the page, the chat and the log
function accessCode(){try{return (JSON.parse(localStorage.getItem("nt-chat-v1"))||{}).code||"";}catch(e){return "";}}
function setAccessCode(c){if(window.tripAuth){window.tripAuth.setCode(c);return;}
  try{var s=JSON.parse(localStorage.getItem("nt-chat-v1"))||{};s.code=c;localStorage.setItem("nt-chat-v1",JSON.stringify(s));}catch(e){}}
var LOCALDEV=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
function planApi(){var a=((window.TRIP_CONFIG||{}).apiBase||"").replace(/\/$/,""),o=new URLSearchParams(location.search).get("api");
  return o&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)?o:a;}
/* The plan from the trip server. A page in Chinese asks for it without its English (?en=0: about half the download)
   and fetches the English afterwards, in the background (ensureEn). A download gives up only when it stalls: no
   answer, or no new data, for `stall` ms (15 s); a slow connection that keeps going always finishes. progress(got,
   total) reports the bytes so far (unzipped, the same unit as the server's X-Raw-Length; total 0 if it didn't say). */
var STALL=15000;
function fetchPlan(stall,progress,path){var c=window.AbortController?new AbortController():null,t=null;
  function wait(ms){clearTimeout(t);if(c)t=setTimeout(function(){c.abort();},ms||stall||STALL);}
  wait();
  return fetch(planApi()+(path||"/api/plan"+(en()?"":"?en=0")),{cache:"no-cache",signal:c&&c.signal,headers:{"X-Access-Code":accessCode()}}).then(function(r){
      if(!r.ok)throw httpErr(r.status);
      var total=+r.headers.get("X-Raw-Length")||0;
      if(!r.body||!r.body.getReader||!window.TextDecoder){wait(60000);return r.json();} // no streaming: one long wait
      var rd=r.body.getReader(),dec=new TextDecoder(),txt="",got=0;wait();
      function pump(){return rd.read().then(function(x){if(x.done)return JSON.parse(txt+dec.decode());
        got+=x.value.length;txt+=dec.decode(x.value,{stream:true});wait();if(progress)progress(got,total);return pump();});}
      return pump();})
    .then(function(p){clearTimeout(t);if(!p||!p.rev||!(path?p.en:p.trip))throw new Error("no plan");return p;},function(e){clearTimeout(t);throw e;});}
function kb(got,total){return Math.round(got/1024)+(total?" / "+Math.round(total/1024):"")+" KB";}
// the plan's English and the version it belongs to; a plan that came without it keeps the last one until a new one comes
var ENREV=null,enBusy=false;
function keepPlan(p){PLAN={rev:p.rev,last:p.last};if(p.en){EN=p.en;ENREV=p.rev;}
  try{localStorage.setItem("nt-plan",JSON.stringify({rev:p.rev,last:p.last,trip:p.trip,en:EN,enRev:ENREV}));}catch(e){}}
// the saved copy gets the English that came on its own (the plan in it is kept as it came, not as the page reworked it)
function keepEn(){try{var k=JSON.parse(localStorage.getItem("nt-plan"));if(k&&k.rev===PLAN.rev){k.en=EN;k.enRev=ENREV;localStorage.setItem("nt-plan",JSON.stringify(k));}}catch(e){}}
// the English for this version of the plan: right away for a page in English (redrawn when it comes), otherwise
// a few seconds after the plan is up, so the page also reads in English offline and in quotes sent to the chat
function ensureEn(later){if(!PLAN.rev||ENREV===PLAN.rev||enBusy)return;
  if(later&&!en()){setTimeout(function(){ensureEn();},5000);return;}
  enBusy=true;
  fetchPlan(0,null,"/api/plan/en").then(function(j){EN=j.en;ENREV=j.rev;keepEn();if(en())rerender(true);})
    .catch(function(){}).then(function(){enBusy=false;});}
// local testing only: a copy of the plan in docs/ (never committed; scripts/plan.sh pull fetches it)
function publishedPlan(){
  if(!LOCALDEV)return Promise.reject(new Error("offline"));
  return Promise.all([
    fetch("trip.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}),
    fetch("i18n/en.json",{cache:"no-cache"}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};})
  ]).then(function(x){return {trip:x[0],en:x[1]||{}};});}
function checkPlan(){if(navigator.onLine===false)return;
  fetch(planApi()+"/api/plan/rev",{cache:"no-store",headers:{"X-Access-Code":accessCode()}}).then(function(r){if(r.status===401){lockOut();return null;}return r.ok?r.json():null;})
    .then(function(j){if(j&&j.rev&&j.rev!==PLAN.rev)return fetchPlan().then(applyPlan);}).catch(function(){});}
// a newer version: redraw everything from it, keeping the tab, the day and (if it's still there) the open stop
function applyPlan(p){if(!p||p.rev===PLAN.rev)return;var quiet=!PLAN.rev;keepPlan(p);
  morph(function(){index(p.trip);
    if(DATES.indexOf(state.date)<0)state.date=DATES[0];
    var D=day();if(state.sel!=null&&(!D||state.sel>=D.segs.length))state.sel=null;
    rerender();redrawMap();caption();},"plan");
  ensureEn(true);
  if(!quiet)planToast(p.last);}
function planToast(last){var t=$("planToast");if(!t){t=document.createElement("button");t.type="button";t.id="planToast";t.className="plan-toast";document.body.appendChild(t);
    t.addEventListener("click",function(){t.classList.remove("show");});}
  t.innerHTML=ICON.check+"<span><b>"+esc(last&&last.by?U("{p} 刚改了行程",{p:last.by}):U("行程更新了"))+"</b>"+(last&&last.summary?"<small>"+esc(last.summary)+"</small>":"")+"</span>";
  t.classList.remove("show");void t.offsetWidth;t.classList.add("show");clearTimeout(t._h);t._h=setTimeout(function(){t.classList.remove("show");},7000);}
function watchPlan(){clearInterval(planTimer);planTimer=setInterval(function(){if(document.visibilityState==="visible")checkPlan();},60000);checkPlan();}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"&&T)checkPlan();});
addEventListener("online",function(){if(T)checkPlan();});
document.addEventListener("trip:plan",function(){if(T)fetchPlan().then(applyPlan).catch(function(){});}); // the assistant just changed it

// the code stopped working (changed on the server): forget the plan on this device and ask again
function lockOut(){try{localStorage.removeItem("nt-plan");}catch(e){}setAccessCode(null);location.reload();}
// the lock screen: the page has no plan of its own, so without the code there is nothing to show
function showLock(msg){var box=$("lock");if(!box){box=document.createElement("div");box.id="lock";box.className="lock";document.body.appendChild(box);}
  document.documentElement.classList.add("locked");
  box.innerHTML='<form class="lock-card" id="lockForm"><span class="eyebrow">Nordic Trip 2027</span><h1>'+esc(U("北欧之旅 2027"))+'</h1>'+
    '<div class="lock-row"><input id="lockIn" type="password" autocomplete="current-password" placeholder="'+esc(U("访问码"))+'" aria-label="'+esc(U("访问码"))+'" required>'+
    '<button type="submit" class="pill primary">'+esc(U("进入"))+'</button></div><p class="lock-err" id="lockErr">'+esc(msg||"")+'</p></form>';
  var inp=$("lockIn");inp.focus();
  $("lockForm").addEventListener("submit",function(e){e.preventDefault();var code=inp.value.trim(),er=$("lockErr");if(!code)return;er.textContent=U("验证中…");
    fetch(planApi()+"/api/check",{method:"POST",headers:{"X-Access-Code":code}}).then(function(r){
      if(r.status===401){er.textContent=U("访问码不对。");inp.select();return;}if(!r.ok){er.textContent=whyNot(httpErr(r.status));return;}
      setAccessCode(code);er.textContent=U("访问码没问题，正在下载行程…");
      return fetchPlan(0,function(g,n){er.textContent=U("访问码没问题，正在下载行程…")+" "+kb(g,n);}).then(function(p){keepPlan(p);box.remove();document.documentElement.classList.remove("locked");start(p);},
        function(e){er.textContent=whyNot(e,true);});},
      function(e){er.textContent=whyNot(e,false);});});}
// Why unlocking failed, in words someone can act on: no answer at all (the network can't reach the Pi's *.ts.net
// address: some Wi-Fi filters and countries block it), an error from the server, or a plan too slow to arrive.
function httpErr(n){var e=new Error(n);e.code=n;return e;}
function whyNot(e,plan){
  if(e&&e.code>=400)return U("行程服务器出错了（{n}），过一会儿再试。",{n:e.code}); // (a timed-out fetch has code 20)
  return plan?U("访问码没问题，但行程没下载完（网络太慢）。到信号好一点的地方再点一次。"):U("连不上行程服务器：这个网络可能打不开它。换个网络（Wi-Fi / 流量）或开关 VPN 再试。");}
// (a copy saved before the English came on its own has no enRev: its English is that version's)
function start(p){if(p.en&&Object.keys(p.en).length){EN=p.en;ENREV="enRev" in p?p.enRev:p.rev;}if(p.rev)PLAN={rev:p.rev,last:p.last};boot(p.trip);watchPlan();ensureEn(true);}
applyStatic();
var kept=null;try{kept=JSON.parse(localStorage.getItem("nt-plan"));}catch(e){}
if(kept&&kept.trip&&accessCode())start(kept);
else if(!accessCode()&&!LOCALDEV)showLock();
else fetchPlan(LOCALDEV?4000:0,function(g,n){$("lede").textContent=U("正在载入行程…")+" "+kb(g,n);}).then(function(p){keepPlan(p);return p;}).catch(function(e){
    if(e.code===401){setAccessCode(null);showLock();return null;}
    console.warn("live plan unavailable:",e);return publishedPlan();})
  .then(function(p){if(p)start(p);}).catch(function(e){
    console.error(e);$("lede").textContent=U("连不上行程服务器，这台设备上也还没有存过行程。有网的时候再打开一次。");});
})();
