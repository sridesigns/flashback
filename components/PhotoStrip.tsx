"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";

interface PhotoStripProps {
  photos: string[];
}

export interface PhotoStripHandle {
  download: () => void;
}

const TOTAL_PHOTOS = 4;

// ─── Canvas helpers ───────────────────────────────────────────────────────────

/** Draw an image into (x,y,w,h) with object-fit:cover — no stretching. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const targetRatio = w / h;

  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > targetRatio) {
    // Source is wider — crop left/right
    sh = img.naturalHeight;
    sw = sh * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    // Source is taller — crop top/bottom
    sw = img.naturalWidth;
    sh = sw / targetRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
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

/** localStorage-backed counter so each saved strip gets a unique number. */
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

/** Format: dd.mm.yy */
function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const PhotoStrip = forwardRef<PhotoStripHandle, PhotoStripProps>(function PhotoStrip({ photos }, ref) {
  const stripRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    // ── Layout constants (logical pixels) ──────────────────────────────────
    const SCALE        = 2;          // render at 2× for crisp output
    const photoW       = 300;        // logical width per photo
    const photoH       = 400;        // 3:4 portrait photo-booth ratio
    const padding      = 20;
    const gap          = 12;
    const headerH      = 64;
    const footerH      = 48;
    const sidebarW     = 32;         // film-hole gutter on each side
    const holeW        = 14;
    const holeH        = 10;
    const holeGap      = 22;
    const borderW      = 4;          // dark frame around each photo

    const logicalW = sidebarW * 2 + padding * 2 + photoW;
    const logicalH =
      headerH +
      padding +
      TOTAL_PHOTOS * photoH +
      (TOTAL_PHOTOS - 1) * gap +
      padding +
      footerH;

    const canvas  = document.createElement("canvas");
    canvas.width  = logicalW  * SCALE;
    canvas.height = logicalH  * SCALE;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale all draw calls so we work in logical coords
    ctx.scale(SCALE, SCALE);

    const W = logicalW;
    const H = logicalH;

    // ── Background ─────────────────────────────────────────────────────────
    ctx.fillStyle = "#181008";
    ctx.fillRect(0, 0, W, H);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "rgba(90,35,10,0.18)");
    bgGrad.addColorStop(0.5, "rgba(0,0,0,0.0)");
    bgGrad.addColorStop(1, "rgba(0,0,0,0.14)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Film holes ─────────────────────────────────────────────────────────
    const holesCount = Math.floor(H / holeGap);
    for (let i = 0; i < holesCount; i++) {
      const hy = i * holeGap + holeGap / 2 - holeH / 2;
      const hxL = (sidebarW - holeW) / 2;
      const hxR = W - sidebarW + (sidebarW - holeW) / 2;

      ctx.fillStyle = "#0a0600";
      roundRect(ctx, hxL, hy, holeW, holeH, 2);
      ctx.fill();
      roundRect(ctx, hxR, hy, holeW, holeH, 2);
      ctx.fill();

      // Inner highlight to give depth
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      roundRect(ctx, hxL + 1, hy + 1, holeW - 2, 3, 1);
      ctx.fill();
      roundRect(ctx, hxR + 1, hy + 1, holeW - 2, 3, 1);
      ctx.fill();
    }

    // ── Sidebar edge lines ─────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW, 0); ctx.lineTo(sidebarW, H);
    ctx.moveTo(W - sidebarW, 0); ctx.lineTo(W - sidebarW, H);
    ctx.stroke();

    // ── Header ─────────────────────────────────────────────────────────────
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#C9A84C";
    ctx.font = `bold 22px Georgia, "Times New Roman", serif`;
    ctx.fillText("CitoFoto", W / 2, padding + 22);

    ctx.fillStyle = "#7a5535";
    ctx.font = `600 10px Arial, sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText("RETRO PHOTO BOOTH", W / 2, padding + 40);
    ctx.letterSpacing = "0px";

    // Thin gold divider
    const divY = headerH - 2;
    ctx.strokeStyle = "rgba(201,168,76,0.25)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, divY);
    ctx.lineTo(W - sidebarW - padding, divY);
    ctx.stroke();

    // ── Photos ─────────────────────────────────────────────────────────────
    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });

    let images: HTMLImageElement[];
    try {
      images = await Promise.all(photos.map(loadImage));
    } catch (e) {
      console.error("Failed to load images for download", e);
      return;
    }

    for (let i = 0; i < images.length; i++) {
      const px = sidebarW + padding;
      const py = headerH + padding + i * (photoH + gap);

      // Dark frame
      ctx.fillStyle = "#0e0805";
      ctx.fillRect(px - borderW, py - borderW, photoW + borderW * 2, photoH + borderW * 2);

      // Photo — cover crop so aspect ratio is never distorted
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, photoW, photoH);
      ctx.clip();
      drawImageCover(ctx, images[i], px, py, photoW, photoH);
      ctx.restore();

      // Subtle inner vignette over the photo
      const vigGrad = ctx.createRadialGradient(
        px + photoW / 2, py + photoH / 2, photoH * 0.3,
        px + photoW / 2, py + photoH / 2, photoH * 0.85
      );
      vigGrad.addColorStop(0, "rgba(0,0,0,0)");
      vigGrad.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(px, py, photoW, photoH);

      // Photo number badge
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      roundRect(ctx, px + 5, py + 5, 20, 16, 2);
      ctx.fill();
      ctx.fillStyle = "#C9A84C";
      ctx.font = `bold 10px monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, px + 10, py + 13);
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    const footerDivY = H - footerH + 2;
    ctx.strokeStyle = "rgba(201,168,76,0.20)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sidebarW + padding, footerDivY);
    ctx.lineTo(W - sidebarW - padding, footerDivY);
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
      W / 2,
      H - footerH + 36
    );

    // ── Download ───────────────────────────────────────────────────────────
    const n    = nextStripNumber();
    const date = formatDate(now);
    const filename = `CitoFoto_${n}_${date}.jpg`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  }, [photos]);

  // Expose download() to parent via ref
  useImperativeHandle(ref, () => ({ download: handleDownload }), [handleDownload]);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center w-full">
      {/* Strip display */}
      <div
        ref={stripRef}
        className="relative bg-film-black rounded-sm shadow-2xl overflow-hidden"
        style={{ width: "min(240px, 75vw)" }}
      >
        {/* Film holes — left */}
        <div className="absolute left-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="film-hole" />
          ))}
        </div>
        {/* Film holes — right */}
        <div className="absolute right-0 top-0 bottom-0 w-5 flex flex-col items-center justify-around py-3 z-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="film-hole" />
          ))}
        </div>

        {/* Inner content */}
        <div className="mx-5 flex flex-col">
          {/* Header */}
          <div className="text-center py-3 border-b border-warm-brown/20">
            <p className="font-serif text-gold text-sm font-bold tracking-wider uppercase">
              CitoFoto
            </p>
            <p className="font-sans text-warm-brown/60 text-[9px] tracking-[0.2em] uppercase mt-0.5">
              Retro Photo Booth
            </p>
          </div>

          {/* Photos */}
          <div className="flex flex-col gap-1.5 py-2">
            {photos.map((photo, i) => (
              <div
                key={i}
                className="relative overflow-hidden"
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
              >
                <div className="relative photo-vignette">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Photo ${i + 1}`}
                    className="w-full block bw-photo"
                    style={{ aspectRatio: "3/4", objectFit: "cover" }}
                  />
                  <span className="absolute top-1 left-1 bg-black/60 text-gold text-[9px] font-mono font-bold w-4 h-4 flex items-center justify-center rounded-sm z-10">
                    {i + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center py-2.5 border-t border-warm-brown/20">
            <p className="font-sans text-warm-brown/40 text-[8px] tracking-widest uppercase">
              {new Date().toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
});

export default PhotoStrip;
