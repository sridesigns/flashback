"use client";

import { useCallback, useEffect, useState } from "react";
import { removeBackground, BOOTH_BACKDROP } from "@/lib/segmentation";

interface DuetStripProps {
  p1Photos: string[]; // initiator — composited on LEFT
  p2Photos: string[]; // partner  — composited on RIGHT
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
  const [p1Ready, setP1Ready] = useState<string[]>([]);
  const [p2Ready, setP2Ready] = useState<string[]>([]);
  const [processing, setProcessing] = useState(true);
  const [progress, setProgress]   = useState(0);
  const [segFailed, setSegFailed] = useState(false);

  // ── Background removal ──────────────────────────────────────────────────────
  useEffect(() => {
    if (p1Photos.length !== TOTAL_PHOTOS || p2Photos.length !== TOTAL_PHOTOS) return;

    setProcessing(true);
    setProgress(0);
    setSegFailed(false);

    const all = [...p1Photos, ...p2Photos];
    const out: string[] = [];

    (async () => {
      let anyFailed = false;
      for (let i = 0; i < all.length; i++) {
        const result = await removeBackground(all[i], BOOTH_BACKDROP);
        if (result === all[i]) anyFailed = true; // fallback means segmentation failed
        out.push(result);
        setProgress(Math.round(((i + 1) / all.length) * 100));
      }
      setP1Ready(out.slice(0, TOTAL_PHOTOS));
      setP2Ready(out.slice(TOTAL_PHOTOS));
      if (anyFailed) setSegFailed(true);
      setProcessing(false);
    })();
  }, [p1Photos, p2Photos]);

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const photos1 = p1Ready.length === TOTAL_PHOTOS ? p1Ready : p1Photos;
    const photos2 = p2Ready.length === TOTAL_PHOTOS ? p2Ready : p2Photos;

    // ── Layout ─────────────────────────────────────────────────────────────
    const SCALE    = 2;
    const frameW   = 440;  // total width (P1 left + P2 right side-by-side)
    const frameH   = 230;  // each half ~square portrait
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

    // ── Strip background ────────────────────────────────────────────────────
    ctx.fillStyle = "#12090400";
    ctx.fillRect(0, 0, W, H);
    // Rich dark base — like exposed film
    const baseFill = ctx.createLinearGradient(0, 0, 0, H);
    baseFill.addColorStop(0, "#1C0F08");
    baseFill.addColorStop(0.5, "#140A05");
    baseFill.addColorStop(1, "#1C0F08");
    ctx.fillStyle = baseFill;
    ctx.fillRect(0, 0, W, H);

