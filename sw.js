const V='dojo-281ac6ef3d';
const PRE=["admin.html", "ai-round.html", "binary-search.html", "bits.html", "companies.html", "crunch.html", "dp.html", "graphs.html", "greedy-intervals.html", "hashing.html", "heap.html", "index.html", "linked-list.html", "login.html", "notes.html", "patterns.html", "plan.html", "recursion.html", "reels.html", "sd-basics.html", "sd-behavioral.html", "sd-creational.html", "sd-databases.html", "sd-distributed.html", "sd-hld.html", "sd-java.html", "sd-lld.html", "sd-solid.html", "sd-start.html", "sd-structural.html", "sliding-window.html", "stack.html", "trie.html", "two-pointers.html", "ask-kb.js", "auth.js", "reels-data.js", "companies-data.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "live/", "live/index.html", "live/data.js"];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>Promise.all(PRE.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting())) });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('dojo-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())) });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  const font=/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if(u.origin!==location.origin && !font) return;
  if(u.origin===location.origin&&/\/companies-data\.js$/.test(u.pathname)){ // weekly-updated data: network first
    e.respondWith(fetch(r).then(res=>{ const c=res.clone(); caches.open(V).then(x=>x.put(r,c)); return res }).catch(()=>caches.match(r)));
    return;
  }
  if(r.mode==='navigate'){ // network first so updates arrive, cache when offline
    e.respondWith(fetch(r).then(res=>{ const c=res.clone(); caches.open(V).then(x=>x.put(r,c)); return res }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m=>{ const net=fetch(r).then(res=>{ if(res&&(res.ok||res.type==='opaque')){ const c=res.clone(); caches.open(V).then(x=>x.put(r,c)) } return res }).catch(()=>m); return m||net }));
});
