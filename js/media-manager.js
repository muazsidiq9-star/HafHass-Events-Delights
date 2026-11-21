/* =========================================================
   HAFHASS MEDIA MANAGER
   Shared browser-side image optimisation and Supabase upload.
   Load after supabase-config.js and before page controllers.
========================================================= */
(function (window, document) {
  "use strict";

  const CACHE_CONTROL = "31536000";

  const PROFILES = {
    product:   { maxWidth: 1200, maxHeight: 1200, quality: 0.82, maxBytes: 250 * 1024 },
    gallery:   { maxWidth: 1400, maxHeight: 1400, quality: 0.82, maxBytes: 300 * 1024 },
    reference: { maxWidth: 1200, maxHeight: 1200, quality: 0.80, maxBytes: 300 * 1024 },
    receipt:   { maxWidth: 1200, maxHeight: 1600, quality: 0.84, maxBytes: 350 * 1024 },
    branding:  { maxWidth: 1600, maxHeight: 1200, quality: 0.84, maxBytes: 350 * 1024 },
    avatar:    { maxWidth: 500, maxHeight: 500, quality: 0.78, maxBytes: 150 * 1024 },
    service:   { maxWidth: 1200, maxHeight: 1200, quality: 0.82, maxBytes: 250 * 1024 }
  };

  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  function getClient() {
    const client = window.hafhassSupabase;
    if (!client) throw new Error("Supabase has not been initialized.");
    return client;
  }

  function getExtension(type) {
    return type === "image/jpeg" ? "jpg" : type.split("/")[1];
  }

  async function compress(file, purpose) {
    if (!(file instanceof File)) throw new Error("Please select a valid file.");
    if (!IMAGE_TYPES.has(file.type)) {
      if (file.type === "application/pdf" && purpose === "receipt") return file;
      throw new Error("Please choose a JPG, PNG or WebP image.");
    }

    const profile = PROFILES[purpose];
    if (!profile) throw new Error("Unknown image optimisation profile: " + purpose);

    let bitmap;
    try {
      if ("createImageBitmap" in window) {
        bitmap = await createImageBitmap(file);
      } else {
        bitmap = await new Promise((resolve, reject) => {
          const image = new Image();
          const url = URL.createObjectURL(file);
          image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
          image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The selected image could not be read.")); };
          image.src = url;
        });
      }

      const scale = Math.min(1, profile.maxWidth / bitmap.width, profile.maxHeight / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: file.type === "image/png" });
      if (!context) throw new Error("Your browser cannot process this image.");
      context.drawImage(bitmap, 0, 0, width, height);

      const mime = file.type;
      let quality = profile.quality;
      let blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
      if (!blob) throw new Error("Image compression failed.");

      // Reduce quality progressively for photographic formats. PNG is kept lossless.
      while (blob.size > profile.maxBytes && mime !== "image/png" && quality > 0.52) {
        quality = Math.max(0.52, quality - 0.08);
        blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
        if (!blob) break;
      }

      // If compression would increase size, retain the original file.
      if (!blob || blob.size >= file.size) return file;

      const extension = getExtension(mime);
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      return new File([blob], baseName + "." + extension, {
        type: mime,
        lastModified: Date.now()
      });
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  async function upload(options) {
    const settings = options || {};
    const { bucket, path, file, purpose } = settings;
    if (!bucket || !path || !file || !purpose) {
      throw new Error("Media upload requires bucket, path, file and purpose.");
    }

    const processedFile = await compress(file, purpose);
    const cacheControl = settings.cacheControl || CACHE_CONTROL;
    const { data, error } = await getClient().storage.from(bucket).upload(path, processedFile, {
      cacheControl,
      upsert: false,
      contentType: processedFile.type || file.type
    });
    if (error) throw error;

    const result = {
      path: data?.path || path,
      file: processedFile,
      originalFile: file,
      cacheControl
    };

    if (settings.publicUrl) {
      const { data: publicData } = getClient().storage.from(bucket).getPublicUrl(result.path);
      result.publicUrl = publicData?.publicUrl || null;
    }

    return result;
  }

  window.HafhassMedia = Object.freeze({
    profiles: PROFILES,
    cacheControl: CACHE_CONTROL,
    compress,
    upload
  });
})(window, document);
