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

  return (
    <div className={`relative ${containerClassName || className || ""}`}>
      {/* Loading Placeholder */}
      <div 
        className={`absolute inset-0 bg-slate-200/50 dark:bg-slate-700/50 animate-pulse rounded-[inherit] transition-opacity duration-300 ${loaded ? "opacity-0 pointer-events-none" : "opacity-100"}`} 
      />
      
      {/* High Quality Image */}
      <img
         src={src}
         alt={alt}
         className={`${className || ""} relative z-10 transition-opacity duration-300 ${fitClass} ${loaded ? "opacity-100" : "opacity-0"}`}
         onLoad={handleLoad}
         {...props}
      />
    </div>
  );
};
