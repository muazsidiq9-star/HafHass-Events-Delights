// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER SAVED ADDRESSES
//
// DELIVERY LOCATION HIERARCHY
// State → LGA → Settlement → Area → Specific Location
//
// Uses:
// delivery_states
// delivery_lgas
// delivery_cities
// delivery_areas
// delivery_location_nodes
//
// Customer table:
// addresses
// ======================================================

(() => {

  "use strict";


  // ====================================================
  // DEPENDENCIES
  // ====================================================

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;


  if (!supabase || !auth || !guards) {

    console.error(
      "HAFHASS Addresses: Required dependencies unavailable."
    );

    return;

  }


  // ====================================================
  // DOM ELEMENTS
  // ====================================================

  const elements = {

    avatarInitials: document.getElementById("avatarInitials"),
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserEmail: document.getElementById("sidebarUserEmail"),

    addressesCount: document.getElementById("addressesCount"),
    addressesLoading: document.getElementById("addressesLoading"),
    addressesError: document.getElementById("addressesError"),
    addressesErrorMessage: document.getElementById("addressesErrorMessage"),
    retryAddressesButton: document.getElementById("retryAddressesButton"),
    addressesEmpty: document.getElementById("addressesEmpty"),
    addressesList: document.getElementById("addressesList"),

    addAddressButton: document.getElementById("addAddressButton"),
    emptyAddAddressButton: document.getElementById("emptyAddAddressButton"),

    addressFormCard: document.getElementById("addressFormCard"),
    addressForm: document.getElementById("addressForm"),
    addressFormTitle: document.getElementById("addressFormTitle"),
    addressId: document.getElementById("addressId"),

    addressLabel: document.getElementById("addressLabel"),
    recipientName: document.getElementById("recipientName"),
    recipientPhone: document.getElementById("recipientPhone"),
    addressLine1: document.getElementById("addressLine1"),
    addressLine2: document.getElementById("addressLine2"),
    addressPostalCode: document.getElementById("addressPostalCode"),
    addressCountry: document.getElementById("addressCountry"),
    deliveryInstructions: document.getElementById("deliveryInstructions"),
    addressIsDefault: document.getElementById("addressIsDefault"),

    addressFormMessage: document.getElementById("addressFormMessage"),
    saveAddressButton: document.getElementById("saveAddressButton"),
    cancelAddressButton: document.getElementById("cancelAddressButton"),
    closeAddressFormButton: document.getElementById("closeAddressFormButton"),

    accountYear: document.getElementById("accountYear"),


    // LOCATION FIELDS

    state: document.getElementById("customerAddressState"),
    lga: document.getElementById("customerAddressLga"),
    settlement: document.getElementById("customerAddressSettlement"),
    area: document.getElementById("customerAddressArea"),
    location: document.getElementById("customerAddressLocation"),


    // LOCATION GROUPS

    lgaGroup: document.getElementById("customerAddressLgaGroup"),
    settlementGroup: document.getElementById("customerAddressSettlementGroup"),
    areaGroup: document.getElementById("customerAddressAreaGroup"),
    locationGroup: document.getElementById("customerAddressLocationGroup"),


    // DATABASE IDENTIFIERS

    lgaId: document.getElementById("addressLgaId"),
    settlementId: document.getElementById("addressSettlementId"),
    areaId: document.getElementById("addressAreaId"),
    locationNodeId: document.getElementById("addressLocationNodeId"),


    // LOCATION PREVIEW

    locationPreviewGroup: document.getElementById("customerAddressLocationPreviewGroup"),
    locationPreview: document.getElementById("customerAddressLocationPreview"),


    // MANUAL LOCATION FIELDS

    customLocationToggle: document.getElementById("toggleCustomerCustomLocation"),
    customLocationFields: document.getElementById("customerCustomLocationFields"),

    customLga: document.getElementById("customerCustomLga"),
    customCity: document.getElementById("customerCustomCity"),
    customArea: document.getElementById("customerCustomArea"),
    customLocationText: document.getElementById("customerCustomLocationText"),


    // SEARCHABLE PICKER

    pickerModal: document.getElementById("customerLocationPickerModal"),
    pickerTitle: document.getElementById("customerLocationPickerTitle"),
    pickerDescription: document.getElementById("customerLocationPickerDescription"),
    pickerSearch: document.getElementById("customerLocationPickerSearch"),
    pickerResultCount: document.getElementById("customerLocationPickerResultCount"),
    pickerResults: document.getElementById("customerLocationPickerResults"),
    pickerEmpty: document.getElementById("customerLocationPickerEmpty"),
    clearPickerSearch: document.getElementById("clearCustomerLocationPickerSearch"),
    closePicker: document.getElementById("closeCustomerLocationPicker"),
    cancelPicker: document.getElementById("cancelCustomerLocationPicker"),


    // CONFIRMATION DIALOG (OPTIONAL: FALLS BACK TO BROWSER POPUPS)

    dialog: document.getElementById("accountDialog"),
    dialogPanel: document.getElementById("accountDialogPanel"),
    dialogIcon: document.getElementById("accountDialogIcon"),
    dialogTitle: document.getElementById("accountDialogTitle"),
    dialogMessage: document.getElementById("accountDialogMessage"),
    dialogConfirm: document.getElementById("accountDialogConfirm"),
    dialogCancel: document.getElementById("accountDialogCancel")

  };


  // ====================================================
  // REQUIRED ELEMENT CHECK
  // ====================================================

  const requiredElements = [

    "addressesLoading",
    "addressesError",
    "addressesErrorMessage",
    "addressesEmpty",
    "addressesList",

    "addressFormCard",
    "addressForm",
    "addressId",

    "addressLabel",
    "recipientName",
    "recipientPhone",
    "addressLine1",
    "addressLine2",
    "addressPostalCode",
    "addressCountry",
    "deliveryInstructions",
    "addressIsDefault",

    "addressFormMessage",
    "saveAddressButton",

    "state",
    "lga",
    "settlement",
    "area",
    "location",

    "lgaId",
    "settlementId",
    "areaId",
    "locationNodeId",

    "pickerModal",
    "pickerTitle",
    "pickerDescription",
    "pickerSearch",
    "pickerResultCount",
    "pickerResults",
    "pickerEmpty"

  ];


  for (const key of requiredElements) {

    if (!elements[key]) {

      console.error(
        `HAFHASS Addresses: Missing HTML element "${key}".`
      );

      return;

    }

  }


  // ====================================================
  // PAGE STATE
  // ====================================================

  let currentUser = null;
  let currentProfile = null;

  let addresses = [];

  let isSaving = false;
  let isCustomLocation = false;
  let directoryLoaded = false;

  let directoryError = null;

  let editingAddress = null;

  let pickerTarget = null;
  let pickerOptions = [];
  let pickerPreviousFocus = null;


  const directory = {

    states: [],
    lgas: [],
    settlements: [],
    areas: [],
    locations: []

  };


  // ====================================================
  // PICKER CONFIGURATION
  // ====================================================

  const pickerConfiguration = {

    state: {
      title: "Select State",
      description: "Search and select your delivery state."
    },

    lga: {
      title: "Select Local Government Area",
      description: "Search for an LGA within the selected state."
    },

    settlement: {
      title: "Select Settlement",
      description: "Search for a settlement within the selected LGA."
    },

    area: {
      title: "Select Area",
      description: "Search for an area within the selected settlement."
    },

    location: {
      title: "Select Specific Location",
      description: "Search for a street, landmark, market, junction or community."
    }

  };


  // ====================================================
  // GENERAL HELPERS
  // ====================================================

  function normalizeText(value) {

    return String(value || "")
      .trim()
      .toLowerCase();

  }


  function createElement(tag, className, text) {

    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;

  }


  function getById(collection, id) {

    if (!id) {
      return null;
    }

    return collection.find(
      item => String(item.id) === String(id)
    ) || null;

  }


  function sortByName(items) {

    return [...items].sort((a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || "")
      )
    );

  }


  function getActiveRecords(items) {

    return items.filter(
      item => item.is_active === true
    );

  }


  function setGroupVisibility(group, visible) {

    if (group) {
      group.hidden = !visible;
    }

  }


  function setSelectOptions(
    select,
    items,
    placeholder,
    selectedValue = ""
  ) {

    if (!select) {
      return;
    }

    select.replaceChildren();

    const firstOption = document.createElement("option");

    firstOption.value = "";
    firstOption.textContent = placeholder;

    select.appendChild(firstOption);

    items.forEach(item => {

      const option = document.createElement("option");

      option.value = String(item.id);
      option.textContent = item.name;

      select.appendChild(option);

    });

    select.value = selectedValue
      ? String(selectedValue)
      : "";

    select.disabled = items.length === 0;

  }


  function addSelectedRecord(items, collection, selectedId, parentCheck) {

    if (!selectedId) {
      return items;
    }

    const selected = getById(collection, selectedId);

    if (!selected) {
      return items;
    }

    if (parentCheck && !parentCheck(selected)) {
      return items;
    }

    if (
      !items.some(
        item => String(item.id) === String(selectedId)
      )
    ) {

      items.push(selected);

    }

    return items;

  }


  function isEditingRecord(id, field) {

    if (!editingAddress || !id) {
      return false;
    }

    return String(editingAddress[field] || "") === String(id);

  }


  function getStateName() {

    return getById(
      directory.states,
      elements.state.value
    )?.name || "";

  }


  function getLgaName() {

    return getById(
      directory.lgas,
      elements.lga.value
    )?.name || "";

  }


  function getSettlementName() {

    return getById(
      directory.settlements,
      elements.settlement.value
    )?.name || "";

  }


  function getAreaName() {

    return getById(
      directory.areas,
      elements.area.value
    )?.name || "";

  }


  function getLocationName() {

    const node = getById(
      directory.locations,
      elements.location.value
    );

    return node
      ? getLocationPathLabel(node)
      : "";

  }


  // ====================================================
  // DATABASE PAGINATION
  // ====================================================

  async function fetchAllRows(tableName) {

    const pageSize = 1000;

    let allRows = [];
    let start = 0;

    while (true) {

      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .range(start, start + pageSize - 1);

      if (error) {
        throw error;
      }

      const rows = data || [];

      allRows.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      start += pageSize;

    }

    return allRows;

  }


  // ====================================================
  // LOAD DELIVERY DIRECTORY
  // ====================================================

  async function loadDeliveryDirectory() {

    directoryLoaded = false;
    directoryError = null;

    try {

      const [
        states,
        lgas,
        settlements,
        areas,
        locations
      ] = await Promise.all([

        fetchAllRows("delivery_states"),
        fetchAllRows("delivery_lgas"),
        fetchAllRows("delivery_cities"),
        fetchAllRows("delivery_areas"),
        fetchAllRows("delivery_location_nodes")

      ]);

      directory.states = states || [];
      directory.lgas = lgas || [];
      directory.settlements = settlements || [];
      directory.areas = areas || [];
      directory.locations = locations || [];

      directoryLoaded = true;

      setSelectOptions(
        elements.state,
        sortByName(getActiveRecords(directory.states)),
        "Select a state"
      );

      resetLocationHierarchy();

      return true;

    } catch (error) {

      console.error(
        "Addresses: Failed to load delivery directory.",
        error
      );

      directoryLoaded = false;

      directoryError =
        "Unable to load delivery locations. Please refresh the page and try again.";

      throw new Error(directoryError);

    }

  }


  // ====================================================
  // RESET LOCATION HIERARCHY
  // ====================================================

  function resetLga() {

    setSelectOptions(
      elements.lga,
      [],
      "Select an LGA"
    );

    setGroupVisibility(elements.lgaGroup, false);

    elements.lgaId.value = "";

  }


  function resetSettlement() {

    setSelectOptions(
      elements.settlement,
      [],
      "Select a settlement"
    );

    setGroupVisibility(elements.settlementGroup, false);

    elements.settlementId.value = "";

  }


  function resetArea() {

    setSelectOptions(
      elements.area,
      [],
      "Select an area"
    );

    setGroupVisibility(elements.areaGroup, false);

    elements.areaId.value = "";

  }


  function resetLocation() {

    setSelectOptions(
      elements.location,
      [],
      "Select a specific location"
    );

    setGroupVisibility(elements.locationGroup, false);

    elements.locationNodeId.value = "";

    updateLocationPreview();

  }


  function resetLocationHierarchy() {

    resetLga();
    resetSettlement();
    resetArea();
    resetLocation();

  }


  // ====================================================
  // LOAD CASCADING LOCATION OPTIONS
  // ====================================================

  function loadLgas(stateId, selectedId = "") {

    resetLga();
    resetSettlement();
    resetArea();
    resetLocation();

    if (!stateId) {
      return;
    }

    let items = getActiveRecords(
      directory.lgas.filter(
        item => String(item.state_id) === String(stateId)
      )
    );

    items = addSelectedRecord(
      items,
      directory.lgas,
      selectedId,
      item => String(item.state_id) === String(stateId)
    );

    setSelectOptions(
      elements.lga,
      sortByName(items),
      "Select an LGA",
      selectedId
    );

    setGroupVisibility(elements.lgaGroup, true);

  }


  function loadSettlements(lgaId, selectedId = "") {

    resetSettlement();
    resetArea();
    resetLocation();

    if (!lgaId) {
      return;
    }

    let items = getActiveRecords(
      directory.settlements.filter(
        item => String(item.lga_id) === String(lgaId)
      )
    );

    items = addSelectedRecord(
      items,
      directory.settlements,
      selectedId,
      item => String(item.lga_id) === String(lgaId)
    );

    setSelectOptions(
      elements.settlement,
      sortByName(items),
      "Select a settlement",
      selectedId
    );

    setGroupVisibility(elements.settlementGroup, true);

  }


  function loadAreas(settlementId, selectedId = "") {

    resetArea();

    if (!settlementId) {
      resetLocation();
      return;
    }

    let items = getActiveRecords(
      directory.areas.filter(
        item => String(item.city_id) === String(settlementId)
      )
    );

    items = addSelectedRecord(
      items,
      directory.areas,
      selectedId,
      item => String(item.city_id) === String(settlementId)
    );

    setSelectOptions(
      elements.area,
      sortByName(items),
      "Select an area",
      selectedId
    );

    setGroupVisibility(elements.areaGroup, true);

  }


  // ====================================================
  // SPECIFIC LOCATION ANCESTRY
  // ====================================================

  function getLocationPath(node) {

    if (!node) {
      return [];
    }

    const path = [];
    const visited = new Set();

    const settlementId = String(node.settlement_id);

    let current = node;

    while (current) {

      const id = String(current.id);

      if (visited.has(id)) {
        return [];
      }

      visited.add(id);

      if (
        String(current.settlement_id) !== settlementId
      ) {
        return [];
      }

      path.unshift(current);

      if (!current.parent_id) {
        break;
      }

      current = getById(
        directory.locations,
        current.parent_id
      );

      if (!current) {
        return [];
      }

    }

    return path;

  }


  function validateLocationNode(
    node,
    settlementId,
    allowInactive = false
  ) {

    if (!node) {
      return false;
    }

    if (
      String(node.settlement_id) !== String(settlementId)
    ) {
      return false;
    }

    const path = getLocationPath(node);

    if (!path.length) {
      return false;
    }

    for (const ancestor of path) {

      if (
        !allowInactive &&
        ancestor.is_active !== true
      ) {
        return false;
      }

      if (
        String(ancestor.settlement_id) !== String(settlementId)
      ) {
        return false;
      }

    }

    return true;

  }


  function getLocationPathLabel(node) {

    const path = getLocationPath(node);

    if (!path.length) {
      return node?.name || "";
    }

    return path
      .map(item => item.name)
      .join(" → ");

  }


  function formatPlaceType(value) {

    if (!value) {
      return "";
    }

    return String(value)
      .replace(/_/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase());

  }


  function getLocationOptionLabel(node) {

    const path = getLocationPathLabel(node);
    const type = formatPlaceType(node.place_type);

    return type
      ? `${path} (${type})`
      : path;

  }


  function loadSpecificLocations(
    settlementId,
    selectedId = ""
  ) {

    resetLocation();

    if (!settlementId) {
      return;
    }

    let items = directory.locations.filter(
      node => validateLocationNode(node, settlementId)
    );

    // Preserve the existing selected location when editing,
    // even if it or one of its ancestors is now inactive.

    if (selectedId) {

      const selectedNode = getById(
        directory.locations,
        selectedId
      );

      if (
        selectedNode &&
        String(selectedNode.settlement_id) === String(settlementId) &&
        validateLocationNode(selectedNode, settlementId, true) &&
        !items.some(
          item => String(item.id) === String(selectedId)
        )
      ) {

        items.push(selectedNode);

      }

    }

    items.sort((a, b) =>
      getLocationOptionLabel(a).localeCompare(
        getLocationOptionLabel(b)
      )
    );

    setSelectOptions(
      elements.location,
      items.map(node => ({
        id: node.id,
        name: getLocationOptionLabel(node)
      })),
      "Select a specific location",
      selectedId
    );

    setGroupVisibility(elements.locationGroup, true);

  }


  // ====================================================
  // LOCATION PREVIEW
  // ====================================================

  function updateLocationPreview() {

    if (isCustomLocation) {
      return;
    }

    const parts = [

      getStateName(),
      getLgaName(),
      getSettlementName(),
      getAreaName(),
      getLocationName()

    ].filter(Boolean);

    if (!parts.length) {

      setGroupVisibility(
        elements.locationPreviewGroup,
        false
      );

      if (elements.locationPreview) {
        elements.locationPreview.textContent = "";
      }

      return;

    }

    if (elements.locationPreview) {

      elements.locationPreview.textContent =
        parts.join(" → ");

    }

    setGroupVisibility(
      elements.locationPreviewGroup,
      true
    );

  }


  // ====================================================
  // SEARCHABLE LOCATION PICKER
  // ====================================================

  function getPickerItems(type) {

    let items = [];

    if (type === "state") {

      items = getActiveRecords(directory.states);

    }

    else if (type === "lga") {

      items = getActiveRecords(
        directory.lgas.filter(
          item =>
            String(item.state_id) ===
            String(elements.state.value)
        )
      );

    }

    else if (type === "settlement") {

      items = getActiveRecords(
        directory.settlements.filter(
          item =>
            String(item.lga_id) ===
            String(elements.lga.value)
        )
      );

    }

    else if (type === "area") {

      items = getActiveRecords(
        directory.areas.filter(
          item =>
            String(item.city_id) ===
            String(elements.settlement.value)
        )
      );

    }

    else if (type === "location") {

      items = directory.locations.filter(
        node =>
          validateLocationNode(
            node,
            elements.settlement.value
          )
      );

    }

    return items.sort((a, b) => {

      const first = type === "location"
        ? getLocationOptionLabel(a)
        : a.name;

      const second = type === "location"
        ? getLocationOptionLabel(b)
        : b.name;

      return first.localeCompare(second);

    });

  }


  function openLocationPicker(type) {

    if (!pickerConfiguration[type]) {
      return;
    }

    const select = elements[type];

    if (!select || select.disabled) {
      return;
    }

    pickerTarget = type;
    pickerPreviousFocus = document.activeElement;

    const configuration = pickerConfiguration[type];

    elements.pickerTitle.textContent =
      configuration.title;

    elements.pickerDescription.textContent =
      configuration.description;

    elements.pickerSearch.value = "";

    pickerOptions = getPickerItems(type);

    renderPickerResults();

    elements.pickerModal.hidden = false;

    document.body.classList.add(
      "customer-location-picker-open"
    );

    requestAnimationFrame(() => {
      elements.pickerSearch.focus();
    });

  }


  function closeLocationPicker() {

    elements.pickerModal.hidden = true;

    document.body.classList.remove(
      "customer-location-picker-open"
    );

    pickerTarget = null;
    pickerOptions = [];

    if (pickerPreviousFocus?.focus) {
      pickerPreviousFocus.focus();
    }

    pickerPreviousFocus = null;

  }


  function renderPickerResults() {

    const query = normalizeText(
      elements.pickerSearch.value
    );

    elements.pickerResults.replaceChildren();

    const filtered = pickerOptions.filter(item => {

      const label = pickerTarget === "location"
        ? getLocationOptionLabel(item)
        : item.name;

      return normalizeText(label).includes(query);

    });

    elements.pickerResultCount.textContent =
      `${filtered.length} ${filtered.length === 1 ? "location" : "locations"} found`;

    if (elements.clearPickerSearch) {

      elements.clearPickerSearch.hidden =
        !elements.pickerSearch.value;

    }

    elements.pickerEmpty.hidden =
      filtered.length > 0;

    elements.pickerResults.hidden =
      filtered.length === 0;

    filtered.forEach(item => {

      const label = pickerTarget === "location"
        ? getLocationOptionLabel(item)
        : item.name;

      const option = createElement(
        "button",
        "customer-location-picker-option",
        label
      );

      option.type = "button";
      option.dataset.value = String(item.id);
      option.setAttribute("role", "option");

      const selected =
        elements[pickerTarget].value === String(item.id);

      option.setAttribute(
        "aria-selected",
        selected ? "true" : "false"
      );

      if (selected) {
        option.classList.add("selected");
      }

      option.addEventListener("click", () => {
        selectPickerOption(item.id);
      });

      elements.pickerResults.appendChild(option);

    });

  }


  function selectPickerOption(id) {

    if (!pickerTarget) {
      return;
    }

    const select = elements[pickerTarget];

    if (!select) {
      return;
    }

    select.value = String(id);

    select.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );

    closeLocationPicker();

  }


  // ====================================================
  // SELECT INTERACTION
  // ====================================================

  function attachPickerToSelect(type) {

    const select = elements[type];

    if (!select) {
      return;
    }

    select.addEventListener("pointerdown", event => {

      if (select.disabled || isCustomLocation) {
        return;
      }

      event.preventDefault();

      openLocationPicker(type);

    });

    select.addEventListener("keydown", event => {

      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown"
      ) {

        event.preventDefault();

        openLocationPicker(type);

      }

    });

  }


  // ====================================================
  // LOCATION CASCADE EVENTS
  // ====================================================

  function attachLocationEvents() {

    elements.state.addEventListener("change", () => {

      loadLgas(elements.state.value);

      updateLocationPreview();

    });


    elements.lga.addEventListener("change", () => {

      elements.lgaId.value =
        elements.lga.value || "";

      loadSettlements(elements.lga.value);

      updateLocationPreview();

    });


    elements.settlement.addEventListener("change", () => {

      elements.settlementId.value =
        elements.settlement.value || "";

      loadAreas(elements.settlement.value);

      loadSpecificLocations(elements.settlement.value);

      updateLocationPreview();

    });


    elements.area.addEventListener("change", () => {

      elements.areaId.value =
        elements.area.value || "";

      updateLocationPreview();

    });


    elements.location.addEventListener("change", () => {

      elements.locationNodeId.value =
        elements.location.value || "";

      updateLocationPreview();

    });


    attachPickerToSelect("state");
    attachPickerToSelect("lga");
    attachPickerToSelect("settlement");
    attachPickerToSelect("area");
    attachPickerToSelect("location");

  }


  // ====================================================
  // MANUAL LOCATION MODE
  // ====================================================

  function setCustomLocation(enabled) {

    isCustomLocation = Boolean(enabled);

    if (elements.customLocationFields) {

      elements.customLocationFields.hidden =
        !isCustomLocation;

    }

    if (elements.customLocationToggle) {

      elements.customLocationToggle.setAttribute(
        "aria-expanded",
        String(isCustomLocation)
      );

      elements.customLocationToggle.replaceChildren();

      const icon = createElement(
        "i",
        isCustomLocation
          ? "fa-solid fa-list"
          : "fa-solid fa-pen-to-square"
      );

      icon.setAttribute("aria-hidden", "true");

      elements.customLocationToggle.appendChild(icon);

      elements.customLocationToggle.appendChild(
        document.createTextNode(
          isCustomLocation
            ? " Select from delivery directory instead"
            : " Can't find your location? Enter it manually"
        )
      );

    }

    if (isCustomLocation) {

      elements.lgaId.value = "";
      elements.settlementId.value = "";
      elements.areaId.value = "";
      elements.locationNodeId.value = "";

      elements.lga.value = "";
      elements.settlement.value = "";
      elements.area.value = "";
      elements.location.value = "";

      setGroupVisibility(elements.lgaGroup, false);
      setGroupVisibility(elements.settlementGroup, false);
      setGroupVisibility(elements.areaGroup, false);
      setGroupVisibility(elements.locationGroup, false);

      if (elements.locationPreview) {
        elements.locationPreview.textContent = "";
      }

      setGroupVisibility(
        elements.locationPreviewGroup,
        false
      );

    } else {

      if (elements.customLga) {
        elements.customLga.value = "";
      }

      if (elements.customCity) {
        elements.customCity.value = "";
      }

      if (elements.customArea) {
        elements.customArea.value = "";
      }

      if (elements.customLocationText) {
        elements.customLocationText.value = "";
      }

      resetLocationHierarchy();

      updateLocationPreview();

    }

  }


  function attachCustomLocationEvents() {

    if (!elements.customLocationToggle) {
      return;
    }

    elements.customLocationToggle.addEventListener("click", () => {

      setCustomLocation(!isCustomLocation);

    });

  }


  // ====================================================
  // RESTORE LOCATION WHEN EDITING
  // ====================================================

  async function restoreAddressLocation(address) {

    if (!address) {
      return;
    }

    setCustomLocation(false);

    // Resolve the state using the saved hierarchy IDs first.
    // This also supports inactive states.

    const savedLga = getById(
      directory.lgas,
      address.lga_id
    );

    const savedSettlement = getById(
      directory.settlements,
      address.city_id
    );

    const stateId =
      savedLga?.state_id ||
      (
        savedSettlement
          ? getById(directory.lgas, savedSettlement.lga_id)?.state_id
          : null
      );

    let state = stateId
      ? getById(directory.states, stateId)
      : null;

    // Fall back to the saved state name.

    if (!state) {

      state = directory.states.find(
        item =>
          normalizeText(item.name) ===
          normalizeText(address.state)
      ) || null;

    }

    if (state) {

      const stateOptions = getActiveRecords(directory.states);

      if (
        !stateOptions.some(
          item => String(item.id) === String(state.id)
        )
      ) {
        stateOptions.push(state);
      }

      setSelectOptions(
        elements.state,
        sortByName(stateOptions),
        "Select a state",
        state.id
      );

    } else {

      // Keep the historical state visible if it no longer
      // exists in the current delivery directory.

      const savedStateName = address.state || "";

      const syntheticState = {
        id: "__saved_state__",
        name: savedStateName
      };

      setSelectOptions(
        elements.state,
        savedStateName ? [syntheticState] : [],
        "Select a state",
        syntheticState.id
      );

      // Historical addresses without directory IDs can still
      // be displayed and edited through manual location mode.

      setCustomLocation(true);

      if (elements.customLga) {
        elements.customLga.value =
          address.custom_lga || "";
      }

      if (elements.customCity) {
        elements.customCity.value =
          address.custom_city || address.city || "";
      }

      if (elements.customArea) {
        elements.customArea.value =
          address.custom_area || "";
      }

      if (elements.customLocationText) {
        elements.customLocationText.value =
          address.custom_location_text || "";
      }

      updateLocationPreview();

      return;

    }


    // Restore LGA.

    const lga = savedLga;

    if (lga) {

      loadLgas(state.id, lga.id);

      elements.lga.value = String(lga.id);
      elements.lgaId.value = String(lga.id);

    } else {

      loadLgas(state.id);

    }


    // Restore settlement.

    const settlement = savedSettlement;

    if (settlement && lga) {

      loadSettlements(lga.id, settlement.id);

      elements.settlement.value =
        String(settlement.id);

      elements.settlementId.value =
        String(settlement.id);

    } else if (lga) {

      loadSettlements(lga.id);

    }


    // Restore area.

    const area = getById(
      directory.areas,
      address.area_id
    );

    if (
      settlement &&
      area &&
      String(area.city_id) === String(settlement.id)
    ) {

      loadAreas(settlement.id, area.id);

      elements.area.value = String(area.id);
      elements.areaId.value = String(area.id);

    } else if (settlement) {

      loadAreas(settlement.id);

    }


    // Restore specific location.

    const location = getById(
      directory.locations,
      address.location_node_id
    );

    if (
      settlement &&
      location &&
      String(location.settlement_id) === String(settlement.id) &&
      validateLocationNode(location, settlement.id, true)
    ) {

      loadSpecificLocations(
        settlement.id,
        location.id
      );

      elements.location.value =
        String(location.id);

      elements.locationNodeId.value =
        String(location.id);

    } else if (settlement) {

      loadSpecificLocations(settlement.id);

    }


    // Restore manual-entry information when present.

    const hasCustomData = Boolean(

      address.is_custom_location ||
      address.custom_lga ||
      address.custom_city ||
      address.custom_area ||
      address.custom_location_text

    );

    if (hasCustomData) {

      setCustomLocation(true);

      if (elements.customLga) {
        elements.customLga.value =
          address.custom_lga || "";
      }

      if (elements.customCity) {
        elements.customCity.value =
          address.custom_city || address.city || "";
      }

      if (elements.customArea) {
        elements.customArea.value =
          address.custom_area || "";
      }

      if (elements.customLocationText) {
        elements.customLocationText.value =
          address.custom_location_text || "";
      }

    }

    updateLocationPreview();

  }


  // ====================================================
  // CUSTOMER INFORMATION
  // ====================================================

  async function loadCustomerInformation(
    user,
    verifiedProfile = null
  ) {

    let profile = verifiedProfile;

    if (!profile) {

      try {

        const result = await auth.getProfile();

        if (
          result?.success === false ||
          result?.error
        ) {

          throw result.error || new Error(
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
          "Addresses: Profile request failed.",
          error
        );

      }

    }

    currentProfile = profile;

    const fullName =
      profile?.full_name ||
      profile?.name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "Customer";

    const email =
      profile?.email ||
      user?.email ||
      "";

    if (elements.sidebarUserName) {
      elements.sidebarUserName.textContent = fullName;
    }

    if (elements.sidebarUserEmail) {
      elements.sidebarUserEmail.textContent = email;
    }

    if (elements.avatarInitials) {

      const initials = String(fullName)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("");

      elements.avatarInitials.textContent =
        initials || "C";

    }

  }


  // ====================================================
  // PAGE STATES
  // ====================================================

  function showLoading() {

    elements.addressesLoading.hidden = false;
    elements.addressesError.hidden = true;
    elements.addressesEmpty.hidden = true;
    elements.addressesList.hidden = true;

  }


  function showError(message) {

    elements.addressesLoading.hidden = true;
    elements.addressesError.hidden = false;
    elements.addressesEmpty.hidden = true;
    elements.addressesList.hidden = true;

    elements.addressesErrorMessage.textContent =
      message ||
      "Something went wrong while loading your saved addresses.";

  }


  function hideLoading() {

    elements.addressesLoading.hidden = true;

  }


  // ====================================================
  // LOAD SAVED ADDRESSES
  // ====================================================

  async function loadAddresses() {

    if (!currentUser?.id) {

      showError(
        "Your authenticated account could not be verified."
      );

      return;

    }

    showLoading();

    try {

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("is_default", {
          ascending: false
        })
        .order("created_at", {
          ascending: false
        });

      if (error) {
        throw error;
      }

      addresses = data || [];

      renderAddresses();

    } catch (error) {

      console.error(
        "Addresses: Failed to load addresses.",
        error
      );

      showError(
        error.message ||
        "Unable to retrieve your saved addresses."
      );

    }

  }


  // ====================================================
  // ADDRESS COUNT
  // ====================================================

  function updateAddressCount() {

    const count = addresses.length;

    elements.addressesCount.textContent =
      `${count} ${count === 1 ? "Address" : "Addresses"}`;

  }


  // ====================================================
  // ADDRESS LOCATION DISPLAY
  // ====================================================

  function getAddressLocationText(address) {

    const state = address.state || "";

    const lga =
      address.custom_lga ||
      getById(
        directory.lgas,
        address.lga_id
      )?.name ||
      "";

    const settlement =
      address.custom_city ||
      address.city ||
      getById(
        directory.settlements,
        address.city_id
      )?.name ||
      "";

    const area =
      address.custom_area ||
      getById(
        directory.areas,
        address.area_id
      )?.name ||
      "";

    const locationNode = getById(
      directory.locations,
      address.location_node_id
    );

    const specificLocation =
      address.custom_location_text ||
      (
        locationNode
          ? getLocationPathLabel(locationNode)
          : ""
      );

    // The hierarchy comes first.
    // Address lines are supplementary details and follow it.

    return [

      state,
      lga,
      settlement,
      area,
      specificLocation,

      address.address_line_1,
      address.address_line_2,

      address.postal_code,
      address.country

    ].filter(Boolean).join(", ");

  }


  // ====================================================
  // ADDRESS CARD
  // ====================================================

  function createAddressCard(address) {

    const card = createElement(
      "article",
      "address-card"
    );

    card.dataset.addressId = address.id;

    const header = createElement(
      "div",
      "address-card-header"
    );

    const titleGroup = createElement(
      "div",
      "address-card-title-group"
    );

    const title = createElement(
      "h3",
      "address-card-title",
      address.label || "Delivery Address"
    );

    titleGroup.appendChild(title);

    if (address.is_default) {

      titleGroup.appendChild(
        createElement(
          "span",
          "address-default-badge",
          "Default Address"
        )
      );

    }

    header.appendChild(titleGroup);

    const details = createElement(
      "div",
      "address-card-details"
    );

    details.appendChild(
      createElement(
        "p",
        "address-recipient",
        address.recipient_name
      )
    );

    details.appendChild(
      createElement(
        "p",
        "address-phone",
        address.phone
      )
    );

    details.appendChild(
      createElement(
        "p",
        "address-location",
        getAddressLocationText(address)
      )
    );

    if (address.delivery_instructions) {

      details.appendChild(
        createElement(
          "p",
          "address-instructions",
          `Delivery instructions: ${address.delivery_instructions}`
        )
      );

    }

    const actions = createElement(
      "div",
      "address-card-actions"
    );

    if (!address.is_default) {

      const defaultButton = createElement(
        "button",
        "address-action-button address-default-button",
        "Set as Default"
      );

      defaultButton.type = "button";
      defaultButton.dataset.action = "default";
      defaultButton.dataset.id = address.id;

      actions.appendChild(defaultButton);

    }

    const editButton = createElement(
      "button",
      "address-action-button address-edit-button",
      "Edit"
    );

    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = address.id;

    actions.appendChild(editButton);

    const deleteButton = createElement(
      "button",
      "address-action-button address-delete-button",
      "Delete"
    );

    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = address.id;

    actions.appendChild(deleteButton);

    card.appendChild(header);
    card.appendChild(details);
    card.appendChild(actions);

    return card;

  }


  // ====================================================
  // RENDER ADDRESSES
  // ====================================================

  function renderAddresses() {

    hideLoading();

    elements.addressesError.hidden = true;

    elements.addressesList.replaceChildren();

    updateAddressCount();

    if (!addresses.length) {

      elements.addressesEmpty.hidden = false;
      elements.addressesList.hidden = true;

      return;

    }

    elements.addressesEmpty.hidden = true;
    elements.addressesList.hidden = false;

    addresses.forEach(address => {

      elements.addressesList.appendChild(
        createAddressCard(address)
      );

    });

  }


  // ====================================================
  // FORM FEEDBACK
  // ====================================================

  function showFormMessage(message, type = "error") {

    elements.addressFormMessage.hidden = false;

    elements.addressFormMessage.textContent = message;

    elements.addressFormMessage.className =
      `address-form-message ${type}`;

  }


  function clearFormMessage() {

    elements.addressFormMessage.hidden = true;

    elements.addressFormMessage.textContent = "";

    elements.addressFormMessage.className =
      "address-form-message";

  }


  // ====================================================
  // RESET LOCATION FORM
  // ====================================================

  function resetLocationForm() {

    elements.state.value = "";

    resetLocationHierarchy();

    elements.lgaId.value = "";
    elements.settlementId.value = "";
    elements.areaId.value = "";
    elements.locationNodeId.value = "";

    setCustomLocation(false);

    if (elements.customLga) {
      elements.customLga.value = "";
    }

    if (elements.customCity) {
      elements.customCity.value = "";
    }

    if (elements.customArea) {
      elements.customArea.value = "";
    }

    if (elements.customLocationText) {
      elements.customLocationText.value = "";
    }

    if (elements.locationPreview) {
      elements.locationPreview.textContent = "";
    }

    setGroupVisibility(
      elements.locationPreviewGroup,
      false
    );

  }


  // ====================================================
  // OPEN ADDRESS FORM
  // ====================================================

  async function openAddressForm(address = null) {

    elements.addressForm.reset();

    clearFormMessage();

    editingAddress = address || null;

    resetLocationForm();

    elements.addressId.value =
      address?.id || "";

    elements.addressLabel.value =
      address?.label || "";

    elements.recipientName.value =
      address?.recipient_name || "";

    elements.recipientPhone.value =
      address?.phone || "";

    // Both address lines are optional supplementary details.

    elements.addressLine1.value =
      address?.address_line_1 || "";

    elements.addressLine2.value =
      address?.address_line_2 || "";

    elements.addressPostalCode.value =
      address?.postal_code || "";

    elements.addressCountry.value =
      address?.country || "Nigeria";

    elements.deliveryInstructions.value =
      address?.delivery_instructions || "";

    elements.addressIsDefault.checked =
      address
        ? address.is_default
        : addresses.length === 0;

    elements.addressFormTitle.textContent =
      address
        ? "Edit Address"
        : "Add New Address";

    elements.saveAddressButton.textContent =
      address
        ? "Update Address"
        : "Save Address";

    elements.addressFormCard.hidden = false;

    if (!directoryLoaded) {

      showFormMessage(
        directoryError ||
        "Delivery locations are unavailable. Please refresh the page and try again."
      );

      elements.addressFormCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      return;

    }

    if (address) {
      await restoreAddressLocation(address);
    }

    elements.addressFormCard.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  }


  // ====================================================
  // CLOSE ADDRESS FORM
  // ====================================================

  function closeAddressForm() {

    elements.addressForm.reset();

    elements.addressId.value = "";

    editingAddress = null;

    resetLocationForm();

    clearFormMessage();

    elements.addressFormCard.hidden = true;

    elements.saveAddressButton.disabled = false;

    elements.saveAddressButton.textContent =
      "Save Address";

    isSaving = false;

  }


  // ====================================================
  // COLLECT LOCATION DATA
  // ====================================================

  function getLocationFormData() {

    const state = getStateName();

    if (!state) {

      throw new Error(
        "Please select your state."
      );

    }

    if (isCustomLocation) {

      const customLga =
        elements.customLga?.value.trim() || "";

      const customCity =
        elements.customCity?.value.trim() || "";

      const customArea =
        elements.customArea?.value.trim() || "";

      const customLocationText =
        elements.customLocationText?.value.trim() || "";

      if (!customLga || !customCity) {

        throw new Error(
          "Please enter your Local Government Area and settlement."
        );

      }

      if (!customLocationText) {

        throw new Error(
          "Please enter your specific delivery location."
        );

      }

      return {

        state,

        city: customCity,

        lga_id: null,
        city_id: null,
        area_id: null,
        location_node_id: null,

        custom_lga: customLga,
        custom_city: customCity,
        custom_area: customArea || null,

        is_custom_location: true,

        custom_location_text: customLocationText

      };

    }


    const lgaId = elements.lga.value;
    const settlementId = elements.settlement.value;

    if (!lgaId) {

      throw new Error(
        "Please select your Local Government Area."
      );

    }

    if (!settlementId) {

      throw new Error(
        "Please select your settlement."
      );

    }


    const stateRecord = getById(
      directory.states,
      elements.state.value
    );

    const lga = getById(
      directory.lgas,
      lgaId
    );

    const settlement = getById(
      directory.settlements,
      settlementId
    );


    if (
      !stateRecord ||
      !lga ||
      String(lga.state_id) !== String(stateRecord.id)
    ) {

      throw new Error(
        "The selected LGA does not belong to the selected state."
      );

    }

    if (
      lga.is_active !== true &&
      !isEditingRecord(lga.id, "lga_id")
    ) {

      throw new Error(
        "The selected LGA is no longer active. Please choose another."
      );

    }


    if (
      !settlement ||
      String(settlement.lga_id) !== String(lga.id)
    ) {

      throw new Error(
        "The selected settlement does not belong to the selected LGA."
      );

    }

    if (
      settlement.is_active !== true &&
      !isEditingRecord(settlement.id, "city_id")
    ) {

      throw new Error(
        "The selected settlement is no longer active. Please choose another."
      );

    }


    if (
      stateRecord.is_active !== true &&
      !isEditingRecord(stateRecord.name, "state")
    ) {

      throw new Error(
        "The selected state is no longer active. Please choose another."
      );

    }


    const areaId = elements.area.value || null;
    const locationNodeId = elements.location.value || null;


    if (areaId) {

      const area = getById(
        directory.areas,
        areaId
      );

      if (
        !area ||
        String(area.city_id) !== String(settlement.id)
      ) {

        throw new Error(
          "The selected area does not belong to the selected settlement."
        );

      }

      if (
        area.is_active !== true &&
        !isEditingRecord(area.id, "area_id")
      ) {

        throw new Error(
          "The selected area is no longer active. Please choose another."
        );

      }

    }


    if (locationNodeId) {

      const location = getById(
        directory.locations,
        locationNodeId
      );

      const allowInactive = isEditingRecord(
        locationNodeId,
        "location_node_id"
      );

      if (
        !location ||
        !validateLocationNode(
          location,
          settlement.id,
          allowInactive
        )
      ) {

        throw new Error(
          "The selected specific location is not valid for this settlement."
        );

      }

    }


    return {

      state,

      city: settlement.name,

      lga_id: lga.id,
      city_id: settlement.id,
      area_id: areaId,
      location_node_id: locationNodeId,

      custom_lga: null,
      custom_city: null,
      custom_area: null,

      is_custom_location: false,
      custom_location_text: null

    };

  }


  // ====================================================
  // COLLECT COMPLETE FORM DATA
  // ====================================================

  function getFormData() {

    const locationData = getLocationFormData();

    return {

      label:
        elements.addressLabel.value.trim() || null,

      recipient_name:
        elements.recipientName.value.trim(),

      phone:
        elements.recipientPhone.value.trim(),

      // Optional supplementary address details.

      address_line_1:
        elements.addressLine1.value.trim() || null,

      address_line_2:
        elements.addressLine2.value.trim() || null,

      ...locationData,

      postal_code:
        elements.addressPostalCode.value.trim() || null,

      country:
        elements.addressCountry.value.trim(),

      delivery_instructions:
        elements.deliveryInstructions.value.trim() || null,

      is_default:
        elements.addressIsDefault.checked

    };

  }


  // ====================================================
  // SAVE ADDRESS
  // ====================================================

  async function saveAddress(event) {

    event.preventDefault();

    if (isSaving) {
      return;
    }

    clearFormMessage();

    if (!elements.addressForm.reportValidity()) {
      return;
    }

    if (!currentUser?.id) {

      showFormMessage(
        "Your authenticated account could not be verified."
      );

      return;

    }

    if (!directoryLoaded) {

      showFormMessage(
        directoryError ||
        "Delivery locations are unavailable. Please refresh the page."
      );

      return;

    }

    let formData;

    try {

      formData = getFormData();

    } catch (error) {

      showFormMessage(error.message);

      return;

    }


    const addressId = elements.addressId.value;

    isSaving = true;

    elements.saveAddressButton.disabled = true;

    elements.saveAddressButton.textContent =
      "Saving...";

    try {

      let savedAddress;

      if (addressId) {

        const { data, error } = await supabase
          .from("addresses")
          .update(formData)
          .eq("id", addressId)
          .eq("user_id", currentUser.id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        savedAddress = data;

      } else {

        const { data, error } = await supabase
          .from("addresses")
          .insert({
            ...formData,
            user_id: currentUser.id
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        savedAddress = data;

      }


      if (savedAddress.is_default) {

        const { error: defaultError } = await supabase
          .from("addresses")
          .update({
            is_default: false
          })
          .eq("user_id", currentUser.id)
          .neq("id", savedAddress.id);

        if (defaultError) {
          throw defaultError;
        }

      }

      closeAddressForm();

      await loadAddresses();

    } catch (error) {

      console.error(
        "Addresses: Could not save address.",
        error
      );

      showFormMessage(
        error.message ||
        "Unable to save your address. Please try again."
      );

    } finally {

      isSaving = false;

      elements.saveAddressButton.disabled = false;

      elements.saveAddressButton.textContent =
        addressId
          ? "Update Address"
          : "Save Address";

    }

  }


  // ====================================================
  // EDIT ADDRESS
  // ====================================================

  async function editAddress(id) {

    const address = addresses.find(
      item => String(item.id) === String(id)
    );

    if (!address) {
      return;
    }

    await openAddressForm(address);

  }


  // ====================================================
  // CONFIRMATION DIALOG
  // Replaces window.confirm() and window.alert().
  // Resolves true when confirmed, false when dismissed.
  // ====================================================

  let dialogResolver = null;
  let dialogPreviousFocus = null;

  function showDialog(options = {}) {

    const {
      title = "Are you sure?",
      message = "",
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      showCancel = true,
      tone = "default"
    } = options;

    // Safety net: use the browser popup if the dialog
    // markup is missing from the page.

    if (!elements.dialog) {

      if (showCancel) {
        return Promise.resolve(
          window.confirm(`${title}\n\n${message}`)
        );
      }

      window.alert(`${title}\n\n${message}`);

      return Promise.resolve(true);

    }

    if (dialogResolver) {
      closeDialog(false);
    }

    dialogPreviousFocus = document.activeElement;

    elements.dialogTitle.textContent = title;
    elements.dialogMessage.textContent = message;
    elements.dialogConfirm.textContent = confirmLabel;
    elements.dialogCancel.textContent = cancelLabel;
    elements.dialogCancel.hidden = !showCancel;

    elements.dialogPanel.classList.toggle(
      "is-danger",
      tone === "danger"
    );

    if (elements.dialogIcon) {

      elements.dialogIcon.className =
        tone === "danger"
          ? "fa-solid fa-trash-can"
          : "fa-solid fa-circle-exclamation";

    }

    elements.dialog.hidden = false;

    document.body.classList.add(
      "customer-location-picker-open"
    );

    // Destructive confirmations focus the safe choice first.

    requestAnimationFrame(() => {

      (
        showCancel && tone === "danger"
          ? elements.dialogCancel
          : elements.dialogConfirm
      ).focus();

    });

    return new Promise(resolve => {
      dialogResolver = resolve;
    });

  }


  function closeDialog(result) {

    if (!elements.dialog || elements.dialog.hidden) {
      return;
    }

    elements.dialog.hidden = true;

    document.body.classList.remove(
      "customer-location-picker-open"
    );

    const resolve = dialogResolver;

    dialogResolver = null;

    if (dialogPreviousFocus?.focus) {
      dialogPreviousFocus.focus();
    }

    dialogPreviousFocus = null;

    if (resolve) {
      resolve(Boolean(result));
    }

  }


  function attachDialogEvents() {

    if (!elements.dialog) {
      return;
    }

    elements.dialogConfirm.addEventListener(
      "click",
      () => closeDialog(true)
    );

    elements.dialogCancel.addEventListener(
      "click",
      () => closeDialog(false)
    );

    elements.dialog.addEventListener("click", event => {

      if (event.target === elements.dialog) {
        closeDialog(false);
      }

    });

    document.addEventListener("keydown", event => {

      if (elements.dialog.hidden) {
        return;
      }

      if (event.key === "Escape") {
        closeDialog(false);
      }

    });

  }


  // ====================================================
  // DELETE ADDRESS
  // ====================================================

  async function deleteAddress(id) {

    const address = addresses.find(
      item => String(item.id) === String(id)
    );

    if (!address) {
      return;
    }

    const confirmed = await showDialog({
      title: "Delete this address?",
      message:
        `"${address.label || "This address"}" will be removed from your saved addresses. This cannot be undone.`,
      confirmLabel: "Delete address",
      cancelLabel: "Keep address",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    try {

      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) {
        throw error;
      }

      await loadAddresses();

    } catch (error) {

      console.error(
        "Addresses: Could not delete address.",
        error
      );

      await showDialog({
        title: "Could not delete address",
        message:
          error.message ||
          "Unable to delete this address. Please try again.",
        confirmLabel: "Close",
        showCancel: false
      });

    }

  }


  // ====================================================
  // SET DEFAULT ADDRESS
  // ====================================================

  async function setDefaultAddress(id) {

    const address = addresses.find(
      item => String(item.id) === String(id)
    );

    if (!address || address.is_default) {
      return;
    }

    try {

      const { error } = await supabase
        .from("addresses")
        .update({
          is_default: true
        })
        .eq("id", id)
        .eq("user_id", currentUser.id);

      if (error) {
        throw error;
      }

      const { error: resetError } = await supabase
        .from("addresses")
        .update({
          is_default: false
        })
        .eq("user_id", currentUser.id)
        .neq("id", id);

      if (resetError) {
        throw resetError;
      }

      await loadAddresses();

    } catch (error) {

      console.error(
        "Addresses: Could not set default address.",
        error
      );

      await showDialog({
        title: "Could not update default address",
        message:
          error.message ||
          "Unable to update your default address.",
        confirmLabel: "Close",
        showCancel: false
      });

    }

  }


  // ====================================================
  // ADDRESS ACTION HANDLER
  // ====================================================

  function handleAddressActions(event) {

    const button = event.target.closest(
      "button[data-action]"
    );

    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === "edit") {
      editAddress(id);
    }

    else if (action === "delete") {
      deleteAddress(id);
    }

    else if (action === "default") {
      setDefaultAddress(id);
    }

  }


  // ====================================================
  // PICKER EVENTS
  // ====================================================

  function attachPickerEvents() {

    elements.pickerSearch.addEventListener(
      "input",
      renderPickerResults
    );

    if (elements.clearPickerSearch) {

      elements.clearPickerSearch.addEventListener("click", () => {

        elements.pickerSearch.value = "";

        renderPickerResults();

        elements.pickerSearch.focus();

      });

    }

    if (elements.closePicker) {

      elements.closePicker.addEventListener(
        "click",
        closeLocationPicker
      );

    }

    if (elements.cancelPicker) {

      elements.cancelPicker.addEventListener(
        "click",
        closeLocationPicker
      );

    }

    elements.pickerModal.addEventListener("click", event => {

      if (event.target === elements.pickerModal) {
        closeLocationPicker();
      }

    });

    document.addEventListener("keydown", event => {

      if (elements.pickerModal.hidden) {
        return;
      }

      if (event.key === "Escape") {
        closeLocationPicker();
      }

    });

  }


  // ====================================================
  // GENERAL EVENT LISTENERS
  // ====================================================

  function attachEventListeners() {

    attachDialogEvents();

    if (elements.addAddressButton) {

      elements.addAddressButton.addEventListener(
        "click",
        () => openAddressForm()
      );

    }

    if (elements.emptyAddAddressButton) {

      elements.emptyAddAddressButton.addEventListener(
        "click",
        () => openAddressForm()
      );

    }

    if (elements.closeAddressFormButton) {

      elements.closeAddressFormButton.addEventListener(
        "click",
        closeAddressForm
      );

    }

    if (elements.cancelAddressButton) {

      elements.cancelAddressButton.addEventListener(
        "click",
        closeAddressForm
      );

    }

    elements.addressForm.addEventListener(
      "submit",
      saveAddress
    );

    elements.addressesList.addEventListener(
      "click",
      handleAddressActions
    );

    if (elements.retryAddressesButton) {

      elements.retryAddressesButton.addEventListener(
        "click",
        loadAddresses
      );

    }

    attachLocationEvents();

    attachCustomLocationEvents();

    attachPickerEvents();

  }


  // ====================================================
  // INITIALIZE PAGE
  // ====================================================

  async function initializeAddressesPage() {

    try {

      const access = await guards.protectCustomerPage({
        loginPage: "../login.html"
      });

      if (!access || access.authorized !== true) {
        return;
      }

      currentUser =
        access.user ||
        access.data?.user ||
        null;

      currentProfile =
        access.profile ||
        access.data?.profile ||
        null;


      if (!currentUser?.id) {

        const result = await auth.getCurrentUser();

        if (
          !result ||
          result.success !== true ||
          !result.user?.id
        ) {

          throw new Error(
            "Unable to retrieve your authenticated account."
          );

        }

        currentUser = result.user;

      }


      attachEventListeners();

      await loadCustomerInformation(
        currentUser,
        currentProfile
      );


      // Load the delivery directory independently.
      // A directory failure should not prevent customers
      // from viewing their already-saved addresses.

      try {

        await loadDeliveryDirectory();

      } catch (error) {

        console.error(
          "Addresses: Delivery directory unavailable.",
          error
        );

      }


      await loadAddresses();


      if (elements.accountYear) {

        elements.accountYear.textContent =
          new Date().getFullYear();

      }

      console.log(
        "HAFHASS Addresses: Page initialized successfully."
      );

    } catch (error) {

      console.error(
        "HAFHASS Addresses: Initialization failed.",
        error
      );

      showError(
        error.message ||
        "Unable to initialize your saved addresses."
      );

    }

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeAddressesPage,
      { once: true }
    );

  } else {

    initializeAddressesPage();

  }


})();