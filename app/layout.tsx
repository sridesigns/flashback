import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Zilla_Slab } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600"],
});

const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  variable: "--font-typewriter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
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
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${zillaSlab.variable}`}>
      <body>{children}</body>
    </html>
  );
}
