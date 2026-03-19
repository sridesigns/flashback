"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { captureFromVideo, compressForUrl, encodeForUrl, decodeFromUrl } from "@/lib/photoUtils";
import DuetStrip from "./DuetStrip";

// ─── Types ────────────────────────────────────────────────────────────────────

type DuetRole  = "initiator" | "partner" | "viewer";
type DuetState =
  | "loading"       // checking URL hash on mount
  | "p1-idle"       // Person 1 landing
  | "p2-intro"      // Person 2: intro before camera
  | "permission"    // requesting camera access
  | "preview"       // live camera feed
  | "countdown"     // shooting sequence
  | "p1-done"       // Person 1 done — share link screen
  | "final";        // combined strip (Person 2 after shoot, or Person 1 opening final link)

const TOTAL_SHOTS     = 4;
const COUNTDOWN_SECS  = 3;

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

  const [duetState, setDuetState] = useState<DuetState>("loading");
  const [role,      setRole]      = useState<DuetRole>("initiator");
  const [facingMode,    setFacingMode]    = useState<"user" | "environment">("user");
  const [hasMultiCam,   setHasMultiCam]  = useState(false);

  // leftPhotos = initiator (Person 1), rightPhotos = partner (Person 2)
  const [leftPhotos,  setLeftPhotos]  = useState<string[]>([]); // P1
  const [rightPhotos, setRightPhotos] = useState<string[]>([]); // P2

  const [countdown,    setCountdown]    = useState(COUNTDOWN_SECS);
  const [currentShot,  setCurrentShot]  = useState(0);
  const [showFlash,    setShowFlash]    = useState(false);
  const [shareLink,    setShareLink]    = useState<string | null>(null);
  const [finalLink,    setFinalLink]    = useState<string | null>(null);
  const [copied,       setCopied]       = useState<"share" | "final" | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [linkLoading,  setLinkLoading]  = useState(false);

  // ── On mount: detect URL hash ─────────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#duet=")) {
      const payload = decodeFromUrl(hash.slice(6));
      if (payload?.phase === "p1") {
        setLeftPhotos(payload.p1);       // initiator's compressed photos
        setRole("partner");
        setDuetState("p2-intro");
      } else if (payload?.phase === "final") {
        setLeftPhotos(payload.p1);
        setRightPhotos(payload.p2);
        setRole("viewer");
        setDuetState("final");
      } else {
        setDuetState("p1-idle");
      }
    } else {
      setDuetState("p1-idle");
    }
  }, []);

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
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async (facing: "user" | "environment" = "user") => {
    stopCamera();
    setError(null);
    setDuetState("permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setDuetState("preview");
    } catch {
      setError("Camera access denied. Please allow permissions and try again.");
      setDuetState(role === "partner" ? "p2-intro" : "p1-idle");
    }
  }, [role, stopCamera]);

  // Attach stream once video element mounts
  useEffect(() => {
    if ((duetState === "preview" || duetState === "countdown") && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [duetState]);

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
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 400);

        if (dataUrl) {
          if (role === "initiator") {
            setLeftPhotos(prev => {
              const next = [...prev, dataUrl];
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
            // partner
            setRightPhotos(prev => {
              const next = [...prev, dataUrl];
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

  // ── Generate Person 1 share link (after p1-done) ─────────────────────────
  useEffect(() => {
    if (duetState !== "p1-done" || leftPhotos.length !== TOTAL_SHOTS || shareLink) return;
    setLinkLoading(true);
    Promise.all(leftPhotos.map(compressForUrl)).then(compressed => {
      const encoded = encodeForUrl({ phase: "p1", p1: compressed });
      setShareLink(`${window.location.origin}/#duet=${encoded}`);
      setLinkLoading(false);
    });
  }, [duetState, leftPhotos, shareLink]);

  // ── Start the countdown (resets shot counter to 0) ───────────────────────
  const startCountdown = useCallback(() => {
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECS);
    setDuetState("countdown");
  }, []);

  // ── Generate final link for partner to share back ─────────────────────────
  useEffect(() => {
    if (duetState !== "final" || role !== "partner" || rightPhotos.length !== TOTAL_SHOTS || finalLink) return;
    setLinkLoading(true);
    Promise.all(rightPhotos.map(compressForUrl)).then(compressedP2 => {
      // leftPhotos are already compressed (came from URL)
      const encoded = encodeForUrl({ phase: "final", p1: leftPhotos, p2: compressedP2 });
      setFinalLink(`${window.location.origin}/#duet=${encoded}`);
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

  // ── Handle home ───────────────────────────────────────────────────────────
  const handleHome = useCallback(() => {
    stopCamera();
    window.history.replaceState(null, "", window.location.pathname);
    onHome();
  }, [stopCamera, onHome]);

  // ── Reset for retake (initiator) ─────────────────────────────────────────
  const handleRetake = useCallback(() => {
    setLeftPhotos([]);
    setCurrentShot(0);
    setCountdown(COUNTDOWN_SECS);
    setShareLink(null);
    startCamera(facingMode);
  }, [facingMode, startCamera]);

  // ── Ghost to show during partner's countdown ──────────────────────────────
  const ghostPhoto = role === "partner" && leftPhotos.length > 0
    ? leftPhotos[Math.min(currentShot, leftPhotos.length - 1)]
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-h-screen flex flex-col items-center">
      {/* Header */}
      <header className="w-full text-center py-3 md:py-5 px-4 border-b border-parchment/60 bg-cream sticky top-0 z-20">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={handleHome} className="font-sans text-xs text-warm-brown/60 hover:text-warm-brown transition-colors px-2 py-1">
            ← Back
          </button>
          <div className="text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-burnt-orange tracking-tight leading-tight">
              Flashback
            </h1>
            <p className="font-sans text-xs text-warm-brown mt-0.5 tracking-widest uppercase">
              Duet Booth
            </p>
          </div>
          <div className="w-12" /> {/* spacer */}
        </div>
      </header>

      <div className="w-full max-w-lg px-4 pb-8 flex flex-col items-center gap-4 mt-4">

        {/* Loading */}
        {duetState === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <div className="w-10 h-10 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* ── Person 1: Idle ─────────────────────────────────────────────── */}
        {duetState === "p1-idle" && (
          <div className="flex flex-col items-center gap-6 w-full py-2 page-transition">
            <DuetIllustration />
            <div className="text-center max-w-xs">
              <h2 className="font-serif text-xl font-semibold text-dark-brown mb-1">How Duet Booth works</h2>
              <p className="font-sans text-sm text-warm-brown/80 mb-4 leading-relaxed">
                Two people, two places — one shared photo strip.
              </p>
              <ol className="font-sans text-sm text-warm-brown space-y-2 text-left">
                {[
                  "You shoot 4 poses — a link is generated",
                  "Share the link with your partner",
                  "They see your ghost photo and shoot alongside",
                  "You both get the combined strip to download",
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

            {error && <ErrorBanner message={error} />}

            <button
              onClick={() => startCamera(facingMode)}
              className="leather-btn leather-btn-primary font-sans font-semibold text-lg py-4 px-10 rounded-xl"
            >
              Start My Shoot
            </button>
            <p className="font-sans text-xs text-warm-brown/50 text-center max-w-[240px]">
              You go first. Your partner joins after.
            </p>
          </div>
        )}

        {/* ── Person 2: Intro ────────────────────────────────────────────── */}
        {duetState === "p2-intro" && (
          <div className="flex flex-col items-center gap-5 w-full py-2 page-transition">
            <div className="text-center">
              <h2 className="font-serif text-2xl font-bold text-burnt-orange">Your partner is ready!</h2>
              <p className="font-sans text-sm text-warm-brown mt-1">
                Their photo will appear as a ghost on the left side of your viewfinder.
                <br />Position yourself on the <strong>right</strong>.
              </p>
            </div>

            {/* Preview of partner's first photo */}
            {leftPhotos[0] && (
              <div className="w-48 rounded-lg overflow-hidden border-4 border-dark-brown shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={leftPhotos[0]} alt="Partner's first shot" className="w-full block bw-photo" style={{ aspectRatio: "4/3", objectFit: "cover" }} />
                <div className="bg-dark-brown text-gold text-center text-[10px] font-mono py-1 tracking-widest">YOUR PARTNER</div>
              </div>
            )}

            <ol className="font-sans text-sm text-warm-brown space-y-1.5 text-left max-w-xs w-full">
              {[
                "Allow camera access",
                "See your partner's ghost on the left",
                "Position yourself on the right side",
                "The booth takes 4 shots automatically",
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5 items-start">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-burnt-orange/10 text-burnt-orange font-semibold text-xs flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {error && <ErrorBanner message={error} />}

            <button
              onClick={() => startCamera(facingMode)}
              className="leather-btn leather-btn-primary font-sans font-semibold text-lg py-4 px-10 rounded-xl"
            >
              Open My Camera
            </button>
          </div>
        )}

        {/* ── Camera permission loading ──────────────────────────────────── */}
        {duetState === "permission" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-12 h-12 border-4 border-burnt-orange border-t-transparent rounded-full animate-spin" />
            <p className="font-sans text-warm-brown text-sm">Accessing camera…</p>
          </div>
        )}

        {/* ── Camera: preview + countdown ────────────────────────────────── */}
        {(duetState === "preview" || duetState === "countdown") && (
          <div className="w-full flex flex-col items-center gap-4">
            {/* Shot progress dots */}
            <div className="flex gap-2 items-center">
              {Array.from({ length: TOTAL_SHOTS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                    i < currentShot
                      ? "bg-burnt-orange border-burnt-orange"
                      : i === currentShot && duetState === "countdown"
                      ? "bg-gold border-gold scale-125"
                      : "bg-transparent border-warm-brown/40"
                  }`}
                />
              ))}
              <span className="font-sans text-xs text-warm-brown ml-2">
                {currentShot + 1} / {TOTAL_SHOTS}
              </span>
            </div>

            {/* Viewfinder */}
            <div
              className="relative w-full overflow-hidden rounded-lg border-4 border-dark-brown shadow-2xl bg-film-black"
              style={{ aspectRatio: "4/3" }}
            >
              {/* Live camera */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
                playsInline muted autoPlay
              />

              {/* Ghost overlay: partner's photo on left half */}
              {ghostPhoto && (
                <>
                  <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden z-10 pointer-events-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={ghostPhoto}
                      alt="Partner ghost"
                      className="w-full h-full object-cover opacity-50"
                    />
                    {/* Subtle ghost tint */}
                    <div className="absolute inset-0 bg-cream/5" />
                  </div>
                  {/* Center divider */}
                  <div className="absolute inset-y-0 left-1/2 w-px bg-gold/50 z-20 pointer-events-none" />
                  {/* Side labels */}
                  <div className="absolute top-2 left-0 w-1/2 flex justify-center z-20 pointer-events-none">
                    <span className="font-mono text-[9px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded tracking-wider">PARTNER</span>
                  </div>
                  <div className="absolute top-2 right-0 w-1/2 flex justify-center z-20 pointer-events-none">
                    <span className="font-mono text-[9px] text-white/70 bg-black/40 px-1.5 py-0.5 rounded tracking-wider">YOU →</span>
                  </div>
                </>
              )}

              {/* Countdown number */}
              {duetState === "countdown" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
                  <div className="bg-black/30 rounded-full w-24 h-24 flex items-center justify-center animate-count-pulse">
                    <span className="font-serif text-6xl font-bold text-white drop-shadow-lg">{countdown}</span>
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

              {/* Film frame corners */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-gold/70" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-gold/70" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-gold/70" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-gold/70" />
            </div>

            {/* Controls */}
            <div className="flex gap-3 w-full">
              {duetState === "preview" && (
                <>
                  <button
                    onClick={startCountdown}
                    className="leather-btn leather-btn-primary flex-1 font-sans font-semibold text-base py-3.5 px-6 rounded-lg"
                  >
                    {role === "partner" ? "Start My Shoot" : "Start Shoot"}
                  </button>
                  {hasMultiCam && (
                    <button onClick={flipCamera} title="Flip camera"
                      className="leather-btn leather-btn-secondary font-sans text-sm py-3.5 px-4 rounded-lg"
                    >
                      <FlipIcon />
                    </button>
                  )}
                </>
              )}
              {duetState === "countdown" && (
                <div className="flex-1 text-center font-sans text-sm text-warm-brown">
                  Pose {currentShot + 1} of {TOTAL_SHOTS}
                  {role === "partner" && " — position right of the ghost!"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Person 1 Done: share link screen ───────────────────────────── */}
        {duetState === "p1-done" && (
          <div className="w-full flex flex-col items-center gap-5 page-transition">
            <div className="text-center">
              <h2 className="font-serif text-2xl font-bold text-burnt-orange">Your shots are in!</h2>
              <p className="font-sans text-sm text-warm-brown mt-1">
                Share this link with your partner so they can join the booth.
              </p>
            </div>

            {/* Thumbnail grid */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
              {leftPhotos.map((photo, i) => (
                <div key={i} className="relative rounded overflow-hidden border-2 border-dark-brown">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt={`Shot ${i + 1}`} className="w-full block bw-photo" style={{ aspectRatio: "4/3", objectFit: "cover" }} />
                  <span className="absolute top-1 left-1 bg-black/60 text-gold text-[9px] font-mono font-bold w-4 h-4 flex items-center justify-center rounded-sm">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>

            {/* Share link */}
            <div className="w-full max-w-sm flex flex-col gap-2">
              <p className="font-sans text-xs text-warm-brown/70 uppercase tracking-wider">Partner link</p>
              {linkLoading ? (
                <div className="flex items-center gap-2 text-sm text-warm-brown">
                  <div className="w-4 h-4 border-2 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                  Generating link…
                </div>
              ) : shareLink ? (
                <>
                  <div className="bg-parchment border border-warm-brown/20 rounded-lg px-3 py-2 font-mono text-[11px] text-warm-brown break-all leading-relaxed max-h-16 overflow-y-auto">
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

            <div className="flex gap-3 w-full max-w-sm">
              <button onClick={handleRetake} className="leather-btn leather-btn-secondary flex-1 font-sans font-semibold text-sm py-3 px-4 rounded-lg">
                Retake
              </button>
              <button onClick={handleHome} className="leather-btn leather-btn-dark font-sans font-semibold text-sm py-3 px-4 rounded-lg">
                Home
              </button>
            </div>

            <p className="font-sans text-xs text-warm-brown/50 text-center max-w-[260px]">
              Your partner will shoot their poses. Once done, they&apos;ll send you a final link with the combined strip.
            </p>
          </div>
        )}

        {/* ── Final combined strip ────────────────────────────────────────── */}
        {duetState === "final" && leftPhotos.length > 0 && rightPhotos.length > 0 && (
          <div className="w-full flex flex-col items-center gap-5 page-transition">
            <div className="text-center">
              <h2 className="font-serif text-2xl font-bold text-burnt-orange">
                {role === "viewer" ? "Your Duet Strip!" : "The Strip is Ready!"}
              </h2>
              <p className="font-sans text-sm text-warm-brown mt-1">
                {role === "viewer"
                  ? "Download your combined photo strip below."
                  : "Share the final link with your partner so they can download too."}
              </p>
            </div>

            <DuetStrip p1Photos={leftPhotos} p2Photos={rightPhotos} />

            {/* Final link (partner shares back to initiator) */}
            {role === "partner" && (
              <div className="w-full max-w-sm flex flex-col gap-2">
                <p className="font-sans text-xs text-warm-brown/70 uppercase tracking-wider">Send this to your partner</p>
                {linkLoading ? (
                  <div className="flex items-center gap-2 text-sm text-warm-brown">
                    <div className="w-4 h-4 border-2 border-burnt-orange border-t-transparent rounded-full animate-spin" />
                    Generating final link…
                  </div>
                ) : finalLink ? (
                  <>
                    <div className="bg-parchment border border-warm-brown/20 rounded-lg px-3 py-2 font-mono text-[11px] text-warm-brown break-all leading-relaxed max-h-16 overflow-y-auto">
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
        )}

      </div>
    </div>
  );

}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="font-sans text-sm text-deep-orange bg-deep-orange/10 border border-deep-orange/20 rounded-lg px-4 py-2.5 text-center max-w-xs">
      {message}
    </p>
  );
}

function DuetIllustration() {
  return (
    <div className="relative w-52 h-44 flex items-center justify-center">
      {/* Two film strips side by side */}
      <div className="w-16 bg-dark-brown rounded-sm shadow-xl flex flex-col gap-1 p-1.5 absolute left-6 top-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-full bg-warm-brown/30 rounded-sm" style={{ height: "28px" }} />
        ))}
      </div>
      <div className="w-16 bg-dark-brown rounded-sm shadow-xl flex flex-col gap-1 p-1.5 absolute right-6 top-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-full bg-warm-brown/30 rounded-sm" style={{ height: "28px" }} />
        ))}
      </div>
      {/* Link icon in center */}
      <div className="relative z-10 w-14 h-14 bg-burnt-orange rounded-full flex items-center justify-center shadow-xl">
        <LinkIcon />
      </div>
    </div>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  );
}
