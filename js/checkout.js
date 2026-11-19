/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   CUSTOMER CHECKOUT CONTROLLER

   Supports:
   1. My Saved Addresses
   2. HAFHASS Delivery Locations
   3. Enter a New Location

   Uses the existing Supabase checkout and delivery functions.
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     1. DEPENDENCIES
  ======================================================= */

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;

  if (!supabase || !auth) {
    console.error("[CHECKOUT] Required dependencies are unavailable.");
    return;
  }


  /* =======================================================
     2. CONFIGURATION
  ======================================================= */

  const RECEIPT_BUCKET = "payment-receipts";
  const REFERENCE_BUCKET = "customer-uploads";

  const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

  const ALLOWED_RECEIPT_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf"
  ];

  const CUSTOM_VALUE = "__custom__";


  /* =======================================================
     3. DOM ELEMENTS
  ======================================================= */

  const elements = {

    loading: document.getElementById("checkoutLoading"),
    error: document.getElementById("checkoutError"),
    errorMessage: document.getElementById("checkoutErrorMessage"),
    retryButton: document.getElementById("retryCheckoutButton"),
    empty: document.getElementById("checkoutEmpty"),
    content: document.getElementById("checkoutContent"),
    form: document.getElementById("checkoutForm"),

    // CUSTOMER

    customerName: document.getElementById("checkoutCustomerName"),
    customerEmail: document.getElementById("checkoutCustomerEmail"),
    customerPhone: document.getElementById("checkoutCustomerPhone"),

    sidebarName: document.getElementById("sidebarUserName"),
    sidebarEmail: document.getElementById("sidebarUserEmail"),
    avatarInitials: document.getElementById("avatarInitials"),

    // FULFILMENT

    pickup: document.getElementById("fulfillmentPickup"),
    delivery: document.getElementById("fulfillmentDelivery"),
    fulfillmentMessage: document.getElementById("fulfillmentMessage"),
    deliverySection: document.getElementById("deliveryAddressSection"),
    deliveryFeeMessage: document.getElementById("deliveryFeeMessage"),

    // DELIVERY SOURCES

    sourceSaved: document.getElementById("deliverySourceSaved"),
    sourceSystem: document.getElementById("deliverySourceSystem"),
    sourceNew: document.getElementById("deliverySourceNew"),

    savedPanel: document.getElementById("savedAddressPanel"),
    systemPanel: document.getElementById("systemDeliveryLocationPanel"),
    newPanel: document.getElementById("newDeliveryLocationPanel"),

    // SAVED ADDRESSES

    savedAddressSelect: document.getElementById("savedAddressSelect"),
    savedAddressMessage: document.getElementById("savedAddressMessage"),

    // APPROVED HAFHASS LOCATIONS

    approvedLocationSelect: document.getElementById(
      "hafhassDeliveryLocationSelect"
    ),

    systemLocationMessage: document.getElementById(
      "systemDeliveryLocationMessage"
    ),

    systemLocationDetails: document.getElementById(
      "systemDeliveryLocationDetails"
    ),

    // NEW LOCATION HIERARCHY

    state: document.getElementById("deliveryState"),
    lga: document.getElementById("deliveryLga"),
    settlement: document.getElementById("deliverySettlement"),
    area: document.getElementById("deliveryArea"),
    specificLocation: document.getElementById(
      "deliverySpecificLocation"
    ),

    // CUSTOM LOCATION INPUTS

    customState: document.getElementById("deliveryCustomState"),
    customLga: document.getElementById("deliveryCustomLga"),
    customSettlement: document.getElementById(
      "deliveryCustomSettlement"
    ),
    customArea: document.getElementById("deliveryCustomArea"),
    customSpecificLocation: document.getElementById(
      "deliveryCustomSpecificLocation"
    ),

    // ADDRESS DETAILS

    addressLine1: document.getElementById("deliveryAddressLine1"),
    addressLine2: document.getElementById("deliveryAddressLine2"),
    postalCode: document.getElementById("deliveryPostalCode"),
    country: document.getElementById("deliveryCountry"),
    deliveryInstructions: document.getElementById(
      "deliveryInstructions"
    ),

    // SCHEDULE

    requestedDate: document.getElementById("requestedDate"),
    requestedTime: document.getElementById("requestedTime"),

    // NOTES

    customerNotes: document.getElementById("checkoutCustomerNotes"),

    // BANK DETAILS

    viewBankDetailsButton: document.getElementById(
      "viewBankDetailsButton"
    ),

    bankDetailsPanel: document.getElementById("bankDetailsPanel"),
    bankName: document.getElementById("bankName"),
    bankAccountName: document.getElementById("bankAccountName"),
    bankAccountNumber: document.getElementById("bankAccountNumber"),

    bankInstructions: document.getElementById(
      "bankTransferInstructions"
    ),

    bankDetailsMessage: document.getElementById(
      "bankDetailsMessage"
    ),

    // PAYMENT

    transferReference: document.getElementById("transferReference"),
    receiptFile: document.getElementById("receiptFile"),

    receiptUploadStatus: document.getElementById(
      "receiptUploadStatus"
    ),

    // ORDER SUMMARY

    itemsList: document.getElementById("checkoutItemsList"),
    subtotal: document.getElementById("checkoutSubtotal"),
    deliveryFee: document.getElementById("checkoutDeliveryFee"),
    total: document.getElementById("checkoutTotal"),

    // SUBMISSION

    message: document.getElementById("checkoutMessage"),
    placeOrderButton: document.getElementById("placeOrderButton")

  };


  /* =======================================================
     4. REQUIRED HTML ELEMENTS
  ======================================================= */

  const requiredElements = [

    "loading",
    "error",
    "empty",
    "content",
    "form",

    "customerName",
    "customerEmail",
    "customerPhone",

    "pickup",
    "delivery",
    "deliverySection",

    "sourceSaved",
    "sourceSystem",
    "sourceNew",

    "savedPanel",
    "systemPanel",
    "newPanel",

    "savedAddressSelect",
    "savedAddressMessage",

    "approvedLocationSelect",

    "state",
    "lga",
    "settlement",
    "area",
    "specificLocation",

    "customState",
    "customLga",
    "customSettlement",
    "customArea",
    "customSpecificLocation",

    "addressLine1",
    "addressLine2",
    "postalCode",
    "country",
    "deliveryInstructions",

    "requestedDate",
    "requestedTime",
    "customerNotes",

    "viewBankDetailsButton",
    "bankDetailsPanel",
    "bankName",
    "bankAccountName",
    "bankAccountNumber",
    "bankInstructions",
    "bankDetailsMessage",

    "transferReference",
    "receiptFile",

    "itemsList",
    "subtotal",
    "deliveryFee",
    "total",

    "message",
    "placeOrderButton"

  ];

  const missingElements = requiredElements.filter(
    key => !elements[key]
  );

  if (missingElements.length) {

    console.error(
      "[CHECKOUT] Required HTML elements are missing:",
      missingElements
    );

    return;

  }


  /* =======================================================
     5. APPLICATION STATE
  ======================================================= */

  let currentUser = null;
  let customerProfile = null;

  let cart = null;
  let cartItems = [];
  let cartSubtotal = 0;

  let savedAddresses = [];
  let selectedSavedAddress = null;

  let deliveryStates = [];
  let deliveryLgas = [];
  let deliveryCities = [];
  let deliveryAreas = [];
  let deliveryLocationNodes = [];

  let approvedDeliveryLocations = [];
  let selectedApprovedLocation = null;

  let estimatedDeliveryFee = 0;

  let deliveryCheckComplete = false;
  let deliveryAvailable = false;
  let deliveryRequiresManualReview = false;

  let deliveryCheckTimer = null;
  let deliveryRequestNumber = 0;

  let isSubmitting = false;

  let bankTransferDetails = null;

  let uploadedReceiptPath = null;
  let receiptUploadInProgress = false;
  let receiptPreviewObjectUrl = null;
  let receiptPreviewElements = null;


  /* =======================================================
     6. GENERAL HELPERS
  ======================================================= */

  function getErrorMessage(error) {

    if (!error) {
      return "An unexpected error occurred.";
    }

    return (
      error.message ||
      error.error_description ||
      String(error)
    );

  }


  function unwrapProfile(result) {

    if (!result) return null;

    if (result.data?.profile) {
      return result.data.profile;
    }

    if (result.data) {
      return result.data;
    }

    if (result.profile) {
      return result.profile;
    }

    return result;

  }


  function formatMoney(amount, currency = "NGN") {

    const value = Number(amount) || 0;

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: currency || "NGN"
      }).format(value);

    } catch (error) {

      return `₦${value.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;

    }

  }


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


  function getInitials(name) {

    if (!name) return "C";

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("");

  }


  function showMessage(message, type = "error") {

    elements.message.textContent = message;
    elements.message.dataset.type = type;
    elements.message.classList.add("is-visible");

  }


  function hideMessage() {

    elements.message.textContent = "";
    elements.message.classList.remove("is-visible");

    delete elements.message.dataset.type;

  }


  function setReceiptStatus(message, type = "info") {

    if (!elements.receiptUploadStatus) return;

    elements.receiptUploadStatus.textContent = message;
    elements.receiptUploadStatus.dataset.type = type;

  }


  function setPageState(state) {

    elements.loading.hidden = state !== "loading";
    elements.error.hidden = state !== "error";
    elements.empty.hidden = state !== "empty";
    elements.content.hidden = state !== "content";

  }


  function setSelectOptions(select, rows, placeholder, labelGetter) {

    if (!select) return;

    select.innerHTML = "";

    const placeholderOption = document.createElement("option");

    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;

    select.appendChild(placeholderOption);

    rows.forEach(row => {

      const option = document.createElement("option");

      option.value = row.id;
      option.textContent = labelGetter(row);

      select.appendChild(option);

    });

    const customOption = document.createElement("option");

    customOption.value = CUSTOM_VALUE;
    customOption.textContent = "Not listed — enter manually";

    select.appendChild(customOption);

    // A populated hierarchy level is now available for selection.
    select.disabled = false;

  }


  function setCustomField(input, visible) {

    if (!input) return;

    const wrapper = input.closest(".checkout-field");

    if (wrapper) {
      wrapper.hidden = !visible;
    }

    input.hidden = !visible;

    if (!visible) {
      input.value = "";
    }

  }


  function invalidateDeliveryCheck() {

    deliveryRequestNumber++;

    clearTimeout(deliveryCheckTimer);

    deliveryCheckComplete = false;
    deliveryAvailable = false;
    deliveryRequiresManualReview = false;

    estimatedDeliveryFee = 0;

    updateOrderTotal();

  }


  function getSelectedDeliverySource() {

    if (elements.sourceSaved.checked) {
      return "saved";
    }

    if (elements.sourceSystem.checked) {
      return "system";
    }

    if (elements.sourceNew.checked) {
      return "new";
    }

    return null;

  }


  /* =======================================================
     7. AUTHENTICATION
  ======================================================= */

  async function getAuthenticatedUser() {

    let user = null;

    try {

      if (typeof auth.getSession === "function") {

        const result = await auth.getSession();

        user =
          result?.data?.session?.user ||
          result?.session?.user ||
          result?.user ||
          null;

      }

      if (!user && typeof auth.getCurrentUser === "function") {

        const result = await auth.getCurrentUser();

        user =
          result?.data?.user ||
          result?.user ||
          result ||
          null;

      }

      if (!user) {

        const { data, error } = await supabase.auth.getUser();

        if (error) throw error;

        user = data?.user || null;

      }

      if (!user) {

        window.location.href =
          "../login.html?redirect=account/checkout.html";

        return null;

      }

      return user;

    } catch (error) {

      console.error(
        "[CHECKOUT] Authentication error:",
        error
      );

      window.location.href =
        "../login.html?redirect=account/checkout.html";

      return null;

    }

  }


  /* =======================================================
     8. CUSTOMER PROFILE
  ======================================================= */

  async function loadCustomerProfile() {

    const result = await auth.getProfile();

    const profile = unwrapProfile(result);

    if (!profile) {

      throw new Error(
        "Your customer profile could not be retrieved."
      );

    }

    customerProfile = profile;

    const fullName = profile.full_name || "";

    const email =
      profile.email ||
      currentUser.email ||
      "";

    const phone = profile.phone || "";

    if (!fullName || !email || !phone) {

      throw new Error(
        "Please complete your name, email address and phone number in your profile before checkout."
      );

    }

    elements.customerName.value = fullName;
    elements.customerEmail.value = email;
    elements.customerPhone.value = phone;

    if (elements.sidebarName) {
      elements.sidebarName.textContent = fullName;
    }

    if (elements.sidebarEmail) {
      elements.sidebarEmail.textContent = email;
    }

    if (elements.avatarInitials) {
      elements.avatarInitials.textContent = getInitials(fullName);
    }

    return profile;

  }


  /* =======================================================
     9. CART LOADING
  ======================================================= */

  async function loadCart() {

    const { data: activeCart, error: cartError } =
      await supabase
        .from("carts")
        .select("*")
        .eq("user_id", currentUser.id)
        .eq("status", "active")
        .maybeSingle();

    if (cartError) throw cartError;

    if (!activeCart) {

      cart = null;
      cartItems = [];

      return [];

    }

    cart = activeCart;

    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        *,
        products (
          *,
          product_images (*)
        )
      `)
      .eq("cart_id", cart.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    cartItems = data || [];

    return cartItems;

  }


  /* =======================================================
     10. PRODUCT HELPERS
  ======================================================= */

  function getProduct(item) {

    return item.products || item.product || {};

  }


  function getProductImages(item) {

    const product = getProduct(item);

    const images = product.product_images || [];

    return images.slice().sort((a, b) => {

      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;

      return (
        (a.display_order || 0) -
        (b.display_order || 0)
      );

    });

  }


  function getSelectedOptions(item) {

    return Array.isArray(item?.selected_options)
      ? item.selected_options
      : [];

  }


  function getOptionAdjustment(item) {

    return getSelectedOptions(item).reduce(
      (total, option) => {

        const type = String(
          option?.price_adjustment_type || "none"
        ).toLowerCase();

        const amount =
          Number(option?.price_adjustment) || 0;

        if (type === "fixed" || type === "add") {
          return total + amount;
        }

        return total;

      },
      0
    );

  }


  function getSelectedOptionDisplay(selected) {

    return {

      name:
        selected?.display_name ||
        selected?.option_name ||
        selected?.name ||
        "Option",

      value:
        selected?.label ||
        selected?.value ||
        selected?.selected_value ||
        ""

    };

  }


  function calculateItemPrice(item) {

    const product = getProduct(item);

    return (
      Number(product.price || 0) +
      getOptionAdjustment(item)
    );

  }


  /* =======================================================
     11. REFERENCE IMAGE SIGNING
  ======================================================= */

  async function signReferenceImages() {

    for (const item of cartItems) {

      const path = item.reference_image_url;

      if (!path) continue;

      try {

        const { data, error } = await supabase
          .storage
          .from(REFERENCE_BUCKET)
          .createSignedUrl(path, 3600);

        if (error) {

          console.warn(
            "[CHECKOUT] Reference image signing failed:",
            error
          );

          item.signed_reference_image = null;

          continue;

        }

        item.signed_reference_image =
          data?.signedUrl || null;

      } catch (error) {

        console.warn(
          "[CHECKOUT] Reference image unavailable:",
          error
        );

        item.signed_reference_image = null;

      }

    }

  }


  /* =======================================================
     12. ORDER SUMMARY
  ======================================================= */

  function renderCartItems() {

    elements.itemsList.innerHTML = "";

    cartSubtotal = 0;

    cartItems.forEach(item => {

      const product = getProduct(item);

      const quantity = Number(item.quantity) || 1;

      const unitPrice = calculateItemPrice(item);

      const itemTotal = unitPrice * quantity;

      cartSubtotal += itemTotal;

      const images = getProductImages(item);

      const image = images[0]?.image_url || "";

      const selectedOptions = getSelectedOptions(item);

      const optionsHTML = selectedOptions.map(option => {

        const display = getSelectedOptionDisplay(option);

        return `
          <p class="checkout-item-option">
            ${escapeHTML(display.name)}:
            ${escapeHTML(display.value || "Selected")}
          </p>
        `;

      }).join("");

      const customText = item.custom_text
        ? `
          <p class="checkout-item-custom-text">
            ${escapeHTML(item.custom_text)}
          </p>
        `
        : "";

      const customerNotes = item.customer_notes
        ? `
          <p class="checkout-item-notes">
            ${escapeHTML(item.customer_notes)}
          </p>
        `
        : "";

      const referenceImage = item.signed_reference_image
        ? `
          <div class="checkout-item-reference">
            <img
              src="${escapeHTML(item.signed_reference_image)}"
              alt="Customer reference image"
              loading="lazy"
            >
          </div>
        `
        : "";

      const itemElement = document.createElement("div");

      itemElement.className = "checkout-item";

      itemElement.innerHTML = `

        <div class="checkout-item-image">

          ${
            image
              ? `
                <img
                  src="${escapeHTML(image)}"
                  alt="${escapeHTML(product.name || "Product")}"
                  loading="lazy"
                >
              `
              : `
                <span>
                  <i class="fa-solid fa-image"></i>
                </span>
              `
          }

        </div>

        <div class="checkout-item-details">

          <h3>
            ${escapeHTML(product.name || "Product")}
          </h3>

          <p class="checkout-item-quantity">
            Quantity: ${quantity}
          </p>

          ${optionsHTML}
          ${customText}
          ${customerNotes}
          ${referenceImage}

        </div>

        <div class="checkout-item-price">

          <strong>
            ${formatMoney(
              itemTotal,
              product.currency || "NGN"
            )}
          </strong>

        </div>

      `;

      elements.itemsList.appendChild(itemElement);

    });

    updateOrderTotal();

  }


  /* =======================================================
     13. ORDER TOTAL
  ======================================================= */

  function updateOrderTotal() {

    const method = getFulfillmentMethod();

    const deliveryFee =
      method === "delivery"
        ? estimatedDeliveryFee
        : 0;

    elements.subtotal.textContent =
      formatMoney(cartSubtotal);

    elements.deliveryFee.textContent =
      formatMoney(deliveryFee);

    elements.total.textContent =
      formatMoney(cartSubtotal + deliveryFee);

  }


  /* =======================================================
     14. FULFILMENT METHOD
  ======================================================= */

  function getFulfillmentMethod() {

    if (elements.pickup.checked) return "pickup";

    if (elements.delivery.checked) return "delivery";

    return null;

  }


  function updateFulfillmentDisplay() {

    const method = getFulfillmentMethod();

    const isDelivery = method === "delivery";

    elements.deliverySection.hidden = !isDelivery;

    if (elements.fulfillmentMessage) {

      if (method === "pickup") {

        elements.fulfillmentMessage.textContent =
          "You have selected store pickup.";

      } else if (method === "delivery") {

        elements.fulfillmentMessage.textContent =
          "Choose one of the available delivery options.";

      } else {

        elements.fulfillmentMessage.textContent =
          "Please select Store Pickup or Home Delivery.";

      }

    }

    if (!isDelivery) {

      invalidateDeliveryCheck();

      if (elements.deliveryFeeMessage) {
        elements.deliveryFeeMessage.textContent = "";
      }

      updateOrderTotal();

      return;

    }

    updateDeliverySourceDisplay();

    updateOrderTotal();

  }


  /* =======================================================
     15. DELIVERY SOURCE PANELS
  ======================================================= */

  function updateDeliverySourceDisplay() {

    const source = getSelectedDeliverySource();

    elements.savedPanel.hidden = source !== "saved";
    elements.systemPanel.hidden = source !== "system";
    elements.newPanel.hidden = source !== "new";

    if (source !== "system" && elements.systemLocationDetails) {

      elements.systemLocationDetails.hidden = true;
      elements.systemLocationDetails.textContent = "";

    }

    invalidateDeliveryCheck();

    if (elements.deliveryFeeMessage) {
      elements.deliveryFeeMessage.textContent = "";
    }

    if (source === "saved") {

      if (selectedSavedAddress) {
        scheduleDeliveryFeeCheck();
      }

    } else if (source === "system") {

      handleApprovedLocationChange();

    } else if (source === "new") {

      updateNewLocationVisibility();
      scheduleDeliveryFeeCheck();

    }

  }


  /* =======================================================
     16. SAVED ADDRESSES
  ======================================================= */

  function renderSavedAddressOptions() {

    const select = elements.savedAddressSelect;

    select.innerHTML = "";

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Select a saved address";

    select.appendChild(placeholder);

    savedAddresses.forEach(address => {

      const option = document.createElement("option");

      option.value = address.id;

      const label = address.label || "Saved Address";

      const location = [
        address.city,
        address.state
      ].filter(Boolean).join(", ");

      option.textContent = location
        ? `${label} — ${location}`
        : label;

      select.appendChild(option);

    });

    if (savedAddresses.length) {

      const defaultAddress =
        savedAddresses.find(address => address.is_default) ||
        savedAddresses[0];

      select.value = String(defaultAddress.id);

      // Keep the selected record in controller state.
      // The delivery directory is loaded in parallel, so its
      // names and IDs are resolved later when the fee is checked.
      selectedSavedAddress = defaultAddress;

      if (elements.savedAddressMessage) {
        elements.savedAddressMessage.textContent =
          "Select the saved address you want to use for this order.";
      }

    } else {

      selectedSavedAddress = null;

      select.value = "";

      if (elements.savedAddressMessage) {
        elements.savedAddressMessage.textContent =
          "You don't have any saved addresses yet. Choose Enter a New Location to add one.";
      }

    }

  }


  async function loadSavedAddresses() {

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    savedAddresses = data || [];

    renderSavedAddressOptions();

    if (!savedAddresses.length && elements.sourceNew) {

      elements.sourceNew.checked = true;

      updateDeliverySourceDisplay();

    }

  }


  function handleSavedAddressChange() {

    const selectedId = elements.savedAddressSelect.value;

    const address = savedAddresses.find(
      item => String(item.id) === selectedId
    );

    selectedSavedAddress = address || null;

    invalidateDeliveryCheck();

    if (!address) {

      if (elements.savedAddressMessage) {
        elements.savedAddressMessage.textContent =
          "Please select one of your saved addresses.";
      }

      return;

    }

    if (elements.savedAddressMessage) {

      const location = [
        address.city,
        address.state
      ].filter(Boolean).join(", ");

      elements.savedAddressMessage.textContent =
        `Selected address: ${address.label || "Saved Address"}${location ? ` — ${location}` : ""}`;

    }

    if (getFulfillmentMethod() === "delivery") {
      scheduleDeliveryFeeCheck();
    }

  }


  function getSavedAddressLocation(address) {

    const lga = deliveryLgas.find(
      item => item.id === address.lga_id
    );

    const city = deliveryCities.find(
      item => item.id === address.city_id
    );

    const area = deliveryAreas.find(
      item => item.id === address.area_id
    );

    const node = deliveryLocationNodes.find(
      item => item.id === address.location_node_id
    );

    // addresses has no state_id column. Derive it from the
    // active LGA first, then fall back to the saved state name.
    const savedStateName = String(address.state || "").trim();

    const state = deliveryStates.find(
      item => item.id === lga?.state_id
    ) || deliveryStates.find(
      item =>
        String(item.name || "").trim().toLowerCase() ===
        savedStateName.toLowerCase()
    );

    // Only pass active directory IDs to the fee function.
    // Missing/inactive hierarchy entries are sent for manual review
    // instead of causing an invalid-ID rejection.
    const activeLgaId = lga?.id || null;
    const activeCityId = city?.id || null;
    const activeAreaId = area?.id || null;
    const activeNodeId =
      isCompleteActiveNodeChain(node, activeCityId)
        ? node.id
        : null;

    const hasUnresolvedHierarchy = Boolean(
      !state?.id ||
      !activeLgaId ||
      !activeCityId ||
      (address.area_id && !activeAreaId) ||
      (address.location_node_id && !activeNodeId)
    );

    return {

      state: address.state || state?.name || "",

      state_id: state?.id || null,

      lga: address.custom_lga || lga?.name || "",

      lga_id: activeLgaId,

      city: address.custom_city || city?.name || address.city || "",

      city_id: activeCityId,

      area: address.custom_area || area?.name || "",

      area_id: activeAreaId,

      specific_location:
        address.custom_location_text ||
        (activeNodeId ? getNodeDisplayName(node) : "") ||
        "",

      location_node_id: activeNodeId,

      is_custom_location: Boolean(
        address.is_custom_location ||
        address.custom_lga ||
        address.custom_city ||
        address.custom_area ||
        address.custom_location_text ||
        hasUnresolvedHierarchy
      )

    };

  }


  /* =======================================================
     17. DELIVERY DIRECTORY
  ======================================================= */

  async function loadDeliveryDirectory() {

    /*
     * PostgREST/Supabase can cap one response at 1,000 rows.
     * The delivery directory contains more than 1,000 location
     * nodes, so requesting range(0, 4999) once does NOT guarantee
     * that all rows are returned. Missing later nodes also break
     * their parent chains, which makes valid approved zones appear
     * unavailable and matching saved addresses look custom.
     * Fetch the directory in stable 1,000-row pages instead.
     */
    async function fetchAllActiveRows(tableName) {

      const PAGE_SIZE = 1000;
      const rows = [];
      let start = 0;

      while (true) {

        const end = start + PAGE_SIZE - 1;

        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(start, end);

        if (error) throw error;

        const batch = data || [];
        rows.push(...batch);

        if (batch.length < PAGE_SIZE) {
          break;
        }

        start += PAGE_SIZE;

      }

      return rows;

    }

    const [
      states,
      lgas,
      cities,
      areas,
      nodes
    ] = await Promise.all([

      fetchAllActiveRows("delivery_states"),
      fetchAllActiveRows("delivery_lgas"),
      fetchAllActiveRows("delivery_cities"),
      fetchAllActiveRows("delivery_areas"),
      fetchAllActiveRows("delivery_location_nodes")

    ]);

    deliveryStates = states;
    deliveryLgas = lgas;
    deliveryCities = cities;
    deliveryAreas = areas;
    deliveryLocationNodes = nodes;

    console.info("[CHECKOUT] Delivery directory loaded:", {
      states: deliveryStates.length,
      lgas: deliveryLgas.length,
      settlements: deliveryCities.length,
      areas: deliveryAreas.length,
      specificLocations: deliveryLocationNodes.length
    });

    populateStateOptions();

  }


  /* =======================================================
     18. NEW LOCATION SELECTS
  ======================================================= */

  function populateStateOptions() {

    setSelectOptions(
      elements.state,
      deliveryStates,
      "Select State",
      row => row.name
    );

    resetSelect(elements.lga, "Select LGA");
    resetSelect(elements.settlement, "Select Settlement");
    resetSelect(elements.area, "Select Area");
    resetSelect(
      elements.specificLocation,
      "Select Specific Location"
    );

    updateNewLocationVisibility();

  }


  function resetSelect(select, placeholder, disabled = true) {

    if (!select) return;

    select.innerHTML = "";

    const option = document.createElement("option");

    option.value = "";
    option.textContent = placeholder;

    select.appendChild(option);

    const customOption = document.createElement("option");

    customOption.value = CUSTOM_VALUE;
    customOption.textContent = "Not listed — enter manually";

    select.appendChild(customOption);

    // Child levels stay disabled until their parent is selected.
    select.disabled = disabled;

  }


  function populateLgaOptions(stateId) {

    const rows = deliveryLgas.filter(
      item => item.state_id === stateId
    );

    setSelectOptions(
      elements.lga,
      rows,
      "Select LGA",
      row => row.name
    );

    resetSelect(elements.settlement, "Select Settlement");
    resetSelect(elements.area, "Select Area");
    resetSelect(
      elements.specificLocation,
      "Select Specific Location"
    );

  }


  function populateSettlementOptions(lgaId) {

    const rows = deliveryCities.filter(
      item => item.lga_id === lgaId
    );

    setSelectOptions(
      elements.settlement,
      rows,
      "Select Settlement",
      row => row.name
    );

    resetSelect(elements.area, "Select Area");

    resetSelect(
      elements.specificLocation,
      "Select Specific Location"
    );

  }


  function populateAreaOptions(cityId) {

    const rows = deliveryAreas.filter(
      item => item.city_id === cityId
    );

    setSelectOptions(
      elements.area,
      rows,
      "Select Area",
      row => row.name
    );

    populateSpecificLocationOptions(cityId);

  }


  function getNodeDisplayName(node) {

    const names = [];

    let current = node;

    const visited = new Set();

    while (current && !visited.has(current.id)) {

      visited.add(current.id);

      names.unshift(current.name);

      current = current.parent_id
        ? deliveryLocationNodes.find(
            item => item.id === current.parent_id
          )
        : null;

    }

    return names.join(" → ");

  }


  function isCompleteActiveNodeChain(node, cityId) {

    if (!node || !cityId) return false;

    const visited = new Set();

    let current = node;

    while (current) {

      if (
        visited.has(current.id) ||
        current.is_active !== true ||
        current.settlement_id !== cityId
      ) {
        return false;
      }

      visited.add(current.id);

      if (!current.parent_id) {
        return true;
      }

      current = deliveryLocationNodes.find(
        item => item.id === current.parent_id
      );

    }

    return false;

  }


  function populateSpecificLocationOptions(cityId) {

    const rows = deliveryLocationNodes.filter(
      item => item.settlement_id === cityId
    );

    setSelectOptions(
      elements.specificLocation,
      rows,
      "Select Specific Location",
      row => getNodeDisplayName(row)
    );

  }


  function updateNewLocationVisibility() {

    const stateCustom =
      elements.state.value === CUSTOM_VALUE;

    const lgaCustom =
      elements.lga.value === CUSTOM_VALUE;

    const settlementCustom =
      elements.settlement.value === CUSTOM_VALUE;

    const areaCustom =
      elements.area.value === CUSTOM_VALUE;

    const specificCustom =
      elements.specificLocation.value === CUSTOM_VALUE;

    setCustomField(elements.customState, stateCustom);
    setCustomField(elements.customLga, lgaCustom);
    setCustomField(elements.customSettlement, settlementCustom);
    setCustomField(elements.customArea, areaCustom);
    setCustomField(
      elements.customSpecificLocation,
      specificCustom
    );

  }


  function handleStateChange() {

    invalidateDeliveryCheck();

    const stateId = elements.state.value;

    setCustomField(
      elements.customState,
      stateId === CUSTOM_VALUE
    );

    setCustomField(elements.customLga, false);
    setCustomField(elements.customSettlement, false);
    setCustomField(elements.customArea, false);
    setCustomField(elements.customSpecificLocation, false);

    elements.customLga.value = "";
    elements.customSettlement.value = "";
    elements.customArea.value = "";
    elements.customSpecificLocation.value = "";

    if (stateId && stateId !== CUSTOM_VALUE) {

      populateLgaOptions(stateId);

    } else {

      resetSelect(elements.lga, "Select LGA");
      resetSelect(elements.settlement, "Select Settlement");
      resetSelect(elements.area, "Select Area");

      resetSelect(
        elements.specificLocation,
        "Select Specific Location"
      );

      if (stateId === CUSTOM_VALUE) {
        elements.lga.value = CUSTOM_VALUE;
        elements.settlement.value = CUSTOM_VALUE;
        elements.area.value = CUSTOM_VALUE;
        elements.specificLocation.value = CUSTOM_VALUE;

        setCustomField(elements.customLga, true);
        setCustomField(elements.customSettlement, true);
        setCustomField(elements.customArea, true);
        setCustomField(elements.customSpecificLocation, true);
      }

    }

    updateNewLocationVisibility();

    scheduleDeliveryFeeCheck();

  }


  function handleLgaChange() {

    invalidateDeliveryCheck();

    const lgaId = elements.lga.value;

    setCustomField(
      elements.customLga,
      lgaId === CUSTOM_VALUE
    );

    setCustomField(elements.customSettlement, false);
    setCustomField(elements.customArea, false);
    setCustomField(elements.customSpecificLocation, false);

    elements.customSettlement.value = "";
    elements.customArea.value = "";
    elements.customSpecificLocation.value = "";

    if (lgaId && lgaId !== CUSTOM_VALUE) {

      populateSettlementOptions(lgaId);

    } else {

      resetSelect(elements.settlement, "Select Settlement");
      resetSelect(elements.area, "Select Area");

      resetSelect(
        elements.specificLocation,
        "Select Specific Location"
      );

      if (lgaId === CUSTOM_VALUE) {

        elements.settlement.value = CUSTOM_VALUE;
        elements.area.value = CUSTOM_VALUE;
        elements.specificLocation.value = CUSTOM_VALUE;

        setCustomField(elements.customSettlement, true);
        setCustomField(elements.customArea, true);
        setCustomField(elements.customSpecificLocation, true);

      }

    }

    updateNewLocationVisibility();

    scheduleDeliveryFeeCheck();

  }


  function handleSettlementChange() {

    invalidateDeliveryCheck();

    const cityId = elements.settlement.value;

    setCustomField(
      elements.customSettlement,
      cityId === CUSTOM_VALUE
    );

    setCustomField(elements.customArea, false);
    setCustomField(elements.customSpecificLocation, false);

    elements.customArea.value = "";
    elements.customSpecificLocation.value = "";

    if (cityId && cityId !== CUSTOM_VALUE) {

      populateAreaOptions(cityId);

    } else {

      resetSelect(elements.area, "Select Area");

      resetSelect(
        elements.specificLocation,
        "Select Specific Location"
      );

      if (cityId === CUSTOM_VALUE) {

        elements.area.value = CUSTOM_VALUE;
        elements.specificLocation.value = CUSTOM_VALUE;

        setCustomField(elements.customArea, true);
        setCustomField(elements.customSpecificLocation, true);

      }

    }

    updateNewLocationVisibility();

    scheduleDeliveryFeeCheck();

  }


  function handleAreaChange() {

    invalidateDeliveryCheck();

    const areaId = elements.area.value;

    setCustomField(
      elements.customArea,
      areaId === CUSTOM_VALUE
    );

    setCustomField(elements.customSpecificLocation, false);

    elements.customSpecificLocation.value = "";

    const cityId = elements.settlement.value;

    if (cityId && cityId !== CUSTOM_VALUE) {

      populateSpecificLocationOptions(cityId);

    }

    updateNewLocationVisibility();

    scheduleDeliveryFeeCheck();

  }


  function handleSpecificLocationChange() {

    invalidateDeliveryCheck();

    setCustomField(
      elements.customSpecificLocation,
      elements.specificLocation.value === CUSTOM_VALUE
    );

    updateNewLocationVisibility();

    scheduleDeliveryFeeCheck();

  }


  /* =======================================================
     19. APPROVED HAFHASS DELIVERY LOCATIONS
  ======================================================= */

  function getApprovedLocationDetails(zone) {

    const state = deliveryStates.find(
      item => item.id === zone.state_id
    );

    const lga = deliveryLgas.find(
      item => item.id === zone.lga_id
    );

    const city = deliveryCities.find(
      item => item.id === zone.city_id
    );

    const area = deliveryAreas.find(
      item => item.id === zone.area_id
    );

    const node = deliveryLocationNodes.find(
      item => item.id === zone.location_node_id
    );

    const hierarchyValid = Boolean(
      state &&
      lga &&
      city &&
      lga.state_id === state.id &&
      city.lga_id === lga.id &&
      (!zone.area_id || (area && area.city_id === city.id)) &&
      (
        !zone.location_node_id ||
        isCompleteActiveNodeChain(node, city.id)
      )
    );

    return {

      id: zone.id,

      hierarchy_valid: hierarchyValid,

      state: state?.name || zone.state || "",

      state_id: zone.state_id || null,

      lga: lga?.name || "",

      lga_id: zone.lga_id || null,

      city: city?.name || zone.city || "",

      city_id: zone.city_id || null,

      area: area?.name || zone.area || "",

      area_id: zone.area_id || null,

      specific_location: node
        ? getNodeDisplayName(node)
        : "",

      location_node_id: zone.location_node_id || null,

      delivery_fee: Number(zone.delivery_fee) || 0,

      zone_id: zone.id

    };

  }


  async function loadApprovedDeliveryLocations() {

    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    approvedDeliveryLocations = (data || [])
      .map(getApprovedLocationDetails)
      .filter(location => {

        return Boolean(
          location.hierarchy_valid &&
          location.state &&
          location.lga &&
          location.city &&
          location.state_id &&
          location.lga_id &&
          location.city_id
        );

      });

    renderApprovedDeliveryLocations();

  }


  function renderApprovedDeliveryLocations() {

    const select = elements.approvedLocationSelect;

    select.innerHTML = "";

    const placeholder = document.createElement("option");

    placeholder.value = "";
    placeholder.textContent = "Select an approved delivery location";

    select.appendChild(placeholder);

    approvedDeliveryLocations.forEach(location => {

      const option = document.createElement("option");

      option.value = location.id;

      const parts = [
        location.specific_location,
        location.area,
        location.city,
        location.lga,
        location.state
      ].filter(Boolean);

      option.textContent =
        `${parts.join(", ")} — ${formatMoney(location.delivery_fee)}`;

      select.appendChild(option);

    });

    if (elements.systemLocationMessage) {

      elements.systemLocationMessage.textContent =
        approvedDeliveryLocations.length
          ? "Choose one of the locations currently approved for HAFHASS delivery."
          : "There are currently no approved HAFHASS delivery locations available.";

    }

  }


  function handleApprovedLocationChange() {

    const selectedId = elements.approvedLocationSelect.value;

    selectedApprovedLocation =
      approvedDeliveryLocations.find(
        item => item.id === selectedId
      ) || null;

    if (elements.systemLocationDetails) {

      if (selectedApprovedLocation) {

        const location = selectedApprovedLocation;

        const parts = [
          location.specific_location,
          location.area,
          location.city,
          location.lga,
          location.state
        ].filter(Boolean);

        elements.systemLocationDetails.textContent =
          `${parts.join(", ")}. Delivery fee: ${formatMoney(location.delivery_fee)}.`;

        elements.systemLocationDetails.hidden = false;

      } else {

        elements.systemLocationDetails.textContent = "";
        elements.systemLocationDetails.hidden = true;

      }

    }

    invalidateDeliveryCheck();

    if (selectedApprovedLocation &&
        getFulfillmentMethod() === "delivery") {

      scheduleDeliveryFeeCheck();

    }

  }


  /* =======================================================
     20. BUILD DELIVERY DATA
  ======================================================= */

  function getCurrentSavedAddressSelection() {

    const selectedId = String(
      elements.savedAddressSelect?.value || ""
    ).trim();

    if (!selectedId) {
      selectedSavedAddress = null;
      return null;
    }

    const address = savedAddresses.find(
      item => String(item.id) === selectedId
    ) || null;

    // Keep controller state synchronized with the actual select value.
    selectedSavedAddress = address;

    return address;

  }


  function buildSavedDeliveryAddress() {

    const address = getCurrentSavedAddressSelection();

    if (!address) return null;

    const location = getSavedAddressLocation(address);

    return {

      saved_address_id: address.id,

      address_label: address.label || null,

      recipient_name:
        address.recipient_name ||
        customerProfile?.full_name ||
        "",

      phone:
        address.phone ||
        customerProfile?.phone ||
        "",

      address_line_1: address.address_line_1 || null,

      address_line_2: address.address_line_2 || null,

      state: location.state,

      state_id: location.state_id,

      lga: location.lga,

      lga_id: location.lga_id,

      city: location.city,

      city_id: location.city_id,

      area: location.area,

      area_id: location.area_id,

      specific_location: location.specific_location,

      location_node_id: location.location_node_id,

      postal_code: address.postal_code || null,

      country: address.country || "Nigeria",

      delivery_instructions:
        address.delivery_instructions || null,

      is_custom_location: location.is_custom_location,

      custom_lga: address.custom_lga || null,

      custom_city: address.custom_city || null,

      custom_area: address.custom_area || null,

      custom_location_text:
        address.custom_location_text || null

    };

  }


  function buildApprovedDeliveryAddress() {

    const location = selectedApprovedLocation;

    if (!location) return null;

    return {

      saved_address_id: null,

      address_label: "HAFHASS Delivery Location",

      recipient_name: customerProfile?.full_name || "",

      phone: customerProfile?.phone || "",

      address_line_1: null,

      address_line_2: null,

      state: location.state,

      state_id: location.state_id,

      lga: location.lga,

      lga_id: location.lga_id,

      city: location.city,

      city_id: location.city_id,

      area: location.area,

      area_id: location.area_id,

      specific_location: location.specific_location,

      location_node_id: location.location_node_id,

      postal_code: null,

      country: "Nigeria",

      delivery_instructions: null,

      is_custom_location: false

    };

  }


  function buildNewDeliveryAddress() {

    const stateId =
      elements.state.value !== CUSTOM_VALUE
        ? elements.state.value || null
        : null;

    const lgaId =
      elements.lga.value !== CUSTOM_VALUE
        ? elements.lga.value || null
        : null;

    const cityId =
      elements.settlement.value !== CUSTOM_VALUE
        ? elements.settlement.value || null
        : null;

    const areaId =
      elements.area.value !== CUSTOM_VALUE
        ? elements.area.value || null
        : null;

    const nodeId =
      elements.specificLocation.value !== CUSTOM_VALUE
        ? elements.specificLocation.value || null
        : null;

    const stateRecord = deliveryStates.find(
      item => item.id === stateId
    );

    const lgaRecord = deliveryLgas.find(
      item => item.id === lgaId
    );

    const cityRecord = deliveryCities.find(
      item => item.id === cityId
    );

    const areaRecord = deliveryAreas.find(
      item => item.id === areaId
    );

    const nodeRecord = deliveryLocationNodes.find(
      item => item.id === nodeId
    );

    const state = stateId
      ? stateRecord?.name || ""
      : elements.customState.value.trim();

    const lga = lgaId
      ? lgaRecord?.name || ""
      : elements.customLga.value.trim();

    const city = cityId
      ? cityRecord?.name || ""
      : elements.customSettlement.value.trim();

    const area = areaId
      ? areaRecord?.name || ""
      : elements.customArea.value.trim();

    const specificLocation = nodeId
      ? getNodeDisplayName(nodeRecord)
      : elements.customSpecificLocation.value.trim();

    const hasCustomLocation = Boolean(

      !stateId ||
      !lgaId ||
      !cityId ||
      elements.area.value === CUSTOM_VALUE ||
      elements.specificLocation.value === CUSTOM_VALUE

    );

    return {

      saved_address_id: null,

      address_label: "Checkout Address",

      recipient_name: customerProfile?.full_name || "",

      phone: customerProfile?.phone || "",

      address_line_1:
        elements.addressLine1.value.trim() || null,

      address_line_2:
        elements.addressLine2.value.trim() || null,

      state,

      state_id: stateId,

      lga,

      lga_id: lgaId,

      city,

      city_id: cityId,

      area,

      area_id: areaId,

      specific_location: specificLocation,

      location_node_id: nodeId,

      postal_code:
        elements.postalCode.value.trim() || null,

      country:
        elements.country.value.trim() || "Nigeria",

      delivery_instructions:
        elements.deliveryInstructions.value.trim() || null,

      is_custom_location: hasCustomLocation,

      custom_lga: lgaId ? null : lga || null,

      custom_city: cityId ? null : city || null,

      custom_area: areaId ? null : area || null,

      custom_location_text: nodeId
        ? null
        : specificLocation || null

    };

  }


  function buildDeliveryAddress() {

    const source = getSelectedDeliverySource();

    if (source === "saved") {
      return buildSavedDeliveryAddress();
    }

    if (source === "system") {
      return buildApprovedDeliveryAddress();
    }

    if (source === "new") {
      return buildNewDeliveryAddress();
    }

    return null;

  }


  /* =======================================================
     21. DELIVERY FEE CHECK
  ======================================================= */

  function scheduleDeliveryFeeCheck() {

    clearTimeout(deliveryCheckTimer);

    deliveryCheckTimer = setTimeout(
      checkDeliveryFee,
      450
    );

  }


  function getDeliveryFeeParameters(address) {

    return {

      p_state_id: address.state_id || null,

      p_lga_id: address.lga_id || null,

      p_city_id: address.city_id || null,

      p_area_id: address.area_id || null,

      p_location_node_id:
        address.location_node_id || null,

      p_is_custom_location:
        Boolean(address.is_custom_location)

    };

  }


  function validateLocationBeforeFeeCheck(address) {

    const source = getSelectedDeliverySource();

    // Validate the selected source first. In particular, resolve the
    // saved-address select value directly instead of trusting possibly
    // stale controller state from an earlier selection.
    if (source === "saved" && !getCurrentSavedAddressSelection()) {

      return {
        valid: false,
        message: "Please select one of your saved addresses."
      };

    }

    if (source === "system" && !selectedApprovedLocation) {

      return {
        valid: false,
        message: "Please select an approved HAFHASS delivery location."
      };

    }

    if (source === "new" && !address) {

      return {
        valid: false,
        message: "Please provide your delivery location."
      };

    }

    if (!address) {

      return {
        valid: false,
        message: "Please select a delivery location."
      };

    }

    // State and settlement are required by the order record, but
    // Address Line 1 is deliberately optional for every source.
    if (!String(address.state || "").trim() ||
        !String(address.city || "").trim()) {

      return {
        valid: false,
        message: source === "new"
          ? "Please select or enter your state and settlement."
          : "The selected address is missing its state or settlement. Please update it in My Addresses and try again."
      };

    }

    return {
      valid: true
    };

  }

  async function checkDeliveryFee() {

    if (getFulfillmentMethod() !== "delivery") {
      return;
    }

    const requestNumber = ++deliveryRequestNumber;

    const address = buildDeliveryAddress();

    const validation =
      validateLocationBeforeFeeCheck(address);

    if (!validation.valid) {

      deliveryCheckComplete = false;
      deliveryAvailable = false;
      deliveryRequiresManualReview = false;

      estimatedDeliveryFee = 0;

      if (elements.deliveryFeeMessage) {
        elements.deliveryFeeMessage.textContent =
          validation.message;
      }

      updateOrderTotal();

      return;

    }

    deliveryCheckComplete = false;
    deliveryAvailable = false;
    deliveryRequiresManualReview = false;

    estimatedDeliveryFee = 0;

    updateOrderTotal();

    if (elements.deliveryFeeMessage) {

      elements.deliveryFeeMessage.textContent =
        "Checking delivery availability...";

    }

    try {

      const { data, error } = await supabase.rpc(
        "get_delivery_fee",
        getDeliveryFeeParameters(address)
      );

      if (error) throw error;

      if (requestNumber !== deliveryRequestNumber) {
        return;
      }

      if (getFulfillmentMethod() !== "delivery") {
        return;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      if (!result || result.success === false) {

        throw new Error(
          result?.message ||
          "We could not verify this delivery location."
        );

      }

      deliveryCheckComplete = true;

      if (result.available === true) {

        deliveryAvailable = true;

        deliveryRequiresManualReview = false;

        estimatedDeliveryFee =
          Number(result.delivery_fee) || 0;

        if (elements.deliveryFeeMessage) {

          elements.deliveryFeeMessage.textContent =
            `Delivery is available. Delivery fee: ${formatMoney(estimatedDeliveryFee)}.`;

        }

      } else {

        deliveryAvailable = false;

        deliveryRequiresManualReview = true;

        estimatedDeliveryFee = 0;

        if (elements.deliveryFeeMessage) {

          deliveryFeeMessageText();

        }

      }

      updateOrderTotal();

    } catch (error) {

      if (requestNumber !== deliveryRequestNumber) {
        return;
      }

      console.error(
        "[CHECKOUT] Delivery fee check failed:",
        error
      );

      deliveryCheckComplete = false;
      deliveryAvailable = false;
      deliveryRequiresManualReview = false;

      estimatedDeliveryFee = 0;

      if (elements.deliveryFeeMessage) {

        elements.deliveryFeeMessage.textContent =
          getErrorMessage(error) ||
          "Unable to check delivery availability. Please try again.";

      }

      updateOrderTotal();

    }

  }


  function deliveryFeeMessageText() {

    const resultText =
      "This location is not covered by a fixed delivery fee yet. You can still place your order. Our team will contact you to confirm the delivery fee. You will initially pay for your items only.";

    elements.deliveryFeeMessage.textContent = resultText;

  }


  /* =======================================================
     22. DELIVERY VALIDATION
  ======================================================= */

  function validateDeliveryAddress() {

    const address = buildDeliveryAddress();

    const locationValidation =
      validateLocationBeforeFeeCheck(address);

    if (!locationValidation.valid) {
      return locationValidation;
    }

    if (!deliveryCheckComplete) {

      return {
        valid: false,
        message:
          "Please wait for the delivery location check to finish."
      };

    }

    if (!deliveryAvailable && !deliveryRequiresManualReview) {

      return {
        valid: false,
        message:
          "The delivery location could not be verified. Please check it again."
      };

    }

    if (
      getSelectedDeliverySource() === "new" &&
      (!address.state || !address.city)
    ) {

      return {
        valid: false,
        message:
          "Please provide your state and settlement."
      };

    }

    return {
      valid: true,
      address
    };

  }


  /* =======================================================
     23. SAVE NEW CUSTOMER ADDRESS
  ======================================================= */

  async function saveNewCustomerAddress(address) {

    const insertData = {

      user_id: currentUser.id,

      label: address.address_label || "Checkout Address",

      recipient_name:
        address.recipient_name ||
        customerProfile.full_name,

      phone:
        address.phone ||
        customerProfile.phone,

      address_line_1:
        address.address_line_1 || null,

      address_line_2:
        address.address_line_2 || null,

      city: address.city,

      state: address.state,

      postal_code:
        address.postal_code || null,

      country:
        address.country || "Nigeria",

      delivery_instructions:
        address.delivery_instructions || null,

      is_default: false,

      lga_id: address.lga_id || null,

      city_id: address.city_id || null,

      area_id: address.area_id || null,

      custom_lga: address.custom_lga || null,

      custom_city: address.custom_city || null,

      custom_area: address.custom_area || null,

      location_node_id:
        address.location_node_id || null,

      is_custom_location:
        Boolean(address.is_custom_location),

      custom_location_text:
        address.custom_location_text || null

    };

    const { data, error } = await supabase
      .from("addresses")
      .insert(insertData)
      .select("*")
      .single();

    if (error) throw error;

    return data;

  }


  /* =======================================================
     24. BANK TRANSFER DETAILS
  ======================================================= */

  async function loadBankTransferDetails() {

    try {

      const { data, error } = await supabase
        .from("business_settings")
        .select("bank_transfer_details")
        .eq("id", 1)
        .single();

      if (error) throw error;

      bankTransferDetails =
        data?.bank_transfer_details || null;

      const details = bankTransferDetails || {};

      const hasRequiredDetails = Boolean(
        details.bank_name &&
        details.account_name &&
        details.account_number
      );

      if (!hasRequiredDetails) {

        elements.bankName.textContent = "Not configured";

        elements.bankAccountName.textContent =
          "Not configured";

        elements.bankAccountNumber.textContent =
          "Not configured";

        elements.bankInstructions.textContent =
          "Bank transfer details are currently unavailable. Please contact our team before making payment.";

        elements.bankDetailsMessage.textContent =
          "Bank account details have not yet been configured.";

        elements.bankDetailsMessage.dataset.type = "error";

        return false;

      }

      elements.bankName.textContent =
        details.bank_name;

      elements.bankAccountName.textContent =
        details.account_name;

      elements.bankAccountNumber.textContent =
        details.account_number;

      elements.bankInstructions.textContent =
        details.instructions || "";

      elements.bankDetailsMessage.textContent = "";

      delete elements.bankDetailsMessage.dataset.type;

      return true;

    } catch (error) {

      console.error(
        "[CHECKOUT] Bank details loading failed:",
        error
      );

      bankTransferDetails = null;

      elements.bankName.textContent = "Unavailable";

      elements.bankAccountName.textContent = "Unavailable";

      elements.bankAccountNumber.textContent = "Unavailable";

      elements.bankInstructions.textContent =
        "We could not retrieve our bank account details. Please try again later.";

      elements.bankDetailsMessage.textContent =
        "Unable to load bank account details.";

      elements.bankDetailsMessage.dataset.type = "error";

      return false;

    }

  }


  /* =======================================================
     25. BANK DETAILS PANEL
  ======================================================= */

  function toggleBankDetails() {

    const isOpen = !elements.bankDetailsPanel.hidden;

    elements.bankDetailsPanel.hidden = isOpen;

    elements.viewBankDetailsButton.setAttribute(
      "aria-expanded",
      String(!isOpen)
    );

    elements.viewBankDetailsButton.innerHTML =
      isOpen
        ? `
          <i class="fa-solid fa-building-columns" aria-hidden="true"></i>
          View Bank Details
        `
        : `
          <i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
          Hide Bank Details
        `;

  }


  async function copyBankDetail(button) {

    const targetId = button.dataset.copyTarget;

    const target = document.getElementById(targetId);

    if (!target) return;

    const value = target.textContent.trim();

    if (
      !value ||
      value === "Loading..." ||
      value === "Unavailable" ||
      value === "Not configured"
    ) {

      elements.bankDetailsMessage.textContent =
        "This bank detail is currently unavailable.";

      elements.bankDetailsMessage.dataset.type = "error";

      return;

    }

    const originalContent = button.innerHTML;

    try {

      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {

        await navigator.clipboard.writeText(value);

      } else {

        const temporaryInput =
          document.createElement("textarea");

        temporaryInput.value = value;

        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";

        document.body.appendChild(temporaryInput);

        temporaryInput.select();

        const copied = document.execCommand("copy");

        temporaryInput.remove();

        if (!copied) {
          throw new Error("Copy operation failed.");
        }

      }

      button.innerHTML = `
        <i class="fa-solid fa-check" aria-hidden="true"></i>
        <span>Copied</span>
      `;

      const detailLabel =
        button.closest(".checkout-bank-detail")
          ?.querySelector(":scope > span")
          ?.textContent.trim() || "Bank detail";

      elements.bankDetailsMessage.textContent =
        `${detailLabel} copied successfully.`;

      elements.bankDetailsMessage.dataset.type = "success";

      setTimeout(() => {
        button.innerHTML = originalContent;
      }, 1800);

    } catch (error) {

      console.error(
        "[CHECKOUT] Bank detail copy failed:",
        error
      );

      elements.bankDetailsMessage.textContent =
        "Unable to copy. Please copy the detail manually.";

      elements.bankDetailsMessage.dataset.type = "error";

    }

  }


  /* =======================================================
     26. RECEIPT VALIDATION
  ======================================================= */

  function validateReceiptFile(file) {

    if (!file) {

      return {
        valid: false,
        message: "Please select your payment receipt."
      };

    }

    if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {

      return {
        valid: false,
        message: "Only JPG, PNG and PDF receipts are accepted."
      };

    }

    if (file.size > MAX_RECEIPT_SIZE) {

      return {
        valid: false,
        message: "Your receipt must not exceed 5 MB."
      };

    }

    return {
      valid: true
    };

  }


  function initializeReceiptPreview() {

    const input = elements.receiptFile;

    if (!input || receiptPreviewElements) {
      return;
    }

    const preview = document.createElement("div");
    preview.className = "checkout-receipt-preview";
    preview.id = "checkoutReceiptPreview";
    preview.hidden = true;

    const image = document.createElement("img");
    image.className = "checkout-receipt-preview-image";
    image.alt = "Selected payment receipt preview";
    image.hidden = true;

    const fileDetails = document.createElement("div");
    fileDetails.className = "checkout-receipt-preview-file";
    fileDetails.hidden = true;

    const fileIcon = document.createElement("i");
    fileIcon.className = "fa-solid fa-file-pdf";
    fileIcon.setAttribute("aria-hidden", "true");

    const fileText = document.createElement("div");

    const fileName = document.createElement("strong");
    fileName.className = "checkout-receipt-preview-name";

    const fileNote = document.createElement("small");
    fileNote.className = "checkout-receipt-preview-note";

    fileText.append(fileName, fileNote);
    fileDetails.append(fileIcon, fileText);
    preview.append(image, fileDetails);

    input.insertAdjacentElement("afterend", preview);

    receiptPreviewElements = {
      preview,
      image,
      fileDetails,
      fileName,
      fileNote
    };

  }


  function clearReceiptPreview() {

    if (receiptPreviewObjectUrl) {
      URL.revokeObjectURL(receiptPreviewObjectUrl);
      receiptPreviewObjectUrl = null;
    }

    if (!receiptPreviewElements) {
      return;
    }

    receiptPreviewElements.preview.hidden = true;
    receiptPreviewElements.image.hidden = true;
    receiptPreviewElements.image.removeAttribute("src");
    receiptPreviewElements.fileDetails.hidden = true;
    receiptPreviewElements.fileName.textContent = "";
    receiptPreviewElements.fileNote.textContent = "";

  }


  function renderReceiptPreview(file) {

    initializeReceiptPreview();

    if (!file || !receiptPreviewElements) {
      clearReceiptPreview();
      return;
    }

    clearReceiptPreview();

    const {
      preview,
      image,
      fileDetails,
      fileName,
      fileNote
    } = receiptPreviewElements;

    preview.hidden = false;
    fileName.textContent = file.name;

    if (file.type && file.type.startsWith("image/")) {

      receiptPreviewObjectUrl = URL.createObjectURL(file);
      image.src = receiptPreviewObjectUrl;
      image.hidden = false;
      fileNote.textContent = "Check that this is the correct payment receipt.";

    } else {

      fileDetails.hidden = false;
      fileNote.textContent = "PDF selected. Image preview is not available for PDF files.";

    }

  }


  /* =======================================================
     27. RECEIPT UPLOAD
  ======================================================= */

  async function uploadPaymentReceipt(file) {

    if (!currentUser) {

      throw new Error(
        "Your session has expired. Please sign in again."
      );

    }

    const validation = validateReceiptFile(file);

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const extension = file.name
      .split(".")
      .pop()
      .toLowerCase();

    const uniqueName = (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    )
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `${currentUser.id}/${uniqueName}.${extension}`;

    const { data, error } = await supabase
      .storage
      .from(RECEIPT_BUCKET)
      .upload(
        filePath,
        file,
        {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false
        }
      );

    if (error) throw error;

    return data.path || filePath;

  }


  async function handleReceiptSelection() {

    const file = elements.receiptFile.files?.[0];

    uploadedReceiptPath = null;

    if (!file) {

      clearReceiptPreview();

      setReceiptStatus(
        "No receipt uploaded yet.",
        "info"
      );

      return;

    }

    const validation = validateReceiptFile(file);

    if (!validation.valid) {

      elements.receiptFile.value = "";
      clearReceiptPreview();

      setReceiptStatus(
        validation.message,
        "error"
      );

      return;

    }

    // Show the selected image immediately so the customer can
    // confirm it is the correct receipt before placing the order.
    renderReceiptPreview(file);

    receiptUploadInProgress = true;

    elements.receiptFile.disabled = true;

    setReceiptStatus(
      "Uploading your payment receipt...",
      "loading"
    );

    try {

      uploadedReceiptPath =
        await uploadPaymentReceipt(file);

      setReceiptStatus(
        `Receipt uploaded successfully: ${file.name}`,
        "success"
      );

    } catch (error) {

      console.error(
        "[CHECKOUT] Receipt upload failed:",
        error
      );

      uploadedReceiptPath = null;

      setReceiptStatus(
        getErrorMessage(error),
        "error"
      );

    } finally {

      receiptUploadInProgress = false;

      elements.receiptFile.disabled = false;

    }

  }

  /* =======================================================
     28. CHECKOUT VALIDATION
  ======================================================= */

  function validateCheckout() {

    const method = getFulfillmentMethod();

    if (!method) {

      return {
        valid: false,
        message:
          "Please select Store Pickup or Home Delivery."
      };

    }

    if (!customerProfile) {

      return {
        valid: false,
        message:
          "Your customer profile could not be verified."
      };

    }

    if (!cartItems.length) {

      return {
        valid: false,
        message: "Your cart is empty."
      };

    }

    if (method === "delivery") {

      const deliveryValidation =
        validateDeliveryAddress();

      if (!deliveryValidation.valid) {
        return deliveryValidation;
      }

    }

    const bankDetailsComplete = Boolean(
      bankTransferDetails?.bank_name &&
      bankTransferDetails?.account_name &&
      bankTransferDetails?.account_number
    );

    if (!bankDetailsComplete) {

      return {
        valid: false,
        message:
          "Bank account details are currently unavailable. Please contact us before placing your order."
      };

    }

    if (receiptUploadInProgress) {

      return {
        valid: false,
        message:
          "Please wait for your payment receipt to finish uploading."
      };

    }

    if (!uploadedReceiptPath) {

      return {
        valid: false,
        message:
          "Please upload your payment receipt before placing your order."
      };

    }

    return {
      valid: true
    };

  }


  /* =======================================================
     29. SUBMISSION BUTTON
  ======================================================= */

  function setSubmittingState(submitting) {

    isSubmitting = submitting;

    elements.placeOrderButton.disabled = submitting;

    elements.placeOrderButton.innerHTML =
      submitting
        ? `
          <span>
            <i class="fa-solid fa-spinner fa-spin"></i>
            Processing Order...
          </span>
        `
        : `
          <span>
            Place Order
          </span>

          <span aria-hidden="true">
            <i class="fa-solid fa-arrow-right"></i>
          </span>
        `;

  }


  /* =======================================================
     30. ORDER SUCCESS
  ======================================================= */

  function showOrderSuccess(orderId) {

    // The checkout introduction belongs to the form, not the success
    // state. Hide it once the order has been placed.
    const checkoutHeading = document.querySelector(".checkout-heading");

    if (checkoutHeading) {
      checkoutHeading.hidden = true;
      checkoutHeading.style.display = "none";
      checkoutHeading.setAttribute("aria-hidden", "true");
    }

    const orderUrl =
      `order-details.html?id=${encodeURIComponent(orderId)}`;

    elements.content.innerHTML = `

      <div class="checkout-success">

        <div class="checkout-success-icon">

          <i class="fa-solid fa-circle-check"></i>

        </div>

        <h2>
          Your Order Has Been Placed!
        </h2>

        <p>
          Thank you for shopping with us.
          Your order has been received successfully.
        </p>

        <p>
          Your payment is currently pending verification.
          Our team will review your uploaded receipt.
        </p>

        <a
          href="${orderUrl}"
          class="account-primary-button"
        >

          View Order Details

          <i class="fa-solid fa-arrow-right"></i>

        </a>

        <a
          href="orders.html"
          class="checkout-back-to-cart"
        >

          View My Orders

        </a>

      </div>

    `;

  }


  /* =======================================================
     31. SUBMIT CHECKOUT
  ======================================================= */

  async function submitCheckout(event) {

    event.preventDefault();

    if (isSubmitting) return;

    hideMessage();

    const validation = validateCheckout();

    if (!validation.valid) {

      showMessage(validation.message);

      return;

    }

    setSubmittingState(true);

    try {

      const method = getFulfillmentMethod();

      let deliveryAddress = null;

      if (method === "delivery") {

        deliveryAddress = buildDeliveryAddress();

        /*
         * Save newly entered addresses to the customer's
         * own addresses table.
         *
         * This does not add anything to the shared
         * delivery directory or create an approved zone.
         */

        if (getSelectedDeliverySource() === "new") {

          const savedAddress =
            await saveNewCustomerAddress(deliveryAddress);

          deliveryAddress.saved_address_id =
            savedAddress.id;

        }

      }

      const requestedDate =
        elements.requestedDate.value || null;

      const requestedTime =
        elements.requestedTime.value.trim() || null;

      const customerNotes =
        elements.customerNotes.value.trim() || null;

      const transferReference =
        elements.transferReference.value.trim() || null;

      const { data, error } = await supabase.rpc(
        "checkout_create_order",
        {

          p_fulfillment_method: method,

          p_delivery_address: deliveryAddress,

          p_requested_date: requestedDate,

          p_requested_time: requestedTime,

          p_customer_notes: customerNotes,

          p_receipt_path: uploadedReceiptPath,

          p_transfer_reference: transferReference

        }
      );

      if (error) throw error;

      const result = Array.isArray(data)
        ? data[0]
        : data;

      if (
        !result?.success ||
        !result?.order_id
      ) {

        throw new Error(
          result?.message ||
          "Your order could not be created. Please try again."
        );

      }

      showOrderSuccess(result.order_id);

    } catch (error) {

      console.error(
        "[CHECKOUT] Order submission failed:",
        error
      );

      showMessage(getErrorMessage(error));

    } finally {

      setSubmittingState(false);

    }

  }


  /* =======================================================
     32. INITIAL DATA LOADING
  ======================================================= */

  async function loadCheckout() {

    setPageState("loading");

    hideMessage();

    try {

      currentUser = await getAuthenticatedUser();

      if (!currentUser) return;

      await loadCustomerProfile();

      await Promise.all([

        loadCart(),

        loadBankTransferDetails(),

        loadSavedAddresses(),

        loadDeliveryDirectory()

      ]);

      await loadApprovedDeliveryLocations();

      if (!cartItems.length) {

        setPageState("empty");

        return;

      }

      await signReferenceImages();

      renderCartItems();

      updateFulfillmentDisplay();

      setPageState("content");

    } catch (error) {

      console.error(
        "[CHECKOUT] Initialization failed:",
        error
      );

      if (elements.errorMessage) {

        elements.errorMessage.textContent =
          getErrorMessage(error);

      }

      setPageState("error");

    }

  }


  /* =======================================================
     33. EVENT LISTENERS
  ======================================================= */

  function initializeEventListeners() {

    initializeReceiptPreview();

    // FULFILMENT

    elements.pickup.addEventListener(
      "change",
      updateFulfillmentDisplay
    );

    elements.delivery.addEventListener(
      "change",
      updateFulfillmentDisplay
    );


    // DELIVERY SOURCES

    [
      elements.sourceSaved,
      elements.sourceSystem,
      elements.sourceNew
    ].forEach(radio => {

      radio.addEventListener(
        "change",
        updateDeliverySourceDisplay
      );

    });


    // SAVED ADDRESS

    elements.savedAddressSelect.addEventListener(
      "change",
      handleSavedAddressChange
    );


    // APPROVED HAFHASS LOCATION

    elements.approvedLocationSelect.addEventListener(
      "change",
      handleApprovedLocationChange
    );


    // NEW LOCATION HIERARCHY

    elements.state.addEventListener(
      "change",
      handleStateChange
    );

    elements.lga.addEventListener(
      "change",
      handleLgaChange
    );

    elements.settlement.addEventListener(
      "change",
      handleSettlementChange
    );

    elements.area.addEventListener(
      "change",
      handleAreaChange
    );

    elements.specificLocation.addEventListener(
      "change",
      handleSpecificLocationChange
    );


    // CUSTOM LOCATION INPUTS

    [
      elements.customState,
      elements.customLga,
      elements.customSettlement,
      elements.customArea,
      elements.customSpecificLocation
    ].forEach(input => {

      input.addEventListener(
        "input",
        scheduleDeliveryFeeCheck
      );

    });


    // ADDRESS DETAILS

    [
      elements.addressLine1,
      elements.addressLine2,
      elements.postalCode,
      elements.country,
      elements.deliveryInstructions
    ].forEach(input => {

      input.addEventListener(
        "input",
        () => {}
      );

    });


    // BANK DETAILS

    elements.viewBankDetailsButton.addEventListener(
      "click",
      toggleBankDetails
    );


    // COPY BANK DETAILS

    elements.bankDetailsPanel.addEventListener(
      "click",
      event => {

        const button = event.target.closest(
          ".checkout-copy-button"
        );

        if (!button) return;

        copyBankDetail(button);

      }
    );


    // RECEIPT UPLOAD

    elements.receiptFile.addEventListener(
      "change",
      handleReceiptSelection
    );


    // FORM SUBMISSION

    elements.form.addEventListener(
      "submit",
      submitCheckout
    );


    // RETRY

    if (elements.retryButton) {

      elements.retryButton.addEventListener(
        "click",
        loadCheckout
      );

    }

  }


  /* =======================================================
     33A. SEARCHABLE LOCATION PICKER
     Turns the location dropdowns into searchable pickers.
     It reads the options already inside each <select>, so it
     works with whatever the cascade logic fills in, and it
     reports the choice by firing the select's normal
     "change" event. If the modal markup is missing, the
     dropdowns simply stay native.
  ======================================================= */

  const locationPicker = {
    els: null,
    config: null,
    items: [],
    customItem: null,
    previousFocus: null
  };


  function updateLocationPickerViewport() {

    if (!locationPicker.els || locationPicker.els.modal.hidden) {
      return;
    }

    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    const offsetTop = viewport ? viewport.offsetTop : 0;

    document.documentElement.style.setProperty(
      "--customer-picker-viewport-height",
      `${Math.max(240, height)}px`
    );

    document.documentElement.style.setProperty(
      "--customer-picker-viewport-top",
      `${Math.max(0, offsetTop)}px`
    );

  }


  function normalizePickerText(value) {

    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  }


  function getPickerOptionsFromSelect(select, allowClear) {

    const items = [];
    let customItem = null;

    Array.from(select.options).forEach(option => {

      const label = (option.textContent || "").trim();

      if (option.value === "") {
        return;
      }

      if (option.value === CUSTOM_VALUE) {

        customItem = {
          value: CUSTOM_VALUE,
          label
        };

        return;

      }

      items.push({
        value: option.value,
        label
      });

    });

    if (allowClear && select.value !== "") {

      items.unshift({
        value: "",
        label: "Clear selection",
        isClear: true
      });

    }

    return { items, customItem };

  }


  function openLocationPicker(config) {

    const els = locationPicker.els;
    const select = config.select;

    if (!els || !select || select.disabled) {
      return;
    }

    locationPicker.config = config;
    locationPicker.previousFocus = select;

    const picked = getPickerOptionsFromSelect(
      select,
      config.allowClear
    );

    locationPicker.items = picked.items;
    locationPicker.customItem = picked.customItem;

    els.title.textContent = config.title;
    els.description.textContent = config.description;
    els.search.value = "";

    // PINNED "NOT LISTED" OPTION

    if (els.custom && els.customButton) {

      els.customButton.replaceChildren();

      if (picked.customItem) {

        const icon = document.createElement("i");

        icon.className = "fa-solid fa-pen-to-square";
        icon.setAttribute("aria-hidden", "true");

        els.customButton.appendChild(icon);

        els.customButton.appendChild(
          document.createTextNode(
            ` ${picked.customItem.label}`
          )
        );

      }

      els.custom.hidden = !picked.customItem;

    }

    renderLocationPickerResults();

    els.modal.hidden = false;

    document.body.classList.add(
      "customer-location-picker-open"
    );

    // Do not focus the search input automatically. On Android this
    // opens the keyboard as soon as the modal appears and can shift
    // the viewport before the customer is ready to type.
    requestAnimationFrame(updateLocationPickerViewport);

  }


  function closeLocationPicker() {

    const els = locationPicker.els;

    if (!els || els.modal.hidden) {
      return;
    }

    els.modal.hidden = true;

    document.body.classList.remove(
      "customer-location-picker-open"
    );

    const returnTo = locationPicker.previousFocus;

    locationPicker.config = null;
    locationPicker.items = [];
    locationPicker.customItem = null;
    locationPicker.previousFocus = null;

    if (returnTo && returnTo.focus) {
      returnTo.focus();
    }

  }


  function renderLocationPickerResults() {

    const els = locationPicker.els;
    const config = locationPicker.config;

    if (!els || !config) {
      return;
    }

    const query = normalizePickerText(els.search.value);

    const filtered = locationPicker.items.filter(item =>
      item.isClear ||
      normalizePickerText(item.label).includes(query)
    );

    const matchCount = filtered.filter(
      item => !item.isClear
    ).length;

    els.results.replaceChildren();

    els.resultCount.textContent =
      `${matchCount} ${matchCount === 1 ? config.noun : config.plural} found`;

    if (els.clearSearch) {
      els.clearSearch.hidden = !els.search.value;
    }

    els.results.hidden = filtered.length === 0;
    els.empty.hidden = matchCount > 0;

    if (els.emptyText) {

      els.emptyText.textContent = locationPicker.customItem
        ? "No matches found. Try another name, or enter it manually below."
        : "No locations match your search. Try another name.";

    }

    const currentValue = config.select.value;

    filtered.forEach(item => {

      const option = document.createElement("button");

      option.type = "button";
      option.className = "customer-location-picker-option";
      option.textContent = item.label;
      option.dataset.value = item.value;
      option.setAttribute("role", "option");

      if (item.isClear) {
        option.classList.add("is-clear");
      }

      const selected =
        !item.isClear &&
        currentValue !== "" &&
        currentValue === item.value;

      option.setAttribute(
        "aria-selected",
        selected ? "true" : "false"
      );

      if (selected) {
        option.classList.add("selected");
      }

      option.addEventListener("click", () => {
        selectLocationPickerValue(item.value);
      });

      els.results.appendChild(option);

    });

  }


  function selectLocationPickerValue(value) {

    const config = locationPicker.config;

    if (!config || !config.select) {
      return;
    }

    const select = config.select;

    closeLocationPicker();

    select.value = value;

    select.dispatchEvent(
      new Event("change", { bubbles: true })
    );

  }


  function attachLocationPickerToSelect(config) {

    const select = config.select;

    if (!select) {
      return;
    }

    select.setAttribute("aria-haspopup", "dialog");

    select.addEventListener("pointerdown", event => {

      if (select.disabled) {
        return;
      }

      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      event.preventDefault();

      openLocationPicker(config);

    });

    // Fallback for assistive technology that only sends "click".

    select.addEventListener("click", event => {

      if (select.disabled) {
        return;
      }

      event.preventDefault();

      if (!locationPicker.config) {
        openLocationPicker(config);
      }

    });

    select.addEventListener("keydown", event => {

      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {

        if (select.disabled) {
          return;
        }

        event.preventDefault();

        openLocationPicker(config);

      }

    });

  }


  function initializeLocationPickers() {

    const modal = document.getElementById(
      "checkoutLocationPickerModal"
    );

    // No modal markup: leave the native dropdowns untouched.

    if (!modal) {
      return;
    }

    const els = {
      modal,
      title: document.getElementById("checkoutLocationPickerTitle"),
      description: document.getElementById("checkoutLocationPickerDescription"),
      search: document.getElementById("checkoutLocationPickerSearch"),
      clearSearch: document.getElementById("clearCheckoutLocationPickerSearch"),
      resultCount: document.getElementById("checkoutLocationPickerResultCount"),
      results: document.getElementById("checkoutLocationPickerResults"),
      empty: document.getElementById("checkoutLocationPickerEmpty"),
      emptyText: document.getElementById("checkoutLocationPickerEmptyText"),
      custom: document.getElementById("checkoutLocationPickerCustom"),
      customButton: document.getElementById("checkoutLocationPickerCustomButton"),
      closeButton: document.getElementById("closeCheckoutLocationPicker"),
      cancelButton: document.getElementById("cancelCheckoutLocationPicker")
    };

    const required = [
      "title",
      "description",
      "search",
      "resultCount",
      "results",
      "empty"
    ];

    if (required.some(key => !els[key])) {

      console.warn(
        "Checkout: Location picker markup is incomplete."
      );

      return;

    }

    locationPicker.els = els;

    // Keep the modal within the visible portion of the screen when
    // Android's keyboard opens after the customer taps the search box.
    updateLocationPickerViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        updateLocationPickerViewport
      );
      window.visualViewport.addEventListener(
        "scroll",
        updateLocationPickerViewport
      );
    }

    window.addEventListener(
      "resize",
      updateLocationPickerViewport
    );


    // ONE CONFIGURATION PER SEARCHABLE DROPDOWN

    [
      {
        select: elements.state,
        title: "Select State",
        description: "Search for your state.",
        noun: "state",
        plural: "states",
        allowClear: false
      },
      {
        select: elements.lga,
        title: "Select LGA",
        description: "Search for your local government area.",
        noun: "LGA",
        plural: "LGAs",
        allowClear: false
      },
      {
        select: elements.settlement,
        title: "Select Settlement",
        description: "Search for your settlement, city or town.",
        noun: "settlement",
        plural: "settlements",
        allowClear: false
      },
      {
        select: elements.area,
        title: "Select Area",
        description: "Search for your area or neighbourhood.",
        noun: "area",
        plural: "areas",
        allowClear: true
      },
      {
        select: elements.specificLocation,
        title: "Select Specific Location",
        description: "Search for your street, estate, market or landmark.",
        noun: "location",
        plural: "locations",
        allowClear: true
      },
      {
        select: elements.approvedLocationSelect,
        title: "Select Delivery Location",
        description: "Search the locations approved for HAFHASS delivery.",
        noun: "location",
        plural: "locations",
        allowClear: false
      }
    ].forEach(attachLocationPickerToSelect);


    // SEARCH BOX

    els.search.addEventListener(
      "input",
      renderLocationPickerResults
    );

    els.search.addEventListener("keydown", event => {

      if (event.key === "ArrowDown") {

        const first = els.results.querySelector(
          ".customer-location-picker-option"
        );

        if (first) {
          event.preventDefault();
          first.focus();
        }

      }

      if (event.key === "Enter") {

        event.preventDefault();

        const firstMatch = els.results.querySelector(
          ".customer-location-picker-option:not(.is-clear)"
        );

        if (firstMatch) {
          firstMatch.click();
        }

      }

    });

    if (els.clearSearch) {

      els.clearSearch.addEventListener("click", () => {

        els.search.value = "";

        renderLocationPickerResults();

        els.search.focus();

      });

    }


    // ARROW KEYS INSIDE THE RESULT LIST

    els.results.addEventListener("keydown", event => {

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
        return;
      }

      const buttons = Array.from(
        els.results.querySelectorAll(
          ".customer-location-picker-option"
        )
      );

      const index = buttons.indexOf(document.activeElement);

      event.preventDefault();

      if (event.key === "ArrowDown") {

        buttons[Math.min(index + 1, buttons.length - 1)]?.focus();

      } else if (index <= 0) {

        els.search.focus();

      } else {

        buttons[index - 1].focus();

      }

    });


    // "NOT LISTED" BUTTON

    if (els.customButton) {

      els.customButton.addEventListener("click", () => {
        selectLocationPickerValue(CUSTOM_VALUE);
      });

    }


    // CLOSING

    [els.closeButton, els.cancelButton].forEach(button => {

      if (button) {
        button.addEventListener("click", closeLocationPicker);
      }

    });

    modal.addEventListener("click", event => {

      if (event.target === modal) {
        closeLocationPicker();
      }

    });

    document.addEventListener("keydown", event => {

      if (modal.hidden) {
        return;
      }

      if (event.key === "Escape") {
        closeLocationPicker();
      }

    });

  }


  /* =======================================================
     34. INITIALIZATION
  ======================================================= */

  async function initializeCheckout() {

    initializeEventListeners();

    // Searchable location dropdowns. A failure here must never
    // stop the checkout from loading.

    try {

      initializeLocationPickers();

    } catch (error) {

      console.error(
        "Checkout: Location search is unavailable.",
        error
      );

    }

    await loadCheckout();

  }


  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeCheckout,
      { once: true }
    );

  } else {

    initializeCheckout();

  }


})();
