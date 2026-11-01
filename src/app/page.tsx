import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Hero } from "@/components/home/hero";
import { LinkButton } from "@/components/ui";
import { jsonLd, organizationData, pageMeta, websiteData } from "@/lib/seo";
import { listProducts } from "@/lib/server/catalog";

const CATEGORIES = [
  { href: "/shop/women", name: "Women", image: "/images/studio/tote.webp", alt: "A leather tote bag for women" },
  { href: "/shop/men", name: "Men", image: "/images/studio/messenger.webp", alt: "A leather messenger bag for men" },
  { href: "/shop/leather/laptop-bags", name: "Laptop bags", image: "/images/studio/laptop.webp", alt: "A rigid leather laptop briefcase" },
  { href: "/shop/leather/wallets", name: "Wallets and cards", image: "/images/brown-wallet.jpg", alt: "A brown leather wallet" },
];

export const metadata: Metadata = pageMeta("/");

export default async function HomePage() {
  const products = await listProducts();
  const featured = products.filter((card) => card.featured && card.image.startsWith("/images/studio/")).slice(0, 4);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationData())} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(websiteData())} />
      <Hero />

      <section aria-label="Categories" className="px-page mt-14 grid grid-cols-2 gap-x-2 gap-y-8 md:mt-24 md:grid-cols-4 md:gap-x-4 md:gap-y-10">
        {CATEGORIES.map((category) => (
          <Link key={category.href} href={category.href} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden bg-surface">
              <Image src={category.image} alt={category.alt} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
            </div>
            <h2 className="mt-3 text-sm">{category.name}</h2>
          </Link>
        ))}
      </section>

      <section aria-labelledby="featured" className="px-page mt-16 md:mt-24">
        <div className="mb-5 flex items-center justify-between gap-6 md:mb-8 md:items-baseline">
          <h2 id="featured" className="font-display text-3xl md:text-4xl">New in</h2>
          <Link href="/shop/leather" className="-mr-2 flex min-h-11 items-center px-2 text-[13px] underline underline-offset-4 hover:opacity-60 md:mr-0 md:block md:min-h-0 md:px-0">View all</Link>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-8 md:grid-cols-4 md:gap-x-4 md:gap-y-10">
          {featured.map((card) => (
            <ProductCard key={card.id} product={card} />
          ))}
        </div>
      </section>

      <section aria-labelledby="studio" className="mt-16 grid bg-surface md:mt-24 md:grid-cols-2">
        <div className="px-page grid content-center justify-items-start gap-5 pb-4 pt-12 md:gap-6 md:!px-16 md:py-16">
          <h2 id="studio" className="font-display text-4xl leading-none md:text-6xl">Design your own</h2>
          <p className="max-w-[42ch] text-muted">Set the shape, leather, stitching and hardware from a blank pattern. See the price as you go, and we make it to order.</p>
          <LinkButton look="outline" href="/studio">Open the studio</LinkButton>
        </div>
        <div className="relative aspect-square">
          <Image src="/images/studio/weekender.webp" alt="A two-tone leather weekender bag" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-contain" />
        </div>
      </section>

      <section aria-labelledby="about-occuin" className="px-page mx-auto mt-16 max-w-[70ch] text-center md:mt-24">
        <h2 id="about-occuin" className="font-display text-3xl text-invert-bg md:text-4xl">Handmade leather bags, made to order</h2>
        <p className="mt-4 leading-relaxed text-muted">
          OCCUIN makes leather <Link href="/shop/women" className="underline underline-offset-4">bags for women</Link> and <Link href="/shop/men" className="underline underline-offset-4">men</Link>, <Link href="/shop/leather/laptop-bags" className="underline underline-offset-4">laptop bags</Link>, <Link href="/shop/leather/wallets" className="underline underline-offset-4">wallets</Link> and <Link href="/shop/leather/belts" className="underline underline-offset-4">belts</Link>. Each piece is cut and made to order in Pakistan and shipped worldwide. You can also <Link href="/studio" className="underline underline-offset-4">design your own leather bag</Link> in live 3D.
        </p>
      </section>
    </>
  );
}
