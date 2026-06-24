import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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

      emailRateLimits.set(ip, now);
      res.json({ success: true, message: "Email sent" });
    } catch (err: any) {
      console.error("Error sending contact email:", err);
      res.status(500).json({ success: false, error: err.message || "Internal server error" });
    }
  });

  app.post("/api/login", (req, res) => {
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

  const dataChunks = new Map<string, string[]>();

  app.post("/api/data", requireAuth, async (req, res) => {
    try {
      if (req.body && req.body.chunkIndex !== undefined) {
        const { chunkIndex, totalChunks, fileId, chunkString } = req.body;
        
        if (!dataChunks.has(fileId)) {
          dataChunks.set(fileId, new Array(totalChunks));
        }
        
        const fileChunksArray = dataChunks.get(fileId)!;
        fileChunksArray[chunkIndex] = chunkString;

        if (chunkIndex === totalChunks - 1) {
          const fullString = fileChunksArray.join("");
          dataChunks.delete(fileId);
          
          const jsonData = JSON.parse(fullString);
          const dataPath = path.join(process.cwd(), "src/data.json");
          const contentString = JSON.stringify(jsonData, null, 2);
          fs.writeFileSync(dataPath, contentString);
          
          const githubSuccess = await pushDataToGithub(contentString);
          return res.json({ success: true, githubSynced: githubSuccess });
        } else {
          return res.json({ success: true, chunkReceived: true });
        }
      }

      const dataPath = path.join(process.cwd(), "src/data.json");
      const contentString = JSON.stringify(req.body, null, 2);
      fs.writeFileSync(dataPath, contentString);
      
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
    
    try {
      const fetchOptions: RequestInit = {};
      
      // If it's a github raw URL, authenticate the request with the backend token
      if (targetUrl.startsWith("https://raw.githubusercontent.com/") || targetUrl.includes("github.com")) {
        const token = process.env.GITHUB_TOKEN;
        if (token) {
          fetchOptions.headers = {
            "Authorization": `token ${token}`
          };
        }
      }
      
      const upstreamRes = await fetch(targetUrl, fetchOptions);
      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).send(`Failed to fetch image: ${upstreamRes.statusText}`);
      }
      
      const contentType = upstreamRes.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
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
