import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dns from "dns";
import net from "net";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";

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
// address (cloud metadata, localhost, etc.). `headersFor` decides per-hop request
// headers so credentials are only ever sent to the host they belong to.
async function fetchImageSafely(
  targetUrl: string,
  headersFor?: (u: URL) => Record<string, string> | undefined
): Promise<Response | null> {
  let current = targetUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!(await isSafeImageUrl(current))) return null;
    const parsed = new URL(current);
    const r = await fetch(current, { redirect: "manual", headers: headersFor?.(parsed) });
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    // Public read API: wildcard CORS is fine, but never combined with
    // Allow-Credentials (auth uses Bearer headers, not cookies).
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Accept');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Setup multer for memory storage so we can push to GitHub
  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // Helper to commit and push data.json back to GitHub so Netlify triggers a rebuild
  async function pushDataToGithub(contentString: string): Promise<boolean> {
    const repoOwner = process.env.GITHUB_OWNER || "Zeyphers";
    const repoName = process.env.GITHUB_REPO || "Finder-Portfolio";
    const branch = process.env.GITHUB_BRANCH || "main";
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      console.warn("GitHub token is not configured; skipped pushing data.json to GitHub.");
      return false;
    }

    const filePath = "src/data.json";
    const githubUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

    // Try fetching the existing file's SHA from GitHub
    let sha: string | undefined;
    try {
      const getRes = await fetch(`${githubUrl}?ref=${branch}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "User-Agent": "Portfolio-Admin-Applet"
        }
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        sha = getJson.sha;
      }
    } catch (err) {
      console.warn("Failed to fetch existing sha for data.json from GitHub", err);
    }

    const base64Content = Buffer.from(contentString, "utf-8").toString("base64");

    const putBody: any = {
      message: "Update data.json via Admin Panel",
      content: base64Content,
      branch: branch
    };
    if (sha) {
      putBody.sha = sha;
    }

    const putRes = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Portfolio-Admin-Applet"
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errInfo = await putRes.json();
      console.error("Failed to push data.json to GitHub:", errInfo);
      return false;
    }
    return true;
  }

  // API Routes
  // Simple in-memory rate limiting for server.ts
  const emailRateLimits = new Map<string, number>();

  app.post("/api/contact", async (req, res) => {
    try {
      const dataPath = path.join(process.cwd(), "src/data.json");
      const appData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      const isCooldownDisabled = appData.ABOUT?.disableContactCooldown === true;

      const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
      const now = Date.now();
      
      const lastSent = emailRateLimits.get(ip);
      if (!isCooldownDisabled && lastSent && now - lastSent < 10 * 60 * 1000) {
        return res.status(429).json({ success: false, error: "Please wait 10 minutes before sending another message." });
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
        emailRateLimits.set(ip, now);
        return res.json({ success: true, message: "Email simulated (no API key)" });
      }
      console.log(`[Email API] Key found length: ${RESEND_API_KEY.length}, starting resend...`);

      const { Resend } = await import("resend");
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

      emailRateLimits.set(ip, now);
      res.json({ success: true, message: "Email sent" });
    } catch (err: any) {
      console.error("Error sending contact email:", err);
      res.status(500).json({ success: false, error: err.message || "Internal server error" });
    }
  });

  // Throttle failed logins per IP so credentials can't be brute-forced.
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const LOGIN_WINDOW_MS = 15 * 60 * 1000;
  const LOGIN_MAX_FAILURES = 10;

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const validUser = process.env.ADMIN_USERNAME;
    const validPass = process.env.ADMIN_PASSWORD;

    // Fail closed: no public default credentials, and a signing secret is required.
    if (!validUser || !validPass || !process.env.AUTH_SECRET) {
      return res.status(500).json({ success: false, message: "Server auth is not configured" });
    }

    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
    const now = Date.now();
    let attempts = loginAttempts.get(ip);
    if (attempts && now > attempts.resetAt) attempts = undefined;
    if (attempts && attempts.count >= LOGIN_MAX_FAILURES) {
      return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
    }

    if (safeEqual(username || "", validUser) && safeEqual(password || "", validPass)) {
      loginAttempts.delete(ip);
      res.json({ success: true, token: signToken(username) });
    } else {
      loginAttempts.set(ip, {
        count: (attempts?.count || 0) + 1,
        resetAt: attempts?.resetAt || now + LOGIN_WINDOW_MS,
      });
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

  app.get("/api/data", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const dataPath = path.join(process.cwd(), "src/data.json");
      const data = fs.readFileSync(dataPath, "utf-8");
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  const BACKUPS_DIR = path.join(process.cwd(), "src/backups");

  app.get("/api/backups", requireAuth, (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) return res.json({ success: true, backups: [] });
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      const backups = files.map(f => ({
        id: f,
        timestamp: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs
      })).sort((a, b) => b.timestamp - a.timestamp);
      res.json({ success: true, backups });
    } catch (e) {
      res.status(500).json({ error: "Failed to list backups" });
    }
  });

  app.get("/api/backups/:id", requireAuth, (req, res) => {
    try {
      const backupPath = path.join(BACKUPS_DIR, path.basename(req.params.id));
      if (!fs.existsSync(backupPath)) return res.status(404).json({ error: "Not found" });
      const data = fs.readFileSync(backupPath, "utf-8");
      res.json(JSON.parse(data));
    } catch (e) {
      res.status(500).json({ error: "Failed to read backup" });
    }
  });

  app.delete("/api/backups/:id", requireAuth, (req, res) => {
    try {
      const backupPath = path.join(BACKUPS_DIR, path.basename(req.params.id));
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete backup" });
    }
  });

  app.post("/api/backups", requireAuth, (req, res) => {
    try {
      const dataPath = path.join(process.cwd(), "src/data.json");
      if (!fs.existsSync(dataPath)) return res.status(404).json({ error: "No data to backup" });
      if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      
      const currentData = fs.readFileSync(dataPath, "utf-8");
      const newBackupId = `backup_${Date.now()}.json`;
      fs.writeFileSync(path.join(BACKUPS_DIR, newBackupId), currentData);
      
      res.json({ success: true, backup: { id: newBackupId, timestamp: Date.now() } });
    } catch (e) {
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  const dataChunks = new Map<string, string[]>();

  app.post("/api/data", requireAuth, async (req, res) => {
    try {
      if (req.body && req.body.chunkIndex !== undefined) {
        const { chunkIndex, totalChunks, fileId, chunkData } = req.body;
        
        if (!dataChunks.has(fileId)) {
          dataChunks.set(fileId, new Array(totalChunks));
        }
        
        const chunks = dataChunks.get(fileId)!;
        chunks[chunkIndex] = chunkData;

        if (chunkIndex === totalChunks - 1) {
          const fullDataString = chunks.join("");
          dataChunks.delete(fileId);
          req.body = JSON.parse(fullDataString);
        } else {
          return res.json({ success: true, chunkReceived: true });
        }
      }

      const dataPath = path.join(process.cwd(), "src/data.json");
      const contentString = JSON.stringify(req.body, null, 2);
      fs.writeFileSync(dataPath, contentString);
      
      // Auto Backup Logic
      if (req.body.ABOUT?.autoBackupsEnabled !== false) {
        try {
          const BACKUPS_DIR = path.join(process.cwd(), "src/backups");
          if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
          
          const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
          const backups = files.map(f => ({ id: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs })).sort((a, b) => b.time - a.time);
          
          let shouldBackup = true;
          if (backups.length > 0) {
            const latest = backups[0];
            const intervalHrs = req.body.ABOUT?.autoBackupIntervalHrs !== undefined ? req.body.ABOUT.autoBackupIntervalHrs : 24;
            
            if (intervalHrs === 0) {
              shouldBackup = true; // Every save
            } else if (Date.now() - latest.time < intervalHrs * 60 * 60 * 1000) {
              shouldBackup = false;
            } else {
              const latestData = fs.readFileSync(path.join(BACKUPS_DIR, latest.id), "utf-8");
              if (latestData === contentString) shouldBackup = false;
            }
          }
          if (shouldBackup) {
            fs.writeFileSync(path.join(BACKUPS_DIR, `backup_${Date.now()}.json`), contentString);
          }
          
          const maxBackups = req.body.ABOUT?.maxBackups || 30;
          const updatedFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
          if (updatedFiles.length > maxBackups) {
            const toDelete = updatedFiles.map(f => ({ id: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
              .sort((a, b) => b.time - a.time).slice(maxBackups);
            for (const b of toDelete) fs.unlinkSync(path.join(BACKUPS_DIR, b.id));
          }
        } catch (backupErr) {
          console.error("Auto backup failed:", backupErr);
        }
      }
      
      // Also push directly to GitHub so Netlify triggers a build and is kept in sync
      const githubSuccess = await pushDataToGithub(contentString);
      
      res.json({ success: true, githubSynced: githubSuccess });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Failed to save data: " + e.message });
    }
  });

  const uploadChunks = new Map<string, string[]>();

  app.post("/api/upload", requireAuth, async (req, res) => {
    try {
      if (req.body && req.body.chunkIndex !== undefined) {
        const { chunkIndex, totalChunks, fileId, fileBase64, fileName } = req.body;
        
        if (!uploadChunks.has(fileId)) {
          uploadChunks.set(fileId, new Array(totalChunks));
        }
        
        const fileChunks = uploadChunks.get(fileId)!;
        fileChunks[chunkIndex] = fileBase64;

        if (chunkIndex === totalChunks - 1) {
          const fullBase64 = fileChunks.join("");
          uploadChunks.delete(fileId);
          req.body.fileBase64 = fullBase64;
          req.body.fileName = fileName;
        } else {
          return res.json({ success: true, chunkReceived: true });
        }
      }

      // Determine whether request is base64 JSON (req.body.fileBase64)
      let originalName: string;

      if (req.body && req.body.fileBase64) {
        originalName = req.body.fileName;
      } else {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const ext = path.extname(originalName);
      const name = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, "-");
      const newFilename = `${name}-${Date.now()}${ext}`;
      
      const repoOwner = process.env.GITHUB_OWNER || "Zeyphers";
      const repoName = process.env.GITHUB_REPO || "Finder-Portfolio";
      const branch = process.env.GITHUB_BRANCH || "main";
      const token = process.env.GITHUB_TOKEN;
      
      if (!token) {
        return res.status(500).json({ error: "GitHub token is not configured in environment variables. Please add GITHUB_TOKEN." });
      }

      const filePath = `portfolio-assets/${newFilename}`;
      const githubUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
      
      const base64Content = req.body.fileBase64;
      
      const githubRes = await fetch(githubUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Portfolio-Admin-Applet"
        },
        body: JSON.stringify({
          message: `Upload image ${newFilename} via Admin Panel`,
          content: base64Content,
          branch: branch
        })
      });

      if (!githubRes.ok) {
        const errInfo = await githubRes.json();
        console.error("Github Api Error:", errInfo);
        return res.status(500).json({ error: `GitHub API error: ${errInfo.message}` });
      }
      
      const cdnUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/${filePath}`;

      res.json({ success: true, url: cdnUrl });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Failed to upload to github: " + e.message });
    }
  });

  // Fetch images securely from private repo
  app.get("/api/image-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing url parameter");
    }
    if (!(await isSafeImageUrl(targetUrl))) {
      return res.status(400).send("Blocked URL");
    }

    try {
      // Attach the GitHub token ONLY when the request host is exactly GitHub's
      // raw/API hosts — matching on the URL *string* would let any URL that merely
      // contains "github.com" (e.g. https://evil.com/github.com) receive the token.
      const githubHosts = new Set(["raw.githubusercontent.com", "api.github.com", "github.com"]);
      const headersFor = (u: URL): Record<string, string> | undefined => {
        const token = process.env.GITHUB_TOKEN;
        if (token && githubHosts.has(u.hostname.toLowerCase())) {
          return { "Authorization": `token ${token}` };
        }
        return undefined;
      };

      const upstreamRes = await fetchImageSafely(targetUrl, headersFor);
      if (!upstreamRes) {
        return res.status(400).send("Blocked URL");
      }
      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).send(`Failed to fetch image: ${upstreamRes.statusText}`);
      }

      const contentType = upstreamRes.headers.get("content-type");
      if (!isAllowedImageContentType(contentType)) {
        return res.status(400).send("Blocked content type");
      }
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      const buffer = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e: any) {
      console.error("Image proxy error:", e);
      res.status(500).send("Error fetching image");
    }
  });

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

  let cachedToken: string | null = null;
  let cachedAt = 0;
  const TOKEN_TTL = 1000 * 60 * 60 * 12; // 12h

  async function getAppleMusicToken() {
    if (cachedToken && Date.now() - cachedAt < TOKEN_TTL) return cachedToken;
    const res = await fetch("https://music.apple.com/", {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    const html = await res.text();

    const bundleMatch = html.match(/src="(\/assets\/index~[^"]+\.js)"/);
    if (!bundleMatch) throw new Error('Could not find JS bundle URL in music.apple.com HTML');
    const bundleUrl = 'https://music.apple.com' + bundleMatch[1];

    const jsRes = await fetch(bundleUrl, { headers: { "User-Agent": UA } });
    const js = await jsRes.text();
    
    const tokenMatch = js.match(
      /[a-zA-Z_$]{1,4}="(eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,})"/
    );
    if (!tokenMatch) throw new Error('Could not extract bearer token from JS bundle');
    
    cachedToken = tokenMatch[1];
    cachedAt = Date.now();
    return cachedToken;
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
      `${base}/v1/catalog/${encodeURIComponent(storefront)}/playlists/${encodeURIComponent(id)}?include=tracks&l=en-US`,
      { headers }
    );
    if (!res.ok) throw new Error(`amp-api ${res.status}`);
    const data = await res.json();
    const pl = data.data?.[0];
    if (!pl) throw new Error("Playlist not found");

    let tracks = pl.relationships?.tracks?.data ?? [];
    let next = pl.relationships?.tracks?.next;
    let iterations = 0;
    while (next && tracks.length < 300 && iterations < 5) {
      const r = await fetch(base + next + (next.includes("?") ? "&" : "?") + "l=en-US", { headers });
      if (!r.ok) break;
      const j = await r.json();
      tracks = tracks.concat(j.data ?? []);
      next = j.next;
      iterations++;
    }
    return { pl, tracks };
  }

  app.get("/.netlify/functions/apple-playlist", async (req, res) => {
    const id = req.query.id as string;
    const storefront = (req.query.storefront as string) || "us";
    if (!id) return res.status(400).json({ error: "missing ?id=pl...." });

    try {
      const token = await getAppleMusicToken();
      const { pl, tracks } = await fetchApplePlaylist(storefront, id, token);
      
      res.setHeader("Cache-Control", "private, max-age=0");
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
      res.setHeader("Cache-Control", "no-store");
      res.status(502).json({ error: String(e?.message || e) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
