import React, { useState, useEffect, useMemo } from "react";
import { Project, GalleryImage } from "../types";
import { motion, useDragControls } from "motion/react";
import { X, RefreshCcw } from "lucide-react";

interface MemoryGameProps {
  onClose: () => void;
  projects: Project[];
  isDark: boolean;
}

interface Card {
  id: string;
  imageUrl: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export const MemoryGameApp: React.FC<MemoryGameProps> = ({ onClose, projects, isDark }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const dragControls = useDragControls();
  
  // Extract images from projects
  const allImages = useMemo(() => {
    let images: string[] = [];
    projects.forEach(p => {
      p.gallery.forEach(g => {
        if (!g.isVideo && g.url) {
          images.push(g.url);
        }
      });
    });
    // Distinct images
    return Array.from(new Set(images));
  }, [projects]);

  const initGame = () => {
    if (allImages.length < 2) return; // Not enough images
    
    // Pick 6 random images
    const shuffledPool = [...allImages].sort(() => 0.5 - Math.random());
    const selectedImages = shuffledPool.slice(0, 6);
    
    // Create pairs
    const gameCards: Card[] = [...selectedImages, ...selectedImages].map((url, i) => ({
      id: `card-${i}-${Math.random()}`,
      imageUrl: url,
      isFlipped: false,
      isMatched: false,
    }));
    
    // Shuffle
    gameCards.sort(() => 0.5 - Math.random());
    
    setCards(gameCards);
    setFlippedIndices([]);
    setMoves(0);
    setMatches(0);
  };

  useEffect(() => {
    initGame();
  }, [allImages]);

  const handleCardClick = (index: number) => {
    if (flippedIndices.length === 2) return;
    if (cards[index].isMatched || cards[index].isFlipped) return;

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);
    
    // Update card to flipped
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [firstIndex, secondIndex] = newFlipped;
      if (cards[firstIndex].imageUrl === cards[secondIndex].imageUrl) {
        // Match!
        setTimeout(() => {
          setCards(prev => {
            const matchedCards = [...prev];
            matchedCards[firstIndex].isMatched = true;
            matchedCards[secondIndex].isMatched = true;
            return matchedCards;
          });
          setMatches(m => m + 1);
          setFlippedIndices([]);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards(prev => {
            const resetCards = [...prev];
            resetCards[firstIndex].isFlipped = false;
            resetCards[secondIndex].isFlipped = false;
            return resetCards;
          });
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const isWin = matches === 6 && cards.length > 0;

  const styles = {
    backdropBg: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent select-none",
    windowBg: isDark 
      ? "relative w-full max-w-3xl h-[650px] bg-[#2a2a2c] rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85)] border border-white/10 flex flex-col font-sans text-slate-200" 
      : "relative w-full max-w-3xl h-[650px] bg-[#f5f5f7] rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.18)] border border-black/15 flex flex-col font-sans text-[#1f2937]",
    titleBarBg: isDark 
      ? "cursor-grab active:cursor-grabbing bg-[#3a3a3c] h-10 px-4 flex items-center justify-between border-b border-black/30 shrink-0 relative" 
      : "cursor-grab active:cursor-grabbing bg-[#ececed] h-10 px-4 flex items-center justify-between border-b border-black/10 shrink-0 relative",
    titleText: isDark ? "text-slate-300" : "text-slate-700",
  };

  return (
    <div className={styles.backdropBg} onClick={onClose}>
      <motion.div 
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        className={styles.windowBg} 
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div onPointerDown={(e) => dragControls.start(e)} className={styles.titleBarBg}>
          <div className="flex space-x-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
            <button 
              onClick={onClose}
              className="group w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer transition-colors active:bg-[#C23C37]"
            >
              <X className="w-2 h-2 opacity-0 group-hover:opacity-100 text-[#4C0002]" />
            </button>
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-xs font-semibold tracking-wider ${styles.titleText}`}>Memory</span>
          </div>
          
          <div className="w-12 z-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
          {allImages.length < 2 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-center opacity-70">Not enough images uploaded in your projects to play.<br/>Please add at least 2 images to your projects.</p>
            </div>
          ) : (
            <>
              <div className="flex w-full items-center justify-between mb-8 px-4">
                <div className="flex space-x-6 text-sm font-semibold tracking-wide">
                  <span>Moves: {moves}</span>
                  <span>Matches: {matches}/6</span>
                </div>
                <button 
                  onClick={initGame}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Restart</span>
                </button>
              </div>

              {isWin && (
                <div className="mb-4 text-center">
                  <h2 className="text-2xl font-bold text-green-500 mb-2">You Won!</h2>
                  <p className="opacity-80">Completed in {moves} moves.</p>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 w-full max-w-2xl px-4 pb-8">
                {cards.map((card, index) => (
                  <div 
                    key={card.id}
                    onClick={() => handleCardClick(index)}
                    className="relative w-full aspect-square cursor-pointer [perspective:1000px]"
                  >
                    <div 
                      className={`w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${card.isFlipped || card.isMatched ? '[transform:rotateY(180deg)]' : ''}`}
                    >
                      {/* Back of card (visible when face down) */}
                      <div className="absolute w-full h-full rounded-xl bg-slate-300 dark:bg-slate-700 [backface-visibility:hidden] flex items-center justify-center shadow-md border-2 border-white/20">
                        <span className="text-4xl opacity-20 font-bold">?</span>
                      </div>
                      
                      {/* Front of card (visible when flipped) */}
                      <div className="absolute w-full h-full rounded-xl [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden shadow-lg border-2 border-blue-500/50 bg-black">
                        <img src={card.imageUrl} alt="Card face" className="w-full h-full object-cover" />
                        
                        {card.isMatched && (
                          <div className="absolute inset-0 bg-white/20 dark:bg-white/10" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
