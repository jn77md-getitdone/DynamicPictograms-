// Offline support: the app itself is cached so it opens without internet.
// Online pictograms (ARASAAC) are cached the first time they are shown.
const VERSION = 'v3';
const APP_CACHE = `app-${VERSION}`;
const IMG_CACHE = 'pictogram-images';
const APP_FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/library.js', 'js/parser.js', 'js/store.js', 'js/speech.js', 'js/ai.js', 'js/arasaac.js', 'js/memory.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('app-') && k !== APP_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Pictogram images and the AI library: cache first, they never change.
  if (url.hostname === 'static.arasaac.org' || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(IMG_CACHE).then(async cache => {
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // App files: network first (so updates arrive), fall back to cache when offline.
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then(res => {
      if (res.ok) caches.open(APP_CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  }
});
