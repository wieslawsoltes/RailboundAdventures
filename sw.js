/* Railbound Adventures: same-origin, versioned offline app-shell cache. */
'use strict';
const CACHE = 'railbound-adventures-3.4.0-authored';
const BASE = new URL('./', self.location.href);
const FILES = [
  './', 'index.html', 'styles/app.css', 'manifest.webmanifest',
  'assets/icon.svg', 'assets/icon-180.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'src/math.js', 'src/data.js', 'src/tracks.js', 'src/physics.js',
  'src/geometry.js', 'src/shaders.js', 'src/renderer.js', 'src/world.js',
  'src/rolling-stock.js', 'src/camera.js', 'src/audio.js',
  'src/persistence.js', 'src/ui.js', 'src/main.js',
  'src/postprocess.js', 'src/cinematic-models.js', 'src/world-life.js', 'src/journey.js', 'src/cinematic-ui.js',
  'src/generation.js', 'src/generation-worker.js', 'src/generation-ui.js',
  'src/world-detail.js', 'src/train-detail.js', 'src/botany.js', 'src/settlements.js', 'src/living-shaders.js', 'src/terrain-mesh.js',
  'src/urban-detail.js', 'src/materials.js',
  'src/fidelity-shaders.js',
  'src/shadow-cascades.js',
  'src/contact-occlusion.js',
  'assets/materials/Asphalt012-albedo.jpg',
  'assets/materials/Asphalt012-surface.png',
  'assets/materials/Bark006-albedo.jpg',
  'assets/materials/Bark006-surface.png',
  'assets/materials/Concrete034-albedo.jpg',
  'assets/materials/Concrete034-surface.png',
  'assets/materials/Gravel023-albedo.jpg',
  'assets/materials/Gravel023-surface.png',
  'assets/materials/Ground037-albedo.jpg',
  'assets/materials/Ground037-surface.png',
  'assets/materials/Ground048-albedo.jpg',
  'assets/materials/Ground048-surface.png',
  'assets/materials/LICENSE.txt',
  'assets/materials/PavingStones036-albedo.jpg',
  'assets/materials/PavingStones036-surface.png',
  'assets/materials/Rock030-albedo.jpg',
  'assets/materials/Rock030-surface.png',
  'assets/materials/manifest.json',
  'src/authored-assets.js',
  'src/authored-shaders.js',
  'src/station-art.js',
  'src/temporal.js',
  'src/rolling-art.js',
  'assets/authored/fern-02-color.png',
  'assets/authored/fern-02-surface.png',
  'assets/authored/hero-meshes.bin',
  'assets/authored/LICENSE.txt', 'assets/authored/manifest.json',
  'assets/authored/pine-tree-01-color.png',
  'assets/authored/pine-tree-01-surface.png',
  'assets/authored/rock-moss-set-01-color.png',
  'assets/authored/rock-moss-set-01-surface.png',
  'assets/authored/tree-stump-02-color.png',
  'assets/authored/tree-stump-02-surface.png'
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
