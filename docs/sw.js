/* Offline copy of the trip planner (registered by app.js).
   The page, its code and trip.json come from the network when it answers within a few seconds, otherwise from
   the copy saved here, so the plan still opens with no signal (highlands, fjords, ferries) and weak signal
   doesn't leave a blank page. Photos and fonts are kept once seen, and the prep tab can fetch every photo ahead
   of time; a photo not saved at the size asked for falls back to any size that is. The forecast and exchange
   rates keep their last answer. The chat, the expense log and the drivers (/api/) and Google Maps always go to
   the network. Bump SHELL's version only when this file's caching changes, not for edits to the site. */
var SHELL="nt-shell-v1",PHOTOS="nt-photos",FONTS="nt-fonts-v1",DATA="nt-data-v1",KEEP=[SHELL,PHOTOS,FONTS,DATA];
var CORE=["./","index.html","styles.css","app.js","chat.js","config.js","trip.json","i18n/en.json"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(SHELL).then(function(c){
    return Promise.all(CORE.map(function(u){return c.add(new Request(u,{cache:"no-cache"})).catch(function(){});}));
  }).then(function(){return self.skipWaiting();}));});

self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k.indexOf("nt-")===0&&KEEP.indexOf(k)<0;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));});

self.addEventListener("fetch",function(e){
  var req=e.request;if(req.method!=="GET")return;
  var u=new URL(req.url);
  if(u.origin===location.origin){if(u.pathname.indexOf("/api/")<0)e.respondWith(fresh(req,SHELL,4000));return;}
  if(u.hostname==="images.unsplash.com"){e.respondWith(photo(req.url));return;}
  if(u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com"){e.respondWith(kept(req,FONTS));return;}
  if(u.hostname==="api.open-meteo.com"||u.hostname==="open.er-api.com")e.respondWith(fresh(req,DATA,6000));
});

// network first; after `wait` ms, or when the network fails, the saved copy answers instead (the network reply
// still lands in the cache for next time). Any page address falls back to the saved index.html.
function fresh(req,name,wait){
  return caches.open(name).then(function(c){
    var nav=req.mode==="navigate";
    function saved(){return c.match(req,{ignoreSearch:nav}).then(function(r){return r||(nav?c.match("./").then(function(x){return x||c.match("index.html");}):null);});}
    var net=fetch(req).then(function(r){if(r.ok)c.put(req,r.clone());return r;});
    return new Promise(function(resolve,reject){var done=false;
      function give(r){if(!done&&r){done=true;resolve(r);}}
      var t=setTimeout(function(){saved().then(give);},wait);
      net.then(function(r){clearTimeout(t);give(r);},function(err){clearTimeout(t);
        saved().then(function(r){if(r)give(r);else if(!done){done=true;reject(err);}});});
    });});}

// saved copy first, then the network
function kept(req,name){
  return caches.open(name).then(function(c){return c.match(req).then(function(r){
    return r||fetch(req).then(function(n){if(n.ok||n.type==="opaque")c.put(req,n.clone());return n;});});});}

// photos are fetched with CORS (Unsplash allows it) so the saved copy is a normal response, not an opaque one
function photo(url){
  return caches.open(PHOTOS).then(function(c){return c.match(url).then(function(r){if(r)return r;
    return fetch(url,{mode:"cors",credentials:"omit"}).then(function(n){if(n.ok)c.put(url,n.clone());return n;}).catch(function(err){
      var path=new URL(url).pathname;
      return c.keys().then(function(ks){var best=null,bw=-1;
        ks.forEach(function(k){var ku=new URL(k.url);if(ku.pathname!==path)return;var w=+ku.searchParams.get("w")||0;if(w>bw){bw=w;best=k;}});
        if(best)return c.match(best);throw err;});});});});}
