/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN CATEGORY MANAGEMENT
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     1. CONFIGURATION
  ======================================================= */

  const supabase = window.hafhassSupabase;

  const STORAGE_BUCKET = "gallery-images";

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  const ITEMS_PER_PAGE = 10;

  const QUERY_PAGE_SIZE = 1000;

  const ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];


  /* =======================================================
     2. STATE
  ======================================================= */

  let categories = [];

  let filteredCategories = [];

  let productCounts = new Map();

  let currentPage = 1;

  let selectedImage = null;

  let existingImageUrl = null;

  let editingCategory = null;

  let savingCategory = false;

  let manuallyEditedSlug = false;


  /* =======================================================
     3. DOM ELEMENTS
  ======================================================= */

  const $ = id => document.getElementById(id);

  const elements = {

    addButton: $("addCategoryButton"),

    total: $("categoryTotalCount"),
    activeCount: $("categoryActiveCount"),
    inactiveCount: $("categoryInactiveCount"),
    subcategoryCount: $("categorySubcategoryCount"),

    search: $("categorySearch"),
    statusFilter: $("categoryStatusFilter"),
    typeFilter: $("categoryTypeFilter"),

    resultCount: $("categoryResultCount"),

    loading: $("categoriesLoading"),
    error: $("categoriesError"),
    errorMessage: $("categoriesErrorMessage"),
    retryButton: $("retryCategoriesButton"),

    empty: $("categoriesEmpty"),
    emptyAddButton: $("emptyAddCategoryButton"),

    noResults: $("categoriesNoResults"),
    clearFiltersButton: $("clearCategoryFilters"),

    tableContainer: $("categoriesTableContainer"),
    tableBody: $("categoriesTableBody"),

    pagination: $("categoriesPagination"),
    paginationInfo: $("categoriesPaginationInfo"),
    previousButton: $("previousCategoriesPage"),
    pageNumber: $("categoriesPageNumber"),
    nextButton: $("nextCategoriesPage"),

    modal: $("categoryModalOverlay"),
    modalTitle: $("categoryModalTitle"),
    closeModal: $("closeCategoryModal"),

    form: $("categoryForm"),
    editingId: $("editingCategoryId"),

    name: $("categoryName"),
    slug: $("categorySlug"),
    parent: $("categoryParent"),
    description: $("categoryDescription"),

    imageInput: $("categoryImage"),
    imagePreview: $("categoryImagePreview"),

    displayOrder: $("categoryDisplayOrder"),
    active: $("categoryActive"),

    formMessage: $("categoryFormMessage"),

    saveButton: $("saveCategoryButton"),
    cancelButton: $("cancelCategoryForm")

  };


  /* =======================================================
     4. GENERAL HELPERS
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


  function slugify(value) {

    return String(value ?? "")

      .toLowerCase()

      .trim()

      .replace(/[^a-z0-9]+/g, "-")

      .replace(/^-+|-+$/g, "");

  }


  function generateUUID() {

    if (window.crypto && typeof window.crypto.randomUUID === "function") {

      return window.crypto.randomUUID();

    }

    throw new Error(
      "Your browser does not support secure ID generation."
    );

  }


  function showFormMessage(message, type = "error") {

    elements.formMessage.textContent = message;

    elements.formMessage.className =
      `admin-category-form-message ${type}`;

    elements.formMessage.hidden = false;

  }


  function clearFormMessage() {

    elements.formMessage.textContent = "";

    elements.formMessage.className =
      "admin-category-form-message";

    elements.formMessage.hidden = true;

  }


  function setButtonLoading(isLoading) {

    elements.saveButton.disabled = isLoading;

    elements.cancelButton.disabled = isLoading;

    elements.closeModal.disabled = isLoading;

    elements.saveButton.innerHTML = isLoading

      ? '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'

      : '<i class="fa-solid fa-floppy-disk"></i> Save Category';

  }


  function showPageState(state) {

    const states = [

      elements.loading,
      elements.error,
      elements.empty,
      elements.noResults,
      elements.tableContainer

    ];

    states.forEach(item => {

      if (item) item.hidden = true;

    });

    if (elements.pagination) {

      elements.pagination.hidden = true;

    }

    if (state === "loading") {

      elements.loading.hidden = false;

    }

    if (state === "error") {

      elements.error.hidden = false;

    }

    if (state === "empty") {

      elements.empty.hidden = false;

    }

    if (state === "no-results") {

      elements.noResults.hidden = false;

    }

    if (state === "table") {

      elements.tableContainer.hidden = false;

    }

  }


  function showError(message) {

    console.error("HAFHASS Categories:", message);

    elements.errorMessage.textContent =
      message || "Something went wrong while loading categories.";

    showPageState("error");

  }


  /* =======================================================
     5. ADMIN AUTHENTICATION READINESS
  ======================================================= */

  function waitForAdminAuthentication() {

    return new Promise((resolve, reject) => {

      const startedAt = Date.now();

      const timeout = 15000;

      function check() {

        if (document.body.classList.contains("admin-authenticated")) {

          resolve(true);

          return;

        }

        if (Date.now() - startedAt >= timeout) {

          reject(
            new Error("Admin authentication could not be verified.")
          );

          return;

        }

        setTimeout(check, 150);

      }

      check();

    });

  }


  /* =======================================================
     6. STORAGE HELPERS
  ======================================================= */

  function getCategoryImagePath(imageUrl) {

    if (!imageUrl) return null;

    try {

      const url = new URL(imageUrl);

      const marker =
        `/storage/v1/object/public/${STORAGE_BUCKET}/`;

      const index = url.pathname.indexOf(marker);

      if (index === -1) return null;

      return decodeURIComponent(
        url.pathname.substring(index + marker.length)
      );

    } catch (error) {

      return null;

    }

  }


  async function deleteStorageImage(imageUrl) {

    const path = getCategoryImagePath(imageUrl);

    if (!path) return;

    const { error } = await supabase.storage

      .from(STORAGE_BUCKET)

      .remove([path]);

    if (error) {

      console.warn(
        "Could not remove category image from storage:",
        error
      );

    }

  }


  async function uploadCategoryImage(file, categoryId) {

    if (!file) return null;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {

      throw new Error(
        "Please select a JPEG, PNG or WebP image."
      );

    }

    if (file.size > MAX_IMAGE_SIZE) {

      throw new Error(
        "The image must not exceed 10MB."
      );

    }

    const extension = file.type === "image/jpeg"

      ? "jpg"

      : file.type === "image/png"

        ? "png"

        : "webp";

    const safeName = file.name

      .replace(/\.[^/.]+$/, "")

      .replace(/[^a-zA-Z0-9-_]/g, "-")

      .substring(0, 60);

    const filePath =

      `categories/${categoryId}/` +

      `${generateUUID()}-${safeName}.${extension}`;


    const { error: uploadError } = await supabase.storage

      .from(STORAGE_BUCKET)

      .upload(filePath, file, {

        contentType: file.type,

        cacheControl: "3600",

        upsert: false

      });


    if (uploadError) {

      throw uploadError;

    }


    const { data } = supabase.storage

      .from(STORAGE_BUCKET)

      .getPublicUrl(filePath);


    return {

      url: data.publicUrl,

      path: filePath

    };

  }


  async function cleanupUploadedImage(uploadedImage) {

    if (!uploadedImage?.path) return;

    const { error } = await supabase.storage

      .from(STORAGE_BUCKET)

      .remove([uploadedImage.path]);

    if (error) {

      console.warn(
        "Could not clean up uploaded image:",
        error
      );

    }

  }


  /* =======================================================
     7. SHARED IMAGE REFERENCES
  ======================================================= */

  async function replaceSharedImage(oldUrl, newUrl) {

    if (!oldUrl || !newUrl || oldUrl === newUrl) {

      return;

    }

    const { error } = await supabase

      .from("categories")

      .update({

        image_url: newUrl,

        updated_at: new Date().toISOString()

      })

      .eq("image_url", oldUrl);


    if (error) {

      throw error;

    }


    await deleteStorageImage(oldUrl);

  }


  async function removeSharedImageReferences(imageUrl) {

    if (!imageUrl) return;

    const { error } = await supabase

      .from("categories")

      .update({

        image_url: null,

        updated_at: new Date().toISOString()

      })

      .eq("image_url", imageUrl);


    if (error) {

      throw error;

    }


    await deleteStorageImage(imageUrl);

  }


  async function cleanupUnusedCategoryImage(imageUrl) {

    if (!imageUrl) return;

    const { count, error } = await supabase

      .from("categories")

      .select("id", {

        count: "exact",

        head: true

      })

      .eq("image_url", imageUrl);


    if (error) {

      console.warn(
        "Could not verify remaining image references:",
        error
      );

      return;

    }

    if (count === 0) {

      await deleteStorageImage(imageUrl);

    }

  }


  /* =======================================================
     8. LOAD PRODUCT COUNTS
  ======================================================= */

  async function loadProductCounts() {

    productCounts = new Map();

    let from = 0;

    while (true) {

      const to = from + QUERY_PAGE_SIZE - 1;

      const { data, error } = await supabase

        .from("products")

        .select("category_id")

        .not("category_id", "is", null)

        .range(from, to);


      if (error) {

        throw error;

      }

      if (!data || data.length === 0) {

        break;

      }

      data.forEach(product => {

        const categoryId = product.category_id;

        if (!categoryId) return;

        productCounts.set(

          categoryId,

          (productCounts.get(categoryId) || 0) + 1

        );

      });


      if (data.length < QUERY_PAGE_SIZE) {

        break;

      }

      from += QUERY_PAGE_SIZE;

    }

  }


  /* =======================================================
     9. LOAD CATEGORIES
  ======================================================= */

  async function loadCategories() {

    showPageState("loading");

    try {

      const { data, error } = await supabase

        .from("categories")

        .select("*")

        .order("display_order", {

          ascending: true

        })

        .order("name", {

          ascending: true

        });


      if (error) {

        throw error;

      }


      categories = data || [];


      await loadProductCounts();


      updateStatistics();

      populateParentOptions();

      applyFilters();

    } catch (error) {

      showError(error.message);

    }

  }


  /* =======================================================
     10. STATISTICS
  ======================================================= */

  function updateStatistics() {

    const total = categories.length;

    const active = categories.filter(

      category => category.is_active

    ).length;

    const inactive = total - active;

    const subcategories = categories.filter(

      category => category.parent_id

    ).length;


    elements.total.textContent = total;

    elements.activeCount.textContent = active;

    elements.inactiveCount.textContent = inactive;

    elements.subcategoryCount.textContent = subcategories;

  }


  /* =======================================================
     11. PARENT CATEGORY OPTIONS
  ======================================================= */

  function populateParentOptions(excludedId = null) {

    const mainCategories = categories.filter(category => {

      return !category.parent_id && category.id !== excludedId;

    });


    elements.parent.innerHTML =

      '<option value="">None — Main Category</option>';


    mainCategories.forEach(category => {

      const option = document.createElement("option");

      option.value = category.id;

      option.textContent = category.name;

      elements.parent.appendChild(option);

    });

  }


  /* =======================================================
     12. FILTERING
  ======================================================= */

  function applyFilters() {

    const search = elements.search.value

      .trim()

      .toLowerCase();

    const status = elements.statusFilter.value;

    const type = elements.typeFilter.value;


    filteredCategories = categories.filter(category => {

      const matchesSearch =

        !search ||

        category.name.toLowerCase().includes(search) ||

        (category.slug || "").toLowerCase().includes(search) ||

        (category.description || "").toLowerCase().includes(search);


      const matchesStatus =

        status === "all" ||

        (status === "active" && category.is_active) ||

        (status === "inactive" && !category.is_active);


      const matchesType =

        type === "all" ||

        (type === "parent" && !category.parent_id) ||

        (type === "subcategory" && !!category.parent_id);


      return matchesSearch && matchesStatus && matchesType;

    });


    currentPage = 1;

    renderCategories();

  }


  /* =======================================================
     13. TABLE RENDERING
  ======================================================= */

  function renderCategories() {

    elements.resultCount.textContent =

      `${filteredCategories.length} ` +

      `${filteredCategories.length === 1 ? "category" : "categories"} found`;


    if (!categories.length) {

      showPageState("empty");

      return;

    }


    if (!filteredCategories.length) {

      showPageState("no-results");

      return;

    }


    showPageState("table");


    const totalPages = Math.ceil(

      filteredCategories.length / ITEMS_PER_PAGE

    );


    currentPage = Math.min(currentPage, totalPages);


    const start = (currentPage - 1) * ITEMS_PER_PAGE;

    const pageItems = filteredCategories.slice(

      start,

      start + ITEMS_PER_PAGE

    );


    elements.tableBody.innerHTML = "";


    pageItems.forEach(category => {

      const parent = categories.find(

        item => item.id === category.parent_id

      );

      const productCount =

        productCounts.get(category.id) || 0;


      const row = document.createElement("tr");


      row.innerHTML = `

        <td>

          <div class="admin-category-cell">

            <div class="admin-category-image">

              ${
                category.image_url

                  ? `<img
                      src="${escapeHTML(category.image_url)}"
                      alt="${escapeHTML(category.name)}"
                      loading="lazy"
                    >`

                  : '<i class="fa-solid fa-image"></i>'
              }

            </div>

            <div class="admin-category-info">

              <strong>
                ${escapeHTML(category.name)}
              </strong>

              <small>
                ${escapeHTML(category.slug)}
              </small>

            </div>

          </div>

        </td>


        <td>

          <span class="admin-category-type-label">

            ${category.parent_id ? "Subcategory" : "Main Category"}

          </span>

        </td>


        <td>

          <span class="admin-category-parent">

            ${parent ? escapeHTML(parent.name) : "—"}

          </span>

        </td>


        <td>

          <span class="admin-category-product-count">

            ${productCount}

          </span>

        </td>


        <td>

          <span class="admin-category-order">

            ${Number(category.display_order) || 0}

          </span>

        </td>


        <td>

          <span class="admin-category-badge ${
            category.is_active ? "active" : "inactive"
          }">

            ${category.is_active ? "Active" : "Inactive"}

          </span>

        </td>


        <td>

          <div class="admin-category-actions">

            <button
              type="button"
              class="admin-category-action-button edit"
              data-action="edit"
              data-id="${category.id}"
              title="Edit category"
              aria-label="Edit ${escapeHTML(category.name)}"
            >

              <i class="fa-solid fa-pen"></i>

            </button>


            <button
              type="button"
              class="admin-category-action-button toggle"
              data-action="toggle"
              data-id="${category.id}"
              title="${category.is_active ? "Deactivate" : "Activate"} category"
              aria-label="${category.is_active ? "Deactivate" : "Activate"} ${escapeHTML(category.name)}"
            >

              <i class="fa-solid ${
                category.is_active
                  ? "fa-toggle-on"
                  : "fa-toggle-off"
              }"></i>

            </button>


            <button
              type="button"
              class="admin-category-action-button delete"
              data-action="delete"
              data-id="${category.id}"
              title="Delete category"
              aria-label="Delete ${escapeHTML(category.name)}"
            >

              <i class="fa-solid fa-trash"></i>

            </button>

          </div>

        </td>

      `;


      elements.tableBody.appendChild(row);

    });


    renderPagination(totalPages);

  }


  /* =======================================================
     14. PAGINATION
  ======================================================= */

  function renderPagination(totalPages) {

    const start =

      (currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(

      currentPage * ITEMS_PER_PAGE,

      filteredCategories.length

    );


    elements.paginationInfo.textContent =

      `Showing ${start}–${end} of ${filteredCategories.length}`;


    elements.pageNumber.textContent =

      `Page ${currentPage} of ${totalPages}`;


    elements.previousButton.disabled = currentPage <= 1;

    elements.nextButton.disabled = currentPage >= totalPages;


    elements.pagination.hidden = totalPages <= 1;

  }


  function changePage(direction) {

    const totalPages = Math.ceil(

      filteredCategories.length / ITEMS_PER_PAGE

    );

    currentPage += direction;

    currentPage = Math.max(

      1,

      Math.min(currentPage, totalPages)

    );

    renderCategories();

  }


  /* =======================================================
     15. MODAL MANAGEMENT
  ======================================================= */

  function openModal() {

    elements.modal.hidden = false;

    document.body.style.overflow = "hidden";

  }


  function closeModal() {

    if (savingCategory) return;

    elements.modal.hidden = true;

    document.body.style.overflow = "";

    resetForm();

  }


  function resetForm() {

    elements.form.reset();

    elements.editingId.value = "";

    elements.modalTitle.textContent = "Add New Category";

    selectedImage = null;

    existingImageUrl = null;

    editingCategory = null;

    manuallyEditedSlug = false;

    elements.imageInput.value = "";

    elements.imagePreview.innerHTML = "";

    elements.imagePreview.hidden = true;

    elements.active.checked = true;

    clearFormMessage();

    populateParentOptions();

  }


  /* =======================================================
     16. OPEN ADD CATEGORY
  ======================================================= */

  function openAddCategory() {

    resetForm();

    openModal();

    elements.name.focus();

  }


  /* =======================================================
     17. IMAGE PREVIEW
  ======================================================= */

  function renderImagePreview(imageUrl) {

    if (!imageUrl) {

      elements.imagePreview.innerHTML = "";

      elements.imagePreview.hidden = true;

      return;

    }


    elements.imagePreview.hidden = false;


    elements.imagePreview.innerHTML = `

      <div class="admin-category-image-preview-item">

        <img
          src="${escapeHTML(imageUrl)}"
          alt="Category image preview"
        >

        <button
          type="button"
          class="admin-category-image-preview-remove"
          id="removeCategoryImage"
          aria-label="Remove category image"
          title="Remove image"
        >

          <i class="fa-solid fa-xmark"></i>

        </button>

      </div>

    `;

  }


  function handleImageSelection(event) {

    const file = event.target.files[0];

    if (!file) return;


    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {

      alert("Please select a JPEG, PNG or WebP image.");

      elements.imageInput.value = "";

      return;

    }


    if (file.size > MAX_IMAGE_SIZE) {

      alert("The image must not exceed 10MB.");

      elements.imageInput.value = "";

      return;

    }


    selectedImage = file;


    const reader = new FileReader();


    reader.onload = event => {

      renderImagePreview(event.target.result);

    };


    reader.readAsDataURL(file);

  }


  function removeSelectedImage() {

    selectedImage = null;

    existingImageUrl = null;

    elements.imageInput.value = "";

    renderImagePreview(null);

  }


  /* =======================================================
     18. OPEN EDIT CATEGORY
  ======================================================= */

  function editCategory(id) {

    const category = categories.find(

      item => item.id === id

    );

    if (!category) return;


    resetForm();


    editingCategory = category;

    elements.editingId.value = category.id;

    elements.modalTitle.textContent = "Edit Category";


    elements.name.value = category.name || "";

    elements.slug.value = category.slug || "";

    elements.description.value = category.description || "";

    elements.displayOrder.value =

      category.display_order ?? 0;

    elements.active.checked = !!category.is_active;


    existingImageUrl = category.image_url || null;


    populateParentOptions(category.id);


    elements.parent.value = category.parent_id || "";


    renderImagePreview(existingImageUrl);


    manuallyEditedSlug = false;


    openModal();

  }


  /* =======================================================
     19. FORM VALIDATION
  ======================================================= */

  function validateCategory() {

    const name = elements.name.value.trim();

    const slug = slugify(elements.slug.value);

    const parentId = elements.parent.value || null;

    const displayOrder = Number(elements.displayOrder.value);


    if (!name) {

      throw new Error("Please enter a category name.");

    }


    if (!slug) {

      throw new Error("Please enter a valid category slug.");

    }


    if (name.length > 120) {

      throw new Error(
        "Category name must not exceed 120 characters."
      );

    }


    if (slug.length > 150) {

      throw new Error(
        "Category slug must not exceed 150 characters."
      );

    }


    if (

      elements.displayOrder.value.trim() === "" ||

      !Number.isInteger(displayOrder) ||

      displayOrder < 0

    ) {

      throw new Error(
        "Display order must be a whole number greater than or equal to zero."
      );

    }


    if (parentId) {

      const parent = categories.find(

        category => category.id === parentId

      );


      if (!parent) {

        throw new Error("The selected parent category is invalid.");

      }


      if (parent.parent_id) {

        throw new Error(
          "Subcategories cannot contain other subcategories."
        );

      }


      if (parentId === elements.editingId.value) {

        throw new Error(
          "A category cannot be its own parent."
        );

      }

    }


    if (editingCategory && !editingCategory.parent_id && parentId) {

      const hasChildren = categories.some(

        category => category.parent_id === editingCategory.id

      );


      if (hasChildren) {

        throw new Error(
          "This category already has subcategories. Move those subcategories first before changing its category type."
        );

      }

    }


    return {

      name,

      slug,

      parent_id: parentId,

      description:

        elements.description.value.trim() || null,

      display_order: displayOrder,

      is_active: elements.active.checked,

      updated_at: new Date().toISOString()

    };

  }


  /* =======================================================
     20. CATEGORY IMAGE SAVE
  ======================================================= */

  async function processCategoryImage(categoryId, uploadedImage) {

    const oldImageUrl = editingCategory?.image_url || null;


    if (selectedImage) {

      uploadedImage = await uploadCategoryImage(

        selectedImage,

        categoryId

      );


      if (oldImageUrl) {

        await replaceSharedImage(

          oldImageUrl,

          uploadedImage.url

        );

      } else {

        const { error } = await supabase

          .from("categories")

          .update({

            image_url: uploadedImage.url,

            updated_at: new Date().toISOString()

          })

          .eq("id", categoryId);


        if (error) throw error;

      }


      return uploadedImage;

    }


    if (oldImageUrl && !existingImageUrl) {

      await removeSharedImageReferences(oldImageUrl);

    }


    return uploadedImage;

  }


  /* =======================================================
     21. SAVE CATEGORY
  ======================================================= */

  async function saveCategory(event) {

  event.preventDefault();

  if (savingCategory) return;

  savingCategory = true;

  setButtonLoading(true);

  clearFormMessage();

  let uploadedImage = null;
  let savedSuccessfully = false;

  try {

    if (!supabase) {
      throw new Error("Supabase connection is unavailable.");
    }

    const payload = validateCategory();

    const editingId = elements.editingId.value;

    const isEditing = !!editingId;

    let categoryId = editingId;


    /* ===============================================
       CREATE CATEGORY
    =============================================== */

    if (!isEditing) {

      categoryId = generateUUID();

      const { error } = await supabase

        .from("categories")

        .insert({

          id: categoryId,

          ...payload,

          image_url: null

        });

      if (error) throw error;

    }


    /* ===============================================
       UPDATE CATEGORY DETAILS
    =============================================== */

    else {

      const { error } = await supabase

        .from("categories")

        .update(payload)

        .eq("id", editingId);

      if (error) throw error;

    }


    /* ===============================================
       PROCESS IMAGE
    =============================================== */

    if (selectedImage || (editingCategory && !existingImageUrl)) {

      await processCategoryImage(

        categoryId,

        uploadedImage

      );

    }


    savedSuccessfully = true;


    /* ===============================================
       SHOW SUCCESS MESSAGE
    =============================================== */

    showFormMessage(

      isEditing

        ? "Category updated successfully!"

        : "Category created successfully!",

      "success"

    );


    /* ===============================================
       REFRESH CATEGORY LIST
    =============================================== */

    await loadCategories();


  } catch (error) {

    console.error("Save category error:", error);


    if (!savedSuccessfully && uploadedImage) {

      await cleanupUploadedImage(uploadedImage);

    }


    showFormMessage(

      error.message || "Unable to save category.",

      "error"

    );

    return;

  } finally {

    savingCategory = false;

    setButtonLoading(false);

  }


  /* ===============================================
     CLOSE MODAL AFTER SUCCESS
  =============================================== */

  if (savedSuccessfully) {

    setTimeout(() => {

      closeModal();

    }, 1500);

  }

}

  /* =======================================================
     22. TOGGLE CATEGORY STATUS
  ======================================================= */

  async function toggleCategory(id) {

    const category = categories.find(

      item => item.id === id

    );

    if (!category) return;


    const nextStatus = !category.is_active;


    const action = nextStatus

      ? "activate"

      : "deactivate";


    if (!confirm(

      `Are you sure you want to ${action} "${category.name}"?`

    )) {

      return;

    }


    try {

      const { error } = await supabase

        .from("categories")

        .update({

          is_active: nextStatus,

          updated_at: new Date().toISOString()

        })

        .eq("id", id);


      if (error) throw error;


      await loadCategories();


    } catch (error) {

      console.error("Toggle category error:", error);

      alert(
        error.message || "Unable to update category status."
      );

    }

  }


  /* =======================================================
     23. DELETE CATEGORY
  ======================================================= */

  async function deleteCategory(id) {

    const category = categories.find(

      item => item.id === id

    );

    if (!category) return;


    const children = categories.filter(

      item => item.parent_id === id

    );


    if (children.length) {

      alert(
        "This category contains subcategories. Delete or move those subcategories first."
      );

      return;

    }


    const productCount = productCounts.get(id) || 0;


    if (productCount > 0) {

      alert(

        `This category has ${productCount} assigned product(s). ` +

        "Move those products to another category before deleting it."

      );

      return;

    }


    if (!confirm(

      `Are you sure you want to delete "${category.name}"?\n\nThis action cannot be undone.`

    )) {

      return;

    }


    try {

      const { error } = await supabase

        .from("categories")

        .delete()

        .eq("id", id);


      if (error) throw error;


      await cleanupUnusedCategoryImage(category.image_url);


      await loadCategories();


    } catch (error) {

      console.error("Delete category error:", error);

      alert(

        error.message || "Unable to delete category."

      );

    }

  }


  /* =======================================================
     24. EVENT LISTENERS
  ======================================================= */

  function initializeEvents() {


    /* ADD CATEGORY */

    elements.addButton.addEventListener(

      "click",

      openAddCategory

    );


    elements.emptyAddButton.addEventListener(

      "click",

      openAddCategory

    );


    /* MODAL */

    elements.closeModal.addEventListener(

      "click",

      closeModal

    );


    elements.cancelButton.addEventListener(

      "click",

      closeModal

    );


    elements.modal.addEventListener("click", event => {

      if (event.target === elements.modal) {

        closeModal();

      }

    });


    document.addEventListener("keydown", event => {

      if (

        event.key === "Escape" &&

        !elements.modal.hidden

      ) {

        closeModal();

      }

    });


    /* FORM */

    elements.form.addEventListener(

      "submit",

      saveCategory

    );


    /* SEARCH AND FILTERS */

    elements.search.addEventListener(

      "input",

      applyFilters

    );


    elements.statusFilter.addEventListener(

      "change",

      applyFilters

    );


    elements.typeFilter.addEventListener(

      "change",

      applyFilters

    );


    elements.clearFiltersButton.addEventListener(

      "click",

      () => {

        elements.search.value = "";

        elements.statusFilter.value = "all";

        elements.typeFilter.value = "all";

        applyFilters();

      }

    );


    /* PAGINATION */

    elements.previousButton.addEventListener(

      "click",

      () => changePage(-1)

    );


    elements.nextButton.addEventListener(

      "click",

      () => changePage(1)

    );


    /* IMAGE */

    elements.imageInput.addEventListener(

      "change",

      handleImageSelection

    );


    elements.imagePreview.addEventListener("click", event => {

      const removeButton = event.target.closest(

        "#removeCategoryImage"

      );

      if (!removeButton) return;

      removeSelectedImage();

    });


    /* SLUG GENERATION */

    elements.name.addEventListener("input", () => {

      if (!manuallyEditedSlug) {

        elements.slug.value = slugify(

          elements.name.value

        );

      }

    });


    elements.slug.addEventListener("input", () => {

      manuallyEditedSlug = true;

    });


    /* TABLE ACTIONS */

    elements.tableBody.addEventListener("click", event => {

      const button = event.target.closest(

        "[data-action]"

      );

      if (!button) return;


      const id = button.dataset.id;

      const action = button.dataset.action;


      if (action === "edit") {

        editCategory(id);

      }


      if (action === "toggle") {

        toggleCategory(id);

      }


      if (action === "delete") {

        deleteCategory(id);

      }

    });


    /* RETRY */

    elements.retryButton.addEventListener(

      "click",

      loadCategories

    );

  }


  /* =======================================================
     25. INITIALIZATION
  ======================================================= */

  async function initialize() {

    try {

      if (!supabase) {

        throw new Error(
          "Supabase client is not available."
        );

      }


      await waitForAdminAuthentication();


      initializeEvents();


      await loadCategories();


      console.log(
        "HAFHASS Categories: Initialized successfully."
      );


    } catch (error) {

      showError(error.message);

    }

  }


  /* =======================================================
     26. START
  ======================================================= */

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      initialize

    );

  } else {

    initialize();

  }


})();