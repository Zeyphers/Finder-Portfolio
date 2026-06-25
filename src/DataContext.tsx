import React, { createContext, useContext, useEffect, useState } from "react";
import { Project, ExternalLink, AboutInfo, SidebarItem } from "./types";
import { getApiUrl } from "./api";

interface DataContextType {
  projects: Project[];
  links: ExternalLink[];
  about: AboutInfo;
  sidebar: SidebarItem[];
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
    textSpeedMs: 50,
    audioUrl: "https://froods.ca/~dschaub/AppleSounds/Startup/StartupIntelT2Mac.wav",
  }
};

export const DataContext = createContext<DataContextType>({
  projects: [],
  links: [],
  about: fallbackAbout,
  sidebar: [],
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [about, setAbout] = useState<AboutInfo>(fallbackAbout);
  const [sidebar, setSidebar] = useState<SidebarItem[]>([]);

  const refreshData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/data"), { cache: "no-store" });
      if (res.ok) {
        const d = await res.json();
        setProjects(d.PROJECTS || []);
        
        const rawLinks = (d.EXTERNAL_LINKS || []) as any[];
        const cleanedLinks = rawLinks.map(l => ({ ...l, name: cleanLinkName(l.name) }));
        setLinks(cleanedLinks);
        
        // Handle backwards compatibility if server data doesn't have ABOUT or SIDEBAR yet
        setAbout({
          ...fallbackAbout,
          ...(d.ABOUT || {}),
          bootConfig: {
            ...fallbackAbout.bootConfig,
            ...(d.ABOUT?.bootConfig || {})
          }
        });
        setSidebar(d.SIDEBAR || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DataContext.Provider value={{ projects, links, about, sidebar, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useAppletData = () => useContext(DataContext);
