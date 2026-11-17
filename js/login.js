document.addEventListener("DOMContentLoaded", () => {

  "use strict";

  // ==========================================
  // LOGIN ELEMENTS
  // ==========================================

  const loginForm = document.getElementById("loginForm");
  const loginButton = document.getElementById("loginButton");
  const authMessage = document.getElementById("authMessage");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");


  if (!loginForm || !loginButton) return;


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
  // LOADING STATE
  // ==========================================

  function setLoading(isLoading) {

    const buttonText = loginButton.querySelector(".button-text");

    loginButton.disabled = isLoading;

    if (buttonText) {
      buttonText.textContent = isLoading
        ? "Signing In..."
        : "Sign In";
    }

    const existingSpinner = loginButton.querySelector(".auth-spinner");

    if (isLoading && !existingSpinner) {

      loginButton.insertAdjacentHTML(
        "beforeend",
        '<span class="auth-spinner" aria-hidden="true"></span>'
      );

    } else if (!isLoading && existingSpinner) {

      existingSpinner.remove();

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
  // CLEAR MESSAGE ON INPUT
  // ==========================================

  loginForm.addEventListener("input", clearMessage);


  // ==========================================
  // PROFILE NORMALIZATION
  // ==========================================

  function normalizeProfile(result) {

    return (
      result?.profile ||
      result?.data?.profile ||
      result?.data ||
      result
    );

  }


  // ==========================================
  // LOGIN SUBMISSION
  // ==========================================

  loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearMessage();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;


    // ------------------------------------------
    // VALIDATION
    // ------------------------------------------

    if (!email || !password) {

      showMessage(
        "Please enter your email address and password.",
        "error"
      );

      return;

    }


    const auth = window.HafhassAuth;

    if (!auth) {

      showMessage(
        "Authentication service is unavailable. Please refresh the page.",
        "error"
      );

      return;

    }


    // ------------------------------------------
    // AUTHENTICATE
    // ------------------------------------------

    setLoading(true);

    try {

      const result = await auth.login(email, password);

      if (result?.error || result?.success === false) {
        throw result?.error || new Error("Unable to sign in.");
      }


      // ----------------------------------------
      // RETRIEVE PROFILE
      // ----------------------------------------

      const profileResult = await auth.getProfile();

      if (profileResult?.error || profileResult?.success === false) {
        throw profileResult?.error ||
          new Error("Unable to retrieve your account profile.");
      }

      const profile = normalizeProfile(profileResult);

      if (!profile?.id || !profile?.role) {

        await auth.logout();

        throw new Error(
          "Your account profile could not be found. Please contact support."
        );

      }


      // ----------------------------------------
      // CHECK ACCOUNT STATUS
      // ----------------------------------------

      if (profile.is_active === false) {

        await auth.logout();

        throw new Error(
          "Your account is currently inactive. Please contact support."
        );

      }


      // ----------------------------------------
      // ROLE-BASED REDIRECTION
      // ----------------------------------------

      let destination;

      if (profile.role === "admin") {

        if (profile.is_active !== true) {

          await auth.logout();

          throw new Error(
            "Your administrator account is inactive. Please contact support."
          );

        }

        destination = "admin/dashboard.html";

      } else if (profile.role === "customer") {

        destination = "account/dashboard.html";

      } else if (profile.role === "staff") {

        throw new Error(
          "Staff dashboard is not available yet. Please contact the administrator."
        );

      } else {

        throw new Error(
          "Your account role is not recognized. Please contact support."
        );

      }


      // ----------------------------------------
      // REDIRECT
      // ----------------------------------------

      showMessage(
        "Sign-in successful! Redirecting...",
        "success"
      );

      setTimeout(() => {

        window.location.replace(destination);

      }, 800);


    } catch (error) {

      console.error("Login error:", error);

      let message =
        "Unable to sign in. Please check your details and try again.";

      const errorMessage = (error.message || "").toLowerCase();

      if (errorMessage.includes("invalid login credentials")) {

        message = "Incorrect email address or password.";

      } else if (errorMessage.includes("email not confirmed")) {

        message = "Please confirm your email address before signing in.";

      } else if (
        errorMessage.includes("inactive") ||
        errorMessage.includes("profile could not be found") ||
        errorMessage.includes("role is not recognized") ||
        errorMessage.includes("staff dashboard")
      ) {

        message = error.message;

      } else if (
        errorMessage.includes("network") ||
        errorMessage.includes("fetch")
      ) {

        message = "Network error. Please check your internet connection.";

      } else if (error.message) {

        message = error.message;

      }

      showMessage(message, "error");

    } finally {

      setLoading(false);

    }

  });

});