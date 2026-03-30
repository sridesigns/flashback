"use client";

import { useState, useEffect } from "react";
import PhotoBooth from "@/components/PhotoBooth";
import DuetBooth  from "@/components/DuetBooth";

type AppMode = "home" | "regular" | "duet";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("home");

  useEffect(() => {
    if (window.location.hash.startsWith("#duet=")) setMode("duet");
  }, []);

  const goHome = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setMode("home");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-start bg-cream">
      {mode === "home"    && <LandingPage onOpen={() => setMode("regular")} />}
      {mode === "regular" && <PhotoBooth onHome={goHome} />}
      {mode === "duet"    && <DuetBooth  onHome={goHome} />}
    </main>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="w-full min-h-screen flex flex-col font-typewriter relative overflow-hidden"
      style={{ background: "#FAFAF9" }}
    >

      {/* ── Texture layer 1: paper grain (animated drift) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <svg
          className="grain-layer absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-[0.038]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0.15" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paper)" />
        </svg>

        {/* Texture layer 2: very faint horizontal rules — old typewriter paper */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 28px, #1C1917 28px, #1C1917 29px)",
          }}
        />

        {/* Texture layer 3: warm edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 40%, rgba(28,25,23,0.055) 100%)",
          }}
        />
      </div>

      {/* ── Two-column hero — fills the viewport ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-10">

        {/* Left: illustration */}
        <div className="flex-1 flex items-center justify-center p-8 md:p-12 md:py-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration.png"
            alt="Film strip sketch illustration"
            className="illus-float max-h-[60vh] md:max-h-[80vh] w-auto object-contain select-none"
            style={{ filter: "drop-shadow(0 16px 48px rgba(0,0,0,0.13))" }}
            draggable={false}
          />
        </div>

        {/* Right: content */}
        <div className="flex-1 flex flex-col justify-center px-8 md:px-14 lg:px-20 pb-12 md:pb-0 gap-7 max-w-xl md:max-w-none mx-auto md:mx-0 w-full">

          {/* Brand */}
          <p
            className="font-typewriter tracking-widest"
            style={{ color: "#57534E", fontSize: "0.78rem", letterSpacing: "0.12em" }}
          >
            cito-foto
          </p>

          {/* Headline */}
          <h1
            className="font-typewriter leading-snug"
            style={{
              color: "#1C1917",
              fontSize: "clamp(1.85rem, 3.2vw, 2.75rem)",
              fontWeight: "700",
              letterSpacing: "-0.01em",
              lineHeight: "1.2",
            }}
          >
            Four frames. One strip.<br />
            Infinite reasons to<br />
            squeeze in closer.
          </h1>

          {/* Body */}
          <p
            className="font-typewriter leading-relaxed"
            style={{ color: "#57534E", fontSize: "clamp(0.9rem, 1.2vw, 1.05rem)", maxWidth: "380px" }}
          >
            A retro booth that lives in your browser —<br />
            No cloud. No account.
          </p>

          {/* CTA */}
          <button
            onClick={onOpen}
            className="font-typewriter transition-opacity hover:opacity-80 active:opacity-60"
            style={{
              background: "#1C1917",
              color: "#FAFAF9",
              border: "none",
              padding: "15px 28px",
              fontSize: "clamp(0.88rem, 1.1vw, 1rem)",
              fontFamily: "inherit",
              borderRadius: "6px",
              cursor: "pointer",
              maxWidth: "380px",
              width: "100%",
              letterSpacing: "0.01em",
            }}
          >
            Step in to create memories
          </button>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="w-full flex items-center justify-between font-typewriter relative z-10"
        style={{
          padding: "18px 32px",
          borderTop: "1px solid rgba(28,25,23,0.08)",
        }}
      >
        <p style={{ color: "#57534E", fontSize: "0.72rem" }}>
          made with ❤️ by sriram venugopal
        </p>
        <button
          style={{
            color: "#57534E",
            fontSize: "0.72rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Got feedback? Reach out
        </button>
      </footer>
    </div>
  );
}
