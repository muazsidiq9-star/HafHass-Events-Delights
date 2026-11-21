/* =========================================================
   HAFHASS ADMINISTRATOR PROFILE
========================================================= */
(() => {
  "use strict";

  const supabase = window.hafhassSupabase;
  const media = window.HafhassMedia;
  const form = document.getElementById("adminProfileForm");
  if (!supabase || !media || !form) return;

  const el = {
    name: document.getElementById("adminProfileName"),
    email: document.getElementById("adminProfileEmail"),
    phone: document.getElementById("adminProfilePhone"),
    save: document.getElementById("adminProfileSave"),
    message: document.getElementById("adminProfileMessage"),
    avatar: document.getElementById("adminProfileAvatar"),
    sidebarAvatar: document.getElementById("adminAvatar"),
    file: document.getElementById("adminAvatarFile"),
    choose: document.getElementById("adminChooseAvatar"),
    remove: document.getElementById("adminRemoveAvatar"),
    avatarMessage: document.getElementById("adminAvatarMessage")
  };

  let user = null;
  let profile = null;
  let avatarUrl = null;
  let busy = false;

  function notify(target, text, type = "info") {
    if (!target) return;
    target.textContent = text;
    target.dataset.type = type;
    target.hidden = !text;
  }

  function initials(name) {
    return (name || "Administrator").trim().split(/\s+/).slice(0, 2)
      .map(part => part.charAt(0).toUpperCase()).join("") || "A";
  }

  function setAvatar(url, name) {
    avatarUrl = url || null;
    [el.avatar, el.sidebarAvatar].filter(Boolean).forEach(node => {
      node.style.backgroundImage = url ? `url("${url.replace(/["\\\\]/g, "")}")` : "";
      node.style.backgroundSize = url ? "cover" : "";
      node.style.backgroundPosition = url ? "center" : "";
      node.style.backgroundRepeat = url ? "no-repeat" : "";
      node.textContent = url ? "" : initials(name);
    });
    if (el.remove) el.remove.hidden = !url;
  }

  function ownedAvatarPath(url) {
    if (!url || !user) return null;
    try {
      const parsed = new URL(url);
      const marker = "/storage/v1/object/public/avatars/";
      const index = parsed.pathname.indexOf(marker);
      if (index < 0) return null;
      const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
      return path.startsWith(user.id + "/") ? path : null;
    } catch (_) {
      return null;
    }
  }

  async function loadProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error("Your admin session has expired. Please sign in again.");
    user = authData.user;

    const { data, error } = await supabase.from("profiles")
      .select("id,full_name,email,phone,role,avatar_url,is_active")
      .eq("id", user.id).maybeSingle();
    if (error) throw error;
    if (!data || data.role !== "admin" || data.is_active !== true) {
      throw new Error("This page is available to active administrators only.");
    }

    profile = data;
    el.name.value = data.full_name || "";
    el.email.value = data.email || user.email || "";
    el.phone.value = data.phone || "";
    setAvatar(data.avatar_url, data.full_name);
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (busy) return;
    const fullName = el.name.value.trim();
    const phone = el.phone.value.trim();
    if (!fullName) {
      notify(el.message, "Please enter your full name.", "error");
      el.name.focus();
      return;
    }

    busy = true;
    el.save.disabled = true;
    notify(el.message, "Saving your profile…");
    try {
      const { data, error } = await supabase.from("profiles")
        .update({ full_name: fullName, phone: phone || null, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .eq("role", "admin")
        .select("id,full_name,email,phone,role,avatar_url,is_active")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("No profile was updated. Please refresh and try again.");
      profile = data;
      setAvatar(data.avatar_url, data.full_name);
      if (window.HafhassAdmin?.profile) {
        window.HafhassAdmin.profile.full_name = data.full_name;
        window.HafhassAdmin.profile.phone = data.phone;
      }
      const sidebarName = document.getElementById("adminSidebarName");
      const headerName = document.getElementById("adminHeaderName");
      if (sidebarName) sidebarName.textContent = data.full_name;
      if (headerName) headerName.textContent = data.full_name;
      notify(el.message, "Your administrator profile has been updated.", "success");
    } catch (error) {
      console.error("Admin profile update failed:", error);
      notify(el.message, error.message || "Unable to save your profile.", "error");
    } finally {
      busy = false;
      el.save.disabled = false;
    }
  }

  async function uploadAvatar(file) {
    if (busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify(el.avatarMessage, "Choose a JPG, PNG or WebP image.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify(el.avatarMessage, "Your profile photo must not exceed 5 MB.", "error");
      return;
    }

    busy = true;
    el.choose.disabled = true;
    if (el.remove) el.remove.disabled = true;
    notify(el.avatarMessage, "Optimising and uploading your photo…");
    let uploadedPath = null;
    try {
      const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${user.id}/avatar/${crypto.randomUUID()}.${ext}`;
      const result = await media.upload({ bucket: "avatars", path, file, purpose: "avatar", publicUrl: true });
      uploadedPath = result.path;
      if (!result.publicUrl) throw new Error("The uploaded photo URL could not be created.");

      const { data, error } = await supabase.from("profiles")
        .update({ avatar_url: result.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id).eq("role", "admin")
        .select("avatar_url").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your new profile photo could not be saved.");

      const oldPath = ownedAvatarPath(avatarUrl);
      setAvatar(data.avatar_url, el.name.value);
      if (oldPath && oldPath !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([oldPath]);
        if (cleanupError) console.warn("Previous admin avatar cleanup failed:", cleanupError);
      }
      notify(el.avatarMessage, "Your profile photo has been updated.", "success");
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]).catch(() => {});
      console.error("Admin avatar upload failed:", error);
      notify(el.avatarMessage, error.message || "Unable to upload your photo.", "error");
    } finally {
      busy = false;
      el.choose.disabled = false;
      if (el.remove) el.remove.disabled = false;
      el.file.value = "";
    }
  }

  async function removeAvatar() {
    if (busy || !avatarUrl || !confirm("Remove your current administrator photo?")) return;
    busy = true;
    el.choose.disabled = true;
    el.remove.disabled = true;
    notify(el.avatarMessage, "Removing your profile photo…");
    try {
      const oldPath = ownedAvatarPath(avatarUrl);
      const { data, error } = await supabase.from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id).eq("role", "admin")
        .select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile photo could not be removed.");
      setAvatar(null, el.name.value);
      notify(el.avatarMessage, "Your profile photo has been removed.", "success");
      if (oldPath) {
        const { error: cleanupError } = await supabase.storage.from("avatars").remove([oldPath]);
        if (cleanupError) console.warn("Admin avatar cleanup failed:", cleanupError);
      }
    } catch (error) {
      console.error("Admin avatar removal failed:", error);
      notify(el.avatarMessage, error.message || "Unable to remove your photo.", "error");
    } finally {
      busy = false;
      el.choose.disabled = false;
      el.remove.disabled = false;
    }
  }

  form.addEventListener("submit", saveProfile);
  el.choose?.addEventListener("click", () => el.file?.click());
  el.file?.addEventListener("change", () => {
    const file = el.file.files?.[0];
    if (file) uploadAvatar(file);
  });
  el.remove?.addEventListener("click", removeAvatar);

  document.addEventListener("DOMContentLoaded", () => {
    loadProfile().catch(error => {
      console.error("Admin profile loading failed:", error);
      notify(el.message, error.message || "Unable to load your administrator profile.", "error");
    });
  });
})();
