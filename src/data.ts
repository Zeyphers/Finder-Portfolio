import { Project } from "./types";

export interface ExternalLink {
  id: string;
  name: string;
  url: string;
  iconName: string;
}

export const EXTERNAL_LINKS: ExternalLink[] = [
  {
    id: "link-linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com/in/jacob-szczepaniak-109031276/",
    iconName: "linkedin"
  },
  {
    id: "link-[#e1306c]", // matches design style or placeholder ID
    name: "Instagram",
    url: "https://www.instagram.com/jake_jz_/",
    iconName: "instagram"
  },
  {
    id: "link-facebook",
    name: "Facebook",
    url: "https://www.facebook.com/jacob.szczepaniak/",
    iconName: "facebook"
  },
  {
    id: "link-youtube",
    name: "YouTube",
    url: "https://www.youtube.com/@zeypher_863",
    iconName: "youtube"
  }
];

export const PROJECTS: Project[] = [];

export const SIDEBAR_SECTIONS = [
  {
    title: "Projects",
    items: PROJECTS.map(p => ({
      id: p.id,
      name: p.name.split(" — ")[0],
      iconName: "folder"
    }))
  },
  {
    title: "Links",
    items: EXTERNAL_LINKS.map(l => ({
      id: l.id,
      name: l.name,
      iconName: l.iconName
    }))
  }
];
