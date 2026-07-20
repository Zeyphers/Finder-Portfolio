import serverless from "serverless-http";
import express from "express";
import cors from "cors";
import { getStore } from "@netlify/blobs";
import multer from "multer";
import defaultData from "../../src/data.json";
import { Resend } from "resend";
import crypto from "crypto";
import dns from "dns";
import net from "net";

// --- Auth: stateless HMAC-signed tokens (no static/guessable token) ---
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(username: string): string {
  const secret = process.env.AUTH_SECRET || "";
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string): boolean {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.exp === "number" && Date.now() <= data.exp;
  } catch {
    return false;
  }
}

// --- SSRF guard: reject internal/private targets for the image proxy ---
function isPrivateIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, "");
  if (net.isIPv4(v)) {
    const [a, b] = v.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (100.64.0.0/10)
    if (a === 192 && b === 0) return true; // 192.0.0.0/24 IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking (198.18.0.0/15)
    if (a >= 224) return true; // multicast + reserved (224.0.0.0/3)
    return false;
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}

async function isSafeImageUrl(targetUrl: string): Promise<boolean> {
  let parsed: URL;
  try { parsed = new URL(targetUrl); } catch { return false; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const { address } = await dns.promises.lookup(host);
    return !isPrivateIp(address);
  } catch {
    return false;
  }
}

// Fetch for the image proxy that does NOT blindly follow redirects: each hop is
// re-validated against the SSRF guard, so a public URL can't 302 to an internal
// address (cloud metadata, localhost, etc.).
async function fetchImageSafely(targetUrl: string): Promise<Response | null> {
  let current = targetUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await isSafeImageUrl(current))) return null;
    const r = await fetch(current, { redirect: "manual" });
    if (r.status >= 300 && r.status < 400) {
      const loc = r.headers.get("location");
      if (!loc) return null;
      current = new URL(loc, current).toString();
      continue;
    }
    return r;
  }
  return null; // too many redirects
}

// The proxy exists to serve images. Refusing to relay text/html & friends stops it
// from being used to serve attacker-controlled pages from this site's own origin.
function isAllowedImageContentType(ct: string | null): boolean {
  if (!ct) return true; // some image hosts omit it; <img> won't execute anything
  const v = ct.split(";")[0].trim().toLowerCase();
  return v.startsWith("image/") || v.startsWith("video/") || v === "application/octet-stream";
}

// Escape user-supplied text before interpolating it into HTML (contact emails).
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Constant-time string comparison (hash first so lengths never short-circuit).
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const app = express();

