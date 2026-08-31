const SERVICE_WORKER_VERSION = "bioana-pwa-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch {
    payload = {
      notification: {
        body: event.data.text(),
      },
    };
  }

  const notification =
    payload.notification || {};

  const data = payload.data || {};

  const title =
    notification.title ||
    data.title ||
    "Bioana Prototyping Lab";

  const options = {
    body:
      notification.body ||
      data.body ||
      "Tienes una nueva notificación.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url:
        data.url ||
        payload.fcmOptions?.link ||
        "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options,
    ),
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const destination =
      event.notification.data?.url || "/";

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((windows) => {
          const existingWindow =
            windows.find(
              (windowClient) =>
                "focus" in windowClient,
            );

          if (existingWindow) {
            existingWindow.navigate(destination);
            return existingWindow.focus();
          }

          return self.clients.openWindow(
            destination,
          );
        }),
    );
  },
);