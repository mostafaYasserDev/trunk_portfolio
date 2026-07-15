const CACHE_NAME = 'jidhe-v14';
const ASSETS = [
    './',
    './index.html',
    './donation/index.html',
    './css/style.css',
    './css/responsive.css',
    './js/app.js',
    './js/html-embed.js',
    './js/helpers.js',
    './js/spam-guard.js',
    './js/security.js',
    './js/social.js',
    './js/social-modal.js',
    './js/ui.js',
    './firebase/public.js',
    './assets/logo.png',
    './manifest.json',
    './vendor/quill/quill.min.js',
    './vendor/quill/quill.snow.css',
    './otf/thmanyahseriftext-Regular.otf',
    './otf/thmanyahseriftext-Bold.otf',
    './otf/thmanyahseriftext-Medium.otf',
    './otf/thmanyahseriftext-Black.otf'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // Skip non-same-origin requests (external CDNs, tracking pixels, APIs, etc.)
    if (url.origin !== self.location.origin) return;

    // Skip admin and client pages — always fetch fresh
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/client/')) return;
    if (url.pathname.startsWith('/js/admin') || url.pathname.startsWith('/firebase/firebase.js')) return;

    // Skip Vercel serverless API routes — always fetch fresh
    if (url.pathname.startsWith('/api/')) return;

    // HTML navigations must prefer the network so an old cached page cannot
    // keep referencing stale JavaScript modules after a deployment.
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(async () => (
                await caches.match(e.request)
                || await caches.match('./index.html')
                || new Response('', { status: 503, statusText: 'Offline' })
            ))
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetched = fetch(e.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(() => cached || new Response('', { status: 503, statusText: 'Offline' }));
            return cached || fetched;
        })
    );
});
