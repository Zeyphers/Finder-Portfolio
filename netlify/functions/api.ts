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

router.get("/data", async (req, res) => {
  try {
    const dataStore = getStore("data");
    const data = await dataStore.get("data.json", { type: "json" });
    if (data) {
      res.json(data);
    } else {
      res.json({ PROJECTS: [], EXTERNAL_LINKS: [] });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to read data from Blob storage" });
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

router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  try {
    const originalName = req.file.originalname;
    const ext = originalName.slice((originalName.lastIndexOf(".") - 1 >>> 0) + 2);
    const name = originalName.replace(`.${ext}`, "").replace(/[^a-zA-Z0-9]/g, "-");
    const filename = `${name}-${Date.now()}.${ext}`;
    
    const imageStore = getStore("images");
    await imageStore.set(filename, new Blob([req.file.buffer], { type: req.file.mimetype }), {
      metadata: { contentType: req.file.mimetype }
    });
    
    const url = `/.netlify/functions/api/images/${filename}`;
    
    res.json({ success: true, url: url });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Failed to upload to netlify blobs: " + e.message });
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

export const handler = serverless(app, {
  binary: ['multipart/form-data']
});
