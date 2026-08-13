/* DF AGRO — service worker (offline no campo)
   - App shell + bibliotecas (CDN) ficam em cache → abre e recarrega offline.
   - Supabase NUNCA é cacheado (dados ao vivo, sempre rede).
   - Navegação: rede primeiro (pega atualizações) → cache se offline.
   - Demais GET: cache primeiro → rede (e cacheia). */
const CACHE = 'dfagro-cache-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // cada item individual: se um CDN falhar, não derruba o cache inteiro
      Promise.all(SHELL.map((u) =>
        c.add(new Request(u, { mode: u.startsWith('http') ? 'cors' : 'same-origin' })).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // escritas (POST) vão sempre pra rede
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.hostname.indexOf('supabase.co') !== -1) return;  // dados ao vivo: nunca cachear
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navegação (o próprio app): rede primeiro, cache como reserva (offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Demais GET (bibliotecas, fontes, ícones): cache primeiro, senão rede (e cacheia)
  e.respondWith(
    caches.match(req).then((m) =>
      m || fetch(req).then((r) => {
        if (r && r.status === 200) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
        return r;
      }).catch(() => m)
    )
  );
});
