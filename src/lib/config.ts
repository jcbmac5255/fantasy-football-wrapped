// Single-league configuration for the Engine Line FFL instance.
// LEAGUE_ID here is only the FALLBACK/default — the live value is stored in
// Supabase (app_settings) and editable from the Admin page each new season.
export const LEAGUE_ID = "1253512178368004096";

export const BRAND_NAME = "Engine Line";
export const LOGO_SRC = "/engine_line_ffl_transparent.png";

// App version, shown on the Changelog page. Bump when you ship notable changes
// and add a matching entry at the top of src/views/Changelog.vue.
export const APP_VERSION = "1.1.0";

// The admin account. This email sees the Admin page and is the only
// account the admin API endpoints accept. Can be overridden server-side with
// the ADMIN_EMAIL env var (must match this for the UI + API to agree).
export const ADMIN_EMAIL = "jcbmac5255@gmail.com";
