/**
 * Background removal & duet compositing for Pose & Pass.
 * Runs MediaPipe SelfieSegmentation (model 1 = landscape, higher quality)
 * on COLOR photos. Extracts person cutouts with transparent backgrounds,
 * then composites two people into a single unified frame.
 */

// Warm neutral studio backdrop
export const BOOTH_BACKDROP = "#DDD9D0";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _segmenter: any = null;
let _initPromise: Promise<unknown> | null = null;

async function getSegmenter() {
  if (_segmenter) return _segmenter;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Dynamic import to avoid SSR issues
    const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
    const seg = new SelfieSegmentation({
      locateFile: (f: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`,
    });
    seg.setOptions({ modelSelection: 1 }); // 1 = landscape = highest quality
    await seg.initialize();
    _segmenter = seg;
    return seg;
  })();

  return _initPromise;
}

// Sequential queue — SelfieSegmentation has a single onResults callback
let _queue = Promise.resolve<string>("");

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Rich B&W film look — S-curve contrast, warm sepia, grain, heavy vignette */
function applyFilmLook(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    // BT.709 luminance
    let lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    // S-curve for rich film contrast (smoothstep)
    let t = lum / 255;
    t = t * t * (3 - 2 * t);
    lum = t * 255;
    // Lift blacks slightly (film never goes pure black)
    lum = 12 + lum * (243 / 255);
    // Warm sepia tint
    d[i]     = Math.min(255, lum * 1.06);
    d[i + 1] = Math.min(255, lum * 0.97);
    d[i + 2] = Math.min(255, lum * 0.86);
  }
  ctx.putImageData(id, 0, 0);

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

  // Heavy vignette — deep black corners
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.5, "rgba(0,0,0,0.15)");
  vig.addColorStop(0.8, "rgba(0,0,0,0.45)");
  vig.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Extract person from a COLOR photo with transparent background.
 * Returns PNG data URL with alpha channel.
 * Falls back to original photo if segmentation fails.
 */
export function extractPerson(colorPhotoUrl: string): Promise<string> {
  const result = new Promise<string>((resolve) => {
    _queue = _queue.then(async () => {
      try {
        const seg = await getSegmenter();
        const img = await loadImg(colorPhotoUrl);
        const W = img.naturalWidth, H = img.naturalHeight;

        // 1. Draw source image to canvas
        const srcC = document.createElement("canvas");
        srcC.width = W; srcC.height = H;
        const srcCtx = srcC.getContext("2d")!;
        srcCtx.drawImage(img, 0, 0);

        // 2. Run segmentation — get mask canvas
        const maskC = await new Promise<HTMLCanvasElement>((res) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seg.onResults((r: any) => res(r.segmentationMask));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seg.send({ image: srcC as any });
        });

        // 3. Build soft-edge person cutout using destination-in + blurred mask
        const personC = document.createElement("canvas");
        personC.width = W; personC.height = H;
        const personCtx = personC.getContext("2d")!;
        personCtx.drawImage(img, 0, 0);           // draw original color image

        // Draw a slightly blurred mask for soft but clean edges
        const blurredMaskC = document.createElement("canvas");
        blurredMaskC.width = W; blurredMaskC.height = H;
        const blurCtx = blurredMaskC.getContext("2d")!;
        blurCtx.filter = `blur(2px)`;
        blurCtx.drawImage(maskC, 0, 0, W, H);     // scale mask to source size
        blurCtx.filter = "none";

        // Use blurred mask as alpha cutout
        personCtx.globalCompositeOperation = "destination-in";
        personCtx.drawImage(blurredMaskC, 0, 0);

        // Return transparent PNG cutout — NO backdrop, NO B&W
        resolve(personC.toDataURL("image/png"));
      } catch (err) {
        console.warn("Person extraction failed, using fallback:", err);
        resolve(colorPhotoUrl);
      }
      return "";
    });
  });
  return result;
}

/**
 * Scan a transparent-background cutout and return the tight bounding box
 * of non-transparent pixels (i.e. the actual person).
 */
function getPersonBounds(
  img: HTMLImageElement,
): { x: number; y: number; w: number; h: number } {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fallback: full frame if no person detected
  if (maxX <= minX || maxY <= minY) {
    return { x: 0, y: 0, w: c.width, h: c.height };
  }

  // 4% padding around tight crop so we don't clip hair/shoulders
  const padX = Math.round((maxX - minX) * 0.04);
  const padY = Math.round((maxY - minY) * 0.04);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  return {
    x,
    y,
    w: Math.min(c.width, maxX + padX) - x,
    h: Math.min(c.height, maxY + padY) - y,
  };
}

/**
 * Fit a person's bounding box into a slot, filling height and capping at slot width.
 * Returns the draw scale factor.
 */
function fitScale(
  bounds: { w: number; h: number },
  slotW: number,
  slotH: number,
): number {
  // Fill the slot height; if the person is too wide for the slot, fit by width instead
  const byHeight = slotH / bounds.h;
  return bounds.w * byHeight > slotW ? slotW / bounds.w : byHeight;
}

/**
 * Compose two person cutouts into a single unified frame.
 * P1 occupies the left half, P2 the right half — each tight-cropped to their
 * actual silhouette, scaled to fill their slot, and bottom-aligned so both
 * stand at the same ground level. B&W film look is then applied.
 * Returns JPEG data URL.
 */
export async function composeDuetFrame(
  p1CutoutUrl: string,
  p2CutoutUrl: string,
): Promise<string> {
  const [p1Img, p2Img] = await Promise.all([
    loadImg(p1CutoutUrl),
    loadImg(p2CutoutUrl),
  ]);

  const W = 600;
  const H = 800;
  const halfW = W / 2; // 300px per person

  const outC = document.createElement("canvas");
  outC.width = W; outC.height = H;
  const ctx = outC.getContext("2d")!;

  // 1. Neutral studio backdrop
  ctx.fillStyle = BOOTH_BACKDROP;
  ctx.fillRect(0, 0, W, H);

  // 2. Find tight bounding box for each person cutout
  const p1Bounds = getPersonBounds(p1Img);
  const p2Bounds = getPersonBounds(p2Img);

  // 3. Draw P1 — left half, bottom-aligned
  const p1Scale  = fitScale(p1Bounds, halfW, H);
  const p1DrawW  = Math.round(p1Bounds.w * p1Scale);
  const p1DrawH  = Math.round(p1Bounds.h * p1Scale);
  const p1X      = Math.round(halfW / 2 - p1DrawW / 2);   // centred in left half
  const p1Y      = H - p1DrawH;                            // bottom-aligned
  ctx.drawImage(p1Img, p1Bounds.x, p1Bounds.y, p1Bounds.w, p1Bounds.h, p1X, p1Y, p1DrawW, p1DrawH);

  // 4. Draw P2 — right half, bottom-aligned
  const p2Scale  = fitScale(p2Bounds, halfW, H);
  const p2DrawW  = Math.round(p2Bounds.w * p2Scale);
  const p2DrawH  = Math.round(p2Bounds.h * p2Scale);
  const p2X      = Math.round(halfW + halfW / 2 - p2DrawW / 2); // centred in right half
  const p2Y      = H - p2DrawH;                                  // bottom-aligned
  ctx.drawImage(p2Img, p2Bounds.x, p2Bounds.y, p2Bounds.w, p2Bounds.h, p2X, p2Y, p2DrawW, p2DrawH);

  // 5. Apply B&W film look to the unified composite
  applyFilmLook(ctx, W, H);

  return outC.toDataURL("image/jpeg", 0.92);
}

/**
 * Legacy: Remove background from a COLOR photo, composite on neutral backdrop,
 * apply B&W film look. Returns processed JPEG data URL.
 * Falls back to applying B&W film look directly if segmentation fails.
 */
export function removeBackground(colorPhotoUrl: string): Promise<string> {
  const result = new Promise<string>((resolve) => {
    _queue = _queue.then(async () => {
      try {
        const seg = await getSegmenter();
        const img = await loadImg(colorPhotoUrl);
        const W = img.naturalWidth, H = img.naturalHeight;

        const srcC = document.createElement("canvas");
        srcC.width = W; srcC.height = H;
        const srcCtx = srcC.getContext("2d")!;
        srcCtx.drawImage(img, 0, 0);

        const maskC = await new Promise<HTMLCanvasElement>((res) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seg.onResults((r: any) => res(r.segmentationMask));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seg.send({ image: srcC as any });
        });

        const personC = document.createElement("canvas");
        personC.width = W; personC.height = H;
        const personCtx = personC.getContext("2d")!;
        personCtx.drawImage(img, 0, 0);

        const blurredMaskC = document.createElement("canvas");
        blurredMaskC.width = W; blurredMaskC.height = H;
        const blurCtx = blurredMaskC.getContext("2d")!;
        blurCtx.filter = `blur(5px)`;
        blurCtx.drawImage(maskC, 0, 0, W, H);
        blurCtx.filter = "none";

        personCtx.globalCompositeOperation = "destination-in";
        personCtx.drawImage(blurredMaskC, 0, 0);

        const outC = document.createElement("canvas");
        outC.width = W; outC.height = H;
        const outCtx = outC.getContext("2d")!;
        outCtx.fillStyle = BOOTH_BACKDROP;
        outCtx.fillRect(0, 0, W, H);
        outCtx.drawImage(personC, 0, 0);

        applyFilmLook(outCtx, W, H);

        resolve(outC.toDataURL("image/jpeg", 0.88));
      } catch (err) {
        console.warn("Background removal failed, using fallback:", err);
        try {
          const img = await loadImg(colorPhotoUrl);
          const W = img.naturalWidth, H = img.naturalHeight;
          const c = document.createElement("canvas");
          c.width = W; c.height = H;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          applyFilmLook(ctx, W, H);
          resolve(c.toDataURL("image/jpeg", 0.88));
        } catch {
          resolve(colorPhotoUrl);
        }
      }
      return "";
    });
  });
  return result;
}
