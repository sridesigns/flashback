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
 *
 * Approach: full-frame z-stack
 * ─────────────────────────────
 * Both cutouts are kept at their natural frame proportions (no tight-crop
 * rescaling that makes one person look larger than the other).  Each is
 * scaled to the same PERSON_W = 75% of canvas width.  Because both sources
 * are 3:4 portrait (360×480 or 540×720), this always yields the same draw
 * height for both persons — consistent, equal sizing.
 *
 *   P1  → left-aligned  (x = 0,        right edge at 450)
 *   P2  → right-aligned (x = 150, right edge at canvas edge)
 *   Overlap zone = x 150–450 (300 px) — P2 drawn on top (z-stacked)
 *
 * Transparent background pixels in the cutouts show the neutral backdrop,
 * so where P2's background is transparent the backdrop (not P1's body) shows
 * through — clean segmentation edges.
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

  const outC = document.createElement("canvas");
  outC.width = W; outC.height = H;
  const ctx = outC.getContext("2d")!;

  // 1. Neutral studio backdrop
  ctx.fillStyle = BOOTH_BACKDROP;
  ctx.fillRect(0, 0, W, H);

  // 2. Fixed person width — both persons scaled to the same width so their
  //    apparent size is determined by how large they were in their own frame,
  //    not by arbitrary normalization.
  //    75 % of W = 450 px.  For a 3:4 portrait source the resulting draw
  //    height = 450 × (4/3) = 600 px  (75 % of canvas height) for both persons.
  const PERSON_W = Math.round(W * 0.75); // 450 px

  // 3. P1 — left-aligned, bottom-aligned
  const p1DrawW = PERSON_W;
  const p1DrawH = Math.round(p1Img.naturalHeight * (PERSON_W / p1Img.naturalWidth));
  ctx.drawImage(
    p1Img,
    0, 0, p1Img.naturalWidth, p1Img.naturalHeight,
    0, H - p1DrawH, p1DrawW, p1DrawH,
  );

  // 4. P2 — right-aligned, bottom-aligned, drawn on top (z-stacked in front)
  const p2DrawW = PERSON_W;
  const p2DrawH = Math.round(p2Img.naturalHeight * (PERSON_W / p2Img.naturalWidth));
  ctx.drawImage(
    p2Img,
    0, 0, p2Img.naturalWidth, p2Img.naturalHeight,
    W - p2DrawW, H - p2DrawH, p2DrawW, p2DrawH,
  );

  // 5. Apply B&W film look
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
