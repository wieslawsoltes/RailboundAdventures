/* Railbound Adventures: same-origin, versioned offline app-shell cache. */
'use strict';
const CACHE = 'railbound-adventures-3.0.0-expedition';
const BASE = new URL('./', self.location.href);
const FILES = [
  './', 'index.html', 'styles/app.css', 'manifest.webmanifest',
  'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'src/math.js', 'src/data.js', 'src/tracks.js', 'src/physics.js',
  'src/geometry.js', 'src/shaders.js', 'src/renderer.js', 'src/world.js',
  'src/rolling-stock.js', 'src/camera.js', 'src/audio.js',
  'src/persistence.js', 'src/ui.js', 'src/main.js',
  'src/generation.js', 'src/generation-worker.js', 'src/generation-ui.js',
  'src/world-detail.js', 'src/train-detail.js'
].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('railbound-adventures-') && key !== CACHE)
      .map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  // Network-first keeps source deployments current. The installed shell works offline.
  event.respondWith(fetch(request).then(response => {
    if (response.ok && FILES.includes(url.href)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match(new URL('index.html', BASE).href);
      if (shell) return shell;
    }
    return new Response('This resource is unavailable offline.', {status: 503, headers: {'Content-Type':'text/plain'}});
  }));
});
