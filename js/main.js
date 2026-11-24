// Foreground push messages must be handled on every public page that loads main.js.
import("./firebase-push-notifications.js").catch(error => {
  console.warn("HAFHASS foreground notifications could not initialize:", error);
});

document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // 1. MOBILE NAVIGATION
  // ==========================================

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  function openMenu() {
    if (!mainNav || !menuToggle) return;

    mainNav.classList.add("open");

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Close navigation");
  }

  function closeMenu() {
    if (!mainNav || !menuToggle) return;

    mainNav.classList.remove("open");

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
  }

  function toggleMenu() {
    if (!mainNav || !menuToggle) return;

    const isOpen = mainNav.classList.contains("open");

    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (menuToggle && mainNav) {

    menuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleMenu();
    });

    mainNav.querySelectorAll("a").forEach((link) => {

      link.addEventListener("click", () => {
        closeMenu();
      });

    });

    document.addEventListener("click", (event) => {

      const clickedInsideMenu = mainNav.contains(event.target);
      const clickedToggle = menuToggle.contains(event.target);

      if (!clickedInsideMenu && !clickedToggle) {
        closeMenu();
      }

    });

    document.addEventListener("keydown", (event) => {

      if (event.key === "Escape") {
        closeMenu();
      }

    });

    window.addEventListener("resize", () => {

      if (window.innerWidth > 800) {
        closeMenu();
      }

    });

  }


  // ==========================================
  // 2. FOOTER YEAR
  // ==========================================

  const year = document.getElementById("year");

  if (year) {
    year.textContent = new Date().getFullYear();
  }


  // ==========================================
  // 3. LIGHT AND DARK THEME
  // ==========================================

  const themeToggle = document.getElementById("themeToggle");

  const themeIcon = themeToggle
    ? themeToggle.querySelector(".theme-icon")
    : null;

  const THEME_KEY = "hafhass-theme";

  let savedTheme = null;

  try {

    savedTheme = localStorage.getItem(THEME_KEY);

  } catch (error) {

    savedTheme = null;

  }

  const prefersDark = window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;


  function applyTheme(theme) {

    const selectedTheme = theme === "dark"
      ? "dark"
      : "light";

    document.documentElement.setAttribute(
      "data-theme",
      selectedTheme
    );

    const dark = selectedTheme === "dark";


    // UPDATE FONT AWESOME THEME ICON

    if (themeIcon) {

      const icon = themeIcon.querySelector("i");

      if (icon) {

        icon.className = dark
          ? "fa-solid fa-sun"
          : "fa-solid fa-moon";

      }

    }


    // UPDATE ACCESSIBILITY LABELS

    if (themeToggle) {

      const label = dark
        ? "Switch to light theme"
        : "Switch to dark theme";

      themeToggle.setAttribute("aria-label", label);
      themeToggle.setAttribute("title", label);

    }

  }


  const initialTheme =
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : (prefersDark ? "dark" : "light");

  applyTheme(initialTheme);


  if (themeToggle) {

    themeToggle.addEventListener("click", () => {

      const currentTheme =
        document.documentElement.getAttribute("data-theme") || "light";

      const nextTheme =
        currentTheme === "dark" ? "light" : "dark";

      applyTheme(nextTheme);

      try {

        localStorage.setItem(THEME_KEY, nextTheme);

      } catch (error) {

        // Theme still works if browser storage is unavailable.

      }

    });

  }


  // ==========================================
  // 4. FAQ ACCORDION
  // ==========================================

  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {

    item.addEventListener("toggle", () => {

      if (item.open) {

        faqItems.forEach((otherItem) => {

          if (otherItem !== item) {
            otherItem.removeAttribute("open");
          }

        });

      }

    });

  });


  // ==========================================
  // 5. FEATURED PRODUCTS
  // ==========================================

  async function loadFeaturedProducts() {

    const grid = document.getElementById("featuredProductsGrid");

    if (!grid) return;

    const supabase = window.hafhassSupabase;

    if (!supabase) {

      console.error(
        "HAFHASS: Supabase client is unavailable."
      );

      grid.textContent = "Featured products are currently unavailable.";

      return;

    }


    // ------------------------------------------
    // HELPER: FORMAT PRICE
    // ------------------------------------------

    function formatProductPrice(price, currency) {

      const amount = Number(price);

      if (!Number.isFinite(amount) || amount <= 0) {
        return "Contact us for pricing";
      }

      try {

        return new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: (currency || "NGN").trim(),
          maximumFractionDigits: 2
        }).format(amount);

      } catch (error) {

        return `${currency || "NGN"} ${amount.toLocaleString("en-NG")}`;

      }

    }


    // ------------------------------------------
    // HELPER: SAFE TEXT
    // ------------------------------------------

    function createTextElement(tag, className, value) {

      const element = document.createElement(tag);

      if (className) {
        element.className = className;
      }

      element.textContent = value || "";

      return element;

    }


    // ------------------------------------------
    // HELPER: WHATSAPP LINK
    // ------------------------------------------

    function createWhatsAppLink(productName, settings) {

      const rawNumber = settings?.whatsapp_number || "";

      const number = String(rawNumber).replace(/\D/g, "");

      const message = encodeURIComponent(
        `Hello HAFHASS EVENTS & DELIGHTS. I am interested in ${productName}. Please provide more information.`
      );

      const link = document.createElement("a");

      link.className = "text-link";
      link.textContent = "Enquire Now";

      if (number) {

        link.href = `https://wa.me/${number}?text=${message}`;

        link.target = "_blank";
        link.rel = "noopener noreferrer";

      } else {

        link.href = "#contact";

      }

      return link;

    }


    try {

      // ----------------------------------------
      // GET STORE SETTINGS
      // ----------------------------------------

      let storeSettings = null;

      const settingsController = window.HafhassStoreSettings;

      if (settingsController) {

        try {

          await settingsController.ready();

          storeSettings = await settingsController.get();

        } catch (settingsError) {

          console.warn(
            "HAFHASS: Could not retrieve store settings for product enquiries.",
            settingsError
          );

        }

      }


      // ----------------------------------------
      // FETCH FEATURED PRODUCTS
      // ----------------------------------------

      const { data: products, error: productsError } =
        await supabase
          .from("products")
          .select(`
            id,
            name,
            short_description,
            description,
            price,
            currency,
            pricing_type,
            display_order
          `)
          .eq("is_featured", true)
          .eq("status", "active")
          .order("display_order", {
            ascending: true,
            nullsFirst: false
          })
          .limit(4);


      if (productsError) {
        throw productsError;
      }


      // ----------------------------------------
      // HANDLE EMPTY RESULTS
      // ----------------------------------------

      if (!products || products.length === 0) {

        grid.replaceChildren();

        grid.appendChild(
          createTextElement(
            "p",
            "featured-empty",
            "Our featured creations will appear here soon. Please check back later."
          )
        );

        return;

      }


      // ----------------------------------------
      // FETCH PRIMARY PRODUCT IMAGES
      // ----------------------------------------

      const productIds = products.map((product) => product.id);

      const { data: images, error: imagesError } =
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
          .eq("is_primary", true)
          .order("display_order", {
            ascending: true
          });


      if (imagesError) {
        throw imagesError;
      }


      // ----------------------------------------
      // ORGANISE PRODUCT IMAGES
      // ----------------------------------------

      const imageMap = new Map();

      (images || []).forEach((image) => {

        if (!imageMap.has(image.product_id)) {

          imageMap.set(image.product_id, image);

        }

      });


      // ----------------------------------------
      // CREATE PRODUCT CARDS
      // ----------------------------------------

      const fragment = document.createDocumentFragment();

      products.forEach((product) => {

        const card = document.createElement("article");

        card.className = "featured-card";


        // PRODUCT IMAGE

        const imageContainer = document.createElement("div");

        imageContainer.className = "featured-image";

        const productImage = imageMap.get(product.id);

        if (productImage?.image_url) {

          const image = document.createElement("img");

          image.src = productImage.image_url;

          image.alt =
            productImage.alt_text || product.name;

          image.loading = "lazy";

          image.decoding = "async";

          imageContainer.appendChild(image);

        } else {

          imageContainer.appendChild(
            createTextElement(
              "span",
              "featured-image-placeholder",
              "HAFHASS"
            )
          );

        }


        // PRODUCT CONTENT

        const content = document.createElement("div");

        content.className = "featured-content";


        // PRODUCT LABEL

        content.appendChild(
          createTextElement(
            "span",
            "product-category",
            "FEATURED"
          )
        );


        // PRODUCT NAME

        content.appendChild(
          createTextElement(
            "h3",
            "",
            product.name
          )
        );


        // PRODUCT DESCRIPTION

        const description =
          product.short_description ||
          product.description ||
          "Discover this beautiful creation from HAFHASS.";

        content.appendChild(
          createTextElement(
            "p",
            "",
            description
          )
        );


        // PRODUCT PRICE

        const priceText =
          product.pricing_type === "fixed" && product.price !== null
            ? formatProductPrice(product.price, product.currency)
            : "Request a quote";

        content.appendChild(
          createTextElement(
            "p",
            "featured-price",
            priceText
          )
        );


        // WHATSAPP ENQUIRY

        content.appendChild(
          createWhatsAppLink(
            product.name,
            storeSettings
          )
        );


        card.appendChild(imageContainer);

        card.appendChild(content);

        fragment.appendChild(card);

      });


      // DISPLAY PRODUCTS

      grid.replaceChildren(fragment);


    } catch (error) {

      console.error(
        "HAFHASS: Could not load featured products.",
        error
      );

      grid.replaceChildren();

      grid.appendChild(
        createTextElement(
          "p",
          "featured-error",
          "We could not load our featured products right now. Please try again later."
        )
      );

    }

  }


  // Load homepage featured products

  loadFeaturedProducts();


  // ==========================================
  // 6. FEATURED SERVICES
  // ==========================================

  async function loadFeaturedServices() {

    const grid = document.getElementById("featuredServicesGrid");

    if (!grid) return;

    const supabase = window.hafhassSupabase;

    if (!supabase) {

      console.error(
        "HAFHASS: Supabase client is unavailable for services."
      );

      grid.textContent =
        "Our services are currently unavailable.";

      return;

    }


    // ------------------------------------------
    // HELPER: CREATE SAFE TEXT ELEMENT
    // ------------------------------------------

    function createServiceText(tag, className, value) {

      const element = document.createElement(tag);

      if (className) {
        element.className = className;
      }

      element.textContent = value || "";

      return element;

    }


    // ------------------------------------------
    // HELPER: FORMAT SERVICE PRICE
    // ------------------------------------------

    function formatServicePrice(price, currency) {

      const amount = Number(price);

      if (!Number.isFinite(amount) || amount <= 0) {
        return "Request a quote";
      }

      try {

        return new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: (currency || "NGN").trim(),
          maximumFractionDigits: 2
        }).format(amount);

      } catch (error) {

        return `${currency || "NGN"} ${amount.toLocaleString("en-NG")}`;

      }

    }


    // ------------------------------------------
    // HELPER: DETERMINE PRICING DISPLAY
    // ------------------------------------------

    function getServicePricing(service) {

      const pricingType = service.pricing_type;

      if (pricingType === "fixed") {

        return formatServicePrice(
          service.price,
          service.currency
        );

      }

      if (pricingType === "starting_from") {

        const price = formatServicePrice(
          service.price,
          service.currency
        );

        if (price === "Request a quote") {
          return price;
        }

        return `From ${price}`;

      }

      return "Request a Quote";

    }


    // ------------------------------------------
    // HELPER: CREATE SERVICE ENQUIRY LINK
    // ------------------------------------------

    function createServiceEnquiryLink(service, settings) {

      const rawNumber = settings?.whatsapp_number || "";

      const number = String(rawNumber).replace(/\D/g, "");

      const message = encodeURIComponent(
        `Hello HAFHASS EVENTS & DELIGHTS. I am interested in your ${service.name} service. I would like to discuss my requirements.`
      );

      const link = document.createElement("a");

      link.className = "text-link";
      link.textContent = "Discuss This Service";

      if (number) {

        link.href = `https://wa.me/${number}?text=${message}`;

        link.target = "_blank";

        link.rel = "noopener noreferrer";

      } else {

        link.href = "#contact";

      }

      return link;

    }


    try {

      // ----------------------------------------
      // GET STORE SETTINGS
      // ----------------------------------------

      let storeSettings = null;

      const settingsController = window.HafhassStoreSettings;

      if (settingsController) {

        try {

          await settingsController.ready();

          storeSettings = await settingsController.get();

        } catch (settingsError) {

          console.warn(
            "HAFHASS: Could not retrieve store settings for service enquiries.",
            settingsError
          );

        }

      }


      // ----------------------------------------
      // FETCH ACTIVE FEATURED SERVICES
      // ----------------------------------------

      const { data: services, error: servicesError } =
        await supabase
          .from("services")
          .select(`
            id,
            name,
            slug,
            description,
            image_url,
            pricing_type,
            price,
            currency,
            display_order
          `)
          .eq("is_active", true)
          .eq("is_featured", true)
          .order("display_order", {
            ascending: true,
            nullsFirst: false
          })
          .limit(3);


      if (servicesError) {
        throw servicesError;
      }


      // ----------------------------------------
      // HANDLE EMPTY RESULTS
      // ----------------------------------------

      if (!services || services.length === 0) {

        grid.replaceChildren();

        grid.appendChild(
          createServiceText(
            "p",
            "services-empty",
            "Our featured services will appear here soon. Please check back later."
          )
        );

        return;

      }


      // ----------------------------------------
      // CREATE SERVICE CARDS
      // ----------------------------------------

      const fragment = document.createDocumentFragment();

      services.forEach((service) => {

        const card = document.createElement("article");

        card.className = "service-card";


        // --------------------------------------
        // SERVICE IMAGE
        // --------------------------------------

        const imageContainer = document.createElement("div");

        imageContainer.className = "service-image";

        if (service.image_url) {

          const image = document.createElement("img");

          image.src = service.image_url;

          image.alt = service.name || "HAFHASS service";

          image.loading = "lazy";

          image.decoding = "async";


          // Hide broken images gracefully.

          image.addEventListener("error", () => {

            image.remove();

            imageContainer.appendChild(
              createServiceText(
                "span",
                "service-image-placeholder",
                "HAFHASS"
              )
            );

          }, {
            once: true
          });


          imageContainer.appendChild(image);

        } else {

          imageContainer.appendChild(
            createServiceText(
              "span",
              "service-image-placeholder",
              "HAFHASS"
            )
          );

        }


        // --------------------------------------
        // SERVICE CONTENT
        // --------------------------------------

        const content = document.createElement("div");

        content.className = "service-content";


        // SERVICE LABEL

        content.appendChild(
          createServiceText(
            "span",
            "service-label",
            "OUR SERVICES"
          )
        );


        // SERVICE NAME

        content.appendChild(
          createServiceText(
            "h3",
            "service-name",
            service.name
          )
        );


        // SERVICE DESCRIPTION

        content.appendChild(
          createServiceText(
            "p",
            "service-description",
            service.description ||
            "Discover how we can bring your ideas to life."
          )
        );


        // SERVICE PRICING

        content.appendChild(
          createServiceText(
            "p",
            "service-price",
            getServicePricing(service)
          )
        );


        // SERVICE ENQUIRY LINK

        content.appendChild(
          createServiceEnquiryLink(
            service,
            storeSettings
          )
        );


        // --------------------------------------
        // ASSEMBLE CARD
        // --------------------------------------

        card.appendChild(imageContainer);

        card.appendChild(content);

        fragment.appendChild(card);

      });


      // ----------------------------------------
      // DISPLAY SERVICES
      // ----------------------------------------

      grid.replaceChildren(fragment);


    } catch (error) {

      console.error(
        "HAFHASS: Could not load featured services.",
        error
      );

      grid.replaceChildren();

      grid.appendChild(
        createServiceText(
          "p",
          "services-error",
          "We could not load our services right now. Please try again later."
        )
      );

    }

  }


  // Load homepage featured services

  loadFeaturedServices();


  // ==========================================
  // 7. DYNAMIC CATEGORY IMAGES
  // ==========================================

  async function loadCategoryImages() {

    const supabase = window.hafhassSupabase;

    if (!supabase) return;

    const categoryCards = Array.from(
      document.querySelectorAll(".category-grid .category-card")
    );


    // ------------------------------------------
    // GET CATEGORY SLUGS FROM EXISTING LINKS
    // ------------------------------------------

    const categoryTargets = categoryCards
      .map(card => {

        const image = card.querySelector(".category-image img");

        if (!image) return null;

        try {

          const url = new URL(card.href, window.location.href);

          const slug = url.searchParams.get("category");

          if (!slug) return null;

          return {
            card,
            image,
            slug
          };

        } catch (error) {

          return null;

        }

      })
      .filter(Boolean);


    if (categoryTargets.length === 0) return;


    try {

      // ----------------------------------------
      // FETCH ALL ACTIVE CATEGORIES
      // ----------------------------------------

      const { data: categories, error: categoryError } =
        await supabase
          .from("categories")
          .select("id, name, slug, parent_id")
          .eq("is_active", true);


      if (categoryError) throw categoryError;

      if (!categories || categories.length === 0) return;


      // ----------------------------------------
      // MAP HOMEPAGE COLLECTIONS TO CATEGORIES
      // ----------------------------------------

      const collectionMap = new Map();

      const categoryToCollection = new Map();

      categoryTargets.forEach(target => {

        // Find the main category by its slug.

        const mainCategory = categories.find(category =>
          category.slug === target.slug &&
          !category.parent_id
        );

        if (!mainCategory) return;


        // Find its active subcategories.

        const subcategories = categories.filter(category =>
          category.parent_id === mainCategory.id
        );


        // Include the main category itself as well.

        const categoryIds = [
          mainCategory.id,
          ...subcategories.map(category => category.id)
        ];


        collectionMap.set(target.slug, {
          target,
          mainCategory,
          categoryIds
        });


        // Connect every category to its homepage collection.

        categoryIds.forEach(categoryId => {

          categoryToCollection.set(
            categoryId,
            target.slug
          );

        });

      });


      if (collectionMap.size === 0) return;


      // ----------------------------------------
      // FETCH ACTIVE PRODUCTS
      // ----------------------------------------

      const allCategoryIds = [
        ...new Set(categoryToCollection.keys())
      ];

      const { data: products, error: productsError } =
        await supabase
          .from("products")
          .select("id, category_id, name")
          .eq("status", "active")
          .in("category_id", allCategoryIds);


      if (productsError) throw productsError;

      if (!products || products.length === 0) return;


      // ----------------------------------------
      // FETCH PRODUCT IMAGES
      // ----------------------------------------

      const productIds = products.map(product => product.id);

      const { data: images, error: imagesError } =
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
          .order("display_order", {
            ascending: true
          });


      if (imagesError) throw imagesError;


      // ----------------------------------------
      // ORGANISE IMAGES BY PRODUCT
      // ----------------------------------------

      const productImageMap = new Map();

      (images || []).forEach(image => {

        if (!image.image_url) return;

        if (!productImageMap.has(image.product_id)) {

          productImageMap.set(image.product_id, []);

        }

        productImageMap.get(image.product_id).push(image);

      });


      // ----------------------------------------
      // ORGANISE PRODUCTS BY MAIN CATEGORY
      // ----------------------------------------

      const collectionProductMap = new Map();


      products.forEach(product => {

        const productImages = productImageMap.get(product.id);

        if (!productImages || productImages.length === 0) return;


        // Determine which homepage collection owns this product.

        const collectionSlug = categoryToCollection.get(
          product.category_id
        );

        if (!collectionSlug) return;


        // Prefer the primary product image.

        const primaryImage =
          productImages.find(image => image.is_primary) ||
          productImages[0];


        if (!collectionProductMap.has(collectionSlug)) {

          collectionProductMap.set(collectionSlug, []);

        }


        collectionProductMap.get(collectionSlug).push({

          product_id: product.id,

          product_name: product.name,

          image_url: primaryImage.image_url,

          alt_text: primaryImage.alt_text

        });

      });


      // ----------------------------------------
      // RANDOM IMAGE SELECTION
      // ----------------------------------------

      function getRandomProduct(products, currentProductId = null) {

        let available = products.filter(product =>
          product.product_id !== currentProductId
        );

        if (available.length === 0) {
          available = products;
        }

        return available[
          Math.floor(Math.random() * available.length)
        ];

      }


      // ----------------------------------------
      // DISPLAY CATEGORY IMAGE
      // ----------------------------------------

      function displayCategoryImage(imageElement, product, animate = true) {

        const preload = new Image();

        preload.onload = () => {

          if (!imageElement.isConnected) return;

          if (!animate) {

            imageElement.src = product.image_url;

            imageElement.alt =
              product.alt_text || product.product_name;

            return;

          }

          imageElement.style.transition = "opacity 450ms ease";

          imageElement.style.opacity = "0";

          setTimeout(() => {

            if (!imageElement.isConnected) return;

            imageElement.src = product.image_url;

            imageElement.alt =
              product.alt_text || product.product_name;

            imageElement.style.opacity = "1";

          }, 250);

        };


        preload.onerror = () => {

          console.warn(
            "HAFHASS: Could not load category product image.",
            product.image_url
          );

        };


        preload.src = product.image_url;

      }


      // ----------------------------------------
      // INITIALISE EACH CATEGORY COLLECTION
      // ----------------------------------------

      categoryTargets.forEach(target => {

        const availableProducts =
          collectionProductMap.get(target.slug);


        if (!availableProducts || availableProducts.length === 0) {

          console.info(
            `HAFHASS: No products with images found for ${target.slug}.`
          );

          return;

        }


        const state = {
          currentProductId: null
        };


        // Display the first random product image.

        const firstProduct = getRandomProduct(availableProducts);

        displayCategoryImage(
          target.image,
          firstProduct,
          false
        );

        state.currentProductId = firstProduct.product_id;


        // No rotation needed if only one product exists.

        if (availableProducts.length < 2) return;


        // --------------------------------------
        // AUTOMATIC IMAGE ROTATION
        // --------------------------------------

        setInterval(() => {

          const nextProduct = getRandomProduct(
            availableProducts,
            state.currentProductId
          );

          displayCategoryImage(
            target.image,
            nextProduct
          );

          state.currentProductId = nextProduct.product_id;

        }, 8000);

      });


    } catch (error) {

      console.error(
        "HAFHASS: Could not load dynamic category images.",
        error
      );

    }

  }


  // Load dynamic category images

  loadCategoryImages();


  // ==========================================
  // 8. DYNAMIC HOMEPAGE GALLERY
  // ==========================================

  async function loadGalleryImages() {

    const supabase = window.hafhassSupabase;

    if (!supabase) return;

    const galleryImages = Array.from(
      document.querySelectorAll(".gallery-grid .gallery-item img")
    );

    if (galleryImages.length === 0) return;


    try {

      // ----------------------------------------
      // FETCH ACTIVE PRODUCTS
      // ----------------------------------------

      const { data: products, error: productsError } =
        await supabase
          .from("products")
          .select("id, name")
          .eq("status", "active");


      if (productsError) throw productsError;

      if (!products || products.length === 0) return;


      // ----------------------------------------
      // FETCH ALL PRODUCT IMAGES
      // ----------------------------------------

      const productIds = products.map(product => product.id);

      const { data: images, error: imagesError } =
        await supabase
          .from("product_images")
          .select(`
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


      if (imagesError) throw imagesError;


      // ----------------------------------------
      // PREPARE GALLERY IMAGES
      // ----------------------------------------

      const productMap = new Map(
        products.map(product => [
          product.id,
          product.name
        ])
      );

      const availableImages = [];
      const usedUrls = new Set();

      (images || []).forEach(image => {

        if (!image.image_url) return;

        // Avoid displaying the same image twice.

        if (usedUrls.has(image.image_url)) return;

        usedUrls.add(image.image_url);

        availableImages.push({

          image_url: image.image_url,

          alt_text:
            image.alt_text ||
            productMap.get(image.product_id) ||
            "HAFHASS creation"

        });

      });


      if (availableImages.length === 0) return;


      // ----------------------------------------
      // RANDOMLY SHUFFLE IMAGES
      // ----------------------------------------

      for (let i = availableImages.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [
          availableImages[i],
          availableImages[j]
        ] = [
          availableImages[j],
          availableImages[i]
        ];

      }


      // ----------------------------------------
      // DISPLAY GALLERY IMAGES
      // ----------------------------------------

      const selectedImages = availableImages.slice(
        0,
        galleryImages.length
      );


      selectedImages.forEach((productImage, index) => {

        const imageElement = galleryImages[index];

        const preload = new Image();

        preload.onload = () => {

          if (!imageElement.isConnected) return;

          imageElement.src = productImage.image_url;

          imageElement.alt = productImage.alt_text;

        };

        preload.onerror = () => {

          console.warn(
            "HAFHASS: Could not load gallery image.",
            productImage.image_url
          );

        };

        preload.src = productImage.image_url;

      });


    } catch (error) {

      console.error(
        "HAFHASS: Could not load dynamic gallery images.",
        error
      );

    }

  }


  // Load homepage gallery images

  loadGalleryImages();


  // ==========================================
  // 9. AUTHENTICATION AND ACCOUNT NAVIGATION
  // ==========================================

  const auth = window.HafhassAuth;

  const authNavLink =
    document.getElementById("authNavLink");

  const customerCareLink =
    document.querySelector('a[href="#account"]');

  const cartLink =
    document.querySelector(".cart-link");

  const cartCount =
    document.getElementById("cartCount");


  // Set the initial cart destination

  if (cartLink) {
    cartLink.href = "account/cart.html";
  }


  // Update customer navigation

  function updateCustomerNavigation(isLoggedIn) {

    if (authNavLink) {

      if (isLoggedIn) {

        authNavLink.textContent = "My Account";
        authNavLink.href = "account/dashboard.html";

      } else {

        authNavLink.textContent = "Sign In";
        authNavLink.href = "login.html";

      }

    }


    if (customerCareLink) {

      customerCareLink.href = isLoggedIn
        ? "account/dashboard.html"
        : "login.html";

    }

  }


  // Update shopping bag count

  function updateCartCount(count) {

    if (!cartCount) return;

    const safeCount = Number.isFinite(count)
      ? Math.max(0, count)
      : 0;

    cartCount.textContent = safeCount;

    if (cartLink) {

      cartLink.setAttribute(
        "aria-label",
        `Shopping bag with ${safeCount} items`
      );

    }

  }


  // Load the customer's active cart

  async function loadCustomerCart(userId) {

    const supabase = window.hafhassSupabase;

    if (!supabase || !userId) {

      updateCartCount(0);
      return;

    }

    try {

      // Find the customer's active cart

      const { data: carts, error: cartError } =
        await supabase
          .from("carts")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", {
            ascending: false
          })
          .limit(1);

      if (cartError) {
        throw cartError;
      }


      // No active cart

      if (!carts || carts.length === 0) {

        updateCartCount(0);
        return;

      }


      // Retrieve quantities of cart items

      const { data: items, error: itemsError } =
        await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", carts[0].id);

      if (itemsError) {
        throw itemsError;
      }


      // Calculate total quantity

      const totalQuantity = (items || []).reduce(
        (total, item) => {
          return total + Number(item.quantity || 0);
        },
        0
      );

      updateCartCount(totalQuantity);

    } catch (error) {

      console.error(
        "HAFHASS: Could not load cart count.",
        error
      );

      updateCartCount(0);

    }

  }


  // Handle authentication status

  async function refreshCustomerState() {

    if (!auth) {

      updateCustomerNavigation(false);
      updateCartCount(0);

      console.warn(
        "HAFHASS: Authentication controller is unavailable."
      );

      return;

    }

    try {

      const result = await auth.getSession();

      if (!result || result.success !== true) {
        throw new Error(
          result?.message || "Could not retrieve customer session."
        );
      }

      const session = result.session;
      const user = session?.user || null;

      if (!user) {

        updateCustomerNavigation(false);
        updateCartCount(0);

        return;

      }

      updateCustomerNavigation(true);

      await loadCustomerCart(user.id);

    } catch (error) {

      console.error(
        "HAFHASS: Could not check authentication.",
        error
      );

      updateCustomerNavigation(false);
      updateCartCount(0);

    }

  }


  // Initial authentication check

  refreshCustomerState();


  // Listen for login and logout events

  if (auth && typeof auth.onAuthStateChange === "function") {

    auth.onAuthStateChange(({ event, session }) => {

      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {

        if (session?.user) {

          updateCustomerNavigation(true);
          loadCustomerCart(session.user.id);

        } else {

          updateCustomerNavigation(false);
          updateCartCount(0);

        }

      }

    });

  }


  // ==========================================
  // 10. LISTEN FOR CART UPDATES
  // ==========================================

  window.addEventListener(
    "hafhass:cart-updated",
    () => {
      refreshCustomerState();
    }
  );


});