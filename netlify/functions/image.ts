import { getStore } from "@netlify/blobs";
import { parseByteRange } from "../lib/range";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  // Video-tile preview clips (see make_previews.py in the admin panel).
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
};

// Cache-Control only reaches the browser; the Netlify-CDN one tells Netlify's
// edge to cache the response too, so each file invokes the function once per
// edge node instead of once per visitor.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "Netlify-CDN-Cache-Control": "public, max-age=31536000, immutable",
};

export default async (req: Request, context: any) => {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const filename = pathParts[pathParts.length - 1];

    if (!filename) {
      return new Response("Missing filename", { status: 400 });
    }

    const ext = (filename.split('.').pop() || '').toLowerCase();
    const contentType = CONTENT_TYPES[ext] || `image/${ext}`;
    const imageStore = getStore("images");

    // Video and audio must answer byte-range requests: Safari (and so every
    // iPhone) won't play a <video> unless its `Range: bytes=0-1` probe gets a
    // 206 back. Preview clips are a few hundred KB, so reading the whole blob
    // and slicing it is cheap.
    if (contentType.startsWith("video/") || contentType.startsWith("audio/")) {
      const body = await imageStore.get(filename, { type: "arrayBuffer" });
      if (!body) {
        return new Response("File not found", { status: 404 });
      }
      const size = body.byteLength;
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      };
      const range = parseByteRange(req.headers.get("range"), size);
      if (range === "unsatisfiable") {
        return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
      }
      // Key the edge cache on Range too, or a cached 2-byte probe answer could
      // be served to a request for the whole file.
      const cached = { ...headers, ...CACHE_HEADERS, "Netlify-Vary": "header=Range" };
      if (range) {
        return new Response(body.slice(range.start, range.end + 1), {
          status: 206,
          headers: { ...cached, "Content-Range": `bytes ${range.start}-${range.end}/${size}` },
        });
      }
      return new Response(body, { headers: cached });
    }

    // Images: stream the blob to avoid 6MB AWS Lambda payload memory limits.
    // A missing key resolves to null, so no separate existence check is needed.
    const blobStream = await imageStore.get(filename, { type: "stream" });
    if (!blobStream) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response(blobStream, {
      headers: { "Content-Type": contentType, ...CACHE_HEADERS },
    });

  } catch (err: any) {
    console.error("V2 Image stream error:", err);
    return new Response("Server error when fetching image", { status: 500 });
  }
};

export const config = {
  path: "/.netlify/functions/image/:filename"
};
