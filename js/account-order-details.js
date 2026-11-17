// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER ORDER DETAILS
// ======================================================

(() => {
  "use strict";


  // ====================================================
  // DEPENDENCIES
  // ====================================================

  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;
  const db = window.hafhassSupabase;

  if (!auth || !guards || !db) {

    console.error(
      "HAFHASS Order Details: Required dependencies unavailable."
    );

    return;

  }


  // ====================================================
  // PAGE ELEMENTS
  // ====================================================

  const elements = {

    loading: document.getElementById("orderDetailsLoading"),
    error: document.getElementById("orderDetailsError"),
    errorMessage: document.getElementById("orderDetailsErrorMessage"),
    content: document.getElementById("orderDetailsContent"),

    retryButton: document.getElementById("retryOrderDetailsButton"),

    reference: document.getElementById("orderReference"),
    status: document.getElementById("orderStatus"),
    date: document.getElementById("orderDate"),
    paymentStatus: document.getElementById("paymentStatus"),
    total: document.getElementById("orderTotal"),

    progress: document.getElementById("orderProgress"),

    items: document.getElementById("orderItemsList"),
    subtotal: document.getElementById("orderSubtotal"),
    deliveryFee: document.getElementById("orderDeliveryFee"),
    finalTotal: document.getElementById("orderFinalTotal"),

    paymentMethod: document.getElementById("orderPaymentMethod"),
    paymentStatusDetails: document.getElementById("orderPaymentStatus"),

    transactionReference: document.getElementById(
      "orderTransactionReference"
    ),

    customerName: document.getElementById("deliveryCustomerName"),
    phone: document.getElementById("deliveryPhone"),
    deliveryMethod: document.getElementById("deliveryMethod"),
    address: document.getElementById("deliveryAddress"),
    notes: document.getElementById("orderCustomerNotes")

  };


  // ====================================================
  // PAGE STATE
  // ====================================================

  let currentUser = null;
  let currentOrderId = null;
  let retryInitialized = false;


  // ====================================================
  // STATUS CONFIGURATION
  // ====================================================

  const STATUS_CONFIG = {

    pending: {
      label: "Pending",
      className: "pending",
      progress: 1
    },

    awaiting_payment: {
      label: "Awaiting Payment",
      className: "pending",
      progress: 1
    },

    payment_confirmed: {
      label: "Payment Confirmed",
      className: "confirmed",
      progress: 2
    },

    processing: {
      label: "Processing",
      className: "processing",
      progress: 3
    },

    ready_for_pickup: {
      label: "Ready for Pickup",
      className: "ready",
      progress: 4
    },

    out_for_delivery: {
      label: "Out for Delivery",
      className: "delivery",
      progress: 4
    },

    completed: {
      label: "Completed",
      className: "completed",
      progress: 5
    },

    cancelled: {
      label: "Cancelled",
      className: "cancelled",
      progress: 0
    }

  };


  // ====================================================
  // GENERAL HELPERS
  // ====================================================

  function getElement(id) {

    return document.getElementById(id);

  }


  function setText(element, value) {

    if (!element) return;

    element.textContent =
      value !== null &&
      value !== undefined &&
      value !== ""
        ? String(value)
        : "—";

  }


  function formatCurrency(amount, currency = "NGN") {

    const numericAmount = Number(amount ?? 0);

    if (!Number.isFinite(numericAmount)) {
      return "—";
    }

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: String(currency || "NGN").trim(),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(numericAmount);

    } catch (error) {

      return `₦${numericAmount.toFixed(2)}`;

    }

  }


  function formatDate(dateValue) {

    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);

  }


  function formatLabel(value) {

    if (!value) return "—";

    return String(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());

  }


  function getStatus(status) {

    const key = String(status || "pending")
      .toLowerCase()
      .trim();

    return STATUS_CONFIG[key] || {

      label: formatLabel(key),
      className: "pending",
      progress: 1

    };

  }


  function getErrorMessage(error) {

    return (
      error?.message ||
      error?.details ||
      error?.hint ||
      "Something went wrong while retrieving your order."
    );

  }


  // ====================================================
  // PAGE STATES
  // ====================================================

  function showLoading() {

    if (elements.loading) {
      elements.loading.hidden = false;
    }

    if (elements.error) {
      elements.error.hidden = true;
    }

    if (elements.content) {
      elements.content.hidden = true;
    }

  }


  function showError(message) {

    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.content) {
      elements.content.hidden = true;
    }

    if (elements.error) {
      elements.error.hidden = false;
    }

    setText(elements.errorMessage, message);

  }


  function showContent() {

    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.error) {
      elements.error.hidden = true;
    }

    if (elements.content) {
      elements.content.hidden = false;
    }

  }


  // ====================================================
  // FETCH ORDER
  // ====================================================

  async function loadOrder() {

    if (!currentUser?.id || !currentOrderId) {

      throw new Error(
        "Your customer session or order reference is unavailable."
      );

    }


    // --------------------------------------------------
    // FETCH ORDER
    // --------------------------------------------------

    const { data: order, error: orderError } = await db
      .from("orders")
      .select("*")
      .eq("id", currentOrderId)
      .eq("user_id", currentUser.id)
      .maybeSingle();


    if (orderError) {
      throw orderError;
    }


    if (!order) {

      throw new Error(
        "This order could not be found or you do not have permission to view it."
      );

    }


    // --------------------------------------------------
    // FETCH ORDER ITEMS
    // --------------------------------------------------

    const {
      data: orderItems,
      error: itemsError
    } = await db
      .from("order_items")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", {
        ascending: true
      });


    if (itemsError) {
      throw itemsError;
    }


    // --------------------------------------------------
    // FETCH PAYMENTS
    // --------------------------------------------------

    const {
      data: payments,
      error: paymentsError
    } = await db
      .from("payments")
      .select("*")
      .eq("order_id", order.id)
      .eq("user_id", currentUser.id)
      .order("created_at", {
        ascending: false
      });


    if (paymentsError) {
      throw paymentsError;
    }


    // --------------------------------------------------
    // FETCH ORDER STATUS HISTORY
    // --------------------------------------------------

    const {
      data: statusHistory,
      error: historyError
    } = await db
      .from("order_status_history")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", {
        ascending: true
      });


    if (historyError) {
      throw historyError;
    }


    // --------------------------------------------------
    // RENDER ORDER
    // --------------------------------------------------

    renderOrder(
      order,
      orderItems || [],
      payments || [],
      statusHistory || []
    );

  }


  // ====================================================
  // RENDER ORDER SUMMARY
  // ====================================================

  function renderOrder(order, items, payments, history) {

    const currency = order.currency || "NGN";

    const status = getStatus(order.status);


    // ORDER REFERENCE

    setText(
      elements.reference,
      order.order_number
    );


    // ORDER DATE

    setText(
      elements.date,
      formatDate(order.created_at)
    );


    // ORDER TOTAL

    setText(
      elements.total,
      formatCurrency(order.total_amount, currency)
    );


    // ORDER STATUS

    if (elements.status) {

      elements.status.textContent = status.label;

      elements.status.className =
        `order-status order-status-${status.className}`;

    }


    // PAYMENT STATUS

    const latestPayment = payments[0] || null;

    const paymentLabel = latestPayment
      ? formatLabel(latestPayment.status)
      : "Not yet recorded";


    setText(
      elements.paymentStatus,
      paymentLabel
    );


    // FINANCIAL SUMMARY

    setText(
      elements.subtotal,
      formatCurrency(order.subtotal, currency)
    );

    setText(
      elements.deliveryFee,
      formatCurrency(order.delivery_fee, currency)
    );

    setText(
      elements.finalTotal,
      formatCurrency(order.total_amount, currency)
    );


    // OTHER SECTIONS

    renderProgress(order.status, history);

    renderItems(items, currency);

    renderPayment(payments);

    renderDelivery(order);

  }


  // ====================================================
  // ORDER PROGRESS
  // ====================================================

  function renderProgress(statusValue, history) {

    if (!elements.progress) return;

    const status = String(statusValue || "pending")
      .toLowerCase()
      .trim();

    const steps = elements.progress.querySelectorAll(
      ".order-progress-step"
    );

    const currentStatus = getStatus(status);


    // REMOVE OLD CANCELLATION MESSAGE

    const existingMessage = elements.progress.querySelector(
      ".order-cancelled-message"
    );

    if (existingMessage) {
      existingMessage.remove();
    }


    // UPDATE PROGRESS STEPS

    steps.forEach((step, index) => {

      step.classList.remove(
        "completed",
        "current"
      );

      const stepNumber = index + 1;

      const icon = step.querySelector(
        ".order-progress-icon"
      );

      if (icon) {
        icon.textContent = String(stepNumber);
      }


      if (status === "cancelled") {
        return;
      }


      if (stepNumber < currentStatus.progress) {

        step.classList.add("completed");

        if (icon) {
          icon.textContent = "✓";
        }

      } else if (stepNumber === currentStatus.progress) {

        step.classList.add("current");

      }

    });


    // CANCELLATION MESSAGE

    if (status === "cancelled") {

      const cancellation = document.createElement("div");

      cancellation.className = "order-cancelled-message";

      cancellation.textContent =
        "This order has been cancelled.";

      elements.progress.appendChild(cancellation);

    }


    // STATUS HISTORY IS AVAILABLE FOR FUTURE TIMELINE DETAILS.

    if (Array.isArray(history)) {

      console.info(
        "HAFHASS Orders: Status history loaded.",
        history.length
      );

    }

  }


  // ====================================================
  // ORDER ITEMS
  // ====================================================

  function renderItems(items, currency) {

    if (!elements.items) return;

    elements.items.replaceChildren();


    if (!items.length) {

      const message = document.createElement("p");

      message.className = "order-items-empty";

      message.textContent =
        "No individual items were found for this order.";

      elements.items.appendChild(message);

      return;

    }


    items.forEach(item => {

      const card = document.createElement("article");

      card.className = "order-item";


      // ------------------------------------------------
      // PRODUCT IMAGE
      // ------------------------------------------------

      const imageWrapper = document.createElement("div");

      imageWrapper.className = "order-item-image";


      if (item.product_image_url) {

        const image = document.createElement("img");

        image.src = item.product_image_url;

        image.alt = item.product_name || "Ordered product";

        image.loading = "lazy";

        image.onerror = () => {

          image.remove();

          imageWrapper.textContent = "No Image";

        };

        imageWrapper.appendChild(image);

      } else {

        imageWrapper.textContent = "No Image";

      }


      // ------------------------------------------------
      // PRODUCT INFORMATION
      // ------------------------------------------------

      const information = document.createElement("div");

      information.className = "order-item-information";


      const name = document.createElement("h3");

      name.textContent =
        item.product_name || "Unnamed Product";


      const quantity = document.createElement("p");

      quantity.textContent =
        `Quantity: ${item.quantity ?? 0}`;


      information.appendChild(name);

      information.appendChild(quantity);


      // PRODUCT SKU

      if (item.product_sku) {

        const sku = document.createElement("p");

        sku.textContent = `SKU: ${item.product_sku}`;

        information.appendChild(sku);

      }


      // SELECTED OPTIONS

      const options = item.selected_options;

      if (
        options &&
        typeof options === "object" &&
        Object.keys(options).length
      ) {

        const optionText = document.createElement("p");

        optionText.className = "order-item-options";

        optionText.textContent =
          "Options: " + JSON.stringify(options);

        information.appendChild(optionText);

      }


      // CUSTOM TEXT

      if (item.custom_text) {

        const customText = document.createElement("p");

        customText.textContent =
          `Custom text: ${item.custom_text}`;

        information.appendChild(customText);

      }


      // CUSTOMER NOTES

      if (item.customer_notes) {

        const notes = document.createElement("p");

        notes.textContent =
          `Item notes: ${item.customer_notes}`;

        information.appendChild(notes);

      }


      // REFERENCE IMAGE

      if (item.reference_image_url) {

        const referenceLink = document.createElement("a");

        referenceLink.href = item.reference_image_url;

        referenceLink.target = "_blank";

        referenceLink.rel = "noopener noreferrer";

        referenceLink.textContent =
          "View Reference Image";

        referenceLink.className = "order-item-reference";

        information.appendChild(referenceLink);

      }


      // ------------------------------------------------
      // PRICE INFORMATION
      // ------------------------------------------------

      const pricing = document.createElement("div");

      pricing.className = "order-item-pricing";


      const unitPrice = document.createElement("p");

      unitPrice.textContent =
        `${formatCurrency(item.unit_price, currency)} each`;


      const lineTotal = document.createElement("strong");

      lineTotal.textContent =
        formatCurrency(item.line_total, currency);


      pricing.appendChild(unitPrice);

      pricing.appendChild(lineTotal);


      // ------------------------------------------------
      // ASSEMBLE CARD
      // ------------------------------------------------

      card.appendChild(imageWrapper);

      card.appendChild(information);

      card.appendChild(pricing);


      elements.items.appendChild(card);

    });

  }


  // ====================================================
  // PAYMENT INFORMATION
  // ====================================================

  function renderPayment(payments) {

    const payment = payments[0] || null;


    if (!payment) {

      setText(
        elements.paymentMethod,
        "Not yet recorded"
      );

      setText(
        elements.paymentStatusDetails,
        "No payment record"
      );

      setText(
        elements.transactionReference,
        "Not available"
      );

      return;

    }


    setText(
      elements.paymentMethod,
      formatLabel(payment.payment_method)
    );


    setText(
      elements.paymentStatusDetails,
      formatLabel(payment.status)
    );


    const reference =
      payment.paystack_reference ||
      payment.transfer_reference ||
      "Not available";


    setText(
      elements.transactionReference,
      reference
    );

  }


  // ====================================================
  // DELIVERY INFORMATION
  // ====================================================

  function renderDelivery(order) {

    setText(
      elements.customerName,
      order.customer_name
    );


    setText(
      elements.phone,
      order.customer_phone
    );


    setText(
      elements.deliveryMethod,
      formatLabel(order.fulfillment_method)
    );


    // DELIVERY ADDRESS IS STORED AS JSONB.

    const address = order.delivery_address;


    if (!address) {

      setText(
        elements.address,
        "No delivery address provided."
      );

    } else if (typeof address === "string") {

      setText(
        elements.address,
        address
      );

    } else if (typeof address === "object") {

      const addressParts = [

        address.address_line,
        address.address_line_1,
        address.address_line_2,
        address.street,
        address.city,
        address.state,
        address.postal_code,
        address.country

      ].filter(Boolean);


      setText(
        elements.address,
        addressParts.length
          ? addressParts.join(", ")
          : JSON.stringify(address)
      );

    } else {

      setText(
        elements.address,
        "No delivery address provided."
      );

    }


    setText(
      elements.notes,
      order.customer_notes || "No additional notes."
    );

  }