// Public read API: wildcard CORS is fine, but never combined with
// credentials (auth uses Bearer headers, not cookies).
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
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
    if (String(name).length > 200 || String(contactInfo).length > 200 ||
        String(subject).length > 300 || String(message).length > 5000) {
      return res.status(400).json({ success: false, error: "Message too long." });
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

    // Escape user input so a visitor can't inject their own HTML (links, images,
    // fake content) into the trusted-looking notification email.
    const htmlContent = `
      <div style="font-family: sans-serif;">
        <h2>New message from Portfolio Contact Form</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Contact Info:</strong> ${escapeHtml(contactInfo)}</p>
        <hr />
        <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
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

// Throttle failed logins per IP so credentials can't be brute-forced. Backed by
// the same blob store the contact form uses: an in-memory Map only covers one
// warm Lambda instance, so it resets on every cold start and isn't shared across
// concurrent instances — an attacker spreading requests would sail straight past it.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

const loginKey = (ip: string) => `login_${ip.replace(/[^a-zA-Z0-9]/g, "-")}`;

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  // Fail closed: no public default credentials, and a signing secret is required.
  if (!validUser || !validPass || !process.env.AUTH_SECRET) {
    return res.status(500).json({ success: false, message: "Server auth is not configured" });
  }

  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  const now = Date.now();
  const throttleStore = getStore("ratelimits");
  const key = loginKey(ip);

  let attempts: { count: number; resetAt: number } | null = null;
  try {
    attempts = await throttleStore.get(key, { type: "json" });
  } catch {
    attempts = null;
  }
  if (attempts && now > attempts.resetAt) attempts = null;
  if (attempts && attempts.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
  }

  if (safeEqual(username || "", validUser) && safeEqual(password || "", validPass)) {
    await throttleStore.delete(key).catch(() => {});
    res.json({ success: true, token: signToken(username) });
  } else {
    await throttleStore
      .setJSON(key, {
        count: (attempts?.count || 0) + 1,
        resetAt: attempts?.resetAt || now + LOGIN_WINDOW_MS,
      })
      .catch(() => {});
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

const requireAuth = (req: any, res: any, next: any) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token && verifyToken(token)) {
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

router.get("/backups", requireAuth, async (req, res) => {
  try {
    const backupStore = getStore("backups");
    const { blobs } = await backupStore.list();
    const backups = blobs.map(b => ({
      id: b.key,
      timestamp: parseInt(b.key.split('_')[1]) || 0
    })).sort((a, b) => b.timestamp - a.timestamp);
    res.json({ success: true, backups });
  } catch (e) {
    res.status(500).json({ error: "Failed to list backups" });
  }
});

router.get("/backups/:id", requireAuth, async (req, res) => {
  try {
    const backupStore = getStore("backups");
    const data = await backupStore.get(req.params.id, { type: "json" });
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to read backup" });
  }
});

router.delete("/backups/:id", requireAuth, async (req, res) => {
  try {
    const backupStore = getStore("backups");
    await backupStore.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete backup" });
  }
});

router.post("/backups", requireAuth, async (req, res) => {
  try {
    const dataStore = getStore("data");
    const currentData = await dataStore.get("data.json", { type: "json" });
    if (!currentData) return res.status(404).json({ error: "No data to backup" });
    
    const backupStore = getStore("backups");
    const newBackupId = `backup_${Date.now()}.json`;
    await backupStore.setJSON(newBackupId, currentData);
    
    res.json({ success: true, backup: { id: newBackupId, timestamp: Date.now() } });
  } catch (e) {
    res.status(500).json({ error: "Failed to create backup" });
  }
});

router.post("/data", requireAuth, async (req, res) => {
  try {
    if (req.body && req.body.chunkIndex !== undefined) {
      const { chunkIndex, totalChunks, fileId, chunkData } = req.body;
      const chunkStore = getStore("chunks");
      await chunkStore.set(`data_${fileId}_${chunkIndex}`, chunkData);

      if (chunkIndex === totalChunks - 1) {
        let fullDataString = "";
        for (let i = 0; i < totalChunks; i++) {
          const c = await chunkStore.get(`data_${fileId}_${i}`);
          if (c) fullDataString += c;
        }

        req.body = JSON.parse(fullDataString);

        // cleanup chunks asynchronously
        for (let i = 0; i < totalChunks; i++) {
          chunkStore.delete(`data_${fileId}_${i}`).catch(() => {});
        }
      } else {
        return res.json({ success: true, chunkReceived: true });
      }
    }

    const dataStore = getStore("data");
    await dataStore.setJSON("data.json", req.body);
    
    // Auto Backup Logic
    if (req.body.ABOUT?.autoBackupsEnabled !== false) {
      try {
        const backupStore = getStore("backups");
        const { blobs } = await backupStore.list();
        const backups = blobs.map(b => ({
          id: b.key,
          time: parseInt(b.key.split('_')[1]) || 0
        })).sort((a, b) => b.time - a.time);

        let shouldBackup = true;
        if (backups.length > 0) {
          const latest = backups[0];
          const intervalHrs = req.body.ABOUT?.autoBackupIntervalHrs !== undefined ? req.body.ABOUT.autoBackupIntervalHrs : 24;

          if (intervalHrs === 0) {
            shouldBackup = true; // Every save
          } else if (Date.now() - latest.time < intervalHrs * 60 * 60 * 1000) {
            shouldBackup = false;
          } else {
            const latestData = await backupStore.get(latest.id, { type: "text" });
            if (latestData === JSON.stringify(req.body)) shouldBackup = false;
          }
        }

        if (shouldBackup) {
          const newBackupId = `backup_${Date.now()}.json`;
          await backupStore.setJSON(newBackupId, req.body);
          backups.unshift({ id: newBackupId, time: Date.now() });
        }

        const maxBackups = req.body.ABOUT?.maxBackups || 30;
        if (backups.length > maxBackups) {
          for (const b of backups.slice(maxBackups)) {
            await backupStore.delete(b.id);
          }
        }
      } catch (backupErr) {
        console.error("Auto backup failed:", backupErr);
      }
    }
    
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
    const upstreamRes = await fetchImageSafely(targetUrl);
    if (!upstreamRes) {
      return res.status(400).send("Blocked URL");
    }
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to fetch image`);
    }
    const contentType = upstreamRes.headers.get("content-type");
    if (!isAllowedImageContentType(contentType)) {
      return res.status(400).send("Blocked content type");
    }
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Let the browser and Netlify's CDN cache proxied images so they aren't
    // re-fetched (and the function isn't cold-started) on every visit.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // Netlify's edge only caches function responses when this header is present.
    // Netlify-Vary is required because the image is selected by the ?url= query
    // param — without it the edge would key the cache on the path alone and
    // serve one cached image for every proxied URL.
    res.setHeader("Netlify-CDN-Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Netlify-Vary", "query");
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
