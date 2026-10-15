// Changez la version à chaque mise à jour du site pour renouveler le cache.
const V = 'cartes-v7';
const LOCAL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/barcode-detector@3.2.0/dist/iife/ponyfill.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(LOCAL);
    await Promise.all(CDN.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Cache d'abord, mise à jour en arrière-plan ; hors ligne : retombe sur le cache.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    // Réseau d'abord (version à jour), mais si la connexion est absente ou lente (> 3 s),
    // on ouvre immédiatement la copie en cache ; la mise à jour se termine en arrière-plan.
    e.respondWith((async () => {
      const c = await caches.open(V);
      const cached = await c.match('./index.html');
      const net = fetch(r).then(res => {
        if (res.ok) c.put('./index.html', res.clone());
        return res;
      });
      if (!cached) return net.catch(() => Response.error());
      e.waitUntil(net.catch(() => {}));
      const slow = new Promise(ok => setTimeout(() => ok(cached), 3000));
      return Promise.race([net, slow]).catch(() => cached);
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') c.put(r, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (r.mode === 'navigate' ? await c.match('./index.html') : Response.error());
  })());
});
