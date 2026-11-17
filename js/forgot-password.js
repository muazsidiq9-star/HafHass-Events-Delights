document.addEventListener("DOMContentLoaded", () => {

  // ==========================================
  // ELEMENTS
  // ==========================================

  const form = document.getElementById("forgotPasswordForm");
  const button = document.getElementById("forgotPasswordButton");
  const messageBox = document.getElementById("authMessage");
  const emailInput = document.getElementById("email");

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
        ? "Sending..."
        : "Send Reset Link";
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
  // CLEAR MESSAGE WHEN EDITING
  // ==========================================

  form.addEventListener("input", clearMessage);


  // ==========================================
  // SUBMIT RECOVERY REQUEST
  // ==========================================

  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearMessage();

    const email = emailInput.value.trim().toLowerCase();

    if (!email) {

      showMessage(
        "Please enter your email address.",
        "error"
      );

      return;

    }


    if (!window.HafhassAuth) {

      showMessage(
        "Authentication service is unavailable. Please refresh the page.",
        "error"
      );

      return;

    }


    setLoading(true);

    try {

      const result = await window.HafhassAuth.forgotPassword(email);

      if (result?.error) {
        throw result.error;
      }


      // Use a neutral message to avoid revealing
      // whether an email address has an account.

      showMessage(
        "If an account exists with this email address, a password-reset link will be sent. Please check your inbox and spam folder.",
        "success"
      );

      form.reset();


    } catch (error) {

      console.error("Password recovery error:", error);

      let errorMessage =
        "We couldn't process your request. Please try again.";

      if (
        error.message?.toLowerCase().includes("network") ||
        error.message?.toLowerCase().includes("fetch")
      ) {

        errorMessage =
          "Network error. Please check your internet connection.";

      }

      showMessage(errorMessage, "error");

    } finally {

      setLoading(false);

    }

  });

});