/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   SHARED STORE SETTINGS CONTROLLER
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     1. CONFIGURATION
  ======================================================= */

  const supabase = window.hafhassSupabase;

  const SETTINGS_TABLE = "business_settings";
  const SETTINGS_ID = 1;

  const CACHE_KEY = "hafhass_store_settings";
  const CACHE_DURATION = 60 * 1000; // 1 minute


  /* =======================================================
     2. INTERNAL STATE
  ======================================================= */

  let storeSettings = null;
  let settingsPromise = null;


  /* =======================================================
     3. BASIC HELPERS
  ======================================================= */

  function getElement(selector, parent = document) {

    return parent.querySelector(selector);

  }


  function isValidUrl(value) {

    if (!value || typeof value !== "string") {
      return false;
    }

    try {

      const url = new URL(
        value.startsWith("http://") ||
        value.startsWith("https://")
          ? value
          : `https://${value}`
      );

      return (
        url.protocol === "http:" ||
        url.protocol === "https:"
      );

    } catch {

      return false;

    }

  }


  function normalizeUrl(value) {

    if (!value || typeof value !== "string") {
      return "";
    }

    const cleaned = value.trim();

    if (!cleaned) {
      return "";
    }

    if (!isValidUrl(cleaned)) {
      return "";
    }

    return /^https?:\/\//i.test(cleaned)
      ? cleaned
      : `https://${cleaned}`;

  }


  function getDigits(value) {

    return String(value || "").replace(/\D/g, "");

  }


  function getWhatsAppUrl(number) {

    const digits = getDigits(number);

    if (!digits) {
      return "";
    }

    return `https://wa.me/${digits}`;

  }


  function getTelephoneUrl(number) {

    const cleaned = String(number || "").trim();

    if (!cleaned) {
      return "";
    }

    return `tel:${cleaned.replace(/[^\d+]/g, "")}`;

  }


  function getEmailUrl(email) {

    const cleaned = String(email || "").trim();

    if (!cleaned) {
      return "";
    }

    return `mailto:${cleaned}`;

  }


  /* =======================================================
     4. CACHE MANAGEMENT
  ======================================================= */

  function getCachedSettings() {

    try {

      const cached = sessionStorage.getItem(CACHE_KEY);

      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);

      if (!parsed.timestamp || !parsed.data) {
        return null;
      }

      const age = Date.now() - parsed.timestamp;

      if (age > CACHE_DURATION) {

        sessionStorage.removeItem(CACHE_KEY);

        return null;

      }

      return parsed.data;

    } catch (error) {

      console.warn(
        "Store settings cache could not be read:",
        error
      );

      return null;

    }

  }


  function saveCachedSettings(data) {

    try {

      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          data
        })
      );

    } catch (error) {

      console.warn(
        "Store settings could not be cached:",
        error
      );

    }

  }


  function clearSettingsCache() {

    try {

      sessionStorage.removeItem(CACHE_KEY);

    } catch (error) {

      console.warn(
        "Store settings cache could not be cleared:",
        error
      );

    }

  }


  /* =======================================================
     5. FETCH SETTINGS
  ======================================================= */

  async function fetchSettings(forceRefresh = false) {

    if (!supabase) {

      throw new Error(
        "Supabase client is not available. Check supabase-config.js."
      );

    }


    if (!forceRefresh && storeSettings) {
      return storeSettings;
    }


    if (!forceRefresh) {

      const cached = getCachedSettings();

      if (cached) {

        storeSettings = cached;

        return cached;

      }

    }


    if (settingsPromise) {
      return settingsPromise;
    }


    settingsPromise = (async () => {

      const { data, error } = await supabase
        .from(SETTINGS_TABLE)
        .select("*")
        .eq("id", SETTINGS_ID)
        .maybeSingle();


      if (error) {

        throw error;

      }


      if (!data) {

        throw new Error(
          "Business settings record was not found."
        );

      }


      storeSettings = data;

      saveCachedSettings(data);

      return data;

    })();


    try {

      return await settingsPromise;

    } finally {

      settingsPromise = null;

    }

  }


  /* =======================================================
     6. TEXT CONTENT
  ======================================================= */

  function applyTextSettings(settings) {

    document.querySelectorAll("[data-store]").forEach(element => {

      const key = element.dataset.store;

      if (!key || !(key in settings)) {
        return;
      }

      const value = settings[key];

      if (value === null || value === undefined) {
        return;
      }

      element.textContent = String(value);

    });

  }


  /* =======================================================
     7. IMAGE SETTINGS
  ======================================================= */

  function getLogoFallback(image) {

    // Prefer an explicitly marked fallback, then support the
    // existing public-page .brand-mark structure.
    const container = image.parentElement;

    if (container) {

      const fallback = container.querySelector(
        "[data-store-logo-fallback], .brand-mark"
      );

      if (fallback) {
        return fallback;
      }

    }

    const brand = image.closest(
      ".brand, .auth-brand-logo, .auth-mobile-brand, .account-brand, .admin-brand"
    );

    return brand?.querySelector(
      "[data-store-logo-fallback], .brand-mark"
    ) || null;

  }


  function setLogoFallback(image, showFallback) {

    const fallback = getLogoFallback(image);

    if (fallback) {
      fallback.hidden = showFallback ? false : true;
    }

    image.hidden = showFallback;

  }


  function applyImageSettings(settings) {

    document.querySelectorAll("[data-store-image]").forEach(element => {

      const key = element.dataset.storeImage;

      if (!key || !(key in settings)) {
        return;
      }

      const imageUrl = normalizeUrl(settings[key]);

      if (element.tagName === "IMG") {

        // Preserve the original page image as the fallback for all
        // configurable content images.
        if (!element.dataset.storeFallbackSrc) {
          element.dataset.storeFallbackSrc =
            element.getAttribute("src") || "";
        }

        const fallbackSrc = element.dataset.storeFallbackSrc;

        if (key !== "logo_url") {

          if (!imageUrl) {
            if (fallbackSrc && element.getAttribute("src") !== fallbackSrc) {
              element.src = fallbackSrc;
            }
            return;
          }

          element.onerror = () => {
            if (fallbackSrc) {
              element.onerror = null;
              element.src = fallbackSrc;
            }
          };

          element.src = imageUrl;
          return;
        }

        if (!imageUrl) {
          element.removeAttribute("src");
          setLogoFallback(element, true);
          return;
        }

        // Keep the H fallback visible until the logo has loaded.
        element.hidden = true;

        const fallback = getLogoFallback(element);
        if (fallback) fallback.hidden = false;

        element.onload = () => setLogoFallback(element, false);
        element.onerror = () => setLogoFallback(element, true);

        if (element.src !== imageUrl) {
          element.src = imageUrl;
        } else if (element.complete) {
          setLogoFallback(element, element.naturalWidth <= 0);
        }

      } else if (
        element.tagName === "LINK" &&
        element.rel.toLowerCase().includes("icon")
      ) {

        if (imageUrl) {
          element.href = imageUrl;
        }

      } else if (imageUrl) {

        element.style.backgroundImage =
          `url("${imageUrl.replace(/"/g, "%22")}")`;

      } else {

        element.style.backgroundImage = "";

      }

    });

  }


  function applyBackgroundImageSettings(settings) {

    document.querySelectorAll("[data-store-background]").forEach(element => {

      const key = element.dataset.storeBackground;
      if (!key || !(key in settings)) return;

      const imageUrl = normalizeUrl(settings[key]);

      if (!imageUrl) {
        element.style.removeProperty("--store-background-image");
        delete element.dataset.storeBackgroundActive;
        return;
      }

      // Preload first so an unavailable custom URL never replaces
      // the original CSS/gradient fallback with a broken background.
      const preload = new Image();

      preload.onload = () => {
        element.style.setProperty(
          "--store-background-image",
          `url("${imageUrl.replace(/"/g, "%22")}")`
        );
        element.dataset.storeBackgroundActive = "true";
      };

      preload.onerror = () => {
        element.style.removeProperty("--store-background-image");
        delete element.dataset.storeBackgroundActive;
      };

      preload.src = imageUrl;

    });

  }


  /* =======================================================
     8. FAVICON
  ======================================================= */

  function applyFavicon(settings) {

    const faviconUrl = normalizeUrl(
      settings.favicon_url
    );

    if (!faviconUrl) {
      return;
    }


    let favicon = getElement(
      'link[rel="icon"]'
    );


    if (!favicon) {

      favicon = document.createElement("link");

      favicon.rel = "icon";

      document.head.appendChild(favicon);

    }


    favicon.href = faviconUrl;

  }


  /* =======================================================
     9. CONTACT LINKS
  ======================================================= */

  function getStoreLink(key, settings) {

    const value = settings[key];

    if (!value) {
      return "";
    }


    switch (key) {

      case "phone":
        return getTelephoneUrl(value);


      case "email":
        return getEmailUrl(value);


      case "whatsapp_number":
        return getWhatsAppUrl(value);


      default:
        return normalizeUrl(value);

    }

  }


  function applyLinkSettings(settings) {

    document.querySelectorAll("[data-store-href]").forEach(element => {

      const key = element.dataset.storeHref;

      if (!key || !(key in settings)) {
        return;
      }


      const href = getStoreLink(key, settings);

      if (!href) {
        return;
      }


      element.setAttribute("href", href);


      if (href.startsWith("https://")) {

        element.setAttribute(
          "target",
          "_blank"
        );

        element.setAttribute(
          "rel",
          "noopener noreferrer"
        );

      }

    });

  }
  
  
  /* =======================================================
   SOCIAL MEDIA LINKS
======================================================= */

