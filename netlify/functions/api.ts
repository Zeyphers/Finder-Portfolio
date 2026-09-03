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
// The `v` claim is the credential version: the timestamp of the last password
// reset, or 0 while the password is still whatever ADMIN_PASSWORD says. Verifying
// against the current version is what makes a reset strand tokens minted before
// it, so "reset my password" really does sign other devices out. Tokens issued
// before this claim existed carry no `v` and read as 0, so an installation that
// has never been reset doesn't log anyone out just for deploying this.
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(username: string, credVersion: number): string {
  const secret = process.env.AUTH_SECRET || "";
  const payload = Buffer.from(
    JSON.stringify({ u: username, v: credVersion, exp: Date.now() + TOKEN_TTL_MS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token: string, credVersion: number): boolean {
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
    if ((typeof data.v === "number" ? data.v : 0) !== credVersion) return false;
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

// --- Admin password reset (emailed one-time code) ---
// ADMIN_PASSWORD is an environment variable and can't be rewritten at runtime, so
// a reset stores a scrypt-hashed *override* alongside the site's other persisted
// state. Login prefers that override when one exists and falls back to the env
// var otherwise, so a fresh deploy still works before any reset has happened.
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const RESET_MIN_INTERVAL_MS = 60 * 1000; // at most one code a minute...
const RESET_MAX_PER_HOUR = 5;            // ...and never a mailbox flood
const RESET_HOUR_MS = 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

interface StoredSecret { hash: string; salt: string; updatedAt: number }
interface AdminAuthState {
  password?: StoredSecret;
  reset?: { code: StoredSecret; expiresAt: number; attempts: number };
  requests?: number[]; // epoch ms of codes emailed in the last hour
}

function hashSecret(value: string, salt: string): string {
  return crypto.scryptSync(String(value), salt, 64).toString("hex");
}

function makeSecret(value: string): StoredSecret {
  const salt = crypto.randomBytes(16).toString("hex");
  return { hash: hashSecret(value, salt), salt, updatedAt: Date.now() };
}

function secretMatches(secret: StoredSecret | undefined, value: string): boolean {
  if (!secret || !secret.hash || !secret.salt) return false;
  const candidate = Buffer.from(hashSecret(value, secret.salt), "hex");
  const known = Buffer.from(secret.hash, "hex");
  if (candidate.length !== known.length) return false;
  return crypto.timingSafeEqual(candidate, known);
}

// Six digits from a CSPRNG — Math.random() is guessable enough to matter here.
function generateResetCode(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

// The code only ever goes to the hard-coded owner address the contact form uses,
// never to one supplied by the request, so there is no recipient to aim.
function resetCodeEmailHtml(username: string, code: string): string {
  return `
    <div style="font-family: sans-serif;">
      <h2>Portfolio admin password reset</h2>
      <p>Someone asked to reset the password for the portfolio admin panel.</p>
      <p><strong>Username:</strong> ${escapeHtml(username)}</p>
      <p><strong>Confirmation code:</strong></p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px; font-family: monospace;">${escapeHtml(code)}</p>
      <p>It expires in 15 minutes and works once.</p>
      <hr />
      <p style="color: #888; font-size: 12px;">If this wasn't you, ignore this email — the password has not changed.</p>
    </div>
  `;
}

// Trims the request log to the last hour and reports whether another code may go
// out. Throttling is global rather than per-IP on purpose: there is exactly one
// admin mailbox, so spreading requests across IPs must not multiply the emails.
function resetThrottle(requests: number[] | undefined, now: number): { recent: number[]; retryAfterMs: number } {
  const recent = (requests || []).filter((t) => typeof t === "number" && now - t < RESET_HOUR_MS);
  if (recent.length) {
    const last = Math.max(...recent);
    if (now - last < RESET_MIN_INTERVAL_MS) {
      return { recent, retryAfterMs: RESET_MIN_INTERVAL_MS - (now - last) };
    }
    if (recent.length >= RESET_MAX_PER_HOUR) {
      return { recent, retryAfterMs: RESET_HOUR_MS - (now - Math.min(...recent)) };
    }
  }
  return { recent, retryAfterMs: 0 };
}

// The serverless twin persists to Netlify Blobs: a Lambda's filesystem is
// ephemeral and per-instance, so an on-disk override would vanish on a cold
// start and diverge between concurrent instances.
const AUTH_BLOB_KEY = "admin.json";

// A missing key resolves to null — the ordinary pre-reset state, meaning "no
// override". A genuine store failure throws, and is deliberately left to throw:
// reporting an empty state would quietly reinstate ADMIN_PASSWORD and revive
// tokens a reset had just killed, so callers have to fail closed instead.
async function readAdminAuth(): Promise<AdminAuthState> {
  const state = (await getStore("auth").get(AUTH_BLOB_KEY, { type: "json" })) as AdminAuthState | null;
  return state || {};
}

async function credentialVersion(): Promise<number> {
  return (await readAdminAuth()).password?.updatedAt || 0;
}

async function writeAdminAuth(state: AdminAuthState): Promise<void> {
  await getStore("auth").setJSON(AUTH_BLOB_KEY, state);
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

// Shared by /login and /forgot-password: a wrong username on the reset form is a
// failed auth attempt like any other, and counting it here is what caps username
// guessing at the same budget as guessing the password outright.
type Attempts = { count: number; resetAt: number };
const readAuthFailures = async (ip: string, now: number): Promise<Attempts | null> => {
  let attempts: Attempts | null = null;
  try {
    attempts = await getStore("ratelimits").get(loginKey(ip), { type: "json" });
  } catch {
    attempts = null;
  }
  return attempts && now <= attempts.resetAt ? attempts : null;
};
const noteAuthFailure = async (ip: string, now: number, attempts: Attempts | null) => {
  await getStore("ratelimits")
    .setJSON(loginKey(ip), {
      count: (attempts?.count || 0) + 1,
      resetAt: attempts?.resetAt || now + LOGIN_WINDOW_MS,
    })
    .catch(() => {});
};

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
  const attempts = await readAuthFailures(ip, now);
  if (attempts && attempts.count >= LOGIN_MAX_FAILURES) {
    return res.status(429).json({ success: false, message: "Too many attempts. Try again later." });
  }

  // A completed reset supersedes ADMIN_PASSWORD; with no override, the env var
  // stands. If the override can't be read we refuse rather than fall back —
  // otherwise a storage fault would silently re-enable the old password.
  let override: StoredSecret | undefined;
  try {
    override = (await readAdminAuth()).password;
  } catch (e) {
    console.error("[Login] Could not read stored credentials:", e);
    return res.status(500).json({ success: false, message: "Server auth is unavailable" });
  }
  const passwordOk = override
    ? secretMatches(override, password || "")
    : safeEqual(password || "", validPass);

  if (safeEqual(username || "", validUser) && passwordOk) {
    await getStore("ratelimits").delete(loginKey(ip)).catch(() => {});
    res.json({ success: true, token: signToken(username, override?.updatedAt || 0) });
  } else {
    await noteAuthFailure(ip, now, attempts);
    res.status(401).json({ success: false, message: "Invalid credentials" });
  }
});

// Password reset, step 1: mail a one-time code to the owner's address over the
// same Resend path the contact form uses. The recipient is hard-coded, so the
// request body has no say in where the code lands.
router.post("/forgot-password", async (req, res) => {
  const validUser = process.env.ADMIN_USERNAME;
  if (!validUser || !process.env.ADMIN_PASSWORD || !process.env.AUTH_SECRET) {
    return res.status(500).json({ success: false, error: "Server auth is not configured" });
  }
  try {
    const { username } = req.body || {};
    const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
    const now = Date.now();

    // Naming the admin account is the price of admission. It doesn't protect the
    // code itself — that still only ever lands in the owner's inbox — but it stops
    // a passer-by who stumbles onto /admin from putting anything in that inbox at
    // all. A wrong guess burns one of the shared login attempts, so working the
    // username out costs exactly what brute-forcing the password would.
    const attempts = await readAuthFailures(ip, now);
    if (attempts && attempts.count >= LOGIN_MAX_FAILURES) {
      return res.status(429).json({ success: false, error: "Too many attempts. Try again later." });
    }
    if (!safeEqual(String(username || ""), validUser)) {
      await noteAuthFailure(ip, now, attempts);
      return res.status(401).json({ success: false, error: "That isn't the admin username." });
    }

    const state = await readAdminAuth();
    const { recent, retryAfterMs } = resetThrottle(state.requests, now);
    if (retryAfterMs > 0) {
      return res.status(429).json({
        success: false,
        error: `Please wait ${Math.ceil(retryAfterMs / 1000)}s before requesting another code.`,
      });
    }

    const code = generateResetCode();
    const nextState: AdminAuthState = {
      ...state,
      reset: { code: makeSecret(code), expiresAt: now + RESET_CODE_TTL_MS, attempts: 0 },
      requests: [...recent, now],
    };

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      // The contact route simulates a send when the key is missing; a reset code
      // is worthless unless it's visible, so print it to the function log.
      console.warn(`[Reset] No RESEND_API_KEY. Code for "${validUser}" is ${code}`);
      await writeAdminAuth(nextState);
      return res.json({ success: true, simulated: true });
    }

    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "jakeypay@gmail.com",
      subject: "Portfolio Admin: password reset code",
      html: resetCodeEmailHtml(validUser, code),
    });

    if (error) {
      console.error("[Reset] Resend Error:", error);
      return res.status(500).json({ success: false, error: `Resend Error: ${error.name} - ${error.message}` });
    }

    await writeAdminAuth(nextState);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error sending reset code:", err);
    res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
});

// Password reset, step 2: trade the code for a new password.
router.post("/reset-password", async (req, res) => {
  const { code, newPassword } = req.body || {};
  if (!code || !newPassword) {
    return res.status(400).json({ success: false, error: "Code and new password are required." });
  }
  const password = String(newPassword);
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    return res.status(400).json({ success: false, error: `Password must be ${MIN_PASSWORD_LENGTH}-200 characters.` });
  }

  const state = await readAdminAuth();
  const pending = state.reset;
  const now = Date.now();

  if (!pending || now > pending.expiresAt) {
    if (pending) await writeAdminAuth({ ...state, reset: undefined });
    return res.status(400).json({ success: false, error: "That code has expired. Request a new one." });
  }
  if (pending.attempts >= RESET_MAX_ATTEMPTS) {
    await writeAdminAuth({ ...state, reset: undefined });
    return res.status(429).json({ success: false, error: "Too many wrong codes. Request a new one." });
  }
  if (!secretMatches(pending.code, String(code).trim())) {
    await writeAdminAuth({ ...state, reset: { ...pending, attempts: pending.attempts + 1 } });
    return res.status(401).json({ success: false, error: "Incorrect code." });
  }

  // Burn the code in the same write that stores the password so it can't be replayed.
  await writeAdminAuth({ ...state, password: makeSecret(password), reset: undefined });
  res.json({ success: true });
});

const requireAuth = async (req: any, res: any, next: any) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    if (token && verifyToken(token, await credentialVersion())) {
      return next();
    }
  } catch (e) {
    console.error("[Auth] Could not read stored credentials:", e);
  }
  res.status(401).json({ error: "Unauthorized" });
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
