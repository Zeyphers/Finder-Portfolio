// Client-side full-site backup: one zip = data.json + every uploaded asset.
//
// Everything runs in the browser against the *existing* API surface
// (`/api/image-proxy` to read assets, `/api/upload` to write them), so it works
// identically on localhost (Express) and Netlify without any backend changes,
// and a restore never touches the live database — it only fills the admin
// panel's editor state, which the user persists with "Save Changes".
import JSZip from "jszip";
import { sanitizeProjectsHtml } from "./sanitizeHtml";
import { getImageUrl } from "./api";

export interface SiteData {
  PROJECTS: any[];
  EXTERNAL_LINKS?: any[];
  ABOUT: any;
  SIDEBAR?: any[];
}

interface ManifestAsset {
  /** Path of the file inside the zip, e.g. "images/hero-123.png" */
  path: string;
  /** The exact URL string as it appears in data.json */
  url: string;
  mimeType?: string;
}

interface Manifest {
  version: 1;
  exportedAt: string;
  assets: ManifestAsset[];
  /** Asset URLs we could not download at export time (kept as-is on restore). */
  failed: string[];
}

export type ProgressFn = (message: string, done: number, total: number) => void;

// ---------------------------------------------------------------------------
// Asset collection
// ---------------------------------------------------------------------------

// Collect every *uploaded asset* URL referenced by the site data. This is
// field-based on purpose: generic "any http string" walking would sweep up
// web links (demoUrl, behanceUrl, EXTERNAL_LINKS[].url, videoUrl) that must
// never be bundled or rewritten.
export function collectAssetUrls(data: SiteData): string[] {
  const urls = new Set<string>();
  const add = (u: unknown) => {
    if (typeof u === "string" && u.trim() && !u.startsWith("data:")) urls.add(u);
  };

  for (const p of data.PROJECTS || []) {
    add(p.imageUrl);
    add(p.folderIconImage);
    for (const g of p.gallery || []) add(g.url); // videoUrl is a YouTube link, not an asset
  }
  const about = data.ABOUT || {};
  add(about.tabIconUrl);
  add(about.errorSoundUrl);
  add(about.bootConfig?.audioUrl);
  add(about.bootConfig?.appleLogoUrl);

  return [...urls];
}

// Derive a readable, unique zip filename from an asset URL.
function zipNameForUrl(url: string, index: number, mimeType?: string): string {
  let base = "";
  try {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
    base = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    /* fall through to generic name */
  }
  base = base.replace(/[^a-zA-Z0-9._-]/g, "-") || "asset";
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(base)) {
    // No extension in the URL — infer from the mime type so image viewers work.
    const ext = (mimeType || "").split("/")[1]?.split("+")[0];
    if (ext) base = `${base}.${ext}`;
  }
  // Prefix with the index so repeated filenames from different URLs can't collide.
  return `images/${String(index + 1).padStart(3, "0")}_${base}`;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportSiteZip(data: SiteData, onProgress: ProgressFn): Promise<{ blob: Blob; failed: string[] }> {
  const zip = new JSZip();
  const assetUrls = collectAssetUrls(data);
  const manifest: Manifest = { version: 1, exportedAt: new Date().toISOString(), assets: [], failed: [] };

  for (let i = 0; i < assetUrls.length; i++) {
    const url = assetUrls[i];
    onProgress(`Downloading asset ${i + 1} of ${assetUrls.length}…`, i, assetUrls.length + 1);
    try {
      // Absolute URLs go through the image proxy (auth for private GitHub raws,
      // no CORS issues); site-relative URLs (Netlify blob images) fetch directly.
      const fetchUrl = url.startsWith("http") ? getImageUrl(url) : url;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const mimeType = res.headers.get("content-type") || blob.type || undefined;
      const path = zipNameForUrl(url, i, mimeType);
      zip.file(path, blob);
      manifest.assets.push({ path, url, mimeType });
    } catch (err) {
      console.warn(`Backup export: failed to fetch asset ${url}`, err);
      manifest.failed.push(url);
    }
  }

  zip.file("data.json", JSON.stringify(data, null, 2));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  onProgress("Compressing zip…", assetUrls.length, assetUrls.length + 1);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { blob, failed: manifest.failed };
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

// Deep-clone `value`, replacing any string that exactly matches an old asset
// URL with its re-uploaded replacement. Covers every field without having to
// enumerate them (and can't touch partial matches inside longer strings).
function rewriteUrls<T>(value: T, urlMap: Map<string, string>): T {
  if (typeof value === "string") {
    return (urlMap.get(value) ?? value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(v => rewriteUrls(v, urlMap)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteUrls(v, urlMap);
    }
    return out as T;
  }
  return value;
}

export interface RestoreResult {
  data: SiteData;
  uploaded: number;
  failed: string[];
}

/**
 * Read a backup zip, re-upload every bundled asset through the provided
 * uploader (the admin panel's existing chunked `/api/upload` helper), and
 * return the site data with all asset URLs rewritten to the new uploads.
 * Assets that fail to upload keep their original URL.
 */
export async function importSiteZip(
  file: File,
  uploadFile: (file: File) => Promise<string>,
  onProgress: ProgressFn
): Promise<RestoreResult> {
  const zip = await JSZip.loadAsync(file);

  const dataEntry = zip.file("data.json");
  if (!dataEntry) throw new Error("Invalid backup: data.json not found in zip.");
  const data = JSON.parse(await dataEntry.async("string")) as SiteData;
  if (!Array.isArray(data.PROJECTS) || !data.ABOUT) {
    throw new Error("Invalid backup: data.json is missing PROJECTS/ABOUT.");
  }
  // A zip is untrusted input — it can come from anywhere, and the checks above
  // only prove the shape is right, not that the rich text is safe. Strip script
  // and friends before any of it reaches the site.
  data.PROJECTS = sanitizeProjectsHtml(data.PROJECTS);

  const manifestEntry = zip.file("manifest.json");
  const manifest: Manifest | null = manifestEntry ? JSON.parse(await manifestEntry.async("string")) : null;
  const assets = manifest?.assets ?? [];

  const urlMap = new Map<string, string>();
  const failed: string[] = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    onProgress(`Uploading asset ${i + 1} of ${assets.length}…`, i, assets.length);
    const entry = zip.file(asset.path);
    if (!entry) {
      failed.push(asset.url);
      continue;
    }
    try {
      const blob = await entry.async("blob");
      const fileName = asset.path.split("/").pop() || "asset";
      const upload = new File([blob], fileName, { type: asset.mimeType || blob.type || "application/octet-stream" });
      const newUrl = await uploadFile(upload);
      urlMap.set(asset.url, newUrl);
    } catch (err) {
      console.warn(`Backup restore: failed to upload asset ${asset.path}`, err);
      failed.push(asset.url);
    }
  }

  return { data: rewriteUrls(data, urlMap), uploaded: urlMap.size, failed };
}
