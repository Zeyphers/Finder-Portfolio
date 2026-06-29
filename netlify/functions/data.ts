import { getStore } from "@netlify/blobs";
import defaultData from "../../src/data.json";

// Streams the stored data.json straight to the client. Streaming responses are NOT
// subject to the 6 MB function-response limit that the buffered /api/data handler hits
// once the data (e.g. large folder icons) grows past 6 MB. Mirrors netlify/functions/image.ts.
export default async (_req: Request, _context: any) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const store = getStore("data");
    const stream = await store.get("data.json", { type: "stream" });
    if (stream) {
      return new Response(stream, { headers });
    }
    // No blob yet — fall back to the bundled default data.
    return new Response(JSON.stringify(defaultData), { headers });
  } catch (e) {
    console.error("data stream error:", e);
    return new Response(JSON.stringify(defaultData), { headers });
  }
};

export const config = {
  path: "/.netlify/functions/data",
};
