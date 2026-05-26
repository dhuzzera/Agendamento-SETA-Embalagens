// Service Worker — Push Notification Handler
// Este arquivo é importado pelo SW gerado pelo vite-plugin-pwa via importScripts

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "SETA Embalagens", body: event.data.text() };
  }

  const title = data.title || "SETA Embalagens";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    tag: data.tag || "seta-notification",
    renotify: true,
    data: {
      url: data.url || "/agendamento",
    },
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Dispensar" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/agendamento";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se já tem uma aba aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Senão, abre uma nova
      return clients.openWindow(url);
    }),
  );
});
