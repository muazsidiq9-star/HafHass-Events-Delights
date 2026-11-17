/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   SHOP PAGE JAVASCRIPT
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     1. INITIALIZATION
  ======================================================= */

  function initializeShop() {

    const supabase = window.hafhassSupabase;
    const auth = window.HafhassAuth;

    /* =====================================================
       2. DOM ELEMENTS
    ===================================================== */

    const elements = {

      // Categories

      categoryLoading:
        document.getElementById("categoryLoading"),

      categoryList:
        document.getElementById("categoryList"),

      categoryEmpty:
        document.getElementById("categoryEmpty"),

      categoryError:
        document.getElementById("categoryError"),

      categoryErrorMessage:
        document.getElementById("categoryErrorMessage"),

      retryCategoriesButton:
        document.getElementById("retryCategoriesButton"),


      // Search and filters

      productSearch:
        document.getElementById("productSearch"),

      clearSearchButton:
        document.getElementById("clearSearchButton"),

      categoryFilter:
        document.getElementById("categoryFilter"),

      availabilityFilter:
        document.getElementById("availabilityFilter"),

      sortProducts:
        document.getElementById("sortProducts"),

      resetFiltersButton:
        document.getElementById("resetFiltersButton"),

      clearFiltersButton:
        document.getElementById("clearFiltersButton"),


      // Product results

      shopResultsCount:
        document.getElementById("shopResultsCount"),

      shopLoading:
        document.getElementById("shopLoading"),

      shopError:
        document.getElementById("shopError"),

      shopErrorMessage:
        document.getElementById("shopErrorMessage"),

      retryShopButton:
        document.getElementById("retryShopButton"),

      shopEmpty:
        document.getElementById("shopEmpty"),

      shopNoResults:
        document.getElementById("shopNoResults"),

      shopProductGrid:
        document.getElementById("shopProductGrid"),

      shopLoadMoreContainer:
        document.getElementById("shopLoadMoreContainer"),

      loadMoreProductsButton:
        document.getElementById("loadMoreProductsButton"),


      // Footer

      customerCareLink:
        document.getElementById("customerCareLink")

    };
    
    
    if (!supabase) {

  console.error(
    "HAFHASS Shop: Supabase is unavailable."
  );

  showShopError(
    "The shop could not connect to our database. Please refresh the page."
  );

  return;

}


    /* =====================================================
       3. APPLICATION STATE
    ===================================================== */

    const PAGE_SIZE = 12;

    let categories = [];

    let products = [];

    let filteredProducts = [];

    let visibleProducts = [];

    let currentPage = 1;

    let isLoading = false;

    let categoryLoadFailed = false;

    let productLoadFailed = false;


    /* =====================================================
       4. HELPER FUNCTIONS
    ===================================================== */
    
    function createImagePlaceholder() {

  const placeholder = createElement(
    "div",
    "shop-product-image-placeholder"
  );

  const icon = document.createElement("i");

  icon.className = "fa-regular fa-image";

  icon.setAttribute("aria-hidden", "true");

  placeholder.appendChild(icon);

  return placeholder;

}

    function getErrorMessage(error) {

      return (
        error?.message ||
        error?.details ||
        error?.hint ||
        "An unexpected error occurred."
      );

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


    function clearElement(element) {

      if (element) {
        element.replaceChildren();
      }

    }


    function createElement(tag, className, text) {

      const element = document.createElement(tag);

      if (className) {
        element.className = className;
      }

      if (text !== undefined && text !== null) {
        element.textContent = text;
      }

      return element;

    }


    function normaliseText(value) {

      return String(value || "")
        .trim()
        .toLowerCase();

    }


    function formatCurrency(amount, currency) {

      const numericAmount = Number(amount);

      if (!Number.isFinite(numericAmount)) {
        return "Price unavailable";
      }

      const selectedCurrency = String(
        currency || "NGN"
      ).trim().toUpperCase();


      try {

        return new Intl.NumberFormat("en-NG", {

          style: "currency",

          currency: selectedCurrency,

          maximumFractionDigits: 2

        }).format(numericAmount);

      } catch (error) {

        return (
          selectedCurrency +
          " " +
          numericAmount.toLocaleString("en-NG")

        );

      }

    }


    function getCategoryName(categoryId) {

      const category = categories.find(
        item => item.id === categoryId
      );

      return category?.name || "General Collection";

    }


    function getPrimaryImage(product) {

      const images = Array.isArray(product.images)
        ? [...product.images]
        : [];


      images.sort((a, b) => {

        if (a.is_primary !== b.is_primary) {
          return a.is_primary ? -1 : 1;
        }

        return (
          Number(a.display_order || 0) -
          Number(b.display_order || 0)
        );

      });


      return images[0] || null;

    }


    function getProductAvailability(product) {

      const availability = product.availability;

      if (availability === "in_stock") {

        if (
          product.stock_quantity !== null &&
          product.stock_quantity !== undefined &&
          Number(product.stock_quantity) <= 0
        ) {

          return "out_of_stock";

        }

      }

      return availability;

    }


    function getAvailabilityLabel(availability) {

      const labels = {

        in_stock: "In Stock",

        out_of_stock: "Out of Stock",

        pre_order: "Pre-Order",

        made_to_order: "Made to Order"

      };

      return labels[availability] || "Availability Unknown";

    }


    function getProductPrice(product) {

      if (product.pricing_type === "quote") {
        return "Price on Request";
      }

      return formatCurrency(
        product.price,
        product.currency
      );

    }


    /* =====================================================
       5. CATEGORY LOADING STATE
    ===================================================== */

    function showCategoryLoading() {

      showElement(elements.categoryLoading);

      hideElement(elements.categoryList);

      hideElement(elements.categoryEmpty);

      hideElement(elements.categoryError);

    }


    function showCategoryError(message) {

      hideElement(elements.categoryLoading);

      hideElement(elements.categoryList);

      hideElement(elements.categoryEmpty);

      showElement(elements.categoryError);

      if (elements.categoryErrorMessage) {

        elements.categoryErrorMessage.textContent = message;

      }

    }


    /* =====================================================
       6. LOAD CATEGORIES
    ===================================================== */

    async function loadCategories() {

      showCategoryLoading();

      categoryLoadFailed = false;


      try {

        const { data, error } = await supabase

          .from("categories")

          .select(
            "id, parent_id, name, slug, description, display_order"
          )

          .eq("is_active", true)

          .order("display_order", {
            ascending: true
          });


        if (error) {
          throw error;
        }


        categories = data || [];

        renderCategories();

        populateCategoryFilter();

        applyFilters();


      } catch (error) {

        console.error(
          "HAFHASS Shop: Category loading failed.",
          error
        );

        categoryLoadFailed = true;

        showCategoryError(
          getErrorMessage(error)
        );

      }

    }


    /* =====================================================
       7. RENDER CATEGORY BUTTONS
    ===================================================== */

    function renderCategories() {

      clearElement(elements.categoryList);


      hideElement(elements.categoryLoading);

      hideElement(elements.categoryError);


      if (categories.length === 0) {

        hideElement(elements.categoryList);

        showElement(elements.categoryEmpty);

        return;

      }


      hideElement(elements.categoryEmpty);


      // All Products Button

      const allButton = createElement(
        "button",
        "shop-category-button active",
        "All Products"
      );

      allButton.type = "button";

      allButton.dataset.categoryId = "";

      allButton.addEventListener("click", () => {

        elements.categoryFilter.value = "";

        applyFilters();

      });


      elements.categoryList.appendChild(allButton);


      // Individual Category Buttons

      categories.forEach(category => {

        const button = createElement(
          "button",
          "shop-category-button",
          category.name
        );

        button.type = "button";

        button.dataset.categoryId = category.id;

        button.addEventListener("click", () => {

          elements.categoryFilter.value = category.id;

          applyFilters();

          document.getElementById("shopProducts")
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });

        });


        elements.categoryList.appendChild(button);

      });


      showElement(elements.categoryList);

      updateCategoryButtons();

    }


    /* =====================================================
       8. CATEGORY FILTER DROPDOWN
    ===================================================== */

    function populateCategoryFilter() {

      if (!elements.categoryFilter) return;


      const currentValue = elements.categoryFilter.value;

      const fragment = document.createDocumentFragment();


      const defaultOption = createElement(
        "option",
        "",
        "All Categories"
      );

      defaultOption.value = "";

      fragment.appendChild(defaultOption);


      categories.forEach(category => {

        const option = createElement(
          "option",
          "",
          category.name
        );

        option.value = category.id;

        fragment.appendChild(option);

      });


      elements.categoryFilter.replaceChildren(fragment);


      const categoryExists = categories.some(
        category => category.id === currentValue
      );

      if (categoryExists) {

        elements.categoryFilter.value = currentValue;

      }

    }


    /* =====================================================
       9. CATEGORY BUTTON ACTIVE STATE
    ===================================================== */

    function updateCategoryButtons() {

      if (!elements.categoryList) return;


      const selectedCategory =
        elements.categoryFilter?.value || "";


      const buttons =
        elements.categoryList.querySelectorAll(
          ".shop-category-button"
        );


      buttons.forEach(button => {

        const isActive =
          button.dataset.categoryId === selectedCategory;

        button.classList.toggle(
          "active",
          isActive
        );

        button.setAttribute(
          "aria-pressed",
          String(isActive)
        );

      });

    }


    /* =====================================================
       10. LOAD PRODUCTS
    ===================================================== */

    async function loadProducts() {

      if (isLoading) return;

      isLoading = true;

      productLoadFailed = false;


      showElement(elements.shopLoading);

      hideElement(elements.shopError);

      hideElement(elements.shopEmpty);

      hideElement(elements.shopNoResults);

      hideElement(elements.shopProductGrid);

      hideElement(elements.shopLoadMoreContainer);


      if (elements.shopResultsCount) {

        elements.shopResultsCount.textContent =
          "Loading products...";

      }


      try {

        /*
          Retrieve active products.

          Product images are retrieved separately
          to avoid depending on nested relationships.
        */

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
            is_featured,
            stock_quantity,
            display_order,
            created_at
          `)

          .eq("status", "active")

          .order("display_order", {
            ascending: true
          })

          .limit(1000);


        if (error) {
          throw error;
        }


        products = data || [];


        // Load images only when products exist

        if (products.length > 0) {

          await loadProductImages();

        }


        isLoading = false;

        applyFilters();


      } catch (error) {

        isLoading = false;

        console.error(
          "HAFHASS Shop: Product loading failed.",
          error
        );

        productLoadFailed = true;

        showShopError(
          getErrorMessage(error)
        );

      } finally {

        hideElement(elements.shopLoading);

      }

    }


    /* =====================================================
       11. LOAD PRODUCT IMAGES
    ===================================================== */

    async function loadProductImages() {

      const productIds = products.map(
        product => product.id
      );


      products.forEach(product => {

        product.images = [];

      });


      if (productIds.length === 0) return;


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

        .in("product_id", productIds)

        .order("display_order", {
          ascending: true
        });


      if (error) {
        throw error;
      }


      const images = data || [];


      const imageMap = new Map();


      images.forEach(image => {

        if (!imageMap.has(image.product_id)) {

          imageMap.set(image.product_id, []);

        }

        imageMap.get(image.product_id).push(image);

      });


      products.forEach(product => {

        product.images =
          imageMap.get(product.id) || [];

      });

    }


    /* =====================================================
       12. SHOP ERROR STATE
    ===================================================== */

    function showShopError(message) {

      hideElement(elements.shopLoading);

      hideElement(elements.shopEmpty);

      hideElement(elements.shopNoResults);

      hideElement(elements.shopProductGrid);

      hideElement(elements.shopLoadMoreContainer);

      showElement(elements.shopError);


      if (elements.shopErrorMessage) {

        elements.shopErrorMessage.textContent = message;

      }


      if (elements.shopResultsCount) {

        elements.shopResultsCount.textContent =
          "Products could not be loaded.";

      }

    }


    /* =====================================================
       13. READ HOMEPAGE CATEGORY PARAMETER
    ===================================================== */

    function applyURLCategory() {

      const parameters = new URLSearchParams(
        window.location.search
      );

      const categorySlug =
        parameters.get("category");


      if (!categorySlug) return;


      const matchingCategory = categories.find(
        category =>
          normaliseText(category.slug) ===
          normaliseText(categorySlug)
      );


      if (matchingCategory) {

        elements.categoryFilter.value =
          matchingCategory.id;

      }

    }


    /* =====================================================
       14. SEARCH AND FILTER PRODUCTS
    ===================================================== */

    function applyFilters() {

      if (productLoadFailed) return;


      const searchTerm = normaliseText(
        elements.productSearch?.value
      );


      const selectedCategory =
        elements.categoryFilter?.value || "";


      const selectedAvailability =
        elements.availabilityFilter?.value || "";


      filteredProducts = products.filter(product => {


        // Search

        const searchableText = [

          product.name,

          product.sku,

          product.short_description,

          product.description

        ].join(" ").toLowerCase();


        const matchesSearch =
          !searchTerm ||
          searchableText.includes(searchTerm);


        // Category

        // Category

const selectedCategoryIds = selectedCategory
  ? [
      selectedCategory,

      ...categories
        .filter(category =>
          category.parent_id === selectedCategory
        )
        .map(category => category.id)
    ]
  : [];

const matchesCategory =
  !selectedCategory ||
  selectedCategoryIds.includes(product.category_id);
  

        // Availability

        const availability =
          getProductAvailability(product);


        const matchesAvailability =
          !selectedAvailability ||
          availability === selectedAvailability;


        return (
          matchesSearch &&
          matchesCategory &&
          matchesAvailability
        );

      });


      sortProducts();


      currentPage = 1;

      visibleProducts = filteredProducts.slice(
        0,
        PAGE_SIZE
      );


      renderProducts();

      updateCategoryButtons();

      updateSearchControls();

    }


    /* =====================================================
       15. SORT PRODUCTS
    ===================================================== */

    function sortProducts() {

      const sortValue =
        elements.sortProducts?.value || "featured";


      filteredProducts.sort((a, b) => {

        switch (sortValue) {


          case "newest":

            return (
              new Date(b.created_at || 0) -
              new Date(a.created_at || 0)
            );


          case "price_low":

            return (
              Number(a.price || 0) -
              Number(b.price || 0)
            );


          case "price_high":

            return (
              Number(b.price || 0) -
              Number(a.price || 0)
            );


          case "name_asc":

            return a.name.localeCompare(
              b.name
            );


          case "name_desc":

            return b.name.localeCompare(
              a.name
            );


          case "featured":

          default:

            if (a.is_featured !== b.is_featured) {

              return a.is_featured ? -1 : 1;

            }

            return (
              Number(a.display_order || 0) -
              Number(b.display_order || 0)
            );

        }

      });

    }


    /* =====================================================
       16. SEARCH CONTROL VISIBILITY
    ===================================================== */

    function updateSearchControls() {

      if (!elements.clearSearchButton) return;


      const hasSearch =
        Boolean(elements.productSearch?.value);


      elements.clearSearchButton.hidden =
        !hasSearch;

    }


    /* =====================================================
       17. RENDER PRODUCTS
    ===================================================== */

    function renderProducts() {

      hideElement(elements.shopLoading);

      hideElement(elements.shopError);

      hideElement(elements.shopEmpty);

      hideElement(elements.shopNoResults);


      clearElement(elements.shopProductGrid);


      // No active products in database

      if (products.length === 0) {

        hideElement(elements.shopProductGrid);

        hideElement(elements.shopLoadMoreContainer);

        showElement(elements.shopEmpty);


        if (elements.shopResultsCount) {

          elements.shopResultsCount.textContent =
            "No products available yet.";

        }

        return;

      }


      // No matching search or filters

      if (filteredProducts.length === 0) {

        hideElement(elements.shopProductGrid);

        hideElement(elements.shopLoadMoreContainer);

        showElement(elements.shopNoResults);


        if (elements.shopResultsCount) {

          elements.shopResultsCount.textContent =
            "No matching products found.";

        }

        return;

      }


      // Update visible products

      const startIndex =
        (currentPage - 1) * PAGE_SIZE;


      visibleProducts = filteredProducts.slice(
        0,
        currentPage * PAGE_SIZE
      );


      visibleProducts.forEach(product => {

        const card = createProductCard(product);

        elements.shopProductGrid.appendChild(card);

      });


      showElement(elements.shopProductGrid);


      // Result count

      if (elements.shopResultsCount) {

        const visibleCount = visibleProducts.length;

        const totalCount = filteredProducts.length;

        elements.shopResultsCount.textContent =
          `Showing ${visibleCount} of ${totalCount} products`;

      }


      // Load more button

      const hasMore =
        visibleProducts.length < filteredProducts.length;


      if (hasMore) {

        showElement(elements.shopLoadMoreContainer);

      } else {

        hideElement(elements.shopLoadMoreContainer);

      }

    }


    /* =====================================================
       18. CREATE PRODUCT CARD
    ===================================================== */

    function createProductCard(product) {

      const card = createElement(
        "article",
        "shop-product-card"
      );


      // Image wrapper

      const imageWrapper = createElement(
        "div",
        "shop-product-image-wrapper"
      );


      const primaryImage = getPrimaryImage(product);


      if (
        primaryImage &&
        primaryImage.image_url
      ) {

        const image = createElement(
          "img",
          "shop-product-image"
        );

        image.src = primaryImage.image_url;

        image.alt =
          primaryImage.alt_text ||
          product.name;

        image.loading = "lazy";

        image.decoding = "async";


        image.addEventListener("error", () => {

          image.remove();

          imageWrapper.prepend(
  createImagePlaceholder()
);

        });


        imageWrapper.appendChild(image);

      } else {

        imageWrapper.appendChild(
  createImagePlaceholder()
);

      }


      // Availability badge

      const availability =
        getProductAvailability(product);


      const badge = createElement(
        "span",
        "shop-product-badge",
        getAvailabilityLabel(availability)
      );


      if (availability === "out_of_stock") {

        badge.classList.add("out-of-stock");

      } else if (availability === "pre_order") {

        badge.classList.add("pre-order");

      } else if (availability === "made_to_order") {

        badge.classList.add("made-to-order");

      }


      imageWrapper.appendChild(badge);


      // Product information

      const info = createElement(
        "div",
        "shop-product-info"
      );


      const category = createElement(
        "span",
        "shop-product-category",
        getCategoryName(product.category_id)
      );


      const name = createElement(
        "h3",
        "shop-product-name",
        product.name
      );


      const description = createElement(
        "p",
        "shop-product-description",
        product.short_description ||
        product.description ||
        "Discover more about this product."
      );


      const price = createElement(
        "p",
        "shop-product-price",
        getProductPrice(product)
      );


      if (product.pricing_type === "starting_from") {

        price.classList.add("from-price");

      }


      if (product.pricing_type === "quote") {

        price.classList.add("price-on-request");

      }


      // Product link

      const action = createElement(
        "a",
        "shop-product-action",
        "View Product"
      );


      action.href =
        `product.html?slug=${encodeURIComponent(product.slug)}`;


      // Assemble card

      info.appendChild(category);

      info.appendChild(name);

      info.appendChild(description);

      info.appendChild(price);

      info.appendChild(action);


      card.appendChild(imageWrapper);

      card.appendChild(info);


      return card;

    }


    /* =====================================================
       19. LOAD MORE PRODUCTS
    ===================================================== */

    function loadMoreProducts() {

      if (
        visibleProducts.length >=
        filteredProducts.length
      ) {
        return;
      }


      currentPage += 1;

      renderProducts();

    }


    /* =====================================================
       20. RESET FILTERS
    ===================================================== */

    function resetFilters() {

      if (elements.productSearch) {

        elements.productSearch.value = "";

      }


      if (elements.categoryFilter) {

        elements.categoryFilter.value = "";

      }


      if (elements.availabilityFilter) {

        elements.availabilityFilter.value = "";

      }


      if (elements.sortProducts) {

        elements.sortProducts.value = "featured";

      }


      applyFilters();

    }


    /* =====================================================
       21. FOOTER ACCOUNT LINK
    ===================================================== */

    async function updateCustomerCareLink() {

      if (!elements.customerCareLink) return;


      elements.customerCareLink.href = "login.html";


      if (!auth || typeof auth.getSession !== "function") {
        return;
      }


      try {

        const result = await auth.getSession();


        if (
          result?.success === true &&
          result.session?.user
        ) {

          elements.customerCareLink.href =
            "account/dashboard.html";

          elements.customerCareLink.textContent =
            "My Account";

        } else {

          elements.customerCareLink.href =
            "login.html";

          elements.customerCareLink.textContent =
            "Sign In";

        }

      } catch (error) {

        console.warn(
          "HAFHASS Shop: Could not check customer session.",
          error
        );

      }

    }


    /* =====================================================
       22. EVENT LISTENERS
    ===================================================== */


    // Search

    elements.productSearch?.addEventListener(
      "input",
      applyFilters
    );


    // Clear search

    elements.clearSearchButton?.addEventListener(
      "click",
      () => {

        elements.productSearch.value = "";

        applyFilters();

        elements.productSearch.focus();

      }
    );


    // Category dropdown

    elements.categoryFilter?.addEventListener(
      "change",
      applyFilters
    );


    // Availability dropdown

    elements.availabilityFilter?.addEventListener(
      "change",
      applyFilters
    );


    // Sorting

    elements.sortProducts?.addEventListener(
      "change",
      applyFilters
    );


    // Reset filters

    elements.resetFiltersButton?.addEventListener(
      "click",
      resetFilters
    );


    elements.clearFiltersButton?.addEventListener(
      "click",
      resetFilters
    );


    // Load more

    elements.loadMoreProductsButton?.addEventListener(
      "click",
      loadMoreProducts
    );


    // Retry products

    elements.retryShopButton?.addEventListener(
      "click",
      () => {

        loadProducts();

      }
    );


    // Retry categories

    elements.retryCategoriesButton?.addEventListener(
      "click",
      () => {

        loadCategories();

      }
    );


    /* =====================================================
       23. INITIAL PAGE LOAD
    ===================================================== */

    async function initialize() {

      updateCustomerCareLink();


      // Load categories first

      await loadCategories();


      // Apply category from homepage URL

      if (!categoryLoadFailed) {

        applyURLCategory();

      }


      // Load products

      await loadProducts();

    }


    initialize();


    /* =====================================================
       24. AUTHENTICATION STATE LISTENER
    ===================================================== */

    if (
      auth &&
      typeof auth.onAuthStateChange === "function"
    ) {

      auth.onAuthStateChange(
        ({ event, session }) => {

          if (
            event === "SIGNED_IN" ||
            event === "SIGNED_OUT"
          ) {

            if (session?.user) {

              elements.customerCareLink.href =
                "account/dashboard.html";

              elements.customerCareLink.textContent =
                "My Account";

            } else {

              elements.customerCareLink.href =
                "login.html";

              elements.customerCareLink.textContent =
                "Sign In";

            }

          }

        }
      );

    }

  }


  /* =======================================================
     25. START SHOP APPLICATION
  ======================================================= */

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeShop
    );

  } else {

    initializeShop();

  }


})();