/* =========================================================
   HAFHASS EVENTS & DELIGHTS
   ADMIN LAYOUT CONTROLLER
========================================================= */

(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", initAdminLayout);

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;

  const elements = {
    themeToggle: document.getElementById("themeToggle"),

    menuToggle: document.getElementById("adminMenuToggle"),
    sidebar: document.getElementById("adminSidebar"),
    overlay: document.getElementById("adminSidebarOverlay"),

    headerName: document.getElementById("adminHeaderName"),
    sidebarName: document.getElementById("adminSidebarName"),
    sidebarEmail: document.getElementById("adminSidebarEmail"),
    avatar: document.getElementById("adminAvatar"),
    role: document.getElementById("adminRole"),

    logoutButton: document.getElementById("adminLogoutButton")
  };


  /* =======================================================
     1. INITIALIZATION
  ======================================================= */

  async function initAdminLayout() {

    initializeTheme();
    initializeSidebar();

    if (!supabase || !auth) {
      console.error("Admin Layout: Required dependencies are missing.");
      redirectToLogin();
      return;
    }

    initializeLogout();

    await verifyAdminAccess();
  }


  /* =======================================================
     2. ADMIN AUTHENTICATION & ACCESS PROTECTION
  ======================================================= */

  async function verifyAdminAccess() {

    try {

      const sessionResult = await auth.getSession();

      if (!sessionResult?.success) {
        throw new Error(
          sessionResult?.message || "Unable to verify session."
        );
      }

      const session = sessionResult.session;

      let user = session?.user;

      if (!user) {

        const userResult = await auth.getCurrentUser();

        if (!userResult?.success || !userResult.user) {
          redirectToLogin();
          return;
        }

        user = userResult.user;
      }

      if (!user?.id) {
        redirectToLogin();
        return;
      }

      const profileResult = await auth.getProfile();

      if (!profileResult?.success || !profileResult.profile) {
        throw new Error(
          profileResult?.message || "Unable to load admin profile."
        );
      }

      const profile = profileResult.profile;

      // Only active administrators may access this dashboard.
if (
  profile.role !== "admin" ||
  profile.is_active !== true
) {

  alert(
    "Access denied. Please log in with an active administrator account."
  );

  redirectToLogin();
  return;
}

      window.HafhassAdmin = {
        user,
        profile
      };

      populateAdminInformation(user, profile);
      ensureAdminProfileNavigation();

      document.body.classList.add("admin-authenticated");

    } catch (error) {

      console.error("Admin Access Error:", error);

      redirectToLogin();
    }
  }


  function redirectToLogin() {

    window.location.replace(
      "../login.html?redirect=admin/dashboard.html"
    );
  }


  /* =======================================================
     3. ADMIN INFORMATION
  ======================================================= */

  function populateAdminInformation(user, profile) {

    const fullName =
      profile?.full_name ||
      profile?.name ||
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "Administrator";

    const email =
      profile?.email ||
      user?.email ||
      "";

    const initials = fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join("");

    if (elements.headerName) {
      elements.headerName.textContent = fullName;
    }

    if (elements.sidebarName) {
      elements.sidebarName.textContent = fullName;
    }

    if (elements.sidebarEmail) {
      elements.sidebarEmail.textContent = email;
    }

    if (elements.avatar) {
      elements.avatar.textContent = initials || "A";
      elements.avatar.style.backgroundImage = profile?.avatar_url
        ? `url("${profile.avatar_url.replace(/["\\\\]/g, "")}")`
        : "";
      elements.avatar.style.backgroundSize = profile?.avatar_url ? "cover" : "";
      elements.avatar.style.backgroundPosition = profile?.avatar_url ? "center" : "";
      elements.avatar.style.backgroundRepeat = profile?.avatar_url ? "no-repeat" : "";
    }

    if (elements.role) {
      elements.role.textContent = "Administrator";
    }
  }


  /* =======================================================
     ADMIN PROFILE NAVIGATION
  ======================================================= */
  function ensureAdminProfileNavigation() {
    const navigation = document.querySelector(".admin-navigation");
    if (!navigation || navigation.querySelector('a[href="profile.html"]')) return;

    const settingsLink = navigation.querySelector('a[href="settings.html"]');
    if (!settingsLink) return;

    const link = document.createElement("a");
    link.href = "profile.html";
    link.className = "admin-nav-link";
    link.innerHTML = '<span class="admin-nav-icon"><i class="fa-solid fa-user-gear" aria-hidden="true"></i></span><span>My Profile</span>';

    const currentFile = window.location.pathname.split("/").pop();
    if (currentFile === "profile.html") {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    settingsLink.parentNode.insertBefore(link, settingsLink);
  }


  /* =======================================================
     4. THEME MANAGEMENT
  ======================================================= */

  function initializeTheme() {

    const savedTheme = localStorage.getItem("hafhass-theme");

    const currentTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : document.documentElement.dataset.theme || "light";

    applyTheme(currentTheme);

    elements.themeToggle?.addEventListener("click", () => {

      const newTheme =
        document.documentElement.dataset.theme === "dark"
          ? "light"
          : "dark";

      applyTheme(newTheme);

      localStorage.setItem("hafhass-theme", newTheme);
    });
  }


  function applyTheme(theme) {

    document.documentElement.dataset.theme = theme;

    const icon = elements.themeToggle?.querySelector(".theme-icon");

    if (icon) {

      icon.className =
        `fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"} theme-icon`;

    }

    if (elements.themeToggle) {
      elements.themeToggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }


  /* =======================================================
     5. MOBILE SIDEBAR
  ======================================================= */

  function initializeSidebar() {

    const { menuToggle, sidebar, overlay } = elements;

    if (!menuToggle || !sidebar || !overlay) return;

    function openSidebar() {

      sidebar.classList.add("open");
      overlay.classList.add("active");

      menuToggle.setAttribute("aria-expanded", "true");
      menuToggle.setAttribute("aria-label", "Close admin menu");

      document.body.classList.add("admin-menu-open");
    }

    function closeSidebar() {

      sidebar.classList.remove("open");
      overlay.classList.remove("active");

      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.setAttribute("aria-label", "Open admin menu");

      document.body.classList.remove("admin-menu-open");
    }

    menuToggle.addEventListener("click", () => {

      const isOpen = sidebar.classList.contains("open");

      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll("a").forEach(link => {

      link.addEventListener("click", () => {

        if (window.innerWidth <= 800) {
          closeSidebar();
        }
      });
    });

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
  }


  /* =======================================================
     6. ADMIN LOGOUT
  ======================================================= */

  function initializeLogout() {

    elements.logoutButton?.addEventListener("click", async () => {

      const confirmed = confirm(
        "Are you sure you want to log out of the admin dashboard?"
      );

      if (!confirmed) return;

      elements.logoutButton.disabled = true;

      try {

        const result = await auth.logout();

        if (!result.success) {
          throw new Error(
            result.message || "Unable to log out."
          );
        }

        window.location.replace("../login.html");

      } catch (error) {

        console.error("Admin Logout Error:", error);

        alert("Unable to log out. Please try again.");

        elements.logoutButton.disabled = false;
      }
    });
  }

})();
