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

  // Generate a low-quality placeholder URL using wsrv.nl
  // This loads super quick, then we fade in the high-res image
  const lqipSrc = src?.startsWith("http") 
    ? `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=30&blur=5&q=20` 
    : undefined;

  // We need to manage object-fit classes appropriately
  const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={`relative overflow-hidden ${containerClassName || className || ""}`}>
      {/* Low Quality Image Placeholder (LQIP) */}
      {!loaded && lqipSrc && (
        <img 
          src={lqipSrc} 
          alt={alt} 
          className={`absolute inset-0 w-full h-full ${fitClass} scale-110 filter blur-md transition-opacity duration-300 pointer-events-none rounded-[inherit]`}
          {...props}
        />
      )}
      {!loaded && !lqipSrc && (
        <div className={`absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-[inherit]`} />
      )}
      
      {/* High Quality Image */}
      <img
        src={src}
        alt={alt}
        className={`${className || ""} transition-opacity duration-700 w-full h-full ${fitClass} ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        {...props}
      />
    </div>
  );
};
