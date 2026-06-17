import React, { useState, useEffect } from "react";

// Global cache to keep track of already loaded images
const loadedImages = new Set<string>();

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
  const [loaded, setLoaded] = useState(() => src ? loadedImages.has(src) : false);

  useEffect(() => {
    if (!src) return;
    if (loadedImages.has(src)) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  const handleLoad = () => {
    if (src) loadedImages.add(src);
    setLoaded(true);
  };

  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={`relative overflow-hidden ${containerClassName || className || ""}`}>
      {/* Loading Placeholder */}
      {!loaded && (
        <div className={`absolute inset-0 bg-slate-200 dark:bg-slate-700/50 animate-pulse rounded-[inherit]`} />
      )}
      
      {/* High Quality Image */}
      <img
        src={src}
        alt={alt}
        className={`${className || ""} transition-opacity duration-300 ${fitClass} ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={handleLoad}
        {...props}
      />
    </div>
  );
};
