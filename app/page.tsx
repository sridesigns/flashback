"use client";

import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
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
    <main className="min-h-screen flex flex-col items-center justify-start" style={{ background: "#FDF6EB" }}>
      {mode === "home"    && <LandingPage onOpen={() => setMode("regular")} />}
      {mode === "regular" && <PhotoBooth onHome={goHome} />}
      {mode === "duet"    && <DuetBooth  onHome={goHome} />}
    </main>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="w-full flex flex-col md:flex-row md:min-h-screen relative overflow-hidden">

      {/* ── Global paper grain texture (over both panels) ── */}
      <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
        <svg
          className="grain-layer absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-[0.032]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="paper">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0.15" />
          </filter>
          <rect width="100%" height="100%" filter="url(#paper)" />
        </svg>
        <div
          className="absolute inset-0 opacity-[0.028]"
          style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 28px, #1A1713 28px, #1A1713 29px)" }}
        />
      </div>

      {/* ── Left panel — Terracotta ── */}
      <div
        className="md:w-[48%] flex flex-col relative left-panel-height"
        style={{ background: "#E8593C" }}
      >
        {/* Logo */}
        <div style={{ padding: "clamp(20px, 3vw, 40px) clamp(20px, 3.5vw, 48px)" }}>
          <p
            className="font-sans"
            style={{ color: "#FDF6EB", fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)", letterSpacing: "0.14em", opacity: 0.9 }}
          >
            cito-foto
          </p>
        </div>

        {/* Illustration — centered, tilted */}
        <div className="flex-1 flex items-center justify-center overflow-hidden"
          style={{ padding: "0 clamp(16px, 4vw, 56px) clamp(24px, 4vh, 56px)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/illustration.png"
            alt="Film strip sketch illustration"
            className="illus-float w-auto object-contain select-none"
            style={{
              maxHeight: "clamp(220px, 62vh, 780px)",
              filter: "drop-shadow(0 20px 56px rgba(0,0,0,0.22))",
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* ── Right panel — Cream ── */}
      <div
        className="md:flex-1 md:min-h-screen flex flex-col relative z-[1]"
        style={{ background: "#FDF6EB" }}
      >
        {/* Content — vertically centered */}
        <div className="flex-1 flex flex-col justify-center"
          style={{ padding: "clamp(32px, 5vh, 64px) clamp(24px, 5vw, 64px)" }}>
          <div className="flex flex-col gap-5 md:gap-7" style={{ maxWidth: "480px" }}>

            {/* Headline */}
            <h1
              className="font-typewriter"
              style={{
                color: "#1A1713",
                fontSize: "clamp(28px, 3.8vw, 52px)",
                fontWeight: "400",
                lineHeight: "115%",
                letterSpacing: "-0.01em",
              }}
            >
              Four frames.{" "}
              <em style={{ color: "#E8593C", fontStyle: "italic" }}>One strip.</em>
              {" "}Infinite reasons to squeeze in closer.
            </h1>

            {/* Body */}
            <p
              className="font-sans"
              style={{ color: "#7A6E62", fontSize: "clamp(13px, 1.4vw, 15px)", lineHeight: "1.65" }}
            >
              A retro booth that lives in your browser.
            </p>

            {/* CTA */}
            <div className="flex flex-col gap-2.5" style={{ width: "min(100%, 360px)" }}>
              <button
                onClick={onOpen}
                className="font-typewriter"
                onMouseEnter={e => { e.currentTarget.style.background = "#FFDD00"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#F2C94C"; }}
                style={{
                  background: "#F2C94C",
                  color: "#1A1713",
                  border: "none",
                  padding: "clamp(12px, 1.4vw, 16px) clamp(20px, 2vw, 32px)",
                  fontSize: "clamp(15px, 1.6vw, 19px)",
                  lineHeight: "1",
                  fontFamily: "inherit",
                  borderRadius: "8px",
                  cursor: "pointer",
                  letterSpacing: "0.01em",
                  fontWeight: "500",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  transition: "background 0.22s ease",
                }}
              >
                Enter into the Booth
                <ArrowRight size={18} style={{ animation: "cta-nudge 2s ease-in-out infinite", flexShrink: 0 }} />
              </button>
              <p className="font-sans" style={{ color: "#2D6A4F", fontSize: "clamp(11px, 1.1vw, 13px)", letterSpacing: "0.02em" }}>
                No cloud. No account.
              </p>
            </div>

          </div>
        </div>

        {/* Footer — pinned to bottom of right panel */}
        <footer
          className="w-full flex flex-wrap items-center justify-between gap-2 font-sans relative"
          style={{ padding: "14px clamp(24px, 5vw, 64px)", borderTop: "1px solid rgba(26,23,19,0.08)" }}
        >
          <p style={{ color: "#7A6E62", fontSize: "clamp(0.6rem, 1.2vw, 0.68rem)" }}>
            made with ❤️ by sriram venugopal
          </p>
          <div className="flex items-center gap-3">
            <span style={{ color: "#7A6E62", fontSize: "clamp(0.6rem, 1.2vw, 0.68rem)" }}>Got feedback?</span>
            <a href="https://x.com/sriongrid" target="_blank" rel="noopener noreferrer" title="X (Twitter)" style={{ color: "#7A6E62" }} className="transition-colors hover:[color:#E8593C]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="X"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://www.linkedin.com/in/sriramvenugopal/" target="_blank" rel="noopener noreferrer" title="LinkedIn" style={{ color: "#7A6E62" }} className="transition-colors hover:[color:#E8593C]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="LinkedIn"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://instagram.com/_sriramvenugopal" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ color: "#7A6E62" }} className="transition-colors hover:[color:#E8593C]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-label="Instagram"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
            </a>
          </div>
        </footer>
      </div>

    </div>
  );
}
