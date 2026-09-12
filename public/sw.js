self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { message: event.data ? event.data.text() : "" }; }
  const title = data.title || "🎱 8 BALL እጣ";
  const options = { body: data.message || data.body || "አዲስ ማስታወቂያ አለ።", icon: "/icon-192.png", badge: "/icon-192.png", data: { url: data.url || "/" } };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(clients.matchAll({type:"window", includeUncontrolled:true}).then(list => {
    for (const c of list) if ("focus" in c) { c.focus(); if ("navigate" in c) c.navigate(url); return; }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
