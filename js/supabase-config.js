// ======================================================
// HAFHASS EVENTS & DELIGHTS
// SUPABASE CONFIGURATION
// ======================================================

(() => {
  "use strict";

  const SUPABASE_URL =
    "https://gbsvwizlplzoantvkese.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_yHdL5nkd7XsxB25keRvuyQ_CUxINS4W";

  // Prevent duplicate initialization
  if (window.hafhassSupabase) {
    return;
  }

  // Check Supabase SDK availability
  if (!window.supabase || !window.supabase.createClient) {
    console.error(
      "HAFHASS: Supabase SDK could not be loaded."
    );
    return;
  }

  // Initialize Supabase
  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: "hafhass-auth-v1"
      }
    }
  );

  // Make the client available throughout the website
  window.hafhassSupabase = client;

  console.log(
    "HAFHASS: Supabase connected successfully."
  );

})();