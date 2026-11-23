// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER FIREBASE PUSH NOTIFICATIONS
// ======================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging.js";

(() => {
  "use strict";

  const firebaseConfig = {
    apiKey: "AIzaSyA5eZTRYMLHYAPrjXVFAmWxG3ou_zOpfdc",
    authDomain: "hafhass-events-and-delights.firebaseapp.com",
    projectId: "hafhass-events-and-delights",
    storageBucket: "hafhass-events-and-delights.firebasestorage.app",
    messagingSenderId: "443494680220",
    appId: "1:443494680220:web:be5a1a7358031235850f59"
  };

  const VAPID_PUBLIC_KEY = "BLrwgg5TNVeLwZDiT5pbCD_HW0JDvu9QfsdDFt__JTWO-yYldRaq_jzZjUJNSAvFeAxDlYUt2cf3NGk249_C8PY";

  const button = document.getElementById("enablePushNotifications");
  const status = document.getElementById("pushPreferencesStatus");

  if (!button || !status) return;

  const buttonLabel = button.querySelector("span");

  function setStatus(message, stateName = "info") {
    status.textContent = message;
    status.dataset.state = stateName;
  }

  function setBusy(busy, label) {
    button.disabled = busy;
    buttonLabel.textContent = label;
  }

  async function enablePushNotifications() {
    if (!window.hafhassSupabase) {
      setStatus("The account connection is not ready. Please refresh and try again.", "error");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("This browser does not support web push notifications.", "error");
      return;
    }

    if (!window.isSecureContext) {
      setStatus("Push notifications require a secure HTTPS connection.", "error");
      return;
    }

    setBusy(true, "Setting up...");

    try {
      const { data: { user }, error: userError } =
        await window.hafhassSupabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please sign in again before enabling notifications.");
      }

      const supported = await isSupported();

      if (!supported) {
        throw new Error("Push notifications are not supported by this browser.");
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "Notifications are blocked in your browser settings. Allow them there, then try again."
            : "Notification permission was not granted."
        );
      }

      const registration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
      );

      await navigator.serviceWorker.ready;

      const messaging = getMessaging(initializeApp(firebaseConfig));

      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        throw new Error("Firebase could not create a device token. Please try again.");
      }

      const { error: saveError } = await window.hafhassSupabase
        .from("push_subscriptions")
        .upsert({
          user_id: user.id,
          token,
          device_label: /Android/i.test(navigator.userAgent)
            ? "Android browser"
            : /iPhone|iPad|iPod/i.test(navigator.userAgent)
              ? "Apple mobile browser"
              : "Web browser",
          user_agent: navigator.userAgent,
          is_active: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: "token" });

      if (saveError) throw saveError;

      setStatus(
        "Push notifications are enabled on this device. You'll receive HAFHASS updates here.",
        "success"
      );
      setBusy(false, "Notifications enabled");
      button.disabled = true;

    } catch (error) {
      console.error("HAFHASS Push Notifications:", error);
      setStatus(error?.message || "We couldn't enable notifications. Please try again.", "error");
      setBusy(false, "Try again");
    }
  }

  button.addEventListener("click", enablePushNotifications);

  if (!("Notification" in window)) {
    button.disabled = true;
    setStatus("This browser does not support push notifications.", "error");
  } else if (Notification.permission === "granted") {
    setStatus("Notifications are already allowed by your browser. Tap the button to register this device.");
    buttonLabel.textContent = "Activate this device";
  } else if (Notification.permission === "denied") {
    setStatus("Notifications are blocked in your browser settings. Allow them there before continuing.", "error");
  }
})();
