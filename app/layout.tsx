import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Mono, DM_Serif_Display, Caveat } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-typewriter",
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "CitoFoto — Retro Photo Booth",
  description: "Strike a pose! A fun retro-style photo booth that takes 4 snaps and creates a classic photo strip.",
  keywords: ["photo booth", "retro", "film", "photo strip", "camera"],
  openGraph: {
    title: "CitoFoto — Retro Photo Booth",
    description: "Strike a pose! A fun retro-style photo booth.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#C4531A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmMono.variable} ${dmSerifDisplay.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
