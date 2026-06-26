import React from 'react';
import { motion, useDragControls } from 'motion/react';
import { X, ExternalLink, Minus } from 'lucide-react';

interface MusicAppProps {
  onClose: () => void;
  zIndex: number;
}

export function MusicApp({ onClose, zIndex }: MusicAppProps) {
  const profileUrl = "https://embed.music.apple.com/us/profile/JacobSzczepaniak";
  const externalUrl = "https://music.apple.com/profile/JacobSzczepaniak";
  const dragControls = useDragControls();

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4 bg-transparent select-none pointer-events-none"
      style={{ zIndex }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className="flex flex-col bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl shadow-black/50 w-[90vw] max-w-[600px] h-[550px] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Header */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className="drag-handle cursor-grab active:cursor-grabbing bg-[#333333] h-12 px-4 flex items-center justify-between border-b border-black/30 shrink-0 relative pointer-events-auto"
        >
          <div className="flex space-x-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer transition-colors active:bg-[#C23C37]"
              title="Close"
            >
              <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#4C0002]" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center cursor-pointer transition-colors active:bg-[#A97510]"
              title="Minimize"
            >
              <Minus className="w-2.5 h-2.5 text-[#5C3E00] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </button>
            <button 
              onClick={onClose}
              className="group w-[14px] h-[14px] rounded-full bg-[#27C93F] border border-[#1AAB29] flex items-center justify-center cursor-pointer transition-colors active:bg-[#168119]"
              title="Maximize"
            >
              <span className="text-[8px] text-[#024B0E] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </button>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center">
              <span className="text-[15px] font-[600] tracking-wide text-slate-300 drop-shadow-sm">Apple Music</span>
            </div>
          </div>
          
          <div className="w-12 z-10 flex justify-end" onPointerDown={(e) => e.stopPropagation()}>
            <a 
              href={externalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white transition-colors"
              title="Open in Apple Music"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Embed Content */}
        <div className="flex-1 w-full bg-black relative">
          <iframe 
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" 
            frameBorder="0" 
            height="100%" 
            style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', background: 'transparent' }} 
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" 
            src={profileUrl}
            title="Apple Music Profile"
            className="w-full h-full border-none"
          />
        </div>
      </motion.div>
    </div>
  );
}
