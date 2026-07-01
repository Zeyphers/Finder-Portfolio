// Shareable deep-link URLs: /<folder>[/<subfolder>...]/<image>
//   e.g. /physical_medium/shrimp1.png
//        /o_connell_electric_internship/hydraulic_tower_rig/IMG_1234.jpg
//
// Each folder segment is a slugified project name (full ancestry, so nested
// subfolders are unambiguous). The trailing image segment is the image's
// fileName when present, otherwise its 1-based position in the gallery.
// Lookups are tolerant (case-insensitive, name-or-id) so hand-typed links resolve.
import { Project, GalleryImage } from "./types";

// "Physical Medium " -> "physical_medium"
export const slugifyFolder = (name: string): string =>
  (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "folder";

// URL segment identifying an image within its gallery.
export const imageSegment = (img: GalleryImage | undefined, index: number): string => {
  const fn = (img?.fileName || "").trim();
  return fn || String(index + 1);
};

// Walk the parentId chain to build [root … project].
export const getAncestry = (project: Project, projects: Project[]): Project[] => {
  const chain: Project[] = [];
  const seen = new Set<string>();
  let cur: Project | undefined = project;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? projects.find(p => p.id === cur!.parentId) : undefined;
  }
  return chain;
};

// Build the address-bar path for the current folder (+ optional open image),
// including the full parent chain so subfolders are uniquely addressable.
export const buildPath = (
  project: Project | null,
  imageIndex: number | null,
  projects: Project[]
): string => {
  if (!project) return "/";
  const folderPath = getAncestry(project, projects)
    .map(p => slugifyFolder(p.name))
    .join("/");
  const gallery = project.gallery || [];
  if (imageIndex === null || !gallery[imageIndex]) return `/${folderPath}`;
  return `/${folderPath}/${encodeURIComponent(imageSegment(gallery[imageIndex], imageIndex))}`;
};

// Resolve an image segment to a gallery index. Matches fileName, then 1-based position.
export const resolveImageIndex = (
  seg: string | undefined,
  gallery: GalleryImage[]
): number | null => {
  if (!seg || !gallery || gallery.length === 0) return null;
  const s = decodeURIComponent(seg);
  const byName = gallery.findIndex(
    g => (g.fileName || "").trim().toLowerCase() === s.toLowerCase()
  );
  if (byName >= 0) return byName;
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= gallery.length) return n - 1;
  return null;
};

export interface DeepLinkTarget {
  project: Project | null;
  imageIndex: number | null;
}

// Resolve a full URL pathname to a folder (+ optional image). Segments are walked
// as a folder chain (each a child of the previous); the first trailing segment
// that isn't a folder is treated as an image in the resolved folder.
export const resolvePath = (
  pathname: string,
  projects: Project[]
): DeepLinkTarget => {
  const segments = pathname
    .split("/")
    .map(s => s.trim())
    .filter(Boolean)
    .map(decodeURIComponent);
  if (segments.length === 0) return { project: null, imageIndex: null };

  const childrenOf = (parent: Project | null) =>
    projects.filter(p => (parent ? p.parentId === parent.id : !p.parentId));
  const matchesSlug = (p: Project, seg: string) =>
    slugifyFolder(p.name) === seg || (p.id || "").toLowerCase() === seg;

  let current: Project | null = null;
  let i = 0;
  for (; i < segments.length; i++) {
    const seg = segments[i].toLowerCase();
    let next = childrenOf(current).find(p => matchesSlug(p, seg));
    // Tolerant fallback for the first segment: match any folder by name/id, so
    // older single-segment share links (even to a subfolder) keep working.
    if (!next && current === null) {
      next = projects.find(p => matchesSlug(p, seg));
    }
    if (!next) break;
    current = next;
  }

  let imageIndex: number | null = null;
  if (current && i < segments.length) {
    imageIndex = resolveImageIndex(segments[i], current.gallery);
  }
  return { project: current, imageIndex };
};
