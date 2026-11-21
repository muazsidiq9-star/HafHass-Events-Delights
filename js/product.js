/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   PRODUCT DETAILS CONTROLLER
========================================================= */

(() => {
  "use strict";


  /* =======================================================
     1. CONFIGURATION & DEPENDENCIES
  ======================================================= */

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;

  const REFERENCE_IMAGE_BUCKET = "customer-uploads";

  const MAX_REFERENCE_IMAGE_SIZE = 15 * 1024 * 1024;

  const ALLOWED_REFERENCE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  const SUPPORTED_OPTION_TYPES = [
    "single_select",
    "multi_select",
    "text",
    "number",
    "color",
    "date",
    "checkbox"
  ];

  if (!supabase || !auth) {
    console.error(
      "HAFHASS Product: Required dependencies are unavailable."
    );

    return;
  }


  /* =======================================================
     2. DOM ELEMENTS
  ======================================================= */

  const elements = {
    breadcrumbProductName:
      document.getElementById("breadcrumbProductName"),

    loading:
      document.getElementById("productLoading"),

    error:
      document.getElementById("productError"),

    errorMessage:
      document.getElementById("productErrorMessage"),

    retryButton:
      document.getElementById("retryProductButton"),

    notFound:
      document.getElementById("productNotFound"),

    content:
      document.getElementById("productContent"),

    mainImage:
      document.getElementById("productMainImage"),

    imagePlaceholder:
      document.getElementById("productImagePlaceholder"),

    badge:
      document.getElementById("productBadge"),

    thumbnailList:
      document.getElementById("productThumbnailList"),

    category:
      document.getElementById("productCategory"),

    name:
      document.getElementById("productName"),

    sku:
      document.getElementById("productSku"),

    price:
      document.getElementById("productPrice"),

    comparePrice:
      document.getElementById("productComparePrice"),

    availability:
      document.getElementById("productAvailability"),

    stock:
      document.getElementById("productStock"),

    shortDescription:
      document.getElementById("productShortDescription"),

    preparation:
      document.getElementById("productPreparation"),

    preparationTime:
      document.getElementById("productPreparationTime"),

    options:
      document.getElementById("productOptions"),

    optionsList:
      document.getElementById("productOptionsList"),

    quantitySection:
      document.getElementById("productQuantitySection"),

    decreaseQuantity:
      document.getElementById("decreaseQuantity"),

    quantity:
      document.getElementById("productQuantity"),

    increaseQuantity:
      document.getElementById("increaseQuantity"),

    customTextSection:
      document.getElementById("productCustomTextSection"),

    customText:
      document.getElementById("productCustomText"),

    customerNotes:
      document.getElementById("productCustomerNotes"),

    referenceSection:
      document.getElementById("productReferenceSection"),

    referenceImage:
      document.getElementById("productReferenceImage"),

    addToCartButton:
      document.getElementById("addToCartButton"),

    favouriteButton:
      document.getElementById("productFavouriteButton"),

    message:
      document.getElementById("productMessage"),

    description:
      document.getElementById("productDescription"),

    relatedSection:
      document.getElementById("relatedProductsSection"),

    relatedGrid:
      document.getElementById("relatedProductsGrid")
  };


  /* =======================================================
     3. PAGE STATE
  ======================================================= */

  let currentProduct = null;

  let currentImages = [];

  let currentUser = null;

  let productOptions = [];

  let selectedReferenceFile = null;

  let referencePreviewUrl = null;

  let referenceUploadedPath = null;

  let referenceRemoveButton = null;

  let currentQuantity = 1;

  let minimumQuantity = 1;

  let maximumQuantity = Infinity;

  let currentFavouriteId = null;

  let isAddingToCart = false;

  let isFavouriteActionRunning = false;


  /* =======================================================
     4. GENERAL HELPERS
  ======================================================= */

  function getErrorDetails(error) {
    return {
      message:
        error?.message || "An unexpected error occurred.",

      details: error?.details || "",

      hint: error?.hint || "",

      code: error?.code || ""
    };
  }


  function setText(element, value) {
    if (!element) return;

    element.textContent =
      value === null || value === undefined
        ? ""
        : String(value);
  }


  function setHidden(element, hidden) {
    if (!element) return;

    element.hidden = hidden;
  }


  function showMessage(message, type = "success") {
    if (!elements.message) return;

    elements.message.textContent = message;

    elements.message.className =
      `product-message ${type}`;

    elements.message.hidden = false;

    elements.message.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }


  function clearMessage() {
    if (!elements.message) return;

    elements.message.textContent = "";

    elements.message.hidden = true;

    elements.message.className = "product-message";
  }


  function showLoading() {
    setHidden(elements.loading, false);

    setHidden(elements.error, true);

    setHidden(elements.notFound, true);

    setHidden(elements.content, true);
  }


  function showError(message) {
    setHidden(elements.loading, true);

    setHidden(elements.content, true);

    setHidden(elements.notFound, true);

    setHidden(elements.error, false);

    setText(elements.errorMessage, message);
  }


  function showNotFound() {
    setHidden(elements.loading, true);

    setHidden(elements.error, true);

    setHidden(elements.content, true);

    setHidden(elements.notFound, false);
  }


  function showProduct() {
    setHidden(elements.loading, true);

    setHidden(elements.error, true);

    setHidden(elements.notFound, true);

    setHidden(elements.content, false);
  }


  function formatCurrency(amount, currency = "NGN") {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return "Price on Request";
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


  function formatAvailability(value) {
    const labels = {
      in_stock: "In Stock",

      out_of_stock: "Out of Stock",

      pre_order: "Available for Pre-Order",

      made_to_order: "Made to Order"
    };

    return labels[value] || "Availability Not Specified";
  }


  function getProductPrice(product) {
    if (product.pricing_type === "quote") {
      return "Price on Request";
    }

    const price = formatCurrency(
      product.price,
      product.currency
    );

    if (product.pricing_type === "starting_from") {
      return `From ${price}`;
    }

    return price;
  }


  function getImageUrl(image) {
    return image?.image_url || "";
  }


  function getProductImage(images) {
    if (!Array.isArray(images) || !images.length) {
      return "";
    }

    const primaryImage =
      images.find(image => image.is_primary) ||
      images[0];

    return primaryImage?.image_url || "";
  }


  /* =======================================================
     5. AUTHENTICATION HELPERS
  ======================================================= */

  async function getCurrentCustomer() {
    try {
      const sessionResult = await auth.getSession();

      if (sessionResult?.error) {
        throw sessionResult.error;
      }

      const session =
        sessionResult?.data?.session ||
        sessionResult?.session ||
        sessionResult?.data ||
        sessionResult;

      if (session?.user) {
        currentUser = session.user;

        return currentUser;
      }

      const userResult = await auth.getCurrentUser();

      if (userResult?.error) {
        throw userResult.error;
      }

      currentUser =
        userResult?.user ||
        userResult?.data?.user ||
        userResult?.data ||
        null;

      return currentUser;

    } catch (error) {
      console.warn(
        "HAFHASS Product: Authentication check failed.",
        getErrorDetails(error)
      );

      currentUser = null;

      return null;
    }
  }


  function redirectToLogin() {
    const returnUrl =
      window.location.pathname +
      window.location.search;

    window.location.href =
      `login.html?redirect=${encodeURIComponent(returnUrl)}`;
  }


  /* =======================================================
     6. PRODUCT IDENTIFICATION
  ======================================================= */

  function getProductSlug() {
    const parameters = new URLSearchParams(
      window.location.search
    );

    return parameters.get("slug");
  }


  /* =======================================================
     7. LOAD PRODUCT
  ======================================================= */

  async function fetchProduct() {
    const slug = getProductSlug();

    if (!slug) {
      showNotFound();

      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        categories (
          id,
          name,
          slug
        )
      `)
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      showNotFound();

      return;
    }

    currentProduct = data;

    await Promise.all([
      fetchProductImages(),

      fetchProductOptions()
    ]);

    await checkFavouriteStatus();

    try {
      await fetchRelatedProducts();

    } catch (error) {
      console.warn(
        "HAFHASS Product: Related products could not be loaded.",
        getErrorDetails(error)
      );

      setHidden(elements.relatedSection, true);
    }

    showProduct();
  }


  /* =======================================================
     8. PRODUCT IMAGES
  ======================================================= */

  async function fetchProductImages() {
    const { data, error } = await supabase
      .from("product_images")
      .select(`
        id,
        product_id,
        image_url,
        alt_text,
        display_order,
        is_primary
      `)
      .eq("product_id", currentProduct.id)
      .order("is_primary", {
        ascending: false
      })
      .order("display_order", {
        ascending: true
      });

    if (error) throw error;

    currentImages = data || [];
  }


  function renderProductImages() {
    const primaryImage =
      getProductImage(currentImages);

    if (elements.mainImage) {
      if (primaryImage) {
        elements.mainImage.src = primaryImage;

        elements.mainImage.alt =
          currentImages.find(image => image.is_primary)?.alt_text ||
          currentProduct.name;

        elements.mainImage.hidden = false;

        setHidden(elements.imagePlaceholder, true);

      } else {
        elements.mainImage.removeAttribute("src");

        elements.mainImage.hidden = true;

        setHidden(elements.imagePlaceholder, false);
      }
    }

    if (!elements.thumbnailList) return;

    elements.thumbnailList.innerHTML = "";

    if (currentImages.length <= 1) {
      setHidden(elements.thumbnailList, true);

      return;
    }

    setHidden(elements.thumbnailList, false);

    currentImages.forEach((image, index) => {
      const button = document.createElement("button");

      button.type = "button";

      button.className =
        `product-thumbnail ${index === 0 ? "active" : ""}`;

      button.setAttribute(
        "aria-label",
        `View product image ${index + 1}`
      );

      const thumbnail = document.createElement("img");

      thumbnail.src = getImageUrl(image);

      thumbnail.alt =
        image.alt_text || currentProduct.name;

      thumbnail.loading = "lazy";

      button.appendChild(thumbnail);

      button.addEventListener("click", () => {
        if (!elements.mainImage) return;

        elements.mainImage.src = image.image_url;

        elements.mainImage.alt =
          image.alt_text || currentProduct.name;

        elements.mainImage.hidden = false;

        setHidden(elements.imagePlaceholder, true);

        elements.thumbnailList
          .querySelectorAll(".product-thumbnail")
          .forEach(item => item.classList.remove("active"));

        button.classList.add("active");
      });

      elements.thumbnailList.appendChild(button);
    });
  }


  /* =======================================================
     9. PRODUCT INFORMATION
  ======================================================= */

  function renderProductInformation() {
    const product = currentProduct;

    setText(
      elements.breadcrumbProductName,
      product.name
    );

    setText(
      elements.name,
      product.name
    );

    setText(
      elements.category,
      product.categories?.name || "Uncategorised"
    );

    setText(
      elements.sku,
      product.sku ? `SKU: ${product.sku}` : ""
    );

    setText(
      elements.price,
      getProductPrice(product)
    );

    setText(
      elements.shortDescription,
      product.short_description || ""
    );

    setText(
      elements.description,
      product.description || product.short_description || ""
    );

    setText(
      elements.availability,
      formatAvailability(product.availability)
    );

    if (elements.availability) {
      elements.availability.classList.remove(
        "in-stock",
        "out-of-stock",
        "pre-order",
        "made-to-order"
      );

      const availabilityClasses = {
        in_stock: "in-stock",

        out_of_stock: "out-of-stock",

        pre_order: "pre-order",

        made_to_order: "made-to-order"
      };

      const availabilityClass =
        availabilityClasses[product.availability];

      if (availabilityClass) {
        elements.availability.classList.add(
          availabilityClass
        );
      }
    }

    if (elements.badge) {
      elements.badge.hidden = !product.is_featured;

      if (product.is_featured) {
        elements.badge.textContent = "Featured";
      }
    }

    if (elements.comparePrice) {
      const comparePrice = Number(product.compare_at_price);

      const actualPrice = Number(product.price);

      if (
        product.pricing_type === "fixed" &&
        Number.isFinite(comparePrice) &&
        comparePrice > actualPrice &&
        actualPrice > 0
      ) {
        elements.comparePrice.textContent =
          formatCurrency(comparePrice, product.currency);

        elements.comparePrice.hidden = false;

      } else {
        elements.comparePrice.textContent = "";

        elements.comparePrice.hidden = true;
      }
    }

    const preparationDays =
      Number(product.preparation_time_days);

    if (
      Number.isFinite(preparationDays) &&
      preparationDays > 0
    ) {
      setHidden(elements.preparation, false);

      setText(
        elements.preparationTime,
        `${preparationDays} ${preparationDays === 1 ? "day" : "days"}`
      );

    } else {
      setHidden(elements.preparation, true);
    }

    if (
      product.availability === "in_stock" &&
      product.stock_quantity !== null &&
      product.stock_quantity !== undefined
    ) {
      const stock = Number(product.stock_quantity);

      setHidden(elements.stock, false);

      setText(
        elements.stock,
        stock > 0
          ? `${stock} available`
          : "Currently unavailable"
      );

    } else {
      setHidden(elements.stock, true);
    }

    renderProductImages();
  }


  /* =======================================================
     10. FETCH PRODUCT OPTIONS
  ======================================================= */

  async function fetchProductOptions() {
    const { data: options, error } = await supabase
      .from("product_options")
      .select("*")
      .eq("product_id", currentProduct.id)
      .eq("is_active", true)
      .order("display_order", {
        ascending: true
      });

    if (error) throw error;

    const activeOptions = options || [];

    const loadedOptions = await Promise.all(
      activeOptions.map(async option => {
        if (
          !SUPPORTED_OPTION_TYPES.includes(option.input_type)
        ) {
          console.warn(
            `HAFHASS Product: Unsupported option type "${option.input_type}" for ${option.name}.`
          );

          return null;
        }

        const { data: values, error: valuesError } =
          await supabase
            .from("product_option_values")
            .select(`
              id,
              option_id,
              value,
              label,
              price_adjustment_type,
              price_adjustment,
              display_order,
              is_available
            `)
            .eq("option_id", option.id)
            .eq("is_available", true)
            .order("display_order", {
              ascending: true
            });

        if (valuesError) throw valuesError;

        return {
          ...option,

          values: values || []
        };
      })
    );

    productOptions = loadedOptions.filter(Boolean);
  }


  /* =======================================================
     11. OPTION INPUT HELPERS
  ======================================================= */

  function getOptionMinimum(option) {
    const value =
      option.minimum_selections === null ||
      option.minimum_selections === undefined
        ? 0
        : Number(option.minimum_selections);

    const minimum =
      Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : 0;

    if (option.is_required) {
      return Math.max(1, minimum);
    }

    return minimum;
  }


  function getOptionMaximum(option) {
    if (
      option.maximum_selections === null ||
      option.maximum_selections === undefined
    ) {
      return Infinity;
    }

    const value = Number(option.maximum_selections);

    if (!Number.isFinite(value)) {
      return Infinity;
    }

    return Math.max(0, Math.floor(value));
  }


  function createOptionInput(option, type) {
    const input = document.createElement("input");

    input.type = type;

    input.className = "product-option-input";

    input.dataset.optionId = option.id;

    input.dataset.optionType = option.input_type;

    input.required = Boolean(option.is_required);

    return input;
  }


  function getOptionDisplayStyle(option) {
    const style = String(
      option.display_style || "select"
    ).toLowerCase();

    const supportedStyles = [
      "select",
      "radio",
      "checkbox",
      "swatches",
      "buttons"
    ];

    return supportedStyles.includes(style)
      ? style
      : "select";
  }


  function getOptionLabel(option) {
    return option.display_name || option.name;
  }


  /* =======================================================
     12. RENDER PRODUCT OPTIONS
  ======================================================= */

  function renderProductOptions() {
    if (!elements.options || !elements.optionsList) {
      return;
    }

    elements.optionsList.innerHTML = "";

    if (!productOptions.length) {
      setHidden(elements.options, true);

      return;
    }

    setHidden(elements.options, false);

    productOptions.forEach(option => {
      const wrapper = document.createElement("div");

      wrapper.className = "product-option-group";

      wrapper.dataset.optionId = option.id;

      const label = document.createElement("label");

      label.className = "product-option-label";

      label.textContent = getOptionLabel(option);

      if (option.is_required) {
        const required = document.createElement("span");

        required.className = "required-indicator";

        required.textContent = " *";

        label.appendChild(required);
      }

      wrapper.appendChild(label);

      if (option.description) {
        const description = document.createElement("p");

        description.className = "product-option-description";

        description.textContent = option.description;

        wrapper.appendChild(description);
      }

      if (option.help_text) {
        const help = document.createElement("small");

        help.className = "product-option-help";

        help.textContent = option.help_text;

        wrapper.appendChild(help);
      }

      switch (option.input_type) {
        case "single_select":
          renderSingleSelectOption(wrapper, option);
          break;

        case "multi_select":
          renderMultiSelectOption(wrapper, option);
          break;

        case "text":
          renderTextOption(wrapper, option);
          break;

        case "number":
          renderNumberOption(wrapper, option);
          break;

        case "color":
          renderColorOption(wrapper, option);
          break;

        case "date":
          renderDateOption(wrapper, option);
          break;

        case "checkbox":
          renderCheckboxOption(wrapper, option);
          break;
      }

      elements.optionsList.appendChild(wrapper);
    });
  }


  /* =======================================================
     13. SINGLE SELECT OPTIONS
  ======================================================= */

  function renderSingleSelectOption(wrapper, option) {
    const style = getOptionDisplayStyle(option);

    if (style === "radio" || style === "buttons") {
      renderChoiceInputs(
        wrapper,
        option,
        "radio",
        style
      );

      return;
    }

    const select = document.createElement("select");

    select.className = "product-option-input";

    select.dataset.optionId = option.id;

    select.dataset.optionType = option.input_type;

    select.required = Boolean(option.is_required);

    const placeholder = document.createElement("option");

    placeholder.value = "";

    placeholder.textContent =
      option.placeholder || "Choose an option";

    select.appendChild(placeholder);

    option.values.forEach(value => {
      const item = document.createElement("option");

      item.value = value.id;

      item.textContent =
        value.label || value.value;

      select.appendChild(item);
    });

    select.disabled = option.values.length === 0;

    wrapper.appendChild(select);
  }


  /* =======================================================
     14. MULTI SELECT OPTIONS
  ======================================================= */

  function renderMultiSelectOption(wrapper, option) {
    const style = getOptionDisplayStyle(option);

    renderChoiceInputs(
      wrapper,
      option,
      "checkbox",
      style
    );
  }


  /* =======================================================
     15. REUSABLE CHOICE INPUTS
  ======================================================= */

  function renderChoiceInputs(
    wrapper,
    option,
    inputType,
    displayStyle
  ) {
    const container = document.createElement("div");

    container.className = "product-option-choices";

    if (displayStyle === "buttons") {
      container.classList.add(
        "product-option-buttons"
      );
    }

    option.values.forEach(value => {
      const label = document.createElement("label");

      label.className = "product-option-choice";

      if (displayStyle === "buttons") {
        label.classList.add(
          "product-option-choice-button"
        );
      }

      const input = document.createElement("input");

      input.type = inputType;

      input.name =
        `product-option-${option.id}`;

      input.value = value.id;

      input.dataset.optionId = option.id;

      input.dataset.optionType = option.input_type;

      input.dataset.optionValueId = value.id;

      input.required =
        inputType === "radio" &&
        Boolean(option.is_required);

      const text = document.createElement("span");

      text.textContent =
        value.label || value.value;

      label.appendChild(input);

      label.appendChild(text);

      container.appendChild(label);
    });

    if (!option.values.length) {
      const empty = document.createElement("small");

      empty.className = "product-option-help";

      empty.textContent =
        "No options are currently available.";

      container.appendChild(empty);
    }

    wrapper.appendChild(container);
  }


  /* =======================================================
     16. TEXT OPTIONS
  ======================================================= */

  function renderTextOption(wrapper, option) {
    const input = createOptionInput(
      option,
      "text"
    );

    input.placeholder =
      option.placeholder || "Enter your preference";

    wrapper.appendChild(input);
  }


  /* =======================================================
     17. NUMBER OPTIONS
  ======================================================= */

  function renderNumberOption(wrapper, option) {
    const input = createOptionInput(
      option,
      "number"
    );

    input.placeholder =
      option.placeholder || "Enter a number";

    input.min = "0";

    input.step = "any";

    wrapper.appendChild(input);
  }


  /* =======================================================
     18. COLOUR OPTIONS
  ======================================================= */

  function renderColorOption(wrapper, option) {
    const style = getOptionDisplayStyle(option);

    if (
      style === "swatches" ||
      style === "buttons" ||
      style === "radio"
    ) {
      const container = document.createElement("div");

      container.className = "product-option-choices";

      if (style === "swatches") {
        container.classList.add(
          "product-option-swatches"
        );
      }

      if (style === "buttons") {
        container.classList.add(
          "product-option-buttons"
        );
      }

      option.values.forEach(value => {
        const label = document.createElement("label");

        label.className = "product-option-choice";

        if (style === "swatches") {
          label.classList.add(
            "product-option-swatch"
          );
        }

        const input = document.createElement("input");

        input.type = "radio";

        input.name =
          `product-option-${option.id}`;

        input.value = value.id;

        input.dataset.optionId = option.id;

        input.dataset.optionType = "color";

        input.dataset.optionValueId = value.id;

        input.required = Boolean(option.is_required);

        const text = document.createElement("span");

        text.textContent =
          value.label || value.value;

        if (
          style === "swatches" &&
          window.CSS?.supports(
            "color",
            value.value
          )
        ) {
          text.style.backgroundColor = value.value;

          text.classList.add(
            "product-color-swatch"
          );

          label.title =
            value.label || value.value;
        }

        label.appendChild(input);

        label.appendChild(text);

        container.appendChild(label);
      });

      if (!option.values.length) {
        const empty = document.createElement("small");

        empty.className = "product-option-help";

        empty.textContent =
          "No colours are currently available.";

        container.appendChild(empty);
      }

      wrapper.appendChild(container);

      return;
    }

    renderSingleSelectOption(wrapper, option);
  }


  /* =======================================================
     19. DATE OPTIONS
  ======================================================= */

  function renderDateOption(wrapper, option) {
    const input = createOptionInput(
      option,
      "date"
    );

    input.placeholder =
      option.placeholder || "";

    wrapper.appendChild(input);
  }


  /* =======================================================
     20. CHECKBOX OPTIONS
  ======================================================= */

  function renderCheckboxOption(wrapper, option) {
    if (option.values.length > 0) {
      const style = getOptionDisplayStyle(option);

      renderChoiceInputs(
        wrapper,
        option,
        "checkbox",
        style
      );

      return;
    }

    const label = document.createElement("label");

    label.className = "product-option-choice";

    const input = createOptionInput(
      option,
      "checkbox"
    );

    input.dataset.booleanOption = "true";

    const text = document.createElement("span");

    text.textContent =
      option.placeholder || "Yes, include this option";

    label.appendChild(input);

    label.appendChild(text);

    wrapper.appendChild(label);
  }


  /* =======================================================
     21. COLLECT SELECTED OPTIONS
  ======================================================= */

  function collectSelectedOptions() {
    const selected = [];

    for (const option of productOptions) {
      const wrapper =
        elements.optionsList.querySelector(
          `[data-option-id="${option.id}"]`
        );

      if (!wrapper) continue;

      const minimum =
        getOptionMinimum(option);

      const maximum =
        getOptionMaximum(option);

      const selectedValues = [];

      const optionName = option.name;

      const displayName = getOptionLabel(option);

      const addChoice = value => {
        selectedValues.push({
          option_id: option.id,

          option_value_id: value.id,

          option_name: optionName,

          display_name: displayName,

          value: value.value,

          label: value.label || value.value,

          price_adjustment_type:
            value.price_adjustment_type || "none",

          price_adjustment:
            Number(value.price_adjustment) || 0
        });
      };


      /* SINGLE SELECT */

      if (option.input_type === "single_select") {
        const select = wrapper.querySelector("select");

        const selectedInput = wrapper.querySelector(
          'input[type="radio"]:checked'
        );

        const valueId =
          select?.value || selectedInput?.value;

        if (valueId) {
          const found = option.values.find(
            item => item.id === valueId
          );

          if (found) addChoice(found);
        }
      }


      /* MULTI SELECT */

      else if (option.input_type === "multi_select") {
        const inputs = wrapper.querySelectorAll(
          'input[type="checkbox"]:checked'
        );

        inputs.forEach(input => {
          const found = option.values.find(
            item => item.id === input.value
          );

          if (found) addChoice(found);
        });
      }


      /* COLOUR */

      else if (option.input_type === "color") {
        const select = wrapper.querySelector("select");

        const selectedRadio = wrapper.querySelector(
          'input[type="radio"]:checked'
        );

        const valueId =
          select?.value || selectedRadio?.value;

        if (valueId) {
          const found = option.values.find(
            item => item.id === valueId
          );

          if (found) addChoice(found);
        }
      }


      /* CHECKBOX */

      else if (option.input_type === "checkbox") {
        if (option.values.length > 0) {
          const inputs = wrapper.querySelectorAll(
            'input[type="checkbox"]:checked'
          );

          inputs.forEach(input => {
            const found = option.values.find(
              item => item.id === input.value
            );

            if (found) addChoice(found);
          });

        } else {
          const input = wrapper.querySelector(
            'input[data-boolean-option="true"]'
          );

          if (input?.checked) {
            selectedValues.push({
              option_id: option.id,

              option_value_id: null,

              option_name: optionName,

              display_name: displayName,

              value: true,

              label: "Yes",

              price_adjustment_type: "none",

              price_adjustment: 0
            });
          }
        }
      }


      /* TEXT, NUMBER AND DATE */

      else {
        const input = wrapper.querySelector(
          ".product-option-input"
        );

        const rawValue = input?.value?.trim() || "";

        if (rawValue !== "") {
          let value = rawValue;

          if (option.input_type === "number") {
            value = Number(rawValue);

            if (!Number.isFinite(value)) {
              throw new Error(
                `Please enter a valid number for ${displayName}.`
              );
            }

            if (value < 0) {
              throw new Error(
                `${displayName} cannot be negative.`
              );
            }
          }

          selectedValues.push({
            option_id: option.id,

            option_value_id: null,

            option_name: optionName,

            display_name: displayName,

            value,

            label: String(value),

            price_adjustment_type: "none",

            price_adjustment: 0
          });
        }
      }


      /* VALIDATION */

      if (selectedValues.length < minimum) {
        throw new Error(
          `Please complete the ${displayName} selection.`
        );
      }

      if (selectedValues.length > maximum) {
        throw new Error(
          `You can select a maximum of ${maximum} option(s) for ${displayName}.`
        );
      }

      selected.push(...selectedValues);
    }

    return selected;
  }


  /* =======================================================
     22. QUANTITY CONTROLS
  ======================================================= */

  function configureQuantity() {
    const product = currentProduct;

    minimumQuantity = Math.max(
      1,
      Number(product.minimum_order_quantity) || 1
    );

    maximumQuantity =
      product.maximum_order_quantity === null ||
      product.maximum_order_quantity === undefined
        ? Infinity
        : Number(product.maximum_order_quantity);

    if (
      !Number.isFinite(maximumQuantity) ||
      maximumQuantity < minimumQuantity
    ) {
      maximumQuantity = Infinity;
    }

    if (
      product.availability === "in_stock" &&
      product.stock_quantity !== null &&
      product.stock_quantity !== undefined
    ) {
      const stock = Number(product.stock_quantity);

      if (Number.isFinite(stock)) {
        maximumQuantity = Math.min(
          maximumQuantity,
          Math.max(0, Math.floor(stock))
        );
      }
    }

    currentQuantity = minimumQuantity;

    updateQuantityDisplay();

    updateOrderButtonAvailability();
  }


  function updateQuantityDisplay() {
    if (elements.quantity) {
      elements.quantity.value = currentQuantity;
    }

    if (elements.decreaseQuantity) {
      elements.decreaseQuantity.disabled =
        currentQuantity <= minimumQuantity;
    }

    if (elements.increaseQuantity) {
      elements.increaseQuantity.disabled =
        currentQuantity >= maximumQuantity;
    }
  }


  function changeQuantity(amount) {
    const nextQuantity = currentQuantity + amount;

    if (nextQuantity < minimumQuantity) return;

    if (nextQuantity > maximumQuantity) return;

    currentQuantity = nextQuantity;

    updateQuantityDisplay();
  }


  function isProductOrderable() {
    if (!currentProduct) return false;

    if (
      currentProduct.availability === "out_of_stock"
    ) {
      return false;
    }

    if (
      currentProduct.availability === "in_stock" &&
      currentProduct.stock_quantity !== null &&
      currentProduct.stock_quantity !== undefined
    ) {
      const stock = Number(currentProduct.stock_quantity);

      if (
        !Number.isFinite(stock) ||
        stock < minimumQuantity
      ) {
        return false;
      }
    }

    if (maximumQuantity < minimumQuantity) {
      return false;
    }

    return true;
  }


  function updateOrderButtonAvailability() {
    if (!elements.addToCartButton) return;

    elements.addToCartButton.disabled =
      !isProductOrderable();
  }


  function bindQuantityControls() {
    elements.decreaseQuantity?.addEventListener(
      "click",
      () => changeQuantity(-1)
    );

    elements.increaseQuantity?.addEventListener(
      "click",
      () => changeQuantity(1)
    );

    elements.quantity?.addEventListener(
      "change",
      () => {
        let value = Number(elements.quantity.value);

        if (!Number.isFinite(value)) {
          value = minimumQuantity;
        }

        value = Math.floor(value);

        currentQuantity = Math.max(
          minimumQuantity,
          Math.min(maximumQuantity, value)
        );

        updateQuantityDisplay();
      }
    );
  }


  /* =======================================================
     23. CUSTOM TEXT & CUSTOMER NOTES
  ======================================================= */

  function configureCustomisationFields() {
    setHidden(
      elements.customTextSection,
      !currentProduct.is_customizable
    );

    setHidden(
      elements.referenceSection,
      !currentProduct.is_customizable
    );
  }


  /* =======================================================
     24. REFERENCE IMAGE PREVIEW
  ======================================================= */

  function createReferenceRemoveButton(preview) {
    if (!elements.referenceSection || !preview) {
      return;
    }

    // Create the button only once.
    if (!referenceRemoveButton) {
      referenceRemoveButton =
        document.createElement("button");

      referenceRemoveButton.type = "button";

      referenceRemoveButton.className =
        "reference-image-remove";

      referenceRemoveButton.textContent =
        "Remove selected image";

      referenceRemoveButton.setAttribute(
        "aria-label",
        "Remove the selected reference image"
      );

      referenceRemoveButton.hidden = true;

      // Keep the button visible and consistent even
      // if no additional CSS has been added.
      referenceRemoveButton.style.display = "inline-block";

      referenceRemoveButton.style.marginTop = "12px";

      referenceRemoveButton.style.padding =
        "9px 16px";

      referenceRemoveButton.style.border =
        "1px solid var(--border, #D8C4CC)";

      referenceRemoveButton.style.borderRadius =
        "8px";

      referenceRemoveButton.style.background =
        "var(--surface-soft, #F8F1F3)";

      referenceRemoveButton.style.color =
        "var(--text, #49343E)";

      referenceRemoveButton.style.fontFamily =
        "inherit";

      referenceRemoveButton.style.fontSize =
        "13px";

      referenceRemoveButton.style.fontWeight =
        "600";

      referenceRemoveButton.style.cursor =
        "pointer";

      referenceRemoveButton.style.transition =
        "background 0.2s ease, color 0.2s ease";

      referenceRemoveButton.addEventListener(
        "click",
        () => {
          // Discard the selected file.
          selectedReferenceFile = null;

          // Clear the actual file input.
          if (elements.referenceImage) {
            elements.referenceImage.value = "";
          }

          // Remove the temporary preview.
          clearReferencePreview();

          // Clear previous upload or validation messages.
          clearMessage();
        }
      );
    }

    // Always place the button immediately after the preview.
    preview.insertAdjacentElement(
      "afterend",
      referenceRemoveButton
    );

    referenceRemoveButton.hidden = false;
  }


  function clearReferencePreview() {
    if (referencePreviewUrl) {
      URL.revokeObjectURL(referencePreviewUrl);

      referencePreviewUrl = null;
    }

    const preview = document.getElementById(
      "referenceImagePreview"
    );

    if (preview) {
      preview.removeAttribute("src");

      preview.hidden = true;
    }

    if (referenceRemoveButton) {
      referenceRemoveButton.hidden = true;
    }
  }


  function handleReferenceImageSelection() {
    const file =
      elements.referenceImage?.files?.[0];

    selectedReferenceFile = null;

    clearReferencePreview();

    if (!file) return;

    if (!ALLOWED_REFERENCE_TYPES.includes(file.type)) {
      elements.referenceImage.value = "";

      showMessage(
        "Please select a JPEG, PNG or WebP image.",
        "error"
      );

      return;
    }

    if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
      elements.referenceImage.value = "";

      showMessage(
        "The reference image must not exceed 15 MB.",
        "error"
      );

      return;
    }

    selectedReferenceFile = file;

    referencePreviewUrl = URL.createObjectURL(file);

    let preview = document.getElementById(
      "referenceImagePreview"
    );

    if (!preview) {
      preview = document.createElement("img");

      preview.id = "referenceImagePreview";

      preview.className = "reference-image-preview";

      preview.alt = "Selected reference image preview";

      elements.referenceSection?.appendChild(preview);
    }

    preview.src = referencePreviewUrl;

    preview.hidden = false;

    // Show the remove button after a valid image is selected.
    createReferenceRemoveButton(preview);

    clearMessage();
  }


  /* =======================================================
     25. UPLOAD REFERENCE IMAGE
  ======================================================= */

  async function uploadReferenceImage() {
    if (!selectedReferenceFile || !currentUser) {
      return null;
    }

    const file = selectedReferenceFile;

    const extensionMap = {
      "image/jpeg": "jpg",

      "image/png": "png",

      "image/webp": "webp"
    };

    const extension = extensionMap[file.type];

    if (!extension) {
      throw new Error(
        "Unsupported reference image format."
      );
    }

    const uniqueName =
      `${crypto.randomUUID()}.${extension}`;

    const storagePath =
      `${currentUser.id}/${currentProduct.id}/${uniqueName}`;

    const optimizedFile = await window.HafhassMedia.compress(file, "reference");

    const { error } = await supabase.storage
      .from(REFERENCE_IMAGE_BUCKET)
      .upload(storagePath, optimizedFile, {
        cacheControl: window.HafhassMedia.cacheControl,

        upsert: false,

        contentType: file.type
      });

    if (error) throw error;

    referenceUploadedPath = storagePath;

    return storagePath;
  }


  async function removeUploadedReferenceImage() {
    if (!referenceUploadedPath) return;

    const path = referenceUploadedPath;

    const { error } = await supabase.storage
      .from(REFERENCE_IMAGE_BUCKET)
      .remove([path]);

    if (error) {
      console.warn(
        "HAFHASS Product: Could not remove unused reference image.",
        getErrorDetails(error)
      );

    } else {
      referenceUploadedPath = null;
    }
  }


  /* =======================================================
     26. CART HELPERS
  ======================================================= */

  async function getOrCreateActiveCart() {
    const { data: existingCart, error } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (existingCart) {
      return existingCart;
    }

    const { data: newCart, error: createError } =
      await supabase
        .from("carts")
        .insert({
          user_id: currentUser.id,

          status: "active"
        })
        .select("id")
        .single();

    if (createError) throw createError;

    return newCart;
  }


  function validateProductAvailability() {
    if (
      currentProduct.availability === "out_of_stock"
    ) {
      throw new Error(
        "This product is currently out of stock."
      );
    }

    if (
      currentProduct.availability === "in_stock" &&
      currentProduct.stock_quantity !== null &&
      currentProduct.stock_quantity !== undefined &&
      Number(currentProduct.stock_quantity) <= 0
    ) {
      throw new Error(
        "This product is currently unavailable."
      );
    }

    if (
      currentProduct.availability === "in_stock" &&
      currentProduct.stock_quantity !== null &&
      currentProduct.stock_quantity !== undefined &&
      Number(currentProduct.stock_quantity) < minimumQuantity
    ) {
      throw new Error(
        `The available stock is below the minimum order quantity of ${minimumQuantity}.`
      );
    }

    if (
      !Number.isInteger(currentQuantity) ||
      currentQuantity < minimumQuantity
    ) {
      throw new Error(
        `The minimum order quantity is ${minimumQuantity}.`
      );
    }

    if (currentQuantity > maximumQuantity) {
      throw new Error(
        "The selected quantity exceeds the available limit."
      );
    }
  }


  /* =======================================================
     27. ADD TO CART
  ======================================================= */
  
  function setAddToCartButtonLabel(label) {
  const button = elements.addToCartButton;

  if (!button) return;

  const labelElement = button.querySelector(".button-label");

  if (labelElement) {
    labelElement.textContent = label;
  } else {
    button.textContent = label;
  }
}

  async function addToCart() {
    if (isAddingToCart) return;

    clearMessage();

    isAddingToCart = true;

    const button = elements.addToCartButton;

    if (button) {
      button.disabled = true;

      setAddToCartButtonLabel("Adding to Cart...");
    }

    try {
      const user = await getCurrentCustomer();

      if (!user) {
        showMessage(
          "Please sign in before adding products to your cart.",
          "error"
        );

        redirectToLogin();

        return;
      }

      validateProductAvailability();

      const selectedOptions =
        collectSelectedOptions();

      const cart = await getOrCreateActiveCart();

      let referenceImagePath = null;

      if (
        currentProduct.is_customizable &&
        selectedReferenceFile
      ) {
        if (button) {
          setAddToCartButtonLabel("Uploading Reference Image...");
        }

        referenceImagePath =
          await uploadReferenceImage();
      }

      if (button) {
        setAddToCartButtonLabel("Adding to Cart...");
      }

      const customText =
        currentProduct.is_customizable
          ? elements.customText?.value.trim() || null
          : null;

      const customerNotes =
        elements.customerNotes?.value.trim() || null;

      const { data, error } = await supabase
        .from("cart_items")
        .insert({
          cart_id: cart.id,

          product_id: currentProduct.id,

          quantity: currentQuantity,

          selected_options: selectedOptions,

          custom_text: customText,

          customer_notes: customerNotes,

          reference_image_url: referenceImagePath
        })
        .select("id")
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error(
          "The product could not be added to your cart."
        );
      }

      // The uploaded image now belongs to the cart item.
      // Do not remove it during cleanup.
      referenceUploadedPath = null;

      showMessage(
        "Product successfully added to your cart!",
        "success"
      );

      window.dispatchEvent(
        new CustomEvent("hafhass:cart-updated")
      );

      if (elements.customText) {
        elements.customText.value = "";
      }

      if (elements.customerNotes) {
        elements.customerNotes.value = "";
      }

      if (elements.referenceImage) {
        elements.referenceImage.value = "";
      }

      selectedReferenceFile = null;

      clearReferencePreview();

      setTimeout(() => {
        if (elements.message?.hidden) return;

        clearMessage();
      }, 5000);

    } catch (error) {
      await removeUploadedReferenceImage();

      console.error(
        "HAFHASS Product: Add to cart failed.",
        getErrorDetails(error)
      );

      showMessage(
        error?.message ||
          "We could not add this product to your cart. Please try again.",
        "error"
      );

    } finally {
      isAddingToCart = false;

      if (button) {
        setAddToCartButtonLabel("Add to Cart");

        updateOrderButtonAvailability();
      }
    }
  }


  /* =======================================================
     28. FAVOURITES
  ======================================================= */

  async function checkFavouriteStatus() {
    currentFavouriteId = null;

    if (!currentUser) {
      updateFavouriteButton(false);

      return;
    }

    const { data, error } = await supabase
      .from("favourites")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("product_id", currentProduct.id)
      .maybeSingle();

    if (error) {
      console.warn(
        "HAFHASS Product: Could not check favourite status.",
        getErrorDetails(error)
      );

      currentFavouriteId = null;

      updateFavouriteButton(false);

      return;
    }

    currentFavouriteId = data?.id || null;

    updateFavouriteButton(Boolean(data));
  }


  function updateFavouriteButton(isFavourite) {
  if (!elements.favouriteButton) return;

  elements.favouriteButton.classList.toggle(
    "active",
    isFavourite
  );

  elements.favouriteButton.setAttribute(
    "aria-pressed",
    String(isFavourite)
  );

  elements.favouriteButton.setAttribute(
    "aria-label",
    isFavourite
      ? "Remove from favourites"
      : "Add to favourites"
  );

  const icon = elements.favouriteButton.querySelector("i");

  if (icon) {
    icon.className = isFavourite
      ? "fa-solid fa-heart"
      : "fa-regular fa-heart";
  }

  const text =
    elements.favouriteButton.querySelector(
      ".favourite-button-text"
    );

  if (text) {
    text.textContent = isFavourite
      ? "Saved to Favourites"
      : "Add to Favourites";
  }
}


  async function toggleFavourite() {
    if (isFavouriteActionRunning) return;

    const user = await getCurrentCustomer();

    if (!user) {
      showMessage(
        "Please sign in to save products to your favourites.",
        "error"
      );

      redirectToLogin();

      return;
    }

    isFavouriteActionRunning = true;

    if (elements.favouriteButton) {
      elements.favouriteButton.disabled = true;
    }

    try {
      if (currentFavouriteId) {
        const { error } = await supabase
          .from("favourites")
          .delete()
          .eq("id", currentFavouriteId)
          .eq("user_id", user.id);

        if (error) throw error;

        currentFavouriteId = null;

        updateFavouriteButton(false);

        showMessage(
          "Product removed from your favourites.",
          "success"
        );

      } else {
        const { data: existing, error: checkError } =
          await supabase
            .from("favourites")
            .select("id")
            .eq("user_id", user.id)
            .eq("product_id", currentProduct.id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          currentFavouriteId = existing.id;

        } else {
          const { data, error } = await supabase
            .from("favourites")
            .insert({
              user_id: user.id,

              product_id: currentProduct.id
            })
            .select("id")
            .single();

          if (error) throw error;

          currentFavouriteId = data.id;
        }

        updateFavouriteButton(true);

        showMessage(
          "Product saved to your favourites!",
          "success"
        );
      }

    } catch (error) {
      console.error(
        "HAFHASS Product: Favourite action failed.",
        getErrorDetails(error)
      );

      showMessage(
        "We could not update your favourites. Please try again.",
        "error"
      );

    } finally {
      isFavouriteActionRunning = false;

      if (elements.favouriteButton) {
        elements.favouriteButton.disabled = false;
      }
    }
  }


  /* =======================================================
     29. RELATED PRODUCTS
  ======================================================= */

  async function fetchRelatedProducts() {
    if (
      !currentProduct.category_id ||
      !elements.relatedSection ||
      !elements.relatedGrid
    ) {
      setHidden(elements.relatedSection, true);

      return;
    }

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        price,
        compare_at_price,
        currency,
        pricing_type,
        availability,
        is_featured
      `)
      .eq("category_id", currentProduct.category_id)
      .eq("status", "active")
      .neq("id", currentProduct.id)
      .order("is_featured", {
        ascending: false
      })
      .order("display_order", {
        ascending: true
      })
      .limit(4);

    if (error) throw error;

    const products = data || [];

    if (!products.length) {
      setHidden(elements.relatedSection, true);

      return;
    }

    const productIds = products.map(
      product => product.id
    );

    const { data: images, error: imageError } =
      await supabase
        .from("product_images")
        .select(`
          product_id,
          image_url,
          alt_text,
          is_primary,
          display_order
        `)
        .in("product_id", productIds)
        .order("is_primary", {
          ascending: false
        })
        .order("display_order", {
          ascending: true
        });

    if (imageError) throw imageError;

    renderRelatedProducts(
      products,
      images || []
    );
  }


  function renderRelatedProducts(products, images) {
    if (!elements.relatedGrid) return;

    elements.relatedGrid.innerHTML = "";

    products.forEach(product => {
      const image = images.find(
        item => item.product_id === product.id
      );

      const card = document.createElement("article");

      card.className = "related-product-card";

      const link = document.createElement("a");

      link.className = "related-product-link";

      link.href =
        `product.html?slug=${encodeURIComponent(product.slug)}`;

      const imageContainer =
        document.createElement("div");

      imageContainer.className =
        "related-product-image";

      if (image?.image_url) {
        const img = document.createElement("img");

        img.src = image.image_url;

        img.alt =
          image.alt_text || product.name;

        img.loading = "lazy";

        imageContainer.appendChild(img);

      } else {
        const placeholder =
          document.createElement("div");

        placeholder.className =
          "related-product-placeholder";

        const icon = document.createElement("i");

icon.className = "fa-regular fa-image";

placeholder.appendChild(icon);

        imageContainer.appendChild(placeholder);
      }

      const info = document.createElement("div");

      info.className = "related-product-info";

      const name = document.createElement("h3");

      name.textContent = product.name;

      const price = document.createElement("p");

      price.textContent = getProductPrice(product);

      info.appendChild(name);

      info.appendChild(price);

      link.appendChild(imageContainer);

      link.appendChild(info);

      card.appendChild(link);

      elements.relatedGrid.appendChild(card);
    });

    setHidden(elements.relatedSection, false);
  }


  /* =======================================================
     30. EVENT LISTENERS
  ======================================================= */

  function bindEvents() {
    elements.retryButton?.addEventListener(
      "click",
      initialize
    );

    elements.addToCartButton?.addEventListener(
      "click",
      addToCart
    );

    elements.favouriteButton?.addEventListener(
      "click",
      toggleFavourite
    );

    elements.referenceImage?.addEventListener(
      "change",
      handleReferenceImageSelection
    );

    bindQuantityControls();
  }


  /* =======================================================
     31. PAGE INITIALIZATION
  ======================================================= */

  async function initialize() {
    showLoading();

    clearMessage();

    currentProduct = null;

    currentImages = [];

    productOptions = [];

    selectedReferenceFile = null;

    referenceUploadedPath = null;

    currentFavouriteId = null;

    currentQuantity = 1;

    minimumQuantity = 1;

    maximumQuantity = Infinity;

    clearReferencePreview();

    if (elements.referenceImage) {
      elements.referenceImage.value = "";
    }

    if (elements.customText) {
      elements.customText.value = "";
    }

    if (elements.customerNotes) {
      elements.customerNotes.value = "";
    }

    if (elements.optionsList) {
      elements.optionsList.innerHTML = "";
    }

    if (elements.addToCartButton) {
      elements.addToCartButton.disabled = false;
    }

    try {
      await getCurrentCustomer();

      await fetchProduct();

      if (!currentProduct) return;

      renderProductInformation();

      renderProductOptions();

      configureQuantity();

      configureCustomisationFields();

    } catch (error) {
      console.error(
        "HAFHASS Product: Initialization failed.",
        getErrorDetails(error)
      );

      showError(
        "We couldn't load this product right now. Please check your connection and try again."
      );
    }
  }


  /* =======================================================
     32. START
  ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      bindEvents();

      initialize();
    }
  );


  /* =======================================================
     33. CLEANUP
  ======================================================= */

  window.addEventListener(
    "beforeunload",
    clearReferencePreview
  );

})();
