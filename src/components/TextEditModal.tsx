import React from "react";
import { 
  X, 
  Minus, 
  FileText
} from "lucide-react";
import { useAppletData } from "../DataContext";

interface TextEditModalProps {
  onClose: () => void;
  isDark: boolean;
}

export const TextEditModal: React.FC<TextEditModalProps> = ({ onClose, isDark }) => {
  const { about } = useAppletData();
  
  const styles = React.useMemo(() => ({
    backdropBg: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent select-none",
    windowBg: isDark 
      ? "relative w-full max-w-3xl h-[650px] bg-[#2a2a2c] rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/10 flex flex-col font-sans text-slate-200" 
      : "relative w-full max-w-3xl h-[650px] bg-[#f5f5f7] rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.18)] border border-black/15 flex flex-col font-sans text-[#1f2937]",
    titleBarBg: isDark 
      ? "bg-[#3a3a3c] h-10 px-4 flex items-center justify-between border-b border-black/30 shrink-0 relative" 
      : "bg-[#ececed] h-10 px-4 flex items-center justify-between border-b border-black/10 shrink-0 relative",
    titleText: isDark ? "text-slate-300" : "text-slate-700",
    editorBg: isDark ? "bg-[#1c1c1e]" : "bg-[#dedede]",
    paperBg: isDark 
      ? "w-full max-w-xl h-fit bg-[#252526] text-slate-100 p-8 sm:p-10 rounded-xs shadow-[0_10px_25px_rgba(0,0,0,0.6)] border border-zinc-700 font-serif leading-relaxed text-sm select-text selection:bg-[#3063d4]/30" 
      : "w-full max-w-xl h-fit bg-[#fcfbf9] text-[#1a1a1a] p-8 sm:p-10 rounded-xs shadow-[0_10px_25px_rgba(0,0,0,0.12)] border border-neutral-300 font-serif leading-relaxed text-sm select-text selection:bg-[#1062fe]/25",
    paperHeaderBorder: isDark ? "border-zinc-700" : "border-neutral-200",
    paperTitle: isDark ? "text-white" : "text-neutral-900",
    paperSubtitle: isDark ? "text-slate-400" : "text-neutral-500",
    paperEstablished: isDark ? "text-slate-500" : "text-neutral-400",
    paperParagraph: isDark ? "text-slate-300" : "text-neutral-750",
    sectionHeader: isDark ? "text-slate-200 border-zinc-700" : "text-neutral-950 border-neutral-200",
    cardBg: isDark ? "bg-zinc-800/40 border-zinc-750/50" : "bg-neutral-50 border-neutral-150",
    cardTitle: isDark ? "text-slate-200" : "text-neutral-900",
    cardBody: isDark ? "text-slate-400" : "text-neutral-600",
    quoteBg: isDark ? "bg-amber-950/25 border-l-4 border-amber-805/50 text-amber-200" : "bg-orange-50/40 border-l-4 border-orange-200 text-neutral-600",
    footerText: isDark ? "text-slate-500" : "text-neutral-500",
    footerName: isDark ? "text-slate-300" : "text-neutral-900",
    statusBarBg: isDark ? "bg-[#2a2a2c] text-slate-500 border-t border-[#1a1a1c]" : "bg-[#f0f0f2] text-slate-600 border-t border-black/10",
  }), [isDark]);

  const wordCount = React.useMemo(() => {
    const text = `${about?.intro || ""} ${about?.bio || ""}`;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [about]);

  const charCount = React.useMemo(() => {
    const text = `${about?.intro || ""} ${about?.bio || ""}`;
    return text.length;
  }, [about]);

  return (
    <div className={styles.backdropBg} onClick={onClose}>
      {/* TextEdit window simulation frame */}
      <div className={styles.windowBg} onClick={(e) => e.stopPropagation()}>
        
        {/* Titlebar */}
        <div className={styles.titleBarBg}>
          {/* Traffic light buttons top left */}
          <div className="flex space-x-2 z-10">
            <button 
              onClick={onClose}
              className="group w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer transition-colors active:bg-[#C23C37]"
              title="Close"
            >
              <X className="w-2 h-2 text-[#4C0002] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </button>
            <div className="group w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center cursor-not-allowed">
              <Minus className="w-2 h-2 text-[#5C3E00] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </div>
            <div className="group w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] flex items-center justify-center cursor-not-allowed">
              <span className="text-[6px] text-[#024B0E] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </div>
          </div>

          {/* Centered Title */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`flex items-center space-x-1.5 text-xs font-semibold ${styles.titleText}`}>
              <FileText className="w-3.5 h-3.5 text-orange-400" />
              <span>About Me.rtf — TextEdit</span>
            </div>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono">Edited</div>
        </div>

        {/* Paper Container */}
        <div className={`flex-1 overflow-y-auto ${styles.editorBg} p-6 flex justify-center scrollbar-thin`}>
          
          {/* Paper Sheet */}
          <div className={styles.paperBg}>
            
            {/* Header branding */}
            <div className={`flex justify-between items-start border-b-2 ${styles.paperHeaderBorder} pb-5 mb-6`}>
              <div>
                <h1 className={`text-2xl font-bold tracking-tight ${styles.paperTitle} font-sans`}>{about?.name || "Jake Pay"}</h1>
                <p className={`text-xs font-mono uppercase tracking-wider ${styles.paperSubtitle} mt-1 font-semibold`}>{about?.title || "Digital & Graphic Designer"}</p>
              </div>
              <div className={`text-right text-xs font-serif italic ${styles.paperEstablished}`}>
                Established {about?.established || "2021"}<br />
                Based in {about?.location || "London, UK"}
              </div>
            </div>

            {/* Profile Intro */}
            <div className="space-y-4">
              <p className={`first-letter:text-4xl first-letter:font-bold first-letter:${styles.paperTitle} first-letter:float-left first-letter:mr-2 ${styles.paperParagraph}`}>
                {about?.intro}
              </p>
              
              <p className={styles.paperParagraph}>
                {about?.bio}
              </p>
            </div>

            {/* Sign-off */}
            <div className={`mt-12 pt-6 border-t ${styles.paperHeaderBorder} flex justify-between items-center text-xs ${styles.footerText}`}>
              <span>Contact: {about?.contact || "hello@designerstudio.com"}</span>
              <span className={`italic font-serif font-semibold ${styles.footerName}`}>{about?.signoff || "Jake Pay"}</span>
            </div>

          </div>

        </div>

        {/* TextEdit Status bar */}
        <div className={`h-7 px-4 flex items-center justify-between shrink-0 text-[10.5px] font-sans select-none ${styles.statusBarBg}`}>
          <span>Words: {wordCount} &bull; Characters: {charCount}</span>
          <span>Zoom: 100%</span>
        </div>
      </div>
    </div>
  );
};
