/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN DASHBOARD CONTROLLER
========================================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initAdminDashboard);

  const supabase = window.hafhassSupabase;

  const LOW_STOCK_THRESHOLD = 5;
  const PAYMENT_PAGE_SIZE = 1000;

  const elements = {
    currentDate: document.getElementById("adminCurrentDate"),
    year: document.getElementById("adminYear"),

    totalOrders: document.getElementById("statTotalOrders"),
    pendingOrders: document.getElementById("statPendingOrders"),
    totalProducts: document.getElementById("statTotalProducts"),
    totalCustomers: document.getElementById("statTotalCustomers"),

    totalRevenue: document.getElementById("statTotalRevenue"),
    pendingPayments: document.getElementById("statPendingPayments"),
    serviceRequests: document.getElementById("statServiceRequests"),
    inventoryAlerts: document.getElementById("statInventoryAlerts"),

    recentOrders: document.getElementById("adminRecentOrders")
  };


  /* =======================================================
     1. INITIALIZATION
  ======================================================= */

  async function initAdminDashboard() {

    setDashboardDate();

    if (!supabase) {
      showDashboardError("Supabase connection is unavailable.");
      return;
    }

    // Wait for admin-layout.js to verify the administrator.
    const isAdminReady = await waitForAdminContext();

    if (!isAdminReady) {

      redirectToAdminLogin();

      return;

    }

    await loadDashboardData();
  }


  /* =======================================================
     1A. REDIRECT UNAUTHORIZED USERS
  ======================================================= */

  function redirectToAdminLogin() {

    const currentPath =
      window.location.pathname.replace(/^\/+/, "");

    const redirectPath = encodeURIComponent(
      currentPath + window.location.search
    );

    window.location.replace(
      `../login.html?redirect=${redirectPath}`
    );

  }


  /* =======================================================
     2. WAIT FOR ADMIN AUTHENTICATION
  ======================================================= */

  async function waitForAdminContext() {

    const maxAttempts = 100;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {

      if (
        window.HafhassAdmin?.user?.id &&
        window.HafhassAdmin?.profile?.role === "admin" &&
        window.HafhassAdmin?.profile?.is_active === true
      ) {
        return true;
      }

      if (document.body.classList.contains("admin-auth-failed")) {
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }


  /* =======================================================
     3. DASHBOARD DATE
  ======================================================= */

  function setDashboardDate() {

    if (elements.currentDate) {

      elements.currentDate.textContent =
        new Date().toLocaleDateString("en-NG", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        });

    }

    if (elements.year) {
      elements.year.textContent = new Date().getFullYear();
    }
  }


  /* =======================================================
     4. LOAD DASHBOARD DATA
  ======================================================= */

  async function loadDashboardData() {

    await Promise.all([

      loadTotalOrders(),

      loadPendingOrders(),

      loadTotalProducts(),

      loadTotalCustomers(),

      loadTotalRevenue(),

      loadPendingPayments(),

      loadServiceRequests(),

      loadInventoryAlerts(),

      loadRecentOrders()

    ]);
  }


  /* =======================================================
     5. DASHBOARD STATISTICS
  ======================================================= */

  async function loadTotalOrders() {

    try {

      const { count, error } = await supabase
        .from("orders")
        .select("id", {
          count: "exact",
          head: true
        });

      if (error) throw error;

      setStat(elements.totalOrders, count ?? 0);

    } catch (error) {

      console.error("Total Orders Error:", error);

      setStat(elements.totalOrders, "—");
    }
  }


  async function loadPendingOrders() {

    try {

      const { count, error } = await supabase
        .from("orders")
        .select("id", {
          count: "exact",
          head: true
        })
        .in("status", [
          "pending",
          "awaiting_payment"
        ]);

      if (error) throw error;

      setStat(elements.pendingOrders, count ?? 0);

    } catch (error) {

      console.error("Pending Orders Error:", error);

      setStat(elements.pendingOrders, "—");
    }
  }


  async function loadTotalProducts() {

    try {

      const { count, error } = await supabase
        .from("products")
        .select("id", {
          count: "exact",
          head: true
        });

      if (error) throw error;

      setStat(elements.totalProducts, count ?? 0);

    } catch (error) {

      console.error("Total Products Error:", error);

      setStat(elements.totalProducts, "—");
    }
  }


  async function loadTotalCustomers() {

    try {

      const { count, error } = await supabase
        .from("profiles")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("role", "customer");

      if (error) throw error;

      setStat(elements.totalCustomers, count ?? 0);

    } catch (error) {

      console.error("Total Customers Error:", error);

      setStat(elements.totalCustomers, "—");
    }
  }


  /* =======================================================
     6. TOTAL REVENUE
  ======================================================= */

  async function loadTotalRevenue() {

    if (!elements.totalRevenue) return;

    try {

      const revenueByCurrency = {};

      let offset = 0;

      while (true) {

        const { data, error } = await supabase
          .from("payments")
          .select("amount, currency")
          .eq("status", "successful")
          .range(
            offset,
            offset + PAYMENT_PAGE_SIZE - 1
          );

        if (error) throw error;

        const payments = data || [];

        payments.forEach(payment => {

          const amount = Number(payment.amount);

          if (!Number.isFinite(amount)) return;

          const currency = payment.currency || "NGN";

          revenueByCurrency[currency] =
            (revenueByCurrency[currency] || 0) + amount;

        });

        if (payments.length < PAYMENT_PAGE_SIZE) {
          break;
        }

        offset += PAYMENT_PAGE_SIZE;
      }

      elements.totalRevenue.textContent =
        formatRevenueByCurrency(revenueByCurrency);

    } catch (error) {

      console.error("Total Revenue Error:", error);

      setStat(elements.totalRevenue, "—");
    }
  }


  function formatRevenueByCurrency(revenue) {

    const currencies = Object.keys(revenue);

    if (!currencies.length) {
      return formatCurrency(0, "NGN");
    }

    return currencies
      .sort()
      .map(currency => {

        return formatCurrency(
          revenue[currency],
          currency
        );

      })
      .join(" · ");
  }


  /* =======================================================
     7. PENDING PAYMENTS
  ======================================================= */

  async function loadPendingPayments() {

    try {

      const { count, error } = await supabase
        .from("payments")
        .select("id", {
          count: "exact",
          head: true
        })
        .in("status", [
          "pending",
          "processing"
        ]);

      if (error) throw error;

      setStat(elements.pendingPayments, count ?? 0);

    } catch (error) {

      console.error("Pending Payments Error:", error);

      setStat(elements.pendingPayments, "—");
    }
  }


  /* =======================================================
     8. SERVICE REQUESTS
  ======================================================= */

  async function loadServiceRequests() {

    try {

      const { count, error } = await supabase
        .from("service_requests")
        .select("id", {
          count: "exact",
          head: true
        });

      if (error) throw error;

      setStat(elements.serviceRequests, count ?? 0);

    } catch (error) {

      console.error("Service Requests Error:", error);

      setStat(elements.serviceRequests, "—");
    }
  }


  /* =======================================================
     9. INVENTORY ALERTS
  ======================================================= */

  async function loadInventoryAlerts() {

    try {

      const { count, error } = await supabase
        .from("products")
        .select("id", {
          count: "exact",
          head: true
        })
        .eq("status", "active")
        .or(
          "availability.eq.out_of_stock,and(availability.eq.in_stock,stock_quantity.lte." +
          LOW_STOCK_THRESHOLD +
          ")"
        );

      if (error) throw error;

      setStat(elements.inventoryAlerts, count ?? 0);

    } catch (error) {

      console.error("Inventory Alerts Error:", error);

      setStat(elements.inventoryAlerts, "—");
    }
  }


  /* =======================================================
     10. STATISTICS HELPER
  ======================================================= */

  function setStat(element, value) {

    if (!element) return;

    element.textContent =
      typeof value === "number"
        ? value.toLocaleString("en-NG")
        : value;
  }


  /* =======================================================
     11. RECENT ORDERS
  ======================================================= */

  async function loadRecentOrders() {

    if (!elements.recentOrders) return;

    try {

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          customer_name,
          customer_email,
          status,
          total_amount,
          currency,
          created_at
        `)
        .order("created_at", {
          ascending: false
        })
        .limit(6);

      if (error) throw error;

      renderRecentOrders(data || []);

    } catch (error) {

      console.error("Recent Orders Error:", error);

      elements.recentOrders.innerHTML = `
        <tr>
          <td colspan="5">

            <div class="admin-empty-state">

              <p>Unable to load recent orders.</p>

              <button
                type="button"
                class="admin-retry-button"
                id="retryRecentOrders"
              >
                Try Again
              </button>

            </div>

          </td>
        </tr>
      `;

      document
        .getElementById("retryRecentOrders")
        ?.addEventListener("click", loadRecentOrders);
    }
  }


  /* =======================================================
     12. RENDER RECENT ORDERS
  ======================================================= */

  function renderRecentOrders(orders) {

    if (!elements.recentOrders) return;

    if (!orders.length) {

      elements.recentOrders.innerHTML = `
        <tr>
          <td colspan="5">

            <div class="admin-empty-state">

              <div class="admin-empty-icon">
                <i class="fa-solid fa-box-open" aria-hidden="true"></i>
              </div>

              <h3>No Orders Yet</h3>

              <p>
                Customer orders will appear here when they start
                purchasing from your store.
              </p>

            </div>

          </td>
        </tr>
      `;

      return;
    }

    const rows = orders.map(order => {

      const customerName =
        escapeHTML(order.customer_name || "Unknown Customer");

      const orderNumber =
        escapeHTML(order.order_number || "N/A");

      const email =
        escapeHTML(order.customer_email || "");

      const status = getOrderStatus(order.status);

      const statusLabel = escapeHTML(status.label);

      const date = formatDate(order.created_at);

      const total = formatCurrency(
        order.total_amount,
        order.currency
      );

      return `
        <tr>

          <td>
            <span class="admin-order-number">
              ${orderNumber}
            </span>
          </td>

          <td>
            <div class="admin-customer-cell">
              <strong>${customerName}</strong>
              <small>${email}</small>
            </div>
          </td>

          <td>${date}</td>

          <td>
            <strong>${total}</strong>
          </td>

          <td>
            <span class="admin-status-badge ${status.className}">
              ${statusLabel}
            </span>
          </td>

        </tr>
      `;

    }).join("");

    elements.recentOrders.innerHTML = rows;
  }


  /* =======================================================
     13. ORDER STATUS
  ======================================================= */

  function getOrderStatus(status) {

    const statuses = {

      pending: {
        label: "Pending",
        className: "status-pending"
      },

      awaiting_payment: {
        label: "Awaiting Payment",
        className: "status-awaiting"
      },

      payment_confirmed: {
        label: "Payment Confirmed",
        className: "status-confirmed"
      },

      processing: {
        label: "Processing",
        className: "status-processing"
      },

      ready_for_pickup: {
        label: "Ready for Pickup",
        className: "status-ready"
      },

      out_for_delivery: {
        label: "Out for Delivery",
        className: "status-delivery"
      },

      completed: {
        label: "Completed",
        className: "status-completed"
      },

      cancelled: {
        label: "Cancelled",
        className: "status-cancelled"
      }

    };

    return statuses[status] || {
      label: status || "Unknown",
      className: "status-unknown"
    };
  }


  /* =======================================================
     14. FORMATTING HELPERS
  ======================================================= */

  function formatDate(value) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }


  function formatCurrency(amount, currency) {

    const value = Number(amount);

    if (!Number.isFinite(value)) return "—";

    const currencyCode = currency || "NGN";

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2
      }).format(value);

    } catch {

      return `${escapeHTML(currencyCode)} ${value.toLocaleString("en-NG")}`;
    }
  }


  function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => {

      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[character];
    });
  }


  /* =======================================================
     15. DASHBOARD ERROR
  ======================================================= */

  function showDashboardError(message) {

    console.error("Admin Dashboard:", message);

    if (elements.recentOrders) {

      elements.recentOrders.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="admin-empty-state">
              <p>${escapeHTML(message)}</p>
            </div>
          </td>
        </tr>
      `;
    }
  }

})();
