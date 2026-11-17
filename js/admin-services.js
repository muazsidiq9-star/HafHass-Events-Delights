/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN SERVICES MANAGEMENT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  "use strict";


  /* =======================================================
     1. INITIALIZATION
  ======================================================= */

  const supabase = window.hafhassSupabase;

  if (!supabase) {
    console.error("HAFHASS Admin Services: Supabase is unavailable.");
    return;
  }

  const TABLE = "services";
  const STORAGE_BUCKET = "product-images";
  const IMAGE_FOLDER = "services";
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  const ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };


  /* =======================================================
     2. DOM ELEMENTS
  ======================================================= */

  const elements = {

    currentDate: document.getElementById("adminCurrentDate"),

    totalServices: document.getElementById("totalServices"),
    activeServices: document.getElementById("activeServices"),
    inactiveServices: document.getElementById("inactiveServices"),
    featuredServices: document.getElementById("featuredServices"),

    addButton: document.getElementById("addServiceButton"),
    emptyAddButton: document.getElementById("emptyAddServiceButton"),

    search: document.getElementById("serviceSearch"),
    statusFilter: document.getElementById("serviceStatusFilter"),
    pricingFilter: document.getElementById("servicePricingFilter"),
    featuredFilter: document.getElementById("serviceFeaturedFilter"),
    clearFilters: document.getElementById("clearServiceFilters"),

    resultCount: document.getElementById("serviceResultCount"),

    loading: document.getElementById("servicesLoading"),
    error: document.getElementById("servicesError"),
    errorMessage: document.getElementById("servicesErrorMessage"),
    retryButton: document.getElementById("retryServicesButton"),
    empty: document.getElementById("servicesEmpty"),
    noResults: document.getElementById("servicesNoResults"),

    tableContainer: document.getElementById("servicesTableContainer"),
    tableBody: document.getElementById("servicesTableBody"),

    modalOverlay: document.getElementById("serviceModalOverlay"),
    modalTitle: document.getElementById("serviceModalTitle"),
    closeModal: document.getElementById("closeServiceModal"),

    form: document.getElementById("serviceForm"),

    serviceId: document.getElementById("serviceId"),
    name: document.getElementById("serviceName"),
    slug: document.getElementById("serviceSlug"),
    description: document.getElementById("serviceDescription"),

    imageFile: document.getElementById("serviceImageFile"),
    imageUrl: document.getElementById("serviceImageUrl"),
    imagePreview: document.getElementById("serviceImagePreview"),

    pricingType: document.getElementById("servicePricingType"),
    price: document.getElementById("servicePrice"),
    currency: document.getElementById("serviceCurrency"),

    displayOrder: document.getElementById("serviceDisplayOrder"),

    isActive: document.getElementById("serviceIsActive"),
    isFeatured: document.getElementById("serviceIsFeatured"),

    formMessage: document.getElementById("serviceFormMessage"),

    cancelButton: document.getElementById("cancelServiceForm"),
    saveButton: document.getElementById("saveServiceButton")

  };


  const requiredElements = [
    elements.tableBody,
    elements.form,
    elements.modalOverlay,
    elements.name,
    elements.slug,
    elements.description,
    elements.imageUrl,
    elements.imageFile,
    elements.imagePreview,
    elements.pricingType,
    elements.price,
    elements.currency,
    elements.isActive,
    elements.isFeatured,
    elements.saveButton,
    elements.cancelButton,
    elements.closeModal
  ];

  if (requiredElements.some(element => !element)) {

    console.error(
      "HAFHASS Admin Services: Required HTML elements are missing."
    );

    return;

  }


  /* =======================================================
     3. STATE
  ======================================================= */

  let allServices = [];
  let filteredServices = [];

  let isSaving = false;
  let isLoading = false;

  let slugManuallyEdited = false;

  let previewObjectUrl = null;


  /* =======================================================
     4. HELPERS
  ======================================================= */

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


  function formatNumber(value) {

    return Number(value || 0).toLocaleString("en-NG");

  }


  function formatCurrency(amount, currency = "NGN") {

    const value = Number(amount || 0);

    try {

      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(value);

    } catch (error) {

      return `${currency} ${value.toLocaleString("en-NG")}`;

    }

  }


  function createSlug(value) {

    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  }


  function getPricingLabel(type) {

    const labels = {
      fixed: "Fixed Price",
      starting_from: "Starting From",
      quote: "Request a Quote"
    };

    return labels[type] || "Request a Quote";

  }


  function getPricingDisplay(service) {

    const type = service.pricing_type;

    const price = Number(service.price || 0);

    const currency = service.currency || "NGN";


    if (type === "fixed") {

      return {
        main: formatCurrency(price, currency),
        sub: "Fixed price"
      };

    }


    if (type === "starting_from") {

      return {
        main: formatCurrency(price, currency),
        sub: "Starting from"
      };

    }


    return {
      main: "By quotation",
      sub: "Custom pricing"
    };

  }


  function renderDate() {

    if (!elements.currentDate) return;

    elements.currentDate.textContent =
      new Date().toLocaleDateString("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

  }


  function showFormMessage(message, type = "error") {

    if (!elements.formMessage) return;

    elements.formMessage.textContent = message;

    elements.formMessage.className =
      `admin-services-form-message ${type}`;

    showElement(elements.formMessage);

  }


  function clearFormMessage() {

    if (!elements.formMessage) return;

    elements.formMessage.textContent = "";

    elements.formMessage.className =
      "admin-services-form-message";

    hideElement(elements.formMessage);

  }


  /* =======================================================
     5. IMAGE MANAGEMENT
  ======================================================= */

  function revokePreviewObjectUrl() {

    if (previewObjectUrl) {

      URL.revokeObjectURL(previewObjectUrl);

      previewObjectUrl = null;

    }

  }


  function renderImagePreview(source) {

    if (!elements.imagePreview) return;

    revokePreviewObjectUrl();


    if (!source) {

      elements.imagePreview.innerHTML = `
        <i class="fas fa-image"></i>
        <span>No image selected</span>
      `;

      return;

    }


    const safeSource = escapeHTML(source);

    elements.imagePreview.innerHTML = `
      <img
        src="${safeSource}"
        alt="Service image preview"
      >
    `;


    const image =
      elements.imagePreview.querySelector("img");


    image.addEventListener("error", () => {

      elements.imagePreview.innerHTML = `
        <i class="fas fa-image"></i>
        <span>Unable to load image</span>
      `;

    }, { once: true });

  }


  function validateImageFile(file) {

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES[file.type]) {

      throw new Error(
        "Please choose a JPG, PNG or WebP image."
      );

    }


    if (file.size > MAX_IMAGE_SIZE) {

      throw new Error(
        "The selected image must not exceed 10 MB."
      );

    }


    if (file.size === 0) {

      throw new Error(
        "The selected image is empty. Please choose another image."
      );

    }

  }


  function previewImageFile(file) {

    if (!file) return;

    try {

      validateImageFile(file);

      clearFormMessage();

      revokePreviewObjectUrl();

      previewObjectUrl = URL.createObjectURL(file);

      const safeSource = escapeHTML(previewObjectUrl);

      elements.imagePreview.innerHTML = `
        <img
          src="${safeSource}"
          alt="Selected service image preview"
        >
      `;

      showFormMessage(
        "Image ready for upload. Save the service to upload it.",
        "success"
      );

    } catch (error) {

      elements.imageFile.value = "";

      renderImagePreview(
        elements.imageUrl.value.trim()
      );

      showFormMessage(error.message);

    }

  }


  function getManagedServiceImagePath(imageUrl) {

    if (!imageUrl) return null;

    try {

      const parsedUrl = new URL(imageUrl);

      const marker =
        `/storage/v1/object/public/${STORAGE_BUCKET}/`;

      const markerIndex =
        parsedUrl.pathname.indexOf(marker);


      if (markerIndex === -1) return null;


      const encodedPath =
        parsedUrl.pathname.slice(
          markerIndex + marker.length
        );


      const path = decodeURIComponent(encodedPath);


      if (!path.startsWith(`${IMAGE_FOLDER}/`)) {

        return null;

      }


      return path;

    } catch (error) {

      return null;

    }

  }


  function createImageFilePath(file, slug) {

    const extension =
      ALLOWED_IMAGE_TYPES[file.type];

    const uniqueId =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const safeSlug =
      createSlug(slug) || "service";


    return `${IMAGE_FOLDER}/${safeSlug}-${uniqueId}.${extension}`;

  }


  async function uploadServiceImage(file, slug) {

    validateImageFile(file);

    const filePath =
      createImageFilePath(file, slug);


    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {

        cacheControl: "3600",

        contentType: file.type,

        upsert: false

      });


    if (error) {

      console.error(
        "HAFHASS Admin Services: Image upload failed:",
        error
      );

      throw error;

    }


    const { data: publicUrlData } = supabase
      .storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);


    if (!publicUrlData?.publicUrl) {

      await supabase
        .storage
        .from(STORAGE_BUCKET)
        .remove([data.path]);

      throw new Error(
        "The image uploaded, but its public URL could not be generated."
      );

    }


    return {

      path: data.path,

      url: publicUrlData.publicUrl

    };

  }


  async function deleteServiceImage(imagePath) {

    if (!imagePath) return;

    const { error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([imagePath]);


    if (error) {

      console.warn(
        "HAFHASS Admin Services: Old image could not be deleted:",
        error
      );

    }

  }


  /* =======================================================
     6. ADMIN AUTHENTICATION READINESS
  ======================================================= */

  function waitForAdminAuthentication() {

    return new Promise((resolve, reject) => {

      if (
        document.body.classList.contains("admin-authenticated")
      ) {

        resolve();

        return;

      }


      let finished = false;


      const observer = new MutationObserver(() => {

        if (
          document.body.classList.contains("admin-authenticated")
        ) {

          finished = true;

          observer.disconnect();

          clearTimeout(timeout);

          resolve();

        }

      });


      observer.observe(document.body, {

        attributes: true,

        attributeFilter: ["class"]

      });


      const timeout = setTimeout(() => {

        if (finished) return;

        observer.disconnect();

        reject(
          new Error(
            "Admin authentication could not be confirmed."
          )
        );

      }, 15000);

    });

  }


  /* =======================================================
     7. UI STATES
  ======================================================= */

  function showLoading() {

    showElement(elements.loading);

    hideElement(elements.error);
    hideElement(elements.empty);
    hideElement(elements.noResults);
    hideElement(elements.tableContainer);

  }


  function showError(message) {

    hideElement(elements.loading);
    hideElement(elements.empty);
    hideElement(elements.noResults);
    hideElement(elements.tableContainer);

    if (elements.errorMessage) {

      elements.errorMessage.textContent = message;

    }

    showElement(elements.error);

  }


  function showEmpty() {

    hideElement(elements.loading);
    hideElement(elements.error);
    hideElement(elements.noResults);
    hideElement(elements.tableContainer);

    showElement(elements.empty);

  }


  function showNoResults() {

    hideElement(elements.loading);
    hideElement(elements.error);
    hideElement(elements.empty);
    hideElement(elements.tableContainer);

    showElement(elements.noResults);

  }


  /* =======================================================
     8. LOAD SERVICES
  ======================================================= */

  async function loadServices() {

    if (isLoading) return;

    isLoading = true;

    showLoading();


    try {

      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("display_order", {
          ascending: true
        })
        .order("created_at", {
          ascending: false
        });


      if (error) throw error;


      allServices = data || [];

      updateStatistics();

      applyFilters();


    } catch (error) {

      console.error(
        "HAFHASS Admin Services: Loading failed:",
        error
      );

      showError(
        error.message ||
        "Unable to load services. Please try again."
      );

    } finally {

      isLoading = false;

    }

  }


  /* =======================================================
     9. STATISTICS
  ======================================================= */

  function updateStatistics() {

    const total = allServices.length;

    const active = allServices.filter(
      service => service.is_active === true
    ).length;

    const inactive = total - active;

    const featured = allServices.filter(
      service => service.is_featured === true
    ).length;


    elements.totalServices.textContent =
      formatNumber(total);

    elements.activeServices.textContent =
      formatNumber(active);

    elements.inactiveServices.textContent =
      formatNumber(inactive);

    elements.featuredServices.textContent =
      formatNumber(featured);

  }


  /* =======================================================
     10. SEARCH AND FILTERS
  ======================================================= */

  function applyFilters() {

    const searchTerm =
      elements.search.value.trim().toLowerCase();

    const status =
      elements.statusFilter.value;

    const pricing =
      elements.pricingFilter.value;

    const featured =
      elements.featuredFilter.value;


    filteredServices = allServices.filter(service => {

      const matchesSearch = [

        service.name,
        service.slug,
        service.description

      ].some(value =>

        String(value || "")
          .toLowerCase()
          .includes(searchTerm)

      );


      const matchesStatus =
        status === "all" ||
        (status === "active" && service.is_active) ||
        (status === "inactive" && !service.is_active);


      const matchesPricing =
        pricing === "all" ||
        service.pricing_type === pricing;


      const matchesFeatured =
        featured === "all" ||
        (featured === "featured" && service.is_featured) ||
        (featured === "not_featured" && !service.is_featured);


      return (
        matchesSearch &&
        matchesStatus &&
        matchesPricing &&
        matchesFeatured
      );

    });


    renderServices();

  }


  /* =======================================================
     11. RENDER SERVICES
  ======================================================= */

  function renderServices() {

    const total = filteredServices.length;


    elements.resultCount.textContent =
      `Showing ${formatNumber(total)} service${total === 1 ? "" : "s"}`;


    hideElement(elements.loading);
    hideElement(elements.error);


    if (allServices.length === 0) {

      showEmpty();

      return;

    }


    if (total === 0) {

      showNoResults();

      return;

    }


    hideElement(elements.empty);
    hideElement(elements.noResults);

    showElement(elements.tableContainer);


    elements.tableBody.innerHTML = filteredServices
      .map(service => {

        const pricing = getPricingDisplay(service);

        const image = service.image_url
          ? `
            <img
              src="${escapeHTML(service.image_url)}"
              alt="${escapeHTML(service.name)}"
              loading="lazy"
            >
          `
          : `
            <i class="fas fa-concierge-bell"></i>
          `;


        return `

          <tr data-service-id="${escapeHTML(service.id)}">

            <td>

              <div class="admin-service-info">

                <div class="admin-service-thumbnail">
                  ${image}
                </div>

                <div class="admin-service-details">

                  <strong>
                    ${escapeHTML(service.name)}
                  </strong>

                  <small>
                    ${escapeHTML(service.slug)}
                  </small>

                </div>

              </div>

            </td>


            <td>

              <div class="admin-service-pricing">

                <strong>
                  ${escapeHTML(pricing.main)}
                </strong>

                <small>
                  ${escapeHTML(pricing.sub)}
                </small>

              </div>

            </td>


            <td>

              <span class="admin-service-badge ${
                service.is_featured
                  ? "featured"
                  : "not-featured"
              }">

                <i class="fas fa-star"></i>

                ${service.is_featured ? "Featured" : "No"}

              </span>

            </td>


            <td>

              <span class="admin-service-badge ${
                service.is_active
                  ? "active"
                  : "inactive"
              }">

                ${service.is_active ? "Active" : "Inactive"}

              </span>

            </td>


            <td>
              ${formatNumber(service.display_order)}
            </td>


            <td>

              <div class="admin-service-actions">

                <button
                  type="button"
                  class="admin-service-action"
                  data-action="edit"
                  data-id="${escapeHTML(service.id)}"
                  title="Edit service"
                  aria-label="Edit ${escapeHTML(service.name)}"
                >
                  <i class="fas fa-pen"></i>
                </button>


                <button
                  type="button"
                  class="admin-service-action toggle"
                  data-action="toggle"
                  data-id="${escapeHTML(service.id)}"
                  title="${service.is_active ? "Deactivate" : "Activate"} service"
                  aria-label="${service.is_active ? "Deactivate" : "Activate"} ${escapeHTML(service.name)}"
                >
                  <i class="fas ${
                    service.is_active
                      ? "fa-toggle-on"
                      : "fa-toggle-off"
                  }"></i>
                </button>

              </div>

            </td>

          </tr>

        `;

      })
      .join("");

  }


  /* =======================================================
     12. OPEN MODAL
  ======================================================= */

  function openModal(service = null) {

    elements.form.reset();

    clearFormMessage();

    slugManuallyEdited = false;

    revokePreviewObjectUrl();

    elements.imageFile.value = "";


    if (service) {

      elements.modalTitle.textContent = "Edit Service";

      elements.serviceId.value = service.id;

      elements.name.value = service.name || "";

      elements.slug.value = service.slug || "";

      elements.description.value =
        service.description || "";

      elements.imageUrl.value =
        service.image_url || "";

      elements.pricingType.value =
        service.pricing_type || "quote";

      elements.price.value =
        Number(service.price || 0);

      elements.currency.value =
        service.currency || "NGN";

      elements.displayOrder.value =
        service.display_order ?? 0;

      elements.isActive.checked =
        service.is_active === true;

      elements.isFeatured.checked =
        service.is_featured === true;

      renderImagePreview(service.image_url || "");


    } else {

      elements.modalTitle.textContent = "Add New Service";

      elements.serviceId.value = "";

      elements.price.value = "0";

      elements.currency.value = "NGN";

      elements.pricingType.value = "quote";

      elements.displayOrder.value =
        String(allServices.length + 1);

      elements.isActive.checked = true;

      elements.isFeatured.checked = false;

      renderImagePreview("");

    }


    updatePriceField();

    showElement(elements.modalOverlay);

    document.body.style.overflow = "hidden";

    elements.name.focus();

  }


  /* =======================================================
     13. CLOSE MODAL
  ======================================================= */

  function closeModal() {

    if (isSaving) return;

    hideElement(elements.modalOverlay);

    document.body.style.overflow = "";

    elements.form.reset();

    clearFormMessage();

    revokePreviewObjectUrl();

  }


  /* =======================================================
     14. PRICING FIELD
  ======================================================= */

  function updatePriceField() {

    const isQuote =
      elements.pricingType.value === "quote";


    elements.price.disabled = isQuote;


    if (isQuote) {

      elements.price.value = "0";

      elements.price.removeAttribute("required");

    } else {

      elements.price.setAttribute("required", "required");

    }

  }


  /* =======================================================
     15. VALIDATE FORM
  ======================================================= */

  function validateServiceForm() {

    const name = elements.name.value.trim();

    const slug = elements.slug.value.trim();

    const description =
      elements.description.value.trim();

    const pricingType =
      elements.pricingType.value;

    const price =
      Number(elements.price.value || 0);


    if (!name) {

      throw new Error("Please enter a service name.");

    }


    if (!slug) {

      throw new Error("Please enter a service URL slug.");

    }


    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {

      throw new Error(
        "The URL slug can only contain lowercase letters, numbers and hyphens."
      );

    }


    if (!description) {

      throw new Error("Please enter a service description.");

    }


    if (
      !["fixed", "starting_from", "quote"].includes(pricingType)
    ) {

      throw new Error("Please select a valid pricing type.");

    }


    if (
      pricingType !== "quote" &&
      (!Number.isFinite(price) || price <= 0)
    ) {

      throw new Error(
        "Please enter a price greater than zero."
      );

    }


    if (
      !["NGN", "USD"].includes(elements.currency.value)
    ) {

      throw new Error("Please select a valid currency.");

    }


    const imageUrl = elements.imageUrl.value.trim();


    if (imageUrl) {

      let parsedUrl;

      try {

        parsedUrl = new URL(imageUrl);

      } catch {

        throw new Error("Please enter a valid image URL.");

      }


      if (!["http:", "https:"].includes(parsedUrl.protocol)) {

        throw new Error("Image URL must use HTTP or HTTPS.");

      }

    }


    const imageFile =
      elements.imageFile.files[0] || null;


    if (imageFile) {

      validateImageFile(imageFile);

    }


    return {

      name,

      slug,

      description,

      image_url: imageUrl || null,

      imageFile,

      pricing_type: pricingType,

      price: pricingType === "quote" ? 0 : price,

      currency: elements.currency.value,

      is_active: elements.isActive.checked,

      is_featured: elements.isFeatured.checked,

      display_order: Math.max(
        0,
        Math.floor(
          Number(elements.displayOrder.value) || 0
        )
      ),

      updated_at: new Date().toISOString()

    };

  }


  /* =======================================================
     16. CHECK SLUG AVAILABILITY
  ======================================================= */

  async function checkSlugAvailability(slug, currentId = null) {

    let query = supabase
      .from(TABLE)
      .select("id")
      .eq("slug", slug)
      .limit(1);


    if (currentId) {

      query = query.neq("id", currentId);

    }


    const { data, error } = await query;

    if (error) throw error;


    return !data || data.length === 0;

  }


  /* =======================================================
     17. SAVE SERVICE
  ======================================================= */

  async function saveService(event) {

    event.preventDefault();

    if (isSaving) return;


    clearFormMessage();


    let payload;

    try {

      payload = validateServiceForm();

    } catch (error) {

      showFormMessage(error.message);

      return;

    }


    const currentId =
      elements.serviceId.value || null;


    const existingService = currentId
      ? allServices.find(service => service.id === currentId)
      : null;


    const oldImagePath = existingService
      ? getManagedServiceImagePath(existingService.image_url)
      : null;


    let uploadedImagePath = null;

    let newImageUrl = payload.image_url;


    isSaving = true;

    elements.saveButton.disabled = true;

    elements.cancelButton.disabled = true;

    elements.closeModal.disabled = true;


    try {

      const slugAvailable = await checkSlugAvailability(
        payload.slug,
        currentId
      );


      if (!slugAvailable) {

        throw new Error(
          "This service slug is already in use. Please choose another."
        );

      }


      /* -----------------------------------------------
         UPLOAD IMAGE IF A NEW FILE WAS SELECTED
      ------------------------------------------------ */

      if (payload.imageFile) {

        elements.saveButton.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>Uploading Image...</span>
        `;

        showFormMessage(
          "Uploading your service image...",
          "success"
        );


        const uploadResult = await uploadServiceImage(
          payload.imageFile,
          payload.slug
        );


        uploadedImagePath = uploadResult.path;

        newImageUrl = uploadResult.url;

        payload.image_url = newImageUrl;

      }


      /* -----------------------------------------------
         SAVE SERVICE RECORD
      ------------------------------------------------ */

      elements.saveButton.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>Saving Service...</span>
      `;

      showFormMessage(
        "Saving service details...",
        "success"
      );


      delete payload.imageFile;


      let result;


      if (currentId) {

        result = await supabase
          .from(TABLE)
          .update(payload)
          .eq("id", currentId)
          .select()
          .single();

      } else {

        result = await supabase
          .from(TABLE)
          .insert(payload)
          .select()
          .single();

      }


      if (result.error) throw result.error;


      /* -----------------------------------------------
         DELETE OLD MANAGED IMAGE AFTER SUCCESSFUL SAVE
      ------------------------------------------------ */

      const newManagedImagePath =
        getManagedServiceImagePath(newImageUrl);


      if (
        oldImagePath &&
        oldImagePath !== newManagedImagePath
      ) {

        await deleteServiceImage(oldImagePath);

      }


      /* -----------------------------------------------
         SUCCESS
      ------------------------------------------------ */

      elements.imageUrl.value = newImageUrl || "";

      elements.imageFile.value = "";

      revokePreviewObjectUrl();

      renderImagePreview(newImageUrl || "");


      showFormMessage(
        currentId
          ? "Service updated successfully."
          : "Service added successfully.",
        "success"
      );


      await loadServices();


      setTimeout(() => {

        closeModal();

      }, 900);


    } catch (error) {

      console.error(
        "HAFHASS Admin Services: Save failed:",
        error
      );


      /* -----------------------------------------------
         CLEAN UP NEW UPLOAD IF DATABASE SAVE FAILED
      ------------------------------------------------ */

      if (uploadedImagePath) {

        await deleteServiceImage(uploadedImagePath);

      }


      showFormMessage(
        error.message ||
        "Unable to save this service. Please try again."
      );

    } finally {

      isSaving = false;

      elements.saveButton.disabled = false;

      elements.cancelButton.disabled = false;

      elements.closeModal.disabled = false;

      elements.saveButton.innerHTML = `
        <i class="fas fa-save"></i>
        <span>Save Service</span>
      `;

    }

  }


  /* =======================================================
     18. TOGGLE SERVICE STATUS
  ======================================================= */

  async function toggleServiceStatus(serviceId) {

    const service = allServices.find(
      item => item.id === serviceId
    );

    if (!service) return;


    const newStatus = !service.is_active;

    const action = newStatus ? "activate" : "deactivate";


    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${service.name}"?`
    );

    if (!confirmed) return;


    try {

      const { error } = await supabase
        .from(TABLE)
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", serviceId);


      if (error) throw error;


      await loadServices();


    } catch (error) {

      console.error(
        "HAFHASS Admin Services: Status update failed:",
        error
      );

      window.alert(
        error.message ||
        "Unable to update service status."
      );

    }

  }


  /* =======================================================
     19. TABLE ACTIONS
  ======================================================= */

  elements.tableBody.addEventListener("click", event => {

    const button = event.target.closest("[data-action]");

    if (!button) return;


    const action = button.dataset.action;

    const serviceId = button.dataset.id;


    const service = allServices.find(
      item => item.id === serviceId
    );

    if (!service) return;


    if (action === "edit") {

      openModal(service);

    }


    if (action === "toggle") {

      toggleServiceStatus(serviceId);

    }

  });


  /* =======================================================
     20. AUTOMATIC SLUG GENERATION
  ======================================================= */

  elements.name.addEventListener("input", () => {

    if (!slugManuallyEdited) {

      elements.slug.value =
        createSlug(elements.name.value);

    }

  });


  elements.slug.addEventListener("input", () => {

    slugManuallyEdited = true;

    elements.slug.value = createSlug(
      elements.slug.value
    );

  });


  /* =======================================================
     21. IMAGE EVENTS
  ======================================================= */

  elements.imageUrl.addEventListener("input", () => {

    const url = elements.imageUrl.value.trim();


    // Choosing a URL instead of a file clears the pending upload.
    if (elements.imageFile.files.length > 0) {

      elements.imageFile.value = "";

    }


    clearFormMessage();

    renderImagePreview(url);

  });


  elements.imageFile.addEventListener("change", () => {

    const file = elements.imageFile.files[0];

    if (file) {

      previewImageFile(file);

    }

  });


  /* =======================================================
     22. PRICING EVENTS
  ======================================================= */

  elements.pricingType.addEventListener(
    "change",
    updatePriceField
  );


  /* =======================================================
     23. SEARCH AND FILTER EVENTS
  ======================================================= */

  elements.search.addEventListener(
    "input",
    applyFilters
  );


  elements.statusFilter.addEventListener(
    "change",
    applyFilters
  );


  elements.pricingFilter.addEventListener(
    "change",
    applyFilters
  );


  elements.featuredFilter.addEventListener(
    "change",
    applyFilters
  );


  elements.clearFilters.addEventListener("click", () => {

    elements.search.value = "";

    elements.statusFilter.value = "all";

    elements.pricingFilter.value = "all";

    elements.featuredFilter.value = "all";

    applyFilters();

  });


  /* =======================================================
     24. MODAL EVENTS
  ======================================================= */

  elements.addButton.addEventListener("click", () => {

    openModal();

  });


  elements.emptyAddButton.addEventListener("click", () => {

    openModal();

  });


  elements.closeModal.addEventListener(
    "click",
    closeModal
  );


  elements.cancelButton.addEventListener(
    "click",
    closeModal
  );


  elements.modalOverlay.addEventListener("click", event => {

    if (event.target === elements.modalOverlay) {

      closeModal();

    }

  });


  document.addEventListener("keydown", event => {

    if (
      event.key === "Escape" &&
      !elements.modalOverlay.hidden
    ) {

      closeModal();

    }

  });


  elements.form.addEventListener(
    "submit",
    saveService
  );


  /* =======================================================
     25. RETRY
  ======================================================= */

  if (elements.retryButton) {

    elements.retryButton.addEventListener(
      "click",
      loadServices
    );

  }


  /* =======================================================
     26. INITIALIZE
  ======================================================= */

  async function initialize() {

    renderDate();

    showLoading();


    try {

      await waitForAdminAuthentication();

      await loadServices();

    } catch (error) {

      console.error(
        "HAFHASS Admin Services: Initialization failed:",
        error
      );

      showError(
        "Admin access could not be verified. Please refresh the page or sign in again."
      );

    }

  }


  initialize();


});