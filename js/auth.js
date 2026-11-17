// ======================================================
// HAFHASS EVENTS & DELIGHTS
// AUTHENTICATION CONTROLLER
// ======================================================

(() => {
  "use strict";

  // ====================================================
  // SUPABASE CLIENT
  // ====================================================

  const db = window.hafhassSupabase;

  if (!db) {
    console.error(
      "HAFHASS Auth: Supabase client is unavailable."
    );
    return;
  }


  // ====================================================
  // AUTHENTICATION HELPERS
  // ====================================================

  function getRedirectURL(page) {
    return new URL(page, window.location.origin).href;
  }


  function handleError(error) {
    console.error("HAFHASS Auth Error:", error);

    return {
      success: false,
      message: error?.message || "Something went wrong. Please try again."
    };
  }


  // ====================================================
  // CUSTOMER REGISTRATION
  // ====================================================

  async function register({
    fullName,
    email,
    phone,
    password
  }) {

    try {

      if (!fullName || !email || !phone || !password) {
        return {
          success: false,
          message: "Please complete all required fields."
        };
      }

      if (password.length < 8) {
        return {
          success: false,
          message: "Your password must contain at least 8 characters."
        };
      }

      const { data, error } = await db.auth.signUp({

        email: email.trim().toLowerCase(),

        password,

        options: {
          emailRedirectTo: getRedirectURL("login.html"),

          data: {
            full_name: fullName.trim(),
            phone: phone.trim()
          }
        }

      });

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        emailConfirmationRequired: !data.session,
        message: data.session
          ? "Your account has been created successfully."
          : "Registration successful! Please check your email to confirm your account."
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // CUSTOMER LOGIN
  // ====================================================

  async function login(email, password) {

    try {

      if (!email || !password) {
        return {
          success: false,
          message: "Please enter your email and password."
        };
      }

      const { data, error } = await db.auth.signInWithPassword({

        email: email.trim().toLowerCase(),

        password

      });

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        message: "Login successful."
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // ADMINISTRATOR LOGIN
  // ====================================================

  async function loginAdmin(email, password) {

    const result = await login(email, password);

    if (!result.success) {
      return result;
    }

    const profileResult = await getProfile();

    if (!profileResult.success) {

      await logout();

      return {
        success: false,
        message: "Unable to verify your administrator account."
      };

    }

    const profile = profileResult.profile;

    if (
      profile.role !== "admin" ||
      profile.is_active !== true
    ) {

      await logout();

      return {
        success: false,
        message: "You are not authorised to access the administration area."
      };

    }

    return {
      success: true,
      user: result.user,
      profile,
      message: "Administrator login successful."
    };

  }


  // ====================================================
  // LOGOUT
  // ====================================================

  async function logout() {

    try {

      const { error } = await db.auth.signOut();

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        message: "You have been logged out successfully."
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // GET CURRENT SESSION
  // ====================================================

  async function getSession() {

    try {

      const { data, error } = await db.auth.getSession();

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        session: data.session
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // GET CURRENT USER
  // ====================================================

  async function getCurrentUser() {

    try {

      const { data, error } = await db.auth.getUser();

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        user: data.user
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // GET CUSTOMER PROFILE
  // ====================================================

  async function getProfile() {

    try {

      const userResult = await getCurrentUser();

      if (!userResult.success || !userResult.user) {
        return {
          success: false,
          message: "You are not logged in."
        };
      }

      const { data, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", userResult.user.id)
        .maybeSingle();

      if (error) {
        return handleError(error);
      }

      if (!data) {
        return {
          success: false,
          message: "Your account profile could not be found."
        };
      }

      return {
        success: true,
        profile: data
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // PASSWORD RECOVERY REQUEST
  // ====================================================

  async function forgotPassword(email) {

    try {

      if (!email) {
        return {
          success: false,
          message: "Please enter your email address."
        };
      }

      const { error } = await db.auth.resetPasswordForEmail(

        email.trim().toLowerCase(),

        {
          redirectTo: getRedirectURL("reset-password.html")
        }

      );

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        message: "If an account exists for this email, a password recovery link will be sent."
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // UPDATE PASSWORD
  // ====================================================

  async function updatePassword(newPassword) {

    try {

      if (!newPassword || newPassword.length < 8) {
        return {
          success: false,
          message: "Your new password must contain at least 8 characters."
        };
      }

      const { data, error } = await db.auth.updateUser({

        password: newPassword

      });

      if (error) {
        return handleError(error);
      }

      return {
        success: true,
        user: data.user,
        message: "Your password has been updated successfully."
      };

    } catch (error) {

      return handleError(error);

    }

  }


  // ====================================================
  // AUTHENTICATION STATE LISTENER
  // ====================================================

  function onAuthStateChange(callback) {

    const { data } = db.auth.onAuthStateChange(

      (event, session) => {

        if (typeof callback === "function") {

          callback({
            event,
            session,
            user: session?.user || null
          });

        }

      }

    );

    return data.subscription;

  }


  // ====================================================
  // PUBLIC AUTHENTICATION API
  // ====================================================

  window.HafhassAuth = {

    register,
    login,
    loginAdmin,
    logout,

    getSession,
    getCurrentUser,
    getProfile,

    forgotPassword,
    updatePassword,

    onAuthStateChange

  };


  console.log(
    "HAFHASS: Authentication controller initialized."
  );

})();