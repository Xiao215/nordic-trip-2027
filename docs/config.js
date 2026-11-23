// Public settings for the page. These ship to every visitor, so no secrets here.
window.TRIP_CONFIG = {
  // Backend (chat, expense log, drivers, options board): the Raspberry Pi, published at /nordic on its
  // Tailscale Funnel (see "Run the backend" in the README).
  // For local testing, open the page with ?api=http://localhost:8791 (only localhost overrides are accepted).
  apiBase: "https://pi.tail3d8516.ts.net/nordic",

  // Google Maps JavaScript API key, restricted to your GitHub Pages site (see README).
  // Empty = Google's basic embedded map, one place or one drive at a time.
  googleMapsKey: "",
  // Optional Map ID from Google Cloud (Map Management). Empty uses Google's demo map style.
  googleMapId: ""
};
