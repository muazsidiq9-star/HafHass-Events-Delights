// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER NOTIFICATIONS PAGE
// ======================================================

(() => {
  "use strict";

  // ====================================================
  // DEPENDENCIES
  // ====================================================

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;

  if (!supabase || !auth || !guards) {

    console.error(
      "HAFHASS Notifications: Required dependencies are unavailable.",
      {
        supabase: Boolean(supabase),
        auth: Boolean(auth),
        guards: Boolean(guards)
      }
    );

    return;

  }


  // ====================================================
  // SETTINGS
  // ====================================================

  const PAGE_SIZE = 20;
  const NAVIGATION_WAIT_MS = 1500;

  const TYPE_ICONS = {
    welcome: "fa-solid fa-star",
    order_confirmation: "fa-solid fa-receipt",
    payment_confirmation: "fa-solid fa-credit-card",
    order_update: "fa-solid fa-box-open",
    delivery_update: "fa-solid fa-truck-fast",
    service_update: "fa-solid fa-champagne-glasses",
    promotion: "fa-solid fa-tag",
    general: "fa-solid fa-bell"
  };


  // ====================================================
  // DOM ELEMENTS
  // ====================================================

  const elements = {
    count: document.getElementById("notificationsCount"),
    tabAll: document.getElementById("notificationsTabAll"),
    tabUnread: document.getElementById("notificationsTabUnread"),
    tabUnreadCount: document.getElementById("notificationsTabUnreadCount"),
    markAll: document.getElementById("markAllNotificationsRead"),
    notice: document.getElementById("notificationsNotice"),
    loading: document.getElementById("notificationsLoading"),
    error: document.getElementById("notificationsError"),
    errorMessage: document.getElementById("notificationsErrorMessage"),
    retry: document.getElementById("retryNotificationsButton"),
    empty: document.getElementById("notificationsEmpty"),
    emptyTitle: document.getElementById("notificationsEmptyTitle"),
    emptyMessage: document.getElementById("notificationsEmptyMessage"),
    list: document.getElementById("notificationsList"),
    more: document.getElementById("notificationsMore"),
    moreButton: document.getElementById("notificationsMoreButton"),
    avatarInitials: document.getElementById("avatarInitials"),
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserEmail: document.getElementById("sidebarUserEmail")
  };


  // ====================================================
  // STATE
  // ====================================================

  const state = {
    user: null,
    filter: "all",
    items: [],
    total: 0,
    unread: 0,
    busy: false,
    channel: null,
    noticeTimer: null,
    reloadTimer: null
  };


  // ====================================================
  // HELPERS
  // ====================================================

  function getErrorMessage(error) {

    return (
      error?.message ||
      error?.error_description ||
      "Something went wrong. Please try again."
    );

  }


  // Only relative links are followed. Anything with a
  // scheme (https:, javascript:) or starting with // is ignored.

  function getSafeActionUrl(value) {

    const url = String(value || "").trim();

    if (!url) {
      return null;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) {
      return null;
    }

    return url;

  }


  function formatRelativeTime(value) {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000)
    );

    if (seconds < 60) {
      return "Just now";
    }

    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} min ago`;
    }

    if (seconds < 86400) {

      const hours = Math.floor(seconds / 3600);

      return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

    }

    if (seconds < 172800) {
      return "Yesterday";
    }

    if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)} days ago`;
    }

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() === new Date().getFullYear()
          ? undefined
          : "numeric"
    });

  }


  function formatFullDate(value) {

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short"
    });

  }


  function tellNavigation() {

    // Lets the header bell refresh its count straight away.

    window.dispatchEvent(
      new CustomEvent("hafhass:notifications-changed")
    );

  }


  // ====================================================
  // VIEW STATES
  // ====================================================

  function showView(view) {

    elements.loading.hidden = view !== "loading";
    elements.error.hidden = view !== "error";
    elements.empty.hidden = view !== "empty";
    elements.list.hidden = view !== "list";

    if (view !== "list") {
      elements.more.hidden = true;
    }

  }


  function showNotice(message) {

    if (!elements.notice) {
      return;
    }

    clearTimeout(state.noticeTimer);

    elements.notice.textContent = message;
    elements.notice.hidden = false;

    state.noticeTimer = setTimeout(() => {
      elements.notice.hidden = true;
    }, 5000);

  }


  function showError(message) {

    elements.errorMessage.textContent = message;

    showView("error");

  }


  function updateHeader() {

    elements.count.textContent =
      state.unread > 0
        ? `${state.unread} unread`
        : "All caught up";

    if (elements.tabUnreadCount) {

      elements.tabUnreadCount.textContent = state.unread;
      elements.tabUnreadCount.hidden = state.unread === 0;

    }

    elements.markAll.disabled = state.busy || state.unread === 0;

  }


  function updateTabs() {

    const showingAll = state.filter === "all";

    elements.tabAll.classList.toggle("active", showingAll);
    elements.tabUnread.classList.toggle("active", !showingAll);

    elements.tabAll.setAttribute("aria-pressed", String(showingAll));
    elements.tabUnread.setAttribute("aria-pressed", String(!showingAll));

  }


  // ====================================================
  // RENDERING
  // ====================================================

  function createItem(notification) {

    const actionUrl = getSafeActionUrl(notification.action_url);
    const isUnread = !notification.is_read;

    const item = document.createElement(actionUrl ? "a" : "button");

    item.className = "notification-item";
    item.dataset.id = notification.id;

    if (actionUrl) {
      item.href = actionUrl;
      item.classList.add("is-link");
    } else {
      item.type = "button";
    }

    item.classList.toggle("is-unread", isUnread);


    // ICON

    const icon = document.createElement("span");

    icon.className = "notification-icon";

    const iconGlyph = document.createElement("i");

    iconGlyph.className =
      TYPE_ICONS[notification.type] || TYPE_ICONS.general;

    iconGlyph.setAttribute("aria-hidden", "true");

    icon.appendChild(iconGlyph);


    // TEXT

    const body = document.createElement("div");

    body.className = "notification-body";

    const titleRow = document.createElement("div");

    titleRow.className = "notification-title-row";

    const title = document.createElement("h3");

    title.className = "notification-title";
    title.textContent = notification.title;

    const time = document.createElement("time");

    time.className = "notification-time";
    time.dateTime = notification.created_at;
    time.title = formatFullDate(notification.created_at);
    time.textContent = formatRelativeTime(notification.created_at);

    titleRow.appendChild(title);
    titleRow.appendChild(time);

    const message = document.createElement("p");

    message.className = "notification-message";
    message.textContent = notification.message;

    body.appendChild(titleRow);
    body.appendChild(message);

    item.appendChild(icon);
    item.appendChild(body);

    if (actionUrl) {

      const chevron = document.createElement("span");

      chevron.className = "notification-chevron";

      const chevronGlyph = document.createElement("i");

      chevronGlyph.className = "fa-solid fa-chevron-right";
      chevronGlyph.setAttribute("aria-hidden", "true");

      chevron.appendChild(chevronGlyph);
      item.appendChild(chevron);

    }

    item.addEventListener("click", event => {
      handleItemClick(notification, actionUrl, event);
    });

    return item;

  }


  function render() {

    updateHeader();
    updateTabs();

    elements.list.replaceChildren();

    if (state.items.length === 0) {

      if (state.filter === "unread") {

        elements.emptyTitle.textContent = "You're all caught up";
        elements.emptyMessage.textContent =
          "You have no unread notifications.";

      } else {

        elements.emptyTitle.textContent = "No notifications yet";
        elements.emptyMessage.textContent =
          "Updates about your orders, payments and requests will appear here.";

      }

      showView("empty");

      return;

    }

    const fragment = document.createDocumentFragment();

    state.items.forEach(notification => {
      fragment.appendChild(createItem(notification));
    });

    elements.list.appendChild(fragment);

    showView("list");

    elements.more.hidden = state.items.length >= state.total;

  }


  // ====================================================
  // LOADING DATA
  // ====================================================

  async function fetchUnreadCount() {

    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", state.user.id)
      .eq("is_read", false);

    if (error) {
      throw error;
    }

    state.unread = count || 0;

  }


  async function loadNotifications({ reset = true, silent = false } = {}) {

    if (!state.user) {
      return;
    }

    if (reset && !silent) {
      showView("loading");
    }

    try {

      const from = reset ? 0 : state.items.length;

      let query = supabase
        .from("notifications")
        .select(
          "id, type, title, message, action_url, is_read, created_at, related_order_id, related_service_request_id",
          { count: "exact" }
        )
        .eq("user_id", state.user.id)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (state.filter === "unread") {
        query = query.eq("is_read", false);
      }

      const [{ data, count, error }] = await Promise.all([
        query,
        fetchUnreadCount()
      ]);

      if (error) {
        throw error;
      }

      state.items = reset ? data || [] : state.items.concat(data || []);
      state.total = count || state.items.length;

      render();

    } catch (error) {

      console.error(
        "HAFHASS Notifications: Could not load notifications.",
        error
      );

      if (reset && !silent) {
        showError(getErrorMessage(error));
      } else {
        showNotice(getErrorMessage(error));
      }

    }

  }


  // ====================================================
  // MARKING AS READ
  // ====================================================

  async function markRead(notification) {

    if (notification.is_read) {
      return true;
    }

    // Update the screen first, undo if it fails.

    notification.is_read = true;
    state.unread = Math.max(0, state.unread - 1);

    updateHeader();

    const row = elements.list.querySelector(
      `[data-id="${notification.id}"]`
    );

    if (row) {
      row.classList.remove("is-unread");
    }

    const { error } = await supabase.rpc("mark_notification_read", {
      p_notification_id: notification.id
    });

    if (error) {

      notification.is_read = false;
      state.unread += 1;

      updateHeader();

      if (row) {
        row.classList.add("is-unread");
      }

      console.error(
        "HAFHASS Notifications: Could not mark as read.",
        error
      );

      showNotice(
        "We couldn't mark that notification as read. Please try again."
      );

      return false;

    }

    tellNavigation();

    return true;

  }


  async function handleItemClick(notification, actionUrl, event) {

    const opensElsewhere =
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.button === 1;

    if (!actionUrl) {

      const marked = await markRead(notification);

      if (marked && state.filter === "unread") {
        state.items = state.items.filter(
          item => item.id !== notification.id
        );

        state.total = Math.max(0, state.total - 1);

        render();
      }

      return;

    }

    // Opening in a new tab: let the browser do it,
    // and mark as read in the background.

    if (opensElsewhere) {

      markRead(notification);

      return;

    }

    event.preventDefault();

    // Mark as read first, but never keep the customer
    // waiting for more than a moment.

    await Promise.race([
      markRead(notification),
      new Promise(resolve => setTimeout(resolve, NAVIGATION_WAIT_MS))
    ]);

    window.location.href = actionUrl;

  }


  async function markAllRead() {

    if (state.busy || state.unread === 0) {
      return;
    }

    state.busy = true;

    updateHeader();

    try {

      const { error } = await supabase.rpc(
        "mark_all_notifications_read"
      );

      if (error) {
        throw error;
      }

      state.items.forEach(notification => {
        notification.is_read = true;
      });

      state.unread = 0;

      if (state.filter === "unread") {
        state.items = [];
        state.total = 0;
      }

      tellNavigation();

    } catch (error) {

      console.error(
        "HAFHASS Notifications: Could not mark all as read.",
        error
      );

      showNotice(
        "We couldn't mark your notifications as read. Please try again."
      );

    } finally {

      state.busy = false;

      render();

    }

  }


  // ====================================================
  // FILTERS, RETRY AND LOAD MORE
  // ====================================================

  function setFilter(filter) {

    if (state.filter === filter) {
      return;
    }

    state.filter = filter;

    updateTabs();

    loadNotifications({ reset: true });

  }


  function initializeControls() {

    elements.tabAll.addEventListener(
      "click",
      () => setFilter("all")
    );

    elements.tabUnread.addEventListener(
      "click",
      () => setFilter("unread")
    );

    elements.markAll.addEventListener("click", markAllRead);

    elements.retry.addEventListener(
      "click",
      () => loadNotifications({ reset: true })
    );

    elements.moreButton.addEventListener("click", async () => {

      elements.moreButton.disabled = true;

      await loadNotifications({ reset: false, silent: true });

      elements.moreButton.disabled = false;

    });

  }


  // ====================================================
  // LIVE UPDATES
  // ====================================================

  function subscribeToNewNotifications() {

    // account-layout.js owns the single Realtime subscription.
    // It updates the header badge and broadcasts this event so
    // the open notification page can refresh its list and count.

    window.addEventListener("hafhass:notifications-updated", () => {

      clearTimeout(state.reloadTimer);

      state.reloadTimer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          loadNotifications({ reset: true, silent: true });
        }
      }, 180);

    });

    // Also catch up when the customer returns to this page.

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        loadNotifications({ reset: true, silent: true });
      }
    });

  }


  // ====================================================
  // CUSTOMER INFORMATION (SIDEBAR)
  // ====================================================

  async function loadCustomerInformation(verifiedProfile = null) {

    try {

      let profile = verifiedProfile;

      if (!profile) {

        const result = await auth.getProfile();

        profile =
          result?.profile ||
          result?.data?.profile ||
          result?.data ||
          null;

      }

      const fullName =
        profile?.full_name ||
        profile?.name ||
        state.user?.user_metadata?.full_name ||
        state.user?.user_metadata?.name ||
        "Customer";

      const email = profile?.email || state.user?.email || "";

      if (elements.sidebarUserName) {
        elements.sidebarUserName.textContent = fullName;
      }

      if (elements.sidebarUserEmail) {
        elements.sidebarUserEmail.textContent = email;
      }

      if (elements.avatarInitials) {

        const initials = fullName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map(part => part.charAt(0).toUpperCase())
          .join("");

        elements.avatarInitials.textContent = initials || "C";

      }

    } catch (error) {

      console.warn(
        "HAFHASS Notifications: Could not load customer information.",
        getErrorMessage(error)
      );

    }

  }


  // ====================================================
  // INITIALIZATION
  // ====================================================

  async function initializeNotificationsPage() {

    try {

      const guardResult = await guards.protectCustomerPage({
        loginPage: "../login.html"
      });

      if (!guardResult || guardResult.authorized !== true) {
        return;
      }

      state.user = guardResult.user || null;

      if (!state.user) {

        const userResult = await auth.getCurrentUser();

        if (!userResult?.success || !userResult.user) {

          throw new Error(
            userResult?.message ||
            "Your customer session could not be verified."
          );

        }

        state.user = userResult.user;

      }

      // The sidebar loads first so a problem further down
      // can never leave it stuck on "Loading...".

      await loadCustomerInformation(guardResult.profile || null);

      initializeControls();

      await loadNotifications({ reset: true });

      subscribeToNewNotifications();

    } catch (error) {

      console.error(
        "HAFHASS Notifications: Initialization failed.",
        error
      );

      showError(
        getErrorMessage(error) ||
        "We couldn't open your notifications. Please try again."
      );

    }

  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeNotificationsPage
    );

  } else {

    initializeNotificationsPage();

  }

})();
