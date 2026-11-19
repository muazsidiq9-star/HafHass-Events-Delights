/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN STORE SETTINGS MANAGEMENT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";


  /* =====================================================
     1. SUPABASE
  ====================================================== */

  const supabase = window.hafhassSupabase;

  if (!supabase) {
    console.error("Supabase client is not available.");
    return;
  }


  /* =====================================================
     2. CONFIGURATION
  ====================================================== */

  const SETTINGS_TABLE = "business_settings";
  const SETTINGS_ID = 1;

  let currentSettings = null;
  let currentUserId = null;


  /* =====================================================
     3. HELPERS
  ====================================================== */

  const getElement = (id) => {
    return document.getElementById(id);
  };


  function getValue(id) {

    const element = getElement(id);

    return element
      ? element.value.trim()
      : "";
  }


  function setValue(id, value) {

    const element = getElement(id);

    if (element) {
      element.value = value ?? "";
    }
  }


  function setChecked(id, value) {

    const element = getElement(id);

    if (element) {
      element.checked = Boolean(value);
    }
  }


  function setMessage(id, message, type = "success") {

    const element = getElement(id);

    if (!element) return;

    clearTimeout(element._messageTimeout);

    element.textContent = message;

    element.classList.add("settings-message");
    element.classList.remove("success", "error");
    element.classList.add(type);

    element.style.display = "block";
    element.hidden = false;

    element._messageTimeout = setTimeout(() => {
      element.style.display = "none";
    }, 6000);
  }


  function clearMessage(id) {

    const element = getElement(id);

    if (!element) return;

    clearTimeout(element._messageTimeout);

    element.textContent = "";

    element.classList.remove(
      "success",
      "error"
    );

    element.style.display = "none";
  }


  function getErrorMessage(error) {

    if (!error) {
      return "An unknown error occurred.";
    }

    if (typeof error === "string") {
      return error;
    }

    return (
      error.message ||
      error.details ||
      error.hint ||
      "An unexpected error occurred."
    );
  }


  function setButtonLoading(button, loading, originalHTML) {

    if (!button) return;

    if (loading) {

      button.disabled = true;

      button.dataset.originalHTML = button.innerHTML;

      button.innerHTML = `
        <i class="fa-solid fa-spinner fa-spin"></i>
        <span>Saving...</span>
      `;

    } else {

      button.disabled = false;

      button.innerHTML =
        originalHTML ||
        button.dataset.originalHTML ||
        button.innerHTML;

      delete button.dataset.originalHTML;
    }
  }


  function normalizeUrl(value) {

    if (!value) return null;

    const trimmed = value.trim();

    if (!trimmed) return null;

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return `https://${trimmed}`;
  }


  function isValidUrl(value) {

    if (!value) return true;

    try {

      const normalized = normalizeUrl(value);

      const url = new URL(normalized);

      return (
        url.protocol === "https:" ||
        url.protocol === "http:"
      );

    } catch {

      return false;
    }
  }


  function formatNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }


  function validateNumber(value, label, allowZero = true) {

    if (value === "") {
      return `${label} is required.`;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return `${label} must be a valid number.`;
    }

    if (allowZero && number < 0) {
      return `${label} cannot be negative.`;
    }

    if (!allowZero && number <= 0) {
      return `${label} must be greater than zero.`;
    }

    return null;
  }


  function getFormButton(form) {

    return form.querySelector(
      'button[type="submit"]'
    );
  }


  /* =====================================================
     4. AUTHENTICATED ADMIN
  ====================================================== */

  async function getCurrentUser() {

    const {
      data,
      error
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    if (!data || !data.user) {

      throw new Error(
        "You must be logged in to manage store settings."
      );
    }

    currentUserId = data.user.id;

    return data.user;
  }


  /* =====================================================
     5. LOAD BUSINESS SETTINGS
  ====================================================== */

  async function loadSettings() {

    try {

      const {
        data,
        error
      } = await supabase
        .from(SETTINGS_TABLE)
        .select("*")
        .eq("id", SETTINGS_ID)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {

        throw new Error(
          "Business settings record was not found."
        );
      }

      currentSettings = data;

      populateAllSettings(data);

      console.log(
        "Business settings loaded successfully."
      );

    } catch (error) {

      console.error(
        "Settings loading failed:",
        error
      );

      alert(
        "Unable to load business settings.\n\n" +
        getErrorMessage(error)
      );
    }
  }


  /* =====================================================
     6. POPULATE ALL SETTINGS
  ====================================================== */

  function populateAllSettings(settings) {

    populateBusinessInformation(settings);

    populateBusinessAddress(settings);

    populateBranding(settings);

    populateGeneralPreferences(settings);

    populateDeliveryPickup(settings);

    populateOpeningHours(settings);

    populateBankTransfer(settings);

    populateSocialMedia(settings);

    populateAnnouncement(settings);

    populateLegalInformation(settings);
  }


  /* =====================================================
     7. BUSINESS INFORMATION
  ====================================================== */

  function populateBusinessInformation(settings) {

    setValue(
      "businessName",
      settings.business_name
    );

    // NEW: Business Subtitle
    setValue(
      "businessSubtitle",
      settings.business_subtitle
    );

    setValue(
      "businessTagline",
      settings.tagline
    );

    setValue(
      "businessOwnerName",
      settings.owner_name
    );

    setValue(
      "businessDescription",
      settings.business_description
    );
  }


  async function saveBusinessInformation(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("businessInformationMessage");

    const businessName = getValue("businessName");

    if (!businessName) {

      setMessage(
        "businessInformationMessage",
        "Business name is required.",
        "error"
      );

      return;
    }

    const payload = {

      business_name: businessName,

      // NEW: Save Business Subtitle
      business_subtitle:
        getValue("businessSubtitle") || null,

      tagline:
        getValue("businessTagline") || null,

      owner_name:
        getValue("businessOwnerName") || null,

      business_description:
        getValue("businessDescription") || null
    };

    await saveSection({

      payload,
      button,

      messageId: "businessInformationMessage",

      successMessage:
        "Business information saved successfully."
    });
  }


  /* =====================================================
     8. BUSINESS ADDRESS & CONTACT
  ====================================================== */

  function populateBusinessAddress(settings) {

    setValue(
      "businessPhone",
      settings.phone
    );

    setValue(
      "businessWhatsapp",
      settings.whatsapp_number
    );

    setValue(
      "businessEmail",
      settings.email
    );

    setValue(
      "businessAddressInput",
      settings.address
    );

    setValue(
      "businessCity",
      settings.city
    );

    setValue(
      "businessState",
      settings.state
    );

    setValue(
      "businessCountry",
      settings.country
    );
  }


  async function saveBusinessAddress(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("businessAddressMessage");

    const email = getValue("businessEmail");

    if (
      email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {

      setMessage(
        "businessAddressMessage",
        "Please enter a valid email address.",
        "error"
      );

      return;
    }

    const payload = {

      phone:
        getValue("businessPhone") || null,

      whatsapp_number:
        getValue("businessWhatsapp") || null,

      email:
        email || null,

      address:
        getValue("businessAddressInput") || null,

      city:
        getValue("businessCity") || null,

      state:
        getValue("businessState") || null,

      country:
        getValue("businessCountry") || null
    };

    await saveSection({

      payload,
      button,

      messageId: "businessAddressMessage",

      successMessage:
        "Address and contact details saved successfully."
    });
  }


  /* =====================================================
     9. BRANDING
  ====================================================== */

  function populateBranding(settings) {

    setValue(
      "businessLogoUrl",
      settings.logo_url
    );

    setValue(
      "businessFaviconUrl",
      settings.favicon_url
    );

    setColorValue(
      "brandPrimaryColor",
      settings.brand_primary_color
    );

    setColorValue(
      "brandSecondaryColor",
      settings.brand_secondary_color
    );

    setColorValue(
      "brandAccentColor",
      settings.brand_accent_color
    );

    updateLogoPreview();
    populateStoreImageSettings(settings);
  }


  const STORE_IMAGE_FIELDS = [
    ["home_hero_image_url", "Homepage Hero", "Large landscape image behind the homepage headline."],
    ["shop_hero_image_url", "Shop Hero", "Hero image at the top of the Shop page."],
    ["services_hero_image_url", "Services Hero", "Hero image at the top of the Services page."],
    ["gallery_hero_image_url", "Gallery Hero", "Hero image at the top of the Gallery page."],
    ["founder_hero_image_url", "Founder Hero", "Hero image at the top of the Founder page."],
    ["about_section_image_url", "Homepage About Image", "Image beside the homepage brand story."],
    ["home_founder_image_url", "Homepage Founder Image", "Image in the homepage Meet the Founder section."],
    ["founder_portrait_image_url", "Founder Portrait", "Main portrait on the Founder page."],
    ["founder_story_image_url", "Founder Story Image", "Image in the Founder page beginning/story section."]
  ];


  function populateStoreImageSettings(settings) {

    const container = getElement("storeImageSettings");
    if (!container) return;

    container.innerHTML = "";

    STORE_IMAGE_FIELDS.forEach(([key, label, description]) => {

      const card = document.createElement("div");
      card.className = "store-image-card";

      const heading = document.createElement("div");
      heading.className = "store-image-card-heading";

      const title = document.createElement("strong");
      title.textContent = label;

      const help = document.createElement("small");
      help.textContent = description;

      heading.append(title, help);

      const preview = document.createElement("div");
      preview.className = "store-image-preview";

      const image = document.createElement("img");
      image.alt = label + " preview";
      image.hidden = true;

      const empty = document.createElement("span");
      empty.textContent = "Using original page image";

      preview.append(image, empty);

      const url = document.createElement("input");
      url.type = "url";
      url.id = "storeImageUrl_" + key;
      url.value = settings[key] || "";
      url.placeholder = "Optional image URL";
      url.setAttribute("aria-label", label + " URL");

      const controls = document.createElement("div");
      controls.className = "store-image-controls";

      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/jpeg,image/png,image/webp";
      file.id = "storeImageFile_" + key;
      file.hidden = true;

      const upload = document.createElement("button");
      upload.type = "button";
      upload.className = "store-image-upload-button";
      upload.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Upload image';
      upload.addEventListener("click", () => file.click());

      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "store-image-clear-button";
      clear.textContent = "Clear";
      clear.addEventListener("click", () => {
        url.value = "";
        image.removeAttribute("src");
        image.hidden = true;
        empty.hidden = false;
      });

      url.addEventListener("input", () => {
        const value = url.value.trim();
        if (value && isValidUrl(value)) {
          image.onload = () => { image.hidden = false; empty.hidden = true; };
          image.onerror = () => { image.hidden = true; empty.hidden = false; };
          image.src = normalizeUrl(value);
        } else {
          image.removeAttribute("src");
          image.hidden = true;
          empty.hidden = false;
        }
      });

      file.addEventListener("change", () => uploadStoreImage(file, url, image, empty, key, label));

      if (url.value && isValidUrl(url.value)) {
        image.onload = () => { image.hidden = false; empty.hidden = true; };
        image.onerror = () => { image.hidden = true; empty.hidden = false; };
        image.src = normalizeUrl(url.value);
      }

      controls.append(upload, clear, file);
      card.append(heading, preview, url, controls);
      container.appendChild(card);

    });

  }


  async function uploadStoreImage(fileInput, urlInput, preview, emptyState, key, label) {

    const file = fileInput.files && fileInput.files[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("businessBrandingMessage", "Please choose a JPG, PNG or WebP image.", "error");
      fileInput.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("businessBrandingMessage", "Each image must be 10 MB or smaller.", "error");
      fileInput.value = "";
      return;
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 70);
    const path = `store/${key}/${Date.now()}-${safeName || "image." + extension}`;

    try {

      const { error } = await supabase.storage
        .from("store-assets")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("store-assets")
        .getPublicUrl(path);

      if (!data || !data.publicUrl) throw new Error("The uploaded image URL could not be created.");

      urlInput.value = data.publicUrl;
      preview.onload = () => { preview.hidden = false; emptyState.hidden = true; };
      preview.onerror = () => { preview.hidden = true; emptyState.hidden = false; };
      preview.src = data.publicUrl;

      setMessage("businessBrandingMessage", label + " uploaded. Remember to save Branding to publish it.", "success");

    } catch (error) {

      console.error("Store image upload failed:", error);
      setMessage("businessBrandingMessage", "Image upload failed: " + getErrorMessage(error), "error");

    } finally {
      fileInput.value = "";
    }

  }


  function setColorValue(id, value) {

    const input = getElement(id);

    if (!input) return;

    const color = /^#[0-9A-F]{6}$/i.test(value || "")
      ? value.toUpperCase()
      : "#000000";

    input.value = color;

    const valueElement = getElement(`${id}Value`);

    if (valueElement) {

      if ("value" in valueElement) {
        valueElement.value = color;
      } else {
        valueElement.textContent = color;
      }
    }
  }


  function getColorValue(id) {

    const input = getElement(id);
    const valueElement = getElement(`${id}Value`);

    if (!input) return "";

    const typedValue = valueElement && "value" in valueElement
      ? valueElement.value.trim()
      : "";

    const color = typedValue || input.value;

    return /^#[0-9A-F]{6}$/i.test(color)
      ? color.toUpperCase()
      : null;
  }


  function updateColorLabels() {

    [
      "brandPrimaryColor",
      "brandSecondaryColor",
      "brandAccentColor"

    ].forEach(id => {

      const input = getElement(id);
      const valueElement = getElement(`${id}Value`);

      if (!input || !valueElement) return;

      const color = input.value.toUpperCase();

      if ("value" in valueElement) {
        valueElement.value = color;
      } else {
        valueElement.textContent = color;
      }
    });
  }


  function updateColorPickerFromText(id) {

    const input = getElement(id);
    const valueElement = getElement(`${id}Value`);

    if (!input || !valueElement) return;

    if (!("value" in valueElement)) return;

    const typedValue = valueElement.value.trim();

    if (/^#[0-9A-F]{6}$/i.test(typedValue)) {

      input.value = typedValue.toUpperCase();

    }
  }


  function updateLogoPreview() {

    const logoInput = getElement("businessLogoUrl");
    const preview = getElement("businessLogoPreview");

    if (!logoInput || !preview) return;

    const logoUrl = logoInput.value.trim();

    let image = preview.querySelector("img");

    const placeholderIcon = preview.querySelector("i");
    const placeholderText = preview.querySelector("span");

    function showPlaceholder() {

      if (image) {
        image.style.display = "none";
      }

      if (placeholderIcon) {
        placeholderIcon.style.display = "";
      }

      if (placeholderText) {
        placeholderText.style.display = "";
      }
    }


    if (!logoUrl || !isValidUrl(logoUrl)) {

      showPlaceholder();

      return;
    }


    if (!image) {

      image = document.createElement("img");

      image.alt = "Business logo preview";

      preview.appendChild(image);
    }


    image.onload = () => {

      image.style.display = "block";

      if (placeholderIcon) {
        placeholderIcon.style.display = "none";
      }

      if (placeholderText) {
        placeholderText.style.display = "none";
      }
    };


    image.onerror = () => {

      showPlaceholder();
    };


    image.style.display = "none";

    image.src = normalizeUrl(logoUrl);
  }


  async function saveBranding(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("businessBrandingMessage");

    const logoUrl = getValue("businessLogoUrl");
    const faviconUrl = getValue("businessFaviconUrl");

    if (!isValidUrl(logoUrl)) {

      setMessage(
        "businessBrandingMessage",
        "Please enter a valid logo URL.",
        "error"
      );

      return;
    }

    if (!isValidUrl(faviconUrl)) {

      setMessage(
        "businessBrandingMessage",
        "Please enter a valid favicon URL.",
        "error"
      );

      return;
    }


    const primaryColor = getColorValue("brandPrimaryColor");
    const secondaryColor = getColorValue("brandSecondaryColor");
    const accentColor = getColorValue("brandAccentColor");

    if (!primaryColor || !secondaryColor || !accentColor) {

      setMessage(
        "businessBrandingMessage",
        "Please enter valid HEX colour values for all brand colours.",
        "error"
      );

      return;
    }


    const payload = {

      logo_url:
        normalizeUrl(logoUrl),

      favicon_url:
        normalizeUrl(faviconUrl),

      ...Object.fromEntries(
        STORE_IMAGE_FIELDS.map(([key]) => [
          key,
          normalizeUrl(getValue("storeImageUrl_" + key)) || null
        ])
      ),

      brand_primary_color:
        primaryColor,

      brand_secondary_color:
        secondaryColor,

      brand_accent_color:
        accentColor
    };


    await saveSection({

      payload,
      button,

      messageId: "businessBrandingMessage",

      successMessage:
        "Branding settings saved successfully."
    });
  }


  /* =====================================================
     10. GENERAL PREFERENCES
  ====================================================== */

  function populateGeneralPreferences(settings) {

    setValue(
      "businessCurrency",
      settings.currency
    );

    setValue(
      "businessTimezone",
      settings.timezone
    );

    setValue(
      "minimumOrderAmount",
      settings.minimum_order_amount
    );
  }


  async function saveGeneralPreferences(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("generalPreferencesMessage");

    const minimumOrder = getValue("minimumOrderAmount");

    const validation = validateNumber(
      minimumOrder,
      "Minimum order amount"
    );

    if (validation) {

      setMessage(
        "generalPreferencesMessage",
        validation,
        "error"
      );

      return;
    }


    const payload = {

      currency:
        getValue("businessCurrency"),

      timezone:
        getValue("businessTimezone"),

      minimum_order_amount:
        formatNumber(minimumOrder)
    };


    await saveSection({

      payload,
      button,

      messageId: "generalPreferencesMessage",

      successMessage:
        "General preferences saved successfully."
    });
  }


  /* =====================================================
     11. DELIVERY & PICKUP
  ====================================================== */

  function populateDeliveryPickup(settings) {

    setChecked(
      "deliveryEnabled",
      settings.delivery_enabled
    );

    setChecked(
      "pickupEnabled",
      settings.pickup_enabled
    );

    setChecked(
      "freeDeliveryEnabled",
      settings.free_delivery_enabled
    );

    setValue(
      "defaultDeliveryFee",
      settings.delivery_fee
    );

    setValue(
      "freeDeliveryThreshold",
      settings.free_delivery_threshold
    );

    setValue(
      "estimatedDeliveryDays",
      settings.estimated_delivery_days
    );

    setValue(
      "deliveryInformation",
      settings.delivery_information
    );

    setValue(
      "pickupInformation",
      settings.pickup_information
    );

    setValue(
      "estimatedPreparationDays",
      settings.estimated_preparation_days
    );

    updateFreeDeliveryVisibility();
  }


  function updateFreeDeliveryVisibility() {

    const toggle = getElement("freeDeliveryEnabled");

    const group = getElement("freeDeliveryThresholdGroup");

    if (!toggle || !group) return;

    group.style.display = toggle.checked
      ? ""
      : "none";
  }


  async function saveDeliveryPickup(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("deliveryPickupMessage");


    const deliveryFee = getValue("defaultDeliveryFee");

    const feeValidation = validateNumber(
      deliveryFee,
      "Delivery fee"
    );

    if (feeValidation) {

      setMessage(
        "deliveryPickupMessage",
        feeValidation,
        "error"
      );

      return;
    }


    const freeDeliveryToggle = getElement("freeDeliveryEnabled");

    const freeDeliveryEnabled = freeDeliveryToggle
      ? freeDeliveryToggle.checked
      : false;

    const threshold = getValue("freeDeliveryThreshold");


    if (freeDeliveryEnabled) {

      const thresholdValidation = validateNumber(
        threshold,
        "Free delivery threshold",
        false
      );

      if (thresholdValidation) {

        setMessage(
          "deliveryPickupMessage",
          thresholdValidation,
          "error"
        );

        return;
      }
    }


    const deliveryDays = getValue("estimatedDeliveryDays");

    const preparationDays = getValue("estimatedPreparationDays");


    if (
      deliveryDays !== "" &&
      (
        !Number.isInteger(Number(deliveryDays)) ||
        Number(deliveryDays) < 0
      )
    ) {

      setMessage(
        "deliveryPickupMessage",
        "Estimated delivery days must be a non-negative whole number.",
        "error"
      );

      return;
    }


    if (
      preparationDays !== "" &&
      (
        !Number.isInteger(Number(preparationDays)) ||
        Number(preparationDays) < 0
      )
    ) {

      setMessage(
        "deliveryPickupMessage",
        "Estimated preparation days must be a non-negative whole number.",
        "error"
      );

      return;
    }


    const payload = {

      delivery_enabled:
        getElement("deliveryEnabled").checked,

      pickup_enabled:
        getElement("pickupEnabled").checked,

      delivery_fee:
        formatNumber(deliveryFee),

      free_delivery_enabled:
        freeDeliveryEnabled,

      free_delivery_threshold:
        freeDeliveryEnabled
          ? formatNumber(threshold)
          : null,

      estimated_delivery_days:
        deliveryDays === ""
          ? null
          : Number(deliveryDays),

      delivery_information:
        getValue("deliveryInformation") || null,

      pickup_information:
        getValue("pickupInformation") || null,

      estimated_preparation_days:
        preparationDays === ""
          ? null
          : Number(preparationDays)
    };


    await saveSection({

      payload,
      button,

      messageId: "deliveryPickupMessage",

      successMessage:
        "Delivery and pickup settings saved successfully."
    });
  }


  /* =====================================================
     12. OPENING HOURS
  ====================================================== */

  const DAYS_OF_WEEK = [

    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"

  ];


  function populateOpeningHours(settings) {

    const openingHours = settings.opening_hours || {};

    DAYS_OF_WEEK.forEach(day => {

      const daySettings = openingHours[day] || {};

      const isOpen = Boolean(daySettings.open);

      setChecked(
        `${day}Open`,
        isOpen
      );

      setValue(
        `${day}OpeningTime`,
        daySettings.start || "09:00"
      );

      setValue(
        `${day}ClosingTime`,
        daySettings.end || "17:00"
      );

      updateOpeningDayStatus(day);
    });
  }


  function updateOpeningDayStatus(day) {

    const toggle = getElement(`${day}Open`);

    const start = getElement(`${day}OpeningTime`);

    const end = getElement(`${day}ClosingTime`);

    const status = getElement(`${day}Status`);

    if (!toggle) return;

    const isOpen = toggle.checked;

    if (start) {
      start.disabled = !isOpen;
    }

    if (end) {
      end.disabled = !isOpen;
    }

    if (status) {

      status.textContent = isOpen
        ? "Open"
        : "Closed";

      status.classList.toggle(
        "is-open",
        isOpen
      );

      status.classList.toggle(
        "is-closed",
        !isOpen
      );
    }
  }


  function collectOpeningHours() {

    const openingHours = {};

    for (const day of DAYS_OF_WEEK) {

      const toggle = getElement(`${day}Open`);

      const start = getElement(`${day}OpeningTime`);

      const end = getElement(`${day}ClosingTime`);


      if (!toggle || !start || !end) {

        throw new Error(
          `Opening hours fields for ${day} are missing.`
        );
      }


      const isOpen = toggle.checked;

      const startTime = start.value;

      const endTime = end.value;


      if (isOpen) {

        if (!startTime || !endTime) {

          throw new Error(
            `Please enter both opening and closing times for ${day}.`
          );
        }

        if (startTime >= endTime) {

          throw new Error(
            `Closing time must be later than opening time on ${day}.`
          );
        }
      }


      openingHours[day] = {

        open: isOpen,

        start: startTime || "09:00",

        end: endTime || "17:00"
      };
    }

    return openingHours;
  }


  async function saveOpeningHours(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("openingHoursMessage");

    let openingHours;


    try {

      openingHours = collectOpeningHours();

    } catch (error) {

      setMessage(
        "openingHoursMessage",
        getErrorMessage(error),
        "error"
      );

      return;
    }


    await saveSection({

      payload: {
        opening_hours: openingHours
      },

      button,

      messageId: "openingHoursMessage",

      successMessage:
        "Opening hours saved successfully."
    });
  }


  /* =====================================================
     13. BANK TRANSFER DETAILS
  ====================================================== */

  function populateBankTransfer(settings) {

    const details = settings.bank_transfer_details || {};

    setValue(
      "bankName",
      details.bank_name
    );

    setValue(
      "bankAccountName",
      details.account_name
    );

    setValue(
      "bankAccountNumber",
      details.account_number
    );

    setValue(
      "bankTransferInstructions",
      details.instructions
    );
  }


  async function saveBankTransfer(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("bankTransferMessage");


    const details = {

      bank_name:
        getValue("bankName") || null,

      account_name:
        getValue("bankAccountName") || null,

      account_number:
        getValue("bankAccountNumber") || null,

      instructions:
        getValue("bankTransferInstructions") || null
    };


    await saveSection({

      payload: {
        bank_transfer_details: details
      },

      button,

      messageId: "bankTransferMessage",

      successMessage:
        "Bank transfer details saved successfully."
    });
  }


  /* =====================================================
     14. SOCIAL MEDIA LINKS
  ====================================================== */

  function populateSocialMedia(settings) {

    const links = settings.social_links || {};

    setValue(
      "socialInstagram",
      links.instagram
    );

    setValue(
      "socialFacebook",
      links.facebook
    );

    setValue(
      "socialTiktok",
      links.tiktok
    );

    setValue(
      "socialWhatsapp",
      links.whatsapp
    );

    setValue(
      "socialOther",
      links.other
    );
  }


  async function saveSocialMedia(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("socialMediaMessage");


    const fields = [

      ["socialInstagram", "Instagram"],

      ["socialFacebook", "Facebook"],

      ["socialTiktok", "TikTok"],

      ["socialWhatsapp", "WhatsApp"],

      ["socialOther", "Other social media"]

    ];


    for (const [id, label] of fields) {

      const value = getValue(id);

      if (value && !isValidUrl(value)) {

        setMessage(
          "socialMediaMessage",
          `${label} must be a valid URL.`,
          "error"
        );

        return;
      }
    }


    const links = {

      instagram:
        normalizeUrl(getValue("socialInstagram")),

      facebook:
        normalizeUrl(getValue("socialFacebook")),

      tiktok:
        normalizeUrl(getValue("socialTiktok")),

      whatsapp:
        normalizeUrl(getValue("socialWhatsapp")),

      other:
        normalizeUrl(getValue("socialOther"))
    };


    await saveSection({

      payload: {
        social_links: links
      },

      button,

      messageId: "socialMediaMessage",

      successMessage:
        "Social media links saved successfully."
    });
  }


  /* =====================================================
     15. ANNOUNCEMENT BAR
  ====================================================== */

  function populateAnnouncement(settings) {

    setChecked(
      "announcementEnabled",
      settings.announcement_enabled
    );

    setValue(
      "announcementText",
      settings.announcement_text
    );

    setValue(
      "announcementLink",
      settings.announcement_link
    );
  }


  async function saveAnnouncement(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("announcementMessage");


    const announcementEnabled =
      getElement("announcementEnabled").checked;

    const announcementText =
      getValue("announcementText");

    const announcementLink =
      getValue("announcementLink");


    if (announcementEnabled && !announcementText) {

      setMessage(
        "announcementMessage",
        "Please enter announcement text before enabling the announcement bar.",
        "error"
      );

      return;
    }


    if (
      announcementLink &&
      !isValidUrl(announcementLink)
    ) {

      setMessage(
        "announcementMessage",
        "Please enter a valid announcement link.",
        "error"
      );

      return;
    }


    const payload = {

      announcement_enabled:
        announcementEnabled,

      announcement_text:
        announcementText || null,

      announcement_link:
        normalizeUrl(announcementLink)
    };


    await saveSection({

      payload,
      button,

      messageId: "announcementMessage",

      successMessage:
        "Announcement settings saved successfully."
    });
  }


  /* =====================================================
     16. LEGAL INFORMATION
  ====================================================== */

  function populateLegalInformation(settings) {

    setValue(
      "termsUrl",
      settings.terms_url
    );

    setValue(
      "privacyUrl",
      settings.privacy_url
    );
  }


  async function saveLegalInformation(event) {

    event.preventDefault();

    const form = event.currentTarget;
    const button = getFormButton(form);

    clearMessage("legalInformationMessage");


    const termsUrl = getValue("termsUrl");

    const privacyUrl = getValue("privacyUrl");


    if (!isValidUrl(termsUrl)) {

      setMessage(
        "legalInformationMessage",
        "Please enter a valid Terms and Conditions URL.",
        "error"
      );

      return;
    }


    if (!isValidUrl(privacyUrl)) {

      setMessage(
        "legalInformationMessage",
        "Please enter a valid Privacy Policy URL.",
        "error"
      );

      return;
    }


    const payload = {

      terms_url:
        normalizeUrl(termsUrl),

      privacy_url:
        normalizeUrl(privacyUrl)
    };


    await saveSection({

      payload,
      button,

      messageId: "legalInformationMessage",

      successMessage:
        "Legal information saved successfully."
    });
  }


  /* =====================================================
     17. SHARED SAVE FUNCTION
  ====================================================== */

  async function saveSection({

    payload,
    button,
    messageId,
    successMessage

  }) {

    if (!currentUserId) {

      setMessage(
        messageId,
        "Your admin session could not be verified. Please log in again.",
        "error"
      );

      return;
    }


    const originalHTML = button
      ? button.innerHTML
      : null;


    try {

      setButtonLoading(
        button,
        true
      );


      const updatePayload = {

        ...payload,

        updated_by: currentUserId,

        updated_at: new Date().toISOString()
      };


      const {
        data,
        error
      } = await supabase
        .from(SETTINGS_TABLE)
        .update(updatePayload)
        .eq("id", SETTINGS_ID)
        .select("*")
        .single();


      if (error) {
        throw error;
      }


      if (!data) {

        throw new Error(
          "The settings update did not return a record."
        );
      }


      currentSettings = {

        ...currentSettings,

        ...data
      };


      /* ================================================
         REFRESH SHARED STORE SETTINGS
      ================================================ */

      if (
        window.HafhassStoreSettings &&
        typeof window.HafhassStoreSettings.refresh === "function"
      ) {

        try {

          await window.HafhassStoreSettings.refresh();

        } catch (refreshError) {

          console.warn(
            "Store settings were saved, but the shared settings refresh failed:",
            refreshError
          );
        }
      }


      setMessage(
        messageId,
        successMessage,
        "success"
      );


      console.log(
        "Settings updated successfully:",
        Object.keys(payload)
      );


    } catch (error) {

      console.error(
        "Settings update failed:",
        error
      );


      setMessage(
        messageId,

        "Unable to save settings: " +
        getErrorMessage(error),

        "error"
      );


    } finally {

      setButtonLoading(
        button,
        false,
        originalHTML
      );
    }
  }


  /* =====================================================
     18. EVENT LISTENERS
  ====================================================== */

  function registerForm(formId, handler) {

    const form = getElement(formId);

    if (!form) {

      console.warn(
        `Settings form not found: ${formId}`
      );

      return;
    }

    form.addEventListener(
      "submit",
      handler
    );
  }


  function registerEventListeners() {


    /* Business information */

    registerForm(
      "businessInformationForm",
      saveBusinessInformation
    );


    /* Address and contact */

    registerForm(
      "businessAddressForm",
      saveBusinessAddress
    );


    /* Branding */

    registerForm(
      "businessBrandingForm",
      saveBranding
    );


    /* General preferences */

    registerForm(
      "generalPreferencesForm",
      saveGeneralPreferences
    );


    /* Delivery and pickup */

    registerForm(
      "deliveryPickupForm",
      saveDeliveryPickup
    );


    /* Opening hours */

    registerForm(
      "openingHoursForm",
      saveOpeningHours
    );


    /* Bank transfer */

    registerForm(
      "bankTransferForm",
      saveBankTransfer
    );


    /* Social media */

    registerForm(
      "socialMediaForm",
      saveSocialMedia
    );


    /* Announcement */

    registerForm(
      "announcementForm",
      saveAnnouncement
    );


    /* Legal information */

    registerForm(
      "legalInformationForm",
      saveLegalInformation
    );


    /* =================================================
       LOGO PREVIEW
    ================================================== */

    const logoInput = getElement("businessLogoUrl");

    if (logoInput) {

      logoInput.addEventListener(
        "input",
        updateLogoPreview
      );
    }


    /* =================================================
       BRANDING COLOUR PICKERS
    ================================================== */

    [
      "brandPrimaryColor",
      "brandSecondaryColor",
      "brandAccentColor"

    ].forEach(id => {

      const input = getElement(id);

      if (input) {

        input.addEventListener(
          "input",
          updateColorLabels
        );
      }
    });


    /* =================================================
       BRANDING HEX VALUE INPUTS
    ================================================== */

    [
      "brandPrimaryColor",
      "brandSecondaryColor",
      "brandAccentColor"

    ].forEach(id => {

      const valueElement = getElement(`${id}Value`);

      if (
        valueElement &&
        "value" in valueElement
      ) {

        valueElement.addEventListener(
          "input",
          () => updateColorPickerFromText(id)
        );
      }
    });


    /* =================================================
       FREE DELIVERY VISIBILITY
    ================================================== */

    const freeDeliveryToggle =
      getElement("freeDeliveryEnabled");

    if (freeDeliveryToggle) {

      freeDeliveryToggle.addEventListener(
        "change",
        updateFreeDeliveryVisibility
      );
    }


    /* =================================================
       OPENING HOURS DAY TOGGLES
    ================================================== */

    DAYS_OF_WEEK.forEach(day => {

      const toggle = getElement(`${day}Open`);

      if (toggle) {

        toggle.addEventListener(
          "change",
          () => updateOpeningDayStatus(day)
        );
      }
    });


    /* =================================================
       SETTINGS NAVIGATION
    ================================================== */

    const navigationLinks = document.querySelectorAll(
      ".settings-navigation a[href^='#']"
    );


    navigationLinks.forEach(link => {

      link.addEventListener("click", () => {

        navigationLinks.forEach(item => {

          item.classList.remove("active");

        });

        link.classList.add("active");
      });
    });
  }


  /* =====================================================
     19. INITIALIZE SETTINGS PAGE
  ====================================================== */

  async function initializeSettings() {

    try {

      await getCurrentUser();

      registerEventListeners();

      await loadSettings();


    } catch (error) {

      console.error(
        "Settings initialization failed:",
        error
      );


      alert(
        "Unable to initialize the Settings page.\n\n" +
        getErrorMessage(error)
      );
    }
  }


  initializeSettings();


});