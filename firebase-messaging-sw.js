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

// Background notification display and click routing will be
// added after the customer opt-in and secure token flow is ready.
