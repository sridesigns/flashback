import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F5ECD7",
        parchment: "#EAD9B8",
        "warm-brown": "#8B5E3C",
        "burnt-orange": "#C4531A",
        "deep-orange": "#A8420F",
        gold: "#C9A84C",
        "dark-brown": "#3D2314",
        "film-black": "#1A1008",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        typewriter: ["var(--font-typewriter)", "American Typewriter", "Courier New", "monospace"],
        handwritten: ["var(--font-caveat)", "cursive"],
      },
      keyframes: {
        flash: {
          "0%": { opacity: "0" },
          "30%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "count-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.15)", opacity: "0.8" },
        },
        "strip-reveal": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "grain": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-1%, -1%)" },
          "20%": { transform: "translate(1%, 1%)" },
          "30%": { transform: "translate(-2%, 1%)" },
          "40%": { transform: "translate(2%, -1%)" },
          "50%": { transform: "translate(-1%, 2%)" },
          "60%": { transform: "translate(1%, -2%)" },
          "70%": { transform: "translate(-2%, -1%)" },
          "80%": { transform: "translate(2%, 2%)" },
          "90%": { transform: "translate(-1%, -1%)" },
        },
      },
      animation: {
        flash: "flash 0.4s ease-out forwards",
        "count-pulse": "count-pulse 0.8s ease-in-out infinite",
        "strip-reveal": "strip-reveal 0.5s ease-out forwards",
        "grain": "grain 0.5s steps(1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
