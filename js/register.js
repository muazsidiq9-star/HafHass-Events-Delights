// ==========================================
// EMAIL AND PHONE VALIDATION HELPERS
// Pure functions: no page elements are used here.
// ==========================================

const HafhassValidate = (() => {

  // ------------------------------------------
  // EMAIL
  // ------------------------------------------

  const COMMON_EMAIL_DOMAINS = [
    "gmail.com",
    "yahoo.com",
    "ymail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "me.com",
    "aol.com",
    "msn.com",
    "protonmail.com",
    "proton.me",
    "googlemail.com",
    "yahoo.co.uk",
    "hotmail.co.uk"
  ];

  // Real providers that sit close to a common one
  // (for example mail.com is one letter from gmail.com).
  // They must never be flagged as typos.

  const OTHER_REAL_DOMAINS = [
    "mail.com",
    "gmx.com",
    "zoho.com",
    "yandex.com",
    "fastmail.com",
    "hey.com",
    "pm.me",
    "inbox.com"
  ];

  const KNOWN_DOMAINS = new Set([
    ...COMMON_EMAIL_DOMAINS,
    ...OTHER_REAL_DOMAINS
  ]);

  const PROVIDER_NAMES = [
    "gmail",
    "yahoo",
    "hotmail",
    "outlook",
    "icloud",
    "ymail"
  ];

  const TYPO_TLDS = [
    "con",
    "comm",
    "cim",
    "ocm",
    "vom",
    "xom",
    "cpm",
    "coom",
    "cmo"
  ];


  // Damerau–Levenshtein distance (counts a swapped pair as 1).

  function editDistance(a, b) {

    const rows = a.length + 1;
    const cols = b.length + 1;

    const d = Array.from(
      { length: rows },
      () => new Array(cols).fill(0)
    );

    for (let i = 0; i < rows; i++) d[i][0] = i;
    for (let j = 0; j < cols; j++) d[0][j] = j;

    for (let i = 1; i < rows; i++) {

      for (let j = 1; j < cols; j++) {

        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost
        );

        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }

      }

    }

    return d[a.length][b.length];

  }


  function suggestDomain(domain) {

    if (KNOWN_DOMAINS.has(domain)) {
      return null;
    }

    const firstLabel = domain.split(".")[0];

    // gmail only exists as gmail.com, so gmail.net,
    // gmail.com.ng, gmail.co and similar are typos.

    if (firstLabel === "gmail") {
      return "gmail.com";
    }

    let best = null;
    let bestDistance = Infinity;

    COMMON_EMAIL_DOMAINS.forEach(candidate => {

      const distance = editDistance(domain, candidate);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }

    });

    if (
      bestDistance === 1 ||
      (bestDistance === 2 && domain.length >= 10)
    ) {
      return best;
    }

    const tld = domain.split(".").pop();

    if (TYPO_TLDS.includes(tld)) {
      return domain.slice(0, -tld.length) + "com";
    }

    return null;

  }


  // Returns { ok, value, error?, suggestion? }
  // "value" is always the cleaned-up address.

  function checkEmail(raw) {

    const value = String(raw || "").trim().toLowerCase();

    const fail = (error, suggestion) => ({
      ok: false,
      value,
      error,
      suggestion: suggestion || null
    });

    if (!value) {
      return fail("Enter your email address.");
    }

    if (/\s/.test(value)) {
      return fail("Your email address cannot contain spaces.");
    }

    const at = value.indexOf("@");

    if (at === -1) {
      return fail("Your email address is missing the @ symbol.");
    }

    if (value.indexOf("@", at + 1) !== -1) {
      return fail("Your email address has more than one @ symbol.");
    }

    const local = value.slice(0, at);
    const domain = value.slice(at + 1);

    if (!local) {
      return fail("Add the part of your email that comes before the @ symbol.");
    }

    if (!domain) {
      return fail("Add your email provider after the @ symbol, for example gmail.com.");
    }

    if (local.length > 64 || domain.length > 253) {
      return fail("This email address is too long.");
    }

    if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) {

      const badCharacter = local.match(
        /[^a-z0-9!#$%&'*+/=?^_`{|}~.-]/
      );

      return fail(
        `The part before @ contains a character that is not allowed (${badCharacter[0]}).`
      );

    }

    if (
      local.startsWith(".") ||
      local.endsWith(".") ||
      local.includes("..")
    ) {
      return fail(
        "The part before @ cannot start or end with a dot, or have two dots in a row."
      );
    }

    // A comma typed instead of a dot, e.g. name@gmail,com

    if (domain.includes(",")) {

      const fixed = domain.replace(/,/g, ".");

      return fail(
        "Your email has a comma where a dot should be.",
        `${local}@${fixed}`
      );

    }

    if (!/^[a-z0-9.-]+$/.test(domain)) {

      const badCharacter = domain.match(/[^a-z0-9.-]/);

      return fail(
        `The part after @ contains a character that is not allowed (${badCharacter[0]}).`
      );

    }

    if (!domain.includes(".")) {

      if (PROVIDER_NAMES.includes(domain)) {
        return fail(
          `Your email is missing ".com" at the end.`,
          `${local}@${domain}.com`
        );
      }

      return fail(
        "The part after @ looks incomplete. It should look like gmail.com."
      );

    }

    const labels = domain.split(".");

    const labelsValid = labels.every(label =>
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label) &&
      label.length <= 63
    );

    if (!labelsValid) {
      return fail(
        "The part after @ is not valid. Check for extra dots or dashes."
      );
    }

    const tld = labels[labels.length - 1];

    if (!/^[a-z]{2,}$/.test(tld) && !tld.startsWith("xn--")) {
      return fail(
        "The ending of your email (after the last dot) is not valid."
      );
    }

    const suggestedDomain = suggestDomain(domain);

    return {
      ok: true,
      value,
      suggestion: suggestedDomain
        ? `${local}@${suggestedDomain}`
        : null
    };

  }


  // ------------------------------------------
  // PHONE
  // ------------------------------------------

  // After the leading 0, Nigerian mobile numbers start with
  // 70, 71, 80, 81, 90 or 91 and have 10 digits in total.

  const NG_NATIONAL = /^(7[01]|8[01]|9[01])\d{8}$/;


  function groupDigits(text, sizes) {

    const parts = [];
    let index = 0;

    for (const size of sizes) {

      if (index >= text.length) break;

      parts.push(text.slice(index, index + size));

      index += size;

    }

    if (index < text.length) {
      parts.push(text.slice(index));
    }

    return parts.join(" ");

  }


  // Catches obvious made-up numbers such as 08000000000,
  // 08011111111 and 08012345678.

  function looksLikePlaceholder(national) {

    const tail = national.slice(2);

    return (
      new Set(national).size <= 2 ||
      /(\d)\1{6,}/.test(national) ||
      "0123456789".includes(tail) ||
      "9876543210".includes(tail)
    );

  }


  // Returns { ok, kind, value, display, error? }
  //   kind "ng"   -> value like +2348146088556
  //   kind "intl" -> value like +14155550123

  function parsePhone(raw) {

    const text = String(raw || "").trim();

    const fail = error => ({ ok: false, error });

    if (!text) {
      return fail("Enter your phone number.");
    }

    if (/[^\d\s+().-]/.test(text)) {
      return fail(
        "Your phone number can only contain digits, spaces and a + at the start."
      );
    }

    if (text.lastIndexOf("+") > 0) {
      return fail("The + sign can only be at the very start of your number.");
    }

    let plus = text.startsWith("+");
    let digits = text.replace(/\D/g, "");

    if (!plus && digits.startsWith("00")) {
      plus = true;
      digits = digits.slice(2);
    }

    if (!digits) {
      return fail("Enter your phone number.");
    }

    let national = null;
    let form = null;

    if (plus && digits.startsWith("234")) {

      form = "country";
      national = digits.slice(3);

    } else if (plus) {

      // Other countries: 8 to 15 digits, not starting with 0.

      if (digits.startsWith("0")) {
        return fail(
          "After the + sign, enter the country code first (for example +234 or +44)."
        );
      }

      if (digits.length < 8) {
        return fail(
          `That number has only ${digits.length} digits. Please check it.`
        );
      }

      if (digits.length > 15) {
        return fail(
          `That number has ${digits.length} digits, which is too many. Please check it.`
        );
      }

      return {
        ok: true,
        kind: "intl",
        value: "+" + digits,
        display: "+" + digits
      };

    } else if (digits.startsWith("234") && digits.length >= 13) {

      form = "country";
      national = digits.slice(3);

    } else if (digits.startsWith("0")) {

      form = "local";
      national = digits.slice(1);

    } else if (/^[789]/.test(digits) && digits.length >= 10) {

      form = "no-zero";
      national = digits;

    } else {

      return fail(
        "Start with 0, for example 0814 608 8556, or with a country code such as +234."
      );

    }

    // "+234 0814..." has an extra 0 after the country code.

    if (form === "country" && national.startsWith("0")) {
      national = national.slice(1);
    }

    if (national.length < 10) {

      const missing = 10 - national.length;

      return fail(
        form === "local"
          ? `That number has ${national.length + 1} digits but Nigerian numbers have 11 (like 0814 608 8556). ${missing === 1 ? "One digit is" : missing + " digits are"} missing.`
          : `That number is ${missing === 1 ? "one digit" : missing + " digits"} short. Please check it.`
      );

    }

    if (national.length > 10) {

      const extra = national.length - 10;

      return fail(
        form === "local"
          ? `That number has ${national.length + 1} digits but Nigerian numbers have 11 (like 0814 608 8556). ${extra === 1 ? "One digit is" : extra + " digits are"} extra.`
          : `That number is ${extra === 1 ? "one digit" : extra + " digits"} too long. Please check it.`
      );

    }

    if (!NG_NATIONAL.test(national)) {
      return fail(
        "That does not look like a Nigerian mobile number. Mobile numbers start with 070, 080, 081, 090 or 091. For another country, start with + and the country code."
      );
    }

    if (looksLikePlaceholder(national)) {
      return fail(
        "That number looks incorrect. Please enter your real phone number."
      );
    }

    return {
      ok: true,
      kind: "ng",
      value: "+234" + national,
      display: "+234 " + groupDigits(national, [3, 3, 4])
    };

  }


  // Formats a number while the customer types.
  //   0814 608 8556  |  +234 814 608 8556  |  +14155550123

  function formatPhoneAsTyped(raw) {

    const text = String(raw || "");

    let plus = text.trim().startsWith("+");
    let digits = text.replace(/\D/g, "");

    if (!plus && digits.startsWith("00")) {
      plus = true;
      digits = digits.slice(2);
    }

    if (!plus && digits.startsWith("234")) {
      plus = true;
    }

    if (!digits) {
      return plus ? "+" : "";
    }

    if (plus) {

      if (digits.startsWith("234")) {

        const rest = digits.slice(3);

        return "+234" + (
          rest ? " " + groupDigits(rest, [3, 3, 4]) : ""
        );

      }

      return "+" + digits;

    }

    if (digits.startsWith("0")) {
      return groupDigits(digits, [4, 3, 4]);
    }

    return groupDigits(digits, [3, 3, 4]);

  }


  return {
    checkEmail,
    parsePhone,
    formatPhoneAsTyped
  };

})();


