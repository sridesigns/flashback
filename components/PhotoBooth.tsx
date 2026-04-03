"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RotateCcw } from "lucide-react";
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
      <div className="w-full min-h-screen flex flex-col page-transition booth-bg">
        <BoothHeader label="Regular Booth" onBack={handleHome} />
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col md:grid md:grid-cols-[auto_1fr] md:gap-12 md:items-start gap-6">
          {/* Strip */}
          <div className="flex justify-center">
            <PhotoStrip ref={stripRef} photos={photos} />
          </div>
          {/* Actions */}
          <div className="flex flex-col gap-6 md:pt-4">
            <div>
              <h2 className="font-handwritten text-4xl font-semibold leading-tight" style={{ color: "#212E24" }}>
                Your strip<br />is ready.
              </h2>
              <p className="font-typewriter text-sm mt-2 leading-relaxed" style={{ color: "rgba(33,46,36,0.5)" }}>
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
                Start a Pose &amp; Pass
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
                    {copied ? "✓ Copied!" : "Copy Pose & Pass Link"}
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
    <div className="w-full min-h-screen flex flex-col booth-bg">
      {/* Paper texture — same as landing page */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg className="grain-layer absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-[0.032]" xmlns="http://www.w3.org/2000/svg">
          <filter id="paper-booth"><feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0.15" /></filter>
          <rect width="100%" height="100%" filter="url(#paper-booth)" />
        </svg>
        <div className="absolute inset-0 opacity-[0.028]" style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 28px, #212E24 28px, #212E24 29px)" }} />
      </div>

      <BoothHeader label="Regular Booth" onBack={onHome} />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-10 relative z-10">
        <div className="flex flex-col md:grid md:grid-cols-[1fr_220px] md:gap-10 items-start gap-5">

          {/* ── Left: camera column ──────────────────────────────────────── */}
          <div className="w-full flex flex-col items-center gap-4">

            {/* Camera viewport */}
            <div
              className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-xl bg-[#D9D5CF]"
              style={{ aspectRatio: "3/4", border: "1.5px solid rgba(33,46,36,0.18)", boxShadow: "0 4px 24px rgba(33,46,36,0.10)" }}
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

              {/* Corner marks — subtle editorial style */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-[rgba(33,46,36,0.25)] pointer-events-none" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-[rgba(33,46,36,0.25)] pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-[rgba(33,46,36,0.25)] pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-[rgba(33,46,36,0.25)] pointer-events-none" />
            </div>

            {/* Thumbnail slots — fill as photos are captured */}
            <div className="flex gap-2.5 justify-center w-full max-w-[320px]">
              {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded flex items-center justify-center transition-all duration-300 ${
                    photos[i] ? "shadow-sm" : ""
                  }`}
                  style={{
                    width: "22%",
                    aspectRatio: "3/4",
                    border: photos[i]
                      ? "1.5px solid rgba(33,46,36,0.4)"
                      : "1.5px dashed rgba(33,46,36,0.18)",
                    background: photos[i] ? "transparent" : "rgba(33,46,36,0.02)",
                  }}
                >
                  {photos[i] ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photos[i]} alt={`Shot ${i + 1}`} className="absolute inset-0 w-full h-full object-cover bw-photo" />
                      <span className="absolute top-0.5 left-0.5 bg-[rgba(33,46,36,0.55)] text-[#FAF6ED] text-[7px] font-typewriter font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-10">
                        {i + 1}
                      </span>
                    </>
                  ) : (
                    <span className="font-typewriter text-xs text-[rgba(33,46,36,0.2)]">{i + 1}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Shutter + controls row */}
            <div className="flex items-center justify-center gap-5 w-full max-w-[320px]">
              {state === "preview" && (
                <>
                  {/* Retake / flip */}
                  <div className="flex items-center gap-3 flex-1 justify-end">
                    {hasMultipleCameras && (
                      <button onClick={flipCamera} title="Flip camera"
                        className="font-typewriter text-xs text-[rgba(33,46,36,0.5)] hover:text-[rgba(33,46,36,0.8)] transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw size={14} /> Retake
                      </button>
                    )}
                  </div>
                  {/* Shutter */}
                  <button
                    onClick={handleStart}
                    className="w-[64px] h-[64px] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
                    style={{ border: "3px solid rgba(33,46,36,0.75)", background: "transparent" }}
                    title="Start Shoot"
                  >
                    <div className="w-[48px] h-[48px] rounded-full bg-[#212E24]" />
                  </button>
                  <div className="flex-1" />
                </>
              )}
              {state === "countdown" && (
                <p className="text-center font-typewriter text-sm text-[rgba(33,46,36,0.45)] py-3">
                  Pose {currentShot + 1} of {TOTAL_PHOTOS} — get ready…
                </p>
              )}
              {(state === "permission" || state === "idle") && <div className="h-16" />}
            </div>

            {/* Mobile-only info strip */}
            <div className="md:hidden w-full flex items-center justify-center gap-5 py-2" style={{ borderTop: "1px solid rgba(33,46,36,0.08)" }}>
              {HOW_IT_WORKS.map((item) => (
                <div key={item.stat} className="text-center">
                  <p className="font-handwritten text-base font-semibold text-[#212E24]">{item.stat}</p>
                  <p className="font-typewriter text-[10px] text-[rgba(33,46,36,0.45)] leading-tight mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: info sidebar (desktop only) ───────────────────────── */}
          <aside className="hidden md:flex flex-col gap-7 pt-8 relative">

            {/* Hand-drawn arrow pointing left toward the camera */}
            <div className="absolute -left-14 top-1 pointer-events-none" aria-hidden="true">
              <svg width="72" height="96" viewBox="0 0 72 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  className="draw-arrow-path"
                  d="M62,6 C55,10 46,18 38,30 C28,46 18,62 10,78 C8,82 6,86 5,89"
                  stroke="#212E24"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.5"
                />
                <path
                  className="draw-arrow-path"
                  d="M2,83 C3,85 4,88 5,89 C7,89 10,90 13,90"
                  stroke="#212E24"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.5"
                />
              </svg>
            </div>

            {/* "How it works" — handwritten */}
            <p className="font-handwritten text-2xl text-[#212E24]" style={{ lineHeight: "1.1" }}>
              How it works
            </p>

            <div className="flex flex-col gap-5">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.stat}>
                  <p className="font-handwritten text-3xl font-semibold text-[#212E24] leading-none">
                    {item.stat}
                  </p>
                  <p className="font-typewriter text-xs text-[rgba(33,46,36,0.45)] mt-1 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5 pt-4" style={{ borderTop: "1px solid rgba(33,46,36,0.08)" }}>
              <p className="font-typewriter text-xs text-[rgba(33,46,36,0.3)] leading-relaxed">
                Photos never leave your device.<br />No account, no cloud.
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
    <header className="w-full sticky top-0 z-20 backdrop-blur-md" style={{ background: "rgba(250,246,237,0.92)", borderBottom: "1px solid rgba(33,46,36,0.07)" }}>
      <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="font-typewriter text-sm hover:opacity-60 transition-opacity flex items-center gap-1.5 shrink-0"
          style={{ color: "rgba(33,46,36,0.5)" }}
        >
          ← Back
        </button>
        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          <span className="font-typewriter text-base font-semibold tracking-tight" style={{ color: "#212E24" }}>CitoFoto</span>
          <span className="font-typewriter text-[10px] uppercase tracking-[0.15em] hidden sm:block" style={{ color: "rgba(33,46,36,0.35)" }}>
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

