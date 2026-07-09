import React, { useEffect, useState, useRef } from 'react';
import { VolumeX } from 'lucide-react';
import { BootConfig } from '../types';

interface BootAnimationProps {
  config: BootConfig;
  onComplete: () => void;
}

export default function BootAnimation({ config, onComplete }: BootAnimationProps) {
  const [progress, setProgress] = useState(0);
  // When a custom logo URL is set we wait for it to load before revealing the
  // progress bar, so the logo never pops in *after* the bar. The built-in SVG
  // renders instantly, so it's ready from the start.
  const [logoReady, setLogoReady] = useState(!config.appleLogoUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPlayedRef = useRef(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Finish the boot (normally or via skip) and remember that this visitor has
  // seen it, so return visits get a much shorter boot.
  const finish = React.useCallback(() => {
    try { localStorage.setItem("boot_seen_v1", "1"); } catch {}
    onCompleteRef.current();
  }, []);

  // Preload the custom logo and reveal the bar once it's ready. A safety timeout
  // ensures a slow or broken logo URL never blocks the boot sequence.
  useEffect(() => {
    if (!config.appleLogoUrl) {
      setLogoReady(true);
      return;
    }
    setLogoReady(false);
    const img = new Image();
    img.onload = () => setLogoReady(true);
    img.onerror = () => setLogoReady(true);
    img.src = config.appleLogoUrl;
    const safety = setTimeout(() => setLogoReady(true), 1500);
    return () => clearTimeout(safety);
  }, [config.appleLogoUrl]);

  useEffect(() => {
    // Hold the progress animation until the logo is ready so the bar starts
    // filling from 0 at the exact moment everything is revealed together —
    // otherwise a first-time visitor sees the bar already partway when it fades in.
    if (!logoReady) return;

    // Prepare audio
    if (config.audioUrl) {
      audioRef.current = new Audio(config.audioUrl);
      audioRef.current.volume = 0.5;
    }

    let isRunning = true;
    // Returning visitors have seen the full boot before — cap it so they reach
    // the content quickly while keeping the effect.
    let seenBefore = false;
    try { seenBefore = localStorage.getItem("boot_seen_v1") === "1"; } catch {}
    const configured = Math.max(100, config.durationMs || 5000);
    const totalDuration = seenBefore ? Math.min(configured, 1500) : configured;
    const startTime = Date.now();
    let currentProgress = 0;
    
    const updateProgress = () => {
      if (!isRunning) return;
      
      const elapsed = Date.now() - startTime;
      currentProgress = Math.min(100, (elapsed / totalDuration) * 100);
      setProgress(currentProgress);

      // Play audio slightly before finish (e.g., at 95% or a few ms before end)
      if (currentProgress > 95 && !audioPlayedRef.current) {
        audioPlayedRef.current = true;
        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.play().catch(e => console.warn("Audio autoplay blocked", e));
          
          let vol = 0;
          const fadeTimer = setInterval(() => {
            if (vol >= 0.5) {
              clearInterval(fadeTimer);
              if (audioRef.current) audioRef.current.volume = 0.5;
            } else {
              vol += 0.1;
              if (audioRef.current) audioRef.current.volume = vol;
            }
          }, 10);
        }
      }
      
      if (currentProgress < 100) {
        // Random delay scaled by total duration to keep the stopping/starting effect
        const maxDelay = totalDuration / 10;
        const delay = Math.random() < 0.3 ? maxDelay : maxDelay / 4;
        timeoutIdRef.current = setTimeout(updateProgress, delay);
      } else {
        timeoutIdRef.current = setTimeout(() => {
          if (!isRunning) return;
          finish();
        }, 100);
      }
    };
    
    timeoutIdRef.current = setTimeout(updateProgress, Math.min(300, totalDuration / 10));

    return () => {
      isRunning = false;
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [config.audioUrl, config.durationMs, logoReady]);

  const [hasInteracted, setHasInteracted] = useState(false);

  const handleInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Unlock audio for mobile browsers by playing and pausing immediately
      if (audioRef.current && !audioPlayedRef.current) {
        audioRef.current.play().then(() => {
          if (!audioPlayedRef.current) {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
          }
        }).catch(() => {});
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center select-none"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {!hasInteracted && config.audioUrl && (
        <div className={`absolute top-8 left-1/2 -translate-x-1/2 w-max max-w-[90vw] text-xl text-gray-500 flex flex-wrap items-center justify-center gap-2 sm:gap-4 animate-pulse cursor-pointer z-10 transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'}`}>
          <VolumeX size={24} className="shrink-0" />
          <span className="text-center">Tap anywhere to unmute</span>
        </div>
      )}
      <div className="flex flex-col items-center justify-center w-full max-w-sm mt-[-10vh]">
        {/* Apple Logo SVG or Custom Logo (fixed-size box so there's no layout shift) */}
        {config.appleLogoUrl ? (
          <img
            src={config.appleLogoUrl}
            alt="Boot Logo"
            onLoad={() => setLogoReady(true)}
            onError={() => setLogoReady(true)}
            className={`w-24 h-24 sm:w-32 sm:h-32 mb-16 object-contain transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'} ${config.invertAppleLogo ? 'invert' : ''}`}
          />
        ) : (
          <svg className="w-24 h-24 sm:w-32 sm:h-32 text-white mb-16" viewBox="0 0 384 512" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8 273.7 0 318.5 13.3 408 55.4 466.8 75.4 494.7 99.3 512 127 512c26.5 0 38.6-16.7 70.8-16.7 32 0 42.9 16.7 71 16.7 27.6 0 50.8-16.8 70.2-44.6 23.3-33 34-66.2 34.6-67.6-1.5-.7-54.6-20.9-54.9-130.5M211.3 103.5c19.3-23.7 31.9-55.8 28.5-88-26.3 1-59 16.6-79.3 40.8-17.8 21.2-32 54.7-27.8 86.4 29.5 2.2 61-14.8 78.6-39.2z"/>
          </svg>
        )}

        {/* Progress Bar — held hidden until the logo is ready so it never appears first */}
        <div className={`w-56 h-[5px] bg-[#333333] rounded-full overflow-hidden transition-opacity duration-300 ${logoReady ? 'opacity-100' : 'opacity-0'}`}>
          <div
            className="h-full bg-white rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

