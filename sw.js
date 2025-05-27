// sw.js - v2.0.2-critical-bugfix-2 (PWA Syntax fix & URL fix)

const CACHE_NAME = 'oneulset-cache-v2.0.2'; // 캐시 이름 업데이트 (버전 반영)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/src/app.js',
  '/src/state.js',
  '/src/services/firebase.js',
  '/src/services/localstorage.js',
  '/src/ui/domElements.js',
  '/src/ui/render.js',
  '/src/utils.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // 외부 CDN URL은 직접 문자열로 포함하여 올바른 경로로 캐싱되도록 합니다.
  '<https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap>',
  '<https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css>',
  '<https://cdn.jsdelivr.net/npm/chart.js>',
  '<https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js>',
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js>',
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js>',
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js>',
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

  // Firebase 관련 요청은 캐시하지 않음 (항상 네트워크 우선)
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
            // Opaque Response (CORS 제약이 있는 외부 리소스)도 캐시할 수 있도록 합니다.
            if (networkResponse && networkResponse.ok || networkResponse.type === 'opaque') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                    .then((cache) => {
                      // 요청 URL이 캐시 목록에 명시적으로 포함된 경우에만 캐시 (선택 사항)
                      // 또는 모든 유효한 GET 요청을 캐시할 수 있습니다.
                      // 여기서는 일단 모든 유효한 응답을 캐시하도록 합니다.
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
