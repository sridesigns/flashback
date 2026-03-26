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
 * Compose two person cutouts into a single unified frame.
 * Both people are placed on a shared neutral backdrop at 4:3 aspect ratio,
 * positioned naturally side by side (overlapping slightly in center).
 * B&W film look is applied to the unified composite.
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

  // Higher-res portrait canvas (3:4) for crisp output
  const W = 600;
  const H = 800;

  const outC = document.createElement("canvas");
  outC.width = W; outC.height = H;
  const ctx = outC.getContext("2d")!;

  // 1. Fill with neutral studio backdrop
  ctx.fillStyle = BOOTH_BACKDROP;
  ctx.fillRect(0, 0, W, H);

  // 2. Draw P1 — positioned left-of-center, natural scale
  //    People overlap in the middle like sitting shoulder-to-shoulder
  const p1H = H;
  const p1W = Math.round(p1Img.naturalWidth * (p1H / p1Img.naturalHeight));
  const p1X = Math.round(W * 0.40 - p1W * 0.5); // center of P1 at 40%
  const p1Y = 0;
  ctx.drawImage(p1Img, p1X, p1Y, p1W, p1H);

  // 3. Draw P2 — positioned right-of-center, overlapping P1
  const p2H = H;
  const p2W = Math.round(p2Img.naturalWidth * (p2H / p2Img.naturalHeight));
  const p2X = Math.round(W * 0.60 - p2W * 0.5); // center of P2 at 60%
  const p2Y = 0;
  ctx.drawImage(p2Img, p2X, p2Y, p2W, p2H);

  // 4. Apply B&W film look to the unified composite
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
