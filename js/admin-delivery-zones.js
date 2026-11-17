/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN DELIVERY ZONES MANAGEMENT

   Hierarchical delivery coverage:
   State → LGA → Settlement → Area → Specific Location

   Searchable Location Selection Modal
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

  const PAGE_SIZE = 10;
  const DATABASE_PAGE_SIZE = 1000;

  let allDeliveryZones = [];
  let filteredDeliveryZones = [];

  let states = [];
  let lgas = [];
  let settlements = [];
  let areas = [];
  let locations = [];

  let currentPage = 1;
  let zoneToDelete = null;

  let isSaving = false;
  let isDeleting = false;
  let isLoading = false;
  let isUpdatingZone = false;

  let activePickerField = null;
  let pickerOptions = [];
  let pickerPreviousFocus = null;


  /* =====================================================
     3. DOM ELEMENTS
  ====================================================== */

  const elements = {

    // Statistics
    totalZonesCount: document.getElementById("totalZonesCount"),
    activeZonesCount: document.getElementById("activeZonesCount"),
    inactiveZonesCount: document.getElementById("inactiveZonesCount"),

    // Search and filters
    search: document.getElementById("deliveryZonesSearch"),
    statusFilter: document.getElementById("deliveryZonesStatusFilter"),
    clearFilters: document.getElementById("clearDeliveryZoneFilters"),

    // Results
    resultCount: document.getElementById("deliveryZonesResultCount"),
    refreshButton: document.getElementById("refreshDeliveryZonesButton"),

    // Main actions
    addButton: document.getElementById("addDeliveryZoneButton"),
    emptyAddButton: document.getElementById("emptyAddDeliveryZoneButton"),

    // Page states
    loading: document.getElementById("deliveryZonesLoading"),
    error: document.getElementById("deliveryZonesError"),
    errorMessage: document.getElementById("deliveryZonesErrorMessage"),
    retryButton: document.getElementById("retryDeliveryZonesButton"),
    empty: document.getElementById("deliveryZonesEmpty"),
    noResults: document.getElementById("deliveryZonesNoResults"),
    clearSearch: document.getElementById("clearDeliveryZoneSearch"),

    // Table
    tableContainer: document.getElementById("deliveryZonesTableContainer"),
    tableBody: document.getElementById("deliveryZonesTableBody"),

    // Pagination
    pagination: document.getElementById("deliveryZonesPagination"),
    paginationInfo: document.getElementById("deliveryZonesPaginationInfo"),
    previousPage: document.getElementById("previousDeliveryZonesPage"),
    pageNumber: document.getElementById("deliveryZonesPageNumber"),
    nextPage: document.getElementById("nextDeliveryZonesPage"),

    // Main modal
    modal: document.getElementById("deliveryZoneModalOverlay"),
    modalTitle: document.getElementById("deliveryZoneModalTitle"),
    closeModal: document.getElementById("closeDeliveryZoneModal"),
    form: document.getElementById("deliveryZoneForm"),
    zoneId: document.getElementById("deliveryZoneId"),

    // Hierarchy controls
    level: document.getElementById("deliveryZoneLevel"),

    state: document.getElementById("deliveryZoneState"),

    lgaGroup: document.getElementById("deliveryZoneLgaGroup"),
    lga: document.getElementById("deliveryZoneLga"),

    settlementGroup: document.getElementById("deliveryZoneSettlementGroup"),
    settlement: document.getElementById("deliveryZoneSettlement"),

    areaGroup: document.getElementById("deliveryZoneAreaGroup"),
    area: document.getElementById("deliveryZoneArea"),

    locationGroup: document.getElementById("deliveryZoneLocationGroup"),
    location: document.getElementById("deliveryZoneLocation"),

    previewGroup: document.getElementById("deliveryZoneLocationPreviewGroup"),
    preview: document.getElementById("deliveryZoneLocationPreview"),

    // Searchable location picker
    pickerModal: document.getElementById("deliveryLocationPickerModal"),
    pickerTitle: document.getElementById("deliveryLocationPickerTitle"),
    pickerDescription: document.getElementById("deliveryLocationPickerDescription"),
    pickerSearch: document.getElementById("deliveryLocationPickerSearch"),
    pickerResults: document.getElementById("deliveryLocationPickerResults"),
    pickerResultCount: document.getElementById("deliveryLocationPickerResultCount"),
    pickerEmpty: document.getElementById("deliveryLocationPickerEmpty"),
    pickerClearSearch: document.getElementById("clearDeliveryLocationPickerSearch"),
    pickerClose: document.getElementById("closeDeliveryLocationPicker"),
    pickerCancel: document.getElementById("cancelDeliveryLocationPicker"),

    // Fee and status
    fee: document.getElementById("deliveryZoneFee"),
    status: document.getElementById("deliveryZoneStatus"),

    // Form actions
    formMessage: document.getElementById("deliveryZoneFormMessage"),
    saveButton: document.getElementById("saveDeliveryZoneButton"),
    cancelModal: document.getElementById("cancelDeliveryZoneModal"),

    // Delete modal
    deleteModal: document.getElementById("deleteDeliveryZoneModal"),
    deleteTitle: document.getElementById("deleteDeliveryZoneTitle"),
    deleteMessage: document.getElementById("deleteDeliveryZoneMessage"),
    cancelDelete: document.getElementById("cancelDeleteDeliveryZone"),
    confirmDelete: document.getElementById("confirmDeleteDeliveryZone"),

    // Shared layout
    currentDate: document.getElementById("adminCurrentDate")

  };


  /* =====================================================
     4. INITIALIZATION
  ====================================================== */

  init();


  function init() {

    setCurrentDate();

    bindEvents();

    configureLocationPickerFields();

    loadPageData();

  }


  /* =====================================================
     5. EVENT LISTENERS
  ====================================================== */

  function bindEvents() {

    elements.addButton?.addEventListener("click", openAddModal);
    elements.emptyAddButton?.addEventListener("click", openAddModal);

    elements.search?.addEventListener("input", () => {
      currentPage = 1;
      applyFilters();
    });

    elements.statusFilter?.addEventListener("change", () => {
      currentPage = 1;
      applyFilters();
    });

    elements.clearFilters?.addEventListener("click", clearFilters);
    elements.clearSearch?.addEventListener("click", clearFilters);

    elements.refreshButton?.addEventListener("click", loadPageData);
    elements.retryButton?.addEventListener("click", loadPageData);

    elements.previousPage?.addEventListener("click", () => {

      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }

    });

    elements.nextPage?.addEventListener("click", () => {

      const totalPages = Math.ceil(
        filteredDeliveryZones.length / PAGE_SIZE
      );

      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }

    });

    elements.form?.addEventListener("submit", handleFormSubmit);

    elements.level?.addEventListener("change", handleLevelChange);

    elements.state?.addEventListener("change", handleStateChange);
    elements.lga?.addEventListener("change", handleLgaChange);
    elements.settlement?.addEventListener("change", handleSettlementChange);

    elements.area?.addEventListener("change", updateLocationPreview);
    elements.location?.addEventListener("change", updateLocationPreview);

    // Searchable picker
    elements.pickerSearch?.addEventListener("input", filterPickerOptions);

    elements.pickerClearSearch?.addEventListener("click", () => {

      if (elements.pickerSearch) {
        elements.pickerSearch.value = "";
      }

      filterPickerOptions();

      elements.pickerSearch?.focus();

    });

    elements.pickerResults?.addEventListener("click", handlePickerSelection);

    elements.pickerClose?.addEventListener("click", closeLocationPicker);
    elements.pickerCancel?.addEventListener("click", closeLocationPicker);

    elements.pickerModal?.addEventListener("click", event => {

      if (event.target === elements.pickerModal) {
        closeLocationPicker();
      }

    });

    // Main modal
    elements.closeModal?.addEventListener("click", closeFormModal);
    elements.cancelModal?.addEventListener("click", closeFormModal);

    elements.modal?.addEventListener("click", event => {

      if (event.target === elements.modal) {
        closeFormModal();
      }

    });

    // Delete modal
    elements.cancelDelete?.addEventListener("click", closeDeleteModal);
    elements.confirmDelete?.addEventListener("click", handleDelete);

    elements.deleteModal?.addEventListener("click", event => {

      if (event.target === elements.deleteModal) {
        closeDeleteModal();
      }

    });

    elements.tableBody?.addEventListener("click", handleTableActions);

    document.addEventListener("keydown", handleGlobalKeydown);

  }


  /* =====================================================
     6. CONFIGURE SEARCHABLE SELECT FIELDS
  ====================================================== */

  function configureLocationPickerFields() {

    const fields = [
      elements.state,
      elements.lga,
      elements.settlement,
      elements.area,
      elements.location
    ];

    fields.forEach(field => {

      if (!field) return;

      field.setAttribute("aria-haspopup", "dialog");
      field.setAttribute("aria-expanded", "false");
      field.setAttribute("aria-readonly", "true");

      /*
        Prevent the browser's native select menu from opening.
        The existing select remains the actual form value holder.
      */

      field.addEventListener("pointerdown", event => {

        if (field.disabled) return;

        event.preventDefault();

      });

      field.addEventListener("click", event => {

        event.preventDefault();

        if (field.disabled) return;

        openLocationPicker(field);

      });

      field.addEventListener("keydown", event => {

        if (
          event.key === "Enter" ||
          event.key === " "
        ) {

          event.preventDefault();

          if (!field.disabled) {
            openLocationPicker(field);
          }

        }

      });

    });

  }


  /* =====================================================
     7. GLOBAL KEYBOARD EVENTS
  ====================================================== */

  function handleGlobalKeydown(event) {

    if (event.key !== "Escape") return;

    if (elements.pickerModal && !elements.pickerModal.hidden) {

      event.stopPropagation();
      closeLocationPicker();

      return;

    }

    closeFormModal();
    closeDeleteModal();

  }


  /* =====================================================
     8. DATE
  ====================================================== */

  function setCurrentDate() {

    if (!elements.currentDate) return;

    elements.currentDate.textContent =
      new Intl.DateTimeFormat("en-NG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(new Date());

  }


  /* =====================================================
     9. DATABASE PAGINATION
  ====================================================== */

  async function fetchAllRows(tableName, columns = "*") {

    const rows = [];

    let start = 0;

    while (true) {

      const end = start + DATABASE_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .order("id", { ascending: true })
        .range(start, end);

      if (error) {
        throw error;
      }

      const batch = data || [];

      rows.push(...batch);

      if (batch.length < DATABASE_PAGE_SIZE) {
        break;
      }

      start += DATABASE_PAGE_SIZE;

    }

    return rows;

  }


  /* =====================================================
     10. LOAD PAGE DATA
  ====================================================== */

  async function loadPageData() {

    if (isLoading) return;

    isLoading = true;

    showState("loading");

    if (elements.refreshButton) {
      elements.refreshButton.disabled = true;
    }

    try {

      const [
        stateRows,
        lgaRows,
        settlementRows,
        areaRows,
        locationRows,
        zoneRows
      ] = await Promise.all([

        fetchAllRows("delivery_states"),
        fetchAllRows("delivery_lgas"),
        fetchAllRows("delivery_cities"),
        fetchAllRows("delivery_areas"),
        fetchAllRows("delivery_location_nodes"),
        fetchAllRows("delivery_zones")

      ]);

      states = stateRows;
      lgas = lgaRows;
      settlements = settlementRows;
      areas = areaRows;
      locations = locationRows;

      allDeliveryZones = zoneRows;

      updateStatistics();

      populateStateSelect();

      applyFilters();

    } catch (error) {

      console.error("Delivery zones loading failed:", error);

      showError(getErrorMessage(error));

    } finally {

      isLoading = false;

      if (elements.refreshButton) {
        elements.refreshButton.disabled = false;
      }

    }

  }


  /* =====================================================
     11. LOCATION LOOKUPS
  ====================================================== */

  function getState(id) {

    return states.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function getLga(id) {

    return lgas.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function getSettlement(id) {

    return settlements.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function getArea(id) {

    return areas.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function getLocation(id) {

    return locations.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function getStateForLga(lga) {

    return lga
      ? getState(lga.state_id)
      : null;

  }


  function getLgaForSettlement(settlement) {

    return settlement
      ? getLga(settlement.lga_id)
      : null;

  }


  function getSettlementForArea(area) {

    return area
      ? getSettlement(area.city_id)
      : null;

  }


  function getSettlementForLocation(location) {

    return location
      ? getSettlement(location.settlement_id)
      : null;

  }


  function getAreaForZone(zone) {

    return zone?.area_id
      ? getArea(zone.area_id)
      : null;

  }


  function getLocationForZone(zone) {

    return zone?.location_node_id
      ? getLocation(zone.location_node_id)
      : null;

  }


  function getZoneLevel(zone) {

    if (zone.location_node_id) return "location";
    if (zone.area_id) return "area";
    if (zone.city_id) return "settlement";
    if (zone.lga_id) return "lga";
    if (zone.state_id) return "state";

    return "unknown";

  }


  /* =====================================================
     12. SPECIFIC LOCATION HIERARCHY
  ====================================================== */

  function getLocationPath(location) {

    if (!location) return [];

    const path = [];
    const visited = new Set();

    let current = location;

    while (current) {

      const id = String(current.id);

      if (visited.has(id)) {

        console.warn(
          "Circular delivery location hierarchy detected:",
          id
        );

        break;

      }

      visited.add(id);

      path.unshift(current);

      if (!current.parent_id) {
        break;
      }

      current = getLocation(current.parent_id);

    }

    return path;

  }


  function validateLocationAncestry(
    location,
    settlementId,
    allowInactive = false
  ) {

    if (!location || !settlementId) {
      return {
        valid: false,
        reason: "Missing location or settlement."
      };
    }

    const visited = new Set();

    let current = location;

    while (current) {

      const id = String(current.id);

      if (visited.has(id)) {

        return {
          valid: false,
          reason: "Circular location hierarchy detected."
        };

      }

      visited.add(id);

      if (
        String(current.settlement_id) !== String(settlementId)
      ) {

        return {
          valid: false,
          reason: "Location hierarchy crosses settlements."
        };

      }

      if (!allowInactive && current.is_active !== true) {

        return {
          valid: false,
          reason: "Location or one of its parent locations is inactive."
        };

      }

      if (!current.parent_id) {
        break;
      }

      const parent = getLocation(current.parent_id);

      if (!parent) {

        return {
          valid: false,
          reason: "A parent location could not be found."
        };

      }

      current = parent;

    }

    return {
      valid: true,
      reason: null
    };

  }


  function getLocationPathLabel(location) {

    if (!location) return "";

    return getLocationPath(location)
      .map(item => item.name)
      .filter(Boolean)
      .join(" → ");

  }


  function getLocationOptionLabel(location) {

    const path = getLocationPathLabel(location);

    const type = location.place_type
      ? ` (${formatPlaceType(location.place_type)})`
      : "";

    return `${path}${type}`;

  }


  /* =====================================================
     13. EXISTING SELECTION HELPERS
  ====================================================== */

  function getCurrentEditingZone() {

    const id = elements.zoneId?.value?.trim();

    if (!id) return null;

    return allDeliveryZones.find(
      zone => String(zone.id) === String(id)
    ) || null;

  }


  function isUnchangedSelection(field, selectedId) {

    if (!selectedId) return false;

    const currentZone = getCurrentEditingZone();

    if (!currentZone) return false;

    return String(currentZone[field] || "") === String(selectedId);

  }


  function isActiveOrUnchanged(record, field, selectedId) {

    if (!record) return false;

    return record.is_active === true ||
      isUnchangedSelection(field, selectedId);

  }


  /* =====================================================
     14. POPULATE LOCATION SELECTS
  ====================================================== */

  function populateStateSelect(selectedId = "") {

    if (!elements.state) return;

    const rows = states
      .filter(item =>
        item.is_active === true ||
        String(item.id) === String(selectedId)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    elements.state.innerHTML =
      '<option value="">Select a state</option>' +

      rows.map(item => {

        const inactive = item.is_active !== true
          ? " (Inactive)"
          : "";

        return `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name + inactive)}
          </option>
        `;

      }).join("");

    elements.state.value = selectedId
      ? String(selectedId)
      : "";

  }


  function populateLgaSelect(stateId, selectedId = "") {

    if (!elements.lga) return;

    const rows = lgas
      .filter(item =>
        String(item.state_id) === String(stateId) &&
        (
          item.is_active === true ||
          String(item.id) === String(selectedId)
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    elements.lga.innerHTML =
      '<option value="">Select an LGA</option>' +

      rows.map(item => {

        const inactive = item.is_active !== true
          ? " (Inactive)"
          : "";

        return `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name + inactive)}
          </option>
        `;

      }).join("");

    elements.lga.disabled = rows.length === 0;

    elements.lga.value = selectedId
      ? String(selectedId)
      : "";

  }


  function populateSettlementSelect(lgaId, selectedId = "") {

    if (!elements.settlement) return;

    const rows = settlements
      .filter(item =>
        String(item.lga_id) === String(lgaId) &&
        (
          item.is_active === true ||
          String(item.id) === String(selectedId)
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    elements.settlement.innerHTML =
      '<option value="">Select a settlement</option>' +

      rows.map(item => {

        const inactive = item.is_active !== true
          ? " (Inactive)"
          : "";

        return `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name + inactive)}
          </option>
        `;

      }).join("");

    elements.settlement.disabled = rows.length === 0;

    elements.settlement.value = selectedId
      ? String(selectedId)
      : "";

  }


  function populateAreaSelect(settlementId, selectedId = "") {

    if (!elements.area) return;

    const rows = areas
      .filter(item =>
        String(item.city_id) === String(settlementId) &&
        (
          item.is_active === true ||
          String(item.id) === String(selectedId)
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    elements.area.innerHTML =
      '<option value="">Select an area</option>' +

      rows.map(item => {

        const inactive = item.is_active !== true
          ? " (Inactive)"
          : "";

        return `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(item.name + inactive)}
          </option>
        `;

      }).join("");

    elements.area.disabled = rows.length === 0;

    elements.area.value = selectedId
      ? String(selectedId)
      : "";

  }


  function populateLocationSelect(settlementId, selectedId = "") {

    if (!elements.location) return;

    const rows = locations
      .filter(item => {

        if (
          String(item.settlement_id) !== String(settlementId)
        ) {
          return false;
        }

        const isCurrentlySelected =
          selectedId &&
          String(item.id) === String(selectedId);

        const ancestry = validateLocationAncestry(
          item,
          settlementId,
          false
        );

        return ancestry.valid || isCurrentlySelected;

      })
      .sort((a, b) => {

        const labelA = getLocationOptionLabel(a);
        const labelB = getLocationOptionLabel(b);

        return labelA.localeCompare(labelB);

      });

    elements.location.innerHTML =
      '<option value="">Select a specific location</option>' +

      rows.map(item => {

        const ancestry = validateLocationAncestry(
          item,
          settlementId,
          false
        );

        const inactive = !ancestry.valid
          ? " (Inactive or invalid hierarchy)"
          : "";

        return `
          <option value="${escapeHTML(item.id)}">
            ${escapeHTML(getLocationOptionLabel(item) + inactive)}
          </option>
        `;

      }).join("");

    elements.location.disabled = rows.length === 0;

    elements.location.value = selectedId
      ? String(selectedId)
      : "";

  }


  /* =====================================================
     15. SEARCHABLE LOCATION PICKER
  ====================================================== */

  function getPickerConfiguration(field) {

    if (field === elements.state) {

      return {
        key: "state_id",
        title: "Select State",
        description: "Search and select a state.",
        placeholder: "Search states...",
        rows: states
          .filter(item =>
            item.is_active === true ||
            isUnchangedSelection("state_id", item.id)
          )
          .map(item => ({
            id: item.id,
            name: item.name,
            subtitle: item.is_active === true
              ? "State"
              : "Inactive state",
            searchable: item.name
          }))
      };

    }


    if (field === elements.lga) {

      const stateId = elements.state.value;

      return {
        key: "lga_id",
        title: "Select Local Government Area",
        description: "Search for an LGA within the selected state.",
        placeholder: "Search LGAs...",
        rows: lgas
          .filter(item =>
            String(item.state_id) === String(stateId) &&
            (
              item.is_active === true ||
              isUnchangedSelection("lga_id", item.id)
            )
          )
          .map(item => ({
            id: item.id,
            name: item.name,
            subtitle: item.is_active === true
              ? getStateForLga(item)?.name || "Local Government Area"
              : "Inactive LGA",
            searchable: `${item.name} ${getStateForLga(item)?.name || ""}`
          }))
      };

    }


    if (field === elements.settlement) {

      const lgaId = elements.lga.value;

      return {
        key: "city_id",
        title: "Select Settlement",
        description: "Search for a settlement within the selected LGA.",
        placeholder: "Search settlements...",
        rows: settlements
          .filter(item =>
            String(item.lga_id) === String(lgaId) &&
            (
              item.is_active === true ||
              isUnchangedSelection("city_id", item.id)
            )
          )
          .map(item => ({
            id: item.id,
            name: item.name,
            subtitle: getLga(item.lga_id)?.name || "Settlement",
            searchable: `${item.name} ${getLga(item.lga_id)?.name || ""}`
          }))
      };

    }


    if (field === elements.area) {

      const settlementId = elements.settlement.value;

      return {
        key: "area_id",
        title: "Select Area",
        description: "Search for an area within the selected settlement.",
        placeholder: "Search areas...",
        rows: areas
          .filter(item =>
            String(item.city_id) === String(settlementId) &&
            (
              item.is_active === true ||
              isUnchangedSelection("area_id", item.id)
            )
          )
          .map(item => ({
            id: item.id,
            name: item.name,
            subtitle: getSettlement(item.city_id)?.name || "Area",
            searchable: `${item.name} ${getSettlement(item.city_id)?.name || ""}`
          }))
      };

    }


    if (field === elements.location) {

      const settlementId = elements.settlement.value;

      return {
        key: "location_node_id",
        title: "Select Specific Location",
        description: "Search for a street, landmark, market, junction or other listed location.",
        placeholder: "Search specific locations...",
        rows: locations
          .filter(item => {

            if (
              String(item.settlement_id) !== String(settlementId)
            ) {
              return false;
            }

            const unchanged = isUnchangedSelection(
              "location_node_id",
              item.id
            );

            const ancestry = validateLocationAncestry(
              item,
              settlementId,
              false
            );

            return ancestry.valid || unchanged;

          })
          .map(item => {

            const ancestry = validateLocationAncestry(
              item,
              settlementId,
              false
            );

            return {
              id: item.id,
              name: item.name,
              subtitle: ancestry.valid
                ? getLocationPathLabel(item)
                : "Existing inactive or invalid selection",
              searchable: `${getLocationOptionLabel(item)} ${item.place_type || ""}`,
              inactive: !ancestry.valid
            };

          })
      };

    }

    return null;

  }


  function openLocationPicker(field) {

    if (!elements.pickerModal || !field) return;

    if (field.disabled) return;

    const config = getPickerConfiguration(field);

    if (!config) return;

    // Prevent selection before the required parent is chosen.

    if (
      field === elements.lga &&
      !elements.state.value
    ) {
      return;
    }

    if (
      field === elements.settlement &&
      !elements.lga.value
    ) {
      return;
    }

    if (
      (field === elements.area || field === elements.location) &&
      !elements.settlement.value
    ) {
      return;
    }

    activePickerField = field;
    pickerPreviousFocus = field;

    pickerOptions = config.rows;

    if (elements.pickerTitle) {
      elements.pickerTitle.textContent = config.title;
    }

    if (elements.pickerDescription) {
      elements.pickerDescription.textContent = config.description;
    }

    if (elements.pickerSearch) {
      elements.pickerSearch.value = "";
      elements.pickerSearch.placeholder = config.placeholder;
    }

    if (elements.pickerClearSearch) {
      elements.pickerClearSearch.hidden = true;
    }

    renderPickerOptions(pickerOptions);

    field.setAttribute("aria-expanded", "true");

    showModal(elements.pickerModal);

    requestAnimationFrame(() => {
      elements.pickerSearch?.focus();
    });

  }


  function filterPickerOptions() {

    if (!elements.pickerSearch) return;

    const query = elements.pickerSearch.value
      .trim()
      .toLowerCase();

    if (elements.pickerClearSearch) {
      elements.pickerClearSearch.hidden = !query;
    }

    const filtered = pickerOptions.filter(option => {

      const searchable = [
        option.name,
        option.subtitle,
        option.searchable
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);

    });

    renderPickerOptions(filtered);

  }


  function renderPickerOptions(rows) {

    if (!elements.pickerResults) return;

    const total = rows.length;

    if (elements.pickerResultCount) {

      elements.pickerResultCount.textContent =
        `${formatNumber(total)} ${total === 1 ? "location" : "locations"} found`;

    }

    if (elements.pickerEmpty) {
      elements.pickerEmpty.hidden = total !== 0;
    }

    elements.pickerResults.hidden = total === 0;

    elements.pickerResults.innerHTML = rows.map(option => {

      const isSelected =
        activePickerField &&
        String(activePickerField.value) === String(option.id);

      return `
        <button
          type="button"
          class="delivery-location-picker-option${isSelected ? " selected" : ""}${option.inactive ? " inactive" : ""}"
          role="option"
          aria-selected="${isSelected}"
          data-picker-id="${escapeHTML(option.id)}"
        >

          <span class="delivery-location-picker-option-icon">
            <i class="fa-solid ${isSelected ? "fa-circle-check" : "fa-location-dot"}" aria-hidden="true"></i>
          </span>

          <span class="delivery-location-picker-option-details">

            <strong>
              ${escapeHTML(option.name)}
            </strong>

            <small>
              ${escapeHTML(option.subtitle || "")}
            </small>

          </span>

          ${isSelected
            ? '<span class="delivery-location-picker-selected-label">Selected</span>'
            : ""
          }

        </button>
      `;

    }).join("");

  }


  function handlePickerSelection(event) {

    const button = event.target.closest("[data-picker-id]");

    if (!button || !activePickerField) return;

    const selectedId = button.dataset.pickerId;

    const option = pickerOptions.find(
      item => String(item.id) === String(selectedId)
    );

    if (!option) return;

    const field = activePickerField;

    field.value = String(selectedId);

    closeLocationPicker();

    /*
      Trigger the original cascading handlers.
      This keeps all existing hierarchy behavior intact.
    */

    field.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    field.focus();

  }


  function closeLocationPicker() {

    if (!elements.pickerModal || elements.pickerModal.hidden) {
      return;
    }

    if (activePickerField) {
      activePickerField.setAttribute("aria-expanded", "false");
    }

    hideModal(elements.pickerModal);

    activePickerField = null;
    pickerOptions = [];

    if (elements.pickerResults) {
      elements.pickerResults.innerHTML = "";
    }

    if (elements.pickerSearch) {
      elements.pickerSearch.value = "";
    }

    const previousFocus = pickerPreviousFocus;

    pickerPreviousFocus = null;

    if (previousFocus && !previousFocus.disabled) {
      requestAnimationFrame(() => previousFocus.focus());
    }

  }


  /* =====================================================
     16. CASCADING SELECT EVENTS
  ====================================================== */

  function handleLevelChange() {

    const level = elements.level.value;

    elements.lgaGroup.hidden = ![
      "lga",
      "settlement",
      "area",
      "location"
    ].includes(level);

    elements.settlementGroup.hidden = ![
      "settlement",
      "area",
      "location"
    ].includes(level);

    elements.areaGroup.hidden = level !== "area";
    elements.locationGroup.hidden = level !== "location";

    resetSelect(elements.lga, "Select an LGA");
    resetSelect(elements.settlement, "Select a settlement");
    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    updateLocationPreview();

    if (elements.state.value) {
      handleStateChange();
    }

  }


  function handleStateChange() {

    const stateId = elements.state.value;
    const level = elements.level.value;

    resetSelect(elements.lga, "Select an LGA");
    resetSelect(elements.settlement, "Select a settlement");
    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    if (!stateId) {
      updateLocationPreview();
      return;
    }

    if (level !== "state") {
      populateLgaSelect(stateId);
    }

    updateLocationPreview();

  }


  function handleLgaChange() {

    const lgaId = elements.lga.value;
    const level = elements.level.value;

    resetSelect(elements.settlement, "Select a settlement");
    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    if (!lgaId) {
      updateLocationPreview();
      return;
    }

    if (level !== "lga") {
      populateSettlementSelect(lgaId);
    }

    updateLocationPreview();

  }


  function handleSettlementChange() {

    const settlementId = elements.settlement.value;
    const level = elements.level.value;

    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    if (!settlementId) {
      updateLocationPreview();
      return;
    }

    if (level === "area") {
      populateAreaSelect(settlementId);
    }

    if (level === "location") {
      populateLocationSelect(settlementId);
    }

    updateLocationPreview();

  }


  function updateLocationPreview() {

    if (!elements.preview || !elements.previewGroup) return;

    const level = elements.level.value;

    const state = getState(elements.state.value);
    const lga = getLga(elements.lga.value);
    const settlement = getSettlement(elements.settlement.value);
    const area = getArea(elements.area.value);
    const location = getLocation(elements.location.value);

    const parts = [];

    if (state) parts.push(state.name);
    if (lga) parts.push(lga.name);
    if (settlement) parts.push(settlement.name);

    if (level === "area" && area) {
      parts.push(area.name);
    }

    if (level === "location" && location) {

      getLocationPath(location).forEach(item => {
        parts.push(item.name);
      });

    }

    if (parts.length) {

      elements.preview.textContent = parts.join(" → ");
      elements.previewGroup.hidden = false;

    } else {

      elements.preview.textContent = "";
      elements.previewGroup.hidden = true;

    }

  }


  function resetSelect(select, placeholder) {

    if (!select) return;

    select.innerHTML =
      `<option value="">${escapeHTML(placeholder)}</option>`;

    select.value = "";
    select.disabled = true;

  }


  /* =====================================================
     17. STATISTICS
  ====================================================== */

  function updateStatistics() {

    const total = allDeliveryZones.length;

    const active = allDeliveryZones.filter(
      zone => zone.is_active === true
    ).length;

    const inactive = total - active;

    if (elements.totalZonesCount) {
      elements.totalZonesCount.textContent = formatNumber(total);
    }

    if (elements.activeZonesCount) {
      elements.activeZonesCount.textContent = formatNumber(active);
    }

    if (elements.inactiveZonesCount) {
      elements.inactiveZonesCount.textContent = formatNumber(inactive);
    }

  }


  /* =====================================================
     18. SEARCH AND FILTER
  ====================================================== */

  function applyFilters() {

    const searchTerm = (elements.search?.value || "")
      .trim()
      .toLowerCase();

    const selectedStatus = elements.statusFilter?.value || "all";

    filteredDeliveryZones = allDeliveryZones.filter(zone => {

      const location = getZoneLocationDetails(zone);

      const searchableText = [

        location.state,
        location.lga,
        location.settlement,
        location.area,
        location.specificLocation,
        location.locationPath,
        location.level

      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchTerm || searchableText.includes(searchTerm);

      let matchesStatus = true;

      if (selectedStatus === "active") {
        matchesStatus = zone.is_active === true;
      }

      if (selectedStatus === "inactive") {
        matchesStatus = zone.is_active === false;
      }

      return matchesSearch && matchesStatus;

    });

    const totalPages = Math.max(
      1,
      Math.ceil(filteredDeliveryZones.length / PAGE_SIZE)
    );

    currentPage = Math.min(currentPage, totalPages);

    updateResultCount();

    renderTable();

  }


  function clearFilters() {

    if (elements.search) {
      elements.search.value = "";
    }

    if (elements.statusFilter) {
      elements.statusFilter.value = "all";
    }

    currentPage = 1;

    applyFilters();

  }


  function updateResultCount() {

    if (!elements.resultCount) return;

    const total = filteredDeliveryZones.length;

    elements.resultCount.textContent =
      `${formatNumber(total)} ${total === 1 ? "zone" : "zones"} found`;

  }


  /* =====================================================
     19. LOCATION DETAILS
  ====================================================== */

  function getZoneLocationDetails(zone) {

    const level = getZoneLevel(zone);

    const state = getState(zone.state_id);
    const lga = getLga(zone.lga_id);
    const settlement = getSettlement(zone.city_id);
    const area = getArea(zone.area_id);
    const location = getLocation(zone.location_node_id);

    return {

      level,

      state: state?.name || zone.state || "",

      lga: lga?.name || "",

      settlement: settlement?.name || zone.city || "",

      area: area?.name || "",

      specificLocation: location?.name || "",

      locationPath: location
        ? getLocationPathLabel(location)
        : ""

    };

  }


  function getCoverageLabel(level) {

    const labels = {
      state: "State",
      lga: "LGA",
      settlement: "Settlement",
      area: "Area",
      location: "Specific Location"
    };

    return labels[level] || "Unknown";

  }


  function getZoneMainLocation(details) {

    switch (details.level) {

      case "state":
        return details.state;

      case "lga":
        return details.lga;

      case "settlement":
        return details.settlement;

      case "area":
        return details.area;

      case "location":
        return details.specificLocation;

      default:
        return details.settlement || details.state;

    }

  }


  /* =====================================================
     20. TABLE RENDERING
  ====================================================== */

  function renderTable() {

    const total = filteredDeliveryZones.length;

    if (allDeliveryZones.length === 0) {
      showState("empty");
      return;
    }

    if (total === 0) {
      showState("noResults");
      return;
    }

    if (!elements.tableBody) return;

    showState("table");

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const startIndex = (currentPage - 1) * PAGE_SIZE;

    const endIndex = Math.min(
      startIndex + PAGE_SIZE,
      total
    );

    const pageZones = filteredDeliveryZones.slice(
      startIndex,
      endIndex
    );

    elements.tableBody.innerHTML = pageZones
      .map(renderZoneRow)
      .join("");

    updatePagination(
      total,
      totalPages,
      startIndex,
      endIndex
    );

  }


  function renderZoneRow(zone) {

    const id = escapeHTML(zone.id);

    const details = getZoneLocationDetails(zone);

    const mainLocation = escapeHTML(
      getZoneMainLocation(details) || "Unknown location"
    );

    const state = escapeHTML(details.state || "—");
    const lga = escapeHTML(details.lga || "—");
    const settlement = escapeHTML(details.settlement || "—");

    const areaOrLocation = details.area ||
      details.locationPath ||
      details.specificLocation ||
      "";

    const extraLocation = areaOrLocation
      ? escapeHTML(areaOrLocation)
      : '<span class="delivery-zone-no-area">—</span>';

    const isActive = zone.is_active === true;

    const statusClass = isActive
      ? "active"
      : "inactive";

    const statusText = isActive
      ? "Active"
      : "Inactive";

    const levelLabel = escapeHTML(
      getCoverageLabel(details.level)
    );

    const fee = formatCurrency(zone.delivery_fee);

    return `

      <tr data-zone-id="${id}">

        <td>
          <div class="delivery-zone-location">
            <strong>${mainLocation}</strong>
          </div>
        </td>

        <td>${levelLabel}</td>

        <td>${state}</td>

        <td>${lga}</td>

        <td>${settlement}</td>

        <td>${extraLocation}</td>

        <td>
          <span class="delivery-zone-fee">
            ${fee}
          </span>
        </td>

        <td>
          <span class="delivery-zone-status ${statusClass}">
            <span class="delivery-zone-status-dot"></span>
            ${statusText}
          </span>
        </td>

        <td>
          <div class="delivery-zone-actions">

            <button
              type="button"
              class="delivery-zone-action edit"
              data-action="edit"
              data-id="${id}"
              title="Edit delivery zone"
              aria-label="Edit ${mainLocation} delivery zone"
            >
              <i class="fas fa-pen"></i>
            </button>

            <button
              type="button"
              class="delivery-zone-action toggle"
              data-action="toggle"
              data-id="${id}"
              title="${isActive ? "Deactivate" : "Activate"} delivery zone"
              aria-label="${isActive ? "Deactivate" : "Activate"} delivery zone"
            >
              <i class="fas ${isActive ? "fa-toggle-on" : "fa-toggle-off"}"></i>
            </button>

            <button
              type="button"
              class="delivery-zone-action delete"
              data-action="delete"
              data-id="${id}"
              title="Delete delivery zone"
              aria-label="Delete delivery zone"
            >
              <i class="fas fa-trash"></i>
            </button>

          </div>
        </td>

      </tr>

    `;

  }


  /* =====================================================
     21. PAGINATION
  ====================================================== */

  function updatePagination(
    total,
    totalPages,
    startIndex,
    endIndex
  ) {

    if (!elements.pagination) return;

    elements.pagination.hidden = total <= PAGE_SIZE;

    if (elements.paginationInfo) {

      elements.paginationInfo.textContent =
        `Showing ${startIndex + 1}–${endIndex} of ${total} zones`;

    }

    if (elements.pageNumber) {

      elements.pageNumber.textContent =
        `Page ${currentPage} of ${totalPages}`;

    }

    if (elements.previousPage) {
      elements.previousPage.disabled = currentPage <= 1;
    }

    if (elements.nextPage) {
      elements.nextPage.disabled = currentPage >= totalPages;
    }

  }


  /* =====================================================
     22. TABLE ACTIONS
  ====================================================== */

  async function handleTableActions(event) {

    const button = event.target.closest("[data-action]");

    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!id) return;

    const zone = allDeliveryZones.find(
      item => String(item.id) === String(id)
    );

    if (!zone) return;

    if (action === "edit") {

      await openEditModal(zone);

    } else if (action === "toggle") {

      await toggleZoneStatus(zone, button);

    } else if (action === "delete") {

      openDeleteModal(zone);

    }

  }


  /* =====================================================
     23. MODAL OPENING
  ====================================================== */

  function openAddModal() {

    if (!elements.form || !elements.modal) return;

    elements.form.reset();

    elements.zoneId.value = "";

    elements.modalTitle.textContent = "Add Delivery Zone";

    elements.level.value = "";

    elements.status.value = "true";
    elements.fee.value = "0";

    resetSelect(elements.lga, "Select an LGA");
    resetSelect(elements.settlement, "Select a settlement");
    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    populateStateSelect();

    elements.lgaGroup.hidden = true;
    elements.settlementGroup.hidden = true;
    elements.areaGroup.hidden = true;
    elements.locationGroup.hidden = true;

    elements.previewGroup.hidden = true;

    clearFormMessage();

    setSaveButtonState(false);

    showModal(elements.modal);

    elements.level?.focus();

  }


  async function openEditModal(zone) {

    if (!elements.form || !elements.modal) return;

    elements.form.reset();

    elements.zoneId.value = zone.id;

    elements.modalTitle.textContent = "Edit Delivery Zone";

    elements.fee.value = Number(zone.delivery_fee || 0);

    elements.status.value = String(zone.is_active);

    const level = getZoneLevel(zone);

    elements.level.value = level;

    populateStateSelect(zone.state_id);

    elements.lgaGroup.hidden = ![
      "lga",
      "settlement",
      "area",
      "location"
    ].includes(level);

    elements.settlementGroup.hidden = ![
      "settlement",
      "area",
      "location"
    ].includes(level);

    elements.areaGroup.hidden = level !== "area";

    elements.locationGroup.hidden = level !== "location";

    resetSelect(elements.lga, "Select an LGA");
    resetSelect(elements.settlement, "Select a settlement");
    resetSelect(elements.area, "Select an area");
    resetSelect(elements.location, "Select a specific location");

    if (zone.state_id) {

      populateLgaSelect(
        zone.state_id,
        zone.lga_id
      );

    }

    if (zone.lga_id) {

      populateSettlementSelect(
        zone.lga_id,
        zone.city_id
      );

    }

    if (zone.city_id && level === "area") {

      populateAreaSelect(
        zone.city_id,
        zone.area_id
      );

    }

    if (zone.city_id && level === "location") {

      populateLocationSelect(
        zone.city_id,
        zone.location_node_id
      );

    }

    updateLocationPreview();

    clearFormMessage();

    setSaveButtonState(false);

    showModal(elements.modal);

    elements.level?.focus();

  }


  /* =====================================================
     24. CLOSE FORM MODAL
  ====================================================== */

  function closeFormModal() {

    if (!elements.modal || isSaving) return;

    hideModal(elements.modal);

    elements.form?.reset();

    clearFormMessage();

  }


  /* =====================================================
     25. FORM VALIDATION
  ====================================================== */

  function validateHierarchySelection(
    level,
    stateId,
    lgaId,
    settlementId,
    areaId,
    locationId
  ) {

    const state = getState(stateId);

    if (!state) {
      return "Please select a valid state.";
    }

    if (
      !isActiveOrUnchanged(
        state,
        "state_id",
        stateId
      )
    ) {
      return "The selected state is inactive. Please select an active state.";
    }

    if (level === "state") {
      return null;
    }

    const lga = getLga(lgaId);

    if (!lga) {
      return "Please select a valid Local Government Area.";
    }

    if (String(lga.state_id) !== String(stateId)) {
      return "The selected LGA does not belong to the selected state.";
    }

    if (
      !isActiveOrUnchanged(
        lga,
        "lga_id",
        lgaId
      )
    ) {
      return "The selected LGA is inactive. Please select an active LGA.";
    }

    if (level === "lga") {
      return null;
    }

    const settlement = getSettlement(settlementId);

    if (!settlement) {
      return "Please select a valid settlement.";
    }

    if (String(settlement.lga_id) !== String(lgaId)) {
      return "The selected settlement does not belong to the selected LGA.";
    }

    if (
      !isActiveOrUnchanged(
        settlement,
        "city_id",
        settlementId
      )
    ) {
      return "The selected settlement is inactive. Please select an active settlement.";
    }

    if (level === "settlement") {
      return null;
    }

    if (level === "area") {

      const area = getArea(areaId);

      if (!area) {
        return "Please select a valid area.";
      }

      if (String(area.city_id) !== String(settlementId)) {
        return "The selected area does not belong to the selected settlement.";
      }

      if (
        !isActiveOrUnchanged(
          area,
          "area_id",
          areaId
        )
      ) {
        return "The selected area is inactive. Please select an active area.";
      }

      return null;

    }

    if (level === "location") {

      const location = getLocation(locationId);

      if (!location) {
        return "Please select a valid specific location.";
      }

      if (
        String(location.settlement_id) !== String(settlementId)
      ) {
        return "The selected location does not belong to the selected settlement.";
      }

      const isExistingLocation =
        isUnchangedSelection(
          "location_node_id",
          locationId
        );

      const ancestry = validateLocationAncestry(
        location,
        settlementId,
        isExistingLocation
      );

      if (!ancestry.valid) {
        return ancestry.reason;
      }

      return null;

    }

    return "Please select a valid delivery coverage level.";

  }


  /* =====================================================
     26. FORM SUBMISSION
  ====================================================== */

  async function handleFormSubmit(event) {

    event.preventDefault();

    if (isSaving) return;

    const id = elements.zoneId.value.trim();

    const level = elements.level.value;

    const stateId = elements.state.value;

    const lgaId = elements.lga.value;

    const settlementId = elements.settlement.value;

    const areaId = elements.area.value;

    const locationId = elements.location.value;

    const feeValue = elements.fee.value.trim();

    const isActive = elements.status.value === "true";


    if (!level) {

      showFormMessage(
        "Please select a coverage level.",
        "error"
      );

      return;

    }


    const hierarchyError = validateHierarchySelection(
      level,
      stateId,
      lgaId,
      settlementId,
      areaId,
      locationId
    );

    if (hierarchyError) {

      showFormMessage(
        hierarchyError,
        "error"
      );

      return;

    }


    if (
      feeValue === "" ||
      !Number.isFinite(Number(feeValue))
    ) {

      showFormMessage(
        "Please enter a valid delivery fee.",
        "error"
      );

      return;

    }


    const deliveryFee = Number(feeValue);

    if (
      deliveryFee < 0 ||
      !Number.isFinite(deliveryFee)
    ) {

      showFormMessage(
        "Delivery fee cannot be negative.",
        "error"
      );

      return;

    }


    const payload = {

      state_id: stateId,

      lga_id: null,
      city_id: null,
      area_id: null,
      location_node_id: null,

      delivery_fee: deliveryFee,
      is_active: isActive

    };


    if (level === "lga") {
      payload.lga_id = lgaId;
    }

    if (level === "settlement") {
      payload.city_id = settlementId;
    }

    if (level === "area") {
      payload.area_id = areaId;
    }

    if (level === "location") {
      payload.location_node_id = locationId;
    }


    isSaving = true;

    setSaveButtonState(true);

    clearFormMessage();


    try {

      let result;

      if (id) {

        result = await supabase
          .from("delivery_zones")
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

      } else {

        result = await supabase
          .from("delivery_zones")
          .insert(payload)
          .select("*")
          .single();

      }

      if (result.error) {
        throw result.error;
      }

      if (!result.data) {

        throw new Error(
          "The delivery zone could not be saved."
        );

      }

      hideModal(elements.modal);

      await loadPageData();

    } catch (error) {

      console.error(
        "Delivery zone save failed:",
        error
      );

      showFormMessage(
        getErrorMessage(error),
        "error"
      );

    } finally {

      isSaving = false;

      setSaveButtonState(false);

    }

  }


  /* =====================================================
     27. TOGGLE ZONE STATUS
  ====================================================== */

  async function toggleZoneStatus(zone, button) {

    if (!zone || !zone.id || isUpdatingZone) return;

    const newStatus = !zone.is_active;

    const actionText = newStatus
      ? "activate"
      : "deactivate";

    const details = getZoneLocationDetails(zone);

    const locationName = getZoneMainLocation(details);

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} the delivery zone for ${locationName}?`
    );

    if (!confirmed) return;

    isUpdatingZone = true;

    if (button) {
      button.disabled = true;
    }

    try {

      const { data, error } = await supabase
        .from("delivery_zones")
        .update({
          is_active: newStatus
        })
        .eq("id", zone.id)
        .select("*")
        .single();

      if (error) throw error;

      if (!data) {

        throw new Error(
          "The delivery zone status was not updated."
        );

      }

      await loadPageData();

    } catch (error) {

      console.error(
        "Delivery zone status update failed:",
        error
      );

      window.alert(
        `Could not ${actionText} this delivery zone.\n\n${getErrorMessage(error)}`
      );

    } finally {

      isUpdatingZone = false;

      if (button) {
        button.disabled = false;
      }

    }

  }


  /* =====================================================
     28. DELETE MODAL
  ====================================================== */

  function openDeleteModal(zone) {

    if (!elements.deleteModal) return;

    zoneToDelete = zone;

    const details = getZoneLocationDetails(zone);

    const locationName = getZoneMainLocation(details);

    if (elements.deleteTitle) {
      elements.deleteTitle.textContent = "Delete Delivery Zone?";
    }

    if (elements.deleteMessage) {

      elements.deleteMessage.textContent =
        `Are you sure you want to delete the delivery zone for ${locationName}? This action cannot be undone.`;

    }

    if (elements.confirmDelete) {

      elements.confirmDelete.disabled = false;

      elements.confirmDelete.innerHTML =
        '<i class="fas fa-trash-can"></i> Delete Zone';

    }

    showModal(elements.deleteModal);

  }


  function closeDeleteModal() {

    if (!elements.deleteModal || isDeleting) return;

    hideModal(elements.deleteModal);

    zoneToDelete = null;

  }


  /* =====================================================
     29. DELETE DELIVERY ZONE
  ====================================================== */

  async function handleDelete() {

    if (
      !zoneToDelete ||
      isDeleting ||
      !elements.confirmDelete
    ) {
      return;
    }

    const id = zoneToDelete.id;

    isDeleting = true;

    elements.confirmDelete.disabled = true;

    elements.confirmDelete.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {

      const { error } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", id);

      if (error) throw error;

      hideModal(elements.deleteModal);

      zoneToDelete = null;

      await loadPageData();

    } catch (error) {

      console.error(
        "Delivery zone deletion failed:",
        error
      );

      window.alert(
        `Could not delete this delivery zone.\n\n${getErrorMessage(error)}`
      );

    } finally {

      isDeleting = false;

      elements.confirmDelete.disabled = false;

      elements.confirmDelete.innerHTML =
        '<i class="fas fa-trash-can"></i> Delete Zone';

    }

  }


  /* =====================================================
     30. MODAL HELPERS
  ====================================================== */

  function showModal(modal) {

    if (!modal) return;

    modal.hidden = false;

    modal.classList.add("active");

    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

  }


  function hideModal(modal) {

    if (!modal) return;

    modal.hidden = true;

    modal.classList.remove("active");

    modal.setAttribute("aria-hidden", "true");

    const anotherModalOpen =
      (elements.modal && !elements.modal.hidden) ||
      (elements.deleteModal && !elements.deleteModal.hidden) ||
      (elements.pickerModal && !elements.pickerModal.hidden);

    if (!anotherModalOpen) {
      document.body.classList.remove("modal-open");
    }

  }


  /* =====================================================
     31. FORM MESSAGES
  ====================================================== */

  function showFormMessage(message, type = "error") {

    if (!elements.formMessage) return;

    elements.formMessage.textContent = message;

    elements.formMessage.className =
      `delivery-zone-form-message ${type}`;

    elements.formMessage.hidden = false;

  }


  function clearFormMessage() {

    if (!elements.formMessage) return;

    elements.formMessage.textContent = "";

    elements.formMessage.className =
      "delivery-zone-form-message";

    elements.formMessage.hidden = true;

  }


  /* =====================================================
     32. SAVE BUTTON
  ====================================================== */

  function setSaveButtonState(saving) {

    if (!elements.saveButton) return;

    elements.saveButton.disabled = saving;

    if (saving) {

      elements.saveButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Saving...';

    } else {

      elements.saveButton.innerHTML =
        '<i class="fas fa-floppy-disk"></i><span>Save Delivery Zone</span>';

    }

  }


  /* =====================================================
     33. PAGE STATES
  ====================================================== */

  function showState(state) {

    const pageStates = {

      loading: elements.loading,
      error: elements.error,
      empty: elements.empty,
      noResults: elements.noResults,
      table: elements.tableContainer

    };

    Object.values(pageStates).forEach(element => {

      if (element) {
        element.hidden = true;
      }

    });

    if (pageStates[state]) {
      pageStates[state].hidden = false;
    }

    if (elements.pagination) {

      elements.pagination.hidden =
        state !== "table" ||
        filteredDeliveryZones.length <= PAGE_SIZE;

    }

  }


  function showError(message) {

    if (elements.errorMessage) {
      elements.errorMessage.textContent = message;
    }

    showState("error");

  }


  /* =====================================================
     34. FORMATTING HELPERS
  ====================================================== */

  function formatCurrency(amount) {

    const value = Number(amount || 0);

    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

  }


  function formatNumber(value) {

    return new Intl.NumberFormat("en-NG").format(value);

  }


  function formatPlaceType(value) {

    return String(value || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, character => character.toUpperCase());

  }


  function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => {

      const entities = {

        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"

      };

      return entities[character];

    });

  }


  function getErrorMessage(error) {

    if (!error) {
      return "An unexpected error occurred.";
    }

    if (typeof error === "string") {
      return error;
    }

    if (error.message) {
      return error.message;
    }

    if (error.details) {
      return error.details;
    }

    if (error.hint) {
      return error.hint;
    }

    return "An unexpected error occurred. Please try again.";

  }


});