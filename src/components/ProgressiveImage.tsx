import React, { useState, useEffect } from "react";

// Global cache of image srcs that have fully loaded this session.
export const loadedImagesCache = new Set<string>();

// Per-image average colour, used as a solid placeholder until the full image is ready.
// Persisted to localStorage so on return visits the colour is known instantly (it's tiny),
// even while a large image is still downloading.
const AVG_KEY = "img_avg_colors_v1";
export const imageAvgColors: Record<string, string> = (() => {
  try { return JSON.parse(localStorage.getItem(AVG_KEY) || "{}"); } catch { return {}; }
})();

let avgSaveTimer: ReturnType<typeof setTimeout> | null = null;
const persistAvgColors = () => {
  if (avgSaveTimer) return;
  avgSaveTimer = setTimeout(() => {
    avgSaveTimer = null;
    try { localStorage.setItem(AVG_KEY, JSON.stringify(imageAvgColors)); } catch {}
  }, 500);
};

// Downsample the image to 1x1 to get its average colour. Same-origin/proxied images are
// canvas-clean; if a source taints the canvas we just skip it (placeholder stays neutral).
export const computeAvgColor = (imgEl: HTMLImageElement, key: string): string | undefined => {
  if (imageAvgColors[key]) return imageAvgColors[key];
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(imgEl, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const color = `rgb(${r}, ${g}, ${b})`;
    imageAvgColors[key] = color;
    persistAvgColors();
    return color;
  } catch {
    return undefined;
  }
};

interface ProgressiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  objectFit?: "cover" | "contain";
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  objectFit = "cover",
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [avg, setAvg] = useState<string | undefined>(() => (src ? imageAvgColors[src] : undefined));

  // Load the image OFF-SCREEN and only reveal the visible <img> once it is fully
  // downloaded AND decoded (via img.decode()). This guarantees the browser never shows
  // a partial top-to-bottom paint — the placeholder holds until the image is ready,
  // then it appears in one frame. (We don't trust a "seen this session" flag because the
  // browser can evict large images, which would re-download and paint progressively.)
  useEffect(() => {
    if (!src) { setLoaded(false); return; }
    setLoaded(false);
    if (imageAvgColors[src]) setAvg(imageAvgColors[src]);

    let cancelled = false;
    const finish = (el: HTMLImageElement) => {
      if (cancelled) return;
      loadedImagesCache.add(src);
      const c = computeAvgColor(el, src);
      if (c) setAvg(c);
      setLoaded(true);
    };

    const loader = new Image();
    loader.src = src;
    if (typeof loader.decode === "function") {
      loader.decode()
        .then(() => finish(loader))
        .catch(() => {
          // decode() can reject on some sources; fall back to load events
          if (loader.complete && loader.naturalWidth) finish(loader);
          else {
            loader.onload = () => finish(loader);
            loader.onerror = () => { if (!cancelled) setLoaded(true); };
          }
        });
    } else {
      loader.onload = () => finish(loader);
      loader.onerror = () => { if (!cancelled) setLoaded(true); };
    }
    return () => { cancelled = true; };
  }, [src]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  // Don't paint a solid colour box behind transparent "contain" icons.
  const showColor = objectFit !== "contain";

  return (
    <div className={`relative overflow-hidden ${containerClassName || className || ""}`}>
      {/* Average-colour placeholder, shown until the full image is ready */}
      {!loaded && (
        <div
          className={`absolute inset-0 rounded-[inherit] ${avg && showColor ? "" : (showColor ? "bg-slate-300/40 dark:bg-slate-600/40" : "")}`}
          style={avg && showColor ? { backgroundColor: avg } : undefined}
        />
      )}

      {/* Full image: only mounted once fully decoded, so it swaps in a single frame */}
      {loaded && src && (
        <img
          src={src}
          alt={alt}
          decoding="sync"
          className={`${className || ""} relative z-10 ${fitClass}`}
          {...props}
        />
      )}
    </div>
  );
};
