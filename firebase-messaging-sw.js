/* ======================================================
   HAFHASS EVENTS & DELIGHTS
   FIREBASE CLOUD MESSAGING SERVICE WORKER
   Root scope: /firebase-messaging-sw.js
====================================================== */

importScripts(
  "https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyA5eZTRYMLHYAPrjXVFAmWxG3ou_zOpfdc",
  authDomain: "hafhass-events-and-delights.firebaseapp.com",
  projectId: "hafhass-events-and-delights",
  storageBucket: "hafhass-events-and-delights.firebasestorage.app",
  messagingSenderId: "443494680220",
  appId: "1:443494680220:web:be5a1a7358031235850f59"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "HAFHASS Events & Delights";

  const options = {
    body: notification.body || data.body || "You have a new update from HAFHASS.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: {
      url: data.url || data.action_url || "/account/notification.html"
    }
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "/account/notification.html",
    self.location.origin
  );

  if (target.origin !== self.location.origin) {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(target.href);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(target.href);
        }

        return undefined;
      })
  );
});