// ====================================================
// CUSTOMER INFORMATION
// ====================================================

async function loadCustomerInformation(user, verifiedProfile = null) {

  let profile = verifiedProfile;


  // REUSE THE PROFILE RETURNED BY THE PAGE GUARD.

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

      profile =
        result?.profile ||
        result?.data?.profile ||
        result?.data ||
        null;

    } catch (error) {

      console.error(
        "Order Details: Profile loading error:",
        error
      );

    }

  }


  // CUSTOMER NAME

  const fullName =

    profile?.full_name ||

    profile?.name ||

    user?.user_metadata?.full_name ||

    user?.user_metadata?.name ||

    "Customer";


  // CUSTOMER EMAIL

  const email =

    profile?.email ||

    user?.email ||

    "";


  console.info("Order Details: sidebar data", {
    hasProfile: Boolean(profile),
    fullName,
    email,
    sidebarNameEl: Boolean(getElement("sidebarUserName"))
  });

  // UPDATE SIDEBAR

  setText(
    getElement("sidebarUserName"),
    fullName
  );

  setText(
    getElement("sidebarUserEmail"),
    email
  );


  // CUSTOMER INITIALS

  const initials = fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("");


  setText(
    getElement("avatarInitials"),
    initials || "C"
  );


  // CUSTOMER PROFILE IMAGE

  const accountAvatar = getElement("accountAvatar");

  if (
    profile?.avatar_url &&
    accountAvatar
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

        accountAvatar.style.backgroundImage =
          `url("${imageUrl.href}")`;

        accountAvatar.style.backgroundSize = "cover";

        accountAvatar.style.backgroundPosition = "center";

        setText(
          getElement("avatarInitials"),
          ""
        );

      }

    } catch (error) {

      console.warn(
        "Profile image URL is invalid.",
        error
      );

    }

  }

}


  // ====================================================
  // RETRY BUTTON
  // ====================================================

  function initializeRetry() {

    if (
      !elements.retryButton ||
      retryInitialized
    ) {
      return;
    }


    retryInitialized = true;


    elements.retryButton.addEventListener("click", async () => {

      const originalText =
        elements.retryButton.textContent;


      elements.retryButton.disabled = true;

      elements.retryButton.textContent = "Loading...";


      await fetchOrderDetails();


      elements.retryButton.disabled = false;

      elements.retryButton.textContent = originalText;

    });

  }


  // ====================================================
  // FETCH ORDER DETAILS
  // ====================================================

  async function fetchOrderDetails() {

    showLoading();

    try {

      await loadOrder();

      showContent();

    } catch (error) {

      console.error(
        "HAFHASS Order Details: Failed to load order.",
        {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          raw: error
        }
      );


      showError(
        getErrorMessage(error)
      );

    }

  }


  // ====================================================
  // INITIALIZE PAGE
  // ====================================================

  async function initializeOrderDetails() {

    try {

      // ------------------------------------------------
      // VERIFY CUSTOMER ACCESS
      // ------------------------------------------------

      const guardResult = await guards.protectCustomerPage({
        loginPage: "../login.html"
      });


      if (
        !guardResult ||
        guardResult.authorized !== true
      ) {
        return;
      }


    // ------------------------------------------------
// AUTHENTICATED USER
// ------------------------------------------------

currentUser = guardResult.user?.id
  ? guardResult.user
  : null;


// FALLBACK: SAME METHOD THE ORDERS PAGE USES.

if (!currentUser) {

  const userResult = await auth.getCurrentUser();

  if (
    !userResult ||
    userResult.success !== true ||
    !userResult.user?.id
  ) {

    throw new Error(
      userResult?.message ||
      "Your customer session could not be verified."
    );

  }

  currentUser = userResult.user;

}


// VERIFY THE FINAL USER OBJECT.

if (!currentUser?.id) {

  throw new Error(
    "A valid authenticated customer could not be identified."
  );

}


      // ------------------------------------------------
      // CUSTOMER INFORMATION
      // ------------------------------------------------

      try {

        await loadCustomerInformation(
          currentUser,
          guardResult.profile || null
        );

      } catch (sidebarError) {

        console.warn(
          "HAFHASS Order Details: Sidebar could not be loaded.",
          sidebarError
        );

      }


      // ------------------------------------------------
      // GET ORDER ID (AFTER THE SIDEBAR HAS LOADED)
      // ------------------------------------------------

      currentOrderId = new URLSearchParams(
        window.location.search
      ).get("id");

      if (!currentOrderId) {

        showError(
          "No order reference was provided. Please return to My Orders."
        );

        return;

      }


      // ------------------------------------------------
      // INITIALIZE CONTROLS
      // ------------------------------------------------

      initializeRetry();


      // ------------------------------------------------
      // LOAD ORDER
      // ------------------------------------------------

      await fetchOrderDetails();


    } catch (error) {

      console.error(
        "HAFHASS Order Details: Initialization failed.",
        error
      );


      showError(
        getErrorMessage(error)
      );

    }

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeOrderDetails,
      { once: true }
    );

  } else {

    initializeOrderDetails();

  }


  console.log(
    "HAFHASS: Customer order details controller initialized."
  );

})();