/**
 * Shared photo utilities — used by both PhotoBooth and DuetBooth.
 */

// ─── Film processing ──────────────────────────────────────────────────────────

/** Rich B&W film look — S-curve contrast, warm sepia, grain, heavy vignette */
function applyFilmLook(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // BT.709 luminance
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // S-curve for rich film contrast (smoothstep)
    let t = lum / 255;
    t = t * t * (3 - 2 * t);
    lum = t * 255;
    // Lift blacks slightly (film never goes pure black)
    lum = 12 + lum * (243 / 255);
    // Warm sepia tint — stronger warmth
    data[i]     = Math.min(255, lum * 1.06);  // red: warm
    data[i + 1] = Math.min(255, lum * 0.97);  // green: neutral
    data[i + 2] = Math.min(255, lum * 0.86);  // blue: cool = warm overall
  }
  ctx.putImageData(imageData, 0, 0);

  // Film grain overlay
  const grainC = document.createElement("canvas");
  grainC.width = w; grainC.height = h;
  const gctx = grainC.getContext("2d")!;
  const gid = gctx.createImageData(w, h);
  const gd = gid.data;
  for (let i = 0; i < gd.length; i += 4) {
    const n = (Math.random() - 0.5) * 50;
    gd[i] = gd[i + 1] = gd[i + 2] = 128 + n;
    gd[i + 3] = 255;
  }
  gctx.putImageData(gid, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.12;
  ctx.drawImage(grainC, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // Heavy vignette — deep black corners like a real film print
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.5, "rgba(0,0,0,0.15)");
  vig.addColorStop(0.8, "rgba(0,0,0,0.45)");
  vig.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vig;
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

/**
 * Capture raw COLOR frame — no B&W, for background segmentation.
 * Crops to portrait 3:4 from the center of the landscape video so that
 * the person fills most of the output frame (avoids width-capping in
 * compositing that shrinks people to ~50% height).
 */
export function captureColorFromVideo(
  video: HTMLVideoElement,
  facingMode: "user" | "environment",
  quality = 0.80
): string | null {
  const vW = video.videoWidth  || 640;
  const vH = video.videoHeight || 480;

  // Portrait 3:4 center-crop: height = full video height, width = height × (3/4)
  const cropH = vH;
  const cropW = Math.round(vH * (3 / 4));
  const cropX = Math.max(0, Math.round((vW - cropW) / 2));
  const outW  = Math.min(cropW, vW); // guard if video is already narrower

  const canvas = document.createElement("canvas");
  canvas.width = outW; canvas.height = cropH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (facingMode === "user") { ctx.translate(outW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, cropX, 0, outW, cropH, 0, 0, outW, cropH);
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

/**
 * Compress color photo to 360×480 @0.65 for blob upload (segmentation quality).
 * Portrait 3:4 — matches captureColorFromVideo output so no extra cropping occurs
 * and the person's full height is preserved.
 */
export function compressForSegmentation(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const TW = 360, TH = 480; // portrait 3:4
      const canvas = document.createElement("canvas");
      canvas.width = TW; canvas.height = TH;
      const ctx = canvas.getContext("2d")!;
      const ir = img.naturalWidth / img.naturalHeight;
      const tr = TW / TH; // 0.75
      let sx: number, sy: number, sw: number, sh: number;
      if (ir > tr) { sh = img.naturalHeight; sw = sh * tr; sx = (img.naturalWidth - sw) / 2; sy = 0; }
      else         { sw = img.naturalWidth;  sh = sw / tr; sx = 0; sy = (img.naturalHeight - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TW, TH);
      resolve(canvas.toDataURL("image/jpeg", 0.65));
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
  | { phase: "p1";    p1: string[]; p1c?: string[] }
  | { phase: "final"; p1: string[]; p1c?: string[]; p2: string[]; p2c?: string[] };

/** Encode a DuetPayload → URL-safe base64 string (strips data URL prefixes first). */
export function encodeForUrl(payload: DuetPayload): string {
  const obj: Record<string, unknown> = { phase: payload.phase, p1: payload.p1.map(strip) };
  if ("p1c" in payload && payload.p1c) obj.p1c = payload.p1c.map(strip);
  if (payload.phase === "final") {
    obj.p2 = payload.p2.map(strip);
    if (payload.p2c) obj.p2c = payload.p2c.map(strip);
  }
  return btoa(JSON.stringify(obj));
}

/** Decode a base64 string back to a DuetPayload. Returns null on error. */
export function decodeFromUrl(encoded: string): DuetPayload | null {
  try {
    const obj = JSON.parse(atob(encoded));
    if (!obj.phase || !Array.isArray(obj.p1)) return null;
    const result: Record<string, unknown> = {
      phase: obj.phase,
      p1: (obj.p1 as string[]).map(restore),
    };
    if (Array.isArray(obj.p1c)) result.p1c = (obj.p1c as string[]).map(restore);
    if (obj.phase === "final" && Array.isArray(obj.p2)) {
      result.p2 = (obj.p2 as string[]).map(restore);
      if (Array.isArray(obj.p2c)) result.p2c = (obj.p2c as string[]).map(restore);
    }
    return result as DuetPayload;
  } catch {
    return null;
  }
}
