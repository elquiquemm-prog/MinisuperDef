"use strict";

const CACHE_NAME = "miranda-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/data.js",
  "./js/supabase.js",
  "./js/app.js",
  "./assets/miranda.svg",
  "./assets/produce.jpg",
  "./assets/bakery.jpg",
  "./assets/dairy.jpg",
  "./assets/pantry.jpg",
  "./assets/drinks.jpg",
  "./assets/products/leche.svg",
  "./assets/products/pan.svg",
  "./assets/products/cafe.svg",
  "./assets/products/huevo.svg",
  "./assets/products/arroz.svg",
  "./assets/products/jugo.svg",
  "./assets/products/yogur.svg",
  "./assets/products/galletas.svg",
  "./assets/products/agua.svg",
  "./assets/products/frijol.svg",
  "./assets/products/queso.svg",
  "./assets/products/refresco.svg",
  "./assets/photos/leche.jpg",
  "./assets/photos/pan.jpg",
  "./assets/photos/cafe.jpg",
  "./assets/photos/huevo.jpg",
  "./assets/photos/arroz.jpg",
  "./assets/photos/jugo.jpg",
  "./assets/photos/yogur.jpg",
  "./assets/photos/galletas.jpg",
  "./assets/photos/agua.jpg",
  "./assets/photos/frijol.jpg",
  "./assets/photos/queso.jpg",
  "./assets/photos/refresco.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => (key.startsWith("nativa-shell-") || key.startsWith("miranda-shell-")) && key !== CACHE_NAME)
      .map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      }
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
