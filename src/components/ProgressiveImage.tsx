import React, { useState, useEffect } from "react";

// Global cache to keep track of already loaded images
export const loadedImagesCache = new Set<string>();

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
  const [loaded, setLoaded] = useState(() => src ? loadedImagesCache.has(src) : false);

  useEffect(() => {
    if (!src) return;
    if (loadedImagesCache.has(src)) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  const handleLoad = () => {
    if (src) loadedImagesCache.add(src);
    setLoaded(true);
  };

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  // If this image has already been seen/preloaded, render it eagerly and decode
  // it synchronously so it paints in a single frame when switching folders —
  // no placeholder flash or "half-loaded" pop-in. Only not-yet-seen images use
  // the lazy/async progressive path with a placeholder.
  const isCached = src ? loadedImagesCache.has(src) : false;

  return (
    <div className={`relative ${containerClassName || className || ""}`}>
      {/* Loading Placeholder (skipped entirely for already-cached images) */}
      {!isCached && (objectFit !== "contain" ? (
        <div
          className={`absolute inset-0 bg-slate-200/50 dark:bg-slate-700/50 animate-pulse rounded-[inherit] transition-opacity duration-300 ${loaded ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        />
      ) : (
        !loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-slate-300/30 border-t-slate-400/80 rounded-full animate-spin" />
          </div>
        )
      ))}

      {/* High Quality Image */}
      <img
         src={src}
         alt={alt}
         loading={isCached ? "eager" : "lazy"}
         decoding={isCached ? "sync" : "async"}
         className={`${className || ""} relative z-10 ${fitClass} ${isCached ? "opacity-100" : `transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}`}
         onLoad={handleLoad}
         {...props}
      />
    </div>
  );
};
