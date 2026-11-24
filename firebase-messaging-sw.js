/* ======================================================
   HAFHASS EVENTS & DELIGHTS
   FIREBASE CLOUD MESSAGING SERVICE WORKER
   Root scope: /firebase-messaging-sw.js
====================================================== */

/*
======================================================
NOTIFICATION CLICK HANDLING

Register this listener BEFORE importing Firebase
Messaging. Firebase installs its own notificationclick
listener and stops later listeners from receiving the
event. Registering first lets HAFHASS route the click.
======================================================
*/

self.addEventListener("notificationclick", event => {
  const notificationData = event.notification?.data || {};
  const fcmPayload = notificationData.FCM_MSG || {};
  const data = fcmPayload.data || notificationData;

  const rawUrl =
    data.url ||
    data.action_url ||
    fcmPayload.fcmOptions?.link ||
    fcmPayload.notification?.click_action ||
    "/account/notification.html";

  let target;

  try {
    target = new URL(rawUrl, self.location.origin);
  } catch (error) {
    target = new URL("/account/notification.html", self.location.origin);
  }

  // Prevent Firebase's later click handler from overriding our routing.
  event.stopImmediatePropagation();
  event.notification.close();

  // Never allow a notification to navigate outside the HAFHASS website.
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


/*
======================================================
FIREBASE CLOUD MESSAGING
======================================================
*/

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
