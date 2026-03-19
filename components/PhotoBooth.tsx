"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import PhotoStrip from "./PhotoStrip";

type BoothState = "idle" | "permission" | "preview" | "countdown" | "capturing" | "done";

const TOTAL_PHOTOS = 4;
const COUNTDOWN_SECONDS = 3;

const POSE_HINTS = [
  "Give us your best smile!",
  "Try something silly!",
  "Strike a dramatic pose!",
  "Be yourself — have fun!",
];

interface PhotoBoothProps {
  onHome?: () => void;
}

export default function PhotoBooth({ onHome }: PhotoBoothProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<BoothState>("idle");
  const [photos, setPhotos] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [currentShot, setCurrentShot] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Always start on front (selfie) camera — "user" facing.
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Detect if there are multiple cameras (to show/hide flip button).
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(() => setHasMultipleCameras(false));
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async (facing: "user" | "environment" = "user") => {
    stopCamera();
    setError(null);
    setState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      // Set state first so the <video> element mounts, then the effect below
      // assigns srcObject once the element is actually in the DOM.
      setState("preview");
    } catch (err) {
      console.error(err);
      setError(
        "Camera access denied. Please allow camera permissions and try again."
      );
      setState("idle");
    }
  }, [stopCamera]);

  // Assign the stream to the video element after it mounts.
  // The <video> is only rendered when state === "preview" | "countdown", so
  // we must wait for the DOM node to exist before setting srcObject.
  useEffect(() => {
    if (
      (state === "preview" || state === "countdown") &&
      videoRef.current &&
      streamRef.current
    ) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [state]);

  const flipCamera = useCallback(async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, startCamera]);

  const capturePhoto = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Mirror for front camera
    if (facingMode === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    // Apply B&W + contrast + vignette
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // BT.709 luminance
      let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // Boost contrast
      lum = Math.min(255, Math.max(0, (lum - 128) * 1.2 + 128));
      // Slight warm sepia tint
      data[i] = Math.min(255, lum * 1.02);
      data[i + 1] = Math.min(255, lum * 0.98);
      data[i + 2] = Math.min(255, lum * 0.92);
    }
    ctx.putImageData(imageData, 0, 0);

    // Vignette overlay
    const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    return canvas.toDataURL("image/jpeg", 0.88);
  }, [facingMode]);

  const startSession = useCallback(async () => {
    setPhotos([]);
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECONDS);
    await startCamera(facingMode);
  }, [facingMode, startCamera]);

  // Countdown + capture sequence
  useEffect(() => {
    if (state !== "countdown") return;

    let shot = currentShot;
    let count = COUNTDOWN_SECONDS;
    setCountdown(count);

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        const dataUrl = capturePhoto();
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 400);

        if (dataUrl) {
          setPhotos((prev) => {
            const next = [...prev, dataUrl];
            const nextShot = shot + 1;
            if (nextShot < TOTAL_PHOTOS) {
              setCurrentShot(nextShot);
              setTimeout(() => {
                setCountdown(COUNTDOWN_SECONDS);
                setState("countdown");
              }, 1000);
            } else {
              setState("done");
            }
            return next;
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currentShot]);

  const handleStart = () => setState("countdown");

  const handleRetake = async () => {
    setPhotos([]);
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECONDS);
    setState("preview");
    await startCamera(facingMode);
  };

  const handleHome = () => {
    stopCamera();
    setPhotos([]);
    setCurrentShot(0);
    if (onHome) {
      onHome();
    } else {
      setState("idle");
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center">
      {/* Header */}
      <header className="w-full text-center py-3 md:py-5 px-4 border-b border-parchment/60 bg-cream sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {onHome ? (
            <button onClick={onHome} className="font-sans text-xs text-warm-brown/60 hover:text-warm-brown transition-colors px-2 py-1">
              ← Back
            </button>
          ) : <div className="w-12" />}
          <div className="text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-burnt-orange tracking-tight leading-tight">
              Flashback
            </h1>
            <p className="font-sans text-xs text-warm-brown mt-0.5 tracking-widest uppercase">
              Regular Booth
            </p>
          </div>
          <div className="w-12" />
        </div>
      </header>

      <div className="w-full max-w-lg px-4 pb-6 flex flex-col items-center gap-4 mt-4">
        {state === "idle" && <IdleScreen onStart={startSession} error={error} />}

        {state === "permission" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-12 h-12 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
            <p className="font-sans text-warm-brown text-sm">Accessing camera…</p>
          </div>
        )}

        {(state === "preview" || state === "countdown") && (
          <div className="w-full flex flex-col items-center gap-4">
            {/* Shot indicators */}
            <div className="flex gap-2 items-center">
              {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                    i < currentShot
                      ? "bg-burnt-orange border-burnt-orange"
                      : i === currentShot && state === "countdown"
                      ? "bg-gold border-gold scale-125"
                      : "bg-transparent border-warm-brown/40"
                  }`}
                />
              ))}
              <span className="font-sans text-xs text-warm-brown ml-2">
                {currentShot + 1} / {TOTAL_PHOTOS}
              </span>
            </div>

            {/* Camera viewport */}
            <div
              className="relative w-full overflow-hidden rounded-lg border-4 border-dark-brown shadow-2xl bg-film-black"
              style={{ aspectRatio: "4/3" }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                playsInline
                muted
                autoPlay
              />

              {state === "countdown" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <div className="bg-black/30 rounded-full w-24 h-24 flex items-center justify-center animate-count-pulse">
                    <span className="font-serif text-6xl font-bold text-white drop-shadow-lg">
                      {countdown}
                    </span>
                  </div>
                </div>
              )}

              {state === "countdown" && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10">
                  <span className="bg-black/50 text-white font-sans text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                    {POSE_HINTS[currentShot]}
                  </span>
                </div>
              )}

              {showFlash && (
                <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />
              )}

              {/* Film frame corners */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-gold/70" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-gold/70" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-gold/70" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-gold/70" />
            </div>

            <div className="flex gap-3 w-full">
              {state === "preview" && (
                <>
                  <button
                    onClick={handleStart}
                    className="leather-btn leather-btn-primary flex-1 font-sans font-semibold text-base py-3.5 px-6 rounded-lg"
                  >
                    Start Shoot
                  </button>
                  {hasMultipleCameras && (
                    <button
                      onClick={flipCamera}
                      title="Flip camera"
                      className="leather-btn leather-btn-secondary font-sans text-sm py-3.5 px-4 rounded-lg"
                    >
                      <FlipIcon />
                    </button>
                  )}
                </>
              )}
              {state === "countdown" && (
                <div className="flex-1 text-center font-sans text-sm text-warm-brown">
                  Get ready… pose {currentShot + 1} of {TOTAL_PHOTOS}
                </div>
              )}
            </div>
          </div>
        )}

        {state === "done" && photos.length === TOTAL_PHOTOS && (
          <div className="w-full flex flex-col items-center gap-6 page-transition">
            <div className="text-center">
              <h2 className="font-serif text-2xl font-bold text-burnt-orange">
                Your Strip is Ready!
              </h2>
              <p className="font-sans text-sm text-warm-brown mt-1">
                Four poses, one memory.
              </p>
            </div>
            <PhotoStrip photos={photos} />
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRetake}
                className="leather-btn leather-btn-secondary flex-1 font-sans font-semibold text-sm py-3 px-4 rounded-lg"
              >
                Retake
              </button>
              <button
                onClick={handleHome}
                className="leather-btn leather-btn-dark font-sans font-semibold text-sm py-3 px-4 rounded-lg"
              >
                Home
              </button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function IdleScreen({ onStart, error }: { onStart: () => void; error: string | null }) {
  return (
    <div className="flex flex-col items-center gap-5 w-full py-2 page-transition">
      <div className="flex items-center gap-3">
        <FilmReel />
        <p className="font-sans text-xs tracking-widest uppercase text-warm-brown/70">Est. 2025</p>
        <FilmReel />
      </div>

      {/* Illustration */}
      <div className="relative w-44 h-44 md:w-56 md:h-56 flex items-center justify-center">
        <div className="w-20 bg-dark-brown rounded-sm shadow-2xl flex flex-col gap-1 p-1.5 rotate-[-6deg] absolute left-8 top-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-full bg-warm-brown/30 rounded-sm" style={{ height: "36px" }} />
          ))}
        </div>
        <div className="w-20 bg-dark-brown rounded-sm shadow-2xl flex flex-col gap-1 p-1.5 rotate-[5deg] absolute right-8 top-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-full bg-warm-brown/30 rounded-sm" style={{ height: "36px" }} />
          ))}
        </div>
        <div className="relative z-10 w-24 h-24 bg-burnt-orange rounded-full flex items-center justify-center shadow-xl">
          <CameraIcon className="w-12 h-12 text-cream" />
        </div>
      </div>

      <div className="text-center max-w-xs">
        <h2 className="font-serif text-xl font-semibold text-dark-brown mb-2">How it works</h2>
        <ol className="font-sans text-sm text-warm-brown space-y-1.5 text-left list-none">
          {[
            "Tap Start to access your camera",
            "You get 3 seconds per pose — smile!",
            "4 photos are taken automatically",
            "Download your retro photo strip",
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-burnt-orange/10 text-burnt-orange font-semibold text-xs flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <p className="font-sans text-sm text-deep-orange bg-deep-orange/10 border border-deep-orange/20 rounded-lg px-4 py-2.5 text-center max-w-xs">
          {error}
        </p>
      )}

      <button
        onClick={onStart}
        className="leather-btn leather-btn-primary font-sans font-semibold text-lg py-4 px-10 rounded-xl"
      >
        Open the Booth
      </button>

      <p className="font-sans text-xs text-warm-brown/50 text-center max-w-[260px]">
        Camera access required. Your photos never leave your device.
      </p>
    </div>
  );
}

function FilmReel() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-warm-brown/50">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="6" r="2" fill="currentColor" />
      <circle cx="16" cy="26" r="2" fill="currentColor" />
      <circle cx="6" cy="16" r="2" fill="currentColor" />
      <circle cx="26" cy="16" r="2" fill="currentColor" />
      <circle cx="9" cy="9" r="2" fill="currentColor" />
      <circle cx="23" cy="9" r="2" fill="currentColor" />
      <circle cx="9" cy="23" r="2" fill="currentColor" />
      <circle cx="23" cy="23" r="2" fill="currentColor" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}
