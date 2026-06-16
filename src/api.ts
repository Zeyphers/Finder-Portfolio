export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const hostname = window.location.hostname;
  
  // If we are on the actual Cloud Run server environment, use native relative paths
  if (hostname.endsWith(".run.app")) {
    return cleanPath;
  }
  
  // Otherwise, fallback to the public stable Cloud Run backend URL
  const backendBase = "https://ais-pre-oxvo4usoxdkhk37betgg3n-610968370334.us-west2.run.app";
  return `${backendBase}${cleanPath}`;
};

export const getImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http")) {
    return getApiUrl(`/api/image-proxy?url=${encodeURIComponent(url)}`);
  }
  return url;
};
