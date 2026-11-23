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
    const selected = el.customerSelect.value;
    el.customerSelect.innerHTML = '<option value="">Choose a customer…</option>' +
      matches.map(customer => {
        const name = customer.full_name || "Customer";
        const details = [customer.email, customer.phone].filter(Boolean).join(" · ");
        return '<option value="' + escapeHtml(customer.id) + '">' +
          escapeHtml(name + (details ? " — " + details : "")) + '</option>';
      }).join("");
    if (matches.some(customer => customer.id === selected)) el.customerSelect.value = selected;
    el.customerCountHint.textContent = matches.length + " of " + customers.length + " active customer accounts shown.";
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

  el.customerSearch.addEventListener("input", () => renderCustomerOptions(el.customerSearch.value));
  el.message.addEventListener("input", () => {
    el.chars.textContent = el.message.value.length;
  });

  el.form.addEventListener("reset", () => {
    setTimeout(() => {
      el.customerSearch.value = "";
      renderCustomerOptions();
      el.chars.textContent = "0";
      el.feedback.hidden = true;
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
      el.customerSelect.focus();
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
      const rpcName = mode === "broadcast"
        ? "admin_send_broadcast_notification"
        : "admin_send_notification";
      const params = mode === "broadcast"
        ? { p_title: title, p_message: message, p_type: type, p_action_url: actionUrl }
        : { p_user_id: el.customerSelect.value, p_title: title, p_message: message, p_type: type, p_action_url: actionUrl };

      const { data, error } = await supabase.rpc(rpcName, params);
      if (error) throw error;

      if (mode === "broadcast") {
        const count = Number(data) || 0;
        showFeedback("Broadcast completed successfully. " + count.toLocaleString("en-NG") +
          " customer notification" + (count === 1 ? " was" : "s were") + " created.", "success");
      } else {
        showFeedback("Notification sent successfully to the selected customer.", "success");
      }

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
