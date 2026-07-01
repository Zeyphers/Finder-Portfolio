// Shareable deep-link URLs: /<folder>/<image>
//   e.g. /physical_medium/shrimp1.png
//
// A folder segment is the slugified project name; an image segment is the
// image's fileName when present, otherwise its 1-based position in the gallery.
// Lookups are tolerant (case-insensitive, name-or-id) so hand-typed links resolve.
import { Project, GalleryImage } from "./types";

// "Physical Medium" -> "physical_medium"
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

// Build the address-bar path for the current folder (+ optional open image).
export const buildPath = (
  project: Project | null,
  imageIndex: number | null
): string => {
  if (!project) return "/";
  const folder = slugifyFolder(project.name);
  const gallery = project.gallery || [];
  if (imageIndex === null || !gallery[imageIndex]) return `/${folder}`;
  return `/${folder}/${encodeURIComponent(imageSegment(gallery[imageIndex], imageIndex))}`;
};

// Resolve a folder slug to a project. Matches slugified name first, then id.
export const resolveFolder = (
  slug: string | undefined,
  projects: Project[]
): Project | null => {
  if (!slug) return null;
  const s = decodeURIComponent(slug).toLowerCase();
  return (
    projects.find(p => slugifyFolder(p.name) === s) ||
    projects.find(p => (p.id || "").toLowerCase() === s) ||
    projects.find(p => slugifyFolder(p.id) === s) ||
    null
  );
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
