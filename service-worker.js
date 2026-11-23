const CACHE_VERSION = "ttepki-github-pwa-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const PAGE_CACHE = `${CACHE_VERSION}-page`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const APP_BASE = new URL("./", self.registration.scope);
const appPath = (path) => new URL(path, APP_BASE).pathname;
const PAGE_URL = APP_BASE.href;
const SHELL_FILES = ["manifest.webmanifest", "icons/icon-48.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png"].map(appPath);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const keep = new Set([SHELL_CACHE, PAGE_CACHE, AUDIO_CACHE]);
    await Promise.all(names.filter((name) => name.startsWith("ttepki-github-pwa-") && !keep.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname === APP_BASE.pathname || url.pathname === appPath("index.html")) {
    const network = fetch(request);
    const cacheWrite = network.then((response) => {
      if (!response.ok) return;
      return caches.open(PAGE_CACHE).then((cache) => cache.put(PAGE_URL, response.clone()));
    }).catch(() => {});
    event.waitUntil(cacheWrite);
    event.respondWith(network.catch(async () => {
      const cache = await caches.open(PAGE_CACHE);
      return (await cache.match(PAGE_URL)) || Response.error();
    }));
    return;
  }

  if (url.pathname.startsWith(appPath("audio/")) && url.pathname.endsWith(".mp3")) {
    const cached = caches.open(AUDIO_CACHE).then((cache) => cache.match(request));
    const response = cached.then((hit) => hit || fetch(request));
    const cacheWrite = response.then((result) => {
      if (!result.ok) return;
      return cached.then((hit) => hit || caches.open(AUDIO_CACHE).then((cache) => cache.put(request, result.clone())));
    }).catch(() => {});
    event.waitUntil(cacheWrite);
    event.respondWith(response.catch(async () => {
      const cache = await caches.open(AUDIO_CACHE);
      return (await cache.match(request)) || Response.error();
    }));
    return;
  }

  if (SHELL_FILES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone()).catch(() => {});
      return response;
    })());
  }
});
