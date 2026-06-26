import React, { createContext, useContext, useEffect, useState } from "react";
import { Project, ExternalLink, AboutInfo, SidebarItem } from "./types";
import { getApiUrl } from "./api";

interface DataContextType {
  projects: Project[];
  links: ExternalLink[];
  about: AboutInfo;
  sidebar: SidebarItem[];
  isDataLoaded: boolean;
  refreshData: () => Promise<void>;
}

const fallbackAbout: AboutInfo = {
  name: "Zeyphers",
  title: "Full-Stack Developer",
  established: "2026",
  location: "United States",
  intro: "Hello! I am a full-stack developer.",
  bio: "This is my bio.",
  contact: "jakeypay@gmail.com",
  signoff: "Best, Zeyphers",
  disableContactCooldown: false,
  bootConfig: {
    enabled: true,
    durationMs: 5000,
    audioUrl: "https://froods.ca/~dschaub/AppleSounds/Startup/StartupIntelT2Mac.wav",
  }
};

const safeGetItem = (key: string) => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};

const safeSetItem = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch (e) {}
};

const getInitialAbout = (): AboutInfo => {
  const cached = safeGetItem('cached_about');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return {
        ...fallbackAbout,
        ...parsed,
        bootConfig: {
          ...fallbackAbout.bootConfig,
          ...(parsed.bootConfig || {})
        }
      };
    } catch (e) {}
  }
  return fallbackAbout;
};

export const DataContext = createContext<DataContextType>({
  projects: [],
  links: [],
  about: fallbackAbout,
  sidebar: [],
  isDataLoaded: false,
  refreshData: async () => {}
});

const cleanLinkName = (name: string) => {
  if (!name) return "";
  return name
    .replace(/\s+profile$/i, "")
    .replace(/\s+channel$/i, "")
    .trim();
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(() => {
    const cached = safeGetItem('cached_projects');
    return cached ? JSON.parse(cached) : [];
  });
  const [links, setLinks] = useState<ExternalLink[]>(() => {
    const cached = safeGetItem('cached_links');
    return cached ? JSON.parse(cached) : [];
  });
  const [about, setAbout] = useState<AboutInfo>(getInitialAbout);
  const [sidebar, setSidebar] = useState<SidebarItem[]>(() => {
    const cached = safeGetItem('cached_sidebar');
    return cached ? JSON.parse(cached) : [];
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const refreshData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/data"), { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        
        setProjects(d.PROJECTS || []);
        safeSetItem('cached_projects', JSON.stringify(d.PROJECTS || []));
        
        const rawLinks = (d.EXTERNAL_LINKS || []) as any[];
        const cleanedLinks = rawLinks.map(l => ({ ...l, name: cleanLinkName(l.name) }));
        setLinks(cleanedLinks);
        safeSetItem('cached_links', JSON.stringify(cleanedLinks));
        
        // Handle backwards compatibility if server data doesn't have ABOUT or SIDEBAR yet
        const newAbout = {
          ...fallbackAbout,
          ...(d.ABOUT || {}),
          bootConfig: {
            ...fallbackAbout.bootConfig,
            ...(d.ABOUT?.bootConfig || {})
          }
        };
        setAbout(newAbout);
        safeSetItem('cached_about', JSON.stringify(newAbout));
        
        setSidebar(d.SIDEBAR || []);
        safeSetItem('cached_sidebar', JSON.stringify(d.SIDEBAR || []));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDataLoaded(true);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DataContext.Provider value={{ projects, links, about, sidebar, isDataLoaded, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useAppletData = () => useContext(DataContext);
