// Offline service worker for Ezra's Blocks. Bump CACHE to push an update.
const CACHE = 'ezrablocks-v38';
const CORE = [
  '', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/main.js', 'js/math.js', 'js/gfx.js', 'js/world.js', 'js/worlds.js',
  'js/player.js', 'js/input.js', 'js/audio.js', 'js/animals.js',
  'js/creepers.js', 'js/nethermobs.js', 'js/zombies.js', 'js/spiders.js',
  'js/skeletons.js', 'js/villagers.js', 'js/dragon.js', 'js/secretworld.js',
  'js/aliencops.js', 'js/astronaut.js', 'js/rover.js', 'js/dragonmount.js', 'js/rocketship.js', 'js/spacerace.js', 'js/goals.js', 'js/character.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) =>
    // Cache files individually so one failure doesn't abort the whole install.
    Promise.allSettled(CORE.map((u) => c.add(u)))
  ));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

// Network-first: always try the network so updates show up immediately, and
// fall back to the cache when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => {
      if (hit) return hit;
      if (req.mode === 'navigate') return caches.match('index.html');
    }))
  );
});
