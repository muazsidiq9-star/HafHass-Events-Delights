// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER ACCOUNT LAYOUT
// Shared interface functionality
// ======================================================

// ======================================================
// CUSTOMER NOTIFICATIONS: BELL, SIDEBAR LINK, UNREAD COUNT
//
// Adds the bell to the header on every account page and gives
// the sidebar "Notification" link (added by hand in each page)
// its unread count. It sits before the layout code below on
// purpose, so the bell exists before the layout starts.
// ======================================================

(() => {
  "use strict";

  if (window.HafhassNotifications) {
    return;
  }

  // ====================================================
  // DEPENDENCIES
  // ====================================================

  const supabase = window.hafhassSupabase;

  if (!supabase) {

    console.warn(
      "HAFHASS Notifications: The Supabase client is unavailable."
    );

    return;

  }


  // ====================================================
  // SETTINGS
  // ====================================================

  const NOTIFICATIONS_PAGE = "notification.html";
  const FALLBACK_REFRESH_MS = 60000;


  // ====================================================
  // STATE
  // ====================================================

  let userId = null;
  let unreadCount = 0;
  let channel = null;
  let refreshTimer = null;

  const elements = {
    bell: null,
    bellBadge: null,
    navLink: null,
    navBadge: null
  };


  // ====================================================
  // HELPERS
  // ====================================================

  function isNotificationsPage() {

    return window.location.pathname.endsWith(
      `/${NOTIFICATIONS_PAGE}`
    );

  }


  function createIcon(classes) {

    const icon = document.createElement("i");

    icon.className = classes;
    icon.setAttribute("aria-hidden", "true");

    return icon;

  }


  // ====================================================
  // BELL AND SIDEBAR LINK
  // ====================================================

  function injectBell() {

    if (document.getElementById("accountNotificationBell")) {

      elements.bell = document.getElementById(
        "accountNotificationBell"
      );

      elements.bellBadge = document.getElementById(
        "accountNotificationBadge"
      );

      return;

    }

    const actions = document.querySelector(
      ".account-header-actions"
    );

    if (!actions) {
      return;
    }

    const bell = document.createElement("a");

    bell.href = NOTIFICATIONS_PAGE;
    bell.id = "accountNotificationBell";
    bell.className = "account-notification-bell";
    bell.setAttribute("aria-label", "Notifications");

    if (isNotificationsPage()) {
      bell.classList.add("is-current");
      bell.setAttribute("aria-current", "page");
    }

    bell.appendChild(createIcon("fa-regular fa-bell"));

    const badge = document.createElement("span");

    badge.id = "accountNotificationBadge";
    badge.className = "account-notification-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.hidden = true;

    bell.appendChild(badge);

    const themeToggle = document.getElementById("themeToggle");

    if (themeToggle && themeToggle.parentNode === actions) {
      actions.insertBefore(bell, themeToggle);
    } else {
      actions.prepend(bell);
    }

    elements.bell = bell;
    elements.bellBadge = badge;

  }


  // The sidebar link is added by hand in each page, so it matches
  // the other links. This only gives that link its unread count and
  // marks it active on the notification page.

  function setUpNavLink() {

    const navigation = document.querySelector(
      ".account-navigation"
    );

    if (!navigation) {
      return;
    }

    const link = navigation.querySelector(
      `a[href$="${NOTIFICATIONS_PAGE}"]`
    );

    if (!link) {
      return;
    }

    if (isNotificationsPage()) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    let badge = link.querySelector(".account-nav-badge");

    if (!badge) {

      badge = document.createElement("span");

      badge.className = "account-nav-badge";
      badge.hidden = true;

      link.appendChild(badge);

    }

    elements.navLink = link;
    elements.navBadge = badge;

  }


  // ====================================================
  // UNREAD COUNT
  // ====================================================

  function renderCount(count, animate = false) {

    unreadCount = count;

    const label = count > 99 ? "99+" : String(count);

    [elements.bellBadge, elements.navBadge].forEach(badge => {

      if (!badge) {
        return;
      }

      badge.hidden = count <= 0;
      badge.textContent = count > 0 ? label : "";

    });

    if (elements.bell) {

      elements.bell.setAttribute(
        "aria-label",
        count > 0
          ? `Notifications, ${count} unread`
          : "Notifications"
      );

    }

    if (animate && elements.bellBadge && count > 0) {

      elements.bellBadge.classList.remove("is-new");

      // Restart the animation.
      void elements.bellBadge.offsetWidth;

      elements.bellBadge.classList.add("is-new");

    }

  }


  async function refresh() {

    if (!userId) {
      return;
    }

    try {

      // Always filter by user: admins can read every
      // customer's notifications.

      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) {
        throw error;
      }

      const newCount = count || 0;

      renderCount(newCount, newCount > unreadCount);

    } catch (error) {

      console.warn(
        "HAFHASS Notifications: Could not load the unread count.",
        error?.message || error
      );

    }

  }


  function scheduleRefresh() {

    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(refresh, 150);

  }


  // ====================================================
  // LIVE UPDATES
  // ====================================================

  function unsubscribe() {

    if (channel) {

      supabase.removeChannel(channel);

      channel = null;

    }

  }


  function subscribe() {

    unsubscribe();

    if (!userId) {
      return;
    }

    try {

      channel = supabase
        .channel(`account-notification-badge-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`
          },
          scheduleRefresh
        )
        .subscribe();

    } catch (error) {

      console.warn(
        "HAFHASS Notifications: Live updates are unavailable.",
        error?.message || error
      );

    }

  }


  function setUser(newUserId) {

    if (newUserId === userId) {
      return;
    }

    userId = newUserId;

    if (!userId) {

      unsubscribe();
      renderCount(0);

      return;

    }

    subscribe();
    refresh();

  }


  // ====================================================
  // START
  // ====================================================

  async function start() {

    injectBell();
    setUpNavLink();

    try {

      const { data } = await supabase.auth.getSession();

      setUser(data?.session?.user?.id || null);

    } catch (error) {

      console.warn(
        "HAFHASS Notifications: Could not read the session.",
        error?.message || error
      );

    }

    // Never call Supabase directly inside this callback.

    supabase.auth.onAuthStateChange((event, session) => {

      setTimeout(() => {
        setUser(session?.user?.id || null);
      }, 0);

    });

    // The notifications page tells us when something is read.

    window.addEventListener(
      "hafhass:notifications-changed",
      scheduleRefresh
    );

    // Catch up when the customer returns to this tab.

    document.addEventListener("visibilitychange", () => {

      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }

    });

    // Safety net in case live updates are not connected.

    setInterval(() => {

      if (document.visibilityState === "visible") {
        refresh();
      }

    }, FALLBACK_REFRESH_MS);

  }


  window.HafhassNotifications = {
    refresh,
    getUnreadCount: () => unreadCount
  };


  if (document.readyState === "loading") {

    document.addEventListener("DOMContentLoaded", start);

  } else {

    start();

  }

})();


