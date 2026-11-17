/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN ORDERS MANAGEMENT
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

  const DATABASE_PAGE_SIZE = 1000;

  const PROFILE_BATCH_SIZE = 100;

  const ORDER_STATUSES = [
    "pending",
    "awaiting_payment",
    "payment_confirmed",
    "processing",
    "ready_for_pickup",
    "out_for_delivery",
    "completed",
    "cancelled"
  ];

  const PAYMENT_STATUSES = [
    "pending",
    "processing",
    "successful",
    "failed",
    "refunded",
    "partially_refunded"
  ];


  /* =====================================================
     3. STATE
  ====================================================== */

  let allOrders = [];

  let filteredOrders = [];

  let customerProfiles = {};

  let orderPayments = {};

  let currentPage = 1;

  let selectedOrder = null;

  let savingStatus = false;


  /* =====================================================
     4. ELEMENTS
  ====================================================== */

  const $ = (id) => document.getElementById(id);

  const elements = {

    // Header

    currentDate: $("adminCurrentDate"),

    // Statistics

    totalCount: $("ordersTotalCount"),

    pendingCount: $("ordersPendingCount"),

    processingCount: $("ordersProcessingCount"),

    completedCount: $("ordersCompletedCount"),

    // Filters

    search: $("ordersSearch"),

    statusFilter: $("ordersStatusFilter"),

    paymentFilter: $("ordersPaymentFilter"),

    resultCount: $("ordersResultCount"),

    clearFilters: $("clearOrdersFilters"),

    // States

    loading: $("ordersLoading"),

    error: $("ordersError"),

    errorMessage: $("ordersErrorMessage"),

    retryButton: $("retryOrdersButton"),

    empty: $("ordersEmpty"),

    noResults: $("ordersNoResults"),

    clearSearch: $("clearOrdersSearch"),

    // Table

    tableContainer: $("ordersTableContainer"),

    tableBody: $("ordersTableBody"),

    // Pagination

    pagination: $("ordersPagination"),

    paginationInfo: $("ordersPaginationInfo"),

    pageNumber: $("ordersPageNumber"),

    previousPage: $("previousOrdersPage"),

    nextPage: $("nextOrdersPage"),

    // Modal

    modalOverlay: $("orderModalOverlay"),

    modalContent: $("orderModalContent"),

    modalTitle: $("orderModalTitle"),

    closeModal: $("closeOrderModal"),

    // Status update

    updateStatus: $("updateOrderStatus"),

    saveStatusButton: $("saveOrderStatusButton"),

    statusMessage: $("orderStatusMessage")

  };


  /* =====================================================
     5. UTILITIES
  ====================================================== */

  function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

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


  function formatStatus(status) {

    return String(status || "unknown")
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());

  }


  function formatDate(date) {

    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

  }


  function formatDateTime(date) {

    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "—";
    }

    return parsed.toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short"
    });

  }


  function formatCurrency(amount, currency = "NGN") {

    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return "—";
    }

    const validCurrency = String(currency || "NGN").trim().toUpperCase();

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: validCurrency
      }).format(value);

    } catch (error) {

      return `${validCurrency} ${value.toLocaleString("en-NG")}`;

    }

  }


  function formatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    return number.toLocaleString("en-NG");

  }


  function getOrderNumber(order) {

    return order.order_number ||
      `#${String(order.id || "").slice(0, 8).toUpperCase()}`;

  }


  function getCustomerProfile(order) {

    return customerProfiles[order.user_id] || {};

  }


  function getCustomerName(order) {

    const profile = getCustomerProfile(order);

    return (
      order.customer_name ||
      profile.full_name ||
      "Customer"
    );

  }


  function getCustomerPhone(order) {

    const profile = getCustomerProfile(order);

    return (
      order.customer_phone ||
      profile.phone ||
      "Not provided"
    );

  }


  function getCustomerEmail(order) {

    const profile = getCustomerProfile(order);

    return (
      order.customer_email ||
      profile.email ||
      "Not provided"
    );

  }


  function getOrderPayments(order) {

    return orderPayments[order.id] || [];

  }


  function getLatestPayment(order) {

    const payments = getOrderPayments(order);

    if (!payments.length) {
      return null;
    }

    return [...payments].sort((a, b) => {

      return new Date(b.created_at || 0) -
        new Date(a.created_at || 0);

    })[0];

  }


  function getPaymentStatus(order) {

    const latestPayment = getLatestPayment(order);

    return latestPayment?.status || "unpaid";

  }


  function getAddressValue(address) {

    if (!address) {
      return "Not provided";
    }

    if (typeof address === "string") {
      return address;
    }

    if (typeof address !== "object") {
      return String(address);
    }

    const preferredFields = [
      "full_name",
      "recipient_name",
      "address",
      "address_line_1",
      "address_line_2",
      "street",
      "city",
      "state",
      "postal_code",
      "country",
      "phone"
    ];

    const values = preferredFields
      .map(key => address[key])
      .filter(value => value !== null && value !== undefined && value !== "");

    if (values.length) {
      return values.join(", ");
    }

    return Object.entries(address)
      .filter(([, value]) =>
        value !== null &&
        value !== undefined &&
        typeof value !== "object" &&
        value !== ""
      )
      .map(([key, value]) => `${formatStatus(key)}: ${value}`)
      .join(", ") || "Not provided";

  }


  function showElement(element) {

    if (element) {
      element.hidden = false;
    }

  }


  function hideElement(element) {

    if (element) {
      element.hidden = true;
    }

  }


  function setStatusMessage(message, type = "") {

    if (!elements.statusMessage) return;

    elements.statusMessage.textContent = message;

    elements.statusMessage.className =
      "admin-order-status-message" +
      (type ? ` ${type}` : "");

  }


  /* =====================================================
     6. DATABASE PAGINATION
  ====================================================== */

  async function fetchAllRows(table, select, configureQuery = null) {

    let allRows = [];

    let from = 0;

    while (true) {

      let query = supabase
        .from(table)
        .select(select);

      if (configureQuery) {
        query = configureQuery(query);
      }

      const { data, error } = await query.range(
        from,
        from + DATABASE_PAGE_SIZE - 1
      );

      if (error) {
        throw error;
      }

      const rows = data || [];

      allRows = allRows.concat(rows);

      if (rows.length < DATABASE_PAGE_SIZE) {
        break;
      }

      from += DATABASE_PAGE_SIZE;

    }

    return allRows;

  }


  /* =====================================================
     7. DATE
  ====================================================== */

  function renderDate() {

    if (!elements.currentDate) return;

    elements.currentDate.textContent =
      new Date().toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

  }


  /* =====================================================
     8. LOADING AND ERROR STATES
  ====================================================== */

  function hideAllStates() {

    hideElement(elements.loading);

    hideElement(elements.error);

    hideElement(elements.empty);

    hideElement(elements.noResults);

    hideElement(elements.tableContainer);

    hideElement(elements.pagination);

  }


  function showLoading() {

    hideAllStates();

    showElement(elements.loading);

  }


  function showError(message) {

    hideAllStates();

    if (elements.errorMessage) {
      elements.errorMessage.textContent = message;
    }

    showElement(elements.error);

  }


  /* =====================================================
     9. LOAD CUSTOMER PROFILES
  ====================================================== */

  async function loadCustomerProfiles(orders) {

    customerProfiles = {};

    const userIds = [
      ...new Set(
        orders
          .map(order => order.user_id)
          .filter(Boolean)
      )
    ];

    if (!userIds.length) {
      return;
    }

    for (
      let index = 0;
      index < userIds.length;
      index += PROFILE_BATCH_SIZE
    ) {

      const batch = userIds.slice(
        index,
        index + PROFILE_BATCH_SIZE
      );

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", batch);

      if (error) {

        console.warn(
          "Customer profiles could not be loaded:",
          error.message
        );

        continue;

      }

      (data || []).forEach(profile => {

        customerProfiles[profile.id] = profile;

      });

    }

  }


  /* =====================================================
     10. LOAD PAYMENTS
  ====================================================== */

  async function loadOrderPayments() {

    orderPayments = {};

    const payments = await fetchAllRows(
      "payments",
      `
        id,
        order_id,
        user_id,
        payment_method,
        status,
        amount,
        currency,
        paystack_reference,
        transfer_reference,
        receipt_url,
        verified_at,
        failure_reason,
        created_at,
        updated_at
      `,
      query => query.order("created_at", {
        ascending: false
      })
    );

    payments.forEach(payment => {

      if (!payment.order_id) return;

      if (!orderPayments[payment.order_id]) {
        orderPayments[payment.order_id] = [];
      }

      orderPayments[payment.order_id].push(payment);

    });

  }


  /* =====================================================
     11. LOAD ORDERS
  ====================================================== */

  async function loadOrders() {

    showLoading();

    try {

      allOrders = await fetchAllRows(
        "orders",
        "*",
        query => query.order("created_at", {
          ascending: false
        })
      );


      await Promise.all([
        loadCustomerProfiles(allOrders),
        loadOrderPayments()
      ]);


      renderStatistics();

      populateStatusFilters();

      applyFilters();

    } catch (error) {

      console.error("Orders loading error:", error);

      showError(
        error.message || "Unable to load customer orders."
      );

    }

  }


  /* =====================================================
     12. STATISTICS
  ====================================================== */

  function renderStatistics() {

    const total = allOrders.length;

    const pending = allOrders.filter(order =>
      [
        "pending",
        "awaiting_payment"
      ].includes(order.status)
    ).length;

    const processing = allOrders.filter(order =>
      [
        "payment_confirmed",
        "processing",
        "ready_for_pickup",
        "out_for_delivery"
      ].includes(order.status)
    ).length;

    const completed = allOrders.filter(order =>
      order.status === "completed"
    ).length;


    if (elements.totalCount) {
      elements.totalCount.textContent = formatNumber(total);
    }

    if (elements.pendingCount) {
      elements.pendingCount.textContent = formatNumber(pending);
    }

    if (elements.processingCount) {
      elements.processingCount.textContent = formatNumber(processing);
    }

    if (elements.completedCount) {
      elements.completedCount.textContent = formatNumber(completed);
    }

  }


  /* =====================================================
     13. POPULATE FILTERS
  ====================================================== */

  function populateStatusFilters() {

    if (!elements.statusFilter || !elements.paymentFilter) {
      return;
    }

    const currentStatus = elements.statusFilter.value;

    elements.statusFilter.innerHTML = `

      <option value="all">
        All Order Statuses
      </option>

      ${ORDER_STATUSES.map(status => `

        <option value="${status}">
          ${escapeHTML(formatStatus(status))}
        </option>

      `).join("")}

    `;

    elements.statusFilter.value =
      ORDER_STATUSES.includes(currentStatus)
        ? currentStatus
        : "all";


    const currentPayment = elements.paymentFilter.value;

    elements.paymentFilter.innerHTML = `

      <option value="all">
        All Payment Statuses
      </option>

      ${PAYMENT_STATUSES.map(status => `

        <option value="${status}">
          ${escapeHTML(formatStatus(status))}
        </option>

      `).join("")}

      <option value="unpaid">
        Unpaid / No Payment Record
      </option>

    `;

    const validPaymentValues = [
      ...PAYMENT_STATUSES,
      "unpaid"
    ];

    elements.paymentFilter.value =
      validPaymentValues.includes(currentPayment)
        ? currentPayment
        : "all";

  }


  /* =====================================================
     14. APPLY FILTERS
  ====================================================== */

  function applyFilters() {

    const searchTerm = elements.search
      ? elements.search.value.trim().toLowerCase()
      : "";

    const status = elements.statusFilter
      ? elements.statusFilter.value
      : "all";

    const payment = elements.paymentFilter
      ? elements.paymentFilter.value
      : "all";


    filteredOrders = allOrders.filter(order => {

      const orderNumber = getOrderNumber(order).toLowerCase();

      const customerName = getCustomerName(order).toLowerCase();

      const customerPhone = getCustomerPhone(order).toLowerCase();

      const customerEmail = getCustomerEmail(order).toLowerCase();


      const matchesSearch =
        !searchTerm ||
        orderNumber.includes(searchTerm) ||
        customerName.includes(searchTerm) ||
        customerPhone.includes(searchTerm) ||
        customerEmail.includes(searchTerm);


      const matchesStatus =
        status === "all" ||
        order.status === status;


      const payments = getOrderPayments(order);

      const matchesPayment =
        payment === "all"
          ? true
          : payment === "unpaid"
            ? payments.length === 0
            : payments.some(item => item.status === payment);


      return matchesSearch &&
        matchesStatus &&
        matchesPayment;

    });


    currentPage = 1;

    renderOrders();

  }


  /* =====================================================
     15. STATUS BADGES
  ====================================================== */

  function getOrderStatusBadge(status) {

    const safeStatus = ORDER_STATUSES.includes(status)
      ? status
      : "unknown";

    return `

      <span class="admin-order-status ${safeStatus}">
        ${escapeHTML(formatStatus(status))}
      </span>

    `;

  }


  function getPaymentStatusBadge(status) {

    const safeStatus = PAYMENT_STATUSES.includes(status)
      ? status
      : "unknown";

    return `

      <span class="admin-payment-status ${safeStatus}">
        ${escapeHTML(formatStatus(status))}
      </span>

    `;

  }


  /* =====================================================
     16. RENDER ORDERS
  ====================================================== */

  function renderOrders() {

    hideAllStates();

    if (elements.resultCount) {
      elements.resultCount.textContent =
        formatNumber(filteredOrders.length);
    }


    if (!allOrders.length) {

      showElement(elements.empty);

      return;

    }


    if (!filteredOrders.length) {

      showElement(elements.noResults);

      return;

    }


    const totalPages = Math.ceil(
      filteredOrders.length / PAGE_SIZE
    );

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const pageOrders = filteredOrders.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );


    if (elements.tableBody) {

      elements.tableBody.innerHTML = pageOrders.map(order => {

        const customerName = getCustomerName(order);

        const paymentStatus = getPaymentStatus(order);

        return `

          <tr>

            <td>
              <strong>
                ${escapeHTML(getOrderNumber(order))}
              </strong>
            </td>


            <td>
              <strong>
                ${escapeHTML(customerName)}
              </strong>
            </td>


            <td>
              ${escapeHTML(formatDate(order.created_at))}
            </td>


            <td>
              ${escapeHTML(
                formatCurrency(order.total_amount, order.currency)
              )}
            </td>


            <td>
              ${getPaymentStatusBadge(paymentStatus)}
            </td>


            <td>
              ${getOrderStatusBadge(order.status)}
            </td>


            <td>

              <button
                type="button"
                class="admin-order-action"
                data-order-id="${escapeHTML(order.id)}"
                title="View order details"
                aria-label="View order details"
              >
                <i class="fa-solid fa-eye" aria-hidden="true"></i>
              </button>

            </td>

          </tr>

        `;

      }).join("");

    }


    showElement(elements.tableContainer);


    /* PAGINATION */

    showElement(elements.pagination);

    if (elements.pageNumber) {
      elements.pageNumber.textContent = currentPage;
    }

    if (elements.paginationInfo) {

      elements.paginationInfo.textContent =
        `Showing ${startIndex + 1}–${Math.min(
          startIndex + PAGE_SIZE,
          filteredOrders.length
        )} of ${filteredOrders.length} orders`;

    }

    if (elements.previousPage) {
      elements.previousPage.disabled = currentPage <= 1;
    }

    if (elements.nextPage) {
      elements.nextPage.disabled = currentPage >= totalPages;
    }

  }


  /* =====================================================
     17. MODAL SECTION HELPERS
  ====================================================== */

  function renderDetailItem(label, value) {

    return `

      <div class="admin-order-detail-item">

        <span>${escapeHTML(label)}</span>

        <strong>${escapeHTML(value || "—")}</strong>

      </div>

    `;

  }


  function renderModalSection(title, content, icon = "") {

    return `

      <section class="admin-order-modal-section">

        <h3>

          ${icon
            ? `<i class="${escapeHTML(icon)}" aria-hidden="true"></i>`
            : ""
          }

          ${escapeHTML(title)}

        </h3>

        ${content}

      </section>

    `;

  }


  function renderDetailsGrid(details) {

    return `

      <div class="admin-order-details-grid">

        ${details.map(([label, value]) =>
          renderDetailItem(label, value)
        ).join("")}

      </div>

    `;

  }


  function renderTextBlock(label, value) {

    if (!value) return "";

    return `

      <div class="admin-order-text-block">

        <span>${escapeHTML(label)}</span>

        <p>${escapeHTML(value)}</p>

      </div>

    `;

  }


  /* =====================================================
     18. LOAD ORDER ITEMS
  ====================================================== */

  async function loadOrderItems(orderId) {

    const { data, error } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      throw error;
    }

    return data || [];

  }


  /* =====================================================
     19. LOAD ORDER STATUS HISTORY
  ====================================================== */

  async function loadOrderHistory(orderId) {

    const { data, error } = await supabase
      .from("order_status_history")
      .select(`
        id,
        old_status,
        new_status,
        changed_by,
        change_note,
        change_source,
        created_at
      `)
      .eq("order_id", orderId)
      .order("created_at", {
        ascending: false
      });

    if (error) {
      throw error;
    }

    return data || [];

  }


  /* =====================================================
     20. RENDER ORDER ITEMS
  ====================================================== */

  function renderOrderItems(items) {

    if (!items.length) {

      return renderModalSection(
        "Order Items",
        `<p class="admin-order-empty-note">No order items were found.</p>`,
        "fa-solid fa-box-open"
      );

    }


    const itemCards = items.map(item => {

      const image = item.product_image_url
        ? `
          <img
            src="${escapeHTML(item.product_image_url)}"
            alt="${escapeHTML(item.product_name || "Order item")}"
            class="admin-order-item-image"
            loading="lazy"
          >
        `
        : `
          <div class="admin-order-item-image-placeholder">
            <i class="fa-solid fa-image" aria-hidden="true"></i>
          </div>
        `;


      const options = item.selected_options
        ? escapeHTML(
            typeof item.selected_options === "string"
              ? item.selected_options
              : JSON.stringify(item.selected_options)
          )
        : "";


      const customText = item.custom_text
        ? renderTextBlock("Custom Text", item.custom_text)
        : "";


      const notes = item.customer_notes
        ? renderTextBlock("Item Notes", item.customer_notes)
        : "";


      const referenceImage = item.reference_image_url
        ? `
          <a
            href="${escapeHTML(item.reference_image_url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Reference Image
          </a>
        `
        : "";


      return `

        <article class="admin-order-item-card">

          <div class="admin-order-item-main">

            ${image}

            <div class="admin-order-item-info">

              <strong>
                ${escapeHTML(item.product_name || "Unnamed item")}
              </strong>

              <span>
                ${escapeHTML(item.product_sku || "No SKU")}
              </span>

              <span>
                ${escapeHTML(formatStatus(item.item_type || "product"))}
              </span>

              <span>
                Quantity: ${formatNumber(item.quantity)}
              </span>

            </div>

            <div class="admin-order-item-pricing">

              <strong>
                ${escapeHTML(
                  formatCurrency(item.line_total, item.currency)
                )}
              </strong>

              <span>
                ${escapeHTML(
                  formatCurrency(item.unit_price, item.currency)
                )}
                each
              </span>

            </div>

          </div>


          ${item.product_description
            ? renderTextBlock("Description", item.product_description)
            : ""
          }

          ${options
            ? renderTextBlock("Selected Options", options)
            : ""
          }

          ${customText}

          ${notes}

          ${referenceImage
            ? `<div class="admin-order-reference-image">${referenceImage}</div>`
            : ""
          }

        </article>

      `;

    }).join("");


    return renderModalSection(
      "Order Items",
      `<div class="admin-order-items-list">${itemCards}</div>`,
      "fa-solid fa-box-open"
    );

  }


  /* =====================================================
     21. PAYMENT RECEIPT URL
  ====================================================== */

  async function getPaymentReceiptUrl(receiptUrl) {

    if (!receiptUrl) {
      return null;
    }

    if (/^https?:\/\//i.test(receiptUrl)) {
      return receiptUrl;
    }

    try {

      const { data, error } = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(receiptUrl, 60 * 10);

      if (error) {
        console.warn("Receipt URL error:", error.message);
        return null;
      }

      return data?.signedUrl || null;

    } catch (error) {

      console.warn("Unable to generate receipt URL:", error);

      return null;

    }

  }


  /* =====================================================
     22. RENDER PAYMENT INFORMATION
  ====================================================== */

  async function renderPaymentInformation(order) {

    const payments = getOrderPayments(order);

    if (!payments.length) {

      return renderModalSection(
        "Payment Information",
        `
          <p class="admin-order-empty-note">
            No payment records are currently associated with this order.
          </p>
        `,
        "fa-solid fa-wallet"
      );

    }


    const paymentCards = await Promise.all(
      payments.map(async payment => {

        const receiptUrl = await getPaymentReceiptUrl(
          payment.receipt_url
        );


        const references = [

          [
            "Paystack Reference",
            payment.paystack_reference
          ],

          [
            "Transfer Reference",
            payment.transfer_reference
          ],

          [
            "Payment ID",
            payment.id
          ]

        ].filter(([, value]) => value);


        return `

          <article class="admin-order-payment-card">

            <div class="admin-order-payment-heading">

              <strong>
                ${escapeHTML(formatStatus(payment.payment_method))}
              </strong>

              ${getPaymentStatusBadge(payment.status)}

            </div>


            ${renderDetailsGrid([

              [
                "Amount",
                formatCurrency(payment.amount, payment.currency)
              ],

              [
                "Created",
                formatDateTime(payment.created_at)
              ],

              [
                "Verified At",
                formatDateTime(payment.verified_at)
              ]

            ])}


            ${references.length
              ? renderDetailsGrid(references)
              : ""
            }


            ${payment.failure_reason
              ? renderTextBlock("Failure Reason", payment.failure_reason)
              : ""
            }


            ${receiptUrl
              ? `
                <a
                  href="${escapeHTML(receiptUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="admin-order-receipt-link"
                >
                  <i class="fa-solid fa-file-image" aria-hidden="true"></i>
                  View Payment Receipt
                </a>
              `
              : payment.receipt_url
                ? `
                  <p class="admin-order-empty-note">
                    Receipt exists but could not be opened.
                  </p>
                `
                : ""
            }

          </article>

        `;

      })
    );


    return renderModalSection(
      "Payment Information",
      `<div class="admin-order-payments-list">${paymentCards.join("")}</div>`,
      "fa-solid fa-wallet"
    );

  }


  /* =====================================================
     23. RENDER DELIVERY INFORMATION
  ====================================================== */

  function renderDeliveryInformation(order) {

    const deliveryAddress = getAddressValue(
      order.delivery_address
    );

    const fulfillment = order.fulfillment_method
      ? formatStatus(order.fulfillment_method)
      : "Not specified";


    return renderModalSection(
      "Delivery & Fulfilment",
      renderDetailsGrid([

        [
          "Fulfilment Method",
          fulfillment
        ],

        [
          "Requested Date",
          formatDate(order.requested_date)
        ],

        [
          "Requested Time",
          order.requested_time || "Not specified"
        ],

        [
          "Delivery Address",
          deliveryAddress
        ]

      ]),
      "fa-solid fa-truck-fast"
    );

  }


  /* =====================================================
     24. RENDER COST BREAKDOWN
  ====================================================== */

  function renderCostBreakdown(order) {

    const currency = order.currency || "NGN";

    const costs = [

      [
        "Subtotal",
        order.subtotal
      ],

      [
        "Discount",
        order.discount_amount
      ],

      [
        "Tax",
        order.tax_amount
      ],

      [
        "Delivery Fee",
        order.delivery_fee
      ]

    ];


    const rows = costs.map(([label, amount]) => {

      return `

        <div class="admin-order-cost-row">

          <span>${escapeHTML(label)}</span>

          <strong>
            ${escapeHTML(formatCurrency(amount, currency))}
          </strong>

        </div>

      `;

    }).join("");


    return renderModalSection(
      "Cost Breakdown",
      `

        <div class="admin-order-cost-breakdown">

          ${rows}

          <div class="admin-order-cost-row total">

            <span>Total Amount</span>

            <strong>
              ${escapeHTML(
                formatCurrency(order.total_amount, currency)
              )}
            </strong>

          </div>

        </div>

      `,
      "fa-solid fa-receipt"
    );

  }


  /* =====================================================
     25. RENDER STATUS HISTORY
  ====================================================== */

  async function renderStatusHistory(order) {

    let history = [];

    try {

      history = await loadOrderHistory(order.id);

    } catch (error) {

      console.error("Order history loading error:", error);

      return renderModalSection(
        "Order Activity",
        `
          <p class="admin-order-empty-note">
            Unable to load order status history.
          </p>
        `,
        "fa-solid fa-clock-rotate-left"
      );

    }


    if (!history.length) {

      return renderModalSection(
        "Order Activity",
        `
          <p class="admin-order-empty-note">
            No status history is available for this order yet.
          </p>
        `,
        "fa-solid fa-clock-rotate-left"
      );

    }


    const changedByIds = [
      ...new Set(
        history
          .map(item => item.changed_by)
          .filter(Boolean)
      )
    ];


    const changedByProfiles = {};

    if (changedByIds.length) {

      for (
        let index = 0;
        index < changedByIds.length;
        index += PROFILE_BATCH_SIZE
      ) {

        const batch = changedByIds.slice(
          index,
          index + PROFILE_BATCH_SIZE
        );

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", batch);

        if (!error) {

          (data || []).forEach(profile => {

            changedByProfiles[profile.id] = profile.full_name;

          });

        }

      }

    }


    const historyCards = history.map(item => {

      const changedBy = item.changed_by
        ? changedByProfiles[item.changed_by] || "Administrator"
        : "System";


      return `

        <article class="admin-order-history-item">

          <div class="admin-order-history-indicator"></div>

          <div class="admin-order-history-content">

            <strong>
              ${escapeHTML(
                formatStatus(item.new_status)
              )}
            </strong>

            <span>
              ${item.old_status
                ? `From ${escapeHTML(formatStatus(item.old_status))}`
                : "Initial status"
              }
            </span>

            <small>
              ${escapeHTML(formatDateTime(item.created_at))}
            </small>

            <small>
              Changed by: ${escapeHTML(changedBy)}
            </small>

            ${item.change_source
              ? `
                <small>
                  Source: ${escapeHTML(formatStatus(item.change_source))}
                </small>
              `
              : ""
            }

            ${item.change_note
              ? renderTextBlock("Note", item.change_note)
              : ""
            }

          </div>

        </article>

      `;

    }).join("");


    return renderModalSection(
      "Order Activity & Status History",
      `<div class="admin-order-history-list">${historyCards}</div>`,
      "fa-solid fa-clock-rotate-left"
    );

  }


  /* =====================================================
     26. OPEN ORDER DETAILS
  ====================================================== */

  async function openOrderDetails(order) {

    if (!order || !elements.modalOverlay) {
      return;
    }

    selectedOrder = order;

    elements.modalTitle.textContent =
      `Order ${getOrderNumber(order)}`;


    elements.modalContent.innerHTML = `

      <div class="admin-order-details-loading">

        <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>

        <p>Loading complete order information...</p>

      </div>

    `;


    elements.updateStatus.innerHTML =
      ORDER_STATUSES.map(status => `

        <option value="${status}">
          ${escapeHTML(formatStatus(status))}
        </option>

      `).join("");


    elements.updateStatus.value =
      ORDER_STATUSES.includes(order.status)
        ? order.status
        : "pending";


    setStatusMessage("");

    elements.saveStatusButton.disabled = false;

    elements.saveStatusButton.innerHTML = `
      <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
      Update Status
    `;


    showElement(elements.modalOverlay);

    document.body.style.overflow = "hidden";


    try {

      const [items, paymentSection, historySection] =
        await Promise.all([

          loadOrderItems(order.id),

          renderPaymentInformation(order),

          renderStatusHistory(order)

        ]);


      // Do not overwrite a different order if the modal
      // was switched while these requests were running.

      if (!selectedOrder || selectedOrder.id !== order.id) {
        return;
      }


      const customerSection = renderModalSection(
        "Customer Information",
        renderDetailsGrid([

          [
            "Customer Name",
            getCustomerName(order)
          ],

          [
            "Email Address",
            getCustomerEmail(order)
          ],

          [
            "Phone Number",
            getCustomerPhone(order)
          ],

          [
            "Customer ID",
            order.user_id || "Guest / Not available"
          ]

        ]),
        "fa-solid fa-user"
      );


      const orderSection = renderModalSection(
        "Order Information",
        renderDetailsGrid([

          [
            "Order Number",
            getOrderNumber(order)
          ],

          [
            "Order Date",
            formatDateTime(order.created_at)
          ],

          [
            "Last Updated",
            formatDateTime(order.updated_at)
          ],

          [
            "Order Status",
            formatStatus(order.status)
          ]

        ]),
        "fa-solid fa-cart-shopping"
      );


      const notesSection = renderModalSection(
        "Customer Notes & Special Instructions",
        `
          ${renderTextBlock(
            "Order Notes",
            order.customer_notes
          ) || `
            <p class="admin-order-empty-note">
              No customer notes were provided.
            </p>
          `}

          ${order.cancellation_reason
            ? renderTextBlock(
                "Cancellation Reason",
                order.cancellation_reason
              )
            : ""
          }
        `,
        "fa-solid fa-note-sticky"
      );


      elements.modalContent.innerHTML = `

        ${customerSection}

        ${orderSection}

        ${renderOrderItems(items)}

        ${paymentSection}

        ${renderDeliveryInformation(order)}

        ${renderCostBreakdown(order)}

        ${notesSection}

        ${historySection}

      `;


    } catch (error) {

      console.error("Order details loading error:", error);

      if (!selectedOrder || selectedOrder.id !== order.id) {
        return;
      }

      elements.modalContent.innerHTML = `

        <div class="admin-order-details-error">

          <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>

          <h3>Unable to Load Complete Order Details</h3>

          <p>${escapeHTML(
            error.message || "Please try again."
          )}</p>

        </div>

      `;

    }

  }


  /* =====================================================
     27. CLOSE ORDER MODAL
  ====================================================== */

  function closeOrderModal() {

    hideElement(elements.modalOverlay);

    document.body.style.overflow = "";

    selectedOrder = null;

  }


  /* =====================================================
     28. UPDATE ORDER STATUS
  ====================================================== */

  async function updateOrderStatus() {

    if (!selectedOrder || savingStatus) {
      return;
    }

    const newStatus = elements.updateStatus.value;

    if (!ORDER_STATUSES.includes(newStatus)) {
      return;
    }

    if (newStatus === selectedOrder.status) {

      setStatusMessage("No status changes were made.");

      return;

    }


    const orderId = selectedOrder.id;

    savingStatus = true;

    elements.saveStatusButton.disabled = true;

    elements.saveStatusButton.innerHTML = `

      <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>

      Updating...

    `;


    try {

      const { data, error } = await supabase
        .from("orders")
        .update({
          status: newStatus
        })
        .eq("id", orderId)
        .select("*")
        .single();


      if (error) {
        throw error;
      }


      const index = allOrders.findIndex(
        order => order.id === orderId
      );

      if (index !== -1) {
        allOrders[index] = data;
      }


      selectedOrder = data;


      renderStatistics();

      applyFilters();


      await openOrderDetails(data);


      setStatusMessage(
        "Order status updated successfully.",
        "success"
      );


    } catch (error) {

      console.error("Order status update error:", error);

      setStatusMessage(
        error.message || "Unable to update order status.",
        "error"
      );

    } finally {

      savingStatus = false;

      if (elements.saveStatusButton) {

        elements.saveStatusButton.disabled = false;

        elements.saveStatusButton.innerHTML = `

          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>

          Update Status

        `;

      }

    }

  }


  /* =====================================================
     29. CLEAR FILTERS
  ====================================================== */

  function clearFilters() {

    if (elements.search) {
      elements.search.value = "";
    }

    if (elements.statusFilter) {
      elements.statusFilter.value = "all";
    }

    if (elements.paymentFilter) {
      elements.paymentFilter.value = "all";
    }

    applyFilters();

  }


  /* =====================================================
     30. EVENT LISTENERS
  ====================================================== */

  if (elements.search) {

    elements.search.addEventListener(
      "input",
      applyFilters
    );

  }


  if (elements.statusFilter) {

    elements.statusFilter.addEventListener(
      "change",
      applyFilters
    );

  }


  if (elements.paymentFilter) {

    elements.paymentFilter.addEventListener(
      "change",
      applyFilters
    );

  }


  if (elements.clearFilters) {

    elements.clearFilters.addEventListener(
      "click",
      clearFilters
    );

  }


  if (elements.clearSearch) {

    elements.clearSearch.addEventListener(
      "click",
      clearFilters
    );

  }


  if (elements.retryButton) {

    elements.retryButton.addEventListener(
      "click",
      loadOrders
    );

  }


  /* TABLE ACTIONS */

  if (elements.tableBody) {

    elements.tableBody.addEventListener("click", event => {

      const button = event.target.closest("[data-order-id]");

      if (!button) return;

      const orderId = button.dataset.orderId;

      const order = allOrders.find(
        item => item.id === orderId
      );

      if (order) {
        openOrderDetails(order);
      }

    });

  }


  /* PAGINATION */

  if (elements.previousPage) {

    elements.previousPage.addEventListener("click", () => {

      if (currentPage > 1) {

        currentPage--;

        renderOrders();

      }

    });

  }


  if (elements.nextPage) {

    elements.nextPage.addEventListener("click", () => {

      const totalPages = Math.ceil(
        filteredOrders.length / PAGE_SIZE
      );

      if (currentPage < totalPages) {

        currentPage++;

        renderOrders();

      }

    });

  }


  /* MODAL */

  if (elements.closeModal) {

    elements.closeModal.addEventListener(
      "click",
      closeOrderModal
    );

  }


  if (elements.modalOverlay) {

    elements.modalOverlay.addEventListener("click", event => {

      if (event.target === elements.modalOverlay) {
        closeOrderModal();
      }

    });

  }


  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      elements.modalOverlay &&
      !elements.modalOverlay.hidden
    ) {

      closeOrderModal();

    }

  });


  /* UPDATE STATUS */

  if (elements.saveStatusButton) {

    elements.saveStatusButton.addEventListener(
      "click",
      updateOrderStatus
    );

  }


  /* =====================================================
     31. INITIALIZE
  ====================================================== */

  renderDate();

  loadOrders();

});