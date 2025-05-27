// sw.js - v2.0.0-refactor (PWA Syntax fix)

const CACHE_NAME = 'oneulset-cache-v2.0.0'; // 캐시 이름 업데이트 (버전 반영)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/src/app.js', // 업데이트된 경로
  '/src/state.js',
  '/src/services/firebase.js',
  '/src/services/localstorage.js',
  '/src/ui/domElements.js',
  '/src/ui/render.js',
  '/src/utils.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '<https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap>',
  // index.html에서 사용되는 최신 Font Awesome 버전으로 업데이트
  '<https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css>',
  '<https://cdn.jsdelivr.net/npm/chart.js>',
  '<https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js>',
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll or skipWaiting failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Firebase 관련 요청은 캐시하지 않음
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseauth.googleapis.com')) {
      event.respondWith(fetch(event.request));
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(
          (networkResponse) => {
            // 네트워크 응답이 유효하면 캐시에 저장
            if (networkResponse && networkResponse.ok || networkResponse.type === 'opaque') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
            }
            return networkResponse;
          }
        ).catch(error => {
          console.error('[Service Worker] Fetch failed, no cache match:', error, event.request.url);
          // 네트워크 오류 발생 시 대체 응답 또는 오프라인 페이지 제공
          // 현재는 간단한 네트워크 오류 응답을 제공합니다.
          return new Response("Network error occurred", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});

