import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Categories } from "@/components/home/categories";
import { HomeFaq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { Leathers } from "@/components/home/leathers";
import { Making } from "@/components/home/making";
import { Paths } from "@/components/home/paths";
import { Shapes, type Shape } from "@/components/home/shapes";
import { Story } from "@/components/home/story";
import { LinkButton } from "@/components/ui";
import { Inline } from "@/components/content-blocks";
import { jsonLd, organizationData, websiteData } from "@/lib/seo";
import { getAllTokens, getContent, getDelivery, getPricing, pageMetadata } from "@/lib/server/content";
import { contactDetails } from "@/lib/server/settings";
import { listProducts } from "@/lib/server/catalog";
import { makingTime, money } from "@/lib/format";
import { newArrivals } from "@/lib/home/new-in";
import { STARTING_POINTS } from "@/lib/studio/presets";

const STUDIO_IMAGE = /^\/images\/studio\/([a-z]+)\.webp$/;

export const generateMetadata = (): Promise<Metadata> => pageMetadata("/");

export default async function HomePage() {
  const [products, home, pricing, seo, tokens, delivery, faqPage] = await Promise.all([listProducts(), getContent("home"), getPricing(), getContent("seo"), getAllTokens(), getDelivery(), getContent("page.faq")]);
  const { hero, categories, featured: spotlight, studio, about, story, shapes, leathers, making, paths, faq } = home;
  const faqItems = faq.questions.flatMap((question) => {
    const item = faqPage.items.find((entry) => entry.question === question);
    return item ? [{ question: item.question, answer: <Inline text={item.answer} tokens={tokens} /> }] : [];
  });
  const storyProduct = products.find((card) => card.slug === story.slug);
  const shapeCards: Shape[] = products.flatMap((card) => {
    const preset = STUDIO_IMAGE.exec(card.image)?.[1];
    const start = STARTING_POINTS.find((point) => point.key === preset);
    if (!start || card.soldOut) return [];
    return [{ slug: card.slug, name: card.name, image: card.image, hint: start.hint, price: money(card.priceCents) }];
  });
  const showShapes = shapes.visible && shapeCards.length > 0;
  const featured = newArrivals(products, showShapes ? shapeCards.map((shape) => shape.slug) : [], spotlight.limit);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationData((await contactDetails()).email, seo.organizationDescription))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(websiteData())} />
      <Hero content={hero} pricing={pricing} makingTime={makingTime(delivery)} />

      {categories.visible && categories.items.length ? <Categories items={categories.items} /> : null}

      {story.visible ? (
        <Story
          content={story}
          pricing={pricing}
          leathers={hero.leathers}
          productName={storyProduct?.name ?? null}
          intro={<Inline text={story.intro} tokens={tokens} />}
          endBody={<Inline text={story.endBody} tokens={tokens} />}
        />
      ) : null}

      {showShapes ? <Shapes content={shapes} body={<Inline text={shapes.body} tokens={tokens} />} shapes={shapeCards} /> : null}

      {leathers.visible ? <Leathers content={leathers} body={<Inline text={leathers.body} tokens={tokens} />} studioSlug={story.slug} startColor={hero.leathers[0] ?? "cognac"} /> : null}

      {spotlight.visible && featured.length ? (
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

      {making.visible ? <Making content={making} tokens={tokens} /> : null}

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

      {faq.visible && faqItems.length ? <HomeFaq heading={faq.heading} linkLabel={faq.linkLabel} items={faqItems} /> : null}

      {about.visible ? (
        <section aria-labelledby="about-occuin" className="px-page mx-auto mt-16 max-w-[70ch] text-center md:mt-24">
          <h2 id="about-occuin" className="font-display text-3xl text-invert-bg md:text-4xl">{about.heading}</h2>
          <p className="mt-4 leading-relaxed text-muted [&_a]:underline [&_a]:underline-offset-4"><Inline text={about.body} tokens={tokens} /></p>
        </section>
      ) : null}

      {paths.visible ? <Paths content={paths} /> : null}
    </>
  );
}
