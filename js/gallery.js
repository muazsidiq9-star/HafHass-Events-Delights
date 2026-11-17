document.addEventListener("DOMContentLoaded", () => {

"use strict";

  // =====================================================
  // 1. GALLERY ELEMENTS
  // =====================================================

  const galleryGrid = document.getElementById("galleryGrid");

  const galleryLoading = document.getElementById("galleryLoading");

  const galleryEmpty = document.getElementById("galleryEmpty");

  const galleryError = document.getElementById("galleryError");

  const galleryRetryButton = document.getElementById(
    "galleryRetryButton"
  );


  // LIGHTBOX ELEMENTS

  const galleryLightbox = document.getElementById(
    "galleryLightbox"
  );

  const lightboxImage = document.getElementById(
    "galleryLightboxImage"
  );

  const lightboxTitle = document.getElementById(
    "galleryLightboxTitle"
  );

  const lightboxDescription = document.getElementById(
    "galleryLightboxDescription"
  );

  const lightboxClose = document.getElementById(
    "galleryLightboxClose"
  );

  const lightboxPrevious = document.getElementById(
    "galleryLightboxPrev"
  );

  const lightboxNext = document.getElementById(
    "galleryLightboxNext"
  );


  // =====================================================
  // 2. GALLERY STATE
  // =====================================================

  const supabase = window.hafhassSupabase;

  let galleryItems = [];

  let currentImageIndex = 0;

  let lastFocusedElement = null;

  let isLoading = false;


  // =====================================================
  // 3. HELPER FUNCTIONS
  // =====================================================

  function createTextElement(tag, className, text) {

    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent = text || "";

    return element;

  }


  // =====================================================
  // 4. GALLERY DISPLAY STATES
  // =====================================================

  function showLoading() {

    if (galleryLoading) {
      galleryLoading.hidden = false;
    }

    if (galleryEmpty) {
      galleryEmpty.hidden = true;
    }

    if (galleryError) {
      galleryError.hidden = true;
    }

    if (galleryGrid) {
      galleryGrid.replaceChildren();
    }

  }


  function showEmpty() {

    if (galleryLoading) {
      galleryLoading.hidden = true;
    }

    if (galleryEmpty) {
      galleryEmpty.hidden = false;
    }

    if (galleryError) {
      galleryError.hidden = true;
    }

    if (galleryGrid) {
      galleryGrid.replaceChildren();
    }

  }


  function showError() {

    if (galleryLoading) {
      galleryLoading.hidden = true;
    }

    if (galleryEmpty) {
      galleryEmpty.hidden = true;
    }

    if (galleryError) {
      galleryError.hidden = false;
    }

    if (galleryGrid) {
      galleryGrid.replaceChildren();
    }

  }


  function hideAllStates() {

    if (galleryLoading) {
      galleryLoading.hidden = true;
    }

    if (galleryEmpty) {
      galleryEmpty.hidden = true;
    }

    if (galleryError) {
      galleryError.hidden = true;
    }

  }


  // =====================================================
  // 5. FETCH ACTIVE PRODUCTS
  // =====================================================

  async function fetchActiveProducts() {

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        short_description,
        description,
        display_order
      `)
      .eq("status", "active")
      .order("display_order", {
        ascending: true,
        nullsFirst: false
      });

    if (error) {
      throw error;
    }

    return data || [];

  }


  // =====================================================
  // 6. FETCH PRODUCT IMAGES
  // =====================================================

  async function fetchProductImages(productIds) {

    if (!productIds.length) {
      return [];
    }

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
      .order("is_primary", {
        ascending: false
      })
      .order("display_order", {
        ascending: true,
        nullsFirst: false
      });

    if (error) {
      throw error;
    }

    return data || [];

  }


  // =====================================================
  // 7. PREPARE GALLERY ITEMS
  // =====================================================

  function prepareGalleryItems(products, images) {

    const productMap = new Map(
      products.map(product => [
        product.id,
        product
      ])
    );

    const preparedItems = [];

    const usedImageUrls = new Set();


    images.forEach(image => {

      if (!image.image_url) {
        return;
      }

      const product = productMap.get(image.product_id);

      if (!product) {
        return;
      }

      // Avoid displaying the same image URL twice.

      if (usedImageUrls.has(image.image_url)) {
        return;
      }

      usedImageUrls.add(image.image_url);


      preparedItems.push({

        imageId: image.id,

        productId: product.id,

        imageUrl: image.image_url,

        imageAlt:
          image.alt_text ||
          product.name ||
          "HAFHASS creation",

        title: product.name,

        description:
          product.short_description ||
          product.description ||
          ""

      });

    });


    return preparedItems;

  }


  // =====================================================
  // 8. CREATE GALLERY CARD
  // =====================================================

  function createGalleryCard(item, index) {

    const card = document.createElement("article");

    card.className = "gallery-card";


    // IMAGE CONTAINER

    const imageContainer = document.createElement("div");

    imageContainer.className = "gallery-card-image";


    // IMAGE

    const image = document.createElement("img");

    image.src = item.imageUrl;

    image.alt = item.imageAlt;

    image.loading = "lazy";

    image.decoding = "async";


    image.addEventListener("error", () => {

      card.remove();

      console.warn(
        "HAFHASS: Could not load gallery image.",
        item.imageUrl
      );

      // If every image fails, display the empty state.

      if (
        galleryGrid &&
        galleryGrid.children.length === 0
      ) {

        showEmpty();

      }

    }, {
      once: true
    });


    imageContainer.appendChild(image);


    // VIEW IMAGE BUTTON

    const viewButton = document.createElement("button");

    viewButton.type = "button";

    viewButton.className = "gallery-card-button";

    viewButton.setAttribute(
      "aria-label",
      `View ${item.title}`
    );

    viewButton.addEventListener("click", () => {

      openLightbox(index);

    });


    imageContainer.appendChild(viewButton);


    // CARD CONTENT

    const content = document.createElement("div");

    content.className = "gallery-card-content";


    // PRODUCT TITLE

    content.appendChild(
      createTextElement(
        "h3",
        "gallery-card-title",
        item.title
      )
    );


    // PRODUCT DESCRIPTION

    if (item.description) {

      content.appendChild(
        createTextElement(
          "p",
          "gallery-card-description",
          item.description
        )
      );

    }


    // ASSEMBLE CARD

    card.appendChild(imageContainer);

    card.appendChild(content);


    return card;

  }


  // =====================================================
  // 9. DISPLAY GALLERY
  // =====================================================

  function displayGallery(items) {

    if (!galleryGrid) {
      return;
    }

    galleryGrid.replaceChildren();


    if (!items.length) {

      showEmpty();

      return;

    }


    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {

      fragment.appendChild(
        createGalleryCard(item, index)
      );

    });


    galleryGrid.appendChild(fragment);

    hideAllStates();

  }


  // =====================================================
  // 10. OPEN LIGHTBOX
  // =====================================================

  function openLightbox(index) {

    if (
      !galleryLightbox ||
      !lightboxImage ||
      !galleryItems.length
    ) {
      return;
    }

    if (index < 0 || index >= galleryItems.length) {
      return;
    }


    currentImageIndex = index;

    lastFocusedElement = document.activeElement;


    updateLightbox();


    galleryLightbox.hidden = false;

    galleryLightbox.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add("lightbox-open");


    if (lightboxClose) {
      lightboxClose.focus();
    }

  }


  // =====================================================
  // 11. UPDATE LIGHTBOX CONTENT
  // =====================================================

  function updateLightbox() {

    if (!galleryItems.length) {
      return;
    }

    const item = galleryItems[currentImageIndex];


    // IMAGE

    if (lightboxImage) {

      lightboxImage.src = item.imageUrl;

      lightboxImage.alt = item.imageAlt;

    }


    // TITLE

    if (lightboxTitle) {

      lightboxTitle.textContent = item.title;

    }


    // DESCRIPTION

    if (lightboxDescription) {

      lightboxDescription.textContent =
        item.description;

      lightboxDescription.hidden =
        !item.description;

    }


    // NAVIGATION BUTTONS

    if (lightboxPrevious) {

      lightboxPrevious.disabled =
        galleryItems.length < 2;

    }

    if (lightboxNext) {

      lightboxNext.disabled =
        galleryItems.length < 2;

    }

  }


  // =====================================================
  // 12. CLOSE LIGHTBOX
  // =====================================================

  function closeLightbox() {

    if (!galleryLightbox) {
      return;
    }

    galleryLightbox.hidden = true;

    galleryLightbox.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove("lightbox-open");


    if (lightboxImage) {
      lightboxImage.removeAttribute("src");
    }


    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus === "function"
    ) {

      lastFocusedElement.focus();

    }

    lastFocusedElement = null;

  }


  // =====================================================
  // 13. LIGHTBOX NAVIGATION
  // =====================================================

  function showPreviousImage() {

    if (galleryItems.length < 2) {
      return;
    }

    currentImageIndex =
      (currentImageIndex - 1 + galleryItems.length) %
      galleryItems.length;

    updateLightbox();

  }


  function showNextImage() {

    if (galleryItems.length < 2) {
      return;
    }

    currentImageIndex =
      (currentImageIndex + 1) %
      galleryItems.length;

    updateLightbox();

  }


  // =====================================================
  // 14. LIGHTBOX EVENT LISTENERS
  // =====================================================

  if (lightboxClose) {

    lightboxClose.addEventListener(
      "click",
      closeLightbox
    );

  }


  if (lightboxPrevious) {

    lightboxPrevious.addEventListener(
      "click",
      showPreviousImage
    );

  }


  if (lightboxNext) {

    lightboxNext.addEventListener(
      "click",
      showNextImage
    );

  }


  // Close when clicking the lightbox background.

  if (galleryLightbox) {

    galleryLightbox.addEventListener("click", event => {

      if (event.target === galleryLightbox) {

        closeLightbox();

      }

    });

  }


  // Keyboard navigation.

  document.addEventListener("keydown", event => {

    if (
      !galleryLightbox ||
      galleryLightbox.hidden
    ) {
      return;
    }


    if (event.key === "Escape") {

      closeLightbox();

    }

    if (event.key === "ArrowLeft") {

      showPreviousImage();

    }

    if (event.key === "ArrowRight") {

      showNextImage();

    }

  });


  // =====================================================
  // 15. LOAD GALLERY
  // =====================================================

  async function loadGallery() {

    if (isLoading) {
      return;
    }

    if (!galleryGrid) {
      return;
    }

    isLoading = true;

    showLoading();


    try {

      if (!supabase) {

        throw new Error(
          "HAFHASS Supabase client is unavailable."
        );

      }


      // FETCH ACTIVE PRODUCTS

      const products = await fetchActiveProducts();


      if (!products.length) {

        galleryItems = [];

        showEmpty();

        return;

      }


      // FETCH THEIR IMAGES

      const productIds = products.map(
        product => product.id
      );

      const images = await fetchProductImages(
        productIds
      );


      // PREPARE GALLERY DATA

      galleryItems = prepareGalleryItems(
        products,
        images
      );


      // DISPLAY GALLERY

      displayGallery(galleryItems);


    } catch (error) {

      console.error(
        "HAFHASS: Could not load the gallery.",
        error
      );

      galleryItems = [];

      showError();

    } finally {

      isLoading = false;

    }

  }


  // =====================================================
  // 16. RETRY BUTTON
  // =====================================================

  if (galleryRetryButton) {

    galleryRetryButton.addEventListener(
      "click",
      loadGallery
    );

  }


  // =====================================================
  // 17. INITIALISE GALLERY
  // =====================================================

  loadGallery();


});