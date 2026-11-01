import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Geist } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { GlassEffects } from "@/components/glass-effects";
import { Header } from "@/components/header";
import { BRAND } from "@/lib/format";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `${BRAND.name} | Handmade Leather Bags and Custom Leather Goods`, template: `%s | ${BRAND.name}` },
  description: "Handmade leather bags, laptop bags, wallets and belts for women and men. Design your own in live 3D. Made in Pakistan and shipped worldwide.",
  openGraph: { siteName: BRAND.name, type: "website", images: [{ url: "/images/og.jpg", width: 1200, height: 630, alt: "OCCUIN handmade leather tote" }] },
  twitter: { card: "summary_large_image", images: ["/images/og.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${bodoni.variable}`}>
      <body className="min-h-dvh bg-bg text-fg">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-invert-bg focus:p-3 focus:text-invert-fg">
          Skip to content
        </a>
        <GlassEffects />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
