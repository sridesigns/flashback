"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { captureFromVideo, captureColorFromVideo, compressForUrl, compressForSegmentation, encodeForUrl, decodeFromUrl } from "@/lib/photoUtils";
import { uploadBlob, downloadBlob } from "@/lib/blobStore";
import DuetStrip from "./DuetStrip";

// ─── Types ────────────────────────────────────────────────────────────────────

type DuetRole  = "initiator" | "partner" | "viewer";
type DuetState =
  | "loading"    // checking URL hash / fetching blob
  | "camera"     // camera live (replaces p1-idle, p2-intro, permission, preview)
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
  const [camReady,   setCamReady]   = useState(false); // camera stream is live
  const [camError,   setCamError]   = useState<string | null>(null);

  const [leftPhotos,  setLeftPhotos]  = useState<string[]>([]); // P1
  const [rightPhotos, setRightPhotos] = useState<string[]>([]); // P2
  const [leftColorPhotos,  setLeftColorPhotos]  = useState<string[]>([]); // P1 color (for segmentation)
  const [rightColorPhotos, setRightColorPhotos] = useState<string[]>([]); // P2 color (for segmentation)

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

  // Attach stream once video element is in DOM
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
        return; // viewer: no camera needed
      }
      // initiator or partner: go to camera
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

        const dataUrl = captureFromVideo(video, facingMode);
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

  // ── Generate Person 1 share link ──────────────────────────────────────────
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
  }, [duetState, leftPhotos, shareLink]);

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

  // ── Copy helpers ──────────────────────────────────────────────────────────
  const copyLink = useCallback(async (link: string, type: "share" | "final") => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(type);
      setTimeout(() => setCopied(null), 2500);
    } catch { /* ignore */ }
  }, []);

  // ── Home + retake ─────────────────────────────────────────────────────────
  const handleHome = useCallback(() => {
    stopCamera();
    window.history.replaceState(null, "", window.location.pathname);
    onHome();
  }, [stopCamera, onHome]);

  const handleRetake = useCallback(() => {
    setLeftPhotos([]);
    setLeftColorPhotos([]);
    setRightColorPhotos([]);
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECS);
    setShareLink(null);
    setDuetState("camera");
    startCamera(facingMode);
  }, [facingMode, startCamera]);

  // Ghost: partner's photo shown during countdown
  const ghostPhoto = role === "partner" && leftPhotos.length > 0
    ? leftPhotos[Math.min(currentShot, leftPhotos.length - 1)]
    : null;

  const isLive = duetState === "camera" || duetState === "countdown";

  // ── Render ────────────────────────────────────────────────────────────────

  // Loading (fetching blob from URL)
  if (duetState === "loading") {
    return (
      <div className="w-full min-h-screen flex flex-col">
        <BoothHeader label="Pose & Pass" onBack={handleHome} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
            <p className="font-sans text-xs text-warm-brown/50 uppercase tracking-wider">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // Final combined strip
  if (duetState === "final" && leftPhotos.length > 0 && rightPhotos.length > 0) {
    return (
      <div className="w-full min-h-screen flex flex-col page-transition">
        <BoothHeader label="Pose & Pass" onBack={handleHome} />
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col md:grid md:grid-cols-[auto_1fr] md:gap-12 md:items-start gap-6">
          <div className="flex justify-center">
            <DuetStrip
              p1Photos={leftPhotos}
              p2Photos={rightPhotos}
              p1ColorPhotos={leftColorPhotos.length === TOTAL_SHOTS ? leftColorPhotos : undefined}
              p2ColorPhotos={rightColorPhotos.length === TOTAL_SHOTS ? rightColorPhotos : undefined}
            />
          </div>
          <div className="flex flex-col gap-5 md:pt-4">
            <div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-dark-brown leading-tight" style={{ letterSpacing: "-0.02em" }}>
                {role === "viewer" ? "Your duet\nstrip." : "The strip\nis ready."}
              </h2>
              <p className="font-sans text-sm text-warm-brown/65 mt-2 leading-relaxed">
                {role === "viewer"
                  ? "Download your combined photo strip below."
                  : "Share the final link with your partner so they can download too."}
              </p>
            </div>

            {role === "partner" && (
              <div className="flex flex-col gap-2">
                <p className="font-sans text-[10px] text-warm-brown/50 uppercase tracking-wider">Send to your partner</p>
                {linkLoading ? (
                  <div className="flex items-center gap-2 text-sm text-warm-brown">
                    <div className="w-4 h-4 border-2 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                    <span className="font-sans text-xs">Generating link…</span>
                  </div>
                ) : finalLink ? (
                  <>
                    <div className="bg-parchment/60 border border-dark-brown/10 rounded-lg px-3 py-2 font-mono text-[11px] text-warm-brown break-all leading-relaxed">
                      {finalLink}
                    </div>
                    <button
                      onClick={() => copyLink(finalLink, "final")}
                      className={`leather-btn ${copied === "final" ? "leather-btn-dark" : "leather-btn-primary"} font-sans font-semibold text-sm py-3 px-6 rounded-lg`}
                    >
                      {copied === "final" ? "✓ Copied!" : "Copy Final Link"}
                    </button>
                  </>
                ) : null}
              </div>
            )}

            <button onClick={handleHome} className="leather-btn leather-btn-secondary font-sans font-semibold text-sm py-3 px-6 rounded-lg">
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // P1-done: share link screen
  if (duetState === "p1-done") {
    return (
      <div className="w-full min-h-screen flex flex-col page-transition">
        <BoothHeader label="Pose & Pass" onBack={handleHome} />
        <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col md:grid md:grid-cols-[auto_1fr] md:gap-12 md:items-start gap-6">
          {/* 2×2 thumbnail grid */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-[240px] mx-auto md:mx-0">
            {leftPhotos.map((photo, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden border-2 border-dark-brown/70">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Shot ${i + 1}`} className="w-full block bw-photo" style={{ aspectRatio: "3/4", objectFit: "cover" }} />
                <span className="absolute top-1 left-1 bg-black/60 text-gold text-[9px] font-mono font-bold w-4 h-4 flex items-center justify-center rounded-sm">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-5 md:pt-4">
            <div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-dark-brown leading-tight" style={{ letterSpacing: "-0.02em" }}>
                Your shots<br />are in.
              </h2>
              <p className="font-sans text-sm text-warm-brown/65 mt-2 leading-relaxed">
                Share this link with your partner. They&apos;ll pose alongside your ghost — then send you the final strip.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="font-sans text-[10px] text-warm-brown/50 uppercase tracking-wider">Partner link</p>
              {linkLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                  <span className="font-sans text-xs text-warm-brown">Generating link…</span>
                </div>
              ) : shareLink ? (
                <>
                  <div className="bg-parchment/60 border border-dark-brown/10 rounded-lg px-3 py-2 font-mono text-[11px] text-warm-brown break-all leading-relaxed">
                    {shareLink}
                  </div>
                  <button
                    onClick={() => copyLink(shareLink, "share")}
                    className={`leather-btn ${copied === "share" ? "leather-btn-dark" : "leather-btn-primary"} font-sans font-semibold text-sm py-3 px-6 rounded-lg`}
                  >
                    {copied === "share" ? "✓ Copied!" : "Copy Partner Link"}
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button onClick={handleRetake} className="leather-btn leather-btn-secondary flex-1 font-sans font-semibold text-sm py-3 px-4 rounded-lg">
                Retake
              </button>
              <button onClick={handleHome} className="leather-btn leather-btn-dark font-sans font-semibold text-sm py-3 px-4 rounded-lg">
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Camera view (main layout for both initiator + partner) ───────────────
  const sidebarSteps = role === "initiator"
    ? [
        { stat: "Your shoot",   detail: "4 poses, 3 sec each" },
        { stat: "Share link",   detail: "partner shoots alongside your ghost" },
        { stat: "Final strip",  detail: "partner sends you the combined download" },
      ]
    : [
        { stat: "Ghost overlay", detail: "your partner appears across your viewfinder" },
        { stat: "4 poses",       detail: "3 sec each — position yourself anywhere" },
        { stat: "Combined strip",detail: "one seamless B&W strip, both of you" },
      ];

  return (
    <div className="w-full min-h-screen flex flex-col">
      <BoothHeader label="Pose & Pass" onBack={handleHome} />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-6 md:py-10">
        <div className="flex flex-col md:grid md:grid-cols-[1fr_232px] md:gap-10 items-start gap-5">

          {/* ── Left: camera column ──────────────────────────────────────── */}
          <div className="w-full flex flex-col items-center gap-4">

            {/* Camera viewport */}
            <div
              className="relative w-full max-w-[320px] mx-auto overflow-hidden rounded-xl border-2 border-dark-brown/80 shadow-2xl bg-film-black"
              style={{ aspectRatio: "3/4" }}
            >
              {/* Camera loading */}
              {!camReady && !camError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
                  <div className="w-10 h-10 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                  <p className="font-sans text-cream/50 text-xs tracking-wider uppercase">Accessing camera…</p>
                </div>
              )}

              {/* Error */}
              {camError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4 p-6 text-center">
                  <CameraOffIcon />
                  <p className="font-sans text-sm text-cream/60 leading-relaxed max-w-[200px]">{camError}</p>
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
                className={`w-full h-full object-cover ${isLive && camReady ? "" : "hidden"}`}
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                playsInline muted autoPlay
              />

              {/* Ghost overlay — full frame, partner positions themselves next to it */}
              {ghostPhoto && isLive && camReady && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ghostPhoto}
                    alt="Partner ghost"
                    className="w-full h-full object-cover"
                    style={{
                      opacity: 0.35,
                      filter: "grayscale(100%) contrast(1.1)",
                    }}
                  />
                  {/* Ghost label */}
                  <span className="absolute top-2 left-2 font-mono text-[9px] text-white/70 bg-black/50 px-2 py-0.5 rounded tracking-wider">
                    👻 PARTNER
                  </span>
                </div>
              )}

              {/* Countdown */}
              {duetState === "countdown" && (
                <div className="absolute inset-0 flex items-center justify-center z-30">
                  <div className="bg-black/30 rounded-full w-20 h-20 flex items-center justify-center animate-count-pulse">
                    <span className="font-serif text-5xl font-bold text-white drop-shadow-lg">{countdown}</span>
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

              {/* Film corners */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-gold/50 pointer-events-none" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-gold/50 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-gold/50 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-gold/50 pointer-events-none" />
            </div>

            {/* Thumbnail slots — fill as photos are captured */}
            <div className="flex gap-3 justify-center w-full">
              {Array.from({ length: TOTAL_SHOTS }).map((_, i) => {
                const photo = role === "initiator" ? leftPhotos[i] : rightPhotos[i];
                return (
                  <div
                    key={i}
                    className={`relative overflow-hidden rounded-lg flex items-center justify-center transition-all duration-300 ${
                      photo
                        ? "border-2 border-dark-brown/70 shadow-md"
                        : "border-2 border-dashed border-dark-brown/25"
                    }`}
                    style={{ width: "22%", aspectRatio: "3/4" }}
                  >
                    {photo ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Shot ${i + 1}`}
                          className="absolute inset-0 w-full h-full object-cover bw-photo"
                        />
                        <span className="absolute top-0.5 left-0.5 bg-black/60 text-gold text-[7px] font-mono font-bold w-3 h-3 flex items-center justify-center rounded-sm z-10">
                          {i + 1}
                        </span>
                      </>
                    ) : (
                      <span className="font-sans text-sm text-dark-brown/25 font-medium">{i + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Shutter button + controls */}
            <div className="flex flex-col items-center gap-3">
              {duetState === "camera" && camReady && (
                <div className="flex items-center gap-4">
                  {hasMultiCam && (
                    <button onClick={flipCamera} title="Flip camera"
                      className="leather-btn leather-btn-secondary font-sans text-sm p-3 rounded-full"
                    >
                      <FlipIcon />
                    </button>
                  )}
                  <button
                    onClick={() => { setCurrentShot(0); setCountdown(COUNTDOWN_SECS); setDuetState("countdown"); }}
                    className="w-[72px] h-[72px] rounded-full border-[4px] border-dark-brown/70 flex items-center justify-center bg-cream hover:scale-105 active:scale-95 transition-transform shadow-lg"
                    title={role === "partner" ? "Start My Shoot" : "Start Shoot"}
                  >
                    <div className="w-[54px] h-[54px] rounded-full bg-dark-brown" />
                  </button>
                  {hasMultiCam ? (
                    <div className="w-[44px]" /> /* spacer to center shutter */
                  ) : null}
                </div>
              )}
              {duetState === "countdown" && (
                <p className="text-center font-sans text-sm text-warm-brown/60 py-3">
                  Pose {currentShot + 1} of {TOTAL_SHOTS}
                  {role === "partner" && " — position yourself next to your partner"}
                </p>
              )}
              {(!camReady && !camError) && <div className="h-12" />}
            </div>

            {/* Mobile info strip */}
            <div className="md:hidden w-full border-t border-dark-brown/8 pt-4">
              {role === "partner" && leftPhotos[0] && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-parchment/40 rounded-lg border border-dark-brown/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={leftPhotos[0]} alt="Partner" className="w-12 h-9 object-cover rounded bw-photo border border-dark-brown/30 shrink-0" />
                  <div>
                    <p className="font-sans text-xs font-semibold text-dark-brown">Your partner is ready</p>
                    <p className="font-sans text-[10px] text-warm-brown/55 leading-tight mt-0.5">Position yourself next to their ghost in the viewfinder</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-around gap-4 py-1">
                {sidebarSteps.map((item) => (
                  <div key={item.stat} className="text-center">
                    <p className="font-serif text-xs font-bold text-dark-brown">{item.stat}</p>
                    <p className="font-sans text-[9px] text-warm-brown/45 leading-tight mt-0.5">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: info sidebar (desktop only) ───────────────────────── */}
          <aside className="hidden md:flex flex-col gap-8 pt-9">

            {/* Partner's photo (for partner role) */}
            {role === "partner" && leftPhotos[0] && (
              <div className="flex flex-col gap-2">
                <p className="font-sans text-[10px] text-warm-brown/45 uppercase tracking-[0.15em]">Your partner</p>
                <div className="rounded-lg overflow-hidden border-2 border-dark-brown/60 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={leftPhotos[0]}
                    alt="Partner's first shot"
                    className="w-full block bw-photo"
                    style={{ aspectRatio: "3/4", objectFit: "cover" }}
                  />
                  <div className="bg-dark-brown text-gold text-center text-[9px] font-mono py-1 tracking-widest">
                    GHOST PREVIEW
                  </div>
                </div>
                <p className="font-sans text-[10px] text-warm-brown/40 leading-relaxed">
                  Their photo appears as a ghost — position yourself anywhere.
                </p>
              </div>
            )}

            {/* Steps */}
            <div className="flex flex-col gap-5">
              <p className="font-sans text-[10px] text-burnt-orange uppercase tracking-[0.2em] font-semibold">
                {role === "partner" ? "Your shoot" : "How Pose & Pass works"}
              </p>
              {sidebarSteps.map((item) => (
                <div key={item.stat}>
                  <p className="font-serif text-lg font-bold text-dark-brown leading-tight" style={{ letterSpacing: "-0.015em" }}>
                    {item.stat}
                  </p>
                  <p className="font-sans text-xs text-warm-brown/50 mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-dark-brown/8 pt-5">
              <p className="font-sans text-xs text-warm-brown/30 leading-relaxed">
                Photos never leave your device.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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

function CameraOffIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cream/20">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
