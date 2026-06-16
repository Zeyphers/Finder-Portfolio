import React, { createContext, useContext, useEffect, useState } from "react";
import { Project, ExternalLink, AboutInfo } from "./types";
import defaultData from "./data.json";
import { getApiUrl } from "./api";

interface DataContextType {
  projects: Project[];
  links: ExternalLink[];
  about: AboutInfo;
  refreshData: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({
  projects: defaultData.PROJECTS as any,
  links: defaultData.EXTERNAL_LINKS as any,
  about: defaultData.ABOUT as any,
  refreshData: async () => {}
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(defaultData.PROJECTS as any);
  const [links, setLinks] = useState<ExternalLink[]>(defaultData.EXTERNAL_LINKS as any);
  const [about, setAbout] = useState<AboutInfo>(defaultData.ABOUT as any);

  const refreshData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/data"));
      if (res.ok) {
        const d = await res.json();
        setProjects(d.PROJECTS || []);
        setLinks(d.EXTERNAL_LINKS || []);
        // Handle backwards compatibility if server data doesn't have ABOUT yet
        setAbout(d.ABOUT || defaultData.ABOUT);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DataContext.Provider value={{ projects, links, about, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useAppletData = () => useContext(DataContext);
