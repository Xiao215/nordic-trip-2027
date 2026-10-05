// Public settings for the page. These ship to every visitor, so no secrets here.
window.TRIP_CONFIG = {
  // Chat backend: your machine's Tailscale Funnel URL (printed by ./start.sh). Port 10000 because
  // 443 is taken by another app and 8443 by the Algonquin planner.
  // For local testing, open the page with ?api=http://localhost:8791 (only localhost overrides are accepted).
  apiBase: "https://xiaos-macbook-pro.tail3d8516.ts.net:10000",

  // Google Maps JavaScript API key, restricted to your GitHub Pages site (see README).
  // Empty = Google's basic embedded map, one place or one drive at a time.
  googleMapsKey: "",
  // Optional Map ID from Google Cloud (Map Management). Empty uses Google's demo map style.
  googleMapId: ""
};
