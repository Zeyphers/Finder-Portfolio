import React, { useEffect, useState, useRef } from 'react';
import { BootConfig } from '../types';

interface BootAnimationProps {
  config: BootConfig;
  onComplete: () => void;
}

const DEFAULT_BOOT_TEXT = `Initializing system...
Loading kernel modules...
Mounting file systems...
Checking hardware components...
CPU: OK
Memory: OK
Storage: OK
Network: OK
Establishing secure connection...
Fetching user profile...
Loading assets...
Building virtual DOM...
Resolving dependencies...
Boot sequence complete.
Starting GUI...`;

export default function BootAnimation({ config, onComplete }: BootAnimationProps) {
  const [lines, setLines] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    const fullText = config.customText || DEFAULT_BOOT_TEXT;
    const allLines = fullText.split('\n');
    let currentIndex = 0;
    let isRunning = true;
    let printTimeout: ReturnType<typeof setTimeout>;
    
    // Total duration of animation
    const duration = config.durationMs || 5000;
    
    // Determine speed per line
    let baseSpeed = config.textSpeedMs || 50;
    if (allLines.length * baseSpeed > duration * 0.8) {
      baseSpeed = (duration * 0.8) / allLines.length;
    }

    const printNextLine = () => {
      if (!isRunning || currentIndex >= allLines.length) return;

      const lineToAdd = allLines[currentIndex];
      setLines(prev => [...prev, lineToAdd]);
      currentIndex++;

      // Random delay to simulate processing
      let nextSpeed = baseSpeed;
      if (Math.random() < 0.15) {
        nextSpeed += Math.random() * 400 + 100;
      }

      printTimeout = setTimeout(printNextLine, nextSpeed);
    };

    printTimeout = setTimeout(printNextLine, baseSpeed);

    const completionTimeout = setTimeout(() => {
      isRunning = false;
      clearTimeout(printTimeout);
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.warn("Audio autoplay blocked", e));
      }
      onCompleteRef.current();
    }, duration);

    return () => {
      isRunning = false;
      clearTimeout(printTimeout);
      clearTimeout(completionTimeout);
      // Intentionally not pausing the audio so it plays after the component unmounts
    };
  }, [config.durationMs, config.textSpeedMs, config.audioUrl, config.customText]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const formatLine = (line: string) => {
    if (typeof line !== 'string') return null;
    let html = line
      .replace(/\bOK\b/g, '<span class="text-green-400 font-bold">OK</span>')
      .replace(/\b(?:NO|ERROR|FAILED|FAIL)\b/g, '<span class="text-red-500 font-bold">$&</span>')
      .replace(/\b([a-z]+\.[a-z]+\.[a-zA-Z0-9.]+)\b/g, '<span class="text-blue-400">$&</span>')
      .replace(/(?:\/[a-zA-Z0-9_-]+)+/g, '<span class="text-yellow-400">$&</span>')
      .replace(/\[.*?\]/g, '<span class="text-gray-400">$&</span>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] text-gray-200 font-mono text-sm sm:text-base p-4 sm:p-8 overflow-hidden flex flex-col justify-end">
      <div ref={containerRef} className="max-h-full overflow-y-auto pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {lines.map((line, i) => (
          <div key={i} className="mb-1 opacity-90 break-words">{formatLine(line)}</div>
        ))}
        {lines.length < (config.customText || DEFAULT_BOOT_TEXT).split('\n').length && (
          <div className="animate-pulse mb-1">_</div>
        )}
      </div>
    </div>
  );
}
