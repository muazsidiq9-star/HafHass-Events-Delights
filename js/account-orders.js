// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER ORDER HISTORY
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
      "HAFHASS Orders: Required dependencies are unavailable.",
      {
        supabase: Boolean(supabase),
        auth: Boolean(auth),
        guards: Boolean(guards)
      }
    );

    return;
  }


  // ====================================================
  // DOM ELEMENTS
  // ====================================================

  const elements = {

    search: document.getElementById("ordersSearch"),
    filter: document.getElementById("ordersFilter"),

    loading: document.getElementById("ordersLoading"),

    error: document.getElementById("ordersError"),
    errorMessage: document.getElementById("ordersErrorMessage"),
    retryButton: document.getElementById("retryOrdersButton"),

    empty: document.getElementById("ordersEmpty"),
    emptyTitle: document.getElementById("ordersEmptyTitle"),
    emptyMessage: document.getElementById("ordersEmptyMessage"),

    list: document.getElementById("ordersList"),
    count: document.getElementById("ordersCount"),

    avatarInitials: document.getElementById("avatarInitials"),
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserEmail: document.getElementById("sidebarUserEmail")

  };


  // ====================================================
  // STATE
  // ====================================================

  let currentUser = null;
  let allOrders = [];
  let activeFilter = "all";


  // ====================================================
  // STATUS CONFIGURATION
  // ====================================================

  const STATUS_CONFIG = {

    pending: {
      label: "Pending",
      className: "pending"
    },

    awaiting_payment: {
      label: "Awaiting Payment",
      className: "pending"
    },

    payment_confirmed: {
      label: "Payment Confirmed",
      className: "confirmed"
    },

    processing: {
      label: "Processing",
      className: "processing"
    },

    ready_for_pickup: {
      label: "Ready for Pickup",
      className: "ready"
    },

    out_for_delivery: {
      label: "Out for Delivery",
      className: "delivery"
    },

    completed: {
      label: "Completed",
      className: "completed"
    },

    cancelled: {
      label: "Cancelled",
      className: "cancelled"
    }

  };


  // ====================================================
  // HELPERS
  // ====================================================

  function escapeHTML(value) {

    return String(value ?? "").replace(
      /[&<>"']/g,
      character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[character]
    );

  }


  function formatOrderNumber(order) {

    if (order?.order_number) {
      return String(order.order_number);
    }

    if (order?.id) {
      return String(order.id)
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase();
    }

    return "Order";

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

      return `${currency || "NGN"} ${numericAmount.toLocaleString()}`;

    }

  }


  function formatDate(dateValue) {

    if (!dateValue) return "Date unavailable";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(date);

  }


  function getStatus(status) {

    const normalized = String(status || "pending")
      .toLowerCase()
      .trim();

    return STATUS_CONFIG[normalized] || {

      label: normalized
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase()),

      className: "pending"

    };

  }


  function setVisible(element, visible) {

    if (!element) return;

    element.hidden = !visible;

  }


  function getErrorDetails(error) {

    if (!error) {
      return "Unknown error.";
    }

    const details = [];

    if (error.message) {
      details.push(`Message: ${error.message}`);
    }

    if (error.code) {
      details.push(`Code: ${error.code}`);
    }

    if (error.details) {
      details.push(`Details: ${error.details}`);
    }

    if (error.hint) {
      details.push(`Hint: ${error.hint}`);
    }

    if (!details.length) {
      try {
        return JSON.stringify(error, null, 2);
      } catch (serializationError) {
        return String(error);
      }
    }

    return details.join("\n");

  }


  // ====================================================
  // DISPLAY STATES
  // ====================================================

  function showLoading() {

    setVisible(elements.loading, true);
    setVisible(elements.error, false);
    setVisible(elements.empty, false);
    setVisible(elements.list, false);

  }


  function showError(message) {

    setVisible(elements.loading, false);
    setVisible(elements.error, true);
    setVisible(elements.empty, false);
    setVisible(elements.list, false);

    if (elements.errorMessage) {
      elements.errorMessage.textContent = message;
    }

  }


  function showEmpty(title, message) {

    setVisible(elements.loading, false);
    setVisible(elements.error, false);
    setVisible(elements.empty, true);
    setVisible(elements.list, false);

    if (elements.emptyTitle) {
      elements.emptyTitle.textContent = title;
    }

    if (elements.emptyMessage) {
      elements.emptyMessage.textContent = message;
    }

  }


  // ====================================================
  // CUSTOMER INFORMATION
  // ====================================================

  async function loadCustomerInformation(verifiedProfile = null) {

    try {

      let profile = verifiedProfile;

      // Use the profile already verified by the page guard.
      // Only request another profile if one was not supplied.

      if (!profile) {

        const result = await auth.getProfile();

        if (result?.success === false || result?.error) {

          throw result.error || new Error(
            result.message || "Unable to load customer profile."
          );

        }

        profile =
          result?.profile ||
          result?.data?.profile ||
          result?.data ||
          result;

      }


      const fullName =
        profile?.full_name ||
        profile?.name ||
        currentUser?.user_metadata?.full_name ||
        currentUser?.user_metadata?.name ||
        "Customer";

      const email =
        profile?.email ||
        currentUser?.email ||
        "";


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
        "HAFHASS Orders: Could not load customer information.",
        getErrorDetails(error)
      );

    }

  }


  // ====================================================
  // FETCH ORDERS
  // ====================================================

  async function fetchOrders() {

    if (!currentUser || !currentUser.id) {

      throw new Error(
        "Your customer session could not be verified."
      );

    }


    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        order_number,
        user_id,
        status,
        total_amount,
        currency,
        created_at
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", {
        ascending: false
      });


    if (error) {

      console.error(
        "HAFHASS Orders: Supabase query failed.",
        {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          error
        }
      );

      throw new Error(
        getErrorDetails(error)
      );

    }


    return Array.isArray(data) ? data : [];

  }


  // ====================================================
  // ORDER CARD
  // ====================================================

  function createOrderCard(order) {

    const status = getStatus(order.status);

    const orderNumber = formatOrderNumber(order);

    const orderDate = formatDate(order.created_at);

    const total = formatCurrency(
      order.total_amount,
      order.currency || "NGN"
    );

    const detailsLink =
      `order-details.html?id=${encodeURIComponent(order.id)}`;


    const article = document.createElement("article");

    article.className = "order-card";

    article.innerHTML = `

      <div class="order-card-top">

        <div class="order-card-reference">

          <span class="order-card-label">
            Order Number
          </span>

          <h3>
            #${escapeHTML(orderNumber)}
          </h3>

        </div>

        <span class="order-status order-status-${escapeHTML(status.className)}">
          ${escapeHTML(status.label)}
        </span>

      </div>


      <div class="order-card-information">

        <div>

          <span class="order-card-label">
            Order Date
          </span>

          <strong>
            ${escapeHTML(orderDate)}
          </strong>

        </div>

        <div>

          <span class="order-card-label">
            Order Total
          </span>

          <strong>
            ${escapeHTML(total)}
          </strong>

        </div>

      </div>


      <div class="order-card-actions">

        <a
          href="${escapeHTML(detailsLink)}"
          class="btn order-view-button"
        >

          <i class="fa-regular fa-eye" aria-hidden="true"></i>

          View Details

        </a>


        <a
          href="../shop.html"
          class="btn order-shop-button"
        >

          <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>

          Shop Again

        </a>

      </div>

    `;


    return article;

  }


  // ====================================================
  // FILTER AND SEARCH
  // ====================================================

  function getFilteredOrders() {

    const searchTerm = elements.search
      ? elements.search.value.trim().toLowerCase()
      : "";


    return allOrders.filter(order => {

      const orderNumber =
        formatOrderNumber(order).toLowerCase();

      const fullID =
        String(order.id || "").toLowerCase();


      const matchesSearch =
        !searchTerm ||
        orderNumber.includes(searchTerm) ||
        fullID.includes(searchTerm);


      const orderStatus =
        String(order.status || "pending")
          .toLowerCase()
          .trim();


      const matchesFilter =
        activeFilter === "all" ||
        orderStatus === activeFilter;


      return matchesSearch && matchesFilter;

    });

  }


  function updateCount(count) {

    if (!elements.count) return;

    elements.count.textContent =
      `${count} ${count === 1 ? "order" : "orders"}`;

  }


  // ====================================================
  // RENDER ORDERS
  // ====================================================

  function renderOrders() {

    const filteredOrders = getFilteredOrders();

    updateCount(filteredOrders.length);


    setVisible(elements.loading, false);
    setVisible(elements.error, false);


    if (!filteredOrders.length) {

      if (allOrders.length === 0) {

        showEmpty(
          "No orders yet",
          "You haven't placed any orders. Explore our shop and discover something special."
        );

      } else {

        showEmpty(
          "No matching orders",
          "We couldn't find any orders matching your search or selected filter."
        );

      }

      updateCount(0);

      return;

    }


    if (!elements.list) {

      console.error(
        "HAFHASS Orders: Orders list element is missing."
      );

      return;

    }


    elements.list.innerHTML = "";

    const fragment = document.createDocumentFragment();


    filteredOrders.forEach(order => {

      fragment.appendChild(
        createOrderCard(order)
      );

    });


    elements.list.appendChild(fragment);

    setVisible(elements.empty, false);
    setVisible(elements.list, true);

  }


  // ====================================================
  // FILTER CONTROLS
  // ====================================================

  function initializeFilters() {

    if (elements.filter) {

      elements.filter.addEventListener("change", () => {

        activeFilter = elements.filter.value || "all";

        renderOrders();

      });

    }


    const filterButtons = document.querySelectorAll(
      "[data-filter]"
    );


    filterButtons.forEach(button => {

      button.addEventListener("click", () => {

        activeFilter = button.dataset.filter || "all";


        filterButtons.forEach(item => {

          item.classList.toggle(
            "active",
            item === button
          );

          item.setAttribute(
            "aria-pressed",
            item === button ? "true" : "false"
          );

        });


        if (elements.filter) {
          elements.filter.value = activeFilter;
        }


        renderOrders();

      });

    });


    if (elements.search) {

      elements.search.addEventListener(
        "input",
        renderOrders
      );

    }

  }


  // ====================================================
  // LOAD ORDERS
  // ====================================================

  async function loadOrders() {

    showLoading();

    try {

      allOrders = await fetchOrders();

      renderOrders();

    } catch (error) {

      console.error(
        "HAFHASS Orders: Failed to load orders.",
        getErrorDetails(error)
      );

      showError(
        error.message ||
        "We couldn't load your orders. Please check your connection and try again."
      );

    }

  }


  // ====================================================
  // RETRY BUTTON
  // ====================================================

  function initializeRetry() {

    if (!elements.retryButton) return;


    elements.retryButton.addEventListener("click", async () => {

      elements.retryButton.disabled = true;

      const originalText =
        elements.retryButton.textContent;


      elements.retryButton.textContent = "Loading...";


      await loadOrders();


      elements.retryButton.disabled = false;

      elements.retryButton.textContent = originalText;

    });

  }


  // ====================================================
  // INITIALIZE ORDERS PAGE
  // ====================================================

  async function initializeOrdersPage() {

    try {

      const guardResult = await guards.protectCustomerPage({
        loginPage: "../login.html"
      });


      if (!guardResult || guardResult.authorized !== true) {
        return;
      }


      // Use the authenticated user returned by the guard.

      currentUser = guardResult.user || null;


      // Fallback only if the guard did not return the user.

      if (!currentUser) {

        const userResult = await auth.getCurrentUser();

        if (!userResult?.success || !userResult.user) {

          throw new Error(
            userResult?.message ||
            "Your customer session could not be verified."
          );

        }

        currentUser = userResult.user;

      }


      await loadCustomerInformation(
        guardResult.profile || null
      );


      initializeFilters();

      initializeRetry();

      await loadOrders();


    } catch (error) {

      console.error(
        "HAFHASS Orders: Initialization failed.",
        getErrorDetails(error)
      );

      showError(
        error.message ||
        "We couldn't initialize your orders page. Please try again."
      );

    }

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeOrdersPage,
      { once: true }
    );

  } else {

    initializeOrdersPage();

  }

})();