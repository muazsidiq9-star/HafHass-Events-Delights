/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN CUSTOMERS MANAGEMENT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";


  /* =====================================================
     1. SUPABASE
  ====================================================== */

  const supabase = window.hafhassSupabase;

  if (!supabase) {
    console.error("Supabase client is not available.");
    return;
  }


  /* =====================================================
     2. CONFIGURATION
  ====================================================== */

  const PAGE_SIZE = 10;

  let customers = [];
  let filteredCustomers = [];

  let currentPage = 1;
  let isLoading = false;


  /* =====================================================
     3. DOM ELEMENTS
  ====================================================== */

  const elements = {

    totalCustomers: document.getElementById("totalCustomers"),
    activeCustomers: document.getElementById("activeCustomers"),
    newCustomers: document.getElementById("newCustomers"),
    customersWithOrders: document.getElementById("customersWithOrders"),

    search: document.getElementById("customerSearch"),
    statusFilter: document.getElementById("customerStatusFilter"),
    clearFilters: document.getElementById("clearCustomerFilters"),
    resultCount: document.getElementById("customerResultCount"),

    loading: document.getElementById("customersLoading"),
    error: document.getElementById("customersError"),
    empty: document.getElementById("customersEmpty"),
    retry: document.getElementById("retryCustomersButton"),

    tableContainer: document.getElementById("customersTableContainer"),
    tableBody: document.getElementById("customersTableBody"),

    pagination: document.getElementById("customersPagination"),
    paginationInfo: document.getElementById("customersPaginationInfo"),
    previousPage: document.getElementById("customersPreviousPage"),
    nextPage: document.getElementById("customersNextPage"),
    pageNumber: document.getElementById("customersPageNumber"),

    modalOverlay: document.getElementById("customerModalOverlay"),
    modalContent: document.getElementById("customerModalContent"),
    closeModal: document.getElementById("closeCustomerModal")

  };


  /* =====================================================
     4. HTML SECURITY
  ====================================================== */

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


  function safeImageUrl(value) {

    if (!value) return "";

    try {

      const url = new URL(value, window.location.origin);

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return "";
      }

      return url.href;

    } catch {
      return "";
    }

  }


  /* =====================================================
     5. FORMATTERS
  ====================================================== */

  function formatDate(date) {

    if (!date) return "N/A";

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "N/A";
    }

    return parsedDate.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  }


  function formatCurrency(amount, currency = "NGN") {

    const value = Number(amount) || 0;

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: String(currency || "NGN").trim(),
        maximumFractionDigits: 2
      }).format(value);

    } catch {

      return `${currency || "NGN"} ${value.toLocaleString()}`;

    }

  }


  function getInitials(name) {

    if (!name) return "C";

    return String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("");

  }


  function normalizeStatus(status) {

    return String(status || "")
      .trim()
      .toLowerCase();

  }


  function getMonthStart() {

    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  }


  /* =====================================================
     6. CUSTOMER STATUS
  ====================================================== */

  function getCustomerStatus(customer) {

    return customer.is_active
      ? "active"
      : "inactive";

  }


  /* =====================================================
     7. TOTAL SPENT DISPLAY
  ====================================================== */

  function getTotalSpentDisplay(customer) {

    const totals = customer.payment_totals || {};

    const currencies = Object.keys(totals);

    if (currencies.length === 0) {
      return formatCurrency(0);
    }

    return currencies
      .sort()
      .map(currency =>
        formatCurrency(totals[currency], currency)
      )
      .join(" · ");

  }


  /* =====================================================
     8. CUSTOMER STATISTICS
  ====================================================== */

  function updateStatistics() {

    const monthStart = getMonthStart();

    const activeCount = customers.filter(
      customer => customer.is_active === true
    ).length;


    const newCount = customers.filter(customer => {

      if (!customer.created_at) return false;

      return new Date(customer.created_at) >= monthStart;

    }).length;


    const customersWithOrdersCount = customers.filter(
      customer => customer.orders.length > 0
    ).length;


    elements.totalCustomers.textContent =
      customers.length.toLocaleString();

    elements.activeCustomers.textContent =
      activeCount.toLocaleString();

    elements.newCustomers.textContent =
      newCount.toLocaleString();

    elements.customersWithOrders.textContent =
      customersWithOrdersCount.toLocaleString();

  }


  /* =====================================================
     9. LOAD CUSTOMERS
  ====================================================== */

  async function loadCustomers() {

    if (isLoading) return;

    isLoading = true;

    showState("loading");


    try {

      /* ================================================
         CUSTOMER PROFILES
      ================================================= */

      const {
        data: profiles,
        error: profilesError
      } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          avatar_url,
          is_active,
          created_at,
          updated_at
        `)
        .eq("role", "customer")
        .order("created_at", {
          ascending: false
        });


      if (profilesError) {
        throw profilesError;
      }


      /* ================================================
         CUSTOMER ORDERS
      ================================================= */

      const {
        data: orders,
        error: ordersError
      } = await supabase
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
        .order("created_at", {
          ascending: false
        });


      if (ordersError) {
        throw ordersError;
      }


      /* ================================================
         SUCCESSFUL PAYMENTS
      ================================================= */

      const {
        data: payments,
        error: paymentsError
      } = await supabase
        .from("payments")
        .select(`
          id,
          user_id,
          amount,
          currency,
          status
        `)
        .eq("status", "successful");


      if (paymentsError) {
        throw paymentsError;
      }


      /* ================================================
         GROUP ORDERS BY CUSTOMER
      ================================================= */

      const orderMap = new Map();

      (orders || []).forEach(order => {

        if (!order.user_id) return;

        if (!orderMap.has(order.user_id)) {
          orderMap.set(order.user_id, []);
        }

        orderMap.get(order.user_id).push(order);

      });


      /* ================================================
         GROUP SUCCESSFUL PAYMENTS BY CUSTOMER
      ================================================= */

      const paymentMap = new Map();

      (payments || []).forEach(payment => {

        if (!payment.user_id) return;

        const currency = String(
          payment.currency || "NGN"
        ).trim().toUpperCase();

        if (!paymentMap.has(payment.user_id)) {
          paymentMap.set(payment.user_id, {});
        }

        const customerPayments =
          paymentMap.get(payment.user_id);

        customerPayments[currency] =
          (customerPayments[currency] || 0) +
          (Number(payment.amount) || 0);

      });


      /* ================================================
         BUILD CUSTOMER RECORDS
      ================================================= */

      customers = (profiles || []).map(profile => {

        const customerOrders =
          orderMap.get(profile.id) || [];


        const paymentTotals =
          paymentMap.get(profile.id) || {};


        const sortedOrders = [...customerOrders].sort(
          (a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );


        const latestOrder = sortedOrders[0] || {};


        return {

          ...profile,

          full_name:
            profile.full_name ||
            latestOrder.customer_name ||
            "Unnamed Customer",

          email:
            profile.email ||
            latestOrder.customer_email ||
            "",

          phone:
            profile.phone ||
            latestOrder.customer_phone ||
            "",

          orders: sortedOrders,

          total_orders: customerOrders.length,

          payment_totals: paymentTotals

        };

      });


      /* ================================================
         INITIALIZE PAGE
      ================================================= */

      updateStatistics();

      applyFilters();


      console.log(
        `Successfully loaded ${customers.length} customers.`
      );


    } catch (error) {

      console.error("Customers loading error:", error);

      showState("error");

    } finally {

      isLoading = false;

    }

  }


  /* =====================================================
     10. PAGE STATES
  ====================================================== */

  function showState(state) {

    elements.loading.hidden = state !== "loading";

    elements.error.hidden = state !== "error";

    elements.empty.hidden = state !== "empty";

    elements.tableContainer.hidden = state !== "table";

    elements.pagination.hidden = state !== "table";

  }


  /* =====================================================
     11. SEARCH AND FILTERS
  ====================================================== */

  function applyFilters() {

    const searchTerm =
      elements.search.value.trim().toLowerCase();

    const selectedStatus =
      elements.statusFilter.value;


    filteredCustomers = customers.filter(customer => {

      const searchableText = [

        customer.full_name,
        customer.email,
        customer.phone

      ].join(" ").toLowerCase();


      const matchesSearch =
        searchableText.includes(searchTerm);


      const customerStatus =
        getCustomerStatus(customer);


      const matchesStatus =
        selectedStatus === "all" ||
        customerStatus === selectedStatus;


      return matchesSearch && matchesStatus;

    });


    currentPage = 1;

    renderCustomers();

  }


  /* =====================================================
     12. RENDER CUSTOMERS
  ====================================================== */

  function renderCustomers() {

    const total = filteredCustomers.length;


    elements.resultCount.innerHTML = `
      Showing
      <strong>${total.toLocaleString()}</strong>
      ${total === 1 ? "customer" : "customers"}
    `;


    if (total === 0) {

      elements.tableBody.innerHTML = "";

      showState("empty");

      return;

    }


    const totalPages = Math.ceil(
      total / PAGE_SIZE
    );


    if (currentPage > totalPages) {
      currentPage = totalPages;
    }


    const startIndex =
      (currentPage - 1) * PAGE_SIZE;


    const endIndex =
      Math.min(startIndex + PAGE_SIZE, total);


    const pageCustomers =
      filteredCustomers.slice(startIndex, endIndex);


    elements.tableBody.innerHTML =
      pageCustomers.map(renderCustomerRow).join("");


    updatePagination(
      total,
      totalPages,
      startIndex,
      endIndex
    );


    showState("table");

  }


  /* =====================================================
     13. CUSTOMER TABLE ROW
  ====================================================== */

  function renderCustomerRow(customer) {

    const customerId = escapeHTML(customer.id);

    const name = escapeHTML(customer.full_name);

    const email = escapeHTML(
      customer.email || "No email"
    );

    const phone = escapeHTML(
      customer.phone || "No phone number"
    );

    const status = getCustomerStatus(customer);

    const initials = escapeHTML(
      getInitials(customer.full_name)
    );


    const imageUrl = safeImageUrl(customer.avatar_url);


    const avatar = imageUrl
      ? `
        <img
          src="${escapeHTML(imageUrl)}"
          alt="${name}"
          loading="lazy"
          onerror="this.style.display='none'"
        >
      `
      : `<span>${initials}</span>`;


    const actionLabel = customer.is_active
      ? "Deactivate customer"
      : "Activate customer";


    const actionText = customer.is_active
      ? "Deactivate"
      : "Activate";


    return `

      <tr>

        <td>

          <div class="admin-customer-info">

            <div class="admin-customer-avatar">
              ${avatar}
            </div>

            <div class="admin-customer-info-details">

              <strong>${name}</strong>

              <span>Customer</span>

            </div>

          </div>

        </td>


        <td>

          <div class="admin-customer-contact">

            <span>${email}</span>

            <small>${phone}</small>

          </div>

        </td>


        <td>
          ${customer.total_orders.toLocaleString()}
        </td>


        <td>
          ${escapeHTML(getTotalSpentDisplay(customer))}
        </td>


        <td>

          <span class="admin-customer-status ${status}">

            <i class="fa-solid fa-circle"></i>

            ${status}

          </span>

        </td>


        <td>

          <button
            type="button"
            class="admin-customer-toggle ${status}"
            data-customer-action="toggle"
            data-customer-id="${customerId}"
            aria-label="${actionLabel}"
            title="${actionLabel}"
          >

            ${actionText}

          </button>

        </td>


        <td>

          <button
            type="button"
            class="admin-customer-action"
            data-customer-action="view"
            data-customer-id="${customerId}"
            aria-label="View customer details"
            title="View Customer"
          >

            <i class="fa-solid fa-eye"></i>

          </button>

        </td>

      </tr>

    `;

  }


  /* =====================================================
     14. PAGINATION
  ====================================================== */

  function updatePagination(
    total,
    totalPages,
    startIndex,
    endIndex
  ) {

    elements.paginationInfo.textContent =
      `Showing ${startIndex + 1}–${endIndex} of ${total} customers`;


    elements.pageNumber.textContent =
      `${currentPage} / ${totalPages}`;


    elements.previousPage.disabled =
      currentPage <= 1;


    elements.nextPage.disabled =
      currentPage >= totalPages;

  }


  /* =====================================================
     15. ACTIVATE / DEACTIVATE CUSTOMER
  ====================================================== */

  async function toggleCustomerStatus(customerId, button) {

    const customer = customers.find(
      item => item.id === customerId
    );


    if (!customer || !button) return;


    const newStatus = !customer.is_active;


    const action = newStatus
      ? "activate"
      : "deactivate";


    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${customer.full_name}?`
    );


    if (!confirmed) return;


    button.disabled = true;

    button.textContent = "Updating...";


    try {

      const {
        data,
        error
      } = await supabase
        .from("profiles")
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", customerId)
        .eq("role", "customer")
        .select(`
          id,
          is_active,
          updated_at
        `)
        .single();


      if (error) {
        throw error;
      }


      if (!data) {
        throw new Error(
          "Customer status could not be updated."
        );
      }


      customer.is_active = data.is_active;

      customer.updated_at = data.updated_at;


      updateStatistics();

      applyFilters();


      console.log(
        `Customer ${customerId} ${action}d successfully.`
      );


        } catch (error) {

      console.error("Customer status update failed:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        fullError: error
      });

      const errorMessage =
        error?.message ||
        error?.details ||
        "An unknown error occurred.";

      window.alert(
        `Unable to ${action} customer.\n\nError: ${errorMessage}`
      );

      renderCustomers();

    }

  }


  /* =====================================================
     16. CUSTOMER DETAILS MODAL
  ====================================================== */

  function openCustomerModal(customerId) {

    const customer = customers.find(
      item => item.id === customerId
    );


    if (!customer) return;


    const name = escapeHTML(customer.full_name);

    const email = escapeHTML(
      customer.email || "Not provided"
    );

    const phone = escapeHTML(
      customer.phone || "Not provided"
    );

    const initials = escapeHTML(
      getInitials(customer.full_name)
    );

    const status = getCustomerStatus(customer);

    const imageUrl = safeImageUrl(customer.avatar_url);


    const avatar = imageUrl
      ? `
        <img
          src="${escapeHTML(imageUrl)}"
          alt="${name}"
        >
      `
      : `<span>${initials}</span>`;


    /* ================================================
       CUSTOMER PROFILE
    ================================================= */

    const profileHTML = `

      <div class="admin-customer-details-profile">

        <div class="admin-customer-avatar">
          ${avatar}
        </div>


        <div>

          <h3>${name}</h3>

          <p>
            Customer since ${formatDate(customer.created_at)}
          </p>

        </div>

      </div>


      <div class="admin-customer-details-grid">


        <div class="admin-customer-detail-item">

          <span>Email Address</span>

          <strong>${email}</strong>

        </div>


        <div class="admin-customer-detail-item">

          <span>Phone Number</span>

          <strong>${phone}</strong>

        </div>


        <div class="admin-customer-detail-item">

          <span>Account Status</span>

          <strong>
            ${status === "active" ? "Active" : "Inactive"}
          </strong>

        </div>


        <div class="admin-customer-detail-item">

          <span>Total Orders</span>

          <strong>${customer.total_orders}</strong>

        </div>


        <div class="admin-customer-detail-item">

          <span>Total Spent</span>

          <strong>
            ${escapeHTML(getTotalSpentDisplay(customer))}
          </strong>

        </div>


        <div class="admin-customer-detail-item">

          <span>Last Updated</span>

          <strong>
            ${formatDate(customer.updated_at)}
          </strong>

        </div>


      </div>

    `;


    /* ================================================
       ORDER HISTORY
    ================================================= */

    let orderHistoryHTML = "";


    if (customer.orders.length === 0) {

      orderHistoryHTML = `

        <div class="admin-customer-no-orders">

          <i class="fa-solid fa-bag-shopping"></i>

          <p>
            This customer has not placed any orders yet.
          </p>

        </div>

      `;

    } else {

      orderHistoryHTML = `

        <div class="admin-customer-orders-list">

          ${customer.orders.map(order => {

            const orderNumber = escapeHTML(
              order.order_number || order.id
            );

            const orderStatus = escapeHTML(
              String(order.status || "unknown")
                .replace(/_/g, " ")
            );


            return `

              <div class="admin-customer-order-item">

                <div>

                  <strong>${orderNumber}</strong>

                  <span>
                    ${formatDate(order.created_at)}
                    · ${orderStatus}
                  </span>

                </div>


                <p>
                  ${formatCurrency(
                    order.total_amount,
                    order.currency
                  )}
                </p>

              </div>

            `;

          }).join("")}

        </div>

      `;

    }


    elements.modalContent.innerHTML = `

      ${profileHTML}


      <div class="admin-customer-modal-section">

        <h3>
          <i class="fa-solid fa-clock-rotate-left"></i>
          Order History
        </h3>

        ${orderHistoryHTML}

      </div>

    `;


    elements.modalOverlay.hidden = false;

    document.body.style.overflow = "hidden";

  }


  /* =====================================================
     17. CLOSE CUSTOMER MODAL
  ====================================================== */

  function closeCustomerModal() {

    elements.modalOverlay.hidden = true;

    document.body.style.overflow = "";

  }


  /* =====================================================
     18. EVENT LISTENERS
  ====================================================== */

  elements.search.addEventListener(
    "input",
    applyFilters
  );


  elements.statusFilter.addEventListener(
    "change",
    applyFilters
  );


  elements.clearFilters.addEventListener(
    "click",
    () => {

      elements.search.value = "";

      elements.statusFilter.value = "all";

      applyFilters();

    }
  );


  elements.retry.addEventListener(
    "click",
    loadCustomers
  );


  /* CUSTOMER ACTIONS */

  elements.tableBody.addEventListener(
    "click",
    event => {

      const button = event.target.closest(
        "[data-customer-action]"
      );

      if (!button) return;


      const customerId =
        button.dataset.customerId;


      const action =
        button.dataset.customerAction;


      if (action === "view") {

        openCustomerModal(customerId);

      }


      if (action === "toggle") {

        toggleCustomerStatus(
          customerId,
          button
        );

      }

    }
  );


  /* CLOSE MODAL */

  elements.closeModal.addEventListener(
    "click",
    closeCustomerModal
  );


  elements.modalOverlay.addEventListener(
    "click",
    event => {

      if (event.target === elements.modalOverlay) {
        closeCustomerModal();
      }

    }
  );


  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        !elements.modalOverlay.hidden
      ) {

        closeCustomerModal();

      }

    }
  );


  /* PAGINATION */

  elements.previousPage.addEventListener(
    "click",
    () => {

      if (currentPage > 1) {

        currentPage--;

        renderCustomers();

      }

    }
  );


  elements.nextPage.addEventListener(
    "click",
    () => {

      const totalPages = Math.ceil(
        filteredCustomers.length / PAGE_SIZE
      );

      if (currentPage < totalPages) {

        currentPage++;

        renderCustomers();

      }

    }
  );


  /* =====================================================
     19. INITIALIZE
  ====================================================== */

  const yearElement =
    document.getElementById("adminYear");

  if (yearElement) {

    yearElement.textContent =
      new Date().getFullYear();

  }


  loadCustomers();


});