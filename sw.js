const CACHE_NAME = "calendario-cache-v1";

self.addEventListener("install", (event) => {
    console.log("Service Worker instalado.");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("Service Worker activado.");
    return self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Dejamos que Firebase maneje las peticiones de red normales
    event.respondWith(fetch(event.request));
});
