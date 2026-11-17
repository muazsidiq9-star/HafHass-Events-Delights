/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN PRODUCTS MANAGEMENT
========================================================= */

(() => {
  "use strict";


  /* =======================================================
     1. CONFIGURATION
  ======================================================= */

  const supabase = window.hafhassSupabase;

  const PAGE_SIZE = 10;
  const STORAGE_BUCKET = "product-images";
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  let allProducts = [];
  let filteredProducts = [];
  let categories = [];

  let currentPage = 1;

  let selectedImages = [];
  let originalImages = [];

  let primaryImageIndex = 0;
  let savingProduct = false;
  let pendingReplacementIndex = null;

  // Separate picker for replacing an existing image in its exact slot.
  const replacementInput = document.createElement("input");
  replacementInput.type = "file";
  replacementInput.accept = "image/jpeg,image/png,image/webp";
  replacementInput.hidden = true;
  document.body.appendChild(replacementInput);


  /* =======================================================
     2. DOM ELEMENTS
  ======================================================= */

  const $ = id => document.getElementById(id);

  const elements = {

    total: $("productTotalCount"),
    activeCount: $("productActiveCount"),
    outOfStock: $("productOutOfStockCount"),
    inactive: $("productInactiveCount"),

    resultCount: $("productResultCount"),

    search: $("productSearch"),
    categoryFilter: $("productCategoryFilter"),
    statusFilter: $("productStatusFilter"),
    availabilityFilter: $("productAvailabilityFilter"),

    loading: $("productsLoading"),
    error: $("productsError"),
    errorMessage: $("productsErrorMessage"),
    empty: $("productsEmpty"),
    noResults: $("productsNoResults"),

    tableContainer: $("productsTableContainer"),
    tableBody: $("productsTableBody"),

    paginationInfo: $("productsPaginationInfo"),
    pageNumber: $("productsPageNumber"),
    previousButton: $("previousProductsPage"),
    nextButton: $("nextProductsPage"),

    retryButton: $("retryProductsButton"),
    clearFiltersButton: $("clearProductFiltersButton"),

    addButton: $("addProductButton"),
    emptyAddButton: $("emptyAddProductButton"),

    modal: $("productModalOverlay"),
    modalTitle: $("productModalTitle"),
    closeModal: $("closeProductModal"),

    form: $("productForm"),
    formMessage: $("productFormMessage"),
    saveButton: $("saveProductButton"),
    cancelButton: $("cancelProductForm"),

    editingId: $("editingProductId"),

    name: $("productName"),
    sku: $("productSKU"),
    slug: $("productSlug"),
    category: $("productCategory"),

    shortDescription: $("productShortDescription"),
    description: $("productDescription"),

    pricingType: $("productPricingType"),
    price: $("productPrice"),
    comparePrice: $("productComparePrice"),
    priceGroup: $("productPriceGroup"),
    priceRequired: $("productPriceRequired"),
    currency: $("productCurrency"),

    availability: $("productAvailability"),
    stock: $("productStock"),
    minimumQuantity: $("productMinimumQuantity"),
    maximumQuantity: $("productMaximumQuantity"),
    preparationDays: $("productPreparationDays"),
    displayOrder: $("productDisplayOrder"),

    imageInput: $("productImages"),
    imagePreview: $("productImagePreview"),

    activeCheckbox: $("productActive"),
    featured: $("productFeatured"),
    customizable: $("productCustomizable")

  };


  /* =======================================================
     3. GENERAL HELPERS
  ======================================================= */

  function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[character]);

  }


  function formatCurrency(amount, currency = "NGN") {

    const value = Number(amount) || 0;

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: currency || "NGN",
        maximumFractionDigits: 2
      }).format(value);

    } catch (error) {

      return `${currency} ${value.toLocaleString()}`;

    }

  }


  function formatLabel(value) {

    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());

  }


  function showState(state) {

    elements.loading.hidden = state !== "loading";
    elements.error.hidden = state !== "error";
    elements.empty.hidden = state !== "empty";
    elements.noResults.hidden = state !== "no-results";
    elements.tableContainer.hidden = state !== "table";

  }


  function createSlug(value) {

    return String(value || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  }


  function showFormMessage(message, type = "error") {

    elements.formMessage.textContent = message;

    elements.formMessage.className =
      `admin-product-form-message ${type}`;

    elements.formMessage.hidden = false;

    elements.formMessage.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  }


  function clearFormMessage() {

    elements.formMessage.textContent = "";
    elements.formMessage.hidden = true;
    elements.formMessage.className = "admin-product-form-message";

  }


  function setSaveButton(label, icon = "fa-floppy-disk") {

    elements.saveButton.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      ${escapeHTML(label)}
    `;

  }


  /* =======================================================
     4. PRODUCT IMAGE HELPERS
  ======================================================= */

  function getProductImage(product) {

    if (!product.primaryImage) {

      return `
        <div class="admin-product-image">
          <i class="fa-solid fa-image"></i>
        </div>
      `;

    }

    return `
      <div class="admin-product-image">

        <img
          src="${escapeHTML(product.primaryImage)}"
          alt="${escapeHTML(product.name)}"
          loading="lazy"
        >

      </div>
    `;

  }


  function revokeImagePreviews() {

    selectedImages.forEach(item => {

      if (
        item.previewUrl &&
        item.previewUrl.startsWith("blob:")
      ) {

        URL.revokeObjectURL(item.previewUrl);

      }

    });

  }


  function renderImagePreviews() {

    elements.imagePreview.innerHTML = selectedImages.map((item, index) => {

      const isPrimary = index === primaryImageIndex;

      return `
        <div class="admin-image-preview-item ${isPrimary ? "primary" : ""}">

          <img
            src="${escapeHTML(item.previewUrl)}"
            alt="Product image ${index + 1}"
          >

          <div class="admin-image-preview-actions">

            <button
              type="button"
              data-image-action="primary"
              data-image-index="${index}"
              title="Set as primary image"
              aria-label="Set image ${index + 1} as primary"
            >
              <i class="fa-solid fa-star"></i>
            </button>

            ${item.existing ? `
              <button
                type="button"
                data-image-action="replace"
                data-image-index="${index}"
                title="Replace this image everywhere it is used"
                aria-label="Replace image ${index + 1}"
              >
                <i class="fa-solid fa-arrows-rotate"></i>
              </button>
            ` : ""}

            <button
              type="button"
              data-image-action="remove"
              data-image-index="${index}"
              title="Remove image everywhere it is used"
              aria-label="Remove image ${index + 1}"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>

          </div>

          ${isPrimary ? `
            <span class="admin-image-primary-badge">
              PRIMARY IMAGE
            </span>
          ` : ""}

        </div>
      `;

    }).join("");

  }


  function resetImages() {

    revokeImagePreviews();

    selectedImages = [];
    originalImages = [];

    primaryImageIndex = 0;

    elements.imageInput.value = "";
    elements.imagePreview.innerHTML = "";

  }


  /* =======================================================
     5. LOAD PRODUCT CATEGORIES
  ======================================================= */

  async function loadCategories() {

    try {

      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      categories = data || [];

      const options = categories.map(category => `
        <option value="${escapeHTML(category.id)}">
          ${escapeHTML(category.name)}
        </option>
      `).join("");

      elements.categoryFilter.innerHTML = `
        <option value="">All Categories</option>
        ${options}
      `;

      elements.category.innerHTML = `
        <option value="">Select a category</option>
        ${options}
      `;

    } catch (error) {

      console.warn("Category loading:", error.message);

    }

  }


  /* =======================================================
     6. LOAD PRODUCT IMAGES
  ======================================================= */

  async function loadProductImages(products) {

    if (!products.length) return;

    const productIds = products.map(product => product.id);

    const { data, error } = await supabase
      .from("product_images")
      .select("product_id, image_url, display_order, is_primary")
      .in("product_id", productIds)
      .order("display_order", { ascending: true });

    if (error) {

      console.warn("Product images:", error.message);
      return;

    }

    const imageMap = {};

    (data || []).forEach(image => {

      if (!imageMap[image.product_id]) {
        imageMap[image.product_id] = image.image_url;
      }

      if (image.is_primary) {
        imageMap[image.product_id] = image.image_url;
      }

    });

    products.forEach(product => {

      product.primaryImage =
        imageMap[product.id] || null;

    });

  }


  /* =======================================================
     7. LOAD PRODUCTS
  ======================================================= */

  async function loadProducts() {

    showState("loading");

    try {

      if (!supabase) {
        throw new Error("Supabase connection is unavailable.");
      }

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          category_id,
          sku,
          name,
          slug,
          short_description,
          description,
          pricing_type,
          price,
          compare_at_price,
          currency,
          availability,
          stock_quantity,
          minimum_order_quantity,
          maximum_order_quantity,
          preparation_time_days,
          display_order,
          is_featured,
          is_customizable,
          status,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      allProducts = data || [];

      await loadProductImages(allProducts);

      updateStatistics();

      applyFilters();

    } catch (error) {

      console.error("Products loading:", error);

      elements.errorMessage.textContent =
        error.message || "Unable to load products.";

      showState("error");

    }

  }


  /* =======================================================
     8. UPDATE STATISTICS
  ======================================================= */

  function updateStatistics() {

    const total = allProducts.length;

    const activeCount = allProducts.filter(product =>
      product.status === "active"
    ).length;

    const inactiveCount = allProducts.filter(product =>
      product.status !== "active"
    ).length;

    const outOfStockCount = allProducts.filter(product =>
      product.availability === "out_of_stock"
    ).length;

    elements.total.textContent = total;
    elements.activeCount.textContent = activeCount;
    elements.inactive.textContent = inactiveCount;
    elements.outOfStock.textContent = outOfStockCount;

  }


  /* =======================================================
     9. FILTER PRODUCTS
  ======================================================= */

  function applyFilters() {

    const searchTerm = elements.search.value
      .trim()
      .toLowerCase();

    const categoryId = elements.categoryFilter.value;
    const status = elements.statusFilter.value;
    const availability = elements.availabilityFilter.value;

    filteredProducts = allProducts.filter(product => {

      const matchesSearch =
        !searchTerm ||
        String(product.name || "").toLowerCase().includes(searchTerm) ||
        String(product.sku || "").toLowerCase().includes(searchTerm) ||
        String(product.slug || "").toLowerCase().includes(searchTerm);

      const matchesCategory =
        !categoryId ||
        product.category_id === categoryId;

      const matchesStatus =
        !status ||
        (status === "inactive"
          ? product.status !== "active"
          : product.status === status);

      const matchesAvailability =
        !availability ||
        product.availability === availability;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus &&
        matchesAvailability
      );

    });

    currentPage = 1;

    renderProducts();

  }


  /* =======================================================
     10. PRODUCT BADGES
  ======================================================= */

  function getStatusBadge(status) {

    const value = String(status || "").toLowerCase();

    const className = value === "active"
      ? "active"
      : ["draft", "archived", "inactive"].includes(value)
        ? "inactive"
        : "unknown";

    return `
      <span class="admin-product-badge ${className}">
        ${escapeHTML(formatLabel(value || "Unknown"))}
      </span>
    `;

  }


  function getAvailabilityBadge(availability) {

    const value = String(availability || "").toLowerCase();

    const allowed = [
      "in_stock",
      "out_of_stock",
      "pre_order",
      "made_to_order"
    ];

    const className = allowed.includes(value)
      ? value
      : "unknown";

    return `
      <span class="admin-product-badge ${className}">
        ${escapeHTML(formatLabel(value || "Unknown"))}
      </span>
    `;

  }


  /* =======================================================
     11. RENDER PRODUCTS
  ======================================================= */

  function renderProducts() {

    const total = filteredProducts.length;

    elements.resultCount.textContent =
      `${total} ${total === 1 ? "product" : "products"}`;

    if (!allProducts.length) {

      showState("empty");
      return;

    }

    if (!total) {

      showState("no-results");
      return;

    }

    showState("table");

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const endIndex = Math.min(
      startIndex + PAGE_SIZE,
      total
    );

    const pageProducts = filteredProducts.slice(
      startIndex,
      endIndex
    );

    elements.tableBody.innerHTML = pageProducts.map(product => {

      const category = categories.find(item =>
        item.id === product.category_id
      );

      const categoryName = category
        ? category.name
        : "Uncategorized";

      const price = formatCurrency(
        product.price,
        product.currency
      );

      const stock =
        product.stock_quantity === null ||
        product.stock_quantity === undefined
          ? "Not tracked"
          : Number(product.stock_quantity).toLocaleString();

      return `
        <tr>

          <td>

            <div class="admin-product-cell">

              ${getProductImage(product)}

              <div class="admin-product-info">

                <strong title="${escapeHTML(product.name)}">
                  ${escapeHTML(product.name)}
                </strong>

                <small>
                  SKU: ${escapeHTML(product.sku || "N/A")}
                </small>

              </div>

            </div>

          </td>

          <td>${escapeHTML(categoryName)}</td>

          <td>
            <span class="admin-product-price">
              ${escapeHTML(price)}
            </span>
          </td>

          <td>
            <span class="admin-product-stock">
              ${escapeHTML(stock)}
            </span>
          </td>

          <td>
            ${getAvailabilityBadge(product.availability)}
          </td>

          <td>
            ${getStatusBadge(product.status)}
          </td>

          <td>

            <div class="admin-product-actions">

              <button
                type="button"
                class="admin-product-action"
                data-product-action="view"
                data-product-id="${escapeHTML(product.id)}"
                title="View product"
                aria-label="View product"
              >
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>

              <button
                type="button"
                class="admin-product-action"
                data-product-action="edit"
                data-product-id="${escapeHTML(product.id)}"
                title="Edit product"
                aria-label="Edit product"
              >
                <i class="fa-solid fa-pen-to-square"></i>
              </button>

            </div>

          </td>

        </tr>
      `;

    }).join("");

    elements.paginationInfo.textContent =
      `Showing ${startIndex + 1}–${endIndex} of ${total} products`;

    elements.pageNumber.textContent =
      `${currentPage} / ${totalPages}`;

    elements.previousButton.disabled =
      currentPage <= 1;

    elements.nextButton.disabled =
      currentPage >= totalPages;

  }


  /* =======================================================
     12. MODAL MANAGEMENT
  ======================================================= */

  function openProductModal() {

    elements.form.reset();

    resetImages();

    clearFormMessage();

    elements.editingId.value = "";

    delete elements.slug.dataset.manuallyEdited;

    elements.modalTitle.textContent = "Add New Product";

    setSaveButton("Save Product");

    elements.modal.hidden = false;

    document.body.style.overflow = "hidden";

    updatePricingFields();

    setTimeout(() => {
      elements.name.focus();
    }, 100);

  }


  function closeProductModal() {

    if (savingProduct) return;

    elements.modal.hidden = true;

    document.body.style.overflow = "";

    elements.form.reset();

    resetImages();

    clearFormMessage();

    elements.editingId.value = "";

    delete elements.slug.dataset.manuallyEdited;

    elements.modalTitle.textContent = "Add New Product";

    setSaveButton("Save Product");

    updatePricingFields();

  }


  /* =======================================================
     13. PRICING FIELD BEHAVIOUR
  ======================================================= */

  function updatePricingFields() {

    const pricingType = elements.pricingType.value;

    const isQuote = pricingType === "quote";

    elements.price.disabled = isQuote;

    elements.price.required = !isQuote;

    elements.priceGroup.style.opacity =
      isQuote ? "0.55" : "1";

    elements.priceRequired.textContent =
      isQuote ? "" : "*";

    if (isQuote) {
      elements.price.value = "";
    }

  }


  /* =======================================================
     14. LOAD PRODUCT IMAGES FOR EDITING
  ======================================================= */

  async function loadProductImagesForEdit(productId) {

    const { data, error } = await supabase
      .from("product_images")
      .select("product_id, image_url, display_order, is_primary")
      .eq("product_id", productId)
      .order("display_order", { ascending: true });

    if (error) {
      throw error;
    }

    originalImages = data || [];

    selectedImages = originalImages.map(image => ({

      file: null,

      previewUrl: image.image_url,

      imageUrl: image.image_url,

      existing: true

    }));

    const primaryIndex = originalImages.findIndex(image =>
      image.is_primary
    );

    primaryImageIndex = primaryIndex >= 0
      ? primaryIndex
      : 0;

    renderImagePreviews();

  }


  /* =======================================================
     15. OPEN PRODUCT FOR EDITING
  ======================================================= */

  async function editProduct(product) {

    if (savingProduct) return;

    openProductModal();

    elements.modalTitle.textContent = "Edit Product";

    setSaveButton("Update Product");

    elements.editingId.value = product.id;

    elements.name.value = product.name || "";

    elements.sku.value = product.sku || "";

    elements.slug.value = product.slug || "";

    elements.slug.dataset.manuallyEdited = "true";

    elements.category.value = product.category_id || "";

    elements.shortDescription.value =
      product.short_description || "";

    elements.description.value =
      product.description || "";

    elements.pricingType.value =
      product.pricing_type || "fixed";

    elements.price.value =
      product.price ?? "";

    elements.comparePrice.value =
      product.compare_at_price ?? "";

    elements.currency.value =
      product.currency || "NGN";

    elements.availability.value =
      product.availability || "in_stock";

    elements.stock.value =
      product.stock_quantity ?? "";

    elements.minimumQuantity.value =
      product.minimum_order_quantity ?? 1;

    elements.maximumQuantity.value =
      product.maximum_order_quantity ?? "";

    elements.preparationDays.value =
      product.preparation_time_days ?? "";

    elements.displayOrder.value =
      product.display_order ?? 0;

    elements.activeCheckbox.checked =
      product.status === "active";

    elements.featured.checked =
      Boolean(product.is_featured);

    elements.customizable.checked =
      Boolean(product.is_customizable);

    updatePricingFields();

    clearFormMessage();

    try {

      await loadProductImagesForEdit(product.id);

    } catch (error) {

      console.error("Loading product images for editing:", error);

      showFormMessage(
        "Product details loaded, but existing images could not be loaded. Please try again."
      );

    }

    setTimeout(() => {
      elements.name.focus();
    }, 100);

  }


  /* =======================================================
     16. IMAGE SELECTION
  ======================================================= */

  elements.imageInput.addEventListener("change", event => {

    const files = Array.from(event.target.files || []);

    for (const file of files) {

      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {

        showFormMessage(
          `${file.name} is not a supported image format.`
        );

        continue;

      }

      if (file.size > MAX_IMAGE_SIZE) {

        showFormMessage(
          `${file.name} exceeds the 10MB image limit.`
        );

        continue;

      }

      if (selectedImages.some(item =>
        item.file &&
        item.file.name === file.name &&
        item.file.size === file.size
      )) {
        continue;
      }

      selectedImages.push({

        file,

        previewUrl: URL.createObjectURL(file),

        imageUrl: null,

        existing: false

      });

    }

    if (selectedImages.length && selectedImages.length === files.length) {
      primaryImageIndex = 0;
    }

    clearFormMessage();

    renderImagePreviews();

    elements.imageInput.value = "";

  });


  // Handle the per-image Replace button without changing the HTML form.
  replacementInput.addEventListener("change", () => {

    const file = replacementInput.files && replacementInput.files[0];
    const index = pendingReplacementIndex;

    replacementInput.value = "";
    pendingReplacementIndex = null;

    if (!file || !Number.isInteger(index) || !selectedImages[index]) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showFormMessage("Please choose a JPEG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      showFormMessage("The selected image exceeds the 10MB limit.");
      return;
    }

    const oldItem = selectedImages[index];

    if (!oldItem.existing || !oldItem.imageUrl) {
      return;
    }

    selectedImages[index] = {
      file,
      previewUrl: URL.createObjectURL(file),
      imageUrl: null,
      existing: false,
      replacesUrl: oldItem.imageUrl
    };

    clearFormMessage();
    renderImagePreviews();

  });


  /* =======================================================
     17. IMAGE PREVIEW ACTIONS
  ======================================================= */

  elements.imagePreview.addEventListener("click", event => {

    const button = event.target.closest("[data-image-action]");

    if (!button) return;

    const action = button.dataset.imageAction;

    const index = Number(button.dataset.imageIndex);

    if (!Number.isInteger(index) || !selectedImages[index]) {
      return;
    }

    if (action === "primary") {

      primaryImageIndex = index;

      renderImagePreviews();

      return;

    }

    if (action === "replace") {

      if (!selectedImages[index].existing) return;

      pendingReplacementIndex = index;
      replacementInput.click();

      return;

    }

    if (action === "remove") {

      const item = selectedImages[index];

      if (item.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }

      selectedImages.splice(index, 1);

      if (!selectedImages.length) {

        primaryImageIndex = 0;

      } else if (index === primaryImageIndex) {

        primaryImageIndex = 0;

      } else if (index < primaryImageIndex) {

        primaryImageIndex--;

      }

      renderImagePreviews();

    }

  });


  /* =======================================================
     18. PRODUCT VALIDATION
  ======================================================= */

  function validateProduct() {

    const name = elements.name.value.trim();

    const slug = createSlug(
      elements.slug.value || name
    );

    const pricingType = elements.pricingType.value;

    const price = elements.price.value;

    const comparePrice = elements.comparePrice.value;

    const stock = elements.stock.value;

    const minimum = elements.minimumQuantity.value;

    const maximum = elements.maximumQuantity.value;

    const preparation = elements.preparationDays.value;

    const displayOrder = elements.displayOrder.value;

    if (!name) {
      throw new Error("Please enter the product name.");
    }

    if (!slug) {
      throw new Error("Please provide a valid product URL slug.");
    }

    if (
      allProducts.some(product =>
        product.slug === slug &&
        product.id !== elements.editingId.value
      )
    ) {
      throw new Error("This product URL slug is already in use.");
    }

    if (pricingType !== "quote") {

      if (price === "" || !Number.isFinite(Number(price)) || Number(price) <= 0) {
        throw new Error("Please enter a valid product price.");
      }

    }

    if (comparePrice !== "" && Number(comparePrice) < 0) {
      throw new Error("Compare-at price cannot be negative.");
    }

    if (
      comparePrice !== "" &&
      pricingType !== "quote" &&
      Number(comparePrice) > 0 &&
      Number(comparePrice) <= Number(price)
    ) {
      throw new Error("Compare-at price must be greater than the selling price.");
    }

    if (stock !== "" && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
      throw new Error("Stock quantity must be a non-negative whole number.");
    }

    if (!Number.isInteger(Number(minimum)) || Number(minimum) < 1) {
      throw new Error("Minimum order quantity must be at least 1.");
    }

    if (
      maximum !== "" &&
      (
        !Number.isInteger(Number(maximum)) ||
        Number(maximum) < Number(minimum)
      )
    ) {
      throw new Error("Maximum quantity cannot be lower than minimum quantity.");
    }

    if (
      preparation !== "" &&
      (!Number.isInteger(Number(preparation)) || Number(preparation) < 0)
    ) {
      throw new Error("Preparation time must be a non-negative whole number.");
    }

    if (
      displayOrder !== "" &&
      (!Number.isInteger(Number(displayOrder)) || Number(displayOrder) < 0)
    ) {
      throw new Error("Display order must be a non-negative whole number.");
    }

    return slug;

  }


  /* =======================================================
     19. BUILD PRODUCT DATA
  ======================================================= */

  function getProductPayload() {

    const slug = validateProduct();

    const pricingType = elements.pricingType.value;

    const stockValue = elements.stock.value;

    const maximumValue = elements.maximumQuantity.value;

    const preparationValue = elements.preparationDays.value;

    const compareValue = elements.comparePrice.value;

    return {

      category_id: elements.category.value || null,

      sku: elements.sku.value.trim() || null,

      name: elements.name.value.trim(),

      slug,

      short_description:
        elements.shortDescription.value.trim() || null,

      description:
        elements.description.value.trim() || null,

      pricing_type: pricingType,

      price: pricingType === "quote"
        ? 0
        : Number(elements.price.value),

      compare_at_price:
        compareValue === ""
          ? null
          : Number(compareValue),

      currency: elements.currency.value,

      availability: elements.availability.value,

      stock_quantity:
        stockValue === ""
          ? null
          : Number(stockValue),

      minimum_order_quantity:
        Number(elements.minimumQuantity.value),

      maximum_order_quantity:
        maximumValue === ""
          ? null
          : Number(maximumValue),

      preparation_time_days:
        preparationValue === ""
          ? null
          : Number(preparationValue),

      display_order:
        Number(elements.displayOrder.value || 0),

      is_featured: elements.featured.checked,

      is_customizable: elements.customizable.checked,

      status: elements.activeCheckbox.checked
        ? "active"
        : "draft"

    };

  }


  /* =======================================================
     20. STORAGE IMAGE HELPERS
  ======================================================= */

  function getStoragePathFromUrl(imageUrl) {

    if (!imageUrl) return null;

    try {

      const url = new URL(imageUrl);
      const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex === -1) return null;

      return decodeURIComponent(
        url.pathname.slice(markerIndex + marker.length)
      );

    } catch (error) {

      return null;

    }

  }


  async function removeStorageFiles(paths) {

    const uniquePaths = [...new Set((paths || []).filter(Boolean))];

    if (!uniquePaths.length) return;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(uniquePaths);

    if (error) {
      console.warn("Product image storage cleanup:", error.message);
    }

  }


  /* =======================================================
     21. UPLOAD NEW PRODUCT IMAGES
  ======================================================= */

  async function uploadProductImages(productId) {

    const newImages = selectedImages.filter(item =>
      !item.existing && item.file
    );

    if (!newImages.length) return;

    const imageRecords = [];
    const uploadedPaths = [];

    try {

      for (const item of newImages) {

        const file = item.file;
        const extension = file.name.split(".").pop().toLowerCase();

        const safeName = file.name
          .replace(/\.[^/.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "product-image";

        const filePath =
          `products/${productId}/${Date.now()}-${uploadedPaths.length}-${safeName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          });

        if (uploadError) throw uploadError;

        uploadedPaths.push(filePath);

        const { data: publicData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);

        imageRecords.push({
          product_id: productId,
          image_url: publicData.publicUrl,
          alt_text: elements.name.value.trim(),
          display_order: selectedImages.indexOf(item),
          is_primary: selectedImages.indexOf(item) === primaryImageIndex
        });

      }

      const { error: insertError } = await supabase
        .from("product_images")
        .insert(imageRecords);

      if (insertError) throw insertError;

    } catch (error) {

      await removeStorageFiles(uploadedPaths);
      throw error;

    }

  }


  /* =======================================================
     22. UPDATE EXISTING PRODUCT IMAGES
  ======================================================= */

  async function updateExistingProductImages(productId) {

    const retainedImages = selectedImages.filter(item =>
      item.existing
    );

    const retainedUrls = retainedImages.map(item => item.imageUrl);

    const replacementItems = selectedImages.filter(item =>
      !item.existing && item.file && item.replacesUrl
    );

    const addedItems = selectedImages.filter(item =>
      !item.existing && item.file && !item.replacesUrl
    );

    const replacementUrls = replacementItems.map(item => item.replacesUrl);

    const removedImages = originalImages.filter(image =>
      !retainedUrls.includes(image.image_url) &&
      !replacementUrls.includes(image.image_url)
    );

    // Upload all new files first. Nothing in the database is changed if an
    // upload fails, and any files uploaded during this attempt are cleaned up.
    const uploaded = [];

    try {

      for (const item of [...replacementItems, ...addedItems]) {

        const file = item.file;
        const extension = file.name.split(".").pop().toLowerCase();

        const safeName = file.name
          .replace(/\.[^/.]+$/, "")
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "product-image";

        const filePath =
          `products/${productId}/${Date.now()}-${uploaded.length}-${safeName}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(filePath);

        uploaded.push({
          item,
          path: filePath,
          url: publicData.publicUrl,
          replacesUrl: item.replacesUrl || null
        });

      }

    } catch (error) {

      await removeStorageFiles(uploaded.map(item => item.path));
      throw error;

    }


    const insertedRecords = [];
    const appliedReplacements = [];
    const storagePathsToDelete = [];

    try {

      // Keep the order and primary-image choice for images that remain.
      for (let index = 0; index < selectedImages.length; index++) {

        const item = selectedImages[index];
        if (!item.existing) continue;

        const { error } = await supabase
          .from("product_images")
          .update({
            display_order: index,
            is_primary: index === primaryImageIndex
          })
          .eq("product_id", productId)
          .eq("image_url", item.imageUrl);

        if (error) throw error;

      }


      // Replace the old URL globally so every product using it
      // now points to the newly uploaded image.
      for (const item of uploaded.filter(entry => entry.replacesUrl)) {

        const { error } = await supabase
          .from("product_images")
          .update({ image_url: item.url })
          .eq("image_url", item.replacesUrl);

        if (error) throw error;

        appliedReplacements.push({
          oldUrl: item.replacesUrl,
          newUrl: item.url
        });

        const oldPath = getStoragePathFromUrl(item.replacesUrl);
        if (oldPath) storagePathsToDelete.push(oldPath);

        // Preserve this product's image order, primary status and alt text.
        const imageIndex = selectedImages.indexOf(item.item);

        const { error: currentProductError } = await supabase
          .from("product_images")
          .update({
            alt_text: elements.name.value.trim(),
            display_order: imageIndex,
            is_primary: imageIndex === primaryImageIndex
          })
          .eq("product_id", productId)
          .eq("image_url", item.url);

        if (currentProductError) throw currentProductError;

      }


      // Additional uploads are attached only to the product being edited.
      const newRecords = uploaded
        .filter(item => !item.replacesUrl)
        .map(item => {
          const index = selectedImages.indexOf(item.item);
          return {
            product_id: productId,
            image_url: item.url,
            alt_text: elements.name.value.trim(),
            display_order: index,
            is_primary: index === primaryImageIndex
          };
        });

      if (newRecords.length) {

        const { error } = await supabase
          .from("product_images")
          .insert(newRecords);

        if (error) throw error;
        insertedRecords.push(...newRecords);

      }


      // Removing an image removes every database reference to that URL,
      // not just the row belonging to the product currently being edited.
      for (const image of removedImages) {

        const { error } = await supabase
          .from("product_images")
          .delete()
          .eq("image_url", image.image_url);

        if (error) throw error;

        const oldPath = getStoragePathFromUrl(image.image_url);
        if (oldPath) storagePathsToDelete.push(oldPath);

      }

      // Only URLs belonging to our own product-images bucket produce a path.
      // External images (for example Unsplash URLs) are never deleted here.
      await removeStorageFiles(storagePathsToDelete);

    } catch (error) {

      // Best-effort rollback for non-destructive work if a later DB operation
      // fails. Old image files are not deleted before the database work succeeds.
      for (const replacement of appliedReplacements.reverse()) {

        const { error: rollbackError } = await supabase
          .from("product_images")
          .update({ image_url: replacement.oldUrl })
          .eq("image_url", replacement.newUrl);

        if (rollbackError) {
          console.error("Image replacement rollback failed:", rollbackError);
        }

      }

      if (insertedRecords.length) {

        const insertedUrls = insertedRecords.map(item => item.image_url);

        const { error: rollbackError } = await supabase
          .from("product_images")
          .delete()
          .in("image_url", insertedUrls);

        if (rollbackError) {
          console.error("New image record rollback failed:", rollbackError);
        }

      }

      await removeStorageFiles(uploaded.map(item => item.path));

      throw error;

    }

  }


  /* =======================================================
     23. SAVE PRODUCT
  ======================================================= */

  async function saveProduct(event) {

    event.preventDefault();

    if (savingProduct) return;

    savingProduct = true;

    elements.saveButton.disabled = true;

    elements.cancelButton.disabled = true;

    elements.closeModal.disabled = true;

    setSaveButton("Saving Product...", "fa-spinner fa-spin");

    clearFormMessage();

    try {

      if (!supabase) {
        throw new Error("Supabase connection is unavailable.");
      }

      const payload = getProductPayload();

      const editingId = elements.editingId.value;

      let productId;


      /* UPDATE EXISTING PRODUCT */

      if (editingId) {

        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          throw error;
        }

        productId = editingId;

        await updateExistingProductImages(productId);

      }


      /* CREATE NEW PRODUCT */

      else {

        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        productId = data.id;

        await uploadProductImages(productId);

      }


      setSaveButton(
        editingId ? "Updated!" : "Saved!",
        "fa-circle-check"
      );

      elements.modal.hidden = true;

      document.body.style.overflow = "";

      resetImages();

      elements.form.reset();

      elements.editingId.value = "";

      delete elements.slug.dataset.manuallyEdited;

      await loadProducts();

      alert(
        editingId
          ? "Product updated successfully!"
          : "Product created successfully!"
      );

    } catch (error) {

      console.error("Product saving:", error);

      showFormMessage(
        error.message || "Unable to save product."
      );

    } finally {

      savingProduct = false;

      elements.saveButton.disabled = false;

      elements.cancelButton.disabled = false;

      elements.closeModal.disabled = false;

      setSaveButton(
        elements.editingId.value
          ? "Update Product"
          : "Save Product"
      );

    }

  }


  /* =======================================================
     24. CLEAR FILTERS
  ======================================================= */

  function clearFilters() {

    elements.search.value = "";

    elements.categoryFilter.value = "";

    elements.statusFilter.value = "";

    elements.availabilityFilter.value = "";

    applyFilters();

  }


  /* =======================================================
     25. PAGINATION
  ======================================================= */

  elements.previousButton.addEventListener("click", () => {

    if (currentPage > 1) {

      currentPage--;

      renderProducts();

    }

  });


  elements.nextButton.addEventListener("click", () => {

    const totalPages = Math.ceil(
      filteredProducts.length / PAGE_SIZE
    );

    if (currentPage < totalPages) {

      currentPage++;

      renderProducts();

    }

  });


  /* =======================================================
     26. FILTER EVENTS
  ======================================================= */

  elements.search.addEventListener("input", applyFilters);

  elements.categoryFilter.addEventListener("change", applyFilters);

  elements.statusFilter.addEventListener("change", applyFilters);

  elements.availabilityFilter.addEventListener("change", applyFilters);

  elements.clearFiltersButton.addEventListener("click", clearFilters);


  /* =======================================================
     27. RETRY
  ======================================================= */

  elements.retryButton.addEventListener("click", loadProducts);


  /* =======================================================
     28. PRODUCT ACTIONS
  ======================================================= */

  elements.tableBody.addEventListener("click", event => {

    const button = event.target.closest("[data-product-action]");

    if (!button) return;

    const action = button.dataset.productAction;

    const productId = button.dataset.productId;

    const product = allProducts.find(item =>
      item.id === productId
    );

    if (!product) return;

    if (action === "view") {

      window.open(
        `../product.html?slug=${encodeURIComponent(product.slug)}`,
        "_blank",
        "noopener"
      );

      return;

    }

    if (action === "edit") {

      editProduct(product);

    }

  });


  /* =======================================================
     29. MODAL EVENTS
  ======================================================= */

  elements.addButton.addEventListener("click", openProductModal);

  elements.emptyAddButton.addEventListener("click", openProductModal);

  elements.closeModal.addEventListener("click", closeProductModal);

  elements.cancelButton.addEventListener("click", closeProductModal);

  elements.modal.addEventListener("click", event => {

    if (event.target === elements.modal) {
      closeProductModal();
    }

  });


  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      !elements.modal.hidden
    ) {
      closeProductModal();
    }

  });


  /* =======================================================
     30. FORM EVENTS
  ======================================================= */

  elements.name.addEventListener("input", () => {

    if (!elements.slug.dataset.manuallyEdited) {

      elements.slug.value = createSlug(
        elements.name.value
      );

    }

  });


  elements.slug.addEventListener("input", () => {

    elements.slug.dataset.manuallyEdited = "true";

    elements.slug.value = createSlug(
      elements.slug.value
    );

  });


  elements.pricingType.addEventListener(
    "change",
    updatePricingFields
  );


  elements.form.addEventListener("submit", saveProduct);


  /* =======================================================
     31. INITIALIZATION
  ======================================================= */

  async function initialize() {

    if (!supabase) {

      elements.errorMessage.textContent =
        "Supabase has not been initialized. Check supabase-config.js.";

      showState("error");

      return;

    }

    await loadCategories();

    await loadProducts();

  }


  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );


})();