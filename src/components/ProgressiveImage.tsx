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
  // If loading `src` fails (e.g. an Image-CDN thumbnail the transformer can't
  // handle), retry with this URL instead — keeps existing data rendering exactly
  // as it did before thumbnails were introduced.
  fallbackSrc?: string;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className,
  containerClassName,
  objectFit = "cover",
  fallbackSrc,
  ...props
}) => {
  // The URL that actually finished loading (src, or fallbackSrc after a failure).
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc !== null;
  const [avg, setAvg] = useState<string | undefined>(() => (src ? imageAvgColors[src] : undefined));

  // Load the image OFF-SCREEN and only reveal the visible <img> once it is fully
  // downloaded AND decoded (via img.decode()). This guarantees the browser never shows
  // a partial top-to-bottom paint — the placeholder holds until the image is ready,
  // then it appears in one frame. (We don't trust a "seen this session" flag because the
  // browser can evict large images, which would re-download and paint progressively.)
  useEffect(() => {
    if (!src) { setLoadedSrc(null); return; }
    setLoadedSrc(null);
    if (imageAvgColors[src]) setAvg(imageAvgColors[src]);

    let cancelled = false;

    const attempt = (url: string, isLastResort: boolean) => {
      const finish = (el: HTMLImageElement) => {
        if (cancelled) return;
        loadedImagesCache.add(url);
        const c = computeAvgColor(el, url);
        if (c) setAvg(c);
        setLoadedSrc(url);
      };
      const fail = () => {
        if (cancelled) return;
        if (!isLastResort && fallbackSrc && fallbackSrc !== url) {
          attempt(fallbackSrc, true);
        } else {
          // Give up and mount the <img> anyway so its native error state shows.
          setLoadedSrc(url);
        }
      };

      const loader = new Image();
      loader.src = url;
      if (typeof loader.decode === "function") {
        loader.decode()
          .then(() => finish(loader))
          .catch(() => {
            // decode() can reject on some sources; fall back to load events
            if (loader.complete && loader.naturalWidth) finish(loader);
            else {
              loader.onload = () => finish(loader);
              loader.onerror = fail;
            }
          });
      } else {
        loader.onload = () => finish(loader);
        loader.onerror = fail;
      }
    };

    attempt(src, !fallbackSrc);
    return () => { cancelled = true; };
  }, [src, fallbackSrc]);

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
  // Don't paint a solid colour box behind transparent "contain" icons.
  const showColor = objectFit !== "contain";

  return (
    <div className={`relative overflow-hidden ${containerClassName || className || ""}`}>
      {/* Average-colour placeholder, shown until the full image is ready. The slow
          brightness pulse signals "still loading" so an unresponsive tile doesn't
          read as broken. */}
      {!loaded && (
        <div
          className={`absolute inset-0 rounded-[inherit] ${showColor ? "animate-img-loading" : ""} ${avg && showColor ? "" : (showColor ? "bg-slate-300/40 dark:bg-slate-600/40" : "")}`}
          style={avg && showColor ? { backgroundColor: avg } : undefined}
        />
      )}

      {/* Full image: only mounted once fully decoded, so it swaps in a single frame */}
      {loaded && loadedSrc && (
        <img
          src={loadedSrc}
          alt={alt}
          decoding="sync"
          className={`${className || ""} relative z-10 ${fitClass}`}
          {...props}
        />
      )}
    </div>
  );
};