document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // REGISTRATION ELEMENTS
  // ==========================================

  const registerForm = document.getElementById("registerForm");
  const registerButton = document.getElementById("registerButton");
  const authMessage = document.getElementById("authMessage");

  const fullNameInput = document.getElementById("fullName");
  const emailInput = document.getElementById("email");
  const confirmEmailInput = document.getElementById("confirmEmail");
  const phoneInput = document.getElementById("phone");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const acceptTermsInput = document.getElementById("acceptTerms");


  // ==========================================
  // CHECK REQUIRED ELEMENTS
  // ==========================================

  if (!registerForm || !registerButton) {
    return;
  }


  // ==========================================
  // THEME MANAGEMENT
  // ==========================================

  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {

    document.documentElement.dataset.theme = theme;

    const icon = themeToggle?.querySelector(".theme-icon");

    if (icon) {
      icon.textContent = theme === "dark" ? "☀" : "☾";
    }

    if (themeToggle) {
      themeToggle.setAttribute(
        "aria-label",
        theme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      );
    }

  }


  function initializeTheme() {

    const savedTheme = localStorage.getItem("hafhass-theme");

    const theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : document.documentElement.dataset.theme || "light";

    applyTheme(theme);

    themeToggle?.addEventListener("click", () => {

      const newTheme =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(newTheme);

      localStorage.setItem("hafhass-theme", newTheme);

    });

  }


  initializeTheme();


  // ==========================================
  // MESSAGE HANDLER
  // ==========================================

  function showMessage(message, type = "info") {

    if (!authMessage) return;

    authMessage.textContent = message;

    authMessage.className = `auth-message is-visible ${type}`;

  }


  function clearMessage() {

    if (!authMessage) return;

    authMessage.textContent = "";
    authMessage.className = "auth-message";

  }


  // ==========================================
  // BUTTON LOADING STATE
  // ==========================================

  function setLoading(isLoading) {

    const buttonText = registerButton.querySelector(".button-text");

    registerButton.disabled = isLoading;

    if (isLoading) {

      if (buttonText) {
        buttonText.textContent = "Creating Account...";
      }

      registerButton.insertAdjacentHTML(
        "beforeend",
        '<span class="auth-spinner" aria-hidden="true"></span>'
      );

    } else {

      if (buttonText) {
        buttonText.textContent = "Create Account";
      }

      const spinner = registerButton.querySelector(".auth-spinner");

      if (spinner) {
        spinner.remove();
      }

    }

  }


  // ==========================================
  // PASSWORD VISIBILITY
  // ==========================================

  const passwordToggles = document.querySelectorAll(
    "[data-toggle-password]"
  );

  passwordToggles.forEach((toggle) => {

    toggle.addEventListener("click", () => {

      const inputId = toggle.dataset.togglePassword;
      const input = document.getElementById(inputId);

      if (!input) return;

      const isPassword = input.type === "password";

      input.type = isPassword ? "text" : "password";

      toggle.textContent = isPassword ? "Hide" : "Show";

      toggle.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
      );

    });

  });


  // ==========================================
  // PASSWORD MATCH VALIDATION
  // ==========================================

  confirmPasswordInput?.addEventListener("input", () => {

    confirmPasswordInput.setCustomValidity("");

    if (
      confirmPasswordInput.value &&
      passwordInput.value !== confirmPasswordInput.value
    ) {

      confirmPasswordInput.setCustomValidity(
        "Passwords do not match."
      );

    }

  });


  passwordInput?.addEventListener("input", () => {

    if (confirmPasswordInput) {
      confirmPasswordInput.setCustomValidity("");
    }

  });


  // ==========================================
  // EMAIL AND PHONE FIELD CHECKS
  // ==========================================

  function getFeedbackElement(input) {

    let element = document.getElementById(`${input.id}Feedback`);

    if (!element) {

      element = document.createElement("p");

      element.id = `${input.id}Feedback`;
      element.className = "auth-field-message";
      element.hidden = true;

      input.insertAdjacentElement("afterend", element);

    }

    input.setAttribute("aria-describedby", element.id);

    return element;

  }


  // type: "error" | "warning" | "success"
  // An empty message clears the field's feedback.

  function showFieldMessage(input, message, type = "error", actions = []) {

    const element = getFeedbackElement(input);

    element.replaceChildren();

    input.classList.remove("is-invalid", "is-valid");
    input.removeAttribute("aria-invalid");

    if (!message) {

      element.hidden = true;
      element.className = "auth-field-message";

      return;

    }

    element.hidden = false;
    element.className = `auth-field-message is-${type}`;

    element.appendChild(document.createTextNode(message));

    actions.forEach(action => {

      const button = document.createElement("button");

      button.type = "button";
      button.className = "auth-field-action";
      button.textContent = action.label;

      button.addEventListener("click", action.onClick);

      element.append(" ", button);

    });

    if (type === "error") {
      input.classList.add("is-invalid");
      input.setAttribute("aria-invalid", "true");
    }

    if (type === "success") {
      input.classList.add("is-valid");
    }

  }


  [emailInput, confirmEmailInput, phoneInput].forEach(input => {

    if (input) {
      getFeedbackElement(input);
    }

  });


  // ------------------------------------------
  // EMAIL
  // ------------------------------------------

  // The address the customer chose to keep after we
  // suggested a correction.

  let keptEmail = "";

  function checkEmailField() {

    const result = HafhassValidate.checkEmail(emailInput.value);

    if (!emailInput.value.trim()) {

      showFieldMessage(emailInput, "");

      return { ...result, needsDecision: false };

    }

    emailInput.value = result.value;

    const useSuggestion = () => {

      emailInput.value = result.suggestion;
      keptEmail = "";

      clearMessage();
      checkEmailField();
      checkConfirmEmailField();

    };

    if (!result.ok) {

      showFieldMessage(
        emailInput,
        result.error,
        "error",
        result.suggestion
          ? [{
              label: `Use ${result.suggestion}`,
              onClick: useSuggestion
            }]
          : []
      );

      return { ...result, needsDecision: false };

    }

    if (result.suggestion && result.value !== keptEmail) {

      showFieldMessage(
        emailInput,
        `Did you mean ${result.suggestion}?`,
        "warning",
        [
          {
            label: "Yes, use it",
            onClick: useSuggestion
          },
          {
            label: "No, keep mine",
            onClick: () => {

              keptEmail = result.value;

              clearMessage();
              checkEmailField();

            }
          }
        ]
      );

      return { ...result, needsDecision: true };

    }

    showFieldMessage(emailInput, "");

    return { ...result, needsDecision: false };

  }


  function checkConfirmEmailField() {

    if (!confirmEmailInput) {
      return true;
    }

    const first = emailInput.value.trim().toLowerCase();
    const second = confirmEmailInput.value.trim().toLowerCase();

    if (!second) {

      showFieldMessage(confirmEmailInput, "");

      return false;

    }

    confirmEmailInput.value = second;

    if (first !== second) {

      showFieldMessage(
        confirmEmailInput,
        "The email addresses do not match.",
        "error"
      );

      return false;

    }

    showFieldMessage(
      confirmEmailInput,
      "Email addresses match.",
      "success"
    );

    return true;

  }


  emailInput.addEventListener("input", () => {
    showFieldMessage(emailInput, "");
  });

  emailInput.addEventListener("blur", () => {

    checkEmailField();
    checkConfirmEmailField();

  });

  if (confirmEmailInput) {

    confirmEmailInput.addEventListener("input", () => {

      const typed = confirmEmailInput.value.trim().toLowerCase();

      if (typed && typed === emailInput.value.trim().toLowerCase()) {
        checkConfirmEmailField();
      } else {
        showFieldMessage(confirmEmailInput, "");
      }

    });

    confirmEmailInput.addEventListener(
      "blur",
      checkConfirmEmailField
    );

  }


  // ------------------------------------------
  // PHONE
  // ------------------------------------------

  function checkPhoneField() {

    const result = HafhassValidate.parsePhone(phoneInput.value);

    if (!phoneInput.value.trim()) {

      showFieldMessage(phoneInput, "");

      return result;

    }

    if (!result.ok) {

      showFieldMessage(phoneInput, result.error, "error");

      return result;

    }

    // Show the customer exactly what will be saved.

    phoneInput.value = result.display;

    showFieldMessage(phoneInput, "");

    return result;

  }


  // Format the number as it is typed, keeping the cursor
  // next to the digit being edited.

  phoneInput.addEventListener("input", () => {

    const before = phoneInput.value;
    const caret = phoneInput.selectionStart ?? before.length;
    const atEnd = caret >= before.length;

    const digitsBeforeCaret = before
      .slice(0, caret)
      .replace(/\D/g, "")
      .length;

    const formatted = HafhassValidate.formatPhoneAsTyped(before);

    if (formatted !== before) {

      phoneInput.value = formatted;

      let position = formatted.length;

      if (!atEnd) {

        position = 0;

        let seen = 0;

        while (
          position < formatted.length &&
          seen < digitsBeforeCaret
        ) {

          if (/\d/.test(formatted[position])) {
            seen++;
          }

          position++;

        }

      }

      phoneInput.setSelectionRange(position, position);

    }

    showFieldMessage(phoneInput, "");

  });

  phoneInput.addEventListener("blur", checkPhoneField);


  // ==========================================
  // CLEAR MESSAGES WHEN USER EDITS FORM
  // ==========================================

  registerForm.addEventListener("input", clearMessage);


  // ==========================================
  // REGISTRATION SUBMISSION
  // ==========================================

  registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearMessage();

    // ------------------------------------------
    // GET FORM VALUES
    // ------------------------------------------

    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const phone = phoneInput.value.trim();

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const acceptedTerms = acceptTermsInput.checked;


    // ------------------------------------------
    // VALIDATE FORM
    // ------------------------------------------

    if (!fullName || !email || !phone || !password || !confirmPassword) {

      showMessage(
        "Please complete all required fields.",
        "error"
      );

      return;

    }


    if (fullName.length < 2) {

      showMessage(
        "Please enter your full name.",
        "error"
      );

      fullNameInput.focus();

      return;

    }


    // ------------------------------------------
    // CHECK EMAIL AND PHONE
    // ------------------------------------------

    const emailCheck = checkEmailField();

    if (!emailCheck.ok) {

      showMessage(emailCheck.error, "error");

      emailInput.focus();

      return;

    }

    if (emailCheck.needsDecision) {

      showMessage(
        "Please check your email address. Is it spelled correctly?",
        "error"
      );

      emailInput.focus();

      return;

    }

    if (confirmEmailInput && !checkConfirmEmailField()) {

      showMessage(
        "The email addresses do not match. Please check them.",
        "error"
      );

      confirmEmailInput.focus();

      return;

    }

    const phoneCheck = checkPhoneField();

    if (!phoneCheck.ok) {

      showMessage(phoneCheck.error, "error");

      phoneInput.focus();

      return;

    }


    if (password.length < 8) {

      showMessage(
        "Your password must contain at least 8 characters.",
        "error"
      );

      passwordInput.focus();

      return;

    }


    if (password !== confirmPassword) {

      showMessage(
        "Your passwords do not match. Please check them.",
        "error"
      );

      confirmPasswordInput.focus();

      return;

    }


    if (!acceptedTerms) {

      showMessage(
        "Please accept the Terms & Conditions and Privacy Policy.",
        "error"
      );

      return;

    }


    // ------------------------------------------
    // CHECK AUTHENTICATION SERVICE
    // ------------------------------------------

    if (!window.HafhassAuth) {

      showMessage(
        "Authentication service is unavailable. Please refresh the page.",
        "error"
      );

      return;

    }


    // ------------------------------------------
    // CREATE ACCOUNT
    // ------------------------------------------

    setLoading(true);

    try {

      const result = await window.HafhassAuth.register({
        fullName,
        email: emailCheck.value,
        phone: phoneCheck.value,
        password
      });


      // ----------------------------------------
      // HANDLE RETURNED ERRORS
      // ----------------------------------------

      if (result?.error) {
        throw result.error;
      }


      // ----------------------------------------
      // REGISTRATION SUCCESSFUL
      // ----------------------------------------

      showMessage(
        "Your account has been created successfully! Please check your email for a confirmation link before signing in.",
        "success"
      );

      registerForm.reset();

      keptEmail = "";

      [emailInput, confirmEmailInput, phoneInput].forEach(input => {

        if (input) {
          showFieldMessage(input, "");
        }

      });

      // Allow the user to read the success message.
      setTimeout(() => {

        window.location.href = "login.html";

      }, 5000);


    } catch (error) {

      console.error("Registration error:", error);

      let message = "We couldn't create your account. Please try again.";

      const errorMessage = (error.message || "").toLowerCase();


      if (
        errorMessage.includes("already registered") ||
        errorMessage.includes("already exists")
      ) {

        message = "An account with this email address already exists. Please sign in instead.";

      } else if (
        errorMessage.includes("invalid email")
      ) {

        message = "Please enter a valid email address.";

      } else if (
        errorMessage.includes("password")
      ) {

        message = "Your password does not meet the security requirements.";

      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {

        message = "Network error. Please check your internet connection and try again.";

      } else if (error.message) {

        message = error.message;

      }

      showMessage(message, "error");

    } finally {

      setLoading(false);

    }

  });

});