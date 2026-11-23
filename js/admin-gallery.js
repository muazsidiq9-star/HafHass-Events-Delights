/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN GALLERY MANAGEMENT
========================================================= */

(() => {
  "use strict";

  const supabase = window.hafhassSupabase;
  const BUCKET = "gallery-images";
  const STORAGE_PREFIX = "gallery/";
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const PAGE_SIZE = 12;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  let images = [];
  let filteredImages = [];
  let currentPage = 1;
  let selectedFiles = [];
  let editingImage = null;
  let saving = false;

  const $ = id => document.getElementById(id);
  const el = {
    add: $("addGalleryImageButton"),
    total: $("galleryTotalCount"),
    published: $("galleryPublishedCount"),
    drafts: $("galleryDraftCount"),
    featured: $("galleryFeaturedCount"),
    search: $("gallerySearch"),
    status: $("galleryStatusFilter"),
    category: $("galleryCategoryFilter"),
    reset: $("resetGalleryFilters"),
    resultCount: $("galleryResultCount"),
    loading: $("galleryAdminLoading"),
    error: $("galleryAdminError"),
    errorMessage: $("galleryAdminErrorMessage"),
    retry: $("retryGalleryLoad"),
    empty: $("galleryAdminEmpty"),
    emptyAdd: $("emptyUploadGalleryButton"),
    noResults: $("galleryAdminNoResults"),
    grid: $("adminGalleryGrid"),
    pagination: $("galleryAdminPagination"),
    paginationInfo: $("galleryPaginationInfo"),
    previous: $("galleryPreviousPage"),
    next: $("galleryNextPage"),
    pageNumber: $("galleryPageNumber"),
    overlay: $("galleryModalOverlay"),
    modalTitle: $("galleryModalTitle"),
    close: $("closeGalleryModal"),
    form: $("galleryImageForm"),
    editingId: $("editingGalleryImageId"),
    files: $("galleryImageFiles"),
    selectedFiles: $("gallerySelectedFiles"),
    filesGroup: $("galleryFilesGroup"),
    titleGroup: $("galleryTitleGroup"),
    title: $("galleryImageTitle"),
    categoryInput: $("galleryImageCategory"),
    suggestions: $("galleryCategorySuggestions"),
    order: $("galleryImageOrder"),
    description: $("galleryImageDescription"),
    altGroup: $("galleryAltGroup"),
    alt: $("galleryImageAlt"),
    featured: $("galleryImageFeatured"),
    publishedToggle: $("galleryImagePublished"),
    message: $("galleryFormMessage"),
    save: $("saveGalleryImageButton"),
    cancel: $("cancelGalleryForm")
  };

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function showState(state) {
    el.loading.hidden = state !== "loading";
    el.error.hidden = state !== "error";
    el.empty.hidden = state !== "empty";
    el.noResults.hidden = state !== "no-results";
    el.grid.hidden = state !== "grid";
    el.pagination.hidden = state !== "grid" || filteredImages.length <= PAGE_SIZE;
  }

  function showError(message) {
    el.errorMessage.textContent = message || "Unable to load gallery images.";
    showState("error");
  }

  function updateStats() {
    el.total.textContent = images.length;
    el.published.textContent = images.filter(item => item.is_published).length;
    el.drafts.textContent = images.filter(item => !item.is_published).length;
    el.featured.textContent = images.filter(item => item.is_featured).length;
  }

  function populateCategories() {
    const values = [...new Set(images.map(item => (item.category || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    const current = el.category.value;
    el.category.innerHTML = '<option value="all">All Categories</option>' +
      values.map(value => '<option value="' + escapeHTML(value) + '">' + escapeHTML(value) + '</option>').join("");

    el.suggestions.innerHTML = values.map(value =>
      '<option value="' + escapeHTML(value) + '"></option>'
    ).join("");

    if (values.includes(current)) el.category.value = current;
  }

  async function loadImages() {
    showState("loading");

    try {
      if (!supabase) throw new Error("Supabase client is unavailable.");

      const { data, error } = await supabase
        .from("gallery_images")
        .select("id,title,description,image_url,alt_text,category,is_featured,is_published,display_order,created_at,updated_at")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;

      images = data || [];
      updateStats();
      populateCategories();
      applyFilters();
    } catch (error) {
      console.error("HAFHASS gallery load error:", error);
      showError(error.message);
    }
  }

  function applyFilters() {
    const term = el.search.value.trim().toLowerCase();
    const status = el.status.value;
    const category = el.category.value;

    filteredImages = images.filter(item => {
      const matchesText = !term || [
        item.title, item.description, item.alt_text, item.category
      ].some(value => String(value || "").toLowerCase().includes(term));

      const matchesStatus = status === "all" ||
        (status === "published" && item.is_published) ||
        (status === "draft" && !item.is_published) ||
        (status === "featured" && item.is_featured);

      const matchesCategory = category === "all" || (item.category || "") === category;
      return matchesText && matchesStatus && matchesCategory;
    });

    currentPage = 1;
    el.resultCount.textContent = "Showing " + filteredImages.length + " of " + images.length + " images";

    if (!images.length) {
      showState("empty");
      return;
    }

    if (!filteredImages.length) {
      showState("no-results");
      return;
    }

    renderPage();
  }

  function renderPage() {
    const totalPages = Math.max(1, Math.ceil(filteredImages.length / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredImages.slice(start, start + PAGE_SIZE);

    el.grid.innerHTML = pageItems.map(item => {
      const statusClass = item.is_published ? "is-published" : "is-draft";
      const statusText = item.is_published ? "Published" : "Draft";
      return `
        <article class="admin-gallery-card" data-id="${escapeHTML(item.id)}">
          <div class="admin-gallery-card-image">
            <img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.alt_text || item.title)}" loading="lazy">
            <span class="admin-gallery-status ${statusClass}">${statusText}</span>
            ${item.is_featured ? '<span class="admin-gallery-featured"><i class="fa-solid fa-star"></i> Featured</span>' : ""}
          </div>
          <div class="admin-gallery-card-content">
            <div class="admin-gallery-card-meta">
              <span>${escapeHTML(item.category || "Uncategorised")}</span>
              <span>Order: ${Number(item.display_order) || 0}</span>
            </div>
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.description || "No description added.")}</p>
            <div class="admin-gallery-card-actions">
              <button type="button" data-action="edit" data-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.title)}"><i class="fa-solid fa-pen"></i> Edit</button>
              <button type="button" data-action="publish" data-id="${escapeHTML(item.id)}" aria-label="${item.is_published ? "Unpublish" : "Publish"} ${escapeHTML(item.title)}"><i class="fa-solid ${item.is_published ? "fa-eye-slash" : "fa-eye"}"></i> ${item.is_published ? "Unpublish" : "Publish"}</button>
              <button type="button" data-action="feature" data-id="${escapeHTML(item.id)}" aria-label="Toggle featured"><i class="fa-solid fa-star"></i></button>
              <button type="button" class="is-danger" data-action="delete" data-id="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.title)}"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>
        </article>`;
    }).join("");

    el.paginationInfo.textContent = "Showing " + (start + 1) + "–" +
      Math.min(start + PAGE_SIZE, filteredImages.length) + " of " + filteredImages.length + " images";
    el.pageNumber.textContent = currentPage + " / " + totalPages;
    el.previous.disabled = currentPage <= 1;
    el.next.disabled = currentPage >= totalPages;
    showState("grid");
  }

  function slugFilename(name) {
    return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ").trim().replace(/\b\w/g, char => char.toUpperCase()) || "HAFHASS Creation";
  }

  function setMessage(message, type) {
    el.message.textContent = message;
    el.message.className = "admin-gallery-form-message " + (type || "");
    el.message.hidden = !message;
  }

  function setSaving(value) {
    saving = value;
    el.save.disabled = value;
    el.save.innerHTML = value
      ? '<i class="fa-solid fa-spinner fa-spin"></i> Saving...'
      : '<i class="fa-solid fa-floppy-disk"></i> Save Images';
  }

  function renderSelectedFiles() {
    el.selectedFiles.innerHTML = selectedFiles.map((file, index) =>
      '<div class="admin-gallery-selected-file"><i class="fa-regular fa-image"></i><span>' +
      escapeHTML(file.name) + '</span><small>' + (file.size / 1024 / 1024).toFixed(2) +
      ' MB</small><button type="button" data-remove-file="' + index + '" aria-label="Remove file"><i class="fa-solid fa-xmark"></i></button></div>'
    ).join("");
  }

  function resetForm() {
    el.form.reset();
    el.editingId.value = "";
    selectedFiles = [];
    editingImage = null;
    el.files.value = "";
    el.selectedFiles.replaceChildren();
    el.files.multiple = true;
    el.filesGroup.hidden = false;
    el.titleGroup.hidden = false;
    el.altGroup.hidden = false;
    el.title.required = false;
    el.modalTitle.textContent = "Upload Gallery Images";
    el.save.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Images';
    setMessage("", "");
  }

  function openModal(item = null) {
    resetForm();
    editingImage = item;
    if (item) {
      el.modalTitle.textContent = "Edit Gallery Image";
      el.editingId.value = item.id;
      el.files.multiple = false;
      el.titleGroup.hidden = false;
      el.title.value = item.title || "";
      el.title.required = true;
      el.categoryInput.value = item.category || "";
      el.order.value = Number(item.display_order) || 0;
      el.description.value = item.description || "";
      el.alt.value = item.alt_text || "";
      el.featured.checked = !!item.is_featured;
      el.publishedToggle.checked = !!item.is_published;
      el.save.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
    } else {
      el.title.required = false;
      el.title.placeholder = "Optional for bulk uploads; filenames become titles";
    }
    el.overlay.hidden = false;
    document.body.classList.add("admin-gallery-modal-open");
    (item ? el.title : el.files).focus();
  }

  function closeModal() {
    if (saving) return;
    el.overlay.hidden = true;
    document.body.classList.remove("admin-gallery-modal-open");
    resetForm();
  }

  function validateFiles(files) {
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Only JPEG, PNG and WebP images are supported.");
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(file.name + " exceeds the 10MB image limit.");
      }
    }
  }

  function makeStoragePath(file) {
    const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    return STORAGE_PREFIX + crypto.randomUUID() + "." + extension;
  }

  async function uploadFile(file) {
    const path = makeStoragePath(file);
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { path, url: data.publicUrl };
  }

  async function removeUploadedPaths(paths) {
    if (!paths.length) return;
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) console.warn("Gallery upload cleanup failed:", error);
  }

  function getManagedGalleryPath(url) {
    try {
      const parsed = new URL(url);
      const marker = "/storage/v1/object/public/" + BUCKET + "/";
      const index = parsed.pathname.indexOf(marker);
      if (index < 0) return null;
      const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
      return path.startsWith(STORAGE_PREFIX) ? path : null;
    } catch (_) {
      return null;
    }
  }

  async function saveNewImages(files) {
    const uploadedPaths = [];
    const rows = [];

    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const uploaded = await uploadFile(file);
      uploadedPaths.push(uploaded.path);

      const generatedTitle = files.length === 1 && el.title.value.trim()
        ? el.title.value.trim()
        : slugFilename(file.name);

      rows.push({
        title: generatedTitle,
        description: el.description.value.trim() || null,
        image_url: uploaded.url,
        alt_text: files.length === 1 && el.alt.value.trim()
          ? el.alt.value.trim()
          : generatedTitle,
        category: el.categoryInput.value.trim() || null,
        is_featured: el.featured.checked,
        is_published: el.publishedToggle.checked,
        display_order: (Number(el.order.value) || 0) + index
      });
    }

    const { error } = await supabase.from("gallery_images").insert(rows);
    if (error) {
      await removeUploadedPaths(uploadedPaths);
      throw error;
    }
  }

  async function saveEditedImage(file) {
    const id = el.editingId.value;
    const payload = {
      title: el.title.value.trim(),
      description: el.description.value.trim() || null,
      category: el.categoryInput.value.trim() || null,
      alt_text: el.alt.value.trim() || el.title.value.trim(),
      is_featured: el.featured.checked,
      is_published: el.publishedToggle.checked,
      display_order: Number(el.order.value) || 0,
      updated_at: new Date().toISOString()
    };

    let uploaded = null;
    if (file) {
      uploaded = await uploadFile(file);
      payload.image_url = uploaded.url;
    }

    const { error } = await supabase.from("gallery_images").update(payload).eq("id", id);
    if (error) {
      if (uploaded) await removeUploadedPaths([uploaded.path]);
      throw error;
    }

    if (uploaded) {
      const oldPath = getManagedGalleryPath(editingImage.image_url);
      if (oldPath) await removeUploadedPaths([oldPath]);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    setMessage("", "");

    try {
      if (editingImage) {
        const files = el.files.files;
        if (files.length > 1) throw new Error("Choose only one replacement image.");
        validateFiles(files);
        if (!el.title.value.trim()) throw new Error("Please enter an image title.");
        setSaving(true);
        await saveEditedImage(files[0] || null);
        setMessage("Gallery image updated successfully.", "success");
      } else {
        if (!selectedFiles.length) throw new Error("Please choose at least one image.");
        validateFiles(selectedFiles);
        setSaving(true);
        await saveNewImages(selectedFiles);
        setMessage(selectedFiles.length + " gallery image(s) uploaded successfully.", "success");
      }

      await loadImages();
      setTimeout(closeModal, 800);
    } catch (error) {
      console.error("Gallery save error:", error);
      setMessage(error.message || "Unable to save gallery images.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateImage(id, changes, successMessage) {
    try {
      const { error } = await supabase.from("gallery_images")
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await loadImages();
    } catch (error) {
      console.error("Gallery update error:", error);
      alert(error.message || successMessage || "Unable to update image.");
    }
  }

  async function deleteImage(id) {
    const item = images.find(image => image.id === id);
    if (!item) return;
    if (!confirm('Delete "' + item.title + '" from the gallery? This cannot be undone.')) return;

    try {
      const { error } = await supabase.from("gallery_images").delete().eq("id", id);
      if (error) throw error;

      const path = getManagedGalleryPath(item.image_url);
      if (path) await removeUploadedPaths([path]);

      await loadImages();
    } catch (error) {
      console.error("Gallery delete error:", error);
      alert(error.message || "Unable to delete gallery image.");
    }
  }

  function initializeEvents() {
    el.add.addEventListener("click", () => openModal());
    el.emptyAdd.addEventListener("click", () => openModal());
    el.close.addEventListener("click", closeModal);
    el.cancel.addEventListener("click", closeModal);
    el.overlay.addEventListener("click", event => {
      if (event.target === el.overlay) closeModal();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !el.overlay.hidden) closeModal();
    });

    el.files.addEventListener("change", () => {
      const files = [...el.files.files];
      try {
        validateFiles(files);
        selectedFiles = files;
        renderSelectedFiles();
        if (!editingImage && files.length === 1 && !el.title.value.trim()) {
          el.title.value = slugFilename(files[0].name);
        }
      } catch (error) {
        el.files.value = "";
        selectedFiles = [];
        renderSelectedFiles();
        setMessage(error.message, "error");
      }
    });

    el.selectedFiles.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-file]");
      if (!button) return;
      const index = Number(button.dataset.removeFile);
      selectedFiles.splice(index, 1);
      const transfer = new DataTransfer();
      selectedFiles.forEach(file => transfer.items.add(file));
      el.files.files = transfer.files;
      renderSelectedFiles();
    });

    el.form.addEventListener("submit", handleSubmit);
    el.search.addEventListener("input", applyFilters);
    el.status.addEventListener("change", applyFilters);
    el.category.addEventListener("change", applyFilters);
    el.reset.addEventListener("click", () => {
      el.search.value = "";
      el.status.value = "all";
      el.category.value = "all";
      applyFilters();
    });
    el.retry.addEventListener("click", loadImages);
    el.previous.addEventListener("click", () => {
      if (currentPage > 1) { currentPage--; renderPage(); }
    });
    el.next.addEventListener("click", () => {
      if (currentPage < Math.ceil(filteredImages.length / PAGE_SIZE)) {
        currentPage++;
        renderPage();
      }
    });

    el.grid.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;
      const item = images.find(image => image.id === id);
      if (!item) return;

      if (action === "edit") openModal(item);
      if (action === "publish") {
        updateImage(id, { is_published: !item.is_published },
          item.is_published ? "Unable to unpublish image." : "Unable to publish image.");
      }
      if (action === "feature") updateImage(id, { is_featured: !item.is_featured });
      if (action === "delete") deleteImage(id);
    });
  }

  function waitForAdminAuthentication() {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if (document.body.classList.contains("admin-authenticated")) return resolve(true);
        if (Date.now() - started >= 15000) return reject(new Error("Admin authentication could not be verified."));
        setTimeout(check, 150);
      };
      check();
    });
  }

  async function initialize() {
    try {
      if (!supabase) throw new Error("Supabase client is unavailable.");
      await waitForAdminAuthentication();
      initializeEvents();
      await loadImages();
      console.log("HAFHASS Gallery Management initialized.");
    } catch (error) {
      console.error("Gallery initialization error:", error);
      showError(error.message);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
