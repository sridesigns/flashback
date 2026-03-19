"use client";

import { useState, useEffect } from "react";
import PhotoBooth from "@/components/PhotoBooth";
import DuetBooth  from "@/components/DuetBooth";

type AppMode = "home" | "regular" | "duet";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("home");

  // Auto-enter duet mode if the URL hash carries a duet payload
  useEffect(() => {
    if (window.location.hash.startsWith("#duet=")) {
      setMode("duet");
    }
  }, []);

  const goHome = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setMode("home");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-start bg-cream">
      {mode === "home"    && <LandingPage onRegular={() => setMode("regular")} onDuet={() => setMode("duet")} />}
      {mode === "regular" && <PhotoBooth onHome={goHome} />}
      {mode === "duet"    && <DuetBooth  onHome={goHome} />}
    </main>
  );
}

// ─── Landing Page ─────────────────────────────────────────────────────────────

function LandingPage({ onRegular, onDuet }: { onRegular: () => void; onDuet: () => void }) {
  return (
    <div className="w-full flex flex-col">
      <SiteHeader onRegular={onRegular} />
      <HeroSection onRegular={onRegular} onDuet={onDuet} />
      <HowItWorksSection />
      <ModesSection onRegular={onRegular} onDuet={onDuet} />
      <TrustBar />
      <SiteFooter />
    </div>
  );
}

// ─── Site Header ──────────────────────────────────────────────────────────────

function SiteHeader({ onRegular }: { onRegular: () => void }) {
  return (
    <header className="w-full sticky top-0 z-30 bg-cream/90 backdrop-blur-sm border-b border-parchment/80">
      <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
        {/* Wordmark */}
        <div className="flex items-center gap-2.5">
          <FilmFrameIcon />
          <span className="font-serif text-xl font-bold text-burnt-orange tracking-tight">Flashback</span>
        </div>

        {/* Nav CTA */}
        <button
          onClick={onRegular}
          className="leather-btn leather-btn-primary font-sans font-semibold text-sm py-2 px-5 rounded-lg"
        >
          Start Shooting →
        </button>
      </div>
    </header>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ onRegular, onDuet }: { onRegular: () => void; onDuet: () => void }) {
  return (
    <section className="w-full max-w-3xl mx-auto px-5 pt-14 pb-12 flex flex-col items-center text-center gap-6">
      {/* Badge */}
      <div className="flex items-center gap-1.5 bg-burnt-orange/10 text-burnt-orange rounded-full px-3.5 py-1 font-sans text-xs font-semibold tracking-wider uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-burnt-orange animate-pulse" />
        Classic Film Booth · No Account Needed
      </div>

      {/* Headline */}
      <h1 className="font-serif text-4xl md:text-6xl font-bold text-dark-brown leading-tight tracking-tight max-w-xl">
        Step into the{" "}
        <span className="text-burnt-orange italic">booth.</span>
      </h1>

      {/* Subheadline */}
      <p className="font-sans text-base md:text-lg text-warm-brown/80 max-w-sm leading-relaxed">
        Four poses. Three seconds each. One timeless black-and-white film strip — yours to keep forever.
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs sm:max-w-none sm:justify-center mt-1">
        <button
          onClick={onRegular}
          className="leather-btn leather-btn-primary w-full sm:w-auto font-sans font-semibold text-base py-4 px-8 rounded-xl"
        >
          📸 &nbsp;Start Solo Shoot
        </button>
        <button
          onClick={onDuet}
          className="leather-btn leather-btn-dark w-full sm:w-auto font-sans font-semibold text-base py-4 px-8 rounded-xl"
        >
          🔗 &nbsp;Try Duet Mode
        </button>
      </div>

      {/* Decorative film strip preview */}
      <FilmStripPreview />
    </section>
  );
}

