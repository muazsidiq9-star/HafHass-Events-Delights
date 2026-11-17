/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   PUBLIC SERVICES PAGE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";


  // =======================================================
  // 1. INITIAL SETUP
  // =======================================================

  const supabase = window.hafhassSupabase;

  const servicesGrid = document.getElementById("servicesGrid");

  if (!servicesGrid) return;


  // =======================================================
  // 2. SAFE TEXT ELEMENT CREATION
  // =======================================================

  function createTextElement(tag, className, value) {

    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    element.textContent = value || "";

    return element;

  }


  // =======================================================
  // 3. PRICE FORMATTING
  // =======================================================

  function formatServicePrice(price, currency) {

    const amount = Number(price);

    if (
      price === null ||
      price === undefined ||
      price === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {

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


  // =======================================================
  // 4. SERVICE PRICING DISPLAY
  // =======================================================

  function getServicePricing(service) {

    const pricingType = service.pricing_type;


    // FIXED PRICE

    if (pricingType === "fixed") {

      return formatServicePrice(
        service.price,
        service.currency
      );

    }


    // STARTING FROM

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


    // CUSTOM QUOTATION

    return "Request a Quote";

  }


  // =======================================================
  // 5. WHATSAPP ENQUIRY LINK
  // =======================================================

  function createServiceEnquiryLink(service, settings) {

    const rawNumber = settings?.whatsapp_number || "";

    const number = String(rawNumber).replace(/\D/g, "");


    const message = encodeURIComponent(

      `Hello HAFHASS EVENTS & DELIGHTS. ` +
      `I am interested in your ${service.name} service. ` +
      `I would like to discuss my requirements.`

    );


    const link = document.createElement("a");

    link.className = "text-link";

    link.textContent = "Discuss This Service";


    if (number) {

      link.href = `https://wa.me/${number}?text=${message}`;

      link.target = "_blank";

      link.rel = "noopener noreferrer";

    } else {

      link.href = "index.html#contact";

    }


    return link;

  }


  // =======================================================
  // 6. SERVICE IMAGE
  // =======================================================

  function createServiceImage(service) {

    const container = document.createElement("div");

    container.className = "service-image";


    if (service.image_url) {

      const image = document.createElement("img");

      image.src = service.image_url;

      image.alt = service.name || "HAFHASS service";

      image.loading = "lazy";

      image.decoding = "async";


      // HANDLE BROKEN IMAGES

      image.addEventListener("error", () => {

        image.remove();

        container.appendChild(

          createTextElement(
            "span",
            "service-image-placeholder",
            "HAFHASS"
          )

        );

      }, {
        once: true
      });


      container.appendChild(image);

    } else {

      container.appendChild(

        createTextElement(
          "span",
          "service-image-placeholder",
          "HAFHASS"
        )

      );

    }


    return container;

  }


  // =======================================================
  // 7. CREATE SERVICE CARD
  // =======================================================

  function createServiceCard(service, settings) {

    const card = document.createElement("article");

    card.className = "service-card";


    // -----------------------------------------------
    // SERVICE IMAGE
    // -----------------------------------------------

    const imageContainer = createServiceImage(service);


    // -----------------------------------------------
    // SERVICE CONTENT
    // -----------------------------------------------

    const content = document.createElement("div");

    content.className = "service-content";


    // -----------------------------------------------
    // SERVICE LABEL
    // -----------------------------------------------

    const label = service.is_featured
      ? "FEATURED SERVICE"
      : "OUR SERVICES";

    content.appendChild(

      createTextElement(
        "span",
        "service-label",
        label
      )

    );


    // -----------------------------------------------
    // SERVICE NAME
    // -----------------------------------------------

    content.appendChild(

      createTextElement(
        "h3",
        "service-name",
        service.name
      )

    );


    // -----------------------------------------------
    // SERVICE DESCRIPTION
    // -----------------------------------------------

    content.appendChild(

      createTextElement(
        "p",
        "service-description",
        service.description ||
        "Discover how we can bring your ideas to life."
      )

    );


    // -----------------------------------------------
    // SERVICE PRICE
    // -----------------------------------------------

    content.appendChild(

      createTextElement(
        "p",
        "service-price",
        getServicePricing(service)
      )

    );


    // -----------------------------------------------
    // SERVICE ENQUIRY BUTTON
    // -----------------------------------------------

    content.appendChild(

      createServiceEnquiryLink(
        service,
        settings
      )

    );


    // -----------------------------------------------
    // ASSEMBLE CARD
    // -----------------------------------------------

    card.appendChild(imageContainer);

    card.appendChild(content);


    return card;

  }


  // =======================================================
  // 8. DISPLAY EMPTY STATE
  // =======================================================

  function displayEmptyState() {

    servicesGrid.replaceChildren();

    servicesGrid.appendChild(

      createTextElement(
        "p",
        "services-empty",
        "We are currently updating our services. Please check back soon."
      )

    );

    servicesGrid.setAttribute("aria-busy", "false");

  }


  // =======================================================
  // 9. DISPLAY ERROR STATE
  // =======================================================

  function displayErrorState() {

    servicesGrid.replaceChildren();

    servicesGrid.appendChild(

      createTextElement(
        "p",
        "services-error",
        "We could not load our services right now. Please try again later."
      )

    );

    servicesGrid.setAttribute("aria-busy", "false");

  }


  // =======================================================
  // 10. LOAD ALL ACTIVE SERVICES
  // =======================================================

  async function loadServices() {

    if (!supabase) {

      console.error(
        "HAFHASS: Supabase client is unavailable."
      );

      displayErrorState();

      return;

    }


    try {

      // -----------------------------------------------
      // GET STORE SETTINGS
      // -----------------------------------------------

      let storeSettings = null;

      const settingsController =
        window.HafhassStoreSettings;


      if (settingsController) {

        try {

          await settingsController.ready();

          storeSettings = await settingsController.get();

        } catch (settingsError) {

          console.warn(
            "HAFHASS: Could not retrieve store settings.",
            settingsError
          );

        }

      }


      // -----------------------------------------------
      // FETCH ALL ACTIVE SERVICES
      // -----------------------------------------------

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
            is_featured,
            display_order
          `)

          .eq("is_active", true)

          .order("is_featured", {
            ascending: false
          })

          .order("display_order", {
            ascending: true,
            nullsFirst: false
          });


      if (servicesError) {
        throw servicesError;
      }


      // -----------------------------------------------
      // HANDLE EMPTY RESULTS
      // -----------------------------------------------

      if (!services || services.length === 0) {

        displayEmptyState();

        return;

      }


      // -----------------------------------------------
      // CREATE SERVICE CARDS
      // -----------------------------------------------

      const fragment = document.createDocumentFragment();


      services.forEach((service) => {

        const card = createServiceCard(
          service,
          storeSettings
        );

        fragment.appendChild(card);

      });


      // -----------------------------------------------
      // DISPLAY SERVICES
      // -----------------------------------------------

      servicesGrid.replaceChildren(fragment);

      servicesGrid.setAttribute("aria-busy", "false");


      console.info(
        `HAFHASS: Successfully loaded ${services.length} active services.`
      );


    } catch (error) {

      console.error(
        "HAFHASS: Could not load public services.",
        error
      );

      displayErrorState();

    }

  }


  // =======================================================
  // 11. INITIALISE SERVICES PAGE
  // =======================================================

  loadServices();


});