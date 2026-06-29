import React, { useEffect, useState, useRef } from 'react';
import { VolumeX } from 'lucide-react';
import { BootConfig } from '../types';

interface BootAnimationProps {
  config: BootConfig;
  onComplete: () => void;
}

export default function BootAnimation({ config, onComplete }: BootAnimationProps) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPlayedRef = useRef(false);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Prepare audio
    if (config.audioUrl) {
      audioRef.current = new Audio(config.audioUrl);
      audioRef.current.volume = 0.5;
    }

    let isRunning = true;
    const totalDuration = Math.max(100, config.durationMs || 5000);
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
              vol += 0.05;
              if (audioRef.current) audioRef.current.volume = vol;
            }
          }, 20);
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
          onCompleteRef.current();
        }, 100);
      }
    };
    
    timeoutIdRef.current = setTimeout(updateProgress, Math.min(300, totalDuration / 10));

    return () => {
      isRunning = false;
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    };
  }, [config.audioUrl, config.durationMs]);

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
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-max max-w-[90vw] text-xl text-gray-500 flex flex-wrap items-center justify-center gap-2 sm:gap-4 animate-pulse cursor-pointer z-10">
          <VolumeX size={24} className="shrink-0" /> 
          <span className="text-center">Tap anywhere to unmute</span>
        </div>
      )}
      <div className="flex flex-col items-center justify-center w-full max-w-sm mt-[-10vh]">
        {/* Apple Logo SVG or Custom Logo */}
        {config.appleLogoUrl ? (
          <img src={config.appleLogoUrl} alt="Boot Logo" className={`w-24 h-24 sm:w-32 sm:h-32 mb-16 object-contain ${config.invertAppleLogo ? 'invert' : ''}`} />
        ) : (
          <svg className="w-24 h-24 sm:w-32 sm:h-32 text-white mb-16" viewBox="0 0 384 512" fill="currentColor">
            <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8 273.7 0 318.5 13.3 408 55.4 466.8 75.4 494.7 99.3 512 127 512c26.5 0 38.6-16.7 70.8-16.7 32 0 42.9 16.7 71 16.7 27.6 0 50.8-16.8 70.2-44.6 23.3-33 34-66.2 34.6-67.6-1.5-.7-54.6-20.9-54.9-130.5M211.3 103.5c19.3-23.7 31.9-55.8 28.5-88-26.3 1-59 16.6-79.3 40.8-17.8 21.2-32 54.7-27.8 86.4 29.5 2.2 61-14.8 78.6-39.2z"/>
          </svg>
        )}
        
        {/* Progress Bar */}
        <div className="w-56 h-[5px] bg-[#333333] rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

