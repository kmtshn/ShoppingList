const CACHE_NAME = 'memoris-cache-v5';

const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-512.svg',
  './squirrel-mark.svg',
  './icon-192.png',
  './icon-512.png'
];

// Service Workerのインストールイベント
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Service Workerの有効化イベント
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ホワイトリストにない古いキャッシュ(v1)を削除
          if (cacheName.startsWith('memoris-cache-') && cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ファイルへのリクエストがあったときのイベント
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
