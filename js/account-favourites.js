// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER FAVOURITES
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
      "HAFHASS Favourites: Required dependencies are unavailable."
    );

    return;

  }


  // ====================================================
  // DOM ELEMENTS
  // ====================================================

  const elements = {

    loading: document.getElementById("favouritesLoading"),

    error: document.getElementById("favouritesError"),

    errorMessage: document.getElementById(
      "favouritesErrorMessage"
    ),

    empty: document.getElementById("favouritesEmpty"),

    grid: document.getElementById("favouritesGrid"),

    count: document.getElementById("favouritesCount"),

    refreshButton: document.getElementById(
      "refreshFavouritesButton"
    ),

    retryButton: document.getElementById(
      "retryFavouritesButton"
    ),

    avatar: document.getElementById("accountAvatar"),

    avatarInitials: document.getElementById("avatarInitials"),

    sidebarUserName: document.getElementById("sidebarUserName"),

    sidebarUserEmail: document.getElementById("sidebarUserEmail"),

    year: document.getElementById("accountYear")

  };


  // ====================================================
  // PAGE STATE
  // ====================================================

  let currentUser = null;

  let favourites = [];

  let isLoading = false;


  // ====================================================
  // GENERAL HELPERS
  // ====================================================

  function setText(element, value) {

    if (!element) return;

    element.textContent =
      value !== null &&
      value !== undefined &&
      value !== ""
        ? String(value)
        : "—";

  }


  function getInitials(name) {

    if (!name || typeof name !== "string") {
      return "C";
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("") || "C";

  }


  // ====================================================
  // MESSAGE HANDLING
  // ====================================================

  function showMessage(message, type = "success") {

    if (!elements.errorMessage) return;

    setText(elements.errorMessage, message);

    if (elements.error) {
      elements.error.hidden = false;
    }

  }


  // ====================================================
  // PAGE DISPLAY STATES
  // ====================================================

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

    if (elements.grid) {
      elements.grid.hidden = true;
    }

  }


  function showLoading() {

    hideAllStates();

    if (elements.loading) {
      elements.loading.hidden = false;
    }

  }


  function showError(message) {

    hideAllStates();

    setText(
      elements.errorMessage,
      message ||
        "Something went wrong while loading your favourites."
    );

    if (elements.error) {
      elements.error.hidden = false;
    }

  }


  function showEmpty() {

    hideAllStates();

    updateCount(0);

    if (elements.empty) {
      elements.empty.hidden = false;
    }

  }


  function updateCount(number) {

    if (!elements.count) return;

    elements.count.textContent =
      `${number} ${number === 1 ? "saved item" : "saved items"}`;

  }


  // ====================================================
  // CUSTOMER INFORMATION
  // ====================================================

  async function loadCustomerInformation(
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
              "Unable to retrieve customer profile."
            );

        }

        profile =
          result?.profile ||
          result?.data?.profile ||
          result?.data ||
          null;

      } catch (error) {

        console.warn(
          "Favourites: Profile retrieval failed.",
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


    // SIDEBAR INFORMATION

    setText(
      elements.sidebarUserName,
      fullName
    );

    setText(
      elements.sidebarUserEmail,
      email
    );


    // CUSTOMER INITIALS

    setText(
      elements.avatarInitials,
      getInitials(fullName)
    );


    // CUSTOMER PROFILE IMAGE

    if (
      profile?.avatar_url &&
      elements.avatar
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

          elements.avatar.style.backgroundImage =
            `url("${imageUrl.href}")`;

          elements.avatar.style.backgroundSize = "cover";

          elements.avatar.style.backgroundPosition = "center";

          setText(
            elements.avatarInitials,
            ""
          );

        }

      } catch (error) {

        console.warn(
          "Favourites: Invalid customer profile image URL.",
          error
        );

      }

    }

  }


  // ====================================================
  // FETCH CUSTOMER FAVOURITES
  // ====================================================

  async function fetchFavourites() {

    const { data, error } = await db

      .from("favourites")

      .select(`
        id,
        user_id,
        product_id,
        created_at
      `)

      .eq("user_id", currentUser.id)

      .order("created_at", {
        ascending: false
      });


    if (error) {
      throw error;
    }


    return data || [];

  }


  // ====================================================
  // FETCH ACTIVE PRODUCTS
  // ====================================================

  async function fetchProducts(productIds) {

    if (!productIds.length) {
      return [];
    }


    const { data, error } = await db

      .from("products")

      .select(`
        id,
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
        status,
        is_customizable,
        minimum_order_quantity,
        preparation_time_days
      `)

      .in("id", productIds)

      .eq("status", "active");


    if (error) {
      throw error;
    }


    return data || [];

  }


  // ====================================================
  // FETCH PRODUCT IMAGES
  // ====================================================

  async function fetchProductImages(productIds) {

    if (!productIds.length) {
      return [];
    }


    const { data, error } = await db

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

      .order("is_primary", {
        ascending: false
      })

      .order("display_order", {
        ascending: true
      });


    if (error) {
      throw error;
    }


    return data || [];

  }


  // ====================================================
  // GET PRIMARY PRODUCT IMAGE
  // ====================================================

  function getProductImage(product, images) {

    const productImages = images.filter(
      image => image.product_id === product.id
    );


    return productImages[0] || null;

  }


  // ====================================================
  // FORMAT PRODUCT PRICE
  // ====================================================

  function formatPrice(product) {

    const amount = Number(product.price ?? 0);

    if (!Number.isFinite(amount)) {
      return "Price unavailable";
    }


    const currency = String(
      product.currency || "NGN"
    ).trim().toUpperCase();


    try {

      return new Intl.NumberFormat("en-NG", {

        style: "currency",

        currency,

        minimumFractionDigits: 2,

        maximumFractionDigits: 2

      }).format(amount);

    } catch (error) {

      return `${currency} ${amount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;

    }

  }


  // ====================================================
  // CREATE PRODUCT IMAGE
  // ====================================================

  function createProductImage(product, image) {

    const wrapper = document.createElement("div");

    wrapper.className = "favourite-card-image";


    if (image?.image_url) {

      const img = document.createElement("img");

      img.src = image.image_url;

      img.alt =
        image.alt_text ||
        product.name ||
        "Favourite product";

      img.loading = "lazy";


      img.onerror = () => {

        wrapper.replaceChildren();

        const fallback = document.createElement("div");

        fallback.className =
          "favourite-image-unavailable";

        fallback.textContent = "Image unavailable";

        wrapper.appendChild(fallback);

      };


      wrapper.appendChild(img);

    } else {

      const fallback = document.createElement("div");

      fallback.className =
        "favourite-image-unavailable";

      fallback.textContent = "No image available";

      wrapper.appendChild(fallback);

    }


    return wrapper;

  }


  // ====================================================
  // CREATE FAVOURITE CARD
  // ====================================================

  function createFavouriteCard(favourite, product, images) {

    const card = document.createElement("article");

    card.className = "favourite-card";


    // PRODUCT IMAGE

    const image = getProductImage(product, images);

    card.appendChild(
      createProductImage(product, image)
    );


    // PRODUCT CONTENT

    const content = document.createElement("div");

    content.className = "favourite-card-content";


    // PRODUCT NAME

    const name = document.createElement("h3");

    name.className = "favourite-product-name";

    name.textContent =
      product.name || "Unnamed Product";

    content.appendChild(name);


    // PRODUCT DESCRIPTION

    if (product.short_description) {

      const description = document.createElement("p");

      description.className =
        "favourite-product-description";

      description.textContent =
        product.short_description;

      content.appendChild(description);

    }


    // PRODUCT PRICE

    const pricing = document.createElement("div");

    pricing.className = "favourite-product-pricing";


    const price = document.createElement("span");

    price.className = "favourite-product-price";

    price.textContent = formatPrice(product);

    pricing.appendChild(price);


    // COMPARE-AT PRICE

    if (
      product.compare_at_price !== null &&
      product.compare_at_price !== undefined &&
      Number(product.compare_at_price) > Number(product.price)
    ) {

      const oldPrice = document.createElement("span");

      oldPrice.className =
        "favourite-product-old-price";

      const oldAmount = Number(product.compare_at_price);

      try {

        oldPrice.textContent = new Intl.NumberFormat(
          "en-NG",
          {
            style: "currency",
            currency: String(product.currency || "NGN")
              .trim()
              .toUpperCase(),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }
        ).format(oldAmount);

      } catch (error) {

        oldPrice.textContent =
          `${product.currency || "NGN"} ${oldAmount.toLocaleString("en-NG")}`;

      }

      pricing.appendChild(oldPrice);

    }


    content.appendChild(pricing);


    // PRODUCT AVAILABILITY

    const availability = document.createElement("p");

    availability.className =
      "favourite-product-availability";


    const availabilityLabels = {

      in_stock: "In Stock",

      out_of_stock: "Out of Stock",

      pre_order: "Available for Pre-order",

      made_to_order: "Made to Order"

    };


    availability.textContent =
      availabilityLabels[product.availability] ||
      "Availability information unavailable";


    content.appendChild(availability);


    // PRODUCT ACTIONS

    const actions = document.createElement("div");

    actions.className = "favourite-card-actions";


    // VIEW PRODUCT

    const viewButton = document.createElement("a");

    viewButton.className = "favourite-view-button";

    viewButton.href =
      `../product.html?slug=${encodeURIComponent(product.slug)}`;

    viewButton.innerHTML =
      '<i class="fa-solid fa-eye" aria-hidden="true"></i> View Product';

    actions.appendChild(viewButton);


    // REMOVE FAVOURITE

    const removeButton = document.createElement("button");

    removeButton.type = "button";

    removeButton.className =
      "favourite-remove-button";

    removeButton.innerHTML =
      '<i class="fa-solid fa-heart-crack" aria-hidden="true"></i> Remove';

    removeButton.setAttribute(
      "aria-label",
      `Remove ${product.name} from favourites`
    );


    removeButton.addEventListener("click", () => {

      removeFavourite(
        favourite.id,
        removeButton
      );

    });


    actions.appendChild(removeButton);


    content.appendChild(actions);

    card.appendChild(content);


    return card;

  }


  // ====================================================
  // REMOVE FAVOURITE
  // ====================================================

  async function removeFavourite(favouriteId, button) {

    if (!button || button.disabled) {
      return;
    }


    const originalHTML = button.innerHTML;


    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Removing...';


    try {

      const { error } = await db

        .from("favourites")

        .delete()

        .eq("id", favouriteId)

        .eq("user_id", currentUser.id);


      if (error) {
        throw error;
      }


      // REMOVE THE ITEM FROM THE LOCAL LIST

      favourites = favourites.filter(
        item => item.id !== favouriteId
      );


      // RELOAD THE DISPLAY

      await loadFavourites();


    } catch (error) {

      console.error(
        "Favourites: Unable to remove item.",
        error
      );


      button.disabled = false;

      button.innerHTML = originalHTML;


      alert(
        "We couldn't remove this product from your favourites. Please try again."
      );

    }

  }


  // ====================================================
  // LOAD FAVOURITES
  // ====================================================

  async function loadFavourites() {

    if (isLoading) {
      return;
    }


    isLoading = true;

    showLoading();


    try {

      // FETCH SAVED FAVOURITES

      favourites = await fetchFavourites();


      if (!favourites.length) {

        showEmpty();

        return;

      }


      // GET UNIQUE PRODUCT IDS

      const productIds = [

        ...new Set(

          favourites

            .map(item => item.product_id)

            .filter(Boolean)

        )

      ];


      if (!productIds.length) {

        showEmpty();

        return;

      }


      // FETCH ACTIVE PRODUCTS

      const products = await fetchProducts(productIds);


      if (!products.length) {

        showEmpty();

        return;

      }


      // FETCH PRODUCT IMAGES

      const images = await fetchProductImages(

        products.map(product => product.id)

      );


      // MAP PRODUCTS

      const productMap = new Map(

        products.map(product => [
          product.id,
          product
        ])

      );


      // CLEAR PREVIOUS CONTENT

      elements.grid.replaceChildren();


      // RENDER FAVOURITE CARDS

      let displayedCount = 0;


      favourites.forEach(favourite => {

        const product = productMap.get(
          favourite.product_id
        );


        // SKIP PRODUCTS THAT ARE NO LONGER ACTIVE.

        if (!product) {
          return;
        }


        const card = createFavouriteCard(
          favourite,
          product,
          images
        );


        elements.grid.appendChild(card);

        displayedCount++;

      });


      // NO ACTIVE PRODUCTS REMAIN

      if (!displayedCount) {

        showEmpty();

        return;

      }


      // UPDATE COUNT

      updateCount(displayedCount);


      // SHOW GRID

      hideAllStates();

      elements.grid.hidden = false;


    } catch (error) {

      console.error(

        "HAFHASS Favourites: Loading failed.",

        {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
          raw: error
        }

      );


      showError(

        "We couldn't load your saved products. Please check your connection and try again."

      );

    } finally {

      isLoading = false;

    }

  }


  // ====================================================
  // INITIALIZE PAGE
  // ====================================================

  async function initializeFavouritesPage() {

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
      // GET AUTHENTICATED CUSTOMER
      // ------------------------------------------------

      currentUser = guardResult.user?.id
        ? guardResult.user
        : null;


      // FALLBACK IF THE GUARD DID NOT RETURN THE USER.

      if (!currentUser) {

        const userResult = await auth.getCurrentUser();


        if (
          !userResult ||
          userResult.success !== true ||
          !userResult.user?.id
        ) {

          window.location.replace("../login.html");

          return;

        }


        currentUser = userResult.user;

      }


      // VERIFY USER ID

      if (!currentUser?.id) {

        throw new Error(
          "A valid authenticated customer could not be identified."
        );

      }


      // ------------------------------------------------
      // CUSTOMER INFORMATION
      // ------------------------------------------------

      await loadCustomerInformation(

        currentUser,

        guardResult.profile || null

      );


      // ------------------------------------------------
      // FOOTER YEAR
      // ------------------------------------------------

      if (elements.year) {

        elements.year.textContent =
          new Date().getFullYear();

      }


      // ------------------------------------------------
      // REFRESH BUTTON
      // ------------------------------------------------

      if (elements.refreshButton) {

        elements.refreshButton.addEventListener(
          "click",
          loadFavourites
        );

      }


      // ------------------------------------------------
      // RETRY BUTTON
      // ------------------------------------------------

      if (elements.retryButton) {

        elements.retryButton.addEventListener(
          "click",
          loadFavourites
        );

      }


      // ------------------------------------------------
      // INITIAL LOAD
      // ------------------------------------------------

      await loadFavourites();


    } catch (error) {

      console.error(

        "HAFHASS Favourites: Page initialization failed.",

        error

      );


      showError(

        "Unable to initialize your favourites page. Please refresh and try again."

      );

    }

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      initializeFavouritesPage,

      { once: true }

    );

  } else {

    initializeFavouritesPage();

  }


  console.log(
    "HAFHASS: Customer favourites controller initialized."
  );

})();