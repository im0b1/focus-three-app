// sw.js - v1.11-pwa

const CACHE_NAME = 'oneulset-cache-v1.11'; // 캐시 이름 (앱 버전과 일치 권장)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png', // 실제 아이콘 경로로 수정
  '/icons/icon-512x512.png', // 실제 아이콘 경로로 수정
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
  // 추가적인 정적 에셋이 있다면 여기에 추가
];

// 서비스 워커 설치
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        return self.skipWaiting(); // 새 서비스워커 즉시 활성화
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
});

// 서비스 워커 활성화 및 이전 캐시 정리
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
      return self.clients.claim(); // 현재 페이지 제어권 즉시 확보
    })
  );
});

// 네트워크 요청 가로채기 (Fetch 이벤트)
self.addEventListener('fetch', (event) => {
  // POST 요청이나 API 요청 등은 캐시하지 않도록 예외 처리 (현재 앱에는 해당사항 적음)
  if (event.request.method !== 'GET') {
    return;
  }

  // Cache First 전략
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then(
          (networkResponse) => {
            // 유효한 응답인지 확인
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque' && !urlsToCache.includes(event.request.url)) {
                // opaque 응답은 내용을 알 수 없으므로, 명시적으로 캐싱하려는 외부 리소스가 아니면 캐싱하지 않음
                // (예: Google Fonts CSS는 type 'basic', 폰트 파일은 'cors' 또는 'opaque'일 수 있음)
                return networkResponse;
            }


            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        ).catch(error => {
          console.error('[Service Worker] Fetch failed:', error);
          // 오프라인 대체 페이지를 보여줄 수 있음 (선택 사항)
          // return caches.match('/offline.html');
        });
      })
  );
});
