export interface ExternalLink {
  id: string;
  name: string;
  url: string;
  iconName: string;
}

export interface GalleryImage {
  url: string;
  caption: string;
  isVideo?: boolean;
  videoUrl?: string;
  fileName?: string;
  processInfoHtml?: string;
}

export interface Project {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  longDescription: string;
  client: string;
  year: string;
  demoUrl?: string;
  behanceUrl?: string;
  tags: string[];
  imageUrl: string;
  folderIconImage?: string;
  parentId?: string; // id of the containing folder; empty/undefined = top-level
  features: string[];
  gallery: GalleryImage[];
  wordpressCode: {
    customPostType: string;
    acfFields: string;
    phpQuery: string;
    instructions: string;
  };
}

export interface BootConfig {
  enabled: boolean;
  durationMs: number;
  audioUrl?: string;
  appleLogoUrl?: string;
  invertAppleLogo?: boolean;
}

export interface AboutInfo {
  name: string;
  title: string;
  established: string;
  location: string;
  intro: string;
  bio: string;
  contact: string;
  signoff: string;
  tabIconUrl?: string;
  disableContactCooldown?: boolean;
  autoBackupIntervalHrs?: number;
  bootConfig?: BootConfig;
}

export interface SidebarItem {
  id: string; // unique ID for the sidebar entry itself
  type: "project" | "link" | "title";
  name: string; // display name
  targetId?: string; // ID of the Project or ExternalLink (if applicable)
  iconName?: string; // used for links or custom folders
}

export interface SidebarConfig {
  items: SidebarItem[];
}

