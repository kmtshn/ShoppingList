// キャッシュするファイルの名前とバージョンを定義
const CACHE_NAME = 'memoris-cache-v1'; // アプリ名に合わせてキャッシュ名を変更
const urlsToCache = [
  './', // ルートパスを相対パスに変更
  './index.html', // index.htmlも相対パスに変更
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
  // 必要に応じて他のファイルもキャッシュリストに追加できます
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
            // 古いキャッシュを削除
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
