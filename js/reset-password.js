document.addEventListener("DOMContentLoaded", async () => {

  // ==========================================
  // ELEMENTS
  // ==========================================

  const form = document.getElementById("resetPasswordForm");
  const button = document.getElementById("resetPasswordButton");
  const messageBox = document.getElementById("authMessage");

  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  if (!form || !button) return;


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

    messageBox.textContent = message;
    messageBox.className = `auth-message is-visible ${type}`;

  }


  function clearMessage() {

    messageBox.textContent = "";
    messageBox.className = "auth-message";

  }


  // ==========================================
  // LOADING STATE
  // ==========================================

  function setLoading(isLoading) {

    const buttonText = button.querySelector(".button-text");

    button.disabled = isLoading;

    if (buttonText) {
      buttonText.textContent = isLoading
        ? "Updating Password..."
        : "Update Password";
    }

    const spinner = button.querySelector(".auth-spinner");

    if (isLoading && !spinner) {

      button.insertAdjacentHTML(
        "beforeend",
        '<span class="auth-spinner" aria-hidden="true"></span>'
      );

    } else if (!isLoading && spinner) {

      spinner.remove();

    }

  }


  // ==========================================
  // PASSWORD VISIBILITY
  // ==========================================

  document.querySelectorAll("[data-toggle-password]").forEach((toggle) => {

    toggle.addEventListener("click", () => {

      const input = document.getElementById(
        toggle.dataset.togglePassword
      );

      if (!input) return;

      const showPassword = input.type === "password";

      input.type = showPassword ? "text" : "password";

      toggle.textContent = showPassword ? "Hide" : "Show";

      toggle.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password"
      );

    });

  });


  // ==========================================
  // CHECK RECOVERY SESSION
  // ==========================================

  let recoverySessionAvailable = false;

  try {

    if (!window.hafhassSupabase) {
      throw new Error("Supabase is not configured.");
    }

    const { data, error } =
      await window.hafhassSupabase.auth.getSession();

    if (error) throw error;

    recoverySessionAvailable = Boolean(data.session);

  } catch (error) {

    console.error("Recovery session error:", error);

  }


  // ==========================================
  // HANDLE INVALID OR EXPIRED LINK
  // ==========================================

  if (!recoverySessionAvailable) {

    showMessage(
      "This password-reset link is invalid or has expired. Please request a new reset link.",
      "error"
    );

    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = true;
    });

    return;

  }


  // ==========================================
  // CLEAR MESSAGES ON INPUT
  // ==========================================

  form.addEventListener("input", clearMessage);


  // ==========================================
  // PASSWORD MATCH VALIDATION
  // ==========================================

  confirmPasswordInput.addEventListener("input", () => {

    confirmPasswordInput.setCustomValidity("");

    if (
      confirmPasswordInput.value &&
      newPasswordInput.value !== confirmPasswordInput.value
    ) {

      confirmPasswordInput.setCustomValidity(
        "Passwords do not match."
      );

    }

  });


  // ==========================================
  // UPDATE PASSWORD
  // ==========================================

  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearMessage();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!newPassword || !confirmPassword) {

      showMessage(
        "Please complete both password fields.",
        "error"
      );

      return;

    }


    if (newPassword.length < 8) {

      showMessage(
        "Your password must contain at least 8 characters.",
        "error"
      );

      return;

    }


    if (newPassword !== confirmPassword) {

      showMessage(
        "Your passwords do not match.",
        "error"
      );

      confirmPasswordInput.focus();

      return;

    }


    if (!window.HafhassAuth) {

      showMessage(
        "Authentication service is unavailable. Please refresh the page.",
        "error"
      );

      return;

    }


    // ------------------------------------------
    // SUBMIT NEW PASSWORD
    // ------------------------------------------

    setLoading(true);

    try {

      const result = await window.HafhassAuth.updatePassword(
        newPassword
      );

      if (result?.error) {
        throw result.error;
      }


      // ----------------------------------------
      // SUCCESS
      // ----------------------------------------

      showMessage(
        "Your password has been updated successfully! Please sign in with your new password.",
        "success"
      );

      form.reset();

      form.querySelectorAll("input").forEach((input) => {
        input.disabled = true;
      });


      // Sign out the recovery session before
      // sending the customer to the login page.

      setTimeout(async () => {

        try {
          await window.HafhassAuth.logout();
        } catch (error) {
          console.error("Sign-out error:", error);
        }

        window.location.href = "login.html";

      }, 3000);


    } catch (error) {

      console.error("Password update error:", error);

      showMessage(
        error.message || "We couldn't update your password. Please try again.",
        "error"
      );

    } finally {

      setLoading(false);

    }

  });

});