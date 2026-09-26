import React, { useEffect, useRef, useState } from "react";
import { computeAvgColor, imageAvgColors } from "./ProgressiveImage";

interface PreviewClipProps {
  src: string;
  className?: string;
  containerClassName?: string;
}

// Muted, looping preview for a video tile — the stand-in for the old animated
// GIF previews: the same few seconds of footage at a fraction of the bytes.
// Mirrors ProgressiveImage: an average-colour placeholder holds until the first
// frame is ready, then the clip appears in one step.
export const PreviewClip: React.FC<PreviewClipProps> = ({ src, className = "", containerClassName = "" }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const avg = imageAvgColors[src];

  useEffect(() => {
    setReady(false);
    const el = ref.current;
    if (!el) return;
    // React sets `muted` as a property, not an attribute, which some browsers
    // (iOS Safari) don't count toward the muted-autoplay allowance. Setting it
    // here and starting playback explicitly makes autoplay dependable.
    el.muted = true;
    // The effect owns the source (it isn't a JSX prop) so that set-up and
    // tear-down always pair up — including StrictMode's mount/unmount/mount.
    el.src = src;
    el.play().catch(() => {});
    // Chrome pauses muted autoplay in a hidden page (a background tab) and, once
    // play() has been called from script, doesn't restart it on return — resume
    // explicitly so the previews aren't frozen when the visitor comes back.
    const resume = () => {
      if (document.visibilityState === "visible" && el.paused) el.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      // Removing a <video> doesn't stop its download; dropping the source does.
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {!ready && (
        <div
          className={`absolute inset-0 rounded-[inherit] animate-img-loading ${avg ? "" : "bg-slate-300/40 dark:bg-slate-600/40"}`}
          style={avg ? { backgroundColor: avg } : undefined}
        />
      )}
      {/* Keyed on src so a new clip gets a fresh element — the effect cleanup
          above then always tears down the old one, never the new source. */}
      <video
        key={src}
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onLoadedData={e => {
          computeAvgColor(e.currentTarget, src);
          setReady(true);
        }}
        className={`${className} relative z-10 object-cover pointer-events-none ${ready ? "" : "opacity-0"}`}
      />
    </div>
  );
};