function applySocialLinks(settings) {

  const socialLinks = settings.social_links || {};

  console.log(
    "HAFHASS: Social links received from database:",
    socialLinks
  );

  document.querySelectorAll("[data-store-social]").forEach(element => {

    const key = element.dataset.storeSocial;
    const url = normalizeUrl(socialLinks[key]);

    console.log(
      `HAFHASS: ${key}:`,
      url || "No URL found"
    );

    if (!url) {

      element.hidden = true;

      return;

    }

    element.href = url;
    element.hidden = false;

  });

}


  /* =======================================================
     10. BRAND COLOURS
  ======================================================= */

  /* =======================================================
   10. BRAND COLOURS
======================================================= */

function normalizeHexColour(value, fallback) {

  if (typeof value !== "string") return fallback;

  let colour = value.trim();

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(colour)) {
    return fallback;
  }

  if (colour.length === 4) {
    colour = "#" + colour.slice(1).split("").map(char => char + char).join("");
  }

  return colour.toUpperCase();

}


function mixHexColours(first, second, amount) {

  const a = first.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
  const b = second.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));

  const mixed = a.map((value, index) =>
    Math.round(value + (b[index] - value) * amount)
  );

  return "#" + mixed.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase();

}


function colourToRgba(hex, alpha) {

  const value = hex.slice(1);

  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;

}


