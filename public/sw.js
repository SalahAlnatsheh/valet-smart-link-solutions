self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};
  const title = data.title || "Car ready";
  const options = {
    body: data.body || "Your car is ready for pickup.",
    icon: data.icon || "/favicon.ico",
    tag: data.tag || "valet-ready",
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || event.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
