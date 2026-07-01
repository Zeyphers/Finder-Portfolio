import React, { useState, useMemo, useEffect, useRef, Suspense, lazy } from "react";
import { FolderIcon } from "./components/FolderIcon";
import { ProgressiveImage, loadedImagesCache, computeAvgColor } from "./components/ProgressiveImage";
import BootAnimation from "./components/BootAnimation";
import { playErrorSound, setErrorSoundUrl } from "./sound";

// These windows only mount when the user opens them, so load their code on demand.
const TextEditModal = lazy(() => import("./components/TextEditModal").then(m => ({ default: m.TextEditModal })));
const MemoryGameApp = lazy(() => import("./components/MemoryGameApp").then(m => ({ default: m.MemoryGameApp })));
const MusicApp = lazy(() => import("./components/MusicApp").then(m => ({ default: m.MusicApp })));
const ContactApp = lazy(() => import("./components/ContactApp").then(m => ({ default: m.ContactApp })));
// Import data context for global state
import { useAppletData } from "./DataContext";
import { Project, GalleryImage } from "./types";
import { getImageUrl } from "./api";
import { useLocation, useNavigate } from "react-router-dom";
import { buildPath, resolvePath } from "./urlSlug";
import { motion, useDragControls, AnimatePresence } from "motion/react";
import { 
  Folder, 
  Search, 
  Grid, 
  List, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  X,
  Minus,
  FileText,
  HardDrive,
  Globe,
  Tag,
  Clock,
  Calendar,
  Briefcase,
  Layers,
  Sparkles,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sun,
  Moon,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Play,
  ChevronDown,
  Music
} from "lucide-react";
import 'react-quill-new/dist/quill.snow.css';

