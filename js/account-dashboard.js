/* =========================================
   HAFHASS EVENTS & DELIGHTS
   CUSTOMER DASHBOARD CONTROLLER
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

  "use strict";


  /* =======================================
     1. INITIAL ELEMENTS
  ======================================= */

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;


  const elements = {

    sidebar: document.getElementById("accountSidebar"),
    menuToggle: document.getElementById("accountMenuToggle"),
    overlay: document.getElementById("accountSidebarOverlay"),

    themeToggle: document.getElementById("themeToggle"),
    themeIcon: document.querySelector("#themeToggle .theme-icon"),

    logoutButton: document.getElementById("logoutButton"),

    avatarInitials: document.getElementById("avatarInitials"),
    accountAvatar: document.getElementById("accountAvatar"),

    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserEmail: document.getElementById("sidebarUserEmail"),

    totalOrders: document.getElementById("totalOrdersCount"),
    pendingOrders: document.getElementById("pendingOrdersCount"),
    completedOrders: document.getElementById("completedOrdersCount"),
    favourites: document.getElementById("favouritesCount"),

    recentOrdersLoading: document.getElementById("recentOrdersLoading"),
    recentOrdersList: document.getElementById("recentOrdersList"),
    recentOrdersEmpty: document.getElementById("recentOrdersEmpty"),

    cartCount: document.getElementById("accountCartCount"),

    year: document.getElementById("accountYear")

  };


  /* =======================================
     2. GENERAL HELPERS
  ======================================= */

  function setText(element, value) {

    if (element) {
      element.textContent = value;
    }

  }


  function getInitials(name) {

    if (!name || typeof name !== "string") {
      return "H";
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("");

  }


  function formatDate(dateValue) {

    if (!dateValue) {
      return "Date unavailable";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return date.toLocaleDateString("en-NG", {

      day: "numeric",
      month: "short",
      year: "numeric"

    });

  }


  function formatCurrency(amount, currency = "NGN") {

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return "—";
    }

    try {

      return new Intl.NumberFormat("en-NG", {

        style: "currency",
        currency: currency || "NGN",
        maximumFractionDigits: 2

      }).format(numericAmount);

    } catch (error) {

      return `₦${numericAmount.toLocaleString("en-NG")}`;

    }

  }


  function showNotification(message, type = "info") {

    let notification =
      document.getElementById("accountNotification");


    if (!notification) {

      notification = document.createElement("div");

      notification.id = "accountNotification";

      notification.className = "account-notification";

      document.body.appendChild(notification);

    }


    notification.textContent = message;

    notification.dataset.type = type;

    notification.classList.add("is-visible");


    clearTimeout(notification.timeout);


    notification.timeout = setTimeout(() => {

      notification.classList.remove("is-visible");

    }, 3500);

  }


  /* =======================================
     3. THEME MANAGEMENT
  ======================================= */

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


    if (elements.themeIcon) {

  elements.themeIcon.className =
    selectedTheme === "dark"
      ? "fa-solid fa-sun theme-icon"
      : "fa-regular fa-moon theme-icon";

}


    if (elements.themeToggle) {

      const label =
        selectedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme";


      elements.themeToggle.setAttribute(
        "aria-label",
        label
      );


      elements.themeToggle.setAttribute(
        "title",
        label
      );

    }


    try {

      localStorage.setItem(
        "hafhass-theme",
        selectedTheme
      );

    } catch (error) {

      console.warn(
        "Theme preference could not be saved."
      );

    }

  }


  function initialiseTheme() {

    let savedTheme = null;


    try {

      savedTheme = localStorage.getItem(
        "hafhass-theme"
      );

    } catch (error) {

      console.warn(
        "Theme preference is unavailable."
      );

    }


    if (
      savedTheme !== "dark" &&
      savedTheme !== "light"
    ) {

      savedTheme =
        window.matchMedia &&
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches
          ? "dark"
          : "light";

    }


    applyTheme(savedTheme);

  }


  elements.themeToggle?.addEventListener("click", () => {

    const currentTheme =
      document.documentElement.getAttribute("data-theme");


    applyTheme(
      currentTheme === "dark" ? "light" : "dark"
    );

  });


  /* =======================================
     4. MOBILE SIDEBAR
  ======================================= */

  function openSidebar() {

    elements.sidebar?.classList.add("is-open");

    elements.menuToggle?.classList.add("is-active");

    elements.overlay?.classList.add("is-visible");


    elements.menuToggle?.setAttribute(
      "aria-expanded",
      "true"
    );


    document.body.style.overflow = "hidden";

  }


  function closeSidebar() {

    elements.sidebar?.classList.remove("is-open");

    elements.menuToggle?.classList.remove("is-active");

    elements.overlay?.classList.remove("is-visible");


    elements.menuToggle?.setAttribute(
      "aria-expanded",
      "false"
    );


    document.body.style.overflow = "";

  }


  elements.menuToggle?.addEventListener("click", () => {

    const isOpen =
      elements.sidebar?.classList.contains("is-open");


    if (isOpen) {

      closeSidebar();

    } else {

      openSidebar();

    }

  });


  elements.overlay?.addEventListener(
    "click",
    closeSidebar
  );


  elements.sidebar?.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", closeSidebar);

  });


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


  /* =======================================
     5. SIGN OUT
  ======================================= */

  elements.logoutButton?.addEventListener(
    "click",
    async () => {

      const confirmed = window.confirm(
        "Are you sure you want to sign out?"
      );


      if (!confirmed) {
        return;
      }


      elements.logoutButton.disabled = true;

      elements.logoutButton.textContent =
        "Signing out...";


      try {

        const result = await auth.logout();


        if (
          result?.success === false ||
          result?.error
        ) {

          throw result.error ||
            new Error(
              result.message || "Sign out failed."
            );

        }


        window.location.replace("../login.html");


      } catch (error) {

        console.error("Sign out error:", error);


        showNotification(

          error.message ||
          "Unable to sign out. Please try again.",

          "error"

        );


        elements.logoutButton.disabled = false;

        elements.logoutButton.innerHTML =
          "<span>↪</span> Sign Out";

      }

    }
  );


  /* =======================================
     6. LOAD CUSTOMER PROFILE
  ======================================= */

  async function loadCustomerProfile(user, verifiedProfile = null) {

    let profile = verifiedProfile;


    // Reuse the profile already retrieved by the guard.
    // Only fetch it separately if the guard did not return one.

    if (!profile) {

      try {

        const result = await auth.getProfile();


        if (
          result?.success === false ||
          result?.error
        ) {

          throw result.error ||
            new Error(
              result.message || "Profile loading failed."
            );

        }


        profile = result?.profile || null;


      } catch (error) {

        console.error(
          "Profile loading error:",
          error
        );

      }

    }


    const fullName =

      profile?.full_name ||

      user.user_metadata?.full_name ||

      user.user_metadata?.name ||

      "Customer";


    const email =

      profile?.email ||

      user.email ||

      "";


    setText(
      elements.sidebarUserName,
      fullName
    );


    setText(
      elements.sidebarUserEmail,
      email
    );


    setText(
      elements.avatarInitials,
      getInitials(fullName)
    );


    // Load profile picture safely.

    if (
      profile?.avatar_url &&
      elements.accountAvatar
    ) {

      try {

        const imageUrl = new URL(
          profile.avatar_url,
          window.location.origin
        );


        if (
          imageUrl.protocol === "https:" ||
          imageUrl.protocol === "http:"
        ) {

          elements.accountAvatar.style.backgroundImage =
            `url(${JSON.stringify(imageUrl.href)})`;


          elements.accountAvatar.style.backgroundSize =
            "cover";


          elements.accountAvatar.style.backgroundPosition =
            "center";


          setText(elements.avatarInitials, "");

        }

      } catch (error) {

        console.warn(
          "Profile image URL is invalid."
        );

      }

    }


    return profile;

  }


  /* =======================================
     7. LOAD ORDER STATISTICS
  ======================================= */

  async function loadOrderStatistics(userId) {

    const { data, error } = await supabase

      .from("orders")

      .select("id, status")

      .eq("user_id", userId);


    if (error) {
      throw error;
    }


    const orders = data || [];


    const completedStatuses = [
      "completed"
    ];


    const pendingStatuses = [

      "pending",
      "awaiting_payment",
      "payment_confirmed",
      "processing",
      "ready_for_pickup",
      "out_for_delivery"

    ];


    const completedCount = orders.filter(order =>

      completedStatuses.includes(order.status)

    ).length;


    const pendingCount = orders.filter(order =>

      pendingStatuses.includes(order.status)

    ).length;


    setText(
      elements.totalOrders,
      orders.length
    );


    setText(
      elements.pendingOrders,
      pendingCount
    );


    setText(
      elements.completedOrders,
      completedCount
    );

  }


  /* =======================================
     8. LOAD FAVOURITES COUNT
  ======================================= */

  async function loadFavourites(userId) {

    const { count, error } = await supabase

      .from("favourites")

      .select("id", {

        count: "exact",
        head: true

      })

      .eq("user_id", userId);


    if (error) {
      throw error;
    }


    setText(
      elements.favourites,
      count ?? 0
    );

  }


  /* =======================================
     9. ORDER STATUS DISPLAY
  ======================================= */

  function getStatusLabel(status) {

    const labels = {

      pending: "Pending",

      awaiting_payment: "Awaiting Payment",

      payment_confirmed: "Payment Confirmed",

      processing: "Processing",

      ready_for_pickup: "Ready for Pickup",

      out_for_delivery: "Out for Delivery",

      completed: "Completed",

      cancelled: "Cancelled"

    };


    return labels[status] || "Order Update";

  }


  function getStatusClass(status) {

    const classes = {

      pending: "pending",

      awaiting_payment: "pending",

      payment_confirmed: "confirmed",

      processing: "processing",

      ready_for_pickup: "ready",

      out_for_delivery: "delivery",

      completed: "completed",

      cancelled: "cancelled"

    };


    return classes[status] || "default";

  }


  /* =======================================
     10. RENDER RECENT ORDERS
  ======================================= */

  function renderRecentOrders(orders) {

    if (elements.recentOrdersLoading) {

      elements.recentOrdersLoading.hidden = true;

    }


    if (!orders || orders.length === 0) {

      if (elements.recentOrdersList) {

        elements.recentOrdersList.hidden = true;

      }


      if (elements.recentOrdersEmpty) {

        elements.recentOrdersEmpty.hidden = false;

      }


      return;

    }


    if (elements.recentOrdersEmpty) {

      elements.recentOrdersEmpty.hidden = true;

    }


    if (elements.recentOrdersList) {

      elements.recentOrdersList.hidden = false;

      elements.recentOrdersList.replaceChildren();

    }


    orders.forEach(order => {

      const row = document.createElement("article");

      row.className = "account-order-row";


      // Order information

      const orderInfo = document.createElement("div");

      orderInfo.className = "account-order-info";


      const orderNumber = document.createElement("strong");

      orderNumber.textContent =
        `Order #${order.order_number || String(order.id).slice(0, 8).toUpperCase()}`;


      const orderDate = document.createElement("span");

      orderDate.textContent =
        formatDate(order.created_at);


      orderInfo.append(
        orderNumber,
        orderDate
      );


      // Order amount

      const orderAmount = document.createElement("div");

      orderAmount.className = "account-order-amount";

      orderAmount.textContent = formatCurrency(

        order.total_amount,

        order.currency || "NGN"

      );


      // Order status

      const status = document.createElement("span");

      status.className =
        `account-order-status ${getStatusClass(order.status)}`;

      status.textContent =
        getStatusLabel(order.status);


      // View order details

      const detailsLink = document.createElement("a");

      detailsLink.href =
        `order-details.html?id=${encodeURIComponent(order.id)}`;

      detailsLink.className =
        "account-order-details";

      detailsLink.textContent = "View";


      row.append(

        orderInfo,
        orderAmount,
        status,
        detailsLink

      );


      elements.recentOrdersList?.appendChild(row);

    });

  }


  /* =======================================
     11. LOAD RECENT ORDERS
  ======================================= */

  async function loadRecentOrders(userId) {

    const { data, error } = await supabase

      .from("orders")

      .select(
        "id, order_number, status, total_amount, currency, created_at"
      )

      .eq("user_id", userId)

      .order("created_at", {

        ascending: false

      })

      .limit(5);


    if (error) {
      throw error;
    }


    renderRecentOrders(data || []);

  }


  /* =======================================
     12. LOAD ACTIVE CART COUNT
  ======================================= */

  async function loadCartCount(userId) {

    try {

      // Find the customer's latest active cart.

      const { data: carts, error: cartError } =

        await supabase

          .from("carts")

          .select("id")

          .eq("user_id", userId)

          .eq("status", "active")

          .order("created_at", {

            ascending: false

          })

          .limit(1);


      if (cartError) {
        throw cartError;
      }


      // No active cart.

      if (!carts || carts.length === 0) {

        setText(elements.cartCount, 0);

        return;

      }


      // Retrieve product quantities.

      const { data: items, error: itemsError } =

        await supabase

          .from("cart_items")

          .select("quantity")

          .eq("cart_id", carts[0].id);


      if (itemsError) {
        throw itemsError;
      }


      // Calculate total product quantity.

      const totalQuantity = (items || []).reduce(

        (total, item) => {

          return total + Number(item.quantity || 0);

        },

        0

      );


      setText(
        elements.cartCount,
        totalQuantity
      );


    } catch (error) {

      console.error(
        "Cart count could not be loaded:",
        error
      );

      setText(elements.cartCount, 0);

    }

  }


  /* =======================================
     13. NORMALISE CURRENT CUSTOMER
  ======================================= */

  async function getCurrentCustomer() {

    const sessionResult = await auth.getSession();


    if (
      !sessionResult ||
      sessionResult.success !== true
    ) {

      throw new Error(

        sessionResult?.message ||
        "Unable to retrieve customer session."

      );

    }


    // First try the current session.

    const session = sessionResult.session;

    if (session?.user) {

      return session.user;

    }


    // Fall back to getCurrentUser().

    const userResult = await auth.getCurrentUser();


    if (
      !userResult ||
      userResult.success !== true
    ) {

      return null;

    }


    return userResult.user || null;

  }


  /* =======================================
     14. INITIALISE DASHBOARD
  ======================================= */

  async function initialiseDashboard() {

    initialiseTheme();


    setText(

      elements.year,

      new Date().getFullYear()

    );


    // Check required dependencies.

    if (!supabase || !auth || !guards) {

      console.error(
        "HAFHASS authentication system is unavailable."
      );


      window.location.replace("../login.html");

      return;

    }


    try {

      // Protect the dashboard and verify the account role.

      const guardResult = await guards.protectCustomerPage({

        loginPage: "../login.html"

      });


      // IMPORTANT:
      // Stop dashboard initialisation if the guard denies access.
      // The guard handles the appropriate redirect.

      if (
        !guardResult ||
        guardResult.authorized !== true
      ) {

        return;

      }


      // Reuse the authenticated user returned by the guard.
      // Fall back to the current session only if necessary.

      const user =

        guardResult.user?.id

          ? guardResult.user

          : await getCurrentCustomer();


      if (!user || !user.id) {

        window.location.replace("../login.html");

        return;

      }


      // Load the profile returned by the guard.
      // Avoid an unnecessary second profile request.

      await loadCustomerProfile(

        user,

        guardResult.profile || null

      );


      // Load dashboard sections independently.

      const tasks = [

        {

          name: "Order statistics",

          run: () => loadOrderStatistics(user.id)

        },

        {

          name: "Favourites",

          run: () => loadFavourites(user.id)

        },

        {

          name: "Recent orders",

          run: () => loadRecentOrders(user.id)

        },

        {

          name: "Shopping cart",

          run: () => loadCartCount(user.id)

        }

      ];


      const results = await Promise.allSettled(

        tasks.map(task => task.run())

      );


      results.forEach((result, index) => {

        if (result.status === "rejected") {

          console.error(

            `${tasks[index].name} loading failed:`,

            result.reason

          );


          if (
            tasks[index].name === "Recent orders"
          ) {

            if (elements.recentOrdersLoading) {

              elements.recentOrdersLoading.hidden = true;

            }


            showNotification(

              "We couldn't load your recent orders. Please refresh the page.",

              "error"

            );

          }

        }

      });


    } catch (error) {

      console.error(
        "Dashboard initialisation error:",
        error
      );


      showNotification(

        "We couldn't load your account. Please sign in again.",

        "error"

      );


      setTimeout(() => {

        window.location.replace("../login.html");

      }, 2000);

    }

  }


  /* =======================================
     15. START DASHBOARD
  ======================================= */

  await initialiseDashboard();

});