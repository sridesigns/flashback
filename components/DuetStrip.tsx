"use client";

import { useCallback } from "react";

interface DuetStripProps {
  p1Photos: string[]; // Person 1 — rendered on LEFT
  p2Photos: string[]; // Person 2 — rendered on RIGHT
}

const TOTAL_PHOTOS = 4;

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number,
  w: number, h: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (ir > tr) {
    sh = img.naturalHeight; sw = sh * tr;
    sx = (img.naturalWidth - sw) / 2; sy = 0;
  } else {
    sw = img.naturalWidth; sh = sw / tr;
    sx = 0; sy = (img.naturalHeight - sh) / 2;
  }
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

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DuetStrip({ p1Photos, p2Photos }: DuetStripProps) {
  const frameCount = Math.min(p1Photos.length, p2Photos.length, TOTAL_PHOTOS);

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const SCALE    = 2;
    const frameW   = 440;
    const frameH   = 230;
    const halfW    = frameW / 2;
    const padding  = 18;
    const gap      = 8;
    const headerH  = 68;
    const footerH  = 50;
    const sidebarW = 30;
    const holeW    = 13;
    const holeH    = 9;
    const holeGap  = 20;

    const logW = sidebarW * 2 + padding * 2 + frameW;
    const logH = headerH + padding
               + TOTAL_PHOTOS * frameH + (TOTAL_PHOTOS - 1) * gap
               + padding + footerH;

    const canvas = document.createElement("canvas");
    canvas.width  = logW * SCALE;
    canvas.height = logH * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(SCALE, SCALE);
    const W = logW, H = logH;

    // ── Strip background ──────────────────────────────────────────────────────
    const baseFill = ctx.createLinearGradient(0, 0, 0, H);
    baseFill.addColorStop(0, "#1C0F08");
    baseFill.addColorStop(0.5, "#140A05");
    baseFill.addColorStop(1, "#1C0F08");
    ctx.fillStyle = baseFill;
    ctx.fillRect(0, 0, W, H);

    // ── Sidebar strips ────────────────────────────────────────────────────────
    ctx.fillStyle = "#0D0603";
    ctx.fillRect(0, 0, sidebarW, H);
    ctx.fillRect(W - sidebarW, 0, sidebarW, H);

    ctx.strokeStyle = "rgba(201,168,76,0.10)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW, 0);     ctx.lineTo(sidebarW, H);
    ctx.moveTo(W - sidebarW, 0); ctx.lineTo(W - sidebarW, H);
    ctx.stroke();

    // ── Film perforations ─────────────────────────────────────────────────────
    const holesCount = Math.floor(H / holeGap);
    for (let i = 0; i < holesCount; i++) {
      const hy  = i * holeGap + (holeGap - holeH) / 2;
      const hxL = (sidebarW - holeW) / 2;
      const hxR = W - sidebarW + (sidebarW - holeW) / 2;

      ctx.fillStyle = "#050302";
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.fill();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, hxL + 1, hy + 1, holeW - 2, 2, 1); ctx.fill();
      roundRect(ctx, hxR + 1, hy + 1, holeW - 2, 2, 1); ctx.fill();

      ctx.strokeStyle = "rgba(201,168,76,0.15)";
      ctx.lineWidth = 0.5;
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.stroke();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.stroke();
    }

    // ── Header ────────────────────────────────────────────────────────────────
    const px = sidebarW + padding;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#C9A84C";
    ctx.font = `bold 19px Georgia, "Times New Roman", serif`;
    ctx.fillText("CitoFoto", W / 2, padding + 20);

    ctx.fillStyle = "#7a5535";
    ctx.font = `600 8px Arial, sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("DUET BOOTH", W / 2, padding + 36);
    ctx.letterSpacing = "0px";

    ctx.font = `700 7.5px Arial, sans-serif`;
    ctx.letterSpacing = "1.5px";
    ctx.fillStyle = "rgba(201,168,76,0.40)";
    ctx.textAlign = "left";
    ctx.fillText("PERSON 1", px + 4, padding + 54);
    ctx.textAlign = "right";
    ctx.fillText("PERSON 2", px + frameW - 4, padding + 54);
    ctx.letterSpacing = "0px";

    ctx.strokeStyle = "rgba(201,168,76,0.15)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px, headerH - 2);
    ctx.lineTo(W - sidebarW - padding, headerH - 2);
    ctx.stroke();

    // ── Load images ───────────────────────────────────────────────────────────
    const loadImg = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    let p1Imgs: HTMLImageElement[], p2Imgs: HTMLImageElement[];
    try {
      [p1Imgs, p2Imgs] = await Promise.all([
        Promise.all(p1Photos.map(loadImg)),
        Promise.all(p2Photos.map(loadImg)),
      ]);
    } catch (e) {
      console.error("Failed to load images", e);
      return;
    }

    // ── Draw frames ───────────────────────────────────────────────────────────
    for (let i = 0; i < TOTAL_PHOTOS; i++) {
      const frameX = px;
      const frameY = headerH + padding + i * (frameH + gap);

      ctx.fillStyle = "#080402";
      ctx.fillRect(frameX - 3, frameY - 3, frameW + 6, frameH + 6);

      // P1 — left half
      if (p1Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p1Imgs[i], frameX, frameY, halfW, frameH);
        ctx.restore();
      }

      // P2 — right half
      if (p2Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX + halfW, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p2Imgs[i], frameX + halfW, frameY, halfW, frameH);
        ctx.restore();
      }

      // Hairline center seam
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(frameX + halfW, frameY);
      ctx.lineTo(frameX + halfW, frameY + frameH);
      ctx.stroke();

      // Unified vignette
      const vig = ctx.createRadialGradient(
        frameX + frameW / 2, frameY + frameH / 2, frameH * 0.15,
        frameX + frameW / 2, frameY + frameH / 2, frameH * 0.92
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = vig;
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // Frame number badge
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      roundRect(ctx, frameX + 5, frameY + 5, 20, 14, 2); ctx.fill();
      ctx.fillStyle = "#C9A84C";
      ctx.font = `bold 9px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, frameX + 10, frameY + 12);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(201,168,76,0.12)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px, H - footerH + 2);
    ctx.lineTo(W - sidebarW - padding, H - footerH + 2);
    ctx.stroke();

    const now = new Date();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#6b4828";
    ctx.font = `9px Arial, sans-serif`;
    ctx.letterSpacing = "2px";
    ctx.fillText("citofoto.vercel.app", W / 2, H - footerH + 18);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "rgba(100,65,30,0.45)";
    ctx.font = `8px monospace`;
    ctx.fillText(
      now.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }).toUpperCase(),
      W / 2, H - footerH + 34
    );

    const n        = nextStripNumber();
    const date     = formatDate(now);
    const filename = `CitoFoto_Duet_${n}_${date}.jpg`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }, [p1Photos, p2Photos]);

  // ── Strip ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Film strip ──────────────────────────────────────────────────────── */}
      <div
        className="relative shadow-2xl overflow-hidden"
        style={{
          width: "min(300px, 90vw)",
          background: "linear-gradient(180deg, #1C0F08 0%, #140A05 50%, #1C0F08 100%)",
          borderRadius: "2px",
        }}
      >
        {/* Left sprocket track */}
        <SprocketTrack side="left" />
        {/* Right sprocket track */}
        <SprocketTrack side="right" />

        {/* Inner content */}
        <div className="mx-[22px] flex flex-col">

          {/* Header */}
          <div className="text-center py-3 border-b border-gold/10">
            <p className="font-serif text-gold text-sm font-bold tracking-wider">CitoFoto</p>
            <p className="font-sans text-warm-brown/40 text-[8px] tracking-[0.25em] uppercase mt-0.5">Duet Booth</p>
          </div>

          {/* Column labels */}
          <div className="flex pt-1.5 pb-0.5">
            <span className="flex-1 text-center font-sans text-[7px] text-gold/30 uppercase tracking-widest">Person 1</span>
            <span className="flex-1 text-center font-sans text-[7px] text-gold/30 uppercase tracking-widest">Person 2</span>
          </div>

          {/* Frames */}
          <div className="flex flex-col gap-1.5 pb-2">
            {Array.from({ length: frameCount }).map((_, i) => (
              <div
                key={i}
                className="relative flex overflow-hidden border border-gold/8"
                style={{ aspectRatio: "2/1" }}
              >
                {/* P1 — left half */}
                <div className="w-1/2 h-full overflow-hidden relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p1Photos[i]}
                    alt={`Person 1 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                {/* Hairline seam */}
                <div
                  className="absolute top-0 bottom-0 z-10 pointer-events-none"
                  style={{ left: "calc(50% - 0.5px)", width: "1px", background: "rgba(255,255,255,0.15)" }}
                />

                {/* P2 — right half */}
                <div className="w-1/2 h-full overflow-hidden relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p2Photos[i]}
                    alt={`Person 2 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                {/* Unified vignette */}
                <div
                  className="absolute inset-0 pointer-events-none z-20"
                  style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.28) 100%)" }}
                />

                {/* Frame number */}
                <span className="absolute top-1 left-1 bg-black/55 text-gold text-[7px] font-mono font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-30">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center py-2 border-t border-gold/8">
            <p className="font-sans text-warm-brown/25 text-[7px] tracking-widest uppercase">
              {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}
            </p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleDownload}
        className="leather-btn leather-btn-primary w-full max-w-[300px] font-sans font-semibold text-sm py-3 px-6 rounded-lg flex items-center justify-center gap-2"
      >
        <DownloadIcon />
        Save Duet Strip
      </button>
    </div>
  );
}

// ─── Sprocket track ────────────────────────────────────────────────────────────

function SprocketTrack({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center justify-around py-3 z-10"
      style={{
        [side]: 0,
        width: "22px",
        background: "#0D0603",
        borderRight: side === "left" ? "0.5px solid rgba(201,168,76,0.08)" : undefined,
        borderLeft:  side === "right" ? "0.5px solid rgba(201,168,76,0.08)" : undefined,
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: "11px",
            height: "7px",
            background: "#050302",
            borderRadius: "1.5px",
            border: "0.5px solid rgba(201,168,76,0.12)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
