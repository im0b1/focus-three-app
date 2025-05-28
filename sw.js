// sw.js - v1.22.2-hotfix (PWA Syntax fix)

const CACHE_NAME = 'oneulset-cache-v1.22.2'; // 캐시 이름 업데이트 (버전 반영)
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '<https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap>',
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

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(
          (networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              if (!event.request.url.includes('firestore.googleapis.com') && !event.request.url.includes('firebaseauth.googleapis.com')) {
                  const responseToCache = networkResponse.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => {
                      cache.put(event.request, responseToCache);
                    });
              }
            } else if (networkResponse && networkResponse.type === 'opaque') {
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
          return new Response("Network error occurred", {
            status: 408,
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});
