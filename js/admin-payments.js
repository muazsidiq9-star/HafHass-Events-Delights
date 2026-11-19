/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN PAYMENTS MANAGEMENT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";


  /* =====================================================
     1. CONFIGURATION
  ====================================================== */

  const supabase = window.hafhassSupabase;

  if (!supabase) {
    console.error("Supabase client is not available.");
    return;
  }

  const PAGE_SIZE = 10;
  const DATABASE_PAGE_SIZE = 1000;
  const BATCH_SIZE = 100;
  const RECEIPT_BUCKET = "payment-receipts";

  const PAYMENT_STATUSES = [
    "pending",
    "processing",
    "successful",
    "failed",
    "refunded",
    "partially_refunded"
  ];

  const PAYMENT_METHODS = [
    "paystack",
    "bank_transfer"
  ];


  /* =====================================================
     2. DOM ELEMENTS
  ====================================================== */

  const elements = {

    currentDate: document.getElementById("adminCurrentDate"),

    totalCount: document.getElementById("paymentsTotalCount"),
    pendingCount: document.getElementById("paymentsPendingCount"),
    successfulCount: document.getElementById("paymentsSuccessfulCount"),
    failedCount: document.getElementById("paymentsFailedCount"),
    refundedCount: document.getElementById("paymentsRefundedCount"),

    search: document.getElementById("paymentsSearch"),
    statusFilter: document.getElementById("paymentsStatusFilter"),
    methodFilter: document.getElementById("paymentsMethodFilter"),
    clearFilters: document.getElementById("clearPaymentsFilters"),

    loading: document.getElementById("paymentsLoading"),
    error: document.getElementById("paymentsError"),
    errorMessage: document.getElementById("paymentsErrorMessage"),
    retryButton: document.getElementById("retryPaymentsButton"),
    empty: document.getElementById("paymentsEmpty"),
    noResults: document.getElementById("paymentsNoResults"),

    tableContainer: document.getElementById("paymentsTableContainer"),
    tableBody: document.getElementById("paymentsTableBody"),

    pagination: document.getElementById("paymentsPagination"),
    paginationInfo: document.getElementById("paymentsPaginationInfo"),
    previousPage: document.getElementById("previousPaymentsPage"),
    pageNumber: document.getElementById("paymentsPageNumber"),
    nextPage: document.getElementById("nextPaymentsPage"),

    clearSearch: document.getElementById("clearPaymentsSearch"),

    modalOverlay: document.getElementById("paymentModalOverlay"),
    modalTitle: document.getElementById("paymentModalTitle"),
    closeModal: document.getElementById("closePaymentModal"),
    modalContent: document.getElementById("paymentModalContent"),

    receiptOverlay: document.getElementById("paymentReceiptOverlay"),
    receiptPreview: document.getElementById("paymentReceiptPreview"),
    closeReceipt: document.getElementById("closePaymentReceipt")

  };


  /* =====================================================
     3. STATE
  ====================================================== */

  let allPayments = [];
  let filteredPayments = [];

  let customersMap = new Map();
  let ordersMap = new Map();

  let currentPage = 1;

  let selectedPaymentId = null;

  let isLoading = false;
  let modalRequestVersion = 0;


  /* =====================================================
     4. GENERAL HELPERS
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


  function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
  }


  function formatDate(value, includeTime = true) {

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    const options = includeTime
      ? {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }
      : {
          day: "numeric",
          month: "short",
          year: "numeric"
        };

    return new Intl.DateTimeFormat("en-NG", options).format(date);

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


  function formatStatus(status) {

    if (!status) return "Unknown";

    return String(status)
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());

  }


  function formatMethod(method) {

    if (!method) return "Unknown";

    const labels = {
      paystack: "Paystack",
      bank_transfer: "Bank Transfer"
    };

    return labels[method] || formatStatus(method);

  }


  function getInitials(name) {

    if (!name) return "CU";

    return String(name)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join("")
      .toUpperCase();

  }


  function showToast(message) {

    if (typeof window.showToast === "function") {
      window.showToast(message);
    } else {
      console.log(message);
    }

  }


  function setCurrentDate() {

    if (!elements.currentDate) return;

    elements.currentDate.textContent = new Intl.DateTimeFormat("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date());

  }


  /* =====================================================
     5. DATABASE PAGINATION
  ====================================================== */

  async function fetchAllRows(queryBuilder) {

    let results = [];
    let from = 0;

    while (true) {

      const { data, error } = await queryBuilder
        .range(from, from + DATABASE_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const rows = data || [];

      results = results.concat(rows);

      if (rows.length < DATABASE_PAGE_SIZE) {
        break;
      }

      from += DATABASE_PAGE_SIZE;

    }

    return results;

  }


  function splitIntoBatches(items, size = BATCH_SIZE) {

    const batches = [];

    for (let index = 0; index < items.length; index += size) {

      batches.push(items.slice(index, index + size));

    }

    return batches;

  }


  /* =====================================================
     6. FETCH CUSTOMER PROFILES
  ====================================================== */

  async function fetchCustomerProfiles(payments) {

    const userIds = [
      ...new Set(
        payments
          .map(payment => payment.user_id)
          .filter(Boolean)
      )
    ];

    const profilesMap = new Map();

    if (!userIds.length) {
      return profilesMap;
    }

    const batches = splitIntoBatches(userIds);

    for (const batch of batches) {

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", batch);

      if (error) {
        throw error;
      }

      (data || []).forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

    }

    return profilesMap;

  }


  /* =====================================================
     7. FETCH RELATED ORDERS
  ====================================================== */

  async function fetchRelatedOrders(payments) {

    const orderIds = [
      ...new Set(
        payments
          .map(payment => payment.order_id)
          .filter(Boolean)
      )
    ];

    const resultMap = new Map();

    if (!orderIds.length) {
      return resultMap;
    }

    const batches = splitIntoBatches(orderIds);

    for (const batch of batches) {

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          user_id,
          status,
          fulfillment_method,
          customer_name,
          customer_email,
          customer_phone,
          delivery_address,
          requested_date,
          requested_time,
          subtotal,
          delivery_fee,
          discount_amount,
          tax_amount,
          total_amount,
          currency,
          created_at
        `)
        .in("id", batch);

      if (error) {
        throw error;
      }

      (data || []).forEach(order => {
        resultMap.set(order.id, order);
      });

    }

    return resultMap;

  }


  /* =====================================================
     8. FETCH PAYMENTS
  ====================================================== */

  async function fetchPayments() {

    const payments = await fetchAllRows(
      supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
    );

    allPayments = payments;

    customersMap = await fetchCustomerProfiles(payments);

    ordersMap = await fetchRelatedOrders(payments);

    allPayments.sort((a, b) => {

      return new Date(b.created_at || 0) - new Date(a.created_at || 0);

    });

  }


  /* =====================================================
     9. LOADING AND PAGE STATES
  ====================================================== */

  function hideAllStates() {

    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.error) {
      elements.error.hidden = true;
    }

    if (elements.empty) {
      elements.empty.hidden = true;
    }

    if (elements.noResults) {
      elements.noResults.hidden = true;
    }

    if (elements.tableContainer) {
      elements.tableContainer.hidden = true;
    }

    if (elements.pagination) {
      elements.pagination.hidden = true;
    }

  }


  function showLoading() {

    hideAllStates();

    if (elements.loading) {
      elements.loading.hidden = false;
    }

  }


  function showError(error) {

    hideAllStates();

    console.error("Payments loading error:", error);

    if (elements.errorMessage) {

      elements.errorMessage.textContent =
        error?.message || "Something went wrong while loading payments.";

    }

    if (elements.error) {
      elements.error.hidden = false;
    }

  }


  /* =====================================================
     10. PAYMENT STATISTICS
  ====================================================== */

  function updateStatistics() {

    const total = allPayments.length;

    const pending = allPayments.filter(payment => {

      return payment.status === "pending";

    }).length;

    const successful = allPayments.filter(payment => {

      return payment.status === "successful";

    }).length;

    const failed = allPayments.filter(payment => {

      return payment.status === "failed";

    }).length;

    const refunded = allPayments.filter(payment => {

      return [
        "refunded",
        "partially_refunded"
      ].includes(payment.status);

    }).length;


    if (elements.totalCount) {
      elements.totalCount.textContent = total.toLocaleString("en-NG");
    }

    if (elements.pendingCount) {
      elements.pendingCount.textContent = pending.toLocaleString("en-NG");
    }

    if (elements.successfulCount) {
      elements.successfulCount.textContent = successful.toLocaleString("en-NG");
    }

    if (elements.failedCount) {
      elements.failedCount.textContent = failed.toLocaleString("en-NG");
    }

    if (elements.refundedCount) {
      elements.refundedCount.textContent = refunded.toLocaleString("en-NG");
    }

  }


  /* =====================================================
     11. PAYMENT INFORMATION HELPERS
  ====================================================== */

  function getCustomer(payment) {

    return customersMap.get(payment.user_id) || null;

  }


  function getOrder(payment) {

    return ordersMap.get(payment.order_id) || null;

  }


  function getCustomerName(payment) {

    const customer = getCustomer(payment);
    const order = getOrder(payment);

    return (
      customer?.full_name ||
      order?.customer_name ||
      "Unknown Customer"
    );

  }


  function getCustomerEmail(payment) {

    const customer = getCustomer(payment);
    const order = getOrder(payment);

    return (
      customer?.email ||
      order?.customer_email ||
      "—"
    );

  }


  function getCustomerPhone(payment) {

    const customer = getCustomer(payment);
    const order = getOrder(payment);

    return (
      customer?.phone ||
      order?.customer_phone ||
      "—"
    );

  }


  function getOrderNumber(payment) {

    const order = getOrder(payment);

    return order?.order_number || "Order unavailable";

  }


  function getReference(payment) {

    return (
      payment.transfer_reference ||
      payment.paystack_reference ||
      "—"
    );

  }


  /* =====================================================
     12. PAYMENT STATUS BADGES
  ====================================================== */

  function getStatusBadge(status) {

    const safeStatus = PAYMENT_STATUSES.includes(status)
      ? status
      : "unknown";

    return `
      <span class="admin-payment-status ${escapeHTML(safeStatus)}">
        ${escapeHTML(formatStatus(status))}
      </span>
    `;

  }


  /* =====================================================
     13. SEARCH AND FILTERING
  ====================================================== */

  function filterPayments() {

    const searchTerm = normalize(elements.search?.value);

    const status = elements.statusFilter?.value || "";

    const method = elements.methodFilter?.value || "";

    filteredPayments = allPayments.filter(payment => {

      const customerName = normalize(getCustomerName(payment));

      const customerEmail = normalize(getCustomerEmail(payment));

      const customerPhone = normalize(getCustomerPhone(payment));

      const orderNumber = normalize(getOrderNumber(payment));

      const paymentId = normalize(payment.id);

      const reference = normalize(getReference(payment));

      const paystackReference = normalize(payment.paystack_reference);

      const transferReference = normalize(payment.transfer_reference);

      const matchesSearch =
        !searchTerm ||
        customerName.includes(searchTerm) ||
        customerEmail.includes(searchTerm) ||
        customerPhone.includes(searchTerm) ||
        orderNumber.includes(searchTerm) ||
        paymentId.includes(searchTerm) ||
        reference.includes(searchTerm) ||
        paystackReference.includes(searchTerm) ||
        transferReference.includes(searchTerm);

      const matchesStatus =
        !status ||
        status === "all" ||
        payment.status === status;

      const matchesMethod =
        !method ||
        method === "all" ||
        payment.payment_method === method;

      return matchesSearch && matchesStatus && matchesMethod;

    });

    currentPage = 1;

    renderPayments();

  }


  /* =====================================================
     14. PAYMENT TABLE
  ====================================================== */

  function renderPayments() {

    hideAllStates();

    if (!filteredPayments.length) {

      if (allPayments.length === 0) {

        if (elements.empty) {
          elements.empty.hidden = false;
        }

      } else {

        if (elements.noResults) {
          elements.noResults.hidden = false;
        }

      }

      return;

    }

    const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);

    currentPage = Math.min(Math.max(currentPage, 1), totalPages);

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const pagePayments = filteredPayments.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );

    if (elements.tableContainer) {
      elements.tableContainer.hidden = false;
    }

    if (elements.tableBody) {

      elements.tableBody.innerHTML = pagePayments.map(payment => {

        const customerName = getCustomerName(payment);

        const customerEmail = getCustomerEmail(payment);

        const orderNumber = getOrderNumber(payment);

        const reference = getReference(payment);

        return `
          <tr>

            <td>
              ${payment.receipt_url
                ? '<button type="button" class="admin-payment-receipt-thumb" data-action="receipt" data-payment-id="${escapeHTML(payment.id)}" aria-label="Preview payment receipt"><i class="fa-solid fa-file-image" aria-hidden="true"></i><span>Preview</span></button>'
                : '<span class="admin-payment-no-receipt-cell">No receipt</span>'}
            </td>

            <td>
              <div class="admin-payment-transaction">

                <strong>
                  ${escapeHTML(reference)}
                </strong>

                <small>
                  ${escapeHTML(String(payment.id).slice(0, 8))}
                </small>

              </div>
            </td>


            <td>
              <span class="admin-payment-order">
                ${escapeHTML(orderNumber)}
              </span>
            </td>


            <td>
              <div class="admin-payment-customer">

                <strong>
                  ${escapeHTML(customerName)}
                </strong>

                <small>
                  ${escapeHTML(customerEmail)}
                </small>

              </div>
            </td>


            <td>
              ${escapeHTML(formatDate(payment.created_at))}
            </td>


            <td>
              <strong>
                ${escapeHTML(
                  formatCurrency(payment.amount, payment.currency)
                )}
              </strong>
            </td>


            <td>
              <span class="admin-payment-method">
                ${escapeHTML(formatMethod(payment.payment_method))}
              </span>
            </td>


            <td>
              ${getStatusBadge(payment.status)}
            </td>


            <td>
              <button
                type="button"
                class="admin-payment-action"
                data-action="view"
                data-payment-id="${escapeHTML(payment.id)}"
                aria-label="View payment details"
              >
                <i class="fas fa-eye" aria-hidden="true"></i>
                View
              </button>
            </td>

          </tr>
        `;

      }).join("");

    }

    renderPagination();

  }


  /* =====================================================
     15. PAGINATION
  ====================================================== */

  function renderPagination() {

    const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);

    const start = (currentPage - 1) * PAGE_SIZE + 1;

    const end = Math.min(
      currentPage * PAGE_SIZE,
      filteredPayments.length
    );

    if (elements.pagination) {
      elements.pagination.hidden = totalPages <= 1;
    }

    if (elements.paginationInfo) {

      elements.paginationInfo.textContent =
        `Showing ${start}–${end} of ${filteredPayments.length} payments`;

    }

    if (elements.pageNumber) {
      elements.pageNumber.textContent = `${currentPage} / ${totalPages}`;
    }

    if (elements.previousPage) {
      elements.previousPage.disabled = currentPage <= 1;
    }

    if (elements.nextPage) {
      elements.nextPage.disabled = currentPage >= totalPages;
    }

  }


  function goToPage(direction) {

    const totalPages = Math.ceil(filteredPayments.length / PAGE_SIZE);

    const nextPage = currentPage + direction;

    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }

    currentPage = nextPage;

    renderPayments();

  }


  /* =====================================================
     16. RECEIPT URL
  ====================================================== */

  async function getReceiptUrl(receiptValue) {

    if (!receiptValue) {
      return null;
    }

    const value = String(receiptValue).trim();

    if (!value) {
      return null;
    }

    /*
      If the stored value is an HTTPS URL,
      allow it as an external receipt URL.
    */

    if (/^https:\/\//i.test(value)) {

      try {

        const url = new URL(value);

        if (url.protocol !== "https:") {
          return null;
        }

        return url.href;

      } catch (error) {

        return null;

      }

    }


    /*
      Otherwise, treat it as a private
      payment-receipts storage object path.
    */

    const storagePath = value
      .replace(/^\/+/, "")
      .replace(/^payment-receipts\//, "")
      .replace(/^storage\/v1\/object\/(?:sign|authenticated|public)\/payment-receipts\//, "");

    if (!storagePath) {
      return null;
    }

    const { data, error } = await supabase
      .storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(storagePath, 600);

    if (error) {
      console.error("Receipt URL error:", error);
      return null;
    }

    return data?.signedUrl || null;

  }


  /* =====================================================
     17. MODAL HELPERS
  ====================================================== */

  function showModal() {

    if (!elements.modalOverlay) return;

    elements.modalOverlay.hidden = false;

    document.body.classList.add("modal-open");

  }


  function closePaymentModal() {

    modalRequestVersion++;

    selectedPaymentId = null;


    if (elements.modalOverlay) {
      elements.modalOverlay.hidden = true;
    }

    document.body.classList.remove("modal-open");

    if (elements.modalContent) {
      elements.modalContent.innerHTML = "";
    }

  }


  function showActionMessage(message, type = "info") {

    if (!elements.actionMessage) return;

    elements.actionMessage.hidden = false;

    elements.actionMessage.textContent = message;

    elements.actionMessage.className =
      `admin-payment-action-message ${type}`;

  }


  function detailRow(label, value) {

    return `
      <div class="admin-payment-detail-row">

        <span>${escapeHTML(label)}</span>

        <strong>${escapeHTML(value || "—")}</strong>

      </div>
    `;

  }


  function detailSection(title, content) {

    return `
      <section class="admin-payment-detail-section">

        <h3>${escapeHTML(title)}</h3>

        <div class="admin-payment-detail-grid">
          ${content}
        </div>

      </section>
    `;

  }


  /* =====================================================
     18. PAYMENT DETAILS MODAL
  ====================================================== */

  async function openPaymentDetails(paymentId) {

    const payment = allPayments.find(item => item.id === paymentId);

    if (!payment) {
      showToast("Payment record could not be found.");
      return;
    }

    selectedPaymentId = paymentId;

    const requestVersion = ++modalRequestVersion;

    const customer = getCustomer(payment);

    const order = getOrder(payment);

    if (elements.modalTitle) {
      elements.modalTitle.textContent = "Payment Details";
    }

    if (elements.modalContent) {

      elements.modalContent.innerHTML = `
        <div class="admin-payment-modal-loading">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Loading payment details...
        </div>
      `;

    }

    showModal();


    const customerName = getCustomerName(payment);

    const customerEmail = getCustomerEmail(payment);

    const customerPhone = getCustomerPhone(payment);

    const orderNumber = getOrderNumber(payment);


    let receiptUrl = null;

    if (payment.receipt_url) {
      receiptUrl = await getReceiptUrl(payment.receipt_url);
    }

    if (requestVersion !== modalRequestVersion) {
      return;
    }

    if (selectedPaymentId !== paymentId) {
      return;
    }


    const receiptHTML = receiptUrl
      ? `
          <button type="button" class="admin-payment-receipt-link" data-action="preview-receipt" data-payment-id="${escapeHTML(payment.id)}">
            <i class="fa-solid fa-eye" aria-hidden="true"></i> Preview Payment Receipt
          </button>
        `
      : `<p class="admin-payment-no-receipt">No receipt available.</p>`;


    const customerDetails = `
      ${detailRow("Customer Name", customerName)}
      ${detailRow("Email Address", customerEmail)}
      ${detailRow("Phone Number", customerPhone)}
      ${detailRow("Customer ID", payment.user_id)}
    `;


    const orderDetails = `
      ${detailRow("Order Number", orderNumber)}
      ${detailRow("Order Status", formatStatus(order?.status))}
      ${detailRow("Fulfillment", formatStatus(order?.fulfillment_method))}
      ${detailRow("Order Date", formatDate(order?.created_at))}
      ${detailRow("Requested Date", order?.requested_date || "—")}
      ${detailRow("Requested Time", order?.requested_time || "—")}
    `;


    const paymentDetails = `
      ${detailRow("Payment ID", payment.id)}
      ${detailRow("Amount", formatCurrency(payment.amount, payment.currency))}
      ${detailRow("Currency", payment.currency)}
      ${detailRow("Payment Method", formatMethod(payment.payment_method))}
      ${detailRow("Payment Status", formatStatus(payment.status))}
      ${detailRow("Created At", formatDate(payment.created_at))}
      ${detailRow("Last Updated", formatDate(payment.updated_at))}
      ${detailRow("Verified At", formatDate(payment.verified_at))}
    `;


    const referenceDetails = `
      ${detailRow("Paystack Reference", payment.paystack_reference)}
      ${detailRow("Paystack Access Code", payment.paystack_access_code)}
      ${detailRow("Transfer Reference", payment.transfer_reference)}
    `;


    const failureDetails = payment.failure_reason
      ? detailSection(
          "Failure Information",
          detailRow("Reason", payment.failure_reason)
        )
      : "";


    if (elements.modalContent) {

      elements.modalContent.innerHTML = `

        ${detailSection("Customer Information", customerDetails)}

        ${detailSection("Order Information", orderDetails)}

        ${detailSection("Payment Information", paymentDetails)}

        ${detailSection("Transaction References", referenceDetails)}

        <section class="admin-payment-detail-section">

          <h3>Payment Receipt</h3>

          ${receiptHTML}

        </section>

        ${failureDetails}

      `;

    }




  }


  /* RECEIPT PREVIEW */
  async function openReceiptPreview(paymentId) {
    const payment = allPayments.find(item => item.id === paymentId);
    if (!payment || !payment.receipt_url) { showToast("No payment receipt is available."); return; }
    elements.receiptOverlay.hidden = false;
    document.body.classList.add("modal-open");
    elements.receiptPreview.innerHTML = '<div class="admin-payment-receipt-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading receipt...</div>';
    const url = await getReceiptUrl(payment.receipt_url);
    if (elements.receiptOverlay.hidden) return;
    if (!url) { elements.receiptPreview.innerHTML = '<p class="admin-payment-receipt-error">Unable to load this receipt. Please try again.</p>'; return; }
    const pdf = new URL(url).pathname.toLowerCase().endsWith(".pdf");
    elements.receiptPreview.innerHTML = pdf
      ? '<iframe class="admin-payment-receipt-frame" title="Payment receipt PDF" src="' + escapeHTML(url) + '"></iframe>'
      : '<img class="admin-payment-receipt-image" alt="Customer payment receipt" src="' + escapeHTML(url) + '">';
  }

  function closeReceiptPreview() {
    elements.receiptOverlay.hidden = true;
    elements.receiptPreview.innerHTML = "";
    if (elements.modalOverlay.hidden) document.body.classList.remove("modal-open");
  }

  /* =====================================================
     20. EVENT DELEGATION
  ====================================================== */

  if (elements.tableBody) {
    elements.tableBody.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button || !button.dataset.paymentId) return;
      if (button.dataset.action === "view") openPaymentDetails(button.dataset.paymentId);
      if (button.dataset.action === "receipt") openReceiptPreview(button.dataset.paymentId);
    });
  }
  if (elements.modalContent) {
    elements.modalContent.addEventListener("click", event => {
      const button = event.target.closest("[data-action='preview-receipt']");
      if (button && button.dataset.paymentId) openReceiptPreview(button.dataset.paymentId);
    });
  }
  elements.closeReceipt.addEventListener("click", closeReceiptPreview);
  elements.receiptOverlay.addEventListener("click", event => {
    if (event.target === elements.receiptOverlay) closeReceiptPreview();
  });

  /* =====================================================
     21. FILTER EVENTS
  ====================================================== */

  if (elements.search) {

    elements.search.addEventListener("input", filterPayments);

  }


  if (elements.statusFilter) {

    elements.statusFilter.addEventListener("change", filterPayments);

  }


  if (elements.methodFilter) {

    elements.methodFilter.addEventListener("change", filterPayments);

  }


  if (elements.clearFilters) {

    elements.clearFilters.addEventListener("click", () => {

      if (elements.search) {
        elements.search.value = "";
      }

      if (elements.statusFilter) {
        elements.statusFilter.value = "";
      }

      if (elements.methodFilter) {
        elements.methodFilter.value = "";
      }

      filterPayments();

    });

  }


  if (elements.clearSearch) {

    elements.clearSearch.addEventListener("click", () => {

      if (elements.search) {
        elements.search.value = "";
      }

      filterPayments();

    });

  }


  /* =====================================================
     22. PAGINATION EVENTS
  ====================================================== */

  if (elements.previousPage) {

    elements.previousPage.addEventListener("click", () => {
      goToPage(-1);
    });

  }


  if (elements.nextPage) {

    elements.nextPage.addEventListener("click", () => {
      goToPage(1);
    });

  }


  /* =====================================================
     23. MODAL EVENTS
  ====================================================== */

  if (elements.closeModal) {

    elements.closeModal.addEventListener("click", closePaymentModal);

  }


  if (elements.modalOverlay) {

    elements.modalOverlay.addEventListener("click", event => {

      if (event.target === elements.modalOverlay) {
        closePaymentModal();
      }

    });

  }


  document.addEventListener("keydown", event => {

    if (event.key === "Escape" && !elements.receiptOverlay.hidden) {
      closeReceiptPreview();
      return;
    }

    if (
      event.key === "Escape" &&
      elements.modalOverlay &&
      !elements.modalOverlay.hidden
    ) {
      closePaymentModal();
    }

  });


  /* =====================================================
     24. RETRY EVENT
  ====================================================== */

  if (elements.retryButton) {

    elements.retryButton.addEventListener("click", loadPayments);

  }


  /* =====================================================
     25. INITIALIZE PAYMENTS PAGE
  ====================================================== */

  async function loadPayments() {

    if (isLoading) {
      return;
    }

    isLoading = true;

    showLoading();

    try {

      await fetchPayments();

      updateStatistics();

      filterPayments();

    } catch (error) {

      showError(error);

    } finally {

      isLoading = false;

    }

  }


  /* =====================================================
     26. INITIALIZATION
  ====================================================== */

  setCurrentDate();

  loadPayments();


});