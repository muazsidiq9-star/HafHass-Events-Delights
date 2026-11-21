/* =========================================================
   HAFHASS CUSTOMER AVATAR CONTROLLER
========================================================= */
(() => {
  "use strict";

  const supabase = window.hafhassSupabase;
  const media = window.HafhassMedia;
  const input = document.getElementById("profileAvatarFile");
  const chooseButton = document.getElementById("chooseAvatarButton");
  const removeButton = document.getElementById("removeAvatarButton");
  const message = document.getElementById("avatarMessage");
  const avatarElements = [
    document.getElementById("profileAvatar"),
    document.getElementById("avatarInitials")
  ].filter(Boolean);

  if (!supabase || !media || !input || !chooseButton) return;

  let user = null;
  let currentAvatarUrl = null;
  let busy = false;

  function showMessage(text, type = "info") {
    if (!message) return;
    message.textContent = text;
    message.dataset.type = type;
    message.hidden = !text;
  }

  function renderAvatar(url) {
    currentAvatarUrl = url || null;
    const sidebarInitials = document.getElementById("avatarInitials");
    const sidebarPhoto = document.querySelector("#accountAvatar .avatar-photo");

    if (sidebarPhoto) {
      sidebarPhoto.hidden = !url;
      if (url) sidebarPhoto.src = url;
      else sidebarPhoto.removeAttribute("src");
    }

    avatarElements.forEach(element => {
      if (element.id === "avatarInitials") return;
      element.style.backgroundImage = url ? `url("${url.replace(/["\\\\]/g, "")}")` : "";
      element.style.backgroundSize = url ? "cover" : "";
      element.style.backgroundPosition = url ? "center" : "";
      element.style.backgroundRepeat = url ? "no-repeat" : "";
    });

    if (sidebarInitials && !sidebarInitials.textContent.trim()) {
      sidebarInitials.textContent = "C";
    }
    if (removeButton) removeButton.hidden = !url;
  }

  function getOwnedPath(url) {
    if (!url) return null;
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

  async function load() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) throw new Error("Please sign in again to manage your profile photo.");
    user = authData.user;
    const { data, error } = await supabase.from("profiles")
      .select("avatar_url").eq("id", user.id).maybeSingle();
    if (error) throw error;
    renderAvatar(data?.avatar_url || null);
  }

  async function upload(file) {
    if (busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showMessage("Choose a JPG, PNG or WebP image.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showMessage("Your profile photo must not exceed 5 MB.", "error");
      return;
    }

    busy = true;
    chooseButton.disabled = true;
    if (removeButton) removeButton.disabled = true;
    showMessage("Optimising and uploading your profile photo…");

    let uploadedPath = null;
    try {
      const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${user.id}/avatar/${crypto.randomUUID()}.${ext}`;
      const result = await media.upload({
        bucket: "avatars",
        path,
        file,
        purpose: "avatar",
        publicUrl: true
      });
      uploadedPath = result.path;
      if (!result.publicUrl) throw new Error("The uploaded photo URL could not be created.");

      const { data, error } = await supabase.from("profiles")
        .update({ avatar_url: result.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select("avatar_url").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile photo could not be saved. Please try again.");

      const oldPath = getOwnedPath(currentAvatarUrl);
      renderAvatar(data.avatar_url);
      showMessage("Your profile photo has been updated.", "success");

      if (oldPath && oldPath !== uploadedPath) {
        const { error: deleteError } = await supabase.storage.from("avatars").remove([oldPath]);
        if (deleteError) console.warn("Old avatar cleanup failed:", deleteError);
      }
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from("avatars").remove([uploadedPath]).catch(() => {});
      }
      console.error("HAFHASS avatar upload failed:", error);
      showMessage(error.message || "Unable to update your profile photo.", "error");
    } finally {
      busy = false;
      chooseButton.disabled = false;
      if (removeButton) removeButton.disabled = false;
      input.value = "";
    }
  }

  async function removeAvatar() {
    if (busy || !currentAvatarUrl) return;
    if (!confirm("Remove your current profile photo?")) return;
    busy = true;
    chooseButton.disabled = true;
    removeButton.disabled = true;
    showMessage("Removing your profile photo…");
    try {
      const oldPath = getOwnedPath(currentAvatarUrl);
      const { data, error } = await supabase.from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Your profile photo could not be removed.");
      renderAvatar(null);
      showMessage("Your profile photo has been removed.", "success");
      if (oldPath) {
        const { error: deleteError } = await supabase.storage.from("avatars").remove([oldPath]);
        if (deleteError) console.warn("Avatar file cleanup failed:", deleteError);
      }
    } catch (error) {
      console.error("HAFHASS avatar removal failed:", error);
      showMessage(error.message || "Unable to remove your profile photo.", "error");
    } finally {
      busy = false;
      chooseButton.disabled = false;
      removeButton.disabled = false;
    }
  }

  chooseButton.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) upload(file);
  });
  removeButton?.addEventListener("click", removeAvatar);

  document.addEventListener("DOMContentLoaded", () => {
    load().catch(error => {
      console.error("HAFHASS avatar initialisation failed:", error);
      showMessage(error.message || "Unable to load your profile photo.", "error");
    });
  });
})();
