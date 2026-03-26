"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import PhotoStrip, { PhotoStripHandle } from "./PhotoStrip";
import { captureFromVideo, compressForUrl } from "@/lib/photoUtils";
import { uploadBlob } from "@/lib/blobStore";

type BoothState = "idle" | "permission" | "preview" | "countdown" | "done";

const TOTAL_PHOTOS     = 4;
const COUNTDOWN_SECONDS = 3;

const POSE_HINTS = [
  "Give us your best smile!",
  "Try something silly!",
  "Strike a dramatic pose!",
  "Be yourself — have fun!",
];

const HOW_IT_WORKS = [
  { stat: "3 sec",   detail: "countdown per pose" },
  { stat: "4 shots", detail: "taken automatically" },
  { stat: "B&W",     detail: "film strip, instant download" },
];

interface PhotoBoothProps {
  onHome?: () => void;
}

export default function PhotoBooth({ onHome }: PhotoBoothProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const stripRef   = useRef<PhotoStripHandle>(null);

  const [state,      setState]      = useState<BoothState>("idle");
  const [photos,     setPhotos]     = useState<string[]>([]);
  const [countdown,  setCountdown]  = useState(COUNTDOWN_SECONDS);
  const [currentShot, setCurrentShot] = useState(0);
  const [showFlash,  setShowFlash]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [shareLink,  setShareLink]  = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied,     setCopied]     = useState(false);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then(devs => setHasMultipleCameras(devs.filter(d => d.kind === "videoinput").length > 1))
      .catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async (facing: "user" | "environment" = "user") => {
    stopCamera();
    setError(null);
    setState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setState("preview");
    } catch {
      setError("Camera access denied. Please allow camera permissions and try again.");
      setState("idle");
    }
  }, [stopCamera]);

  // Auto-start camera on mount — no idle screen needed
  useEffect(() => {
    startCamera("user");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach stream once video element is in the DOM
  useEffect(() => {
    if ((state === "preview" || state === "countdown") && videoRef.current && streamRef.current) {
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
    if (!video) return null;
    return captureFromVideo(video, facingMode);
  }, [facingMode]);

  // Countdown + capture sequence
  useEffect(() => {
    if (state !== "countdown") return;

    let shot  = currentShot;
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
          setPhotos(prev => {
            const next     = [...prev, dataUrl];
            const nextShot = shot + 1;
            if (nextShot < TOTAL_PHOTOS) {
              setCurrentShot(nextShot);
              setTimeout(() => { setCountdown(COUNTDOWN_SECONDS); setState("countdown"); }, 1000);
            } else {
              stopCamera();
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

  // Auto-generate duet share link when shooting is done
  useEffect(() => {
    if (state !== "done" || photos.length !== TOTAL_PHOTOS || shareLink || linkLoading) return;
    setLinkLoading(true);
    Promise.all(photos.map(compressForUrl)).then(async compressed => {
      const payload: { phase: "p1"; p1: string[] } = { phase: "p1", p1: compressed };
      try {
        const id = await uploadBlob(payload);
        setShareLink(`${window.location.origin}/#duet=jb_${id}`);
      } catch {
        // share link is optional — fail silently
      }
      setLinkLoading(false);
    });
  }, [state, photos, shareLink, linkLoading]);

  const handleStart = () => setState("countdown");

  const handleRetake = useCallback(async () => {
    setPhotos([]);
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECONDS);
    setShareLink(null);
    setLinkLoading(false);
    setCopied(false);
    await startCamera(facingMode);
  }, [facingMode, startCamera]);

  const handleHome = useCallback(() => {
    stopCamera();
    setPhotos([]);
    setCurrentShot(0);
    if (onHome) onHome(); else setState("idle");
  }, [stopCamera, onHome]);

  // ── Done screen (strip + actions) ────────────────────────────────────────
  if (state === "done" && photos.length === TOTAL_PHOTOS) {
    return (
      <div className="w-full min-h-screen flex flex-col page-transition">
        <BoothHeader label="Regular Booth" onBack={handleHome} />
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col md:grid md:grid-cols-[auto_1fr] md:gap-12 md:items-start gap-6">
          {/* Strip */}
          <div className="flex justify-center">
            <PhotoStrip ref={stripRef} photos={photos} />
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-6 md:pt-4">
            <div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-dark-brown leading-tight" style={{ letterSpacing: "-0.02em" }}>
                Your strip<br />is ready.
              </h2>
              <p className="font-sans text-sm text-warm-brown/65 mt-2 leading-relaxed">
                Four poses. One memory.
              </p>
            </div>

            {/* Button group */}
            <div className="flex flex-col gap-2.5">
              {/* Primary: Save */}
              <button
                onClick={() => stripRef.current?.download()}
                className="leather-btn leather-btn-primary font-sans font-semibold text-sm py-3.5 px-6 rounded-xl flex items-center gap-2.5 w-full justify-center"
              >
                <DownloadIcon />
                Save Photo Strip
              </button>
              {/* Secondary row */}
              <div className="flex gap-2">
                <button
                  onClick={handleRetake}
                  className="leather-btn leather-btn-secondary font-sans font-semibold text-sm py-3 px-5 rounded-xl flex-1"
                >
                  Shoot Again
                </button>
                <button
                  onClick={handleHome}
                  className="leather-btn leather-btn-dark font-sans font-semibold text-sm py-3 px-5 rounded-xl flex-1"
                >
                  Home
                </button>
              </div>
            </div>

            {/* Duet share link */}
            <div className="border-t border-dark-brown/8 pt-5 flex flex-col gap-2">
              <p className="font-sans text-xs font-semibold text-dark-brown">
                Shoot a Duet Strip
              </p>
              <p className="font-sans text-[11px] text-warm-brown/55 leading-relaxed">
                Share this link with a partner — they&apos;ll pose alongside your ghost and you&apos;ll both get a combined strip.
              </p>
              {linkLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-3 border-2 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                  <span className="font-sans text-xs text-warm-brown/50">Generating link…</span>
                </div>
              ) : shareLink ? (
                <>
                  <div className="bg-parchment/60 border border-dark-brown/10 rounded-lg px-3 py-2 font-mono text-[10px] text-warm-brown break-all leading-relaxed mt-1">
                    {shareLink}
                  </div>
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(shareLink); } catch { /* ignore */ }
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className={`leather-btn ${copied ? "leather-btn-dark" : "leather-btn-secondary"} font-sans font-semibold text-sm py-3 px-6 rounded-xl w-full`}
                  >
                    {copied ? "✓ Copied!" : "Copy Duet Link"}
                  </button>
                </>
              ) : null}
            </div>

            <p className="font-sans text-xs text-warm-brown/30 leading-relaxed">
              Your photos never leave your device.
            </p>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── Camera view (main layout) ─────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen flex flex-col">
      <BoothHeader label="Regular Booth" onBack={onHome} />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:grid md:grid-cols-[1fr_232px] md:gap-10 items-start gap-5">

          {/* ── Left: camera column ──────────────────────────────────────── */}
          <div className="w-full flex flex-col items-center gap-4">

            {/* Shot progress dots */}
            <div className="flex gap-2 items-center self-start">
              {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                    i < currentShot
                      ? "bg-burnt-orange border-burnt-orange"
                      : i === currentShot && state === "countdown"
                      ? "bg-gold border-gold scale-125"
                      : "bg-transparent border-warm-brown/30"
                  }`}
                />
              ))}
              {(state === "preview" || state === "countdown") && (
                <span className="font-sans text-xs text-warm-brown/50 ml-1.5">
                  {currentShot + 1} / {TOTAL_PHOTOS}
                </span>
              )}
            </div>

            {/* Camera viewport — always rendered, overlays handle states */}
            <div
              className="relative w-full overflow-hidden rounded-xl border-2 border-dark-brown/80 shadow-2xl bg-film-black"
              style={{ aspectRatio: "4/3" }}
            >
              {/* Permission loading */}
              {state === "permission" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
                  <div className="w-10 h-10 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                  <p className="font-sans text-cream/50 text-xs tracking-wider uppercase">Accessing camera…</p>
                </div>
              )}

              {/* Error / idle */}
              {state === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-6 text-center">
                  <CameraOffIcon />
                  {error && <p className="font-sans text-sm text-cream/60 leading-relaxed max-w-[220px]">{error}</p>}
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="leather-btn leather-btn-primary font-sans font-semibold text-sm py-2.5 px-6 rounded-lg"
                  >
                    Allow Camera
                  </button>
                </div>
              )}

              {/* Live video */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${state === "preview" || state === "countdown" ? "" : "hidden"}`}
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                playsInline muted autoPlay
              />

              {/* Countdown number */}
              {state === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="bg-black/30 rounded-full w-20 h-20 flex items-center justify-center animate-count-pulse">
                    <span className="font-serif text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
                  </div>
                </div>
              )}

              {/* Pose hint */}
              {state === "countdown" && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10">
                  <span className="bg-black/50 text-white font-sans text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                    {POSE_HINTS[currentShot]}
                  </span>
                </div>
              )}

              {/* Flash */}
              {showFlash && <div className="absolute inset-0 bg-white z-20 animate-flash pointer-events-none" />}

              {/* Film corners */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-gold/50 pointer-events-none" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-gold/50 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-gold/50 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-gold/50 pointer-events-none" />
            </div>

            {/* Controls */}
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
                    <button onClick={flipCamera} title="Flip camera"
                      className="leather-btn leather-btn-secondary font-sans text-sm py-3.5 px-4 rounded-lg"
                    >
                      <FlipIcon />
                    </button>
                  )}
                </>
              )}
              {state === "countdown" && (
                <p className="flex-1 text-center font-sans text-sm text-warm-brown/60 py-3">
                  Pose {currentShot + 1} of {TOTAL_PHOTOS} — get ready…
                </p>
              )}
              {(state === "permission" || state === "idle") && (
                <div className="flex-1 h-12" /> /* placeholder to avoid layout jump */
              )}
            </div>

            {/* Mobile-only info strip */}
            <div className="md:hidden w-full flex items-center justify-center gap-5 py-2 border-t border-dark-brown/8">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.stat} className="text-center">
                  <p className="font-serif text-sm font-bold text-dark-brown">{item.stat}</p>
                  <p className="font-sans text-[10px] text-warm-brown/50 leading-tight mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: info sidebar (desktop only) ───────────────────────── */}
          <aside className="hidden md:flex flex-col gap-8 pt-9">
            <div className="flex flex-col gap-6">
              <p className="font-sans text-[10px] text-burnt-orange uppercase tracking-[0.2em] font-semibold">
                How it works
              </p>
              {HOW_IT_WORKS.map((item) => (
                <div key={item.stat}>
                  <p className="font-serif text-2xl font-bold text-dark-brown leading-none" style={{ letterSpacing: "-0.02em" }}>
                    {item.stat}
                  </p>
                  <p className="font-sans text-xs text-warm-brown/55 mt-1 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-dark-brown/8 pt-6 flex flex-col gap-2">
              <p className="font-sans text-xs text-warm-brown/35 leading-relaxed">
                Photos never leave your device. No account, no cloud.
              </p>
            </div>
          </aside>

        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── Shared header ────────────────────────────────────────────────────────────

function BoothHeader({ label, onBack }: { label: string; onBack?: () => void }) {
  return (
    <header className="w-full sticky top-0 z-20 bg-cream/92 backdrop-blur-md border-b border-dark-brown/8">
      <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="font-sans text-sm text-warm-brown/50 hover:text-warm-brown transition-colors flex items-center gap-1.5 shrink-0"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <span className="font-serif text-lg font-bold text-burnt-orange tracking-tight">CitoFoto</span>
          <span className="font-sans text-[10px] text-warm-brown/40 uppercase tracking-[0.15em] hidden sm:block">
            / {label}
          </span>
        </div>
        <div className="w-14 shrink-0" />
      </div>
    </header>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function CameraOffIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cream/20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}
