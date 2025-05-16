// sw.js - v2.0.0-firebase-auth-sync

const CACHE_NAME = 'oneulset-cache-v2.0.0'; // 캐시 이름 업데이트
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '<https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap>',
  '<https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css>',
  '<https://cdn.jsdelivr.net/npm/chart.js>',
  '<https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js>',
  // Firebase SDK는 네트워크 우선 또는 캐시하지 않도록 처리할 수도 있으나, PWA 오프라인 기본 작동을 위해 포함
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js>',
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js>',
  '<https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js>'
];

// 서비스 워커 설치 (self.skipWaiting() 추가)
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache.map(url => new Request(url, {cache: 'reload'}))); // 항상 네트워크에서 최신 파일로 캐싱 시도
      })
      .then(() => {
        return self.skipWaiting(); // 새 서비스워커 즉시 활성화
      })
      .catch(error => {
        console.error('[Service Worker] Cache addAll failed:', error);
      })
  );
});

// 서비스 워커 활성화 및 이전 캐시 정리 (self.clients.claim() 추가)
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
  // Firebase Firestore 요청은 네트워크를 우선하도록 처리 (실시간 데이터 동기화 중요)
  // 또는 아예 가로채지 않도록 할 수도 있음
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebaseauth.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.method !== 'GET') {
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
            if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type === 'opaque' && !urlsToCache.includes(event.request.url))) {
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
          console.error('[Service Worker] Fetch failed:', error, event.request.url);
          // 오프라인 페이지 제공 (선택 사항)
          // if (event.request.mode === 'navigate') {
          //   return caches.match('/offline.html');
          // }
        });
      })
  );
});
