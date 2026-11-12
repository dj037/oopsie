const CACHE = "oopsie-shell-v7";
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const response = await fetch("/");
      if (!response.ok) throw new Error("Application shell unavailable");
      const html = await response.clone().text(),
        cache = await caches.open(CACHE);
      const bundles = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g),
      ].map((m) => m[1]);
      await cache.addAll([
        ...new Set([
          ...bundles,
          "/assets/mascot.png",
          "/assets/welcome.jpg",
          "/assets/icon-192.png",
          "/assets/stickers.jpg",
          "/assets/phone-grip.png",
          "/assets/lobster-relaxed.png",
          "/assets/lobster-anxious.png",
          "/assets/lobster-cooked.png",
          "/assets/lobster-loading.png",
        ]),
      ]);
      await cache.put("/", response);
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("@vite") ||
    url.pathname.startsWith("/src/")
  )
    return;
  // Only cache a production shell; never cache sessions, API responses or passwords.
  if (req.mode === "navigate")
    event.respondWith(
      fetch(req)
        .then(async (r) => {
          if (r.ok) {
            const c = await caches.open(CACHE);
            await c.put("/", r.clone());
          }
          return r;
        })
        .catch(() => caches.match("/")),
    );
  else if (url.pathname.startsWith("/assets/"))
    event.respondWith(
      caches.match(req, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(req).then(async (r) => {
            if (r.ok) {
              const c = await caches.open(CACHE);
              await c.put(req, r.clone());
            }
            return r;
          }),
      ),
    );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window" });
      if (all.length) await all[0].focus();
      else await self.clients.openWindow("/");
    })(),
  );
});
