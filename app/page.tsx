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
      {mode === "home"    && <HomeScreen onRegular={() => setMode("regular")} onDuet={() => setMode("duet")} />}
      {mode === "regular" && <PhotoBooth onHome={goHome} />}
      {mode === "duet"    && <DuetBooth  onHome={goHome} />}
    </main>
  );
}

// ─── Home / Mode-selector screen ──────────────────────────────────────────────

function HomeScreen({ onRegular, onDuet }: { onRegular: () => void; onDuet: () => void }) {
  return (
    <div className="w-full max-w-lg flex flex-col items-center gap-6 px-4 py-6 page-transition">
      {/* Wordmark */}
      <div className="text-center">
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-burnt-orange tracking-tight">
          Flashback
        </h1>
        <p className="font-sans text-sm text-warm-brown mt-1 tracking-widest uppercase">
          Retro Photo Booth
        </p>
      </div>

      {/* Tagline */}
      <p className="font-sans text-warm-brown/70 text-sm text-center max-w-xs leading-relaxed">
        Capture four poses in classic black &amp; white — solo or with a friend.
      </p>

      {/* Mode cards */}
      <div className="w-full flex flex-col gap-4 mt-2">
        {/* Regular Booth */}
        <button
          onClick={onRegular}
          className="group w-full text-left rounded-2xl border-2 border-warm-brown/20 bg-parchment hover:border-burnt-orange/40 hover:bg-cream transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden"
        >
          <div className="flex items-stretch">
            {/* Left accent strip */}
            <div className="w-2 bg-burnt-orange shrink-0 rounded-l-xl" />
            <div className="flex-1 p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">📸</span>
                <div>
                  <h2 className="font-serif text-lg font-bold text-dark-brown leading-tight">Regular Booth</h2>
                  <p className="font-sans text-[11px] text-warm-brown/60 uppercase tracking-widest">Solo</p>
                </div>
              </div>
              <p className="font-sans text-sm text-warm-brown leading-relaxed">
                Strike four poses in 3 seconds each. Get your retro film strip ready to download.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                {["4 poses", "3 sec timer", "Film strip"].map(tag => (
                  <span key={tag} className="font-sans text-[10px] text-burnt-orange bg-burnt-orange/10 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center pr-4 text-warm-brown/30 group-hover:text-burnt-orange transition-colors">
              <ChevronRight />
            </div>
          </div>
        </button>

        {/* Duet Booth */}
        <button
          onClick={onDuet}
          className="group w-full text-left rounded-2xl border-2 border-warm-brown/20 bg-parchment hover:border-burnt-orange/40 hover:bg-cream transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden"
        >
          <div className="flex items-stretch">
            {/* Left accent strip */}
            <div className="w-2 bg-gold shrink-0 rounded-l-xl" />
            <div className="flex-1 p-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔗</span>
                <div>
                  <h2 className="font-serif text-lg font-bold text-dark-brown leading-tight">Duet Booth</h2>
                  <p className="font-sans text-[11px] text-warm-brown/60 uppercase tracking-widest">Two people · Any distance</p>
                </div>
              </div>
              <p className="font-sans text-sm text-warm-brown leading-relaxed">
                You and a friend shoot separately. A link stitches you together into one shared strip.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                {["Shareable link", "Ghost guide", "Combined strip"].map(tag => (
                  <span key={tag} className="font-sans text-[10px] text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center pr-4 text-warm-brown/30 group-hover:text-gold transition-colors">
              <ChevronRight />
            </div>
          </div>
        </button>
      </div>

      {/* Footer note */}
      <p className="font-sans text-xs text-warm-brown/40 text-center max-w-[260px] mt-2">
        Camera access required · Photos never leave your device
      </p>

      {/* Decorative film holes row */}
      <div className="flex gap-3 opacity-20 mt-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-3 h-2 rounded-sm border border-warm-brown" />
        ))}
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
