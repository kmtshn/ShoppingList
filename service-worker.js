// キャッシュの名前を定義
const CACHE_NAME = 'shopping-checklist-v1';
// キャッシュするファイルのリスト
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com' // Tailwind CSSもキャッシュ
];

// Service Workerのインストールイベント
self.addEventListener('install', event => {
  // インストール処理
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Service Workerのフェッチイベント
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにヒットした場合、それを返す
        if (response) {
          return response;
        }
        // キャッシュになかった場合、ネットワークから取得
        return fetch(event.request);
      }
    )
  );
});
