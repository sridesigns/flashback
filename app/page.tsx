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
    <div className="w-full flex flex-col">
      <SiteHeader onOpen={onOpen} />
      <HeroSection onOpen={onOpen} />
      <ManifestoSection />
      <HowItWorksSection />
      <DuetFeatureSection onOpen={onOpen} />
      <SiteFooter />
    </div>
  );
}

// ─── Site Header ──────────────────────────────────────────────────────────────

function SiteHeader({ onOpen }: { onOpen: () => void }) {
  return (
    <header className="w-full sticky top-0 z-30 bg-cream/92 backdrop-blur-md border-b border-dark-brown/8">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FilmFrameIcon />
          <span className="font-serif text-lg font-bold text-dark-brown tracking-tight">CitoFoto</span>
        </div>
        <button
          onClick={onOpen}
          className="leather-btn leather-btn-primary font-sans font-semibold text-sm py-2.5 px-5 rounded-lg"
        >
          Open the Booth →
        </button>
      </div>
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="w-full max-w-4xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 flex flex-col items-center text-center">

      {/* Headline — large, tight, editorial */}
      <h1
        className="font-serif font-bold text-dark-brown leading-[1.06] mb-7"
        style={{ fontSize: "clamp(2.8rem, 9vw, 5.5rem)", letterSpacing: "-0.025em" }}
      >
        Four poses.<br />
        One strip.<br />
        <span className="text-burnt-orange italic">Yours forever.</span>
      </h1>

      {/* Sub-copy */}
      <p className="font-sans text-base md:text-lg text-warm-brown/70 max-w-sm leading-relaxed mb-10">
        A retro photo booth that lives in your browser.
        No account, no cloud, nothing to install.
      </p>

      {/* CTA */}
      <button
        onClick={onOpen}
        className="leather-btn leather-btn-primary font-sans font-semibold text-base py-4 px-9 rounded-xl"
      >
        Open the Booth
      </button>

      {/* Decorative scrolling film strip */}
      <FilmStripPreview />
    </section>
  );
}

function FilmStripPreview() {
  return (
    <div className="relative w-full max-w-sm mt-14 overflow-hidden opacity-60" style={{ height: "72px" }}>
      <div
        className="flex gap-2.5 items-center absolute"
        style={{ animation: "slideFilm 14s linear infinite", width: "220%" }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 rounded border border-dark-brown/15 bg-parchment/80 flex items-center justify-center"
            style={{ width: "52px", height: "60px" }}
          >
            <div className="w-3.5 h-3.5 rounded-full border border-dark-brown/15" />
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" />
      <style>{`
        @keyframes slideFilm {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── Manifesto Section ────────────────────────────────────────────────────────

function ManifestoSection() {
  return (
    <section className="w-full bg-dark-brown py-20 md:py-28 px-6">
      <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
        <p
          className="font-serif font-medium text-cream leading-relaxed"
          style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", letterSpacing: "-0.01em" }}
        >
          "Open. Pose. Download.<br className="hidden sm:block" /> That&apos;s it."
        </p>
        <p className="font-sans text-sm text-cream/45 leading-relaxed max-w-xs">
          We don&apos;t store your photos. We don&apos;t need your email.
          Just a beautiful moment — and a film strip to prove it happened.
        </p>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      n: "01",
      title: "Open the booth",
      body: "No download, no sign-up. Allow camera access and you're ready in seconds.",
    },
    {
      n: "02",
      title: "Strike four poses",
      body: "Three-second countdown, four times. Silly, sincere, or somewhere in between.",
    },
    {
      n: "03",
      title: "Download your strip",
      body: "Black-and-white, classic, instantly. No watermarks, no waiting, no cloud.",
    },
  ];

  return (
    <section className="w-full py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <p className="font-sans text-xs text-burnt-orange uppercase tracking-[0.2em] font-semibold mb-3">
            How it works
          </p>
          <h2
            className="font-serif font-bold text-dark-brown"
            style={{ fontSize: "clamp(1.8rem, 5vw, 2.8rem)", letterSpacing: "-0.02em" }}
          >
            Simple by design.
          </h2>
        </div>

        <div className="flex flex-col gap-14">
          {steps.map((step) => (
            <div key={step.n} className="flex gap-8 items-start">
              <span
                className="font-serif font-bold text-warm-brown/10 leading-none shrink-0 select-none"
                style={{ fontSize: "clamp(3.5rem, 10vw, 6rem)" }}
              >
                {step.n}
              </span>
              <div className="pt-2">
                <h3 className="font-serif text-xl font-bold text-dark-brown mb-2 leading-tight">{step.title}</h3>
                <p className="font-sans text-base text-warm-brown/65 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Duet Feature Section ─────────────────────────────────────────────────────

function DuetFeatureSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="w-full bg-parchment/40 border-y border-dark-brown/8 py-20 md:py-28 px-6">
      <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
        <p className="font-sans text-xs text-gold uppercase tracking-[0.2em] font-semibold">
          Duet Mode
        </p>
        <h2
          className="font-serif font-bold text-dark-brown leading-tight"
          style={{ fontSize: "clamp(2rem, 6vw, 3.5rem)", letterSpacing: "-0.02em" }}
        >
          Shoot together.<br />
          <span className="text-gold italic">From anywhere.</span>
        </h2>
        <p className="font-sans text-base text-warm-brown/70 max-w-sm leading-relaxed">
          Take your shots, then share the link you get with a partner. They pose alongside your ghost —
          one seamless B&amp;W strip, both of you, any distance.
        </p>
        <button
          onClick={onOpen}
          className="leather-btn leather-btn-dark font-sans font-semibold text-base py-4 px-9 rounded-xl mt-2"
        >
          Open the Booth
        </button>
      </div>
    </section>
  );
}

// ─── Site Footer ──────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="w-full py-10 px-6 border-t border-dark-brown/8">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <FilmFrameIcon className="text-dark-brown/30" />
          <span className="font-serif text-sm font-bold text-dark-brown/40">CitoFoto</span>
        </div>
        <p className="font-sans text-xs text-dark-brown/30">
          A photo booth for the internet. Made with ♥
        </p>
        <div className="flex gap-1.5 opacity-20">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-2.5 h-1.5 rounded-sm border border-dark-brown/60" />
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FilmFrameIcon({ className = "text-burnt-orange" }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path strokeLinecap="round" d="M7 4v16M17 4v16" />
      <path strokeLinecap="round" d="M2 8h5M17 8h5M2 12h5M17 12h5M2 16h5M17 16h5" />
    </svg>
  );
}
