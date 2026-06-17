import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import { getStore } from "@netlify/blobs";
import multer from "multer";
import defaultData from "../../src/data.json";
import { Resend } from "resend";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage });

const router = express.Router();

router.post("/contact", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
    const now = Date.now();
    
    let isCooldownDisabled = false;
    const dataStore = getStore("data");
    const ObjectData = await dataStore.get("data.json", { type: "json" }) as any;
    if (ObjectData && ObjectData.ABOUT?.disableContactCooldown === true) {
      isCooldownDisabled = true;
    } else {
      if ((defaultData as any)?.ABOUT?.disableContactCooldown === true) {
        isCooldownDisabled = true;
      }
    }

    const rateLimitStore = getStore("ratelimits");
    const lastSentStr = await rateLimitStore.get(ip, { type: "text" });
    if (!isCooldownDisabled && lastSentStr) {
      const lastSent = parseInt(lastSentStr, 10);
      if (now - lastSent < 10 * 60 * 1000) {
        return res.status(429).json({ success: false, error: "Please wait 10 minutes before sending another message." });
      }
    }

    const { subject, message, name, contactInfo } = req.body;
    if (!subject || !message || !name || !contactInfo) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }

    console.log(`[Email API] Request received: ${name} <${contactInfo}> - ${subject}`);
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.warn("[Email API] No RESEND_API_KEY found, simulating successful email send.");
      await rateLimitStore.set(ip, now.toString());
      return res.json({ success: true, message: "Email simulated (no API key)" });
    }
    console.log(`[Email API] Key found length: ${RESEND_API_KEY.length}, starting resend...`);

    const resend = new Resend(RESEND_API_KEY);

    const htmlContent = `
      <div style="font-family: sans-serif;">
        <h2>New message from Portfolio Contact Form</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Contact Info:</strong> ${contactInfo}</p>
        <hr />
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${message}</p>
      </div>
    `;

    console.log(`[Email API] Sending payload...`);
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "jakeypay@gmail.com",
      subject: `Portfolio Contact: ${subject}`,
      html: htmlContent,
    });
    console.log(`[Email API] Payload sent. Response data: `, data, ` error: `, error);

    if (error) {
      console.error("[Email API] Resend Error:", error);
      return res.status(500).json({ success: false, error: `Resend Error: ${error.name} - ${error.message}` });
    }

    await rateLimitStore.set(ip, now.toString());
    res.json({ success: true, message: "Email sent" });
  } catch (err: any) {
    console.error("Error sending contact email:", err);
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
});

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
  try {
    if (req.body && req.body.chunkIndex !== undefined) {
      const { chunkIndex, totalChunks, fileId, fileBase64, fileName, mimeType } = req.body;
      const chunkStore = getStore("chunks");
      await chunkStore.set(`${fileId}_${chunkIndex}`, fileBase64);

      if (chunkIndex === totalChunks - 1) {
        let fullBase64 = "";
        for (let i = 0; i < totalChunks; i++) {
          const c = await chunkStore.get(`${fileId}_${i}`);
          if (c) fullBase64 += c;
        }

        req.body.fileBase64 = fullBase64;
        req.body.fileName = fileName;
        req.body.mimeType = mimeType;

        // cleanup chunks asynchronously
        for (let i = 0; i < totalChunks; i++) {
          chunkStore.delete(`${fileId}_${i}`).catch(() => {});
        }
      } else {
        return res.json({ success: true, chunkReceived: true });
      }
    }

    let base64String: string;
    let originalName: string;
    let mimeType: string;

    if (req.body && req.body.fileBase64) {
      base64String = req.body.fileBase64;
      originalName = req.body.fileName;
      mimeType = req.body.mimeType;
    } else {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    const ext = originalName.slice((originalName.lastIndexOf(".") - 1 >>> 0) + 2);
    const name = originalName.replace(`.${ext}`, "").replace(/[^a-zA-Z0-9]/g, "-");
    const newFilename = `${name}-${Date.now()}.${ext}`;
    
    // Decode base64 to buffer, then to ArrayBuffer
    const buffer = Buffer.from(base64String, 'base64');
    const bufferArray = new Uint8Array(buffer).buffer;
    
    const imageStore = getStore("images");
    await imageStore.set(newFilename, bufferArray, {
      metadata: { contentType: mimeType }
    });
    
    const url = `/.netlify/functions/image/${newFilename}`;
    console.log(`Successfully uploaded: ${url}`);
    
    res.json({ success: true, url: url });
  } catch (e: any) {
    console.error("Upload error details:", e);
    res.status(500).json({ error: "Failed to upload to netlify blobs: " + (e.message || String(e)) });
  }
});

router.get("/images/:filename", async (req, res) => {
  const filename = req.params.filename;
  res.redirect(301, `/.netlify/functions/image/${filename}`);
});

router.get("/image-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }
  
  if (targetUrl.startsWith("/.netlify/functions/image/") || targetUrl.startsWith("/.netlify/functions/api/images/")) {
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
  binary: [
    'image/*',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/vnd.microsoft.icon',
    'image/x-icon',
    'image/svg+xml',
    'multipart/form-data',
    'application/octet-stream'
  ]
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