function applyBrandColours(settings) {

  const root = document.documentElement;
  const isDark = root.dataset.theme === "dark";

  const primary = normalizeHexColour(settings.brand_primary_color, "#702D43");
  const secondary = normalizeHexColour(settings.brand_secondary_color, "#E8B8C3");
  const accent = normalizeHexColour(settings.brand_accent_color, "#C6A46A");

  // Keep the saved brand colours available as the single source of truth.
  const primaryOnSurface = isDark
    ? mixHexColours(primary, "#FFFFFF", 0.62)
    : primary;

  const primaryHover = isDark
    ? mixHexColours(primary, "#FFFFFF", 0.72)
    : mixHexColours(primary, "#000000", 0.18);

  const interactiveAccent = isDark
    ? mixHexColours(primary, "#FFFFFF", 0.48)
    : primary;

  const softSecondary = isDark
    ? mixHexColours(secondary, "#241E24", 0.35)
    : mixHexColours(secondary, "#FFFFFF", 0.72);

  const values = {

    "--brand-primary": primary,
    "--brand-secondary": secondary,
    "--brand-accent": accent,

    "--burgundy": primary,
    "--blush": secondary,
    "--gold": accent,
    "--rose": softSecondary,

    "--heading": primaryOnSurface,
    "--accent": interactiveAccent,
    "--accent-hover": primaryHover,
    "--border": colourToRgba(primary, isDark ? 0.24 : 0.13),

    "--account-primary": primaryOnSurface,
    "--account-primary-hover": primaryHover,
    "--account-accent": secondary,
    "--account-gold": accent,

    "--auth-burgundy": primaryOnSurface,
    "--auth-blush": secondary,
    "--auth-gold": accent,
    "--auth-rose": softSecondary,
    "--auth-primary": primaryOnSurface,
    "--auth-primary-hover": primaryHover

  };

  Object.entries(values).forEach(([variable, value]) => {
    root.style.setProperty(variable, value);
  });

}


  /* =======================================================
     11. ANNOUNCEMENT BAR
  ======================================================= */

  function renderAnnouncement(settings) {

    const containers = document.querySelectorAll(
      "[data-store-announcement]"
    );


    containers.forEach(container => {

      container.innerHTML = "";


      if (!settings.announcement_enabled) {

        container.hidden = true;

        return;

      }


      const announcementText =
        settings.announcement_text || "";


      if (!announcementText.trim()) {

        container.hidden = true;

        return;

      }


      container.hidden = false;


      const wrapper = document.createElement("div");

      wrapper.className = "store-announcement";


      const message = document.createElement("span");

      message.className = "store-announcement-text";

      message.textContent = announcementText;


      wrapper.appendChild(message);


      const announcementLink = normalizeUrl(
        settings.announcement_link
      );


      if (announcementLink) {

        const link = document.createElement("a");

        link.className = "store-announcement-link";

        link.href = announcementLink;

        link.target = "_blank";

        link.rel = "noopener noreferrer";

        link.textContent = "Learn More";


        wrapper.appendChild(link);

      }


      container.appendChild(wrapper);

    });

  }


  /* =======================================================
     12. APPLY ALL SETTINGS
  ======================================================= */

  function applySettings(settings) {

  if (!settings) {
    return;
  }

  applyTextSettings(settings);

  applyImageSettings(settings);

  applyBackgroundImageSettings(settings);

  applyFavicon(settings);

  applyLinkSettings(settings);

  applySocialLinks(settings);

  applyBrandColours(settings);

  renderAnnouncement(settings);

  document.documentElement.dataset.storeSettingsLoaded =
    "true";

  document.dispatchEvent(
    new CustomEvent("hafhass:settings-loaded", {
      detail: settings
    })
  );

}


  /* =======================================================
     13. CURRENCY FORMATTER
  ======================================================= */

  function formatCurrency(amount, options = {}) {

    const settings = storeSettings || {};

    const currency = settings.currency || "NGN";


    const locale = options.locale ||
      (currency === "NGN" ? "en-NG" : "en");


    const numericAmount = Number(amount);


    if (!Number.isFinite(numericAmount)) {
      return "";
    }


    try {

      return new Intl.NumberFormat(locale, {

        style: "currency",

        currency,

        minimumFractionDigits:
          options.minimumFractionDigits ?? 2,

        maximumFractionDigits:
          options.maximumFractionDigits ?? 2

      }).format(numericAmount);

    } catch (error) {

      console.error(
        "Currency formatting failed:",
        error
      );

      return `${currency} ${numericAmount.toFixed(2)}`;

    }

  }


  /* =======================================================
     14. PUBLIC API
  ======================================================= */

  window.HafhassStoreSettings = {

    get() {

      return storeSettings;

    },


    async ready() {

      const settings = await fetchSettings();

      applySettings(settings);

      return settings;

    },


    async refresh() {

      clearSettingsCache();

      storeSettings = null;

      settingsPromise = null;


      const settings = await fetchSettings(true);

      applySettings(settings);

      return settings;

    },


    formatCurrency,


    getWhatsAppUrl,


    getTelephoneUrl,


    getEmailUrl,


    getLink(key) {

      if (!storeSettings) {
        return "";
      }

      return getStoreLink(key, storeSettings);

    },


    clearCache: clearSettingsCache

  };


  /* =======================================================
     15. INITIALISE
  ======================================================= */

  async function initialiseStoreSettings() {

    try {

      await window.HafhassStoreSettings.ready();

    } catch (error) {

      console.error(
        "Store settings could not be initialised:",
        error
      );

    }

  }


  // Recalculate brand shades whenever the user switches light/dark mode.
  const brandThemeObserver = new MutationObserver(() => {
    if (storeSettings) {
      applyBrandColours(storeSettings);
    }
  });

  brandThemeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"]
  });


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initialiseStoreSettings
    );

  } else {

    initialiseStoreSettings();

  }


  /* =======================================================
     16. SHARED FLOATING CONTACT WIDGET
     Loaded on public and customer pages only.
  ======================================================= */

  if (!/(^|\/)admin(\/|$)/i.test(window.location.pathname)) {
    const accountPage = /(^|\/)account(\/|$)/i.test(window.location.pathname);
    const contactWidgetScript = document.createElement("script");
    contactWidgetScript.src = (accountPage ? "../" : "") + "js/contact-widget.js";
    contactWidgetScript.defer = true;
    document.head.appendChild(contactWidgetScript);
  }


})();