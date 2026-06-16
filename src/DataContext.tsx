import React, { createContext, useContext, useEffect, useState } from "react";
import { Project, ExternalLink } from "./types";
import defaultData from "./data.json";
import { getApiUrl } from "./api";

interface DataContextType {
  projects: Project[];
  links: ExternalLink[];
  refreshData: () => Promise<void>;
}

export const DataContext = createContext<DataContextType>({
  projects: defaultData.PROJECTS as any,
  links: defaultData.EXTERNAL_LINKS as any,
  refreshData: async () => {}
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(defaultData.PROJECTS as any);
  const [links, setLinks] = useState<ExternalLink[]>(defaultData.EXTERNAL_LINKS as any);

  const refreshData = async () => {
    try {
      const res = await fetch(getApiUrl("/api/data"));
      if (res.ok) {
        const d = await res.json();
        setProjects(d.PROJECTS);
        setLinks(d.EXTERNAL_LINKS);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <DataContext.Provider value={{ projects, links, refreshData }}>
      {children}
    </DataContext.Provider>
  );
}

export const useAppletData = () => useContext(DataContext);
