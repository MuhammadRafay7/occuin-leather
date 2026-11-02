import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Geist } from "next/font/google";
import type { ReactNode } from "react";
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
        {children}
      </body>
    </html>
  );
}
