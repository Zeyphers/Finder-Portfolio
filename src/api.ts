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

export const getImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) {
    return getApiUrl(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  }
  return url;
};
