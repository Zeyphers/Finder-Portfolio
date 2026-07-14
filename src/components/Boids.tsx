import React, { useEffect, useRef } from "react";
import { BootConfig } from "../types";

interface BoidsProps {
  config: BootConfig;
}

// Same Apple mark used by the boot animation, so the flock matches the boot logo
// when no custom logo is configured.
const APPLE_SVG_PATH =
  "M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8 273.7 0 318.5 13.3 408 55.4 466.8 75.4 494.7 99.3 512 127 512c26.5 0 38.6-16.7 70.8-16.7 32 0 42.9 16.7 71 16.7 27.6 0 50.8-16.8 70.2-44.6 23.3-33 34-66.2 34.6-67.6-1.5-.7-54.6-20.9-54.9-130.5M211.3 103.5c19.3-23.7 31.9-55.8 28.5-88-26.3 1-59 16.6-79.3 40.8-17.8 21.2-32 54.7-27.8 86.4 29.5 2.2 61-14.8 78.6-39.2z";

// Rasterizable data URL for the built-in Apple logo so it can be drawn to canvas.
function appleLogoDataUrl(invert: boolean): string {
  const fill = invert ? "#000000" : "#ffffff";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 384 512'><path fill='${fill}' d='${APPLE_SVG_PATH}'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// A little flock of boot logos that fly around the desktop *outside* the Finder
// window, bouncing off the window and the screen edges. Toggled by the Konami
// code in Portfolio. Canvas-based so it stays smooth with the whole flock.
export default function Boids({ config }: BoidsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // The boid sprite is the boot logo. Custom logos may be cross-origin — we
    // only ever *draw* (never read pixels back), so we skip crossOrigin to avoid
    // breaking loads on hosts without CORS headers; a tainted canvas is fine here.
    const customLogo = !!config.appleLogoUrl;
    const img = new Image();
    let imgReady = false;
    img.onload = () => { imgReady = true; };
    img.src = config.appleLogoUrl || appleLogoDataUrl(!!config.invertAppleLogo);
    // Built-in logo bakes the inversion into the SVG fill; a custom logo is
    // inverted at draw time with a canvas filter (matching the boot animation).
    const invertCustom = customLogo && !!config.invertAppleLogo;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // --- Tuning ---
    const N = 200;
    const SIZE = 30;          // sprite bounding size in px
    const MAX_SPEED = 2.7;
    const MIN_SPEED = 1.1;
    const PERCEPTION = 95;    // neighbour radius for alignment/cohesion
    const ALIGN = 0.05;
    const COH = 0.0009;
    // No separation force by design: the boids don't interact with (or avoid)
    // each other — they pass straight through, kept together only by flocking.
    const EDGE = 46;          // soft turn-around margin at the screen edge
    const EDGE_FORCE = 0.5;
    const AVOID = 70;         // soft repulsion band around the window
    const AVOID_FORCE = 0.9;

    const boids: Boid[] = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      boids.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
      });
    }

    const getWindowRect = (): { left: number; top: number; right: number; bottom: number } | null => {
      const el = document.getElementById("finder-window");
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // When the window fills the viewport (mobile) there's no margin to fly in;
      // treat it as no obstacle so the flock still roams instead of jamming edges.
      if (r.left <= 2 && r.top <= 2 && r.right >= W - 2 && r.bottom >= H - 2) return null;
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };

    let raf = 0;
    const frame = () => {
      const rect = getWindowRect();

      for (const b of boids) {
        let alignX = 0, alignY = 0, cohX = 0, cohY = 0;
        let neighbours = 0;

        for (const o of boids) {
          if (o === b) continue;
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          const d = Math.hypot(dx, dy);
          if (d < PERCEPTION) {
            alignX += o.vx; alignY += o.vy;
            cohX += o.x; cohY += o.y;
            neighbours++;
          }
        }

        let ax = 0, ay = 0;
        if (neighbours > 0) {
          alignX /= neighbours; alignY /= neighbours;
          ax += (alignX - b.vx) * ALIGN;
          ay += (alignY - b.vy) * ALIGN;
          cohX /= neighbours; cohY /= neighbours;
          ax += (cohX - b.x) * COH;
          ay += (cohY - b.y) * COH;
        }

        // Soft repulsion from the Finder window (steer around it before colliding).
        if (rect) {
          const cx = Math.max(rect.left, Math.min(b.x, rect.right));
          const cy = Math.max(rect.top, Math.min(b.y, rect.bottom));
          const dx = b.x - cx;
          const dy = b.y - cy;
          const d = Math.hypot(dx, dy);
          if (d > 0 && d < AVOID) {
            const f = ((AVOID - d) / AVOID) * AVOID_FORCE;
            ax += (dx / d) * f;
            ay += (dy / d) * f;
          }
        }

        // Soft turn-around at the screen edges.
        if (b.x < EDGE) ax += ((EDGE - b.x) / EDGE) * EDGE_FORCE;
        else if (b.x > W - EDGE) ax -= ((b.x - (W - EDGE)) / EDGE) * EDGE_FORCE;
        if (b.y < EDGE) ay += ((EDGE - b.y) / EDGE) * EDGE_FORCE;
        else if (b.y > H - EDGE) ay -= ((b.y - (H - EDGE)) / EDGE) * EDGE_FORCE;

        b.vx += ax;
        b.vy += ay;

        // Clamp speed so the flock stays lively but controlled.
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, sp));
        b.vx = (b.vx / sp) * clamped;
        b.vy = (b.vy / sp) * clamped;

        b.x += b.vx;
        b.y += b.vy;

        // Hard bounce off the window: if a boid ends up inside, eject it out the
        // nearest edge and reflect that velocity component.
        if (rect && b.x > rect.left && b.x < rect.right && b.y > rect.top && b.y < rect.bottom) {
          const dl = b.x - rect.left;
          const dr = rect.right - b.x;
          const dt = b.y - rect.top;
          const db = rect.bottom - b.y;
          const m = Math.min(dl, dr, dt, db);
          if (m === dl) { b.x = rect.left; b.vx = -Math.abs(b.vx); }
          else if (m === dr) { b.x = rect.right; b.vx = Math.abs(b.vx); }
          else if (m === dt) { b.y = rect.top; b.vy = -Math.abs(b.vy); }
          else { b.y = rect.bottom; b.vy = Math.abs(b.vy); }
        }

        // Hard bounce off the viewport edges.
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx); }
        else if (b.x > W) { b.x = W; b.vx = -Math.abs(b.vx); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy); }
        else if (b.y > H) { b.y = H; b.vy = -Math.abs(b.vy); }
      }

      // --- Draw ---
      ctx.clearRect(0, 0, W, H);
      const ar = imgReady && img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : 384 / 512;
      let dw = SIZE, dh = SIZE;
      if (ar >= 1) dh = SIZE / ar; else dw = SIZE * ar;
      ctx.filter = invertCustom ? "invert(1)" : "none";
      for (const b of boids) {
        if (imgReady) {
          ctx.drawImage(img, b.x - dw / 2, b.y - dh / 2, dw, dh);
        } else {
          ctx.beginPath();
          ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.fill();
        }
      }
      ctx.filter = "none";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [config.appleLogoUrl, config.invertAppleLogo]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
