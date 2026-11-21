// ======================================================
// HAFHASS EVENTS & DELIGHTS
// CUSTOMER PROFILE MANAGEMENT
// ======================================================

(() => {
  "use strict";


  // ====================================================
  // 1. DEPENDENCIES
  // ====================================================

  const supabase = window.hafhassSupabase;
  const auth = window.HafhassAuth;
  const guards = window.HafhassGuards;


  if (!supabase || !auth || !guards) {

    console.error(
      "HAFHASS Profile: Required dependencies unavailable."
    );

    return;

  }


  // ====================================================
  // 2. DOM ELEMENTS
  // ====================================================

  const elements = {

    profileForm: document.getElementById("profileForm"),

    fullName: document.getElementById("profileFullName"),

    email: document.getElementById("profileEmail"),

    phone: document.getElementById("profilePhone"),

    profileMessage: document.getElementById("profileMessage"),

    editButton: document.getElementById("editProfileButton"),

    saveButton: document.getElementById("saveProfileButton"),

    resetButton: document.getElementById("resetProfileButton"),

    editActions: document.getElementById("profileEditActions"),

    profileAvatar: document.getElementById("profileAvatar"),

    displayName: document.getElementById("profileDisplayName"),

    displayEmail: document.getElementById("profileDisplayEmail"),

    roleBadge: document.getElementById("profileRoleBadge"),

    accountStatus: document.getElementById("profileAccountStatus"),

    createdAt: document.getElementById("profileCreatedAt"),

    sidebarAvatar: document.getElementById("avatarInitials"),

    sidebarName: document.getElementById("sidebarUserName"),

    sidebarEmail: document.getElementById("sidebarUserEmail"),

    accountYear: document.getElementById("accountYear")

  };


  // ====================================================
  // 3. STATE
  // ====================================================

  let currentUser = null;

  let originalProfile = null;

  let isSaving = false;

  let profileLoaded = false;

  let isEditing = false;


  // ====================================================
  // 4. INITIALS
  // ====================================================

  function getInitials(name) {

    if (!name || typeof name !== "string") {
      return "C";
    }

    const parts = name.trim().split(/\s+/);

    if (!parts.length || !parts[0]) {
      return "C";
    }

    if (parts.length === 1) {

      return parts[0].charAt(0).toUpperCase();

    }

    return (

      parts[0].charAt(0) +

      parts[parts.length - 1].charAt(0)

    ).toUpperCase();

  }


  // ====================================================
  // 5. MESSAGE HANDLING
  // ====================================================

  function showMessage(message, type = "success") {

    if (!elements.profileMessage) {
      return;
    }

    elements.profileMessage.textContent = message;

    elements.profileMessage.className =
      `profile-message ${type}`;

    elements.profileMessage.hidden = false;

  }


  function hideMessage() {

    if (!elements.profileMessage) {
      return;
    }

    elements.profileMessage.textContent = "";

    elements.profileMessage.hidden = true;

    elements.profileMessage.className = "profile-message";

  }


  // ====================================================
  // 6. AVATAR HANDLING
  // ====================================================

  function updateAvatar(element, name, avatarUrl = null) {

    if (!element) {
      return;
    }

    const initials = getInitials(name);

    if (element.id === "avatarInitials") {
      element.textContent = initials;
      element.hidden = !!avatarUrl;
      const photo = element.closest("#accountAvatar")?.querySelector(".avatar-photo");
      if (photo) {
        photo.hidden = !avatarUrl;
        if (avatarUrl) photo.src = avatarUrl;
        else photo.removeAttribute("src");
      }
      return;
    }

    // Reset previous image.

    element.style.backgroundImage = "";

    element.style.backgroundSize = "";

    element.style.backgroundPosition = "";

    element.style.backgroundRepeat = "";


    if (avatarUrl) {

      try {

        const imageUrl = new URL(
          avatarUrl,
          window.location.origin
        );

        if (
          imageUrl.protocol === "https:" ||
          imageUrl.protocol === "http:"
        ) {

          element.style.backgroundImage =
            `url("${imageUrl.href.replace(/["\\]/g, "")}")`;

          element.style.backgroundSize = "cover";

          element.style.backgroundPosition = "center";

          element.style.backgroundRepeat = "no-repeat";

          element.textContent = "";

          return;

        }

      } catch (error) {

        console.warn(
          "HAFHASS Profile: Invalid avatar URL.",
          error
        );

      }

    }

    element.textContent = initials;

  }


  // ====================================================
  // 7. EDITING STATE
  // ====================================================

  function setEditingState(editing) {

    isEditing = editing;


    // Editable fields.

    if (elements.fullName) {
      elements.fullName.readOnly = !editing;
    }

    if (elements.phone) {
      elements.phone.readOnly = !editing;
    }


    // Email always remains locked.

    if (elements.email) {
      elements.email.readOnly = true;
    }


    // Button visibility.

    if (elements.editButton) {
      elements.editButton.hidden = editing;
    }

    if (elements.editActions) {
      elements.editActions.hidden = !editing;
    }


    // Button availability.

    if (elements.editButton) {

      elements.editButton.disabled =
        !profileLoaded || isSaving;

    }

    if (elements.resetButton) {
      elements.resetButton.disabled = isSaving;
    }

    if (elements.saveButton) {

      elements.saveButton.disabled =
        !profileLoaded || isSaving;

      const label = elements.saveButton.querySelector("span");

      if (label) {

        label.textContent =
          isSaving ? "Saving..." : "Save Changes";

      }

    }


    // Form visual state.

    if (elements.profileForm) {

      elements.profileForm.classList.toggle(
        "is-editing",
        editing
      );

    }

  }


  // ====================================================
  // 8. DATE FORMATTING
  // ====================================================

  function formatDate(dateValue) {

    if (!dateValue) {
      return "—";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-NG", {

      day: "numeric",

      month: "long",

      year: "numeric"

    });

  }


  // ====================================================
  // 9. UPDATE PROFILE DISPLAY
  // ====================================================

  function updateProfileDisplay(profile) {

    const fullName =
      profile.full_name || "Customer";

    const email =
      profile.email ||
      currentUser.email ||
      "No email available";

    const initials = getInitials(fullName);


    // MAIN PROFILE IDENTITY.

    if (elements.displayName) {
      elements.displayName.textContent = fullName;
    }

    if (elements.displayEmail) {
      elements.displayEmail.textContent = email;
    }


    // PROFILE AVATAR.

    updateAvatar(
      elements.profileAvatar,
      fullName,
      profile.avatar_url
    );


    // SIDEBAR IDENTITY.

    if (elements.sidebarName) {
      elements.sidebarName.textContent = fullName;
    }

    if (elements.sidebarEmail) {
      elements.sidebarEmail.textContent = email;
    }


    // SIDEBAR AVATAR.

    updateAvatar(
      elements.sidebarAvatar,
      fullName,
      profile.avatar_url
    );


    // ROLE BADGE.

    if (elements.roleBadge) {

      elements.roleBadge.textContent =

        (profile.role || "customer")
          .replace(/_/g, " ")
          .toUpperCase();

    }


    // ACCOUNT STATUS.

    if (elements.accountStatus) {

      elements.accountStatus.textContent =

        profile.is_active === false
          ? "Inactive"
          : "Active";

    }


    // MEMBERSHIP DATE.

    if (elements.createdAt) {

      elements.createdAt.textContent =
        formatDate(profile.created_at);

    }


    // FORM FIELDS.

    if (elements.fullName) {
      elements.fullName.value = profile.full_name || "";
    }

    if (elements.email) {
      elements.email.value = email;
    }

    if (elements.phone) {
      elements.phone.value = profile.phone || "";
    }

  }


  // ====================================================
  // 10. LOAD CUSTOMER PROFILE
  // ====================================================

  async function loadProfile() {

    hideMessage();

    if (elements.editButton) {
      elements.editButton.disabled = true;
    }

    if (elements.fullName) {
      elements.fullName.readOnly = true;
    }

    if (elements.phone) {
      elements.phone.readOnly = true;
    }

    if (elements.email) {
      elements.email.readOnly = true;
    }


    try {

      const {

        data,

        error

      } = await supabase

        .from("profiles")

        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          avatar_url,
          is_active,
          created_at
        `)

        .eq("id", currentUser.id)

        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {

        showMessage(

          "Your profile information could not be found. Please contact customer support.",

          "error"

        );

        return false;

      }


      originalProfile = {

        full_name: data.full_name || "",

        email:
          data.email ||
          currentUser.email ||
          "",

        phone: data.phone || ""

      };


      updateProfileDisplay(data);


      profileLoaded = true;


      // START IN READ-ONLY MODE.

      setEditingState(false);


      return true;


    } catch (error) {

      console.error(

        "HAFHASS Profile: Profile loading failed.",

        {

          message: error?.message,

          code: error?.code,

          details: error?.details,

          hint: error?.hint

        }

      );


      showMessage(

        "Unable to load your profile. Please refresh the page and try again.",

        "error"

      );


      return false;

    }

  }


  // ====================================================
  // 11. START EDITING
  // ====================================================

  function startEditing() {

    if (!profileLoaded || isSaving) {
      return;
    }


    hideMessage();


    // RESTORE SAVED VALUES BEFORE EDITING.

    elements.fullName.value =
      originalProfile.full_name;

    elements.email.value =
      originalProfile.email;

    elements.phone.value =
      originalProfile.phone;


    setEditingState(true);


    // FOCUS FULL NAME.

    elements.fullName.focus();

  }


  // ====================================================
  // 12. CANCEL EDITING
  // ====================================================

  function cancelEditing() {

    if (!originalProfile || isSaving) {
      return;
    }


    // RESTORE ORIGINAL VALUES.

    elements.fullName.value =
      originalProfile.full_name;

    elements.email.value =
      originalProfile.email;

    elements.phone.value =
      originalProfile.phone;


    hideMessage();


    // RETURN TO READ-ONLY MODE.

    setEditingState(false);

  }


  // ====================================================
  // 13. SAVE PROFILE
  // ====================================================

  async function saveProfile(event) {

    event.preventDefault();


    if (!isEditing || isSaving || !profileLoaded) {
      return;
    }


    hideMessage();


    const fullName =
      elements.fullName.value.trim();

    const phone =
      elements.phone.value.trim();


    // FULL NAME VALIDATION.

    if (!fullName) {

      showMessage(

        "Please enter your full name.",

        "error"

      );

      elements.fullName.focus();

      return;

    }


    if (fullName.length < 2) {

      showMessage(

        "Your name must contain at least 2 characters.",

        "error"

      );

      elements.fullName.focus();

      return;

    }


    // CHECK WHETHER ANYTHING CHANGED.

    if (

      fullName === originalProfile.full_name &&

      phone === originalProfile.phone

    ) {

      showMessage(

        "No changes were made to your profile.",

        "success"

      );

      setEditingState(false);

      return;

    }


    isSaving = true;

    setEditingState(true);


    try {

      const {

        data,

        error

      } = await supabase

        .from("profiles")

        .update({

          full_name: fullName,

          phone: phone || null,

          updated_at: new Date().toISOString()

        })

        .eq("id", currentUser.id)

        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          avatar_url,
          is_active,
          created_at
        `)

        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {

        throw new Error(

          "Profile update returned no data. Please check your account permissions."

        );

      }


      // UPDATE ORIGINAL PROFILE.

      originalProfile = {

        full_name: data.full_name || "",

        email:
          data.email ||
          currentUser.email ||
          "",

        phone: data.phone || ""

      };


      // REFRESH PROFILE INFORMATION.

      updateProfileDisplay(data);


      showMessage(

        "Your profile has been updated successfully!",

        "success"

      );


      // LOCK FIELDS AFTER SUCCESSFUL UPDATE.

      setEditingState(false);


    } catch (error) {

      console.error(

        "HAFHASS Profile: Profile update failed.",

        {

          message: error?.message,

          code: error?.code,

          details: error?.details,

          hint: error?.hint,

          fullError: error

        }

      );


      const errorMessage = [

        error?.message,

        error?.details,

        error?.hint

      ]

        .filter(Boolean)

        .join(" | ");


      showMessage(

        errorMessage ||

        "Unable to update your profile. Please try again.",

        "error"

      );

    } finally {

      isSaving = false;


      // PRESERVE EDITING MODE IF SAVING FAILED.

      if (isEditing) {

        setEditingState(true);

      } else {

        setEditingState(false);

      }

    }

  }


  // ====================================================
  // 14. GET AUTHENTICATED CUSTOMER
  // ====================================================

  async function getCurrentCustomer(access) {

    // REUSE THE USER RETURNED BY THE GUARD.

    if (access?.user?.id) {

      return access.user;

    }


    // CHECK THE AUTHENTICATED SESSION.

    if (typeof auth.getSession === "function") {

      const sessionResult = await auth.getSession();

      if (sessionResult?.success === true) {

        if (sessionResult.session?.user?.id) {

          return sessionResult.session.user;

        }

      }

    }


    // FALLBACK TO AUTH HELPER.

    const userResult = await auth.getCurrentUser();

    if (
      userResult?.success === true &&
      userResult.user?.id
    ) {

      return userResult.user;

    }


    return null;

  }


  // ====================================================
  // 15. INITIALIZE PAGE
  // ====================================================

  async function initializeProfilePage() {

    try {

      // ------------------------------------------------
      // PROTECT CUSTOMER ACCOUNT PAGE
      // ------------------------------------------------

      const access =

        await guards.protectCustomerPage({

          loginPage: "../login.html"

        });


      if (
        !access ||
        access.authorized !== true
      ) {

        return;

      }


      // ------------------------------------------------
      // GET AUTHENTICATED CUSTOMER
      // ------------------------------------------------

      currentUser = await getCurrentCustomer(access);


      if (!currentUser?.id) {

        window.location.replace("../login.html");

        return;

      }


      // ------------------------------------------------
      // LOAD CUSTOMER PROFILE
      // ------------------------------------------------

      const loaded = await loadProfile();


      if (!loaded) {

        console.warn(

          "HAFHASS Profile: Profile initialization incomplete."

        );

      }


      // ------------------------------------------------
      // EDIT BUTTON
      // ------------------------------------------------

      if (elements.editButton) {

        elements.editButton.addEventListener(

          "click",

          startEditing

        );

      }


      // ------------------------------------------------
      // CANCEL BUTTON
      // ------------------------------------------------

      if (elements.resetButton) {

        elements.resetButton.addEventListener(

          "click",

          cancelEditing

        );

      }


      // ------------------------------------------------
      // FORM SUBMISSION
      // ------------------------------------------------

      if (elements.profileForm) {

        elements.profileForm.addEventListener(

          "submit",

          saveProfile

        );

      }


      // ------------------------------------------------
      // FOOTER YEAR
      // ------------------------------------------------

      if (elements.accountYear) {

        elements.accountYear.textContent =

          new Date().getFullYear();

      }


    } catch (error) {

      console.error(

        "HAFHASS Profile: Initialization failed.",

        error

      );


      showMessage(

        "Something went wrong while opening your profile.",

        "error"

      );

    }

  }


  // ====================================================
  // 16. DOM READY
  // ====================================================

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      initializeProfilePage,

      { once: true }

    );

  } else {

    initializeProfilePage();

  }


})();