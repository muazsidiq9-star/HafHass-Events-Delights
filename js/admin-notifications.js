/* =========================================================
   HAFHASS — ADMIN NOTIFICATIONS
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const supabase = window.hafhassSupabase;
  if (!supabase) {
    console.error("HAFHASS Notifications: Supabase is unavailable.");
    return;
  }

  const el = {
    form: document.getElementById("notificationForm"),
    customerSearch: document.getElementById("customerSearch"),
    customerSelect: document.getElementById("customerSelect"),
    pickerModal: document.getElementById("customerPickerModal"),
    pickerList: document.getElementById("customerPickerList"),
    pickerResultCount: document.getElementById("customerPickerResultCount"),
    openCustomerPicker: document.getElementById("openCustomerPicker"),
    closeCustomerPicker: document.getElementById("closeCustomerPicker"),
    cancelCustomerPicker: document.getElementById("cancelCustomerPicker"),
    selectedCustomerName: document.getElementById("selectedCustomerName"),
    selectedCustomerDetails: document.getElementById("selectedCustomerDetails"),
    customerCountHint: document.getElementById("customerCountHint"),
    individual: document.getElementById("individualRecipient"),
    broadcast: document.getElementById("broadcastRecipient"),
    broadcastCount: document.getElementById("broadcastCustomerCount"),
    title: document.getElementById("notificationTitle"),
    message: document.getElementById("notificationMessage"),
    type: document.getElementById("notificationType"),
    actionUrl: document.getElementById("notificationActionUrl"),
    chars: document.getElementById("messageCharacterCount"),
    send: document.getElementById("sendNotificationButton"),
    feedback: document.getElementById("notificationFeedback")
  };

  let customers = [];
  let activeCustomerTotal = 0;
  let sending = false;
  let preserveFeedbackAfterReset = false;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));

  function showFeedback(message, type = "info") {
    el.feedback.textContent = message;
    el.feedback.className = "admin-notification-feedback is-" + type;
    el.feedback.hidden = false;
  }

  function getMode() {
    return document.querySelector('input[name="recipientMode"]:checked')?.value || "individual";
  }

  function updateRecipientMode() {
    const broadcast = getMode() === "broadcast";
    el.individual.hidden = broadcast;
    el.broadcast.hidden = !broadcast;
    el.customerSelect.required = !broadcast;
    el.send.querySelector("span").textContent = broadcast ? "Send to All Customers" : "Send Notification";
  }

  function renderCustomerOptions(search = "") {
    const term = search.trim().toLowerCase();
    const matches = customers.filter(customer =>
      [customer.full_name, customer.email, customer.phone]
        .some(value => String(value || "").toLowerCase().includes(term))
    );
    const selectedId = el.customerSelect.value;
    el.customerSelect.innerHTML = '<option value="">Choose a customer…</option>' +
      customers.map(customer => '<option value="' + escapeHtml(customer.id) + '">' +
        escapeHtml(customer.full_name || "Customer") + '</option>').join("");
    el.customerSelect.value = selectedId;
    el.pickerResultCount.textContent = matches.length.toLocaleString("en-NG") + " customers found";
    if (!matches.length) {
      el.pickerList.innerHTML = '<div class="admin-customer-picker-empty">No customers match that search.</div>';
    } else {
      el.pickerList.innerHTML = matches.map(customer => {
        const name = customer.full_name || "Customer";
        const details = [customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details";
        const initials = name.split(" ").slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase();
        const selected = customer.id === selectedId;
        return '<button type="button" class="admin-customer-picker-item' + (selected ? ' is-selected' : '') +
          '" role="option" aria-selected="' + selected + '" data-customer-id="' + escapeHtml(customer.id) + '">' +
          '<span class="admin-customer-picker-item-avatar">' + escapeHtml(initials || "C") + '</span>' +
          '<span class="admin-customer-picker-item-copy"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(details) + '</small></span>' +
          (selected ? '<i class="fa-solid fa-circle-check admin-customer-picker-item-check" aria-hidden="true"></i>' : '') + '</button>';
      }).join("");
    }
    const selectedCustomer = customers.find(customer => customer.id === selectedId);
    el.selectedCustomerName.textContent = selectedCustomer ? (selectedCustomer.full_name || "Customer") : "Select a customer";
    el.selectedCustomerDetails.textContent = selectedCustomer ? ([selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(" · ") || "Customer account selected") : "Search and choose a customer account";
    el.customerCountHint.textContent = customers.length.toLocaleString("en-NG") + " active customer accounts available.";
  }

  function openCustomerPicker() {
    if (!customers.length) { showFeedback("No active customer accounts are available to select.", "error"); return; }
    el.pickerModal.hidden = false;
    document.body.classList.add("admin-customer-picker-open");
    el.customerSearch.value = "";
    renderCustomerOptions();
    window.setTimeout(() => el.customerSearch.focus(), 50);
  }

  function closeCustomerPicker() {
    el.pickerModal.hidden = true;
    document.body.classList.remove("admin-customer-picker-open");
    el.openCustomerPicker.focus();
  }
  async function loadCustomers() {
    el.customerSelect.innerHTML = '<option value="">Loading customer accounts…</option>';
    const { data, error, count } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone", { count: "exact" })
      .eq("role", "customer")
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(2000);

    if (error) {
      console.error("Unable to load customers:", error);
      el.customerSelect.innerHTML = '<option value="">Unable to load customers</option>';
      el.customerCountHint.textContent = "Customer list could not be loaded. Refresh the page and try again.";
      return;
    }

    customers = data || [];
    activeCustomerTotal = Number(count ?? customers.length);
    renderCustomerOptions();
    el.broadcastCount.textContent = activeCustomerTotal.toLocaleString("en-NG");
    if (!activeCustomerTotal) el.customerCountHint.textContent = "No active customer accounts are currently available.";
    else if (activeCustomerTotal > customers.length) {
      el.customerCountHint.textContent = "Showing the first " + customers.length.toLocaleString("en-NG") +
        " of " + activeCustomerTotal.toLocaleString("en-NG") + " active customer accounts. Search within the loaded list to select an individual.";
    }
  }

  function safeRelativeUrl(value) {
    const url = String(value || "").trim();
    if (!url) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//") ||
        url.includes(String.fromCharCode(92)) ||
        !/^(\.\.\/|\.\/|\/|[a-zA-Z0-9_-])/.test(url) ||
        /[\s<>"]/g.test(url)) {
      throw new Error("Enter a valid relative website path, or leave the action link empty.");
    }
    return url;
  }

  function setBusy(busy) {
    sending = busy;
    el.send.disabled = busy;
    el.send.querySelector("i").className = busy
      ? "fa-solid fa-spinner fa-spin"
      : "fa-solid fa-paper-plane";
    el.send.querySelector("span").textContent = busy ? "Sending…" :
      (getMode() === "broadcast" ? "Send to All Customers" : "Send Notification");
  }

  document.querySelectorAll('input[name="recipientMode"]').forEach(input =>
    input.addEventListener("change", updateRecipientMode)
  );

  el.openCustomerPicker.addEventListener("click", openCustomerPicker);
  el.closeCustomerPicker.addEventListener("click", closeCustomerPicker);
  el.cancelCustomerPicker.addEventListener("click", closeCustomerPicker);
  el.pickerModal.addEventListener("click", event => { if (event.target === el.pickerModal) closeCustomerPicker(); });
  el.pickerList.addEventListener("click", event => {
    const option = event.target.closest("[data-customer-id]");
    if (!option) return;
    el.customerSelect.value = option.dataset.customerId;
    renderCustomerOptions(el.customerSearch.value);
    closeCustomerPicker();
  });
  el.customerSearch.addEventListener("input", () => renderCustomerOptions(el.customerSearch.value));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !el.pickerModal.hidden) closeCustomerPicker(); });
  el.message.addEventListener("input", () => {
    el.chars.textContent = el.message.value.length;
  });

  el.form.addEventListener("reset", () => {
    setTimeout(() => {
      el.customerSearch.value = "";
      el.customerSelect.value = "";
      renderCustomerOptions();
      el.chars.textContent = "0";

      if (preserveFeedbackAfterReset) {
        preserveFeedbackAfterReset = false;
      } else {
        el.feedback.hidden = true;
      }

      updateRecipientMode();
    }, 0);
  });

  el.form.addEventListener("submit", async event => {
    event.preventDefault();
    if (sending) return;

    const mode = getMode();
    const title = el.title.value.trim();
    const message = el.message.value.trim();
    const type = el.type.value;

    if (!title || !message) {
      showFeedback("Please provide both a notification title and message.", "error");
      return;
    }

    let actionUrl;
    try {
      actionUrl = safeRelativeUrl(el.actionUrl.value);
    } catch (error) {
      showFeedback(error.message, "error");
      el.actionUrl.focus();
      return;
    }

    if (mode === "individual" && !el.customerSelect.value) {
      showFeedback("Please select a customer to receive this notification.", "error");
      el.openCustomerPicker.focus();
      return;
    }

    if (mode === "broadcast") {
      if (!activeCustomerTotal) {
        showFeedback("There are no active customer accounts available for this broadcast.", "error");
        return;
      }
      const confirmed = window.confirm(
        "You are about to send this notification to " + activeCustomerTotal.toLocaleString("en-NG") +
        " active customer accounts. Admin and staff accounts will not receive it.\n\n" +
        "Title: " + title + "\n\nMessage: " + message +
        "\n\nThis action cannot be undone. Continue?"
      );
      if (!confirmed) return;
    }

    setBusy(true);
    el.feedback.hidden = true;

    try {
      const recipientUserId = mode === "broadcast" ? null : el.customerSelect.value;
      const requestPayload = {
        mode,
        recipientUserId,
        title,
        message,
        type,
        actionUrl
      };
      const requestFingerprint = JSON.stringify(requestPayload);
      const requestStorageKey = "hafhass-admin-notification-request";
      let requestState = null;

      try {
        requestState = JSON.parse(sessionStorage.getItem(requestStorageKey) || "null");
      } catch (_) {
        requestState = null;
      }

      if (!requestState ||
          requestState.fingerprint !== requestFingerprint ||
          !requestState.requestId) {
        requestState = {
          fingerprint: requestFingerprint,
          requestId: crypto.randomUUID()
        };
        sessionStorage.setItem(requestStorageKey, JSON.stringify(requestState));
      }

      const { data, error } = await supabase.rpc("admin_send_notification_idempotent", {
        p_request_id: requestState.requestId,
        p_user_id: recipientUserId,
        p_title: title,
        p_message: message,
        p_type: type,
        p_action_url: actionUrl
      });

      if (error) throw error;

      const result = typeof data === "string" ? JSON.parse(data) : data;
      const createdCount = Number(result?.created_count) || 0;
      const replayed = result?.replayed === true;

      // Remove the retry key only after the database confirms success.
      // If the response is lost, the same form payload reuses the same key.
      sessionStorage.removeItem(requestStorageKey);

      // Firebase push is dispatched automatically by the database trigger
      // after notification rows are inserted. Never invoke another sender here.
      const pushMessage = " Device push is queued automatically for customers who have enabled browser notifications.";

      if (mode === "broadcast") {
        const action = replayed
          ? "This broadcast had already been processed; no additional notifications were created."
          : createdCount.toLocaleString("en-NG") + " customer notification" +
            (createdCount === 1 ? " was" : "s were") + " created.";
        showFeedback("Broadcast completed successfully. " + action + pushMessage, "success");
      } else {
        showFeedback(
          replayed
            ? "This notification had already been processed; no duplicate was created." + pushMessage
            : "Notification created successfully for the selected customer." + pushMessage,
          "success"
        );
      }

      preserveFeedbackAfterReset = true;
      el.form.reset();
    } catch (error) {
      console.error("Notification sending failed:", error);
      showFeedback(error?.message || "The notification could not be sent. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  });

  updateRecipientMode();
  loadCustomers();
});
