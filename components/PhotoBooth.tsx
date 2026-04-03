"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import PhotoStrip, { PhotoStripHandle } from "./PhotoStrip";
import { captureFromVideo, compressForUrl } from "@/lib/photoUtils";
import { uploadBlob } from "@/lib/blobStore";

type BoothState = "idle" | "permission" | "preview" | "countdown" | "done";

const TOTAL_PHOTOS      = 4;
const COUNTDOWN_SECONDS = 3;

const POSE_HINTS = [
  "Give us your best smile!",
  "Try something silly!",
  "Strike a dramatic pose!",
  "Be yourself — have fun!",
];

const HOW_IT_WORKS = [
  { stat: "3 sec",   detail: "Countdown per pose" },
  { stat: "4 shots", detail: "Taken automatically" },
  { stat: "B&W",     detail: "Film strip, instant download" },
];

const BRAND   = "#E8593C";
const CREAM   = "#FDF6EB";
const BODY    = "#7A6E62";
const BRAND_A = (a: number) => `rgba(232,89,60,${a})`;

interface PhotoBoothProps {
  onHome?: () => void;
}

export default function PhotoBooth({ onHome }: PhotoBoothProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stripRef  = useRef<PhotoStripHandle>(null);

  const [state,       setState]      = useState<BoothState>("idle");
  const [photos,      setPhotos]     = useState<string[]>([]);
  const [countdown,   setCountdown]  = useState(COUNTDOWN_SECONDS);
  const [currentShot, setCurrentShot] = useState(0);
  const [showFlash,   setShowFlash]  = useState(false);
  const [error,       setError]      = useState<string | null>(null);
  const [facingMode,  setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [shareLink,   setShareLink]  = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied,      setCopied]     = useState(false);

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

  useEffect(() => { startCamera("user"); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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

  useEffect(() => {
    if (state !== "done" || photos.length !== TOTAL_PHOTOS || shareLink || linkLoading) return;
    setLinkLoading(true);
    Promise.all(photos.map(compressForUrl)).then(async compressed => {
      const payload: { phase: "p1"; p1: string[] } = { phase: "p1", p1: compressed };
      try {
        const id = await uploadBlob(payload);
        setShareLink(`${window.location.origin}/#duet=jb_${id}`);
      } catch { /* fail silently */ }
      setLinkLoading(false);
    });
  }, [state, photos, shareLink, linkLoading]);

  const handleStart  = () => setState("countdown");

  const handleRetake = useCallback(async () => {
    setPhotos([]); setCurrentShot(0); setCountdown(COUNTDOWN_SECONDS);
    setShareLink(null); setLinkLoading(false); setCopied(false);
    await startCamera(facingMode);
  }, [facingMode, startCamera]);

  const handleHome = useCallback(() => {
    stopCamera(); setPhotos([]); setCurrentShot(0);
    if (onHome) onHome(); else setState("idle");
  }, [stopCamera, onHome]);

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (state === "done" && photos.length === TOTAL_PHOTOS) {
    return (
      <div className="w-full min-h-screen flex flex-col" style={{ background: CREAM }}>
        <GrainTexture id="paper-done" />
        <BoothHeader onBack={handleHome} />
        <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-10 flex flex-col md:grid md:grid-cols-[auto_1fr] md:gap-14 md:items-start gap-8 relative z-10">
          <div className="flex justify-center">
            <PhotoStrip ref={stripRef} photos={photos} />
          </div>
          <div className="flex flex-col gap-6 md:pt-2">
            <div>
              <h2 className="font-typewriter text-4xl font-semibold leading-tight" style={{ color: BRAND, fontStyle: "italic" }}>
                Your strip<br />is ready.
              </h2>
              <p className="font-sans text-sm mt-2 leading-relaxed" style={{ color: BODY }}>
                Four poses. One memory.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => stripRef.current?.download()}
                className="font-sans font-medium text-sm py-3.5 px-6 rounded-xl flex items-center gap-2.5 w-full justify-center transition-opacity hover:opacity-80"
                style={{ background: BRAND, color: CREAM }}
              >
                <DownloadIcon /> Save Photo Strip
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleRetake}
                  className="font-sans font-medium text-sm py-3 px-5 rounded-xl flex-1 transition-opacity hover:opacity-80"
                  style={{ background: "#C8B0A0", color: "#1A1713" }}
                >
                  Shoot Again
                </button>
                <button
                  onClick={handleHome}
                  className="font-sans font-medium text-sm py-3 px-5 rounded-xl flex-1 transition-opacity hover:opacity-80"
                  style={{ background: BRAND_A(0.1), color: BRAND, border: `1px solid ${BRAND_A(0.2)}` }}
                >
                  Home
                </button>
              </div>
            </div>
            <div className="pt-5 flex flex-col gap-2" style={{ borderTop: `1px solid ${BRAND_A(0.1)}` }}>
              <p className="font-sans text-xs font-medium" style={{ color: BRAND }}>Start a Pose &amp; Pass</p>
              <p className="font-sans text-[11px] leading-relaxed" style={{ color: BODY }}>
                Share this link with a partner — they&apos;ll pose alongside your ghost and you&apos;ll both get a combined strip.
              </p>
              {linkLoading ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                  <span className="font-sans text-xs" style={{ color: BODY }}>Generating link…</span>
                </div>
              ) : shareLink ? (
                <>
                  <div className="rounded-lg px-3 py-2 font-mono text-[10px] break-all leading-relaxed mt-1" style={{ background: BRAND_A(0.05), border: `1px solid ${BRAND_A(0.15)}`, color: BODY }}>
                    {shareLink}
                  </div>
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(shareLink); } catch { /* ignore */ }
                      setCopied(true); setTimeout(() => setCopied(false), 2500);
                    }}
                    className="font-sans font-medium text-sm py-3 px-6 rounded-xl w-full transition-opacity hover:opacity-80"
                    style={{ background: copied ? "#1A1713" : "#C8B0A0", color: copied ? CREAM : "#1A1713" }}
                  >
                    {copied ? "✓ Copied!" : "Copy Pose & Pass Link"}
                  </button>
                </>
              ) : null}
            </div>
            <p className="font-sans text-xs leading-relaxed" style={{ color: BRAND_A(0.4) }}>
              Your photos never leave your device.
            </p>
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen flex flex-col" style={{ background: CREAM }}>
      <GrainTexture id="paper-booth" />
      <BoothHeader onBack={onHome} />

      {/* Two-column body */}
      <div className="flex-1 flex flex-col md:flex-row relative z-10">

        {/* ── Left: fluid camera column ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8">

          {/* Viewfinder */}
          <div
            className="relative w-full mx-auto overflow-hidden rounded-2xl"
            style={{
              maxWidth: "min(420px, 100%)",
              aspectRatio: "3/4",
              background: "#E8E4DE",
              border: `1.5px solid ${BRAND_A(0.2)}`,
              boxShadow: `0 6px 32px ${BRAND_A(0.08)}`,
            }}
          >
            {/* Permission loading */}
            {state === "permission" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
                <div className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                <p className="font-sans text-xs tracking-wider" style={{ color: BODY }}>Accessing camera…</p>
              </div>
            )}

            {/* Error / idle */}
            {state === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-6 text-center">
                {error && <p className="font-sans text-sm leading-relaxed max-w-[220px]" style={{ color: BODY }}>{error}</p>}
                <button
                  onClick={() => startCamera(facingMode)}
                  className="font-sans font-medium text-sm py-2.5 px-6 rounded-lg"
                  style={{ background: BRAND, color: CREAM }}
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
                  <span className="font-typewriter text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
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

            {/* Corner brackets — brand color low opacity */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 pointer-events-none rounded-tl-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 pointer-events-none rounded-tr-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 pointer-events-none rounded-bl-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 pointer-events-none rounded-br-sm" style={{ borderColor: BRAND_A(0.35) }} />
          </div>

          {/* 4 frame thumbnail slots */}
          <div className="flex gap-2.5 w-full mx-auto" style={{ maxWidth: "min(420px, 100%)" }}>
            {Array.from({ length: TOTAL_PHOTOS }).map((_, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-lg flex items-center justify-center transition-all duration-300 flex-1"
                style={{
                  aspectRatio: "3/4",
                  border: photos[i]
                    ? `2px solid ${BRAND}`
                    : `1.5px dashed ${BRAND_A(0.35)}`,
                  background: photos[i] ? "transparent" : BRAND_A(0.06),
                }}
              >
                {photos[i] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photos[i]} alt={`Shot ${i + 1}`} className="absolute inset-0 w-full h-full object-cover bw-photo" />
                    <span className="absolute top-0.5 left-0.5 text-[7px] font-sans font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-10" style={{ background: BRAND, color: CREAM }}>
                      {i + 1}
                    </span>
                  </>
                ) : (
                  <span className="font-sans text-xs" style={{ color: BRAND_A(0.3) }}>{i + 1}</span>
                )}
              </div>
            ))}
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-center gap-6 w-full mx-auto" style={{ maxWidth: "min(420px, 100%)" }}>
            {state === "preview" && (
              <>
                {/* Retake */}
                <button
                  onClick={photos.length > 0 ? handleRetake : flipCamera}
                  className="font-sans text-sm font-medium py-2.5 px-5 rounded-xl flex items-center gap-2 transition-opacity hover:opacity-80"
                  style={{ background: "#C8B0A0", color: "#1A1713" }}
                  title={photos.length > 0 ? "Retake" : "Flip camera"}
                >
                  {hasMultipleCameras && photos.length === 0
                    ? <><RotateCcw size={14} /> Flip</>
                    : "Retake"
                  }
                </button>

                {/* Shutter */}
                <button
                  onClick={handleStart}
                  className="w-[68px] h-[68px] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
                  style={{ background: BRAND, boxShadow: `0 4px 16px ${BRAND_A(0.4)}` }}
                  title="Start Shoot"
                />
              </>
            )}
            {state === "countdown" && (
              <p className="text-center font-sans text-sm py-3" style={{ color: BODY }}>
                Pose {currentShot + 1} of {TOTAL_PHOTOS} — get ready…
              </p>
            )}
            {(state === "permission" || state === "idle") && <div className="h-[68px]" />}
          </div>

          {/* Mobile-only stats */}
          <div className="md:hidden w-full flex items-center justify-center gap-6 pt-4" style={{ borderTop: `1px solid ${BRAND_A(0.1)}` }}>
            {HOW_IT_WORKS.map(item => (
              <div key={item.stat} className="text-center">
                <p className="font-typewriter text-lg font-semibold" style={{ color: BRAND, fontStyle: "italic" }}>{item.stat}</p>
                <p className="font-sans text-[10px] mt-0.5 leading-tight" style={{ color: BODY }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: fixed 380px sidebar (desktop only) ──────────────────── */}
        <aside
          className="hidden md:flex flex-col gap-8 py-10 px-10 shrink-0"
          style={{ width: "380px", borderLeft: `1px solid ${BRAND_A(0.1)}` }}
        >
          {/* How it works label */}
          <p className="font-sans text-xs tracking-[0.14em] uppercase" style={{ color: BODY }}>
            How it works
          </p>

          {/* Stats */}
          <div className="flex flex-col gap-0">
            {HOW_IT_WORKS.map((item, idx) => (
              <div
                key={item.stat}
                className="py-6"
                style={{ borderBottom: `1px solid ${BRAND_A(0.1)}`, ...(idx === 0 ? { borderTop: `1px solid ${BRAND_A(0.1)}` } : {}) }}
              >
                <p className="font-typewriter text-4xl leading-none" style={{ color: BRAND, fontStyle: "italic" }}>
                  {item.stat}
                </p>
                <p className="font-sans text-xs mt-2 uppercase tracking-[0.1em]" style={{ color: BODY }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Privacy note */}
          <div className="flex flex-col gap-1.5">
            <p className="font-sans text-xs font-medium uppercase tracking-[0.1em]" style={{ color: BRAND }}>
              Privacy note
            </p>
            <p className="font-sans text-xs leading-relaxed" style={{ color: BODY }}>
              Photos never leave your device.<br />No account, no cloud.
            </p>
          </div>
        </aside>

      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ─── Grain texture ────────────────────────────────────────────────────────────

function GrainTexture({ id }: { id: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg className="grain-layer absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-[0.032]" xmlns="http://www.w3.org/2000/svg">
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0.15" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
      <div className="absolute inset-0 opacity-[0.022]" style={{ backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 28px, ${BRAND} 28px, ${BRAND} 29px)` }} />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function BoothHeader({ onBack }: { onBack?: () => void }) {
  return (
    <header className="w-full sticky top-0 z-20 backdrop-blur-md relative" style={{ background: `rgba(253,246,235,0.92)`, borderBottom: `1px solid rgba(232,89,60,0.1)` }}>
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="font-sans text-sm hover:opacity-60 transition-opacity flex items-center gap-1.5 shrink-0"
          style={{ color: BODY }}
        >
          ← Back
        </button>
        <span className="font-typewriter text-base font-semibold absolute left-1/2 -translate-x-1/2" style={{ color: BRAND, fontStyle: "italic" }}>
          CitoFoto
        </span>
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