(() => {
  "use strict";

  function initializeAccountLayout() {

    // ==================================================
    // ELEMENTS
    // ==================================================

    const menuToggle = document.getElementById("accountMenuToggle");
    const sidebar = document.getElementById("accountSidebar");
    const overlay = document.getElementById("accountSidebarOverlay");

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = themeToggle?.querySelector(".theme-icon");

    const logoutButton = document.getElementById("logoutButton");
    const yearElement = document.getElementById("accountYear");

    const cartCountElement = document.getElementById("accountCartCount");


    // ==================================================
    // SHARED CUSTOMER PROFILE AVATAR
    // ==================================================

    async function loadSidebarProfile() {
      const avatar = document.getElementById("accountAvatar");
      const initialsLabel = document.getElementById("avatarInitials");
      const photo = avatar?.querySelector(".avatar-photo");
      if (!avatar || !initialsLabel || !photo) return;

      try {
        const auth = window.HafhassAuth;
        if (!auth || typeof auth.getProfile !== "function") return;
        const result = await auth.getProfile();
        if (!result?.success || !result.profile) return;

        const profile = result.profile;
        const name = profile.full_name ||
          profile.name ||
          document.getElementById("sidebarUserName")?.textContent ||
          "Customer";
        const initials = name.trim().split(/\\s+/).slice(0, 2)
          .map(part => part.charAt(0).toUpperCase()).join("") || "C";

        initialsLabel.textContent = initials;
        initialsLabel.hidden = !!profile.avatar_url;
        photo.hidden = !profile.avatar_url;
        if (profile.avatar_url) photo.src = profile.avatar_url;
        else photo.removeAttribute("src");
      } catch (error) {
        console.warn("HAFHASS: Unable to load the sidebar profile photo.", error?.message || error);
      }
    }


    loadSidebarProfile();


    // ==================================================
    // THEME MANAGEMENT
    // ==================================================

    const THEME_KEY = "hafhass-theme";

    function getPreferredTheme() {

      try {

        const savedTheme = localStorage.getItem(THEME_KEY);

        if (savedTheme === "light" || savedTheme === "dark") {
          return savedTheme;
        }

      } catch (error) {
        console.warn("HAFHASS: Theme preference unavailable.");
      }

      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }


    function updateThemeIcon(theme) {

      if (!themeIcon) return;

      // Use Font Awesome classes instead of textContent.
      // This prevents duplicate moon/sun icons.

      if (themeIcon.tagName.toLowerCase() === "i") {

        themeIcon.classList.remove(
          "fa-regular",
          "fa-solid",
          "fa-moon",
          "fa-sun"
        );

        if (theme === "dark") {

          themeIcon.classList.add(
            "fa-solid",
            "fa-sun"
          );

        } else {

          themeIcon.classList.add(
            "fa-regular",
            "fa-moon"
          );

        }

      } else {

        // Fallback for non-icon markup.

        themeIcon.textContent =
          theme === "dark" ? "☀" : "☾";

      }

    }


    function applyTheme(theme) {

      const selectedTheme =
        theme === "dark" ? "dark" : "light";

      document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
      );

      document.body.setAttribute(
        "data-theme",
        selectedTheme
      );

      updateThemeIcon(selectedTheme);

      if (themeToggle) {

        themeToggle.setAttribute(
          "aria-label",
          selectedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme"
        );

        themeToggle.setAttribute(
          "aria-pressed",
          selectedTheme === "dark" ? "true" : "false"
        );

      }

      try {

        localStorage.setItem(
          THEME_KEY,
          selectedTheme
        );

      } catch (error) {

        console.warn(
          "HAFHASS: Unable to save theme preference."
        );

      }

    }


    applyTheme(getPreferredTheme());


    if (themeToggle) {

      themeToggle.addEventListener("click", () => {

        const currentTheme =
          document.documentElement.getAttribute("data-theme");

        applyTheme(
          currentTheme === "dark" ? "light" : "dark"
        );

      });

    }


    // ==================================================
    // CUSTOMER CART COUNTER
    // ==================================================

    async function loadCartCount() {

      if (!cartCountElement) return;

      try {

        const supabase = window.hafhassSupabase;
        const auth = window.HafhassAuth;

        if (!supabase || !auth) {
          throw new Error(
            "Cart dependencies are unavailable."
          );
        }


        // Get the authenticated customer.

        const userResult = await auth.getCurrentUser();

        const currentUser =
          userResult?.user ||
          userResult?.data?.user ||
          null;


        if (!currentUser?.id) {

          cartCountElement.textContent = "0";

          return;

        }


        // Find the customer's latest active cart.

        const { data: cart, error: cartError } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("status", "active")
          .order("created_at", {
            ascending: false
          })
          .limit(1)
          .maybeSingle();


        if (cartError) {
          throw cartError;
        }


        // No active cart means an empty cart.

        if (!cart) {

          cartCountElement.textContent = "0";

          return;

        }


        // Get the quantities of all items in the active cart.

        const { data: cartItems, error: itemsError } = await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", cart.id);


        if (itemsError) {
          throw itemsError;
        }


        const totalQuantity = (cartItems || []).reduce(
          (total, item) => {

            const quantity = Number(item.quantity) || 0;

            return total + quantity;

          },
          0
        );


        cartCountElement.textContent =
          totalQuantity > 99 ? "99+" : String(totalQuantity);


        cartCountElement.setAttribute(
          "aria-label",
          `${totalQuantity} items in cart`
        );


      } catch (error) {

        console.error(
          "HAFHASS: Unable to load cart count.",
          error
        );

        cartCountElement.textContent = "0";

      }

    }


    loadCartCount();


    // Allow other account scripts to request a cart refresh.

    window.addEventListener("hafhass:cart-updated", loadCartCount);


    // ==================================================
    // MOBILE SIDEBAR
    // ==================================================

    function openSidebar() {

      if (!sidebar || !menuToggle) return;

      sidebar.classList.add("is-open");

      if (overlay) {
        overlay.classList.add("is-visible");
      }

      menuToggle.classList.add("is-active");

      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "Close account menu");

      document.body.classList.add("account-menu-open");

    }


    function closeSidebar() {

      if (!sidebar || !menuToggle) return;

      sidebar.classList.remove("is-open");

      if (overlay) {
        overlay.classList.remove("is-visible");
      }

      menuToggle.classList.remove("is-active");

      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open account menu");

      document.body.classList.remove("account-menu-open");

    }


    function toggleSidebar() {

      const isOpen =
        sidebar?.classList.contains("is-open");

      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }

    }


    if (menuToggle) {

      menuToggle.addEventListener(
        "click",
        toggleSidebar
      );

    }


    if (overlay) {
      overlay.addEventListener("click", closeSidebar);
    }


    if (sidebar) {

      sidebar.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", closeSidebar);

      });

    }


    document.addEventListener("keydown", event => {

      if (event.key === "Escape") {
        closeSidebar();
      }

    });


    window.addEventListener("resize", () => {

      if (window.innerWidth > 800) {
        closeSidebar();
      }

    });


    // ==================================================
    // FOOTER YEAR
    // ==================================================

    if (yearElement) {

      yearElement.textContent =
        new Date().getFullYear();

    }


    // ==================================================
    // SIGN OUT
    // ==================================================

    if (logoutButton) {

      logoutButton.addEventListener("click", async () => {

        const confirmed = window.confirm(
          "Are you sure you want to sign out?"
        );

        if (!confirmed) return;

        const originalText = logoutButton.textContent;

        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {

          if (
            !window.HafhassAuth ||
            typeof window.HafhassAuth.logout !== "function"
          ) {

            throw new Error(
              "Authentication service is unavailable."
            );

          }


          const result = await window.HafhassAuth.logout();

          if (result && result.success === false) {

            throw new Error(
              result.message || "Unable to sign out."
            );

          }


          window.location.replace("../login.html");


        } catch (error) {

          console.error(
            "HAFHASS: Sign out failed.",
            error
          );

          window.alert(
            error.message ||
            "Unable to sign out. Please try again."
          );

          logoutButton.disabled = false;
          logoutButton.textContent = originalText;

        }

      });

    }


    console.log(
      "HAFHASS: Customer account layout initialized."
    );

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeAccountLayout,
      { once: true }
    );

  } else {

    initializeAccountLayout();

  }

})();