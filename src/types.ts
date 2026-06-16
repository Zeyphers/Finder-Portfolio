export interface GalleryImage {
  url: string;
  caption: string;
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
  features: string[];
  gallery: GalleryImage[];
  wordpressCode: {
    customPostType: string;
    acfFields: string;
    phpQuery: string;
    instructions: string;
  };
}

export interface SidebarItem {
  id: string;
  name: string;
  iconName: string;
  count?: number;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}
