// ======================================================
// HAFHASS EVENTS & DELIGHTS
// PAGE ACCESS GUARDS
// ======================================================

(() => {
  "use strict";


  // ====================================================
  // AUTHENTICATION DEPENDENCY
  // ====================================================

  const auth = window.HafhassAuth;

  if (!auth) {
    console.error(
      "HAFHASS Guards: Authentication controller unavailable."
    );
    return;
  }


  // ====================================================
  // REDIRECT HELPER
  // ====================================================

  function redirectTo(page) {

    const destination = new URL(
      page,
      window.location.href
    );

    window.location.replace(destination.href);

  }


  // ====================================================
  // REQUIRE AUTHENTICATED USER
  // ====================================================

  async function requireAuth(options = {}) {

    const {
      loginPage = "/login.html"
    } = options;

    const result = await auth.getCurrentUser();

    if (!result?.success || !result.user) {

      redirectTo(loginPage);

      return {
        authorized: false,
        reason: "unauthenticated"
      };

    }

    return {
      authorized: true,
      user: result.user
    };

  }


  // ====================================================
  // REQUIRE ACTIVE ACCOUNT
  // ====================================================

  async function requireActiveAccount(options = {}) {

    const {
      loginPage = "/login.html"
    } = options;

    const authResult = await requireAuth({
      loginPage
    });

    if (!authResult.authorized) {
      return authResult;
    }

    const profileResult = await auth.getProfile();

    if (
      !profileResult?.success ||
      !profileResult.profile
    ) {

      console.error(
        "HAFHASS Guards: Unable to retrieve customer profile."
      );

      redirectTo(loginPage);

      return {
        authorized: false,
        reason: "profile_unavailable"
      };

    }

    const profile = profileResult.profile;

    if (profile.is_active !== true) {

      await auth.logout();

      redirectTo(loginPage);

      return {
        authorized: false,
        reason: "account_inactive"
      };

    }

    return {
      authorized: true,
      user: authResult.user,
      profile
    };

  }


  // ====================================================
  // CUSTOMER PAGE PROTECTION
  // ====================================================

  async function protectCustomerPage(options = {}) {

    const {
      loginPage = "/login.html"
    } = options;

    const result = await requireActiveAccount({
      loginPage
    });

    if (!result.authorized) {
      return result;
    }

    const profile = result.profile;

    // Redirect administrators to their dashboard.

    if (profile.role === "admin") {

      redirectTo("/admin/dashboard.html");

      return {
        authorized: false,
        reason: "admin_account"
      };

    }

    // Only customers can access customer pages.

    if (profile.role !== "customer") {

      redirectTo("/index.html");

      return {
        authorized: false,
        reason: "insufficient_permissions"
      };

    }

    window.HafhassPageUser = {
      user: result.user,
      profile
    };

    return result;

  }


  // ====================================================
  // ADMIN PAGE PROTECTION
  // ====================================================

  async function protectAdminPage(options = {}) {

    const {
      loginPage = "/login.html"
    } = options;

    const result = await requireActiveAccount({
      loginPage
    });

    if (!result.authorized) {
      return result;
    }

    const profile = result.profile;

    if (
  profile.role !== "admin" ||
  profile.is_active !== true
) {

  redirectTo(loginPage);

  return {
    authorized: false,
    reason: "insufficient_permissions"
  };

}

    window.HafhassAdmin = {
      user: result.user,
      profile
    };

    return {
      authorized: true,
      user: result.user,
      profile
    };

  }


  // ====================================================
  // REDIRECT AUTHENTICATED USERS
  // ====================================================

  async function redirectIfAuthenticated(options = {}) {

    const {
      customerPage = "/account/dashboard.html"
    } = options;

    const result = await auth.getCurrentUser();

    if (!result?.success || !result.user) {

      return {
        authorized: true,
        authenticated: false
      };

    }

    const profileResult = await auth.getProfile();

    if (
      !profileResult?.success ||
      !profileResult.profile
    ) {

      return {
        authorized: false,
        authenticated: true,
        reason: "profile_unavailable"
      };

    }

    const profile = profileResult.profile;

    if (profile.is_active !== true) {

      await auth.logout();

      return {
        authorized: false,
        reason: "account_inactive"
      };

    }

    if (profile.role === "admin") {

      redirectTo("/admin/dashboard.html");

    } else if (profile.role === "customer") {

      redirectTo(customerPage);

    } else {

      redirectTo("/index.html");

      return {
        authorized: false,
        reason: "unsupported_role"
      };

    }

    return {
      authorized: false,
      reason: "already_authenticated"
    };

  }


  // ====================================================
  // PUBLIC PAGE AUTHENTICATION HELPERS
  // ====================================================

  async function getPageUser() {

    const authResult = await auth.getCurrentUser();

    // Public pages should remain accessible to guests.

    if (!authResult?.success || !authResult.user) {
      return null;
    }

    const profileResult = await auth.getProfile();

    if (
      !profileResult?.success ||
      !profileResult.profile
    ) {
      return null;
    }

    const profile = profileResult.profile;

    if (profile.is_active !== true) {

      await auth.logout();

      return null;

    }

    return {
      user: authResult.user,
      profile
    };

  }


  // ====================================================
  // PUBLIC ACCESS GUARD API
  // ====================================================

  window.HafhassGuards = {

    requireAuth,
    requireActiveAccount,

    protectCustomerPage,
    protectAdminPage,

    redirectIfAuthenticated,
    getPageUser

  };


  console.log(
    "HAFHASS: Page access guards initialized."
  );

})();