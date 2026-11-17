/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   CUSTOMER CART CONTROLLER
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     1. DEPENDENCIES
  ======================================================= */

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;


  /* =======================================================
     2. DOM ELEMENTS
  ======================================================= */

  const elements = {

    cartLoading:
      document.getElementById("cartLoading"),

    cartError:
      document.getElementById("cartError"),

    cartErrorMessage:
      document.getElementById("cartErrorMessage"),

    retryCartButton:
      document.getElementById("retryCartButton"),

    cartEmpty:
      document.getElementById("cartEmpty"),

    cartContent:
      document.getElementById("cartContent"),

    cartItemCount:
      document.getElementById("cartItemCount"),

    cartItemsList:
      document.getElementById("cartItemsList"),

    cartSubtotal:
      document.getElementById("cartSubtotal"),

    cartSummaryTotal:
      document.getElementById("cartSummaryTotal"),

    checkoutButton:
      document.getElementById("checkoutButton"),

    avatarInitials:
      document.getElementById("avatarInitials"),

    sidebarUserName:
      document.getElementById("sidebarUserName"),

    sidebarUserEmail:
      document.getElementById("sidebarUserEmail"),

    year:
      document.getElementById("accountYear")

  };


  /* =======================================================
     3. PAGE STATE
  ======================================================= */

  let currentUser = null;

  let currentProfile = null;

  let currentCart = null;

  let cartItems = [];

  let isLoading = false;

  let isUpdating = false;


  /* =======================================================
     4. GENERAL HELPERS
  ======================================================= */

  function setText(element, value) {

    if (element) {
      element.textContent = value;
    }

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


  function getInitials(name) {

    if (!name || typeof name !== "string") {
      return "H";
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "H";

  }


  function getProfileData(result) {

    if (!result) {
      return null;
    }

    return (
      result.profile ||
      result.data?.profile ||
      result.data ||
      result
    );

  }


  function formatCurrency(amount, currency = "NGN") {

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return "—";
    }

    const currencyValue = String(
      currency || "NGN"
    ).trim().toUpperCase();


    const currencySymbols = {
      NGN: "₦",
      "₦": "₦",
      USD: "$",
      "$": "$",
      GBP: "£",
      "£": "£",
      EUR: "€",
      "€": "€"
    };


    if (/^[A-Z]{3}$/.test(currencyValue)) {

      try {

        return new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: currencyValue,
          maximumFractionDigits: 2
        }).format(numericAmount);

      } catch (error) {

        console.warn(
          "HAFHASS Cart: Currency formatting error.",
          error
        );

      }

    }


    const symbol =
      currencySymbols[currencyValue] ||
      currencySymbols[currency] ||
      `${currencyValue} `;


    return (
      symbol +
      numericAmount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );

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


  function getErrorMessage(error) {

    return (
      error?.message ||
      error?.details ||
      "Something went wrong. Please try again."
    );

  }


  function notifyCartUpdated() {

    window.dispatchEvent(
      new CustomEvent("hafhass:cart-updated")
    );

  }


  /* =======================================================
     5. PAGE STATES
  ======================================================= */

  function showLoading() {

    hideElement(elements.cartError);

    hideElement(elements.cartEmpty);

    hideElement(elements.cartContent);

    showElement(elements.cartLoading);

  }


  function resetCartSummary() {

    setText(elements.cartItemCount, "0");

    setText(
      elements.cartSubtotal,
      formatCurrency(0)
    );

    setText(
      elements.cartSummaryTotal,
      formatCurrency(0)
    );

  }


  function showEmptyCart() {

    resetCartSummary();

    hideElement(elements.cartLoading);

    hideElement(elements.cartError);

    hideElement(elements.cartContent);

    showElement(elements.cartEmpty);

    notifyCartUpdated();

  }


  function showCartError(message) {

    hideElement(elements.cartLoading);

    hideElement(elements.cartEmpty);

    hideElement(elements.cartContent);

    setText(
      elements.cartErrorMessage,
      message ||
      "Something went wrong while loading your cart."
    );

    showElement(elements.cartError);

  }


  /* =======================================================
     6. CUSTOMER PROFILE
  ======================================================= */

  async function loadCustomerProfile(
    user,
    verifiedProfile = null
  ) {

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
              result.message ||
              "Unable to load profile."
            );

        }

        profile = getProfileData(result);

      } catch (error) {

        console.warn(
          "HAFHASS Cart: Profile loading error.",
          error
        );

      }

    }


    currentProfile = profile;


    const metadata = user?.user_metadata || {};


    const fullName =
      profile?.full_name ||
      profile?.name ||
      metadata.full_name ||
      metadata.name ||
      "Customer";


    const email =
      profile?.email ||
      user?.email ||
      "";


    setText(elements.sidebarUserName, fullName);

    setText(elements.sidebarUserEmail, email);

    setText(
      elements.avatarInitials,
      getInitials(fullName)
    );

  }


  /* =======================================================
     7. CURRENT CUSTOMER
  ======================================================= */

  async function getCurrentCustomer(guardResult = null) {

    // FIRST: REUSE THE AUTHENTICATED USER FROM THE GUARD.

    const guardedUser =
      guardResult?.user ||
      guardResult?.data?.user ||
      null;

    if (guardedUser?.id) {
      return guardedUser;
    }


    // SECOND: CHECK THE EXISTING AUTH SESSION.

    const sessionResult = await auth.getSession();

    if (sessionResult?.error) {
      throw sessionResult.error;
    }


    const session =
      sessionResult?.data?.session ||
      sessionResult?.session ||
      (
        sessionResult?.data?.user
          ? sessionResult.data
          : null
      ) ||
      null;


    if (session?.user?.id) {
      return session.user;
    }


    // THIRD: FALL BACK TO THE AUTH HELPER.

    const userResult = await auth.getCurrentUser();

    if (
      userResult?.success === false ||
      userResult?.error
    ) {

      throw userResult.error ||
        new Error(
          userResult.message ||
          "Unable to retrieve customer."
        );

    }


    if (userResult?.user?.id) {
      return userResult.user;
    }

    if (userResult?.id) {
      return userResult;
    }

    return null;

  }


  /* =======================================================
     8. FIND OR CREATE ACTIVE CART
  ======================================================= */

  async function getActiveCart() {

    const { data, error } = await supabase
      .from("carts")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false
      })
      .limit(1);

    if (error) {
      throw error;
    }


    if (data?.length) {
      return data[0];
    }


    const {
      data: newCart,
      error: createError
    } = await supabase
      .from("carts")
      .insert({
        user_id: currentUser.id,
        status: "active"
      })
      .select()
      .single();


    if (createError) {
      throw createError;
    }

    return newCart;

  }


  /* =======================================================
     9. LOAD CART ITEMS
  ======================================================= */

  async function loadCartItems() {

    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id,
        cart_id,
        product_id,
        quantity,
        selected_options,
        custom_text,
        customer_notes,
        reference_image_url,
        created_at,
        updated_at,

        product:products (
          id,
          name,
          sku,
          short_description,
          description,
          pricing_type,
          price,
          currency,
          availability,
          status,
          stock_quantity,
          minimum_order_quantity,
          maximum_order_quantity,

          product_images (
            image_url,
            alt_text,
            display_order,
            is_primary
          )
        )
      `)
      .eq("cart_id", currentCart.id)
      .order("created_at", {
        ascending: false
      });


    if (error) {
      throw error;
    }


    cartItems = data || [];


    // GENERATE TEMPORARY URLS FOR PRIVATE REFERENCE IMAGES.

    await Promise.all(
      cartItems.map(async item => {

        item.reference_image_signed_url = null;

        if (!item.reference_image_url) {
          return;
        }


        try {

          const {
            data: signedData,
            error: signedError
          } = await supabase.storage
            .from("customer-uploads")
            .createSignedUrl(
              item.reference_image_url,
              3600
            );


          if (signedError) {
            throw signedError;
          }


          item.reference_image_signed_url =
            signedData?.signedUrl || null;


        } catch (error) {

          console.warn(
            "HAFHASS Cart: Could not generate reference image URL.",
            error
          );

        }

      })
    );


    return cartItems;

  }


  /* =======================================================
     10. PRODUCT IMAGE
  ======================================================= */

  function getProductImage(product) {

    const images = product?.product_images || [];

    if (!images.length) {
      return null;
    }


    const sortedImages = [...images].sort((a, b) => {

      if (a.is_primary !== b.is_primary) {
        return a.is_primary ? -1 : 1;
      }

      return (
        (a.display_order || 0) -
        (b.display_order || 0)
      );

    });


    return sortedImages[0]?.image_url || null;

  }


  /* =======================================================
     11. SELECTED OPTIONS
  ======================================================= */

  function getSelectedOptions(item) {

    if (!Array.isArray(item.selected_options)) {
      return [];
    }

    return item.selected_options;

  }


  function getOptionAdjustment(option) {

    const amount =
      Number(option?.price_adjustment) || 0;

    const type = String(
      option?.price_adjustment_type || "none"
    ).toLowerCase();


    if (type === "fixed" || type === "add") {
      return amount;
    }

    return 0;

  }


  function calculateOptionAdjustment(item) {

    return getSelectedOptions(item).reduce(
      (total, option) => {

        return total + getOptionAdjustment(option);

      },
      0
    );

  }


  function renderSelectedOptions(item) {

    const options = getSelectedOptions(item);

    if (!options.length) {
      return null;
    }


    const container = document.createElement("div");

    container.className = "cart-item-options";


    options.forEach(option => {

      const optionName =
        option.display_name ||
        option.option_display_name ||
        option.option_name ||
        option.name ||
        "";


      const optionValue =
        option.label ||
        option.value ||
        option.selected_value ||
        "";


      const line = document.createElement("div");


      if (optionName && optionValue) {

        line.textContent =
          `${optionName}: ${optionValue}`;

      } else {

        line.textContent =
          optionValue || optionName;

      }


      if (line.textContent) {
        container.appendChild(line);
      }

    });


    return container.childElementCount
      ? container
      : null;

  }


  /* =======================================================
     12. PRODUCT PRICING
  ======================================================= */

  function getItemCurrency(item) {

    const currency = item.product?.currency;

    if (
      typeof currency !== "string" ||
      !currency.trim()
    ) {
      return "NGN";
    }

    return currency.trim();

  }


  function getItemPricingType(item) {

    return String(
      item.product?.pricing_type || "fixed"
    ).toLowerCase();

  }


  function getItemUnitPrice(item) {

    const basePrice =
      Number(item.product?.price) || 0;

    return (
      basePrice +
      calculateOptionAdjustment(item)
    );

  }


  function requiresQuotation(item) {

    return getItemPricingType(item) === "quote";

  }


  function isStartingPrice(item) {

    return getItemPricingType(item) === "starting_from";

  }


  /* =======================================================
     13. PRODUCT AVAILABILITY
  ======================================================= */

  function getProductAvailability(item) {

    const product = item.product;

    if (!product) {
      return "unavailable";
    }


    if (product.status !== "active") {
      return "unavailable";
    }


    if (product.availability === "out_of_stock") {
      return "out_of_stock";
    }


    if (
      product.availability === "in_stock" &&
      product.stock_quantity !== null &&
      Number(product.stock_quantity) <= 0
    ) {

      return "out_of_stock";

    }


    return product.availability || "unavailable";

  }


  function getAvailabilityLabel(item) {

    const availability = getProductAvailability(item);


    const labels = {
      in_stock: "In stock",
      out_of_stock: "Out of stock",
      pre_order: "Available for pre-order",
      made_to_order: "Made to order",
      unavailable: "Currently unavailable"
    };


    return (
      labels[availability] ||
      "Currently unavailable"
    );

  }


  function isProductPurchasable(item) {

    const availability = getProductAvailability(item);


    return [
      "in_stock",
      "pre_order",
      "made_to_order"
    ].includes(availability);

  }


  function getQuantityLimits(item) {

    const product = item.product;


    const minimum = Math.max(
      1,
      Number(product?.minimum_order_quantity) || 1
    );


    let maximum =
      product?.maximum_order_quantity === null ||
      product?.maximum_order_quantity === undefined
        ? Infinity
        : Number(product.maximum_order_quantity);


    if (
      product?.availability === "in_stock" &&
      product.stock_quantity !== null &&
      product.stock_quantity !== undefined
    ) {

      const stock = Number(product.stock_quantity);

      if (Number.isFinite(stock)) {
        maximum = Math.min(maximum, stock);
      }

    }


    return {
      minimum,
      maximum
    };

  }


  /* =======================================================
     14. CREATE CART ITEM
  ======================================================= */

  function createCartItemElement(item) {

    const product = item.product;


    const itemElement =
      document.createElement("article");

    itemElement.className = "cart-item";


    const productName =
      product?.name || "Unavailable Product";


    const description =
      product?.short_description ||
      product?.description ||
      "";


    const image = getProductImage(product);

    const currency = getItemCurrency(item);


    const quantity =
      Math.max(1, Number(item.quantity) || 1);


    const unitPrice = getItemUnitPrice(item);

    const lineTotal = unitPrice * quantity;


    const quotation = requiresQuotation(item);

    const startingPrice = isStartingPrice(item);

    const purchasable = isProductPurchasable(item);


    /* PRODUCT IMAGE */

    if (image) {

      const imageElement =
        document.createElement("img");

      imageElement.className = "cart-item-image";

      imageElement.src = image;

      imageElement.alt =
        product?.product_images?.find(
          picture => picture.image_url === image
        )?.alt_text || productName;

      imageElement.loading = "lazy";


      imageElement.onerror = () => {

        const placeholder =
          document.createElement("div");

        placeholder.className =
          "cart-item-image cart-image-placeholder";

        placeholder.textContent = "Image unavailable";

        imageElement.replaceWith(placeholder);

      };


      itemElement.appendChild(imageElement);

    } else {

      const placeholder =
        document.createElement("div");

      placeholder.className =
        "cart-item-image cart-image-placeholder";

      placeholder.textContent = "Image unavailable";

      itemElement.appendChild(placeholder);

    }


    /* PRODUCT DETAILS */

    const details =
      document.createElement("div");

    details.className = "cart-item-details";


    const name =
      document.createElement("h3");

    name.className = "cart-item-name";

    name.textContent = productName;


    const productDescription =
      document.createElement("p");

    productDescription.className =
      "cart-item-description";

    productDescription.textContent = description;


    const price =
      document.createElement("div");

    price.className = "cart-item-price";


    // DISPLAY THE CORRECT PRODUCT PRICING TYPE.

    if (!product) {

      price.textContent = "Product unavailable";

    } else if (quotation) {

      price.textContent = "Price on request";

    } else if (startingPrice) {

      price.textContent =
        `Starting from ${formatCurrency(unitPrice, currency)}`;

    } else {

      price.textContent =
        formatCurrency(unitPrice, currency);

    }


    details.append(
      name,
      productDescription,
      price
    );


    /* AVAILABILITY */

    const availability =
      document.createElement("p");

    availability.className =
      "cart-item-availability";

    availability.textContent =
      getAvailabilityLabel(item);

    details.appendChild(availability);


    if (!purchasable) {

      availability.classList.add("is-unavailable");

    }


    /* SELECTED OPTIONS */

    const selectedOptions =
      renderSelectedOptions(item);

    if (selectedOptions) {
      details.appendChild(selectedOptions);
    }


    /* CUSTOM TEXT */

    if (item.custom_text) {

      const customText =
        document.createElement("p");

      customText.className = "cart-item-options";

      customText.textContent =
        `Customisation: ${item.custom_text}`;

      details.appendChild(customText);

    }


    /* CUSTOMER NOTES */

    if (item.customer_notes) {

      const notes =
        document.createElement("p");

      notes.className = "cart-item-options";

      notes.textContent =
        `Note: ${item.customer_notes}`;

      details.appendChild(notes);

    }


    /* REFERENCE IMAGE */

    if (item.reference_image_url) {

      const referenceLink =
        document.createElement("a");


      if (item.reference_image_signed_url) {

        referenceLink.href =
          item.reference_image_signed_url;

        referenceLink.target = "_blank";

        referenceLink.rel =
          "noopener noreferrer";

        referenceLink.textContent =
          "View reference image";

      } else {

        referenceLink.textContent =
          "Reference image unavailable";

        referenceLink.classList.add(
          "is-unavailable"
        );

      }


      referenceLink.classList.add(
        "cart-reference-link"
      );

      details.appendChild(referenceLink);

    }


    /* ITEM ACTIONS */

    const actions =
      document.createElement("div");

    actions.className = "cart-item-actions";


    const quantityControl =
      document.createElement("div");

    quantityControl.className =
      "cart-quantity-control";


    const { minimum, maximum } =
      getQuantityLimits(item);


    const decreaseButton =
      document.createElement("button");

    decreaseButton.type = "button";

    decreaseButton.textContent = "−";

    decreaseButton.setAttribute(
      "aria-label",
      "Decrease quantity"
    );

    decreaseButton.disabled =
      !purchasable ||
      isUpdating ||
      quantity <= minimum;


    const quantityText =
      document.createElement("span");

    quantityText.textContent = quantity;


    const increaseButton =
      document.createElement("button");

    increaseButton.type = "button";

    increaseButton.textContent = "+";

    increaseButton.setAttribute(
      "aria-label",
      "Increase quantity"
    );

    increaseButton.disabled =
      !purchasable ||
      isUpdating ||
      quantity >= maximum;


    quantityControl.append(
      decreaseButton,
      quantityText,
      increaseButton
    );


    /* LINE TOTAL */

    const lineTotalElement =
      document.createElement("strong");

    lineTotalElement.className =
      "cart-item-line-total";


    if (!product) {

      lineTotalElement.textContent =
        "Product unavailable";

    } else if (quotation) {

      lineTotalElement.textContent =
        "Quotation required";

    } else if (startingPrice) {

      lineTotalElement.textContent =
        `From ${formatCurrency(lineTotal, currency)}`;

    } else {

      lineTotalElement.textContent =
        formatCurrency(lineTotal, currency);

    }


    /* REMOVE BUTTON */

    const removeButton =
      document.createElement("button");

    removeButton.type = "button";

    removeButton.className =
      "cart-remove-button";

    removeButton.textContent = "Remove";

    removeButton.disabled = isUpdating;


    actions.append(
      quantityControl,
      lineTotalElement,
      removeButton
    );


    details.appendChild(actions);

    itemElement.appendChild(details);


    /* ITEM EVENTS */

    decreaseButton.addEventListener("click", () => {

      updateQuantity(item, -1);

    });


    increaseButton.addEventListener("click", () => {

      updateQuantity(item, 1);

    });


    removeButton.addEventListener("click", () => {

      removeCartItem(item);

    });


    return itemElement;

  }


  /* =======================================================
     15. RENDER CART SUMMARY
  ======================================================= */

  function renderCartSummary() {

    const totalQuantity = cartItems.reduce(
      (total, item) => {

        return total + (
          Number(item.quantity) || 0
        );

      },
      0
    );


    setText(
      elements.cartItemCount,
      totalQuantity
    );


    const currencies = [
      ...new Set(
        cartItems.map(getItemCurrency)
      )
    ];


    // A SINGLE SUMMARY CANNOT ACCURATELY COMBINE
    // DIFFERENT CURRENCIES.

    if (currencies.length > 1) {

      setText(
        elements.cartSubtotal,
        "Multiple currencies"
      );

      setText(
        elements.cartSummaryTotal,
        "Multiple currencies"
      );

      return;

    }


    const currency = currencies[0] || "NGN";


    let fixedSubtotal = 0;

    let startingSubtotal = 0;


    let hasStartingPrice = false;

    let hasQuotation = false;


    cartItems.forEach(item => {

      const quantity =
        Number(item.quantity) || 0;

      const pricingType =
        getItemPricingType(item);


      if (!item.product || pricingType === "quote") {

        hasQuotation = true;

        return;

      }


      const lineTotal =
        getItemUnitPrice(item) * quantity;


      if (pricingType === "starting_from") {

        hasStartingPrice = true;

        startingSubtotal += lineTotal;

      } else {

        fixedSubtotal += lineTotal;

      }

    });


    const estimatedSubtotal =
      fixedSubtotal + startingSubtotal;


    /* SUBTOTAL */

    let subtotalText;


    if (hasStartingPrice) {

      subtotalText =
        `Estimated from ${formatCurrency(
          estimatedSubtotal,
          currency
        )}`;

    } else {

      subtotalText =
        formatCurrency(
          estimatedSubtotal,
          currency
        );

    }


    setText(
      elements.cartSubtotal,
      subtotalText
    );


    /* TOTAL */

    let totalText;


    if (hasQuotation) {

      totalText = "Quotation required";

    } else if (hasStartingPrice) {

      totalText =
        `Estimated from ${formatCurrency(
          estimatedSubtotal,
          currency
        )}`;

    } else {

      totalText =
        formatCurrency(
          estimatedSubtotal,
          currency
        );

    }


    setText(
      elements.cartSummaryTotal,
      totalText
    );

  }


  /* =======================================================
     16. RENDER CART
  ======================================================= */

  function renderCart() {

    if (!cartItems.length) {

      showEmptyCart();

      return;

    }


    if (!elements.cartItemsList) {

      console.error(
        "HAFHASS Cart: Cart items container was not found."
      );

      return;

    }


    elements.cartItemsList.replaceChildren();


    cartItems.forEach(item => {

      const itemElement =
        createCartItemElement(item);

      elements.cartItemsList.appendChild(itemElement);

    });


    renderCartSummary();
    
    prepareCheckoutButton();


    hideElement(elements.cartLoading);

    hideElement(elements.cartError);

    hideElement(elements.cartEmpty);

    showElement(elements.cartContent);


    notifyCartUpdated();

  }


  /* =======================================================
     17. UPDATE QUANTITY
  ======================================================= */

  async function updateQuantity(item, change) {

    if (isUpdating) {
      return;
    }


    if (!isProductPurchasable(item)) {

      showNotification(
        "This product is currently unavailable.",
        "warning"
      );

      return;

    }


    const newQuantity =
      Number(item.quantity) + change;


    const { minimum, maximum } =
      getQuantityLimits(item);


    if (newQuantity < minimum) {
      return;
    }


    if (newQuantity > maximum) {

      showNotification(
        `The maximum available quantity is ${maximum}.`,
        "warning"
      );

      return;

    }


    isUpdating = true;

    renderCart();


    try {

      const {
        data,
        error
      } = await supabase
        .from("cart_items")
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id)
        .eq("cart_id", currentCart.id)
        .select("id")
        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {

        throw new Error(
          "The cart item could not be updated."
        );

      }


      item.quantity = newQuantity;


      showNotification(
        "Cart quantity updated.",
        "success"
      );


    } catch (error) {

      console.error(
        "HAFHASS Cart: Quantity update error.",
        error
      );


      showNotification(
        "Unable to update the quantity. Please try again.",
        "error"
      );

    } finally {

      isUpdating = false;

      renderCart();

    }

  }


  /* =======================================================
     18. REMOVE CART ITEM
  ======================================================= */

  async function removeCartItem(item) {

    if (isUpdating) {
      return;
    }


    const confirmed = window.confirm(
      "Are you sure you want to remove this item from your cart?"
    );


    if (!confirmed) {
      return;
    }


    isUpdating = true;

    renderCart();


    try {

      const {
        data,
        error
      } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", item.id)
        .eq("cart_id", currentCart.id)
        .select("id")
        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {

        throw new Error(
          "The cart item could not be removed."
        );

      }


      cartItems = cartItems.filter(
        cartItem => cartItem.id !== item.id
      );


      showNotification(
        "Item removed from your cart.",
        "success"
      );


    } catch (error) {

      console.error(
        "HAFHASS Cart: Remove item error.",
        error
      );


      showNotification(
        "Unable to remove this item. Please try again.",
        "error"
      );

    } finally {

      isUpdating = false;

      renderCart();

    }

  }


  /* =======================================================
     19. LOAD CART
  ======================================================= */

  async function loadCart() {

    if (isLoading) {
      return;
    }


    isLoading = true;

    showLoading();


    try {

      currentCart = await getActiveCart();


      if (!currentCart?.id) {

        throw new Error(
          "Your shopping cart could not be found."
        );

      }


      await loadCartItems();

      renderCart();


    } catch (error) {

      console.error(
        "HAFHASS Cart: Loading error.",
        error
      );


      showCartError(
        getErrorMessage(error)
      );

    } finally {

      isLoading = false;

    }

  }


  /* =======================================================
     20. CHECKOUT
  ======================================================= */

  function handleCheckout() {

  if (!cartItems.length) {

    showNotification(
      "Your cart is empty.",
      "warning"
    );

    return;

  }

  window.location.href = "checkout.html";

}


  function prepareCheckoutButton() {

  if (!elements.checkoutButton) {
    return;
  }

  elements.checkoutButton.disabled = cartItems.length === 0;

  elements.checkoutButton.setAttribute(
    "aria-disabled",
    String(cartItems.length === 0)
  );

  elements.checkoutButton.title =
    cartItems.length === 0
      ? "Add products to your cart before checkout."
      : "Proceed to checkout.";

}


  /* =======================================================
     21. EVENT LISTENERS
  ======================================================= */

  function attachEventListeners() {

    elements.retryCartButton?.addEventListener(
      "click",
      loadCart
    );


    elements.checkoutButton?.addEventListener(
      "click",
      handleCheckout
    );

  }


  /* =======================================================
     22. INITIALISE CART
  ======================================================= */

  async function initialiseCart() {

    setText(
      elements.year,
      new Date().getFullYear()
    );


    prepareCheckoutButton();


    if (!supabase || !auth || !guards) {

      console.error(
        "HAFHASS Cart: Account services are unavailable."
      );


      showCartError(
        "The account services could not be loaded. Please refresh the page."
      );

      return;

    }


    try {

      /* PROTECT CUSTOMER PAGE */

      const guardResult =
        await guards.protectCustomerPage({
          loginPage: "../login.html"
        });


      // DO NOT CONTINUE IF THE PAGE GUARD DENIES ACCESS.

      if (
        !guardResult ||
        guardResult.authorized !== true
      ) {

        return;

      }


      /* GET CURRENT CUSTOMER */

      currentUser =
        await getCurrentCustomer(guardResult);


      if (!currentUser?.id) {

        window.location.replace("../login.html");

        return;

      }


      /* REUSE PROFILE FROM PAGE GUARD */

      const verifiedProfile =
        guardResult?.profile ||
        guardResult?.data?.profile ||
        null;


      /* LOAD CUSTOMER INFORMATION */

      await loadCustomerProfile(
        currentUser,
        verifiedProfile
      );


      /* ATTACH EVENTS */

      attachEventListeners();


      /* LOAD CART */

      await loadCart();


    } catch (error) {

      console.error(
        "HAFHASS Cart: Initialisation error.",
        error
      );


      showCartError(
        "Unable to initialise your cart. Please refresh the page."
      );

    }

  }


  /* =======================================================
     23. START
  ======================================================= */

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initialiseCart
    );

  } else {

    initialiseCart();

  }


})();