const getYoutubeEmbedUrl = (url: string): string => {
  if (!url) return "";
  let videoId = "";
  if (url.includes("youtu.be/")) {
    const match = url.split("youtu.be/")[1];
    videoId = match ? match.split(/[?#]/)[0] : "";
  } else if (url.includes("youtube.com/watch")) {
    const parts = url.split("?");
    if (parts[1]) {
      const params = new URLSearchParams(parts[1]);
      videoId = params.get("v") || "";
    }
  } else if (url.includes("youtube.com/embed/")) {
    const match = url.split("youtube.com/embed/")[1];
    videoId = match ? match.split(/[?#]/)[0] : "";
  } else if (url.includes("youtube.com/v/")) {
    const match = url.split("youtube.com/v/")[1];
    videoId = match ? match.split(/[?#]/)[0] : "";
  }
  
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}`;
  }
  return url;
};

// getImageUrl is imported from api.ts

// Safe localStorage wrappers to prevent iframe cross-origin DOMException
const safeGetItem = (key: string) => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};
const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) {}
};

interface MasonryGridProps {
  columns: number;
  images: GalleryImage[];
  folders?: Project[];
  onFolderClick?: (id: string) => void;
  selectedProjectName: string;
  imageAspectRatios: Record<string, number>;
  textMutedStyle: string;
  onImageClick: (index: number) => void;
  className?: string;
}

// Like Finder: subfolders are mixed into the same grid as the image files, but listed
// first so they sit at the top, then the files flow below in the masonry columns.
type MasonryCell =
  | { kind: "folder"; project: Project }
  | { kind: "image"; img: GalleryImage; imageIndex: number };

const MasonryGrid = ({ columns, images, folders = [], onFolderClick, selectedProjectName, imageAspectRatios, textMutedStyle, onImageClick, className = "" }: MasonryGridProps) => {
  const cells: MasonryCell[] = [
    ...folders.map((project) => ({ kind: "folder", project } as MasonryCell)),
    ...images.map((img, imageIndex) => ({ kind: "image", img, imageIndex } as MasonryCell)),
  ];
  return (
    <div className={`flex flex-row gap-[10px] items-start w-full ${className}`}>
      {Array.from({length: columns}).map((_, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col gap-[10px] min-w-0">
          {cells.map((cell, cellIndex) => {
            if (cellIndex % columns !== colIndex) return null;

            if (cell.kind === "folder") {
              const project = cell.project;
              return (
                <div key={`folder-${project.id}`} className="w-full">
                  <motion.div
                    onClick={() => onFolderClick?.(project.id)}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="group flex flex-col items-center justify-start p-2 cursor-pointer select-none rounded-lg w-full h-full"
                  >
                    <div className="w-3/5 aspect-square flex items-center justify-center">
                      {project.folderIconImage ? (
                        <ProgressiveImage src={project.folderIconImage} alt={project.name} objectFit="contain" className="max-w-full max-h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)]" containerClassName="w-full h-full flex items-center justify-center" />
                      ) : (
                        <FolderIcon className="w-full h-full" />
                      )}
                    </div>
                    <div className={`text-[14px] md:text-[15.5px] font-medium text-center ${textMutedStyle} -mt-1 break-words leading-tight w-full px-1`}>{project.name.split(" — ")[0]}</div>
                  </motion.div>
                </div>
              );
            }

            const img = cell.img;
            const index = cell.imageIndex;
            const baseName = selectedProjectName.split(" — ")[0].replace(/\s+/g, '_').toLowerCase();
            let extension = index % 2 === 0 ? "png" : "jpg";
            if (img.url.toLowerCase().endsWith(".gif")) extension = "gif";
            else if (img.url.toLowerCase().endsWith(".png")) extension = "png";
            else if (img.url.toLowerCase().endsWith(".jpg") || img.url.toLowerCase().endsWith(".jpeg")) extension = "jpg";
            if (img.isVideo) extension = "mp4";
            const filename = img.fileName || `${baseName}_asset_${index + 1}.${extension}`;
            return (
              <div key={`img-${index}`} className="w-full">
                <div
                  onClick={() => {
                    // Check load state at click time so it reflects the latest status.
                    if (img.isVideo || loadedImagesCache.has(getImageUrl(img.url))) onImageClick(index);
                    else playErrorSound();
                  }}
                  className={`group flex flex-col items-center justify-start p-2 cursor-pointer select-none rounded-lg w-full h-full`}
                >
                  <div className="w-full relative p-1" style={{ aspectRatio: img.isVideo ? "16 / 9" : (imageAspectRatios[img.url] ? `${imageAspectRatios[img.url]}` : "1 / 1") }}>
                    <ProgressiveImage src={getImageUrl(img.url)} alt={img.caption} objectFit="cover" className="w-full h-full rounded-sm" containerClassName="absolute inset-1" referrerPolicy="no-referrer" draggable={false} />
                    {img.isVideo && <div className="absolute inset-1 flex items-center justify-center pointer-events-none z-20"><Play className="w-14 h-14 text-slate-500/40 fill-slate-500/40 drop-shadow-lg" /></div>}
                  </div>
                  <div className={`text-[14px] md:text-[15.5px] font-medium text-center ${textMutedStyle} mt-1 break-words leading-tight w-full px-1`}>{filename}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default function Portfolio() {
  const { projects: RAW_PROJECTS, links: EXTERNAL_LINKS, about, sidebar: RAW_SIDEBAR, isDataLoaded } = useAppletData();

  // Deep-link routing: the current folder/image are reflected in the URL so a
  // specific folder or image (at any nesting depth) can be linked and shared (see ./urlSlug).
  const location = useLocation();
  const navigate = useNavigate();

  const isProd = window.location.hostname.includes('netlify.app') || window.location.hostname === 'jake-pay.com' || window.location.hostname === 'www.jake-pay.com';
  
  const [bootCompleted, setBootCompleted] = useState(false);
  
  const PROJECTS = React.useMemo(() => {
    if (isProd) return RAW_PROJECTS.filter(p => p.id !== "test-folder");
    return RAW_PROJECTS;
  }, [RAW_PROJECTS, isProd]);

  const SIDEBAR = React.useMemo(() => {
    if (isProd) return RAW_SIDEBAR.filter(s => s.targetId !== "test-folder" && s.id !== "test-folder");
    return RAW_SIDEBAR;
  }, [RAW_SIDEBAR, isProd]);
  
  // Set tab icon (favicon) when about.tabIconUrl changes
  useEffect(() => {
    if (about?.tabIconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = about.tabIconUrl;
    }
  }, [about?.tabIconUrl]);

  // Keep the image-click error sound in sync with the admin Settings value.
  useEffect(() => {
    setErrorSoundUrl(about?.errorSoundUrl);
  }, [about?.errorSoundUrl]);
  
  // Preload image dimensions so masonry doesn't jump
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, number>>({});
  const preloadedRef = React.useRef<Set<string>>(new Set());
  
  useEffect(() => {
    PROJECTS.forEach(p => {
      // Preload folder icon
      if (p.folderIconImage && !preloadedRef.current.has(p.folderIconImage)) {
        preloadedRef.current.add(p.folderIconImage);
        const folderUrl = getImageUrl(p.folderIconImage);
        const folderImg = new Image();
        folderImg.src = folderUrl;
        folderImg.onload = () => {
          loadedImagesCache.add(folderUrl);
        };
      }
      p.gallery.forEach(img => {
        if (img.isVideo) return;
        if (!preloadedRef.current.has(img.url)) {
          preloadedRef.current.add(img.url);
          const i = new Image();
          const pUrl = getImageUrl(img.url);
          i.src = pUrl;
          i.onload = () => {
            loadedImagesCache.add(pUrl);
            // Capture the average colour now so the placeholder can use it later.
            computeAvgColor(i, pUrl);
            if (i.width && i.height) {
              setImageAspectRatios(prev => ({ ...prev, [img.url]: i.width / i.height }));
            }
          };
        }
      });
    });
  }, [PROJECTS]);

  // Navigation active state can be "overview" or the ID of a project ("project-1", "project-2", etc.)
  const [activeSelection, setActiveSelection] = useState<string>("overview");
  const dragControls = useDragControls();
  
  // Light/Dark Theme Controllers
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const stored = safeGetItem("portfolio-theme");
      if (stored === "dark" || stored === "light") return stored;
      if (window.matchMedia) {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    }
    return "light";
  });
  
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = theme;
    }
  }, [theme]);
  
  const setTheme = (newTheme: "dark" | "light" | ((prev: "dark" | "light") => "dark" | "light")) => {
    setThemeState(prev => {
      const resolvedTheme = typeof newTheme === "function" ? newTheme(prev) : newTheme;
      safeSetItem("portfolio-theme", resolvedTheme);
      window.dispatchEvent(new Event("storage"));
      return resolvedTheme;
    });
  };
  const isDark = theme === "dark";

  // Sync with device system theme switches
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Helpers to get beautiful themed brand icons
  const getLinkIcon = (iconName: string, className = "w-3.5 h-3.5") => {
    switch (iconName) {
      case "linkedin":
        return <Linkedin className={`${className} text-[#0a66c2] shrink-0`} />;
      case "instagram":
        return <Instagram className={`${className} text-[#e1306c] shrink-0`} />;
      case "facebook":
        return <Facebook className={`${className} text-[#1877f2] shrink-0`} />;
      case "youtube":
        return <Youtube className={`${className} text-[#ff0000] shrink-0`} />;
      default:
        return <Globe className={`${className} text-slate-500 shrink-0`} />;
    }
  };

  const getLargeLinkIcon = (iconName: string, className = "w-7 h-7") => {
    switch (iconName) {
      case "linkedin":
        return <Linkedin className={`${className} text-[#0a66c2]`} />;
      case "instagram":
        return <Instagram className={`${className} text-[#e1306c]`} />;
      case "facebook":
        return <Facebook className={`${className} text-[#1877f2]`} />;
      case "youtube":
        return <Youtube className={`${className} text-[#ff0000]`} />;
      default:
        return <Globe className={`${className} text-sky-400`} />;
    }
  };

  const styles = useMemo(() => {
    const tx = (dark: string, light: string) => `transition-colors duration-500 ${isDark ? dark : light}`;
    
    return {
      // Containers
      outerBg: tx("bg-[#1c1c1e] text-slate-200", "bg-[#dedede] text-[#1f2937]"),
      windowBg: tx("bg-[#2a2a2c] border border-white/10 shadow-[0_22px_55px_rgba(0,0,0,0.75)]", "bg-[#fbfbfb] border border-black/15 shadow-[0_22px_55px_rgba(0,0,0,0.18)]"),
      titleBarBg: tx("bg-[#3a3a3c] border-b border-black/35 text-slate-200", "bg-[#ececed] border-b border-black/12 text-slate-700"),
      titleText: tx("text-slate-300", "text-slate-600"),
      sidebarBg: tx("bg-[#18181a] border-r border-black/45 shadow-[4px_0_16px_rgba(0,0,0,0.3)] z-10 text-slate-300", "bg-[#ececed] border-r border-black/15 shadow-[4px_0_16px_rgba(0,0,0,0.06)] z-10 text-slate-800"),
      mainCanvasBg: tx("bg-[#2a2a2c] text-slate-100", "bg-white text-slate-900"),
      statusBarBg: tx("bg-[#2a2a2c] border-t border-black/35 text-slate-400", "bg-[#f0f0f2] border-t border-black/10 text-slate-600"),
      
      // Text elements
      textPrimary: tx("text-slate-100", "text-slate-950"),
      textSecondary: tx("text-slate-300", "text-slate-800"),
      textMuted: tx("text-slate-400", "text-slate-500"),
      textMutedSubtle: tx("text-slate-500", "text-slate-400"),
      
      // Buttons & Icons
      sidebarSectionHeader: tx("text-slate-500 font-bold", "text-slate-400 font-extrabold"),
      sidebarButtonSelected: tx("bg-[#3063d4] text-white", "bg-[#1062fe] text-white shadow-xs"),
      sidebarButtonHover: tx("text-slate-300", "text-slate-700"),
      
      // Card & badges inside main workspace
      cardBg: tx("bg-black/15 border border-white/5", "bg-[#f9f9fb] border border-black/8 shadow-2xs"),
      badgeBg: tx("bg-sky-500/10 text-sky-400 border border-sky-400/20", "bg-[#1062fe]/10 text-[#1062fe] border border-[#1062fe]/20"),
      badgeGreenBg: tx("bg-emerald-500/10 text-emerald-400 border border-emerald-400/20", "bg-emerald-600/10 text-emerald-600 border border-emerald-600/20"),
      badgeOrangeBg: tx("bg-orange-500/10 text-orange-400 border border-orange-500/20", "bg-orange-600/10 text-orange-600 border border-orange-600/20"),
    };
  }, [isDark]);

  // Modals controller states
  const [isAboutMeOpen, setIsAboutMeOpen] = useState<boolean>(false);
  const [isMemoryGameOpen, setIsMemoryGameOpen] = useState<boolean>(false);
  const [isMusicAppOpen, setIsMusicAppOpen] = useState<boolean>(false);
  const [isContactAppOpen, setIsContactAppOpen] = useState<boolean>(false);
  
  // Lightbox controller state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Track viewport so the lightbox can switch between click-to-zoom (desktop)
  // and pinch-to-zoom (mobile). Matches Tailwind's `md` breakpoint (768px).
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(max-width: 767px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Pinch-gesture bookkeeping for the mobile lightbox.
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);

  // Lightbox idle state to auto-hide controls
  const [isLightboxIdle, setIsLightboxIdle] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetLightboxIdle = React.useCallback(() => {
    setIsLightboxIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsLightboxIdle(true), 1500);
  }, []);

  useEffect(() => {
    if (lightboxIndex !== null) {
      resetLightboxIdle();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [lightboxIndex, resetLightboxIdle]);

  // Reset zoom and panning when lightbox index changes
  useEffect(() => {
    setLightboxZoom(1);
    setMousePos({ x: 50, y: 50 });
  }, [lightboxIndex]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // View mode style
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Keyboard controls for lightbox navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      
      const currentProject = PROJECTS.find(p => p.id === activeSelection);
      if (!currentProject) return;

      if (e.key === "Escape") {
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        const nextIndex = (lightboxIndex + 1) % currentProject.gallery.length;
        setLightboxIndex(nextIndex);
        setLightboxZoom(1);
      } else if (e.key === "ArrowLeft") {
        const prevIndex = (lightboxIndex - 1 + currentProject.gallery.length) % currentProject.gallery.length;
        setLightboxIndex(prevIndex);
        setLightboxZoom(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, activeSelection, PROJECTS]);

  const closeLightbox = () => {
    setLightboxIndex(null);
    setLightboxZoom(1);
  };

  const handleZoomClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).tagName !== 'IMG') {
      closeLightbox();
      return;
    }

    // On mobile, zoom is driven by pinch gestures rather than tap.
    if (isMobile) return;

    if (lightboxZoom === 1) {
      setLightboxZoom(2.5);
      updateMousePos(e);
    } else {
      setLightboxZoom(1);
    }
  };

  const updateMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else {
      return;
    }
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (lightboxZoom > 1) {
      updateMousePos(e);
    }
  };

  // Distance between the two active fingers, used to derive the pinch scale.
  const getTouchDist = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  // Zoom toward the midpoint between the two fingers so the image scales around
  // wherever the user is pinching.
  const updatePinchOrigin = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const x = Math.max(0, Math.min(100, ((midX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((midY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: getTouchDist(e.touches), startZoom: lightboxZoom };
      setIsPinching(true);
      updatePinchOrigin(e);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const ratio = getTouchDist(e.touches) / pinchRef.current.startDist;
      const next = Math.min(5, Math.max(1, pinchRef.current.startZoom * ratio));
      setLightboxZoom(next);
      updatePinchOrigin(e);
    } else if (lightboxZoom > 1 && e.touches.length === 1) {
      // Single-finger pan while zoomed in.
      updateMousePos(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
      setIsPinching(false);
      // Snap back to fit if the user pinched almost all the way out.
      if (lightboxZoom < 1.05) setLightboxZoom(1);
    }
  };

  // Navigating history tracking
  const [history, setHistory] = useState<string[]>(["overview"]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const navigateTo = (selectionId: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(selectionId);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setActiveSelection(selectionId);
  };

  const navigateBack = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setActiveSelection(history[idx]);
    }
  };

  const navigateForward = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      setActiveSelection(history[idx]);
    }
  };

  // Safe wrapper for opening external Web location links
  const handleLinkOpen = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Reset helper
  const handleResetSystem = () => {
    setSearchQuery("");
    setActiveSelection("overview");
    setHistory(["overview"]);
    setHistoryIndex(0);
    setIsAboutMeOpen(false);
    setLightboxIndex(null);
  };

  // Returns project meta of selected item if active
  const selectedProject = useMemo(() => {
    if (activeSelection === "overview") return null;
    return PROJECTS.find(p => p.id === activeSelection) || null;
  }, [activeSelection, PROJECTS]);

  // --- Deep-link URL <-> state sync ---
  // A guard so the two effects don't fight on the render where data first loads:
  // when URL->state applies a change, the paired state->URL run must skip once
  // (its `selectedProject` is still the pre-update value and would clobber the URL).
  const pendingUrlApply = useRef(false);

  // URL -> state: apply the path on initial load, browser back/forward, and once
  // data arrives.
  useEffect(() => {
    if (!isDataLoaded) return;
    const { project, imageIndex } = resolvePath(location.pathname, PROJECTS);
    const desiredSelection = project ? project.id : "overview";
    if (desiredSelection !== activeSelection || imageIndex !== lightboxIndex) {
      pendingUrlApply.current = true;
      setActiveSelection(desiredSelection);
      setLightboxIndex(imageIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isDataLoaded, PROJECTS]);

  // state -> URL: keep the address bar in sync with the open folder/image (full
  // nested path) so it can be copied and shared. replace:true avoids history spam.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (pendingUrlApply.current) { pendingUrlApply.current = false; return; }
    const target = buildPath(selectedProject, lightboxIndex, PROJECTS);
    if (target !== location.pathname) navigate(target, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, lightboxIndex, isDataLoaded]);

  // Folder level items rendering filtering.
  // With no search: show only top-level folders (subfolders live inside their parent).
  // With a search query: match across ALL folders (flattened) so nested ones stay findable.
  const filteredOverviewFolders = useMemo(() => {
    if (searchQuery.trim() === "") return PROJECTS.filter(p => !p.parentId);
    const q = searchQuery.toLowerCase();
    return PROJECTS.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.client || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q) ||
      (p.tags || []).some(t => (t || "").toLowerCase().includes(q))
    );
  }, [searchQuery, PROJECTS]);

  // Direct subfolders of the currently open folder.
  const childFolders = useMemo(
    () => (selectedProject ? PROJECTS.filter(p => p.parentId === selectedProject.id) : []),
    [selectedProject, PROJECTS]
  );

  // Bottom/footer text: use the folder's own, else inherit the nearest ancestor's.
  const getInheritedBottomText = (project: Project): string | undefined => {
    const seen = new Set<string>();
    let cur: Project | undefined = project;
    while (cur && !seen.has(cur.id)) {
      const t = (cur.bottomText || "").trim();
      if (t && t !== "<p><br></p>") return cur.bottomText;
      seen.add(cur.id);
      cur = cur.parentId ? PROJECTS.find(p => p.id === cur!.parentId) : undefined;
    }
    return undefined;
  };

  // Walk the parentId chain to build a breadcrumb trail [root … current].
  const getAncestry = (id: string): Project[] => {
    const chain: Project[] = [];
    const seen = new Set<string>();
    let cur = PROJECTS.find(p => p.id === id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentId ? PROJECTS.find(p => p.id === cur!.parentId) : undefined;
    }
    return chain;
  };

  // Reusable Finder-style folder card (used by the overview grid and subfolder grids).
  const renderFolderCard = (project: Project) => (
    <motion.div
      key={project.id}
      onClick={() => navigateTo(project.id)}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 20 }}
      className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
    >
      {project.folderIconImage ? (
        <div className="w-[140px] h-[140px] mb-1 flex items-center justify-center p-1">
          <ProgressiveImage
            src={project.folderIconImage}
            alt={project.name}
            objectFit="contain"
            className="max-w-full max-h-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)] object-contain"
            containerClassName="w-full h-full flex items-center justify-center"
          />
        </div>
      ) : (
        <FolderIcon className="w-[140px] h-[140px] mb-1" />
      )}
      <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} leading-tight w-full break-words mt-2 px-1`}>
        {project.name.split(" — ")[0]}
      </span>
    </motion.div>
  );

  const filteredOverviewLinks = useMemo(() => {
    if (searchQuery.trim() === "") return EXTERNAL_LINKS;
    const q = searchQuery.toLowerCase();
    return EXTERNAL_LINKS.filter(l => l.name.toLowerCase().includes(q));
  }, [searchQuery, EXTERNAL_LINKS]);

  const getSectionTitle = (id: string) => {
    if (id === "overview") return "Overview";
    const p = PROJECTS.find(item => item.id === id);
    return p ? p.name.split(" — ")[0] : "Folder";
  };

  return (
    <>
    <div className={`h-screen ${styles.outerBg} p-0 sm:p-6 lg:p-8 flex items-center justify-center font-sans overflow-hidden antialiased select-none`}>
      
      {/* 5. Rich TextEdit Biographical / Profile viewer modal */}
      <AnimatePresence>
        {isAboutMeOpen && (
          <Suspense fallback={null}>
            <TextEditModal onClose={() => setIsAboutMeOpen(false)} isDark={isDark} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 6. Memory Game App */}
      <AnimatePresence>
        {isMemoryGameOpen && (
          <Suspense fallback={null}>
            <MemoryGameApp onClose={() => setIsMemoryGameOpen(false)} projects={PROJECTS} isDark={isDark} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 6.5 Music App */}
      <AnimatePresence>
        {isMusicAppOpen && (
          <Suspense fallback={null}>
            <MusicApp onClose={() => setIsMusicAppOpen(false)} zIndex={999} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Contact Me App */}
      <AnimatePresence>
        {isContactAppOpen && (
          <Suspense fallback={null}>
            <ContactApp onClose={() => setIsContactAppOpen(false)} isDark={isDark} />
          </Suspense>
        )}
      </AnimatePresence>

      {/* 7. macOS Preview Lightbox Overlay */}
      <AnimatePresence>
        {lightboxIndex !== null && selectedProject && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center overflow-y-auto osx-scrollbar"
            onClick={closeLightbox}
            onMouseMove={resetLightboxIdle}
            onKeyDown={resetLightboxIdle}
          >
            {/* Lightbox Toolbar Header - Fixed at top */}
            <div className={`w-full max-w-5xl flex items-center justify-between text-slate-300 py-2.5 px-4 shrink-0 sticky top-0 z-50 transition-opacity duration-300 ${isLightboxIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center space-x-3">
              <button 
                onClick={closeLightbox}
                className="w-7 h-7 rounded-full bg-slate-800 font-bold flex items-center justify-center cursor-pointer hover:bg-slate-700 transition"
                title="Close Preview (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-xs font-mono flex items-center">
                {selectedProject.gallery[lightboxIndex].isVideo && <Youtube className="w-4 h-4 text-red-500 mr-2" />}
                <span className="text-white font-semibold font-sans">
                  {selectedProject.gallery[lightboxIndex].fileName || 
                  (selectedProject.gallery[lightboxIndex].caption && (!selectedProject.gallery[lightboxIndex].caption.startsWith("New Image") && !selectedProject.gallery[lightboxIndex].caption.startsWith("New Video")) 
                    ? selectedProject.gallery[lightboxIndex].caption.split(":")[0] 
                    : (selectedProject.gallery[lightboxIndex].isVideo ? "YouTube Video" : "Asset"))}
                </span>
                <span className="text-slate-500 mx-2">|</span>
                <span>{lightboxIndex + 1} of {selectedProject.gallery.length} items</span>
              </div>
            </div>
          </div>

          <div className="w-full min-h-[calc(100dvh-80px)] flex-1 shrink-0 flex flex-col items-center justify-center relative pb-20">
            {/* Lightbox Main canvas */}
            <div className="w-full flex-1 flex items-center justify-center relative min-h-0 select-none my-4">
              {/* Left Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const prev = (lightboxIndex - 1 + selectedProject.gallery.length) % selectedProject.gallery.length;
                  setLightboxIndex(prev);
                  setLightboxZoom(1);
                  resetLightboxIdle();
                }}
                className={`absolute left-4 z-40 p-3.5 bg-black/45 text-white rounded-full cursor-pointer hover:bg-black/70 focus:outline-none transition-opacity duration-300 ${isLightboxIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Display Image with zoom capability or YouTube Video embed */}
              <div 
                className={`relative max-w-full max-h-full h-full p-2 overflow-hidden flex items-center justify-center ${
                  selectedProject.gallery[lightboxIndex].isVideo
                    ? "w-[95vw] md:w-[85vw] aspect-video pointer-events-auto"
                    : (lightboxZoom > 1 || isMobile)
                      ? "pointer-events-auto"
                      : "pointer-events-none"
                }`}
                style={selectedProject.gallery[lightboxIndex].isVideo ? undefined : {
                  transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
                  transform: `scale(${lightboxZoom})`,
                  // Skip the ease-out while actively pinching so the image tracks the fingers.
                  transition: isPinching ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  // Own the gesture on mobile: `pan-y` lets the page still scroll to the
                  // process section at 1x while disabling the browser's native pinch-zoom;
                  // `none` while zoomed so single-finger drags pan instead of scrolling.
                  touchAction: isMobile ? (lightboxZoom > 1 ? 'none' : 'pan-y') : undefined,
                }}
                onMouseMove={handleMouseMove}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {selectedProject.gallery[lightboxIndex].isVideo && selectedProject.gallery[lightboxIndex].videoUrl ? (
                  <iframe 
                    src={getYoutubeEmbedUrl(selectedProject.gallery[lightboxIndex].videoUrl!)}
                    title={selectedProject.gallery[lightboxIndex].caption}
                    className="w-full h-full shadow-2xl border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <ProgressiveImage 
                    src={getImageUrl(selectedProject.gallery[lightboxIndex].url)} 
                    alt="High Resolution Portfolio Asset"
                    objectFit="contain"
                    containerClassName="w-full h-full max-h-full max-w-[90vw] md:max-w-[85vw] flex items-center justify-center drop-shadow-2xl pointer-events-none"
                    className={`max-w-full max-h-full pointer-events-auto ${lightboxZoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                    referrerPolicy="no-referrer"
                    onClick={handleZoomClick}
                    draggable={false}
                  />
                )}
              </div>

              {/* Right Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (lightboxIndex + 1) % selectedProject.gallery.length;
                  setLightboxIndex(next);
                  setLightboxZoom(1);
                  resetLightboxIdle();
                }}
                className={`absolute right-4 z-40 p-3.5 bg-black/45 text-white rounded-full cursor-pointer hover:bg-black/70 focus:outline-none transition-opacity duration-300 ${isLightboxIdle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Caption text footer */}
            <div 
              className="w-full max-w-3xl bg-black/65 backdrop-blur-md border border-white/5 py-4 px-6 rounded-xl text-center text-xs text-slate-200 shrink-0 select-text mb-4"
              onClick={e => e.stopPropagation()}
            >
              <p className="font-sans leading-relaxed italic">{selectedProject.gallery[lightboxIndex].caption}</p>
            </div>

            {/* Scroll Hint */}
            {selectedProject.gallery[lightboxIndex].processInfoHtml && selectedProject.gallery[lightboxIndex].processInfoHtml !== '<p><br></p>' && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center text-white/70 animate-bounce">
                <span className="text-xs uppercase tracking-widest mb-1 font-semibold drop-shadow-md">Scroll to see process</span>
                <ChevronDown className="w-5 h-5 drop-shadow-md" />
              </div>
            )}
          </div>

          {/* Process Info Content */}
          {selectedProject.gallery[lightboxIndex].processInfoHtml && selectedProject.gallery[lightboxIndex].processInfoHtml !== '<p><br></p>' && (
            <div 
              className="w-[95vw] md:w-[85vw] max-w-6xl mx-auto bg-slate-900/95 rounded-xl shadow-2xl mb-32 shrink-0 z-10 relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div 
                className="p-8 md:p-12 prose prose-invert prose-slate prose-lg max-w-none text-slate-300 whitespace-normal [overflow-wrap:break-word] [word-break:normal] [hyphens:none] [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:mx-auto"
                dangerouslySetInnerHTML={{ __html: selectedProject.gallery[lightboxIndex].processInfoHtml! }}
              />
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>      {/* Main Finder Window container */}
      <motion.div 
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        id="finder-window"
        className={`w-full max-w-[1550px] h-full sm:h-[88vh] sm:min-h-[720px] ${styles.windowBg} rounded-none sm:rounded-[28px] overflow-hidden flex flex-col relative shadow-none sm:shadow-[0_30px_90px_-15px_rgba(0,0,0,0.4)]`}
      >
        {/* Header 1: macOS traffic lights and centered directory label */}
        <div 
          onPointerDown={(e) => dragControls.start(e)}
          className={`cursor-grab active:cursor-grabbing ${styles.titleBarBg} h-11 px-4 flex items-center justify-between shrink-0 relative`}
        >
          
          {/* Traffic red/yellow/green visual lights */}
          <div 
            onClick={activeSelection !== "overview" ? () => navigateTo("overview") : undefined}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex items-center space-x-2 z-30 p-1.5 -m-1.5 rounded-md transition-all duration-150 ${
              activeSelection !== "overview" 
                ? "cursor-pointer active:scale-95 md:active:scale-100 md:cursor-default" 
                : ""
            }`}
            title={activeSelection !== "overview" ? "Tap to go back to overview" : "Mac window controls"}
          >
            <button 
              onClick={(e) => {
                if (activeSelection !== "overview") {
                  e.stopPropagation();
                  navigateTo("overview");
                } else {
                  handleResetSystem();
                }
              }}
              className="group w-3.5 h-3.5 rounded-full bg-[#FF5F56] border border-[#E0443E] flex items-center justify-center cursor-pointer active:bg-[#C23C37]"
              title="Reset Finder to Home Overview"
            >
              <X className="w-2 h-2 text-[#4C0002] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </button>
            <div className="group w-3.5 h-3.5 rounded-full bg-[#FFBD2E] border border-[#DEA123] flex items-center justify-center">
              <Minus className="w-2.5 h-2.5 text-[#5C3E00] opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={3.5} />
            </div>
            <div className="group w-3.5 h-3.5 rounded-full bg-[#27C93F] border border-[#1AAB29] flex items-center justify-center">
              <span className="text-[7px] text-[#024B0E] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
            </div>
          </div>

          {/* Centered Folder Location path banner */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-16 select-none">
            <span className={`text-[11px] sm:text-xs font-semibold ${styles.titleText} tracking-wide mt-0.5 transition-all truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none ${
              activeSelection !== "overview" ? "hidden md:inline-block" : "inline-block"
            }`}>
              Jacob Szczepaniak - Portfolio
            </span>
            {activeSelection !== "overview" && (
              <span className={`text-[11px] sm:text-xs font-semibold ${styles.titleText} tracking-wide mt-0.5 transition-all truncate max-w-[140px] xs:max-w-[180px] md:hidden`}>
                {getSectionTitle(activeSelection)}
              </span>
            )}
          </div>

          {/* Right utility spacing */}
          <div className="w-20"></div>
        </div>

        {/* Interior layout body splits (Sidebar list on left / Files workspace canvas on right) */}
        <div className={`transition-colors duration-500 flex-1 flex overflow-hidden min-h-0 ${isDark ? "bg-[#2a2a2c]" : "bg-white"}`}>
          
          {/* A. Dynamic sidebar layout list */}
          <aside className={`hidden md:flex w-64 shrink-0 ${styles.sidebarBg} p-4 flex-col space-y-5 select-none overflow-y-auto`}>
            
            {/* 1. Overview and Biography file item index shortcuts */}
            <div>
              <button
                onClick={() => { if (activeSelection !== "overview") navigateTo("overview"); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left font-medium cursor-pointer select-none ${
                  activeSelection === "overview"
                    ? styles.sidebarButtonSelected
                    : styles.sidebarButtonHover
                }`}
              >
                <Folder className={`w-4.5 h-4.5 shrink-0 ${activeSelection === "overview" ? "text-white" : "text-slate-400"}`} />
                <span>Overview</span>
              </button>
            </div>

            {/* Dynamic Sidebar layout list matching files/links */}
            <div className="flex flex-col space-y-1">
              {(!SIDEBAR || SIDEBAR.length === 0) ? (
                <>
                  <div className="space-y-1.5 mt-2">
                    <h4 className={`text-[12px] uppercase pl-2 tracking-wider ${styles.sidebarSectionHeader}`}>Projects</h4>
                    <ul className="space-y-1 text-[15.5px]">
                      {PROJECTS.filter(p => !p.parentId).map((project) => {
                        const isCurSelected = activeSelection === project.id;
                        return (
                          <li key={project.id}>
                            <button
                              onClick={() => navigateTo(project.id)}
                              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left font-medium cursor-pointer truncate ${
                                isCurSelected
                                  ? styles.sidebarButtonSelected
                                  : styles.sidebarButtonHover
                              }`}
                            >
                              <Folder className={`w-4.5 h-4.5 shrink-0 ${isCurSelected ? "text-white" : "text-slate-400"}`} />
                              <span className="truncate">{project.name.split(" — ")[0]}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="space-y-1.5 mt-4">
                    <h4 className={`text-[12px] uppercase pl-2 tracking-wider ${styles.sidebarSectionHeader}`}>Links</h4>
                    <ul className="space-y-1 text-[15.5px]">
                      {EXTERNAL_LINKS.map((link) => (
                        <li key={link.id}>
                          <button
                            onClick={() => handleLinkOpen(link.url)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left font-medium cursor-pointer ${styles.sidebarButtonHover}`}
                          >
                            <div className="flex items-center space-x-3 truncate">
                              {getLinkIcon(link.iconName, "w-4.5 h-4.5")}
                              <span className="truncate">{link.name}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <ul className="space-y-1 text-[15.5px]">
                  {SIDEBAR.map((item) => {
                    if (item.type === "title") {
                      return (
                        <li key={item.id} className="pt-4 pb-1">
                          <h4 className={`text-[12px] uppercase pl-2 tracking-wider ${styles.sidebarSectionHeader}`}>{item.name}</h4>
                        </li>
                      );
                    } else if (item.type === "project") {
                      const isCurSelected = activeSelection === item.targetId;
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => { if (item.targetId) navigateTo(item.targetId); }}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left font-medium cursor-pointer truncate ${
                              isCurSelected ? styles.sidebarButtonSelected : styles.sidebarButtonHover
                            }`}
                          >
                            <Folder className={`w-4.5 h-4.5 shrink-0 ${isCurSelected ? "text-white" : "text-slate-400"}`} />
                            <span className="truncate">{item.name}</span>
                          </button>
                        </li>
                      );
                    } else if (item.type === "link") {
                      const externalLink = EXTERNAL_LINKS.find(l => l.id === item.targetId);
                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => { if (externalLink) handleLinkOpen(externalLink.url); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left font-medium cursor-pointer ${styles.sidebarButtonHover}`}
                          >
                            <div className="flex items-center space-x-3 truncate">
                              {getLinkIcon(item.iconName || "link", "w-4.5 h-4.5")}
                              <span className="truncate">{item.name}</span>
                            </div>
                          </button>
                        </li>
                      );
                    }
                    return null;
                  })}
                </ul>
              )}
            </div>

          </aside>

          {/* B. Center workspace directory canvas */}
          <main className={`flex-1 overflow-y-auto p-2.5 relative min-w-0 flex flex-col justify-start ${styles.mainCanvasBg} select-none`}>
            
            <AnimatePresence mode="wait">
            {activeSelection === "overview" ? (
              // ==================== STATE 1: TOP-LEVEL OVERVIEW VIEW ====================
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full flex flex-col justify-start min-h-0"
              >
                
                <div className="pt-2" />

                <div className="flex-1 overflow-y-auto pb-6 space-y-6">
                  
                  {/* Projects Section */}
                  {filteredOverviewFolders.length > 0 && (
                    <div className="space-y-3">
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${styles.textMuted} pl-1`}>
                        Project Folders
                      </div>
                      <div className="flex flex-wrap gap-[10px] justify-center md:justify-start items-start">
                        {filteredOverviewFolders.map(renderFolderCard)}
                      </div>
                    </div>
                  )}

                  {/* Horizontal Divider Line */}
                  {filteredOverviewFolders.length > 0 && (filteredOverviewLinks.length > 0 || searchQuery === "") && (
                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className={`transition-colors duration-500 w-full border-t ${isDark ? "border-white/10" : "border-black/8"}`}></div>
                      </div>
                    </div>
                  )}

                  {/* Shortcuts & Links Section */}
                  {(filteredOverviewLinks.length > 0 || searchQuery === "") && (
                    <div className="space-y-3">
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${styles.textMuted} pl-1`}>
                        Shortcuts & Documents
                      </div>
                      <div className="flex flex-wrap gap-[10px] justify-center md:justify-start items-start">
                        {/* File: About Me.rtf */}
                        {(searchQuery === "" || "about me.rtf".includes(searchQuery.toLowerCase())) && (
                          <div 
                            onClick={() => setIsAboutMeOpen(true)}
                            className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
                          >
                            <div className={`transition-colors duration-500 ${isDark ? "bg-[#2c2c2e] border-zinc-800" : "bg-white border-zinc-200"} border-2 shadow-md rounded-2xl w-[120px] h-[120px] flex flex-col justify-between p-3 relative mb-2`}>
                              <div className="h-2 bg-orange-500 rounded-sm w-full"></div>
                              <div className="flex flex-col space-y-1.5 py-2 pl-1">
                                <div className={`transition-colors duration-500 h-1 ${isDark ? "bg-slate-700" : "bg-slate-300"} w-2/3 rounded-sm`}></div>
                                <div className={`transition-colors duration-500 h-1 ${isDark ? "bg-slate-800" : "bg-slate-400"} w-5/6 rounded-sm`}></div>
                                <div className={`transition-colors duration-500 h-1 ${isDark ? "bg-slate-700" : "bg-slate-300"} w-4/5 rounded-sm`}></div>
                              </div>
                              <span className="text-[10px] text-orange-500 font-extrabold font-mono text-right pr-0.5">RTF</span>
                            </div>
                            <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} truncate w-full px-1`}>
                              About Me.rtf
                            </span>
                            <span className={`text-[11px] font-mono ${styles.textMuted} mt-1 text-center w-full`}>1.2 KB</span>
                          </div>
                        )}

                        {/* App: Memory */}
                        {(searchQuery === "" || "memory".includes(searchQuery.toLowerCase())) && (
                          <div 
                            onClick={() => setIsMemoryGameOpen(true)}
                            className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
                          >
                            <div className={`w-[120px] h-[120px] bg-blue-300 dark:bg-blue-400 rounded-2xl shadow-sm flex items-center justify-center relative mb-2 border border-black/10`}>
                              <div className="grid grid-cols-2 gap-2 p-1">
                                <div className="w-9 h-9 rounded bg-white shadow-sm border border-white/20"></div>
                                <div className="w-9 h-9 rounded bg-white shadow-sm border border-white/20"></div>
                                <div className="w-9 h-9 rounded bg-white shadow-sm border border-white/20"></div>
                                <div className="w-9 h-9 rounded border-2 border-white border-dashed opacity-80"></div>
                              </div>
                            </div>
                            <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} truncate w-full px-1`}>
                              Memory
                            </span>
                            <span className={`text-[11px] font-mono ${styles.textMuted} mt-1 text-center w-full`}>Application</span>
                          </div>
                        )}

                        {/* App: Music */}
                        {(searchQuery === "" || "music".includes(searchQuery.toLowerCase()) || "apple music".includes(searchQuery.toLowerCase())) && (
                          <div 
                            onClick={() => setIsMusicAppOpen(true)}
                            className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
                          >
                            <div className={`w-[120px] h-[120px] bg-gradient-to-b from-[#df5b69] to-[#b02c3a] rounded-2xl shadow-sm relative mb-2 border border-black/10 overflow-hidden`}>
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="56" 
                                height="56" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                className="text-white drop-shadow-md absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                              >
                                <path d="M9 18V5l12-2v13" />
                                <circle cx="6" cy="18" r="3" fill="currentColor" />
                                <circle cx="18" cy="16" r="3" fill="currentColor" />
                              </svg>
                            </div>
                            <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} truncate w-full px-1`}>
                              Apple Music
                            </span>
                            <span className={`text-[11px] font-mono ${styles.textMuted} mt-1 text-center w-full`}>Application</span>
                          </div>
                        )}

                        {/* App: Contact Me */}
                        {(searchQuery === "" || "contact".includes(searchQuery.toLowerCase()) || "mail".includes(searchQuery.toLowerCase())) && (
                          <div 
                            onClick={() => setIsContactAppOpen(true)}
                            className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
                          >
                            <div className={`w-[120px] h-[120px] bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl shadow-sm flex items-center justify-center relative mb-2 border border-black/10`}>
                              <div className="w-[60px] h-[40px] bg-white rounded-md shadow-sm border border-white/20 relative overflow-hidden">
                                {/* Envelope flap shape */}
                                <div className="absolute top-0 left-0 w-full h-[50%] border-t-[20px] border-l-[30px] border-r-[30px] border-t-slate-200 border-l-transparent border-r-transparent"></div>
                                <div className="absolute top-0 left-0 w-full h-[50%] border-t-[18px] border-l-[28px] border-r-[28px] border-t-white border-l-transparent border-r-transparent pt-px"></div>
                              </div>
                            </div>
                            <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} truncate w-full px-1`}>
                              Contact Me
                            </span>
                            <span className={`text-[11px] font-mono ${styles.textMuted} mt-1 text-center w-full`}>Application</span>
                          </div>
                        )}

                        {/* Dynamic web links */}
                        {filteredOverviewLinks.map((link) => (
                          <div 
                            key={link.id}
                            onClick={() => handleLinkOpen(link.url)}
                            className={`group flex flex-col items-center justify-start p-2.5 rounded-2xl border border-transparent cursor-pointer select-none w-[160px]`}
                          >
                            <div className={`transition-colors duration-500 w-[120px] h-[120px] ${isDark ? "bg-zinc-800/40 border border-white/5" : "bg-slate-100/70 border border-black/5"} rounded-2xl shadow-sm flex items-center justify-center relative mb-2`}>
                              {getLargeLinkIcon(link.iconName, "w-[32px] h-[32px]")}
                            </div>
                            <span className={`text-[15.5px] font-medium text-center ${styles.textMuted} truncate w-full px-1`}>
                              {link.name.split(" ")[0]}.webloc
                            </span>
                            <span className={`text-[11px] font-mono ${styles.textMuted} mt-1 text-center w-full`}>Web URL</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

              </motion.div>
            ) : (
              // ==================== STATE 2: PROJECT CORRESPONDING GALLERY VIEW ====================
              selectedProject && (
                <motion.div 
                  key={selectedProject.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`h-full flex flex-col justify-start min-h-0 ${styles.textSecondary}`}
                >

                  {/* Breadcrumb trail for nested-folder navigation */}
                  <div className="shrink-0 px-3 pt-2 pb-1 flex items-center gap-1 flex-wrap text-[13px]">
                    <button
                      onClick={() => navigateTo("overview")}
                      className={`hover:underline ${styles.textMuted} cursor-pointer`}
                    >
                      Overview
                    </button>
                    {getAncestry(selectedProject.id).map((f, i, arr) => (
                      <React.Fragment key={f.id}>
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${styles.textMutedSubtle}`} />
                        {i === arr.length - 1 ? (
                          <span className={`font-semibold ${styles.textSecondary}`}>{f.name.split(" — ")[0]}</span>
                        ) : (
                          <button
                            onClick={() => navigateTo(f.id)}
                            className={`hover:underline ${styles.textMuted} cursor-pointer`}
                          >
                            {f.name.split(" — ")[0]}
                          </button>
                        )}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Gallery Grid containing the images shown in 4 columns desktop / 2 columns mobile */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full p-2.5">
                    <div className="flex flex-col min-h-full">
                      <div>
                        {selectedProject.description && selectedProject.description.trim() !== "" && selectedProject.description.trim() !== "Description" && selectedProject.description.trim() !== "<p><br></p>" && (
                          <div
                            className={`mb-6 mt-2 px-2 w-full text-sm sm:text-[15px] leading-relaxed break-words whitespace-normal overflow-hidden [&_*]:break-words [&_*]:whitespace-normal [&_*]:max-w-full [&>p]:mb-3 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:ml-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:ml-5 [&>ol]:mb-3 [&>blockquote]:border-l-4 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-3 [&_strong]:font-bold [&_em]:italic [&_u]:underline ${styles.textSecondary}`}
                            dangerouslySetInnerHTML={{ __html: selectedProject.description }}
                          />
                        )}

                        {/* Subfolders are mixed into the gallery (folders first, then files) — Finder-style */}
                        {(childFolders.length > 0 || selectedProject.gallery.length > 0) && (
                          <>
                            {/* Desktop Masonry (4 columns) */}
                            <MasonryGrid
                              columns={4}
                              images={selectedProject.gallery}
                              folders={childFolders}
                              onFolderClick={navigateTo}
                              selectedProjectName={selectedProject.name}
                              imageAspectRatios={imageAspectRatios}
                              textMutedStyle={styles.textMuted}
                              onImageClick={setLightboxIndex}
                              className="hidden md:flex"
                            />

                            {/* Mobile Masonry (2 columns) */}
                            <MasonryGrid
                              columns={2}
                              images={selectedProject.gallery}
                              folders={childFolders}
                              onFolderClick={navigateTo}
                              selectedProjectName={selectedProject.name}
                              imageAspectRatios={imageAspectRatios}
                              textMutedStyle={styles.textMuted}
                              onImageClick={setLightboxIndex}
                              className="flex md:hidden"
                            />
                          </>
                        )}
                      </div>

                      {/* Inherited bottom/footer text — centered, pinned to the very bottom
                          (above the status bar) when the images don't fill the page. */}
                      {(() => {
                        const bottom = getInheritedBottomText(selectedProject);
                        return bottom ? (
                          <div
                            className={`mt-auto pt-10 pb-2 px-4 w-full text-center text-sm sm:text-[15px] leading-relaxed ${styles.textMuted} [&_strong]:font-bold [&_em]:italic [&_u]:underline [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mb-2 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:inline-block [&>ul]:text-left`}
                            dangerouslySetInnerHTML={{ __html: bottom }}
                          />
                        ) : null;
                      })()}
                    </div>
                  </div>

                </motion.div>
              )
            )}
            </AnimatePresence>

          </main>

        </div>

        {/* Header 4: Standard bottom status bar details */}
        <div className={`${styles.statusBarBg} py-3.5 px-6 flex flex-row items-center justify-between gap-3 shrink-0 text-xs sm:text-[13px] select-none shadow-inner`}>
          <div className="hidden sm:flex items-center space-x-2 min-w-0 max-w-full">
            <HardDrive className={`transition-colors duration-500 w-4 h-4 shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
            <span className="font-medium tracking-wide truncate whitespace-nowrap">
              Volume: Jacob's Portfolio SSD
            </span>
            <span className="text-slate-500 px-2">|</span>
            <span className="font-medium tracking-wide whitespace-nowrap text-slate-500">
              {activeSelection === "overview" 
                ? `${filteredOverviewFolders.length + filteredOverviewLinks.length + 4} items`
                : `${(selectedProject?.gallery.length || 0) + childFolders.length} items`}
            </span>
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-4 sm:gap-6 text-right shrink-0">
            <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap flex-1 text-left sm:flex-none sm:text-right shrink-0">
              © {new Date().getFullYear()} Jacob Szczepaniak<span className="hidden sm:inline">. All rights reserved.</span>
            </span>
            
            {/* Theme Toggle Button with Fading effect */}
            <div className={`transition-colors duration-500 flex items-center border-l pl-4 shrink-0 ${isDark ? "border-white/10" : "border-black/10"}`}>
              <button 
                onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
                className={`transition-all duration-150 flex items-center justify-center w-[124px] space-x-1.5 px-3 py-1.5 rounded-full font-semibold cursor-pointer active:scale-95 ${
                  isDark 
                    ? "bg-white/5 text-slate-300 border border-white/5" 
                    : "bg-black/5 text-slate-700 border border-black/10 shadow-3xs"
                }`}
                title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
              >
                {isDark ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow shrink-0" />
                    <span className="text-[10px] uppercase tracking-wider font-sans whitespace-nowrap">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[10px] uppercase tracking-wider font-sans whitespace-nowrap">Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </motion.div>

    </div>
    
    <AnimatePresence>
      {(!isDataLoaded || (about?.bootConfig?.enabled && !bootCompleted)) && (
        <motion.div
          key="boot-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999]"
        >
          {isDataLoaded ? (
            <BootAnimation 
              config={about.bootConfig!} 
              onComplete={() => setBootCompleted(true)} 
            />
          ) : (
            <div className="fixed inset-0 bg-black" />
          )}
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
