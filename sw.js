--- START OF FILE sw.js ---
// sw.js - v1.12.0-optimized-caching (캐시 전략 최적화 및 URL 수정)

const CACHE_NAME = 'oneulset-cache-v1.12.0'; // 캐시 이름 업데이트 (버전 반영)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '<https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap>',
  // index.html에서 사용되는 최신 Font Awesome 버전으로 업데이트
  '<https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css>',
  '<https://cdn.jsdelivr.net/npm/chart.js>',
  '<https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js>',
  // Firebase SDK 관련 URL은 서비스 워커에서 캐싱하지 않고 네트워크 우선으로 처리하므로 제거함
  // '<https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js>',
  // '<https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js>',
  // '<https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js>'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        // cache.addAll은 모든 URL을 성공적으로 캐시해야 합니다.
        // 네트워크 오류 시 설치 실패는 예상된 동작입니다.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll or skipWaiting failed:', error);
        // 설치 실패 시 사용자에게 알리거나 적절한 폴백 로직을 추가할 수 있습니다.
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
  // Firebase 관련 요청은 네트워크 우선 처리 (원본 로직 유지, 필요시)
  // if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseauth.googleapis.com')) {
  //   event.respondWith(fetch(event.request));
  //   return;
  // }

  if (event.request.method !== 'GET') {
    return; // GET 요청이 아닌 경우 서비스 워커가 처리하지 않음
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 캐시된 응답이 있으면 그것을 반환
        if (cachedResponse) {
          return cachedResponse;
        }

        // 캐시된 응답이 없으면 네트워크로 요청
        return fetch(event.request).then(
          (networkResponse) => {
            // 유효한 응답인지 확인 후 캐시에 저장
            if (networkResponse && networkResponse.ok) {
              // Firestore나 Auth API 호출이 아닌 일반 GET 요청에 대해서만 캐싱 시도
              // (위에서 Firebase 관련 요청은 별도 처리했으므로, 여기서는 그 외의 것들)
              if (!event.request.url.includes('firestore.googleapis.com') && !event.request.url.includes('firebaseauth.googleapis.com')) {
                  const responseToCache = networkResponse.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, responseToCache);
                    });
              }
            } else if (networkResponse && networkResponse.type === 'opaque') {
                // opaque 응답 (CORS 없는 외부 리소스)도 캐싱
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
          // 오프라인 페이지 제공 (선택 사항)
          // if (event.request.mode === 'navigate') {
          //   return caches.match('/offline.html'); // offline.html 파일이 캐시되어 있어야 함
          // }
          // 에러 응답 반환 또는 아무것도 반환하지 않아 브라우저가 기본 오류 처리하도록 함
          return new Response("Network error occurred", {
            status: 408, // Request Timeout
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});
--- END OF FILE sw.js ---
