var K="qarib-v1",F=["./","index.html","qarib-api.js","config.js","manifest.webmanifest"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(K).then(function(c){return c.addAll(F)}))});
self.addEventListener("fetch",function(e){var r=e.request;if(r.method!=="GET"||new URL(r.url).origin!==location.origin)return;
 e.respondWith(fetch(r).then(function(n){var c=n.clone();caches.open(K).then(function(x){x.put(r,c)});return n}).catch(function(){return caches.match(r)}))});
