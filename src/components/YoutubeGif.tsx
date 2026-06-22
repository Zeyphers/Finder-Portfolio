import React, { useRef, useState } from 'react';
import ReactPlayer from 'react-player';

interface YoutubeGifProps {
  url: string;
  className?: string;
  squareCrop?: boolean;
}

export function YoutubeGif({ url, className, squareCrop }: YoutubeGifProps) {
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(true);

  const handleProgress = (state: any) => {
    // If it reaches 10 seconds, seek back to 0
    if (state.playedSeconds >= 10 && playerRef.current) {
      playerRef.current.seekTo(0);
    }
  };

  const handleEnded = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(0);
    }
  };

  return (
    <div className={`relative overflow-hidden pointer-events-none bg-slate-900 ${className || ''}`}>
      <div className={squareCrop ? "absolute top-1/2 left-1/2 w-[177.77%] h-full -translate-x-1/2 -translate-y-1/2" : "w-full h-full"}>
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={playing}
          muted={true}
          loop={true}
          playsinline={true}
          width="100%"
          height="100%"
          onProgress={handleProgress}
          onEnded={handleEnded}
          progressInterval={500}
          style={{ position: 'absolute', top: 0, left: 0 }}
          config={{
            youtube: {
              playerVars: {
                controls: 0,
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                autoplay: 1,
                mute: 1
              } as any
            }
          } as any}
        />
      </div>
    </div>
  );
}
