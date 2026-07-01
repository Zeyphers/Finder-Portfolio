# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start the full app locally. This runs `tsx server.ts`, an Express server that mounts Vite as middleware (single process serving both the SPA and the `/api/*` routes) on http://localhost:3000. There is no separate `vite dev` — always go through `server.ts`.
- `npm run build` — `vite build` (SPA → `dist/`) **and** esbuild-bundles `server.ts` → `dist/server.cjs`.
- `npm start` — Run the production server bundle (`node dist/server.cjs`).
- `npm run lint` — `tsc --noEmit`. This is the only type/lint check; there is no ESLint and no test suite.
- `npm run preview` — Vite's static preview of `dist/` (no API).

There are no automated tests. Verify changes by running `npm run dev` and exercising the UI, and by running `npm run lint`.

Path alias: `@/*` maps to the repo root (configured in both `vite.config.ts` and `tsconfig.json`).

## Architecture

This is a **portfolio site styled as a macOS Finder desktop environment**. It originated from an AI Studio (Gemini) React template; the `GEMINI_API_KEY`/`APP_URL` env vars and the README banner are template leftovers and are not used by the portfolio itself.

### Two backends, one codebase (the most important thing to understand)

The same set of API endpoints is implemented **twice**, and `src/api.ts` decides which to call based on `window.location.hostname`:

- **`server.ts`** — the Express app used for local dev (`localhost`) and AI Studio Cloud Run (`*.run.app`). Persists `src/data.json` to the local filesystem, and mirrors writes to GitHub via the Contents API so Netlify redeploys.
- **`netlify/functions/api.ts`** — a `serverless-http`-wrapped Express app used on Netlify (any other hostname). Persists to **Netlify Blobs** (`getStore("data")`, `"backups"`, `"images"`, `"chunks"`) instead of the filesystem.

When you change an API route, **change it in both files** or the two environments diverge. The route handlers (`/contact`, `/login`, `/data`, `/upload`, `/backups`, `/image-proxy`) are near-duplicates by design; the auth (`signToken`/`verifyToken` HMAC) and SSRF guard (`isSafeImageUrl`) are copy-pasted between them.

Standalone Netlify functions (v2, not part of the Express app) handle responses that would exceed Lambda's 6 MB buffered-response limit by **streaming**:
- `netlify/functions/data.ts` → streams `data.json` (the client uses this via `getDataUrl()` on Netlify; `/api/data` locally).
- `netlify/functions/image.ts` → streams uploaded images from the `"images"` blob store.
- `netlify/functions/apple-playlist.ts` → the Netlify twin of the Apple Music proxy in `server.ts`.

`netlify.toml` rewrites `/api/*` → `/.netlify/functions/api/:splat` and everything else → `/index.html` (SPA fallback).

### Content model: everything is `data.json`

There is no database. All portfolio content lives in `src/data.json` with top-level keys `PROJECTS`, `EXTERNAL_LINKS`, `ABOUT`, `SIDEBAR` (shapes defined in `src/types.ts`). Note `src/data.ts` is a near-empty legacy seed, **not** the live content — the live content is the JSON file served by the API.

- `DataProvider` (`src/DataContext.tsx`) fetches the data once on mount, exposes it via `useAppletData()`, and **caches each slice in `localStorage`** (`cached_projects`, etc.) so the UI paints instantly on repeat visits before the network resolves. A `fallbackAbout` provides defaults and backfills missing `bootConfig` fields.
- **Folders are Projects.** Nesting is by `Project.parentId` (empty/undefined = top-level). A "folder" and a "project detail" are the same entity rendered differently depending on whether it has children/gallery images.

### Frontend structure

- `src/App.tsx` — Router. `/admin` lazy-loads `AdminPanel`; **every other path** renders the single `Portfolio` component (catch-all `*`). Deep links like `/folder/subfolder/image.png` are parsed from the pathname inside Portfolio, not via distinct routes — this deliberately avoids remounting (and replaying the boot animation) on navigation.
- `src/Portfolio.tsx` (~1300 lines) — The entire Finder UI: draggable/resizable windows, masonry gallery grid, sidebar, folder navigation, image lightbox, light/dark theme. The desktop "apps" are lazy-loaded windows: `TextEditModal`, `MemoryGameApp`, `MusicApp`, `ContactApp`.
- `src/urlSlug.ts` — Bidirectional mapping between the folder/image tree and URL paths. `buildPath` walks the `parentId` ancestry to produce full slugified paths; `resolvePath` walks URL segments back to a `{ project, imageIndex }`. Lookups are intentionally tolerant (case-insensitive, name-or-id, positional-or-filename) so hand-typed and legacy share links still resolve.
- `src/AdminPanel.tsx` (~1600 lines) — CMS at `/admin`. Logs in via `/api/login`, edits the whole `data.json`, and POSTs it back. Large payloads (data and image uploads) are **chunked** client-side and reassembled server-side (see the `chunkIndex`/`totalChunks`/`fileId` handling in both backends). Uses Quill (`react-quill-new`) for rich text.

### Images

Uploaded images are stored in the backend (GitHub repo `portfolio-assets/` for Express, Netlify Blobs for serverless) and referenced by URL in `data.json`. `getImageUrl()` in `src/api.ts` routes any absolute `http(s)` URL through the `/api/image-proxy` endpoint, which adds auth for private GitHub raw URLs and enforces the SSRF allowlist. Prefer `ProgressiveImage` (`src/components/`) for rendering.

### Apple Music

`MusicApp.tsx` does **not** use an Apple embed iframe (that path hit cross-origin/`TypeError` failures — see `HANDOFF.md`). Instead the backend (`/.netlify/functions/apple-playlist` or the Express route) scrapes a short-lived bearer token from `music.apple.com`'s JS bundle, calls `amp-api.music.apple.com`, and returns 30-second preview URLs the app plays directly.

## Environment variables

Auth **fails closed**: `/login` returns 500 unless `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AUTH_SECRET` are all set — there are no default credentials. Other keys: `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO`/`GITHUB_BRANCH` (Express image + data-sync path), `RESEND_API_KEY` (contact email; without it, sends are simulated as success). See `.env.example`.
