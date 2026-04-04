"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";

interface PhotoStripProps {
  photos: string[];
}

export interface PhotoStripHandle {
  download: () => void;
}

const TOTAL_PHOTOS   = 4;
const FILM_BASE      = "#1E140A";
const SPROCKET_COLOR = "#130D06";
const GOLD           = "#C9A84C";

// Per-frame grain texture — feTurbulence 0.75/4oct, greyscale, data-URI tile
const GRAIN_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)'/%3E%3C/svg%3E")`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
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

/** object-fit: cover for canvas drawImage */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
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
  x: number, y: number, w: number, h: number, r: number,
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

// ─── Component ────────────────────────────────────────────────────────────────

const PhotoStrip = forwardRef<PhotoStripHandle, PhotoStripProps>(
  function PhotoStrip({ photos }, ref) {
    const stripRef = useRef<HTMLDivElement>(null);
    const today    = new Date();
    const dateStr  = formatDate(today);

    // ── Canvas download ──────────────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
      const SCALE     = 2;
      const photoW    = 300;
      const photoH    = 400;
      const padding   = 16;
      const gap       = 8;
      const headerH   = 60;
      const footerH   = padding;     // even bottom padding — no URL text
      const sidebarW  = 28;          // sprocket gutter width each side
      const holeW     = 6;
      const holeH     = 9;
      const holesN    = 5;
      const borderW   = 3;

      const logicalW = sidebarW * 2 + padding * 2 + photoW;
      const logicalH =
        headerH +
        padding +
        TOTAL_PHOTOS * photoH +
        (TOTAL_PHOTOS - 1) * gap +
        padding +
        footerH;

      const canvas   = document.createElement("canvas");
      canvas.width   = logicalW * SCALE;
      canvas.height  = logicalH * SCALE;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(SCALE, SCALE);

      const W = logicalW;
      const H = logicalH;

      // ── Film base ────────────────────────────────────────────────────────
      ctx.fillStyle = FILM_BASE;
      ctx.fillRect(0, 0, W, H);

      // Subtle warmth gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0,   "rgba(80,30,8,0.14)");
      bgGrad.addColorStop(0.5, "rgba(0,0,0,0)");
      bgGrad.addColorStop(1,   "rgba(0,0,0,0.12)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Sprocket holes — 5 per side, 6×9 px, #130D06 ───────────────────
      const holePad  = 16;
      const holeStep = (H - holePad * 2 - holeH) / (holesN - 1);
      for (let i = 0; i < holesN; i++) {
        const hy  = holePad + i * holeStep;
        const hxL = (sidebarW - holeW) / 2;
        const hxR = W - sidebarW + (sidebarW - holeW) / 2;

        ctx.fillStyle = SPROCKET_COLOR;
        roundRect(ctx, hxL, hy, holeW, holeH, 1.5);
        ctx.fill();
        roundRect(ctx, hxR, hy, holeW, holeH, 1.5);
        ctx.fill();
      }

      // ── Header ───────────────────────────────────────────────────────────
      ctx.textAlign    = "center";
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = GOLD;
      ctx.font      = `bold 20px Georgia, "Times New Roman", serif`;
      ctx.fillText("CitoFoto", W / 2, padding + 20);

      ctx.fillStyle    = "rgba(180,120,55,0.45)";
      ctx.font         = `500 9px Arial, sans-serif`;
      ctx.letterSpacing = "3px";
      ctx.fillText(dateStr.toUpperCase(), W / 2, padding + 38);
      ctx.letterSpacing = "0px";

      // Thin divider
      ctx.strokeStyle = `rgba(201,168,76,0.18)`;
      ctx.lineWidth   = 0.5;
      ctx.beginPath();
      ctx.moveTo(sidebarW + padding, headerH - 4);
      ctx.lineTo(W - sidebarW - padding, headerH - 4);
      ctx.stroke();

      // ── Photos ───────────────────────────────────────────────────────────
      const loadImage = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const img = new Image();
          img.onload  = () => res(img);
          img.onerror = rej;
          img.src     = src;
        });

      let images: HTMLImageElement[];
      try { images = await Promise.all(photos.map(loadImage)); }
      catch (e) { console.error("Failed to load images", e); return; }

      for (let i = 0; i < images.length; i++) {
        const px = sidebarW + padding;
        const py = headerH + padding + i * (photoH + gap);

        // Dark border frame
        ctx.fillStyle = "#0e0805";
        ctx.fillRect(px - borderW, py - borderW, photoW + borderW * 2, photoH + borderW * 2);

        // Photo (cover-cropped)
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, photoW, photoH);
        ctx.clip();
        drawImageCover(ctx, images[i], px, py, photoW, photoH);
        ctx.restore();

        // Per-frame vignette: transparent 40% → rgba(0,0,0,0.55) 100%
        const vig = ctx.createRadialGradient(
          px + photoW / 2, py + photoH / 2, photoH * 0.25,
          px + photoW / 2, py + photoH / 2, photoH * 0.82,
        );
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = vig;
        ctx.fillRect(px, py, photoW, photoH);

        // Frame number badge
        ctx.fillStyle    = "rgba(0,0,0,0.55)";
        roundRect(ctx, px + 4, py + 4, 18, 15, 2);
        ctx.fill();
        ctx.fillStyle    = GOLD;
        ctx.font         = `bold 9px monospace`;
        ctx.textAlign    = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}`, px + 9, py + 12);
        ctx.textAlign    = "center";
        ctx.textBaseline = "alphabetic";
      }

      // ── Footer — even bottom padding, no URL text ────────────────────────
      const now = new Date();

      // ── Download ─────────────────────────────────────────────────────────
      const n        = nextStripNumber();
      const filename = `CitoFoto_${n}_${formatDate(now)}.jpg`;
      const link     = document.createElement("a");
      link.download  = filename;
      link.href      = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    }, [photos]);

    useImperativeHandle(ref, () => ({ download: handleDownload }), [handleDownload]);

    // ── JSX ─────────────────────────────────────────────────────────────────
    return (
      <>
        {/*
          SVG filter defs — hidden, scoped to document.
          #bw-film: weighted luminosity matrix (more green, less blue, warm shadows).
        */}
        <svg
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            <filter id="bw-film" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values={[
                  "0.28 0.58 0.14 0 0.02",
                  "0.22 0.58 0.14 0 -0.02",
                  "0.18 0.50 0.10 0 -0.04",
                  "0    0    0    1 0",
                ].join("  ")}
              />
            </filter>
          </defs>
        </svg>

        {/* Film strip shell */}
        <div
          ref={stripRef}
          style={{
            position:     "relative",
            width:        "clamp(130px, 14vw, 150px)",
            background:   FILM_BASE,
            borderRadius: "3px",
            overflow:     "hidden",
            boxShadow:    "0 24px 64px rgba(0,0,0,0.72), 0 8px 20px rgba(0,0,0,0.45)",
            flexShrink:   0,
          }}
        >
          {/* ── Sprockets ── */}
          {(["left", "right"] as const).map(side => (
            <div
              key={side}
              style={{
                position:       "absolute",
                [side]:         0,
                top:            0,
                bottom:         0,
                width:          "16px",
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "space-around",
                padding:        "12px 0",
                zIndex:         10,
                background:     FILM_BASE,
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="film-hole" />
              ))}
            </div>
          ))}

          {/* ── Inner content (clear of sprocket gutters) ── */}
          <div style={{ margin: "0 16px" }}>

            {/* Header */}
            <div
              style={{
                textAlign:    "center",
                padding:      "10px 4px 8px",
                borderBottom: "0.5px solid rgba(201,168,76,0.15)",
              }}
            >
              <p
                style={{
                  fontFamily:    "Georgia, 'Times New Roman', serif",
                  color:         GOLD,
                  fontSize:      "clamp(11px, 2.8vw, 14px)",
                  fontWeight:    "bold",
                  letterSpacing: "0.06em",
                  margin:        0,
                  lineHeight:    1.2,
                }}
              >
                CitoFoto
              </p>
              <p
                style={{
                  fontFamily:    "monospace",
                  color:         "rgba(180,120,55,0.42)",
                  fontSize:      "clamp(6.5px, 1.6vw, 8.5px)",
                  letterSpacing: "0.22em",
                  margin:        "3px 0 0",
                  textTransform: "uppercase",
                }}
              >
                {dateStr}
              </p>
            </div>

            {/* Photo frames */}
            <div style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "5px 0" }}>
              {photos.map((photo, i) => (
                <div
                  key={i}
                  className="frame-in"
                  style={{
                    position:         "relative",
                    overflow:         "hidden",
                    animationDelay:   `${0.1 + i * 0.09}s`,
                    animationFillMode: "both",
                  }}
                >
                  {/* B&W via SVG feColorMatrix — no CSS grayscale */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Frame ${i + 1}`}
                    style={{
                      width:       "100%",
                      display:     "block",
                      aspectRatio: "3/4",
                      objectFit:   "cover",
                      filter:      "url(#bw-film)",
                    }}
                  />

                  {/* Per-frame vignette */}
                  <div
                    aria-hidden="true"
                    style={{
                      position:   "absolute",
                      inset:      0,
                      background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
                      zIndex:     2,
                      pointerEvents: "none",
                    }}
                  />

                  {/* Per-frame grain — feTurbulence 0.75 / 4oct, overlay at 8% */}
                  <div
                    aria-hidden="true"
                    style={{
                      position:        "absolute",
                      inset:           0,
                      backgroundImage: GRAIN_URI,
                      backgroundSize:  "200px 200px",
                      opacity:         0.08,
                      mixBlendMode:    "overlay" as React.CSSProperties["mixBlendMode"],
                      zIndex:          3,
                      pointerEvents:   "none",
                    }}
                  />

                  {/* Frame number badge */}
                  <span
                    style={{
                      position:        "absolute",
                      top:             "3px",
                      left:            "3px",
                      zIndex:          5,
                      background:      "rgba(0,0,0,0.52)",
                      color:           GOLD,
                      fontFamily:      "monospace",
                      fontSize:        "7px",
                      fontWeight:      "bold",
                      width:           "13px",
                      height:          "13px",
                      display:         "flex",
                      alignItems:      "center",
                      justifyContent:  "center",
                      borderRadius:    "2px",
                    }}
                  >
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Even bottom padding — no URL text */}
            <div style={{ height: "10px" }} />

          </div>
        </div>
      </>
    );
  }
);

export default PhotoStrip;
