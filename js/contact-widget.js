/* =========================================================
   HAFHASS FLOATING CONTACT WIDGET
   Draggable, edge-docking contact button for public/account pages.
========================================================= */

(() => {
  "use strict";

  if (window.HafhassContactWidgetLoaded) return;
  window.HafhassContactWidgetLoaded = true;

  const scriptElement = document.currentScript;
  const scriptURL = scriptElement?.src || new URL("js/contact-widget.js", window.location.href).href;
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("../css/contact-widget.css", scriptURL).href;
  document.head.appendChild(stylesheet);

  const POSITION_KEY = "hafhass-contact-position-v1";
  const EDGE_GAP = 0;
  const PEEK_DISTANCE = 34;
  const BUTTON_SIZE = 58;

  const icons = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.2 1.6 6L0 24l6.4-1.7a11.8 11.8 0 0 0 5.7 1.4h.1C18.7 23.7 24 18.4 24 11.9c0-3.2-1.2-6.2-3.5-8.4ZM12.1 21.7a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 1 1 8.4 4.7Zm5.4-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.2 1l-2.3 2.2Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7l4.9 4.9-4.9 4.9 1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm-2 11H6v-2h12v2Zm0-4H6V7h12v2Z"/></svg>'
  };

  function getContactLinks() {
    const api = window.HafhassStoreSettings;
    if (!api || typeof api.getLink !== "function") return [];
    const links = [];
    const whatsapp = api.getLink("whatsapp_number");
    const phone = api.getLink("phone");
    const email = api.getLink("email");

    if (whatsapp) {
      const message = "Hello HAFHASS Events & Delights! I would like to make an enquiry.";
      links.push({
        key: "whatsapp",
        label: "Chat on WhatsApp",
        href: whatsapp + (whatsapp.includes("?") ? "&" : "?") + "text=" + encodeURIComponent(message),
        icon: icons.whatsapp
      });
    }
    if (phone) links.push({ key: "phone", label: "Call Us", href: phone, icon: icons.phone });
    if (email) links.push({ key: "email", label: "Send an Email", href: email, icon: icons.email });
    return links;
  }

  function renderLinks(container) {
    container.innerHTML = "";
    const links = getContactLinks();
    if (!links.length) {
      const note = document.createElement("p");
      note.className = "hafhass-contact-empty";
      note.textContent = "Our contact options are currently unavailable. Please try again shortly.";
      container.appendChild(note);
      return;
    }
    links.forEach(item => {
      const link = document.createElement("a");
      link.className = "hafhass-contact-link hafhass-contact-link-" + item.key;
      link.href = item.href;
      link.innerHTML = item.icon + "<span>" + item.label + "</span>";
      if (item.key === "whatsapp" || item.key === "email") {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
      container.appendChild(link);
    });
  }

  function readPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
      if (saved && (saved.side === "left" || saved.side === "right") && Number.isFinite(saved.yRatio)) return saved;
    } catch (_) {}
    return { side: "right", yRatio: 0.72 };
  }

  function savePosition(side, y) {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify({
        side,
        yRatio: Math.max(0, Math.min(1, y / Math.max(1, window.innerHeight)))
      }));
    } catch (_) {}
  }

  function initialise() {
    if (document.getElementById("hafhassContactWidget")) return;

    const widget = document.createElement("div");
    widget.id = "hafhassContactWidget";
    widget.className = "hafhass-contact-widget";
    widget.innerHTML =
      '<section class="hafhass-contact-panel" id="hafhassContactPanel" aria-label="Contact HAFHASS" aria-hidden="true">' +
        '<div class="hafhass-contact-panel-heading">' +
          '<div><span class="hafhass-contact-eyebrow">WE WOULD LOVE TO HEAR FROM YOU</span><h2>Let’s talk!</h2></div>' +
          '<button class="hafhass-contact-close" type="button" aria-label="Close contact options">' + icons.close + '</button>' +
        '</div>' +
        '<p class="hafhass-contact-intro">Choose how you would like to get in touch with us.</p>' +
        '<div class="hafhass-contact-options" id="hafhassContactOptions"></div>' +
      '</section>' +
      '<button class="hafhass-contact-trigger" type="button" aria-label="Open contact options" aria-expanded="false" aria-controls="hafhassContactPanel">' +
        '<span class="hafhass-contact-trigger-icon">' + icons.chat + '</span>' +
      '</button>';
    document.body.appendChild(widget);

    const trigger = widget.querySelector(".hafhass-contact-trigger");
    const panel = widget.querySelector(".hafhass-contact-panel");
    const close = widget.querySelector(".hafhass-contact-close");
    const options = widget.querySelector("#hafhassContactOptions");
    let side = "right";
    let currentY = Math.round(window.innerHeight * 0.72);
    let pointerStart = null;
    let dragged = false;
    let suppressClick = false;

    function clampY(y) {
      const half = BUTTON_SIZE / 2;
      return Math.max(half + 8, Math.min(window.innerHeight - half - 8, y));
    }

    function applyPosition() {
      currentY = clampY(currentY);
      widget.style.top = currentY + "px";
      widget.classList.toggle("is-docked-left", side === "left");
      widget.classList.toggle("is-docked-right", side === "right");
      widget.classList.toggle("panel-below", currentY < 310);
    }

    function setOpen(open) {
      widget.classList.toggle("is-open", open);
      widget.classList.toggle("is-peeking", !open);
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-label", open ? "Close contact options" : "Open contact options");
      panel.setAttribute("aria-hidden", String(!open));
    }

    const saved = readPosition();
    side = saved.side;
    currentY = clampY(saved.yRatio * window.innerHeight);
    applyPosition();
    setOpen(false);

    trigger.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      pointerStart = { x: event.clientX, y: event.clientY, startY: currentY };
      dragged = false;
      trigger.setPointerCapture?.(event.pointerId);
      widget.classList.add("is-interacting");
    });

    trigger.addEventListener("pointermove", event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      if (!dragged && Math.hypot(dx, dy) > 7) dragged = true;
      if (!dragged) return;
      currentY = clampY(pointerStart.startY + dy);
      widget.style.top = currentY + "px";
      widget.classList.add("is-dragging");
    });

    function finishDrag(event) {
      if (!pointerStart) return;
      if (dragged) {
        side = event.clientX < window.innerWidth / 2 ? "left" : "right";
        currentY = clampY(currentY);
        savePosition(side, currentY);
        applyPosition();
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 0);
      }
      pointerStart = null;
      dragged = false;
      widget.classList.remove("is-dragging", "is-interacting");
    }

    trigger.addEventListener("pointerup", finishDrag);
    trigger.addEventListener("pointercancel", finishDrag);
    trigger.addEventListener("lostpointercapture", finishDrag);

    trigger.addEventListener("click", event => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setOpen(!widget.classList.contains("is-open"));
    });

    close.addEventListener("click", () => setOpen(false));
    document.addEventListener("click", event => {
      if (!widget.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") setOpen(false);
    });

    window.addEventListener("resize", () => {
      currentY = clampY(currentY);
      applyPosition();
      savePosition(side, currentY);
    });

    renderLinks(options);
    document.addEventListener("hafhass:settings-loaded", () => renderLinks(options));
    window.addEventListener("pageshow", () => renderLinks(options));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise, { once: true });
  } else {
    initialise();
  }
})();
