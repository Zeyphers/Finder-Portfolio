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
          if (Date.now() - latest.time < 24 * 60 * 60 * 1000) {
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

  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  let cachedToken: string | null = null;
  let cachedAt = 0;
  const TOKEN_TTL = 1000 * 60 * 60 * 12; // 12h

  async function getAppleMusicToken() {
    if (cachedToken && Date.now() - cachedAt < TOKEN_TTL) return cachedToken;
    const res = await fetch("https://music.apple.com/us/browse", { headers: { "User-Agent": UA } });
    const html = await res.text();

    const assets = [...html.matchAll(/\/assets\/[^"']*?\.js/g)].map((m) => m[0]);
    assets.sort((a, b) => Number(b.includes("index")) - Number(a.includes("index")));

    for (const path of assets.slice(0, 6)) {
      const jsRes = await fetch("https://music.apple.com" + path, { headers: { "User-Agent": UA } });
      const js = await jsRes.text();
      const jwt = js.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      if (jwt) {
        cachedToken = jwt[0];
        cachedAt = Date.now();
        return cachedToken;
      }
    }
    throw new Error("Could not extract Apple Music token");
  }

  const fmtArt = (a: any) =>
    a?.url
      ? a.url.replace(/\{w\}/, "300").replace(/\{h\}/, "300").replace(/\{c\}/, "bb").replace(/\{f\}/, "jpg")
      : "";

  async function fetchApplePlaylist(storefront: string, id: string, token: string) {
    const base = "https://amp-api.music.apple.com";
    const headers = {
      Authorization: `Bearer ${token}`,
      Origin: "https://music.apple.com",
      Referer: "https://music.apple.com/",
      "User-Agent": UA,
    };
    const res = await fetch(
      `${base}/v1/catalog/${storefront}/playlists/${id}?include=tracks&l=en-US`,
      { headers }
    );
    if (!res.ok) throw new Error(`amp-api ${res.status}`);
    const data = await res.json();
    const pl = data.data?.[0];
    if (!pl) throw new Error("Playlist not found");

    let tracks = pl.relationships?.tracks?.data ?? [];
    let next = pl.relationships?.tracks?.next;
    while (next && tracks.length < 300) {
      const r = await fetch(base + next + (next.includes("?") ? "&" : "?") + "l=en-US", { headers });
      if (!r.ok) break;
      const j = await r.json();
      tracks = tracks.concat(j.data ?? []);
      next = j.next;
    }
    return { pl, tracks };
  }

router.get("/apple-playlist", async (req, res) => {
    const id = req.query.id as string;
    const storefront = (req.query.storefront as string) || "us";
    if (!id) return res.status(400).json({ error: "missing ?id=pl...." });

    try {
      const token = await getAppleMusicToken();
      const { pl, tracks } = await fetchApplePlaylist(storefront, id, token);
      
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.json({
        name: pl.attributes?.name ?? "Playlist",
        artwork: fmtArt(pl.attributes?.artwork),
        tracks: tracks
          .filter((t: any) => t.type === "songs")
          .map((t: any) => ({
            id: t.id,
            name: t.attributes?.name,
            artist: t.attributes?.artistName,
            album: t.attributes?.albumName,
            artwork: fmtArt(t.attributes?.artwork),
            previewUrl: t.attributes?.previews?.[0]?.url ?? "",
            durationInMillis: t.attributes?.durationInMillis ?? 0,
          }))
          .filter((t: any) => t.previewUrl),
      });
    } catch (e: any) {
      console.error("Apple Playlist error:", e);
      res.status(502).json({ error: String(e?.message || e) });
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
