"use client";

import { useCallback } from "react";

interface DuetStripProps {
  p1Photos: string[]; // initiator — left side
  p2Photos: string[]; // partner  — right side
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
    // ── Layout constants ──────────────────────────────────────────────────────
    const SCALE    = 2;
    const frameW   = 440;   // total frame width (P1 + P2 side by side)
    const frameH   = 220;   // 2:1 ratio — each half is square-ish portrait
    const halfW    = frameW / 2;
    const padding  = 20;
    const gap      = 10;
    const headerH  = 64;
    const footerH  = 48;
    const sidebarW = 28;
    const holeW    = 12;
    const holeH    = 8;
    const holeGap  = 20;

    const logW = sidebarW * 2 + padding * 2 + frameW;
    const logH = headerH + padding + TOTAL_PHOTOS * frameH + (TOTAL_PHOTOS - 1) * gap + padding + footerH;

    const canvas = document.createElement("canvas");
    canvas.width  = logW * SCALE;
    canvas.height = logH * SCALE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(SCALE, SCALE);

    const W = logW, H = logH;

    // ── Background: warm off-white ────────────────────────────────────────────
    ctx.fillStyle = "#F5F1EB";
    ctx.fillRect(0, 0, W, H);

    // Subtle warm gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "rgba(196,83,26,0.04)");
    bgGrad.addColorStop(1, "rgba(61,35,20,0.06)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Sidebar strips (slightly darker) ─────────────────────────────────────
    ctx.fillStyle = "rgba(61,35,20,0.06)";
    ctx.fillRect(0, 0, sidebarW, H);
    ctx.fillRect(W - sidebarW, 0, sidebarW, H);

    // Sidebar edge lines
    ctx.strokeStyle = "rgba(61,35,20,0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW, 0); ctx.lineTo(sidebarW, H);
    ctx.moveTo(W - sidebarW, 0); ctx.lineTo(W - sidebarW, H);
    ctx.stroke();

    // ── Film holes ────────────────────────────────────────────────────────────
    const holesCount = Math.floor(H / holeGap);
    for (let i = 0; i < holesCount; i++) {
      const hy  = i * holeGap + holeGap / 2 - holeH / 2;
      const hxL = (sidebarW - holeW) / 2;
      const hxR = W - sidebarW + (sidebarW - holeW) / 2;
      ctx.fillStyle = "#F5F1EB";
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.fill();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.fill();
      ctx.strokeStyle = "rgba(61,35,20,0.2)";
      ctx.lineWidth = 0.5;
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.stroke();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.stroke();
    }

    // ── Header ────────────────────────────────────────────────────────────────
    const px = sidebarW + padding;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#3D2314";
    ctx.font = `bold 18px Georgia, "Times New Roman", serif`;
    ctx.fillText("CitoFoto", W / 2, padding + 18);

    ctx.fillStyle = "#8B5E3C";
    ctx.font = `600 8px Arial, sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("DUET BOOTH", W / 2, padding + 34);
    ctx.letterSpacing = "0px";

    // Person labels
    ctx.font = `700 8px Arial, sans-serif`;
    ctx.letterSpacing = "1.5px";
    ctx.fillStyle = "rgba(61,35,20,0.35)";
    ctx.textAlign = "left";
    ctx.fillText("PERSON 1", px + 4, padding + 52);
    ctx.textAlign = "right";
    ctx.fillText("PERSON 2", px + frameW - 4, padding + 52);
    ctx.letterSpacing = "0px";

    // Header divider
    ctx.strokeStyle = "rgba(61,35,20,0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, headerH - 4);
    ctx.lineTo(W - sidebarW - padding, headerH - 4);
    ctx.stroke();

    // ── Load images ───────────────────────────────────────────────────────────
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

    // ── Draw frames ───────────────────────────────────────────────────────────
    for (let i = 0; i < TOTAL_PHOTOS; i++) {
      const frameX = px;
      const frameY = headerH + padding + i * (frameH + gap);

      // Frame background (light grey placeholder)
      ctx.fillStyle = "#E8E3DA";
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // P1 — left half, clipped precisely
      if (p1Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p1Imgs[i], frameX, frameY, halfW, frameH);
        ctx.restore();
      }

      // P2 — right half, clipped precisely
      if (p2Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX + halfW, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p2Imgs[i], frameX + halfW, frameY, halfW, frameH);
        ctx.restore();
      }

      // Soft seam at center (white-to-transparent 4px each side)
      const seamGrad = ctx.createLinearGradient(frameX + halfW - 4, 0, frameX + halfW + 4, 0);
      seamGrad.addColorStop(0, "rgba(245,241,235,0)");
      seamGrad.addColorStop(0.5, "rgba(245,241,235,0.55)");
      seamGrad.addColorStop(1, "rgba(245,241,235,0)");
      ctx.fillStyle = seamGrad;
      ctx.fillRect(frameX + halfW - 4, frameY, 8, frameH);

      // Radial vignette per half (keeps edges dark, centres bright)
      for (const [hx, hw] of [[frameX, halfW], [frameX + halfW, halfW]] as [number, number][]) {
        const vig = ctx.createRadialGradient(hx + hw / 2, frameY + frameH / 2, frameH * 0.15, hx + hw / 2, frameY + frameH / 2, frameH * 0.85);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.22)");
        ctx.fillStyle = vig;
        ctx.fillRect(hx, frameY, hw, frameH);
      }

      // Frame border
      ctx.strokeStyle = "rgba(61,35,20,0.18)";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(frameX, frameY, frameW, frameH);

      // Frame number badge
      ctx.fillStyle = "rgba(61,35,20,0.55)";
      roundRect(ctx, frameX + 5, frameY + 5, 18, 14, 2); ctx.fill();
      ctx.fillStyle = "#F5F1EB";
      ctx.font = `bold 9px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, frameX + 9, frameY + 12);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(61,35,20,0.10)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, H - footerH + 2);
    ctx.lineTo(W - sidebarW - padding, H - footerH + 2);
    ctx.stroke();

    const now = new Date();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#8B5E3C";
    ctx.font = `9px Arial, sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.fillText("citofoto.vercel.app", W / 2, H - footerH + 18);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "rgba(61,35,20,0.3)";
    ctx.font = `8px monospace`;
    ctx.fillText(
      now.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }).toUpperCase(),
      W / 2, H - footerH + 32
    );

    // ── Download ──────────────────────────────────────────────────────────────
    const n        = nextStripNumber();
    const date     = formatDate(now);
    const filename = `CitoFoto_Duet_${n}_${date}.jpg`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }, [p1Photos, p2Photos]);

  // ── JSX — film strip preview ──────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* Strip */}
      <div
        className="relative rounded-sm shadow-2xl overflow-hidden border border-dark-brown/15"
        style={{ width: "min(320px, 92vw)", background: "#F5F1EB" }}
      >
        {/* Film holes left */}
        <div className="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10"
             style={{ background: "rgba(61,35,20,0.06)", borderRight: "0.5px solid rgba(61,35,20,0.12)" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-2.5 h-1.5 rounded-sm border border-dark-brown/20"
                 style={{ background: "#F5F1EB" }} />
          ))}
        </div>
        {/* Film holes right */}
        <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10"
             style={{ background: "rgba(61,35,20,0.06)", borderLeft: "0.5px solid rgba(61,35,20,0.12)" }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-2.5 h-1.5 rounded-sm border border-dark-brown/20"
                 style={{ background: "#F5F1EB" }} />
          ))}
        </div>

        <div className="mx-5 flex flex-col">
          {/* Header */}
          <div className="text-center py-3 border-b border-dark-brown/12">
            <p className="font-serif text-dark-brown text-sm font-bold tracking-wider">CitoFoto</p>
            <p className="font-sans text-warm-brown/50 text-[9px] tracking-[0.2em] uppercase mt-0.5">Duet Booth</p>
          </div>

          {/* Person labels */}
          <div className="flex pt-1.5 pb-0.5">
            <span className="flex-1 text-center font-sans text-[8px] text-dark-brown/30 uppercase tracking-widest">
              Person 1
            </span>
            <span className="flex-1 text-center font-sans text-[8px] text-dark-brown/30 uppercase tracking-widest">
              Person 2
            </span>
          </div>

          {/* Frames */}
          <div className="flex flex-col gap-1.5 pb-2">
            {Array.from({ length: Math.min(p1Photos.length, p2Photos.length, TOTAL_PHOTOS) }).map((_, i) => (
              <div key={i} className="relative overflow-hidden border border-dark-brown/12 flex"
                   style={{ aspectRatio: "2/1" }}>

                {/* P1 — left half, object-cover */}
                <div className="w-1/2 h-full overflow-hidden relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p1Photos[i]}
                    alt={`P1 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover bw-photo"
                  />
                </div>

                {/* Seam */}
                <div className="absolute top-0 bottom-0 z-10 pointer-events-none"
                     style={{ left: "calc(50% - 0.5px)", width: "1px", background: "rgba(245,241,235,0.7)" }} />

                {/* P2 — right half, object-cover */}
                <div className="w-1/2 h-full overflow-hidden relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p2Photos[i]}
                    alt={`P2 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover bw-photo"
                  />
                </div>

                {/* Frame number */}
                <span className="absolute top-1 left-1 bg-dark-brown/50 text-cream text-[8px] font-mono font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-20">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center py-2 border-t border-dark-brown/10">
            <p className="font-sans text-dark-brown/30 text-[8px] tracking-widest uppercase">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        className="leather-btn leather-btn-primary w-full max-w-[320px] font-sans font-semibold text-sm py-3 px-6 rounded-lg flex items-center justify-center gap-2"
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
