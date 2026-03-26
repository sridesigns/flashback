/**
 * Client-side background removal using MediaPipe Selfie Segmentation.
 * Extracts the person from each photo and composites them onto a
 * neutral "photo booth backdrop" so both people look like they're
 * in the same studio regardless of where they actually are.
 *
 * Model (~4 MB) is fetched from jsDelivr CDN and cached by the browser.
 * Processing is serialized to avoid the single-callback MediaPipe limitation.
 */

// Neutral warm-gray photo booth backdrop — looks like a studio curtain in B&W
export const BOOTH_BACKDROP = "#C2B8AE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _seg: any = null;
let _initPromise: Promise<unknown> | null = null;

async function getSegmenter() {
  if (_seg) return _seg;
  if (!_initPromise) {
    _initPromise = (async () => {
      // Dynamic import keeps this out of the SSR bundle
      const { SelfieSegmentation } = await import("@mediapipe/selfie_segmentation");
      const seg = new SelfieSegmentation({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${file}`,
      });
      // modelSelection 1 = landscape (better at capturing full body / wider shots)
      seg.setOptions({ modelSelection: 1 });
      _seg = seg;
      return seg;
    })();
  }
  return _initPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Serialization queue — MediaPipe stores only ONE onResults callback at a time.
// Running sends concurrently would cause callbacks to overwrite each other.
let _queue: Promise<unknown> = Promise.resolve();

async function processOne(
  img: HTMLImageElement,
  bgR: number, bgG: number, bgB: number
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seg: any = await getSegmenter();
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  return new Promise<string>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    seg.onResults((results: any) => {
      try {
        const maskCanvas = document.createElement("canvas");
        maskCanvas.width = w; maskCanvas.height = h;
        const mCtx = maskCanvas.getContext("2d")!;
        mCtx.drawImage(results.segmentationMask, 0, 0, w, h);
        const maskData = mCtx.getImageData(0, 0, w, h).data;

        const imgCanvas = document.createElement("canvas");
        imgCanvas.width = w; imgCanvas.height = h;
        const iCtx = imgCanvas.getContext("2d")!;
        iCtx.drawImage(img, 0, 0, w, h);
        const imgData = iCtx.getImageData(0, 0, w, h).data;

        // Blend: keep person pixels, replace background with booth backdrop
        // MediaPipe mask: red channel ≈ 255 where person, ≈ 0 where background.
        const out = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < maskData.length; i += 4) {
          const p = maskData[i] / 255;   // person probability 0–1
          const q = 1 - p;               // background probability
          out[i]     = imgData[i]     * p + bgR * q;
          out[i + 1] = imgData[i + 1] * p + bgG * q;
          out[i + 2] = imgData[i + 2] * p + bgB * q;
          out[i + 3] = 255;
        }

        const outCanvas = document.createElement("canvas");
        outCanvas.width = w; outCanvas.height = h;
        outCanvas.getContext("2d")!.putImageData(new ImageData(out, w, h), 0, 0);
        resolve(outCanvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        reject(e);
      }
    });

    seg.send({ image: img }).catch(reject);
  });
}

/**
 * Remove background from a single photo and replace with a neutral booth backdrop.
 * Calls are automatically serialized — safe to call for multiple photos in parallel.
 * Falls back to the original photo if segmentation fails.
 */
export function removeBackground(
  dataUrl: string,
  bgHex: string = BOOTH_BACKDROP
): Promise<string> {
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);

  // Chain onto the queue so each image is processed one at a time
  const task: Promise<string> = _queue.then(
    () => loadImage(dataUrl).then(img => processOne(img, r, g, b)),
    () => loadImage(dataUrl).then(img => processOne(img, r, g, b))
  ).catch(() => dataUrl); // graceful fallback

  // Update queue tail (swallow errors so the queue never breaks)
  _queue = task.then(() => undefined, () => undefined);

  return task;
}
