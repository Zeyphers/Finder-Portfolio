import { getStore } from "@netlify/blobs";

export default async (req: Request, context: any) => {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const filename = pathParts[pathParts.length - 1];
    
    if (!filename) {
      return new Response("Missing filename", { status: 400 });
    }

    const imageStore = getStore("images");
    
    // Check if the blob exists
    const hasBlob = await imageStore.getMetadata(filename);
    if (!hasBlob) {
      return new Response("Image not found", { status: 404 });
    }

    // Get the blob as a stream to avoid 6MB AWS Lambda payload memory limits!
    const blobStream = await imageStore.get(filename, { type: "stream" });
    
    if (!blobStream) {
      return new Response("Image not found", { status: 404 });
    }
    
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                        ext === 'gif' ? 'image/gif' :
                        ext === 'png' ? 'image/png' :
                        ext === 'webp' ? 'image/webp' :
                        `image/${ext}`;
    
    return new Response(blobStream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        // Cache-Control only reaches the browser; this one tells Netlify's edge to
        // cache the response too, so each image invokes the function once per edge
        // node instead of once per visitor.
        "Netlify-CDN-Cache-Control": "public, max-age=31536000, immutable"
      }
    });

  } catch (err: any) {
    console.error("V2 Image stream error:", err);
    return new Response("Server error when fetching image", { status: 500 });
  }
};

export const config = {
  path: "/.netlify/functions/image/:filename"
};
