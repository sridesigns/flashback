"use client";

import { useCallback } from "react";

interface DuetStripProps {
  p1Photos: string[]; // initiator — left side of each frame
  p2Photos: string[]; // partner  — right side of each frame
}

const TOTAL_PHOTOS = 4;

// ─── Canvas helpers ───────────────────────────────────────────────────────────

/** CSS object-fit:cover equivalent for canvas drawImage */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (ir > tr) { sh = img.naturalHeight; sw = sh * tr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
  else         { sw = img.naturalWidth;  sh = sw / tr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Draw a full-frame photo masked with a gradient that fades on one side.
 * fadeDir "right" = photo visible on left, fades to transparent on the right.
 * fadeDir "left"  = photo visible on right, fades to transparent on the left.
 * blendStart / blendEnd are fractions of the frame width (0–1).
 */
function drawWithGradientMask(
  mainCtx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number,
  fadeDir: "right" | "left",
  blendStart = 0.35,
  blendEnd   = 0.65
) {
  const temp = document.createElement("canvas");
  temp.width = w; temp.height = h;
  const tCtx = temp.getContext("2d")!;

  // Draw full photo at frame size
  drawCover(tCtx, img, 0, 0, w, h);

  // Gradient mask: "destination-in" keeps only the opaque gradient parts
  const gx0 = blendStart * w;
  const gx1 = blendEnd   * w;
  const grad = tCtx.createLinearGradient(gx0, 0, gx1, 0);
  if (fadeDir === "right") {
    // Visible on left, fades to transparent on right
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    // Visible on right, fades to transparent on left
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,1)");
  }
  tCtx.globalCompositeOperation = "destination-in";
  tCtx.fillStyle = grad;
  tCtx.fillRect(0, 0, w, h);

  mainCtx.drawImage(temp, x, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function nextStripNumber(): number {
  try {
    const key = "citofoto_strip_count";
    const n = parseInt(localStorage.getItem(key) ?? "0", 10) + 1;
    localStorage.setItem(key, String(n));
    return n;
  } catch {
    return Math.floor(Math.random() * 900) + 100;
  }
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DuetStrip({ p1Photos, p2Photos }: DuetStripProps) {

  const handleDownload = useCallback(async () => {
    // ── Layout (logical px, rendered at 2×) ───────────────────────────────
    const SCALE     = 2;
    const photoW    = 400;   // full frame width (P1+P2 split inside)
    const photoH    = 300;   // 4:3 frame
    const halfW     = photoW / 2; // each person's slice
    const padding   = 20;
    const gap       = 12;
    const headerH   = 72;
    const footerH   = 52;
    const sidebarW  = 32;
    const holeW     = 14;
    const holeH     = 10;
    const holeGap   = 22;
    const borderW   = 4;

    const logW = sidebarW * 2 + padding * 2 + photoW;
    const logH = headerH + padding + TOTAL_PHOTOS * photoH + (TOTAL_PHOTOS - 1) * gap + padding + footerH;

    const canvas = document.createElement("canvas");
    canvas.width  = logW * SCALE;
    canvas.height = logH * SCALE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(SCALE, SCALE);

    const W = logW, H = logH;

    // Background
    ctx.fillStyle = "#181008";
    ctx.fillRect(0, 0, W, H);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "rgba(90,35,10,0.18)");
    bgGrad.addColorStop(0.5, "rgba(0,0,0,0)");
    bgGrad.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Film holes
    const holesCount = Math.floor(H / holeGap);
    for (let i = 0; i < holesCount; i++) {
      const hy = i * holeGap + holeGap / 2 - holeH / 2;
      const hxL = (sidebarW - holeW) / 2;
      const hxR = W - sidebarW + (sidebarW - holeW) / 2;
      ctx.fillStyle = "#0a0600";
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.fill();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, hxL + 1, hy + 1, holeW - 2, 3, 1); ctx.fill();
      roundRect(ctx, hxR + 1, hy + 1, holeW - 2, 3, 1); ctx.fill();
    }

    // Sidebar edge lines
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW, 0); ctx.lineTo(sidebarW, H);
    ctx.moveTo(W - sidebarW, 0); ctx.lineTo(W - sidebarW, H);
    ctx.stroke();

    // Header
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#C9A84C";
    ctx.font = `bold 20px Georgia, "Times New Roman", serif`;
    ctx.fillText("CITOFOTO", W / 2, padding + 20);
    ctx.fillStyle = "#7a5535";
    ctx.font = `600 9px Arial, sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("DUET BOOTH", W / 2, padding + 36);
    ctx.letterSpacing = "0px";

    // Column labels
    const px = sidebarW + padding;
    ctx.fillStyle = "rgba(201,168,76,0.55)";
    ctx.font = `700 9px Arial, sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.textAlign = "left";
    ctx.fillText("PERSON 1", px + 6, padding + 54);
    ctx.textAlign = "right";
    ctx.fillText("PERSON 2", px + photoW - 6, padding + 54);
    ctx.letterSpacing = "0px";

    // Header divider
    ctx.strokeStyle = "rgba(201,168,76,0.20)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, headerH - 2);
    ctx.lineTo(W - sidebarW - padding, headerH - 2);
    ctx.stroke();

    // Load images
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = src;
      });

    let p1Imgs: HTMLImageElement[], p2Imgs: HTMLImageElement[];
    try {
      [p1Imgs, p2Imgs] = await Promise.all([
        Promise.all(p1Photos.map(loadImg)),
        Promise.all(p2Photos.map(loadImg)),
      ]);
    } catch (e) {
      console.error("Failed to load duet images", e);
      return;
    }

    // Draw frames
    for (let i = 0; i < TOTAL_PHOTOS; i++) {
      const frameX = px;
      const frameY = headerH + padding + i * (photoH + gap);

      // Dark frame border
      ctx.fillStyle = "#0e0805";
      ctx.fillRect(frameX - borderW, frameY - borderW, photoW + borderW * 2, photoH + borderW * 2);

      // Clip the whole frame area so nothing bleeds outside
      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, photoW, photoH);
      ctx.clip();

      // P1 — full frame, fades to transparent toward the right
      if (p1Imgs[i]) drawWithGradientMask(ctx, p1Imgs[i], frameX, frameY, photoW, photoH, "right", 0.35, 0.65);
      // P2 — full frame, fades to transparent toward the left (blends over P1)
      if (p2Imgs[i]) drawWithGradientMask(ctx, p2Imgs[i], frameX, frameY, photoW, photoH, "left",  0.35, 0.65);

      ctx.restore();

      // Single radial vignette over the whole merged frame
      const vig = ctx.createRadialGradient(
        frameX + photoW / 2, frameY + photoH / 2, photoH * 0.25,
        frameX + photoW / 2, frameY + photoH / 2, photoH * 0.90
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vig;
      ctx.fillRect(frameX, frameY, photoW, photoH);

      // Frame number badge
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, frameX + 5, frameY + 5, 20, 16, 2); ctx.fill();
      ctx.fillStyle = "#C9A84C";
      ctx.font = `bold 10px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, frameX + 10, frameY + 13);
    }

    // Footer divider
    ctx.strokeStyle = "rgba(201,168,76,0.18)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, H - footerH + 2);
    ctx.lineTo(W - sidebarW - padding, H - footerH + 2);
    ctx.stroke();

    const now = new Date();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#6b4828";
    ctx.font = `10px Arial, sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.fillText("citofoto.vercel.app", W / 2, H - footerH + 20);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#3d2810";
    ctx.font = `9px monospace`;
    ctx.fillText(
      now.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }).toUpperCase(),
      W / 2, H - footerH + 36
    );

    const n        = nextStripNumber();
    const date     = formatDate(now);
    const filename = `CitoFoto_Duet_${n}_${date}.jpg`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }, [p1Photos, p2Photos]);

  // ── JSX — film strip display ──────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Strip */}
      <div
        className="relative bg-film-black rounded-sm shadow-2xl overflow-hidden"
        style={{ width: "min(300px, 90vw)" }}
      >
        {/* Film holes left */}
        <div className="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="film-hole" />)}
        </div>
        {/* Film holes right */}
        <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10">
          {Array.from({ length: 10 }).map((_, i) => <div key={i} className="film-hole" />)}
        </div>

        <div className="mx-5 flex flex-col">
          {/* Header */}
          <div className="text-center py-3 border-b border-warm-brown/20">
            <p className="font-serif text-gold text-sm font-bold tracking-wider uppercase">CitoFoto</p>
            <p className="font-sans text-warm-brown/60 text-[9px] tracking-[0.2em] uppercase mt-0.5">Duet Booth</p>
          </div>

          {/* Frames */}
          <div className="flex flex-col gap-1.5 py-2">
            {Array.from({ length: Math.min(p1Photos.length, p2Photos.length, TOTAL_PHOTOS) }).map((_, i) => (
              <div key={i} className="relative overflow-hidden border border-dark-brown/40" style={{ aspectRatio: "4/3" }}>
                {/*
                  Both images cover the full frame.
                  CSS mask-image creates a soft gradient blend in the centre —
                  no hard line, looks like a single photo taken together.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p1Photos[i]}
                  alt={`Shot ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover bw-photo"
                  style={{
                    maskImage: "linear-gradient(to right, black 35%, transparent 65%)",
                    WebkitMaskImage: "linear-gradient(to right, black 35%, transparent 65%)",
                  }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p2Photos[i]}
                  alt={`Shot ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover bw-photo"
                  style={{
                    maskImage: "linear-gradient(to left, black 35%, transparent 65%)",
                    WebkitMaskImage: "linear-gradient(to left, black 35%, transparent 65%)",
                  }}
                />
                {/* Frame number */}
                <span className="absolute top-1 left-1 bg-black/60 text-gold text-[8px] font-mono font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-10">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center py-2 border-t border-warm-brown/20">
            <p className="font-sans text-warm-brown/40 text-[8px] tracking-widest uppercase">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        className="leather-btn leather-btn-secondary w-full max-w-[300px] font-sans font-semibold text-sm py-3 px-6 rounded-lg flex items-center justify-center gap-2"
      >
        <DownloadIcon />
        Save Duet Strip
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
