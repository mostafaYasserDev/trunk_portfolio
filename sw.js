const CACHE_NAME = 'jidhe-v7';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/responsive.css',
    './js/app.js',
    './js/helpers.js',
    './js/spam-guard.js',
    './js/security.js',
    './js/social.js',
    './js/social-modal.js',
    './js/ui.js',
    './firebase/public.js',
    './assets/logo.png',
    './manifest.json',
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
    if (url.pathname.includes('/admin/') || url.pathname.includes('/client/')) {
        return;
    }
    if (url.origin.includes('googleapis.com') || url.origin.includes('gstatic.com') ||
        url.origin.includes('unpkg.com') || url.origin.includes('cdnjs.cloudflare.com')) {
        return;
    }
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetched = fetch(e.request).then(response => {
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || fetched;
        })
    );
});
