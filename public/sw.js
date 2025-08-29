// Simple cache‑first service worker generated for EngNinja Pro
// This service worker implements a cache‑first strategy: it looks up
// requests in its cache and falls back to the network if necessary. When
// network responses are successful, they are stored in the cache for future
// offline use. See MDN guide for cache‑first strategy for more details
//【941111253573582†L275-L339】.

const CACHE_NAME = 'engninja-pro-cache-v1';

/**
 * Store a copy of the response in the named cache.
 * Cloning is required because a Response can only be consumed once.
 */
async function putInCache(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

/**
 * Try to respond from the cache. If not present, fetch from the network and
 * cache the result. If network fails return a fallback response when
 * available.
 */
async function cacheFirst({ request, fallbackUrl }) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const responseFromNetwork = await fetch(request);
    // only cache successful (status OK) same‑origin responses
    if (responseFromNetwork && responseFromNetwork.ok && request.url.startsWith(self.location.origin)) {
      putInCache(request, responseFromNetwork.clone());
    }
    return responseFromNetwork;
  } catch (error) {
    if (fallbackUrl) {
      const fallbackResponse = await caches.match(fallbackUrl);
      if (fallbackResponse) return fallbackResponse;
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('install', (event) => {
  // skip waiting so this service worker becomes active immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // claim clients so that the service worker starts controlling pages
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(cacheFirst({ request: event.request }));
});