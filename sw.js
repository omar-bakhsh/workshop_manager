const CACHE_NAME = 'workshop-manager-v2';
const urlsToCache = [
    '/',
    '/login.html',
    '/admin.html',
    '/employee.html',
    '/income_report.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Network first for API calls
    if (url.pathname.startsWith('/api/') && !url.pathname.includes('/backup')) {
        // Do not cache POST, PUT, DELETE requests
        if (request.method !== 'GET') {
            event.respondWith(fetch(request));
            return;
        }

        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response before caching
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                    return response;
                })
                .catch(async () => {
                    // Return cached version if network fails
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If no cache, return a proper error response
                    return new Response(JSON.stringify({ message: "Network error and no cache available" }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
    } else {
        // Cache first for static assets
        event.respondWith(
            caches.match(request)
                .then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(request).then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseToCache);
                        });
                        return response;
                    }).catch(() => {
                        // If both cache and network fail
                        return new Response("Network error and no cache available", {
                            status: 503,
                            statusText: "Service Unavailable"
                        });
                    });
                })
        );
    }
});
