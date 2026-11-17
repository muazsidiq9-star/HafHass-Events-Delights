// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER ACCOUNT LAYOUT
// Shared interface functionality
// ======================================================

(() => {
  "use strict";

  function initializeAccountLayout() {

    // ==================================================
    // ELEMENTS
    // ==================================================

    const menuToggle = document.getElementById("accountMenuToggle");
    const sidebar = document.getElementById("accountSidebar");
    const overlay = document.getElementById("accountSidebarOverlay");

    const themeToggle = document.getElementById("themeToggle");
    const themeIcon = themeToggle?.querySelector(".theme-icon");

    const logoutButton = document.getElementById("logoutButton");
    const yearElement = document.getElementById("accountYear");

    const cartCountElement = document.getElementById("accountCartCount");


    // ==================================================
    // THEME MANAGEMENT
    // ==================================================

    const THEME_KEY = "hafhass-theme";

    function getPreferredTheme() {

      try {

        const savedTheme = localStorage.getItem(THEME_KEY);

        if (savedTheme === "light" || savedTheme === "dark") {
          return savedTheme;
        }

      } catch (error) {
        console.warn("HAFHASS: Theme preference unavailable.");
      }

      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }


    function updateThemeIcon(theme) {

      if (!themeIcon) return;

      // Use Font Awesome classes instead of textContent.
      // This prevents duplicate moon/sun icons.

      if (themeIcon.tagName.toLowerCase() === "i") {

        themeIcon.classList.remove(
          "fa-regular",
          "fa-solid",
          "fa-moon",
          "fa-sun"
        );

        if (theme === "dark") {

          themeIcon.classList.add(
            "fa-solid",
            "fa-sun"
          );

        } else {

          themeIcon.classList.add(
            "fa-regular",
            "fa-moon"
          );

        }

      } else {

        // Fallback for non-icon markup.

        themeIcon.textContent =
          theme === "dark" ? "☀" : "☾";

      }

    }


    function applyTheme(theme) {

      const selectedTheme =
        theme === "dark" ? "dark" : "light";

      document.documentElement.setAttribute(
        "data-theme",
        selectedTheme
      );

      document.body.setAttribute(
        "data-theme",
        selectedTheme
      );

      updateThemeIcon(selectedTheme);

      if (themeToggle) {

        themeToggle.setAttribute(
          "aria-label",
          selectedTheme === "dark"
            ? "Switch to light theme"
            : "Switch to dark theme"
        );

        themeToggle.setAttribute(
          "aria-pressed",
          selectedTheme === "dark" ? "true" : "false"
        );

      }

      try {

        localStorage.setItem(
          THEME_KEY,
          selectedTheme
        );

      } catch (error) {

        console.warn(
          "HAFHASS: Unable to save theme preference."
        );

      }

    }


    applyTheme(getPreferredTheme());


    if (themeToggle) {

      themeToggle.addEventListener("click", () => {

        const currentTheme =
          document.documentElement.getAttribute("data-theme");

        applyTheme(
          currentTheme === "dark" ? "light" : "dark"
        );

      });

    }


    // ==================================================
    // CUSTOMER CART COUNTER
    // ==================================================

    async function loadCartCount() {

      if (!cartCountElement) return;

      try {

        const supabase = window.hafhassSupabase;
        const auth = window.HafhassAuth;

        if (!supabase || !auth) {
          throw new Error(
            "Cart dependencies are unavailable."
          );
        }


        // Get the authenticated customer.

        const userResult = await auth.getCurrentUser();

        const currentUser =
          userResult?.user ||
          userResult?.data?.user ||
          null;


        if (!currentUser?.id) {

          cartCountElement.textContent = "0";

          return;

        }


        // Find the customer's latest active cart.

        const { data: cart, error: cartError } = await supabase
          .from("carts")
          .select("id")
          .eq("user_id", currentUser.id)
          .eq("status", "active")
          .order("created_at", {
            ascending: false
          })
          .limit(1)
          .maybeSingle();


        if (cartError) {
          throw cartError;
        }


        // No active cart means an empty cart.

        if (!cart) {

          cartCountElement.textContent = "0";

          return;

        }


        // Get the quantities of all items in the active cart.

        const { data: cartItems, error: itemsError } = await supabase
          .from("cart_items")
          .select("quantity")
          .eq("cart_id", cart.id);


        if (itemsError) {
          throw itemsError;
        }


        const totalQuantity = (cartItems || []).reduce(
          (total, item) => {

            const quantity = Number(item.quantity) || 0;

            return total + quantity;

          },
          0
        );


        cartCountElement.textContent =
          totalQuantity > 99 ? "99+" : String(totalQuantity);


        cartCountElement.setAttribute(
          "aria-label",
          `${totalQuantity} items in cart`
        );


      } catch (error) {

        console.error(
          "HAFHASS: Unable to load cart count.",
          error
        );

        cartCountElement.textContent = "0";

      }

    }


    loadCartCount();


    // Allow other account scripts to request a cart refresh.

    window.addEventListener("hafhass:cart-updated", loadCartCount);


    // ==================================================
    // MOBILE SIDEBAR
    // ==================================================

    function openSidebar() {

      if (!sidebar || !menuToggle) return;

      sidebar.classList.add("is-open");

      if (overlay) {
        overlay.classList.add("is-visible");
      }

      menuToggle.classList.add("is-active");

      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "Close account menu");

      document.body.classList.add("account-menu-open");

    }


    function closeSidebar() {

      if (!sidebar || !menuToggle) return;

      sidebar.classList.remove("is-open");

      if (overlay) {
        overlay.classList.remove("is-visible");
      }

      menuToggle.classList.remove("is-active");

      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open account menu");

      document.body.classList.remove("account-menu-open");

    }


    function toggleSidebar() {

      const isOpen =
        sidebar?.classList.contains("is-open");

      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }

    }


    if (menuToggle) {

      menuToggle.addEventListener(
        "click",
        toggleSidebar
      );

    }


    if (overlay) {
      overlay.addEventListener("click", closeSidebar);
    }


    if (sidebar) {

      sidebar.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", closeSidebar);

      });

    }


    document.addEventListener("keydown", event => {

      if (event.key === "Escape") {
        closeSidebar();
      }

    });


    window.addEventListener("resize", () => {

      if (window.innerWidth > 800) {
        closeSidebar();
      }

    });


    // ==================================================
    // FOOTER YEAR
    // ==================================================

    if (yearElement) {

      yearElement.textContent =
        new Date().getFullYear();

    }


    // ==================================================
    // SIGN OUT
    // ==================================================

    if (logoutButton) {

      logoutButton.addEventListener("click", async () => {

        const confirmed = window.confirm(
          "Are you sure you want to sign out?"
        );

        if (!confirmed) return;

        const originalText = logoutButton.textContent;

        logoutButton.disabled = true;
        logoutButton.textContent = "Signing out...";

        try {

          if (
            !window.HafhassAuth ||
            typeof window.HafhassAuth.logout !== "function"
          ) {

            throw new Error(
              "Authentication service is unavailable."
            );

          }


          const result = await window.HafhassAuth.logout();

          if (result && result.success === false) {

            throw new Error(
              result.message || "Unable to sign out."
            );

          }


          window.location.replace("../login.html");


        } catch (error) {

          console.error(
            "HAFHASS: Sign out failed.",
            error
          );

          window.alert(
            error.message ||
            "Unable to sign out. Please try again."
          );

          logoutButton.disabled = false;
          logoutButton.textContent = originalText;

        }

      });

    }


    console.log(
      "HAFHASS: Customer account layout initialized."
    );

  }


  // ====================================================
  // START
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initializeAccountLayout,
      { once: true }
    );

  } else {

    initializeAccountLayout();

  }

})();