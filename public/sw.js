// GrowMyPin service worker: shows notifications you send from the admin panel.
// Clicking a notification opens the site and the message pops up.

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "GrowMyPin";
  var opts = {
    body: d.body || "You have a new message.",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: d.tag || "gmp",
    renotify: true,
    data: { url: d.url || "/" }
  };
  if (d.image) opts.image = d.image;
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async function () {
    var all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (var i = 0; i < all.length; i++) {
      var c = all[i];
      if (new URL(c.url).origin === self.location.origin) {
        try { await c.focus(); } catch (err) {}
        c.postMessage({ type: "gmp-open", url: url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