    // Subtle warm horizontal grain bands
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = `rgba(${y % 8 === 0 ? "80,30,10" : "0,0,0"},0.025)`;
      ctx.fillRect(0, y, W, 2);
    }

    // ── Sidebar strips ──────────────────────────────────────────────────────
    ctx.fillStyle = "#0D0603";
    ctx.fillRect(0, 0, sidebarW, H);
    ctx.fillRect(W - sidebarW, 0, sidebarW, H);

    // Sidebar inner edge lines
    ctx.strokeStyle = "rgba(201,168,76,0.10)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW, 0);     ctx.lineTo(sidebarW, H);
    ctx.moveTo(W - sidebarW, 0); ctx.lineTo(W - sidebarW, H);
    ctx.stroke();

    // ── Film perforations (authentic sprocket holes) ─────────────────────────
    const holesCount = Math.floor(H / holeGap);
    for (let i = 0; i < holesCount; i++) {
      const hy  = i * holeGap + (holeGap - holeH) / 2;
      const hxL = (sidebarW - holeW) / 2;
      const hxR = W - sidebarW + (sidebarW - holeW) / 2;

      // Punched-through hole (very dark, matches negative)
      ctx.fillStyle = "#050302";
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.fill();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.fill();

      // Subtle highlight on top edge — gives the "punched through base" depth
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, hxL + 1, hy + 1, holeW - 2, 2, 1); ctx.fill();
      roundRect(ctx, hxR + 1, hy + 1, holeW - 2, 2, 1); ctx.fill();

      // Thin gold rim
      ctx.strokeStyle = "rgba(201,168,76,0.15)";
      ctx.lineWidth = 0.5;
      roundRect(ctx, hxL, hy, holeW, holeH, 2); ctx.stroke();
      roundRect(ctx, hxR, hy, holeW, holeH, 2); ctx.stroke();
    }

    // ── Header ──────────────────────────────────────────────────────────────
    const px = sidebarW + padding;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Wordmark
    ctx.fillStyle = "#C9A84C";
    ctx.font = `bold 19px Georgia, "Times New Roman", serif`;
    ctx.fillText("CitoFoto", W / 2, padding + 20);

    // Subtitle
    ctx.fillStyle = "#7a5535";
    ctx.font = `600 8px Arial, sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("DUET BOOTH", W / 2, padding + 36);
    ctx.letterSpacing = "0px";

    // Person column labels
    ctx.font = `700 7.5px Arial, sans-serif`;
    ctx.letterSpacing = "1.5px";
    ctx.fillStyle = "rgba(201,168,76,0.40)";
    ctx.textAlign = "left";
    ctx.fillText("PERSON 1", px + 4, padding + 54);
    ctx.textAlign = "right";
    ctx.fillText("PERSON 2", px + frameW - 4, padding + 54);
    ctx.letterSpacing = "0px";

    // Header rule
    ctx.strokeStyle = "rgba(201,168,76,0.15)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px, headerH - 2);
    ctx.lineTo(W - sidebarW - padding, headerH - 2);
    ctx.stroke();

    // ── Load processed images ───────────────────────────────────────────────
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
        Promise.all(photos1.map(loadImg)),
        Promise.all(photos2.map(loadImg)),
      ]);
    } catch (e) {
      console.error("Failed to load images", e);
      return;
    }

    // ── Draw each frame ─────────────────────────────────────────────────────
    for (let i = 0; i < TOTAL_PHOTOS; i++) {
      const frameX = px;
      const frameY = headerH + padding + i * (frameH + gap);

      // Dark frame border (slightly raised from background)
      ctx.fillStyle = "#080402";
      ctx.fillRect(frameX - 3, frameY - 3, frameW + 6, frameH + 6);

      // Booth-backdrop fill behind photos
      ctx.fillStyle = BOOTH_BACKDROP;
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // P1 — left half, cover-cropped
      if (p1Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p1Imgs[i], frameX, frameY, halfW, frameH);
        ctx.restore();
      }

      // P2 — right half, cover-cropped
      if (p2Imgs[i]) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX + halfW, frameY, halfW, frameH);
        ctx.clip();
        drawCover(ctx, p2Imgs[i], frameX + halfW, frameY, halfW, frameH);
        ctx.restore();
      }

      // Hairline seam — subtle white line at center join
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(frameX + halfW, frameY);
      ctx.lineTo(frameX + halfW, frameY + frameH);
      ctx.stroke();

      // Unified vignette across the full frame
      const vig = ctx.createRadialGradient(
        frameX + frameW / 2, frameY + frameH / 2, frameH * 0.15,
        frameX + frameW / 2, frameY + frameH / 2, frameH * 0.92
      );
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = vig;
      ctx.fillRect(frameX, frameY, frameW, frameH);

      // Frame number badge (top-left, in margin)
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      roundRect(ctx, frameX + 5, frameY + 5, 20, 14, 2); ctx.fill();
      ctx.fillStyle = "#C9A84C";
      ctx.font = `bold 9px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, frameX + 10, frameY + 12);
    }

    // ── Footer ───────────────────────────────────────────────────────────────
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
  }, [p1Ready, p2Ready, p1Photos, p2Photos]);

  // ── Processing screen ──────────────────────────────────────────────────────
  if (processing) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 w-full">
        {/* Animated film strip spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-dark-brown/10" />
          <div className="absolute inset-0 rounded-full border-4 border-burnt-orange border-t-transparent animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-serif text-lg font-bold text-burnt-orange">{progress}<span className="text-xs">%</span></span>
          </div>
        </div>
        <div className="text-center">
          <p className="font-serif text-dark-brown font-semibold text-base">
            Placing you in the same booth…
          </p>
          <p className="font-sans text-xs text-warm-brown/45 mt-1 max-w-[200px] leading-relaxed">
            Removing backgrounds &amp; compositing your portraits
          </p>
        </div>
        {/* Mini progress bar */}
        <div className="w-40 h-1 bg-dark-brown/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-burnt-orange rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Photos to show (processed or raw fallback) ────────────────────────────
  const displayP1 = p1Ready.length === TOTAL_PHOTOS ? p1Ready : p1Photos;
  const displayP2 = p2Ready.length === TOTAL_PHOTOS ? p2Ready : p2Photos;
  const frameCount = Math.min(displayP1.length, displayP2.length, TOTAL_PHOTOS);

  // ── Strip ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {segFailed && (
        <p className="font-sans text-[10px] text-warm-brown/40 text-center">
          Background removal unavailable — showing original photos
        </p>
      )}

      {/* ── Film strip ────────────────────────────────────────────────────── */}
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
                style={{ aspectRatio: "2/1", background: BOOTH_BACKDROP }}
              >
                {/* P1 — left half */}
                <div className="w-1/2 h-full overflow-hidden relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayP1[i]}
                    alt={`Person 1 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: "grayscale(100%) contrast(1.1) brightness(0.95)" }}
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
                    src={displayP2[i]}
                    alt={`Person 2 shot ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: "grayscale(100%) contrast(1.1) brightness(0.95)" }}
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
