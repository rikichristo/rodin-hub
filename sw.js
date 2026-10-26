/* Rodin Hub service worker: shows reminder notifications and opens the right page. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (_) { m = { title: "Rodin Hub", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(m.title || "Rodin Hub", { body: m.body || "", icon: "img/icon.png", badge: "img/icon.png", tag: m.tag || "rh", renotify: true, data: { url: m.url || "./" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { await c.focus(); if ("navigate" in c) { try { await c.navigate(url); } catch (_) {} } return; } }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
