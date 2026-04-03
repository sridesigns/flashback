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
      style={{ background: "#FAF6ED" }}
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
            backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 28px, #212E24 28px, #212E24 29px)",
          }}
        />

        {/* Texture layer 3: warm edge vignette */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 40%, rgba(33,46,36,0.055) 100%)",
          }}
        />
      </div>

      {/* ── Two-column hero — fills the viewport ── */}
      <div className="flex-1 flex flex-col md:flex-row relative z-10"
        style={{ padding: "0 clamp(16px, 5vw, 80px)" }}>

        {/* Left: illustration */}
        <div className="flex-1 flex items-center justify-center overflow-hidden"
          style={{ minHeight: "40vh" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration.png"
            alt="Film strip sketch illustration"
            className="illus-float w-auto object-contain select-none"
            style={{
              filter: "drop-shadow(0 16px 48px rgba(0,0,0,0.13))",
              maxHeight: "clamp(320px, 70vh, 780px)",
            }}
            draggable={false}
          />
        </div>

        {/* Right: content */}
        <div className="flex-1 flex flex-col justify-center w-full"
          style={{ padding: "32px 0 40px", maxWidth: "none" }}>
          <div style={{ maxWidth: "520px", margin: "0 auto", width: "100%" }}
            className="md:mx-0 flex flex-col gap-5 md:gap-6">

            {/* Brand */}
            <p
              className="font-typewriter"
              style={{ color: "#57534E", fontSize: "clamp(0.7rem, 1.5vw, 0.78rem)", letterSpacing: "0.12em" }}
            >
              cito-foto
            </p>

            {/* Headline */}
            <h1
              className="font-typewriter"
              style={{
                color: "#212E24",
                fontSize: "clamp(28px, 4.5vw, 48px)",
                fontWeight: "600",
                letterSpacing: "-0.01em",
                lineHeight: "120%",
              }}
            >
              Four frames. One strip.<br />
              Infinite reasons to<br />
              squeeze in closer.
            </h1>

            {/* Body */}
            <p
              className="font-typewriter"
              style={{ color: "#57534E", fontSize: "clamp(14px, 1.8vw, 18px)", lineHeight: "1.5" }}
            >
              A retro booth that lives in your browser — No cloud. No account.
            </p>

            {/* CTA */}
            <button
              onClick={onOpen}
              className="font-typewriter transition-opacity hover:opacity-80 active:opacity-60"
              style={{
                background: "#212E24",
                color: "#FAF6ED",
                border: "none",
                padding: "clamp(12px, 1.5vw, 15px) 28px",
                fontSize: "clamp(16px, 2.2vw, 24px)",
                lineHeight: "140%",
                fontFamily: "inherit",
                borderRadius: "6px",
                cursor: "pointer",
                width: "100%",
                letterSpacing: "0.01em",
              }}
            >
              Step in to create memories
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="w-full flex flex-wrap items-center justify-between gap-2 font-typewriter relative z-10"
        style={{ padding: "16px clamp(16px, 5vw, 80px)" }}
      >
        <p style={{ color: "#57534E", fontSize: "clamp(0.65rem, 1.5vw, 0.72rem)" }}>
          made with ❤️ by sriram venugopal
        </p>
        <button
          style={{
            color: "#57534E",
            fontSize: "clamp(0.65rem, 1.5vw, 0.72rem)",
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
