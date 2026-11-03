import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer } from "@/components/footer";
import { GlassEffects } from "@/components/glass-effects";
import { Header } from "@/components/header";
import { ViewedTracker } from "@/components/recently-viewed";
import { QuickViewHost } from "@/components/shop/quick-view";
import { WhatsAppAsk } from "@/components/whatsapp-ask";
import { BRAND } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { getContent, seoImage } from "@/lib/server/content";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const [seo, image] = await Promise.all([getContent("seo"), seoImage()]);
  return {
    title: { default: seo.siteTitle, template: `%s | ${BRAND.name}` },
    description: seo.siteDescription,
    openGraph: { siteName: BRAND.name, type: "website", images: [image] },
    twitter: { card: "summary_large_image", images: [absoluteUrl(image.url)] },
  };
}

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-invert-bg focus:p-3 focus:text-invert-fg">
        Skip to content
      </a>
      <GlassEffects />
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <WhatsAppAsk />
      <QuickViewHost />
      <ViewedTracker />
    </>
  );
}