/** Decorative animated film strip made of empty frames */
function FilmStripPreview() {
  return (
    <div className="relative w-full max-w-xs mt-2 overflow-hidden" style={{ height: "80px" }}>
      {/* Scrolling strip */}
      <div
        className="flex gap-2 items-center absolute"
        style={{
          animation: "slideFilm 12s linear infinite",
          width: "200%",
        }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 rounded-sm border border-warm-brown/25 bg-parchment/60 flex items-center justify-center"
            style={{ width: "56px", height: "64px" }}
          >
            <div className="w-4 h-4 rounded-full border border-warm-brown/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-warm-brown/20" />
            </div>
          </div>
        ))}
      </div>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cream to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-cream to-transparent z-10 pointer-events-none" />

      <style>{`
        @keyframes slideFilm {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorksSection() {
  const steps = [
    {
      icon: <CameraIcon />,
      number: "01",
      title: "Open the booth",
      body: "No sign-up, no app install. Just tap and allow camera access — you're ready to shoot.",
    },
    {
      icon: <TimerIcon />,
      number: "02",
      title: "Strike four poses",
      body: "A 3-second countdown fires four times. Silly, dramatic, candid — it's your show.",
    },
    {
      icon: <DownloadIcon />,
      number: "03",
      title: "Keep your strip",
      body: "Your classic black-and-white film strip downloads instantly. No cloud, no waiting.",
    },
  ];

  return (
    <section className="w-full bg-parchment/50 border-y border-parchment py-12 px-5">
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
        {/* Section label */}
        <div className="text-center">
          <p className="font-sans text-xs text-burnt-orange/70 uppercase tracking-[0.2em] font-semibold mb-1.5">How it works</p>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-dark-brown">Simple as 1-2-3</h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full">
          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col gap-3 bg-cream rounded-2xl p-5 border border-parchment shadow-sm">
              {/* Step number background */}
              <span className="absolute top-4 right-4 font-serif text-5xl font-bold text-warm-brown/8 leading-none select-none">
                {step.number}
              </span>
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-burnt-orange/10 flex items-center justify-center text-burnt-orange">
                {step.icon}
              </div>
              <h3 className="font-serif text-base font-bold text-dark-brown leading-tight">{step.title}</h3>
              <p className="font-sans text-sm text-warm-brown/75 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Booth Modes ──────────────────────────────────────────────────────────────

function ModesSection({ onRegular, onDuet }: { onRegular: () => void; onDuet: () => void }) {
  return (
    <section className="w-full max-w-3xl mx-auto px-5 py-12 flex flex-col items-center gap-8">
      <div className="text-center">
        <p className="font-sans text-xs text-burnt-orange/70 uppercase tracking-[0.2em] font-semibold mb-1.5">Choose your experience</p>
        <h2 className="font-serif text-2xl md:text-3xl font-bold text-dark-brown">Pick your booth</h2>
      </div>

      <div className="w-full flex flex-col gap-4">
        {/* Regular Booth */}
        <button
          onClick={onRegular}
          className="group w-full text-left rounded-2xl border-2 border-warm-brown/15 bg-parchment hover:border-burnt-orange/40 hover:bg-cream transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden"
        >
          <div className="flex items-stretch">
            <div className="w-1.5 bg-burnt-orange shrink-0" />
            <div className="flex-1 p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl mt-0.5">📸</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-lg font-bold text-dark-brown leading-tight">Regular Booth</h3>
                    <span className="font-sans text-[10px] bg-burnt-orange/10 text-burnt-orange px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Solo</span>
                  </div>
                  <p className="font-sans text-sm text-warm-brown mt-1.5 leading-relaxed">
                    Strike four poses in rapid succession. A 3-second countdown keeps the energy up. Download your retro film strip the moment you&apos;re done.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {["4 poses", "3-sec timer", "B&W filter", "Instant download"].map(tag => (
                  <span key={tag} className="font-sans text-[10px] text-burnt-orange bg-burnt-orange/8 border border-burnt-orange/20 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center pr-4 text-warm-brown/25 group-hover:text-burnt-orange transition-colors">
              <ChevronRight />
            </div>
          </div>
        </button>

        {/* Duet Booth */}
        <button
          onClick={onDuet}
          className="group w-full text-left rounded-2xl border-2 border-warm-brown/15 bg-parchment hover:border-gold/60 hover:bg-cream transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden"
        >
          <div className="flex items-stretch">
            <div className="w-1.5 bg-gold shrink-0" />
            <div className="flex-1 p-5">
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl mt-0.5">🔗</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-lg font-bold text-dark-brown leading-tight">Duet Booth</h3>
                    <span className="font-sans text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">Two people</span>
                  </div>
                  <p className="font-sans text-sm text-warm-brown mt-1.5 leading-relaxed">
                    Shoot from anywhere, together. You take your four poses, then a link connects your partner. They see your ghost photo to pose alongside — one seamless shared strip.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {["Shareable link", "Ghost overlay", "Blended strip", "Any distance"].map(tag => (
                  <span key={tag} className="font-sans text-[10px] text-gold bg-gold/10 border border-gold/25 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center pr-4 text-warm-brown/25 group-hover:text-gold transition-colors">
              <ChevronRight />
            </div>
          </div>
        </button>
      </div>
    </section>
  );
}

// ─── Trust Bar ────────────────────────────────────────────────────────────────

function TrustBar() {
  const items = [
    { icon: "🔒", text: "Photos never leave your device" },
    { icon: "⚡", text: "No account, no sign-up" },
    { icon: "🎞", text: "Classic B&W film aesthetic" },
    { icon: "🆓", text: "Completely free" },
  ];

  return (
    <section className="w-full bg-dark-brown/95 py-7 px-5">
      <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.text} className="flex flex-col items-center gap-1.5 text-center">
            <span className="text-xl">{item.icon}</span>
            <p className="font-sans text-xs text-cream/70 leading-tight">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Site Footer ──────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="w-full bg-dark-brown py-6 px-5 border-t border-warm-brown/10">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FilmFrameIcon className="text-warm-brown/40" />
          <span className="font-serif text-sm font-bold text-warm-brown/50">Flashback</span>
        </div>
        <p className="font-sans text-xs text-warm-brown/30 text-center">
          A retro photo booth for the internet. Made with ♥
        </p>
        {/* Film holes */}
        <div className="flex gap-1.5 opacity-20">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-3 h-2 rounded-sm border border-warm-brown/60" />
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Icon components ──────────────────────────────────────────────────────────

function FilmFrameIcon({ className = "text-burnt-orange" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path strokeLinecap="round" d="M7 4v16M17 4v16" />
      <path strokeLinecap="round" d="M2 8h5M17 8h5M2 12h5M17 12h5M2 16h5M17 16h5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
