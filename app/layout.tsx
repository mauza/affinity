import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Affinity · find your pod at KubeCon NA 2026",
  description: "A live map of where like-minded people gather at KubeCon + CloudNativeCon North America 2026, Salt Lake City.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a0c11" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
