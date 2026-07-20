import { Project } from "./types";
import { getImageUrl } from "./api";

// Quill embeds pasted and dropped images straight into the HTML as base64 data
// URIs, and that HTML is stored verbatim in data.json. Seven pasted screenshots
// were enough to grow the stored payload to 6.3 MB — past Lambda's buffered
// response limit — which took the /api/data route down with it.
//
// These helpers move the bytes into the image store the rest of the site already
// uses and leave a plain URL behind. The rendered markup is unchanged apart from
// the src, so nothing about how a page looks or behaves changes.

export type UploadFn = (file: File) => Promise<string>;

export interface ExtractStats {
  uploaded: number;
  bytesSaved: number;
}

const EXT_BY_SUBTYPE: Record<string, string> = {
  jpeg: "jpg",
  jpg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  avif: "avif",
  bmp: "bmp",
  "svg+xml": "svg",
};

// Built fresh per call: a shared /g regex carries lastIndex between callers.
const dataUriPattern = () => /data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})/g;

/** Every distinct base64 image embedded in `html`. */
export const findInlineImages = (html?: string): string[] => {
  if (!html) return [];
  return Array.from(new Set(html.match(dataUriPattern()) || []));
};

export const countProjectInlineImages = (projects: Project[]): number =>
  projects.reduce(
    (total, project) =>
      total +
      (project.gallery || []).reduce(
        (n, image) => n + findInlineImages(image.processInfoHtml).length,
        0
      ),
    0
  );

const slugify = (value: string) =>
  (value || "process")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "process";

export const dataUriToFile = (dataUri: string, nameHint: string): File => {
  const commaAt = dataUri.indexOf(",");
  const meta = dataUri.slice(0, commaAt);
  const base64 = dataUri.slice(commaAt + 1);

  const subtype = (meta.match(/data:image\/([a-zA-Z0-9.+-]+)/)?.[1] || "png").toLowerCase();
  const extension = EXT_BY_SUBTYPE[subtype] || "png";

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return new File([bytes], `${nameHint}.${extension}`, { type: `image/${subtype}` });
};

/**
 * Uploads each embedded image and swaps the data URI for its hosted URL.
 * Replaces the URI string wherever it occurs rather than rewriting the <img>
 * tag, so sizing set by blot-formatter and any other attributes survive intact.
 */
export const extractInlineImagesFromHtml = async (
  html: string,
  upload: UploadFn,
  nameHint = "process-image"
): Promise<{ html: string; stats: ExtractStats }> => {
  const found = findInlineImages(html);
  if (found.length === 0) return { html, stats: { uploaded: 0, bytesSaved: 0 } };

  let result = html;
  let uploaded = 0;
  let bytesSaved = 0;

  for (let i = 0; i < found.length; i++) {
    const dataUri = found[i];
    const file = dataUriToFile(dataUri, `${slugify(nameHint)}-${Date.now()}-${i}`);
    const hostedUrl = await upload(file);
    result = result.split(dataUri).join(getImageUrl(hostedUrl));
    uploaded++;
    bytesSaved += dataUri.length;
  }

  return { html: result, stats: { uploaded, bytesSaved } };
};

/**
 * Same treatment across every gallery item. Returns new objects and leaves the
 * input untouched, so a failed upload can't leave half-rewritten state behind.
 */
export const extractProjectInlineImages = async (
  projects: Project[],
  upload: UploadFn,
  onProgress?: (message: string) => void
): Promise<{ projects: Project[]; stats: ExtractStats }> => {
  const total = countProjectInlineImages(projects);
  if (total === 0) return { projects, stats: { uploaded: 0, bytesSaved: 0 } };

  let uploaded = 0;
  let bytesSaved = 0;
  const nextProjects: Project[] = [];

  for (const project of projects) {
    const gallery = project.gallery || [];
    if (!gallery.some(image => findInlineImages(image.processInfoHtml).length > 0)) {
      nextProjects.push(project);
      continue;
    }

    const nextGallery = [];
    for (let index = 0; index < gallery.length; index++) {
      const image = gallery[index];
      if (findInlineImages(image.processInfoHtml).length === 0) {
        nextGallery.push(image);
        continue;
      }

      onProgress?.(`Moving embedded images out of "${project.name}" (${uploaded + 1} of ${total})…`);
      const { html, stats } = await extractInlineImagesFromHtml(
        image.processInfoHtml!,
        upload,
        project.name
      );
      uploaded += stats.uploaded;
      bytesSaved += stats.bytesSaved;
      nextGallery.push({ ...image, processInfoHtml: html });
    }

    nextProjects.push({ ...project, gallery: nextGallery });
  }

  return { projects: nextProjects, stats: { uploaded, bytesSaved } };
};
