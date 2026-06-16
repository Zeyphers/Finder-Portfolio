import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import { getStore } from "@netlify/blobs";
import multer from "multer";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true
}));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME || "jake";
  const validPass = process.env.ADMIN_PASSWORD || "DexHan101";
  
  if (username === validUser && password === validPass) {
    res.json({ success: true, token: "admin-token-123" });
  } else {
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

const requireAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization;
  if (token === "Bearer admin-token-123") {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

import defaultData from "../../src/data.json";

router.get("/data", async (req, res) => {
  try {
    const dataStore = getStore("data");
    const ObjectData = await dataStore.get("data.json", { type: "json" });
    if (ObjectData) {
      if (!ObjectData.EXTERNAL_LINKS || ObjectData.EXTERNAL_LINKS.length === 0) {
        ObjectData.EXTERNAL_LINKS = defaultData.EXTERNAL_LINKS;
      }
      res.json(ObjectData);
    } else {
      res.json(defaultData);
    }
  } catch (e) {
    console.error("Failed to read from Blob storage, falling back to default.", e);
    res.json(defaultData);
  }
});

router.post("/data", requireAuth, async (req, res) => {
  try {
    const dataStore = getStore("data");
    await dataStore.setJSON("data.json", req.body);
    res.json({ success: true, blobed: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Failed to save data to Blob storage", details: e.message || String(e), name: e.name });
  }
});

router.post("/upload", requireAuth, async (req, res) => {
  const { fileName, fileType, fileData } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: "No file data uploaded" });
  }
  
  try {
    const originalName = fileName;
    const ext = originalName.slice((originalName.lastIndexOf(".") - 1 >>> 0) + 2);
    const name = originalName.replace(`.${ext}`, "").replace(/[^a-zA-Z0-9]/g, "-");
    const newFilename = `${name}-${Date.now()}.${ext}`;
    
    // fileData is a dataURL like "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
    const base64String = fileData.split(",")[1];
    const bufferArray = Buffer.from(base64String, "base64");
    
    const imageStore = getStore("images");
    await imageStore.set(newFilename, new Blob([bufferArray], { type: fileType }), {
      metadata: { contentType: fileType }
    });
    
    const url = `/.netlify/functions/api/images/${newFilename}`;
    console.log(`Successfully uploaded: ${url}`);
    
    res.json({ success: true, url: url });
  } catch (e: any) {
    console.error("Upload error details:", e);
    res.status(500).json({ error: "Failed to upload to netlify blobs: " + (e.message || String(e)) });
  }
});

router.get("/images/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const imageStore = getStore("images");
    
    const ibuffer = await imageStore.get(filename, { type: "arrayBuffer" });
    if (!ibuffer) {
      return res.status(404).send("Image not found");
    }
    
    const buffer = Buffer.from(ibuffer);

    
    res.setHeader("Content-Type", "image/" + filename.split('.').pop()?.replace('jpg', 'jpeg') || "application/octet-stream");
    res.send(buffer);
  } catch (e: any) {
    console.error("Image fetch error:", e);
    res.status(500).send("Error fetching image");
  }
});

router.get("/image-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }
  
  if (targetUrl.startsWith("/.netlify/functions/api/images/")) {
     res.redirect(targetUrl);
     return;
  }
  
  try {
    const upstreamRes = await fetch(targetUrl);
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to fetch image`);
    }
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    res.status(500).send("Error proxying image");
  }
});

// Mount the router under both the /api and /.netlify/functions/api paths
app.use("/api", router);
app.use("/.netlify/functions/api", router);

const expressHandler = serverless(app, {
  binary: ['*/*']
});

import { connectLambda } from "@netlify/blobs";

export const handler = async (event: any, context: any) => {
  try {
    connectLambda(event);
  } catch (e) {
    console.error("Failed to connectLambda:", e);
  }
  return expressHandler(event, context);
};
