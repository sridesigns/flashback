/**
 * Shared photo utilities — used by both PhotoBooth and DuetBooth.
 */

// ─── Film processing ──────────────────────────────────────────────────────────

/** B&W + strong S-curve contrast + film grain + warm sepia tint + heavy vignette */
function applyFilmLook(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];

    // BT.709 luminance
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Strong S-curve: crush shadows, open midtones, gentle highlights
    let t = lum / 255;
    if (t < 0.35) {
      t = t * 0.55;                              // 0→0, 0.35→0.1925
    } else if (t < 0.65) {
      t = 0.1925 + (t - 0.35) * 2.1;            // 0.35→0.1925, 0.65→0.8225
    } else {
      t = 0.8225 + (t - 0.65) * 0.514;          // 0.65→0.8225, 1.0→1.002 ≈ 1.0
    }
    lum = Math.min(255, Math.max(0, t * 255));

    // Per-pixel film grain
    const grain = (Math.random() - 0.5) * 28;
    lum = Math.min(255, Math.max(0, lum + grain));

    // Warm amber sepia toning
    data[i]     = Math.min(255, lum * 1.12);  // warm red
    data[i + 1] = Math.min(255, lum * 0.97);  // slight green cut
    data[i + 2] = Math.min(255, lum * 0.78);  // strong blue cut — amber shadows
  }

  ctx.putImageData(imageData, 0, 0);

  // Heavy corner vignette — deep and tight
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.12, w / 2, h / 2, h * 0.80);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.5, "rgba(0,0,0,0.08)");
  vignette.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Capture a single frame from a <video> element.
 * Mirrors for front camera, applies B&W film look, returns JPEG data URL.
 */
export function captureFromVideo(
  video: HTMLVideoElement,
  facingMode: "user" | "environment",
  quality = 0.88
): string | null {
  const w = video.videoWidth  || 640;
  const h = video.videoHeight || 480;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (facingMode === "user") { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, w, h);
  applyFilmLook(ctx, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// ─── URL compression ──────────────────────────────────────────────────────────

/**
 * Shrink a photo data URL to ~320×240 @ quality 0.4 for URL embedding.
 * The result is still a valid JPEG data URL, just much smaller (~10–15 KB).
 */
export function compressForUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const TW = 320, TH = 240;
      const canvas = document.createElement("canvas");
      canvas.width = TW; canvas.height = TH;
      const ctx = canvas.getContext("2d")!;
      // Cover-crop source to target aspect
      const ir = img.naturalWidth / img.naturalHeight;
      const tr = TW / TH;
      let sx: number, sy: number, sw: number, sh: number;
      if (ir > tr) { sh = img.naturalHeight; sw = sh * tr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else         { sw = img.naturalWidth;  sh = sw / tr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TW, TH);
      resolve(canvas.toDataURL("image/jpeg", 0.40));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─── Duet URL encoding ────────────────────────────────────────────────────────

const JPEG_PREFIX = "data:image/jpeg;base64,";
const strip   = (d: string) => d.startsWith(JPEG_PREFIX) ? d.slice(JPEG_PREFIX.length) : d;
const restore = (d: string) => d.startsWith("data:") ? d : JPEG_PREFIX + d;

/** Duet link payload — phase "p1" carries Person 1's photos; "final" carries both. */
export type DuetPayload =
  | { phase: "p1";    p1: string[] }
  | { phase: "final"; p1: string[]; p2: string[] };

/** Encode a DuetPayload → URL-safe base64 string (strips data URL prefixes first). */
export function encodeForUrl(payload: DuetPayload): string {
  const obj: Record<string, unknown> = { phase: payload.phase, p1: payload.p1.map(strip) };
  if (payload.phase === "final") obj.p2 = payload.p2.map(strip);
  return btoa(JSON.stringify(obj));
}

/** Decode a base64 string back to a DuetPayload. Returns null on error. */
export function decodeFromUrl(encoded: string): DuetPayload | null {
  try {
    const obj = JSON.parse(atob(encoded));
    if (!obj.phase || !Array.isArray(obj.p1)) return null;
    const result: Record<string, unknown> = { phase: obj.phase, p1: (obj.p1 as string[]).map(restore) };
    if (obj.phase === "final" && Array.isArray(obj.p2)) result.p2 = (obj.p2 as string[]).map(restore);
    return result as DuetPayload;
  } catch {
    return null;
  }
}
