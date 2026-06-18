import React, { createContext, useContext, useEffect, useState } from "react";
import { Project, ExternalLink, AboutInfo, SidebarItem } from "./types";
import defaultData from "./data.json";
import { getApiUrl } from "./api";

interface DataContextType {
  projects: Project[];
  links: ExternalLink[];
  about: AboutInfo;
  sidebar: SidebarItem[];
  refreshData: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({
  projects: defaultData.PROJECTS as any,
  links: defaultData.EXTERNAL_LINKS as any,
  about: defaultData.ABOUT as any,
  sidebar: (defaultData as any).SIDEBAR || [],
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
  const [projects, setProjects] = useState<Project[]>(defaultData.PROJECTS as any);
  const [links, setLinks] = useState<ExternalLink[]>(() => {
    const rawLinks = (defaultData.EXTERNAL_LINKS || []) as any[];
    return rawLinks.map(l => ({ ...l, name: cleanLinkName(l.name) }));
  });
  const [about, setAbout] = useState<AboutInfo>(defaultData.ABOUT as any);
  const [sidebar, setSidebar] = useState<SidebarItem[]>((defaultData as any).SIDEBAR || []);

  const refreshData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/data"));
      if (res.ok) {
        const d = await res.json();
        setProjects(d.PROJECTS || []);
        
        const rawLinks = (d.EXTERNAL_LINKS || []) as any[];
        const cleanedLinks = rawLinks.map(l => ({ ...l, name: cleanLinkName(l.name) }));
        setLinks(cleanedLinks);
        
        // Handle backwards compatibility if server data doesn't have ABOUT or SIDEBAR yet
        setAbout(d.ABOUT || defaultData.ABOUT);
        setSidebar(d.SIDEBAR || (defaultData as any).SIDEBAR || []);
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
