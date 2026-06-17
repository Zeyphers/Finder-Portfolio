import React, { useState, useEffect } from "react";

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

  useEffect(() => {
    setLoaded(false);
  }, [src]);

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
        className={`${className} transition-opacity duration-500 ${fitClass} ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        {...props}
      />
    </div>
  );
};
