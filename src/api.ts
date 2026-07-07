export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const hostname = window.location.hostname;
  
  // Local development via Vite/Express (AI Studio or local machine)
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return cleanPath;
  }
  
  // If we are on the actual Cloud Run server environment in AI Studio
  if (hostname.endsWith(".run.app")) {
    return cleanPath;
  }
  
  // When deployed to Netlify (or other arbitrary domains), route to the Netlify Serverless API
  // We rewrite standard `/api/*` to `/.netlify/functions/api/*`
  if (cleanPath.startsWith("/api/")) {
    return `/.netlify/functions/api${cleanPath.replace("/api", "")}`;
  }
  
  // Fallback for non-API routes when deployed
  return cleanPath;
};

// Reading the data set can exceed the 6 MB buffered-response limit on Netlify, so on
// Netlify we read it from the dedicated streaming function (netlify/functions/data.ts).
// Locally (Express dev server / Cloud Run) the normal /api/data route handles it.
export const getDataUrl = (): string => {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app")) {
    return "/api/data";
  }
  return "/.netlify/functions/data";
};

export const getImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) {
    return getApiUrl(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  }
  return url;
};

// Grid/thumbnail variant: on Netlify, route through the built-in Image CDN so the
// masonry grid downloads a resized WebP instead of the full-resolution original
// (the lightbox still uses getImageUrl for full quality). The source is always a
// same-site path (uploads or the image-proxy), so no remote_images allowlist is
// needed. Skipped for GIFs (to keep animation) and SVGs (no raster transform).
export const getThumbUrl = (url: string, width = 640): string => {
  const full = getImageUrl(url);
  if (!full) return full;
  const hostname = window.location.hostname;
  // The Image CDN only exists on Netlify — dev/Cloud Run serve the original.
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app")) {
    return full;
  }
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".gif") || lower.endsWith(".svg")) return full;
  return `/.netlify/images?url=${encodeURIComponent(full)}&w=${width}&q=75`;
};
