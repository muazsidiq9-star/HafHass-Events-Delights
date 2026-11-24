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

/*
======================================================
BACKGROUND NOTIFICATION DISPLAY

Firebase automatically displays background messages
that contain a notification payload.

Do not call showNotification() here. Doing so would
display the same message a second time.
======================================================
*/

/*
======================================================
NOTIFICATION CLICK HANDLING

Preserved for the next investigation task. We will
review its interaction with Firebase's own click
handler separately.
======================================================
*/

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
