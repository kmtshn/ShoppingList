// キャッシュするファイルの名前とバージョンを定義
const CACHE_NAME = 'korekau-cache-v1';
const urlsToCache = [
  '/',
  '/index.html' 
  // CSSや他のJSファイル、画像などを追加する場合はここにも追記します
];

// Service Workerのインストールイベント
self.addEventListener('install', (event) => {
  // インストール処理
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Service Workerの有効化イベント
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});


// ファイルへのリクエストがあったときのイベント
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにファイルがあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得する
        return fetch(event.request);
      }
    )
  );
});
