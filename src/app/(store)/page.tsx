import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Hero } from "@/components/home/hero";
import { LinkButton } from "@/components/ui";
import { Inline } from "@/components/content-blocks";
import { jsonLd, organizationData, websiteData } from "@/lib/seo";
import { getAllTokens, getContent, getPricing, pageMetadata } from "@/lib/server/content";
import { contactDetails } from "@/lib/server/settings";
import { listProducts } from "@/lib/server/catalog";

export const generateMetadata = (): Promise<Metadata> => pageMetadata("/");

export default async function HomePage() {
  const [products, home, pricing, seo, tokens] = await Promise.all([listProducts(), getContent("home"), getPricing(), getContent("seo"), getAllTokens()]);
  const { hero, categories, featured: spotlight, studio, about } = home;
  const featured = products.filter((card) => card.featured && card.image.startsWith("/images/studio/")).slice(0, spotlight.limit);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationData((await contactDetails()).email, seo.organizationDescription))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(websiteData())} />
      <Hero content={hero} pricing={pricing} />

      {categories.visible && categories.items.length ? (
        <section aria-label="Categories" className="px-page mt-14 grid grid-cols-2 gap-x-2 gap-y-8 md:mt-24 md:grid-cols-4 md:gap-x-4 md:gap-y-10">
          {categories.items.map((category) => (
            <Link key={category.href} href={category.href} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                <Image src={category.image} alt={category.alt} fill sizes="(min-width: 768px) 25vw, 50vw" unoptimized={category.image.startsWith("/api/")} className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
              </div>
              <h2 className="mt-3 text-sm">{category.name}</h2>
            </Link>
          ))}
        </section>
      ) : null}

      {spotlight.visible ? (
        <section aria-labelledby="featured" className="px-page mt-16 md:mt-24">
          <div className="mb-5 flex items-center justify-between gap-6 md:mb-8 md:items-baseline">
            <h2 id="featured" className="font-display text-3xl md:text-4xl">{spotlight.heading}</h2>
            <Link href={spotlight.linkHref} className="-mr-2 flex min-h-11 items-center px-2 text-[13px] underline underline-offset-4 hover:opacity-60 md:mr-0 md:block md:min-h-0 md:px-0">{spotlight.linkLabel}</Link>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-4 md:gap-x-4 md:gap-y-10">
            {featured.map((card) => (
              <ProductCard key={card.id} product={card} />
            ))}
          </div>
        </section>
      ) : null}

      {studio.visible ? (
        <section aria-labelledby="studio" className="mt-16 grid bg-surface md:mt-24 md:grid-cols-2">
          <div className="px-page grid content-center justify-items-start gap-5 pb-4 pt-12 md:gap-6 md:!px-16 md:py-16">
            <h2 id="studio" className="font-display text-4xl leading-none md:text-6xl">{studio.heading}</h2>
            <p className="max-w-[42ch] text-muted [&_a]:underline [&_a]:underline-offset-4"><Inline text={studio.body} tokens={tokens} /></p>
            <LinkButton look="outline" href={studio.ctaHref}>{studio.ctaLabel}</LinkButton>
          </div>
          <div className="relative aspect-square">
            <Image src={studio.image} alt={studio.imageAlt} fill sizes="(min-width: 768px) 50vw, 100vw" unoptimized={studio.image.startsWith("/api/")} className="object-contain" />
          </div>
        </section>
      ) : null}

      {about.visible ? (
        <section aria-labelledby="about-occuin" className="px-page mx-auto mt-16 max-w-[70ch] text-center md:mt-24">
          <h2 id="about-occuin" className="font-display text-3xl text-invert-bg md:text-4xl">{about.heading}</h2>
          <p className="mt-4 leading-relaxed text-muted [&_a]:underline [&_a]:underline-offset-4"><Inline text={about.body} tokens={tokens} /></p>
        </section>
      ) : null}
    </>
  );
}
