const CACHE_NAME = 'workshop-manager-v5.0'; // Version increment to force clear
const urlsToCache = [
    '/',
    '/login.html',
    '/admin.html',
    '/employee.html'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName); // NUCLEAR CLEAR
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Network First strategy for everything
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                // If it's an API request and server is down, return synthetic error response
                if (event.request.url.includes('/api/')) {
                    return new Response(JSON.stringify({ error: 'Server Unreachable' }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                // Otherwise return a generic error response
                return Response.error();
            });
        })
    );
});
