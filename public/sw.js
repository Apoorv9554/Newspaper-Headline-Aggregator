const CACHE_NAME = 'news-aggregator-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';
const IMAGE_CACHE = 'image-cache-v1';

// Add fallback image to static assets
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
            caches.open(IMAGE_CACHE).then(cache => cache.add('/fallback.svg'))
        ])
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== IMAGE_CACHE) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Claim clients to ensure the service worker is in control
            self.clients.claim()
        ])
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    // Handle image requests differently
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        // Check if the cached response is still valid (less than 1 hour old)
                        const cacheDate = new Date(cachedResponse.headers.get('date'));
                        const now = new Date();
                        if (now - cacheDate < 3600000) { // 1 hour in milliseconds
                            return cachedResponse;
                        }
                    }

                    return fetch(event.request, {
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    }).then(response => {
                        if (!response || response.status !== 200) {
                            return cache.match('/fallback.svg');
                        }

                        // Clone the response and add cache control headers
                        const responseToCache = response.clone();
                        const headers = new Headers(responseToCache.headers);
                        headers.append('date', new Date().toUTCString());

                        const cachedResponse = new Response(responseToCache.body, {
                            status: responseToCache.status,
                            statusText: responseToCache.statusText,
                            headers: headers
                        });

                        cache.put(event.request, cachedResponse);
                        return response;
                    }).catch(() => {
                        return cache.match('/fallback.svg');
                    });
                });
            })
        );
        return;
    }

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Handle other requests
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }

            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            });
        })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-news') {
        event.waitUntil(syncNews());
    }
});

// Push Notification
self.addEventListener('push', (event) => {
    const options = {
        body: event.data.text(),
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View News',
                icon: '/checkmark.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/xmark.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('News Update', options)
    );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Helper function for background sync
async function syncNews() {
    try {
        const response = await fetch('/api/news');
        const data = await response.json();
        
        // Store the latest news in IndexedDB
        const db = await openDB();
        const tx = db.transaction('news', 'readwrite');
        const store = tx.objectStore('news');
        
        await store.put(data, 'latest');
        await tx.complete;
        
        // Show notification
        self.registration.showNotification('News Updated', {
            body: 'New articles are available',
            icon: '/icon.png'
        });
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('NewsDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('news')) {
                db.createObjectStore('news');
            }
        };
    });
} 