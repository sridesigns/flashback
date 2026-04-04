"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RotateCcw, Copy } from "lucide-react";
import { captureFromVideo, captureColorFromVideo, compressForUrl, compressForSegmentation, encodeForUrl, decodeFromUrl } from "@/lib/photoUtils";
import { uploadBlob, downloadBlob } from "@/lib/blobStore";
import DuetStrip from "./DuetStrip";

// ─── Types ────────────────────────────────────────────────────────────────────

type DuetRole  = "initiator" | "partner" | "viewer";
type DuetState =
  | "loading"    // checking URL hash / fetching blob
  | "camera"     // camera live
  | "countdown"  // shooting sequence
  | "p1-done"    // Person 1 done — share link screen
  | "final";     // combined strip

const TOTAL_SHOTS    = 4;
const COUNTDOWN_SECS = 3;

const DUET_HINTS = [
  "Strike a pose!",
  "Something silly!",
  "Look dramatic!",
  "Be yourself!",
];

// ─── Brand constants (match PhotoBooth) ───────────────────────────────────────

const BRAND   = "#E8593C";
const CREAM   = "#FDF6EB";
const BODY    = "#7A6E62";
const BRAND_A = (a: number) => `rgba(232,89,60,${a})`;

interface DuetBoothProps {
  onHome: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DuetBooth({ onHome }: DuetBoothProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [duetState,  setDuetState]  = useState<DuetState>("loading");
  const [role,       setRole]       = useState<DuetRole>("initiator");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultiCam,setHasMultiCam]= useState(false);
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState<string | null>(null);

  const [leftPhotos,       setLeftPhotos]       = useState<string[]>([]);
  const [rightPhotos,      setRightPhotos]      = useState<string[]>([]);
  const [leftColorPhotos,  setLeftColorPhotos]  = useState<string[]>([]);
  const [rightColorPhotos, setRightColorPhotos] = useState<string[]>([]);

  const [countdown,   setCountdown]   = useState(COUNTDOWN_SECS);
  const [currentShot, setCurrentShot] = useState(0);
  const [showFlash,   setShowFlash]   = useState(false);
  const [shareLink,   setShareLink]   = useState<string | null>(null);
  const [finalLink,   setFinalLink]   = useState<string | null>(null);
  const [copied,      setCopied]      = useState<"share" | "final" | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);

  // ── Camera enumeration ────────────────────────────────────────────────────
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices()
      .then(devs => setHasMultiCam(devs.filter(d => d.kind === "videoinput").length > 1))
      .catch(() => {});
  }, []);

  // ── Camera control ────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async (facing: "user" | "environment" = "user") => {
    stopCamera();
    setCamError(null);
    setCamReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamReady(true);
    } catch {
      setCamError("Camera access denied. Please allow permissions and try again.");
    }
  }, [stopCamera]);

  useEffect(() => {
    if (camReady && (duetState === "camera" || duetState === "countdown") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [camReady, duetState]);

  // ── On mount: detect URL hash ─────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;

    const applyPayload = (payload: { phase: string; p1: string[]; p1c?: string[]; p2?: string[]; p2c?: string[] } | null) => {
      if (payload?.phase === "p1") {
        setLeftPhotos(payload.p1);
        if (payload.p1c) setLeftColorPhotos(payload.p1c);
        setRole("partner");
      } else if (payload?.phase === "final" && payload.p2) {
        setLeftPhotos(payload.p1);
        setRightPhotos(payload.p2);
        setRole("viewer");
        setDuetState("final");
        return;
      }
      setDuetState("camera");
      startCamera("user");
    };

    if (!hash.startsWith("#duet=")) {
      setDuetState("camera");
      startCamera("user");
      return;
    }

    const value = hash.slice(6);
    if (value.startsWith("jb_")) {
      downloadBlob(value.slice(3))
        .then(data => applyPayload(data as { phase: string; p1: string[]; p2?: string[] }))
        .catch(() => { setDuetState("camera"); startCamera("user"); });
    } else {
      applyPayload(decodeFromUrl(value));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Flip camera ──────────────────────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startCamera(next);
  }, [facingMode, startCamera]);

  // ── Countdown + capture sequence ─────────────────────────────────────────
  useEffect(() => {
    if (duetState !== "countdown") return;

    let shot  = currentShot;
    let count = COUNTDOWN_SECS;
    setCountdown(count);

    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        const video = videoRef.current;
        if (!video) return;

        const dataUrl  = captureFromVideo(video, facingMode);
        const colorUrl = captureColorFromVideo(video, facingMode);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 400);

        if (dataUrl) {
          if (role === "initiator") {
            if (colorUrl) setLeftColorPhotos(prev => [...prev, colorUrl]);
            setLeftPhotos(prev => {
              const next     = [...prev, dataUrl];
              const nextShot = shot + 1;
              if (nextShot < TOTAL_SHOTS) {
                setCurrentShot(nextShot);
                setTimeout(() => { setCountdown(COUNTDOWN_SECS); setDuetState("countdown"); }, 1000);
              } else {
                stopCamera();
                setDuetState("p1-done");
              }
              return next;
            });
          } else {
            if (colorUrl) setRightColorPhotos(prev => [...prev, colorUrl]);
            setRightPhotos(prev => {
              const next     = [...prev, dataUrl];
              const nextShot = shot + 1;
              if (nextShot < TOTAL_SHOTS) {
                setCurrentShot(nextShot);
                setTimeout(() => { setCountdown(COUNTDOWN_SECS); setDuetState("countdown"); }, 1000);
              } else {
                stopCamera();
                setDuetState("final");
              }
              return next;
            });
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duetState, currentShot]);

  // ── Generate P1 share link ────────────────────────────────────────────────
  useEffect(() => {
    if (duetState !== "p1-done" || leftPhotos.length !== TOTAL_SHOTS || shareLink) return;
    setLinkLoading(true);
    Promise.all(leftPhotos.map(compressForUrl)).then(async compressed => {
      const compressedColor = await Promise.all(leftColorPhotos.map(compressForSegmentation));
      const payload: { phase: "p1"; p1: string[]; p1c: string[] } = { phase: "p1", p1: compressed, p1c: compressedColor };
      try {
        const id = await uploadBlob(payload);
        setShareLink(`${window.location.origin}/#duet=jb_${id}`);
      } catch {
        setShareLink(`${window.location.origin}/#duet=${encodeForUrl(payload)}`);
      }
      setLinkLoading(false);
    });
  }, [duetState, leftPhotos, shareLink, leftColorPhotos]);

  // ── Generate final link (partner → initiator) ─────────────────────────────
  useEffect(() => {
    if (duetState !== "final" || role !== "partner" || rightPhotos.length !== TOTAL_SHOTS || finalLink) return;
    setLinkLoading(true);
    Promise.all(rightPhotos.map(compressForUrl)).then(async compressedP2 => {
      const payload: { phase: "final"; p1: string[]; p2: string[] } = { phase: "final", p1: leftPhotos, p2: compressedP2 };
      try {
        const id = await uploadBlob(payload);
        setFinalLink(`${window.location.origin}/#duet=jb_${id}`);
      } catch {
        setFinalLink(`${window.location.origin}/#duet=${encodeForUrl(payload)}`);
      }
      setLinkLoading(false);
    });
  }, [duetState, role, rightPhotos, leftPhotos, finalLink]);

  // ── Copy helper ───────────────────────────────────────────────────────────
  const copyLink = useCallback(async (link: string, type: "share" | "final") => {
    try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
    setCopied(type);
    setTimeout(() => setCopied(null), 2500);
  }, []);

  // ── Home + retake ─────────────────────────────────────────────────────────
  const handleHome = useCallback(() => {
    stopCamera();
    window.history.replaceState(null, "", window.location.pathname);
    onHome();
  }, [stopCamera, onHome]);

  const handleRetake = useCallback(() => {
    setLeftPhotos([]); setLeftColorPhotos([]); setRightColorPhotos([]);
    setCurrentShot(0); setCountdown(COUNTDOWN_SECS); setShareLink(null);
    setDuetState("camera");
    startCamera(facingMode);
  }, [facingMode, startCamera]);

  const ghostPhoto = role === "partner" && leftPhotos.length > 0
    ? leftPhotos[Math.min(currentShot, leftPhotos.length - 1)]
    : null;

  const isLive = duetState === "camera" || duetState === "countdown";
  const currentPhotos = role === "initiator" ? leftPhotos : rightPhotos;

  // ── Sidebar steps ─────────────────────────────────────────────────────────
  const sidebarSteps = role === "initiator"
    ? [
        { stat: "3 sec",   detail: "Countdown per pose" },
        { stat: "4 shots", detail: "Auto-captured" },
        { stat: "Share",   detail: "Partner shoots next to your ghost" },
      ]
    : [
        { stat: "Ghost",   detail: "Your partner appears in the frame" },
        { stat: "4 poses", detail: "3 sec each" },
        { stat: "Final",   detail: "Combined strip, sent back to you" },
      ];

  // ─────────────────────────────────────────────────────────────────────────
  // ── Loading ──────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (duetState === "loading") {
    return (
      <div className="w-full flex flex-col overflow-hidden" style={{ height: "100dvh", background: CREAM }}>
        <GrainTexture id="grain-duet-load" />
        <BoothHeader onBack={handleHome} />
        <div className="flex-1 flex items-center justify-center relative z-10">
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin"
              style={{ borderColor: BRAND, borderTopColor: "transparent" }}
            />
            <p className="font-sans text-xs tracking-wider" style={{ color: BODY }}>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── P1-done: share link screen ───────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (duetState === "p1-done") {
    return (
      <div className="w-full flex flex-col done-layout" style={{ background: CREAM }}>
        <GrainTexture id="grain-duet-p1" />
        <BoothHeader onBack={handleHome} />

        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-10 overflow-y-auto md:overflow-hidden">

          {/* Left: 2×2 photo grid, tilted */}
          <div
            className="md:w-1/2 flex items-center justify-center overflow-visible"
            style={{ padding: "2.5rem 2rem" }}
          >
            <div className="strip-enter" style={{ flexShrink: 0 }}>
              <div
                className="grid grid-cols-2"
                style={{
                  gap: "5px",
                  width: "clamp(180px, 28vw, 240px)",
                  background: BRAND_A(0.06),
                  padding: "5px",
                  borderRadius: "6px",
                  border: `1px solid ${BRAND_A(0.15)}`,
                }}
              >
                {leftPhotos.map((photo, i) => (
                  <div key={i} style={{ position: "relative", overflow: "hidden", borderRadius: "3px", aspectRatio: "3/4" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={`Shot ${i + 1}`}
                      className="bw-photo"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span
                      style={{
                        position: "absolute", top: "3px", left: "3px",
                        background: "rgba(0,0,0,0.55)", color: "#C9A84C",
                        fontFamily: "monospace", fontSize: "7px", fontWeight: "bold",
                        width: "13px", height: "13px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderRadius: "2px", zIndex: 5,
                      }}
                    >{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div
            className="md:w-1/2 flex flex-col justify-center items-start px-8 md:px-12 pb-12 pt-4 md:pt-0 md:pb-0"
            style={{ flexShrink: 0 }}
          >
            <div className="w-full" style={{ maxWidth: "320px", display: "flex", flexDirection: "column", gap: "20px" }}>

              <div className="fade-up" style={{ animationDelay: "150ms" }}>
                <h2
                  className="font-typewriter leading-tight"
                  style={{ color: "#1A1713", fontSize: "clamp(2rem, 4vw, 3rem)" }}
                >
                  Your shots{" "}
                  <em style={{ color: BRAND, fontStyle: "italic" }}>are in.</em>
                </h2>
                <p className="font-sans text-sm mt-2 leading-relaxed" style={{ color: BODY }}>
                  Share this link with your partner. They&apos;ll pose alongside your ghost — then send you the final strip.
                </p>
              </div>

              <div className="fade-up flex flex-col gap-2" style={{ animationDelay: "250ms" }}>
                <p className="font-sans text-xs font-medium uppercase tracking-[0.12em]" style={{ color: BRAND }}>
                  Partner link
                </p>
                {linkLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                    <span className="font-sans text-xs" style={{ color: BODY }}>Generating link…</span>
                  </div>
                ) : shareLink ? (
                  <>
                    <div
                      className="rounded-xl px-3 py-2.5 font-mono text-[10px] break-all leading-relaxed"
                      style={{ background: BRAND_A(0.05), border: `1px solid ${BRAND_A(0.14)}`, color: BODY }}
                    >
                      {shareLink}
                    </div>
                    <button
                      onClick={() => copyLink(shareLink, "share")}
                      className="font-sans font-medium text-sm py-2.5 px-5 rounded-full flex items-center gap-2 transition-opacity hover:opacity-80 self-start"
                      style={{
                        background: copied === "share" ? "#1A1713" : "#C8B0A0",
                        color:      copied === "share" ? CREAM    : "#1A1713",
                      }}
                    >
                      {copied === "share" ? "✓ Copied!" : "Copy Link"}
                      {copied !== "share" && <Copy size={13} />}
                    </button>
                  </>
                ) : null}
              </div>

              <div
                style={{ borderTop: `1px solid ${BRAND_A(0.12)}` }}
                className="fade-up"
                aria-hidden="true"
              />

              <div className="fade-up flex gap-2.5" style={{ animationDelay: "340ms" }}>
                <button
                  onClick={handleRetake}
                  className="font-sans font-medium text-sm py-3 px-5 rounded-full flex-1 transition-opacity hover:opacity-80"
                  style={{ background: "#C8B0A0", color: "#1A1713" }}
                >
                  Retake
                </button>
                <button
                  onClick={handleHome}
                  className="font-sans font-medium text-sm py-3 px-5 rounded-full flex-1 transition-opacity hover:opacity-80"
                  style={{ background: BRAND, color: CREAM }}
                >
                  Home
                </button>
              </div>

              <p className="fade-up font-sans text-xs" style={{ color: "#2D6A4F", animationDelay: "430ms" }}>
                Your photos never leave your device.
              </p>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Final combined strip ─────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (duetState === "final" && leftPhotos.length > 0 && rightPhotos.length > 0) {
    return (
      <div className="w-full flex flex-col done-layout" style={{ background: CREAM }}>
        <GrainTexture id="grain-duet-final" />
        <BoothHeader onBack={handleHome} />

        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-10 overflow-y-auto md:overflow-hidden">

          {/* Left: DuetStrip tilted */}
          <div
            className="md:w-1/2 flex items-center justify-center overflow-visible"
            style={{ padding: "2.5rem 2rem", flexShrink: 0 }}
          >
            <div className="strip-enter">
              <DuetStrip
                p1Photos={leftPhotos}
                p2Photos={rightPhotos}
                p1ColorPhotos={leftColorPhotos.length === TOTAL_SHOTS ? leftColorPhotos : undefined}
                p2ColorPhotos={rightColorPhotos.length === TOTAL_SHOTS ? rightColorPhotos : undefined}
              />
            </div>
          </div>

          {/* Right: actions */}
          <div
            className="md:w-1/2 flex flex-col justify-center items-start px-8 md:px-12 pb-12 pt-4 md:pt-0 md:pb-0"
            style={{ flexShrink: 0 }}
          >
            <div className="w-full" style={{ maxWidth: "320px", display: "flex", flexDirection: "column", gap: "20px" }}>

              <div className="fade-up" style={{ animationDelay: "150ms" }}>
                <h2
                  className="font-typewriter leading-tight"
                  style={{ color: "#1A1713", fontSize: "clamp(2rem, 4vw, 3rem)" }}
                >
                  {role === "viewer"
                    ? <>Your <em style={{ color: BRAND, fontStyle: "italic" }}>duet</em> strip.</>
                    : <>The <em style={{ color: BRAND, fontStyle: "italic" }}>strip</em> is ready.</>
                  }
                </h2>
                <p className="font-sans text-sm mt-2 leading-relaxed" style={{ color: BODY }}>
                  {role === "viewer"
                    ? "Download your combined photo strip below."
                    : "Share the final link with your partner so they can download too."}
                </p>
              </div>

              {/* Partner: send final link back */}
              {role === "partner" && (
                <div className="fade-up flex flex-col gap-2" style={{ animationDelay: "250ms" }}>
                  <p className="font-sans text-xs font-medium uppercase tracking-[0.12em]" style={{ color: BRAND }}>
                    Send to your partner
                  </p>
                  {linkLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: BRAND, borderTopColor: "transparent" }} />
                      <span className="font-sans text-xs" style={{ color: BODY }}>Generating link…</span>
                    </div>
                  ) : finalLink ? (
                    <>
                      <div
                        className="rounded-xl px-3 py-2.5 font-mono text-[10px] break-all leading-relaxed"
                        style={{ background: BRAND_A(0.05), border: `1px solid ${BRAND_A(0.14)}`, color: BODY }}
                      >
                        {finalLink}
                      </div>
                      <button
                        onClick={() => copyLink(finalLink, "final")}
                        className="font-sans font-medium text-sm py-2.5 px-5 rounded-full flex items-center gap-2 transition-opacity hover:opacity-80 self-start"
                        style={{
                          background: copied === "final" ? "#1A1713" : "#C8B0A0",
                          color:      copied === "final" ? CREAM    : "#1A1713",
                        }}
                      >
                        {copied === "final" ? "✓ Copied!" : "Copy Final Link"}
                        {copied !== "final" && <Copy size={13} />}
                      </button>
                    </>
                  ) : null}
                </div>
              )}

              <div style={{ borderTop: `1px solid ${BRAND_A(0.12)}` }} aria-hidden="true" className="fade-up" />

              <div className="fade-up" style={{ animationDelay: "340ms" }}>
                <button
                  onClick={handleHome}
                  className="font-sans font-medium text-sm py-3 px-5 rounded-full flex-1 w-full transition-opacity hover:opacity-80"
                  style={{ background: BRAND, color: CREAM }}
                >
                  Home
                </button>
              </div>

              <p className="fade-up font-sans text-xs" style={{ color: "#2D6A4F", animationDelay: "430ms" }}>
                Your photos never leave your device.
              </p>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── Camera view ──────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col overflow-hidden" style={{ height: "100dvh", background: CREAM }}>
      <GrainTexture id="grain-duet-cam" />
      <BoothHeader onBack={handleHome} />

      <div className="flex-1 flex flex-col md:flex-row relative z-10 min-h-0">

        {/* ── Left: fluid camera column ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center min-h-0 gap-3 px-4 pt-3 pb-4 md:gap-5 md:justify-center md:px-6 md:py-8">

          {/* Viewfinder */}
          <div
            className="relative w-full mx-auto overflow-hidden rounded-2xl flex-1 min-h-0 md:flex-none md:aspect-[3/4]"
            style={{
              maxWidth:  "min(420px, 100%)",
              background:"#E8E4DE",
              border:    `1.5px solid ${BRAND_A(0.2)}`,
              boxShadow: `0 6px 32px ${BRAND_A(0.08)}`,
            }}
          >
            {/* Camera loading */}
            {!camReady && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
                <div
                  className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: BRAND, borderTopColor: "transparent" }}
                />
                <p className="font-sans text-xs tracking-wider" style={{ color: BODY }}>Accessing camera…</p>
              </div>
            )}

            {/* Error */}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-6 text-center">
                <p className="font-sans text-sm leading-relaxed max-w-[220px]" style={{ color: BODY }}>{camError}</p>
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
              className={`w-full h-full object-cover ${isLive && camReady ? "" : "hidden"}`}
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              playsInline muted autoPlay
            />

            {/* Ghost overlay */}
            {ghostPhoto && isLive && camReady && (
              <div className="absolute inset-0 z-10 pointer-events-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ghostPhoto}
                  alt="Partner ghost"
                  className="w-full h-full object-cover"
                  style={{ opacity: 0.35, filter: "grayscale(100%) contrast(1.1)" }}
                />
                <span
                  className="absolute top-2 left-2 font-mono text-[9px] text-white/70 bg-black/50 px-2 py-0.5 rounded tracking-wider"
                >
                  👻 PARTNER
                </span>
              </div>
            )}

            {/* Countdown */}
            {duetState === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center z-30">
                <div className="bg-black/30 rounded-full w-20 h-20 flex items-center justify-center animate-count-pulse">
                  <span className="font-typewriter text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
                </div>
              </div>
            )}

            {/* Pose hint */}
            {duetState === "countdown" && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center z-30">
                <span className="bg-black/50 text-white font-sans text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  {DUET_HINTS[currentShot]}
                </span>
              </div>
            )}

            {/* Flash */}
            {showFlash && <div className="absolute inset-0 bg-white z-40 animate-flash pointer-events-none" />}

            {/* Corner brackets */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 pointer-events-none rounded-tl-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 pointer-events-none rounded-tr-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 pointer-events-none rounded-bl-sm" style={{ borderColor: BRAND_A(0.35) }} />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 pointer-events-none rounded-br-sm" style={{ borderColor: BRAND_A(0.35) }} />
          </div>

          {/* 4 thumbnail slots */}
          <div className="flex gap-2 w-full mx-auto shrink-0" style={{ maxWidth: "min(420px, 100%)" }}>
            {Array.from({ length: TOTAL_SHOTS }).map((_, i) => {
              const photo = currentPhotos[i];
              return (
                <div
                  key={i}
                  className="thumb-slot relative overflow-hidden rounded-lg flex items-center justify-center transition-all duration-300 flex-1"
                  style={{
                    border:     photo ? `2px solid ${BRAND}` : `1.5px dashed ${BRAND_A(0.35)}`,
                    background: photo ? "transparent" : BRAND_A(0.06),
                  }}
                >
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`Shot ${i + 1}`} className="absolute inset-0 w-full h-full object-cover bw-photo" />
                      <span
                        className="absolute top-0.5 left-0.5 text-[7px] font-sans font-bold w-3.5 h-3.5 flex items-center justify-center rounded-sm z-10"
                        style={{ background: BRAND, color: CREAM }}
                      >
                        {i + 1}
                      </span>
                    </>
                  ) : (
                    <span className="font-sans text-xs" style={{ color: BRAND_A(0.3) }}>{i + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Controls — 3-column grid, shutter always centred */}
          <div
            className="grid grid-cols-3 items-center w-full mx-auto shrink-0"
            style={{ maxWidth: "min(420px, 100%)" }}
          >
            {/* Col 1: Retake / Flip */}
            <div className="flex justify-start">
              {duetState === "camera" && camReady && (
                <button
                  onClick={currentPhotos.length > 0 ? handleRetake : flipCamera}
                  className="font-sans text-sm font-medium py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{ background: "#C8B0A0", color: "#1A1713" }}
                  title={currentPhotos.length > 0 ? "Retake" : "Flip camera"}
                >
                  {hasMultiCam && currentPhotos.length === 0
                    ? <><RotateCcw size={14} /> Flip</>
                    : "Retake"
                  }
                </button>
              )}
            </div>

            {/* Col 2: Shutter */}
            <div className="flex justify-center">
              {duetState === "camera" && camReady && (
                <button
                  onClick={() => { setCurrentShot(0); setCountdown(COUNTDOWN_SECS); setDuetState("countdown"); }}
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shrink-0"
                  style={{ background: BRAND, boxShadow: `0 4px 16px ${BRAND_A(0.4)}` }}
                  title={role === "partner" ? "Start My Shoot" : "Start Shoot"}
                />
              )}
              {duetState === "countdown" && (
                <p className="text-center font-sans text-xs py-3" style={{ color: BODY }}>
                  Pose {currentShot + 1} of {TOTAL_SHOTS}
                </p>
              )}
              {!camReady && !camError && <div className="w-[64px] h-[64px]" />}
            </div>

            {/* Col 3: Flip on multi-camera */}
            <div className="flex justify-end">
              {duetState === "camera" && camReady && hasMultiCam && currentPhotos.length > 0 && (
                <button
                  onClick={flipCamera}
                  className="font-sans text-xs font-medium p-2.5 rounded-xl transition-opacity hover:opacity-70"
                  style={{ color: BODY }}
                  title="Flip camera"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ── Right: fixed 380px sidebar (desktop only) ──────────────────── */}
        <aside
          className="hidden md:flex flex-col gap-8 py-10 px-10 shrink-0"
          style={{ width: "380px", borderLeft: `1px solid ${BRAND_A(0.1)}` }}
        >

          {/* Steps */}
          <div className="flex flex-col gap-0">
            <p className="font-sans text-xs tracking-[0.14em] uppercase mb-5" style={{ color: BODY }}>
              {role === "partner" ? "Your shoot" : "How it works"}
            </p>
            {sidebarSteps.map((item, idx) => (
              <div
                key={item.stat}
                className="py-5"
                style={{
                  borderBottom: `1px solid ${BRAND_A(0.1)}`,
                  ...(idx === 0 ? { borderTop: `1px solid ${BRAND_A(0.1)}` } : {}),
                }}
              >
                <p className="font-typewriter text-3xl leading-none" style={{ color: BRAND, fontStyle: "italic" }}>
                  {item.stat}
                </p>
                <p className="font-sans text-xs mt-2 uppercase tracking-[0.1em]" style={{ color: BODY }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Privacy */}
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
      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{ backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 28px, ${BRAND} 28px, ${BRAND} 29px)` }}
      />
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

function BoothHeader({ onBack }: { onBack?: () => void }) {
  return (
    <header
      className="w-full sticky top-0 z-20 backdrop-blur-md"
      style={{ background: "rgba(253,246,235,0.92)", borderBottom: `1px solid ${BRAND_A(0.1)}` }}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="font-sans text-sm hover:opacity-60 transition-opacity flex items-center gap-1.5 shrink-0"
          style={{ color: BODY }}
        >
          ← Back
        </button>
        <span
          className="font-typewriter text-base font-semibold absolute left-1/2 -translate-x-1/2"
          style={{ color: BRAND, fontStyle: "italic" }}
        >
          CitoFoto
        </span>
        <div className="w-14 shrink-0" />
      </div>
    </header>
  );
}
