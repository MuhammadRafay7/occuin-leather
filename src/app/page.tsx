import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { Hero } from "@/components/home/hero";
import { LinkButton } from "@/components/ui";
import { listProducts } from "@/lib/server/catalog";

const CATEGORIES = [
  { href: "/shop/women", name: "Women", image: "/images/studio/tote.webp" },
  { href: "/shop/men", name: "Men", image: "/images/studio/messenger.webp" },
  { href: "/shop/leather/laptop-bags", name: "Laptop bags", image: "/images/studio/laptop.webp" },
  { href: "/shop/leather/wallets", name: "Wallets and cards", image: "/images/brown-wallet.jpg" },
];

export default async function HomePage() {
  const products = await listProducts();
  const featured = products.filter((card) => card.featured && card.image.startsWith("/images/studio/")).slice(0, 4);

  return (
    <>
      <Hero />

      <section aria-label="Categories" className="mt-24 grid grid-cols-2 gap-x-4 gap-y-10 px-4 md:grid-cols-4 md:px-8">
        {CATEGORIES.map((category) => (
          <Link key={category.href} href={category.href} className="group block">
            <div className="relative aspect-[4/5] overflow-hidden bg-surface">
              <Image src={category.image} alt="" fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
            </div>
            <h2 className="mt-3 text-sm">{category.name}</h2>
          </Link>
        ))}
      </section>

      <section aria-labelledby="featured" className="mt-24 px-4 md:px-8">
        <div className="mb-8 flex items-baseline justify-between gap-6">
          <h2 id="featured" className="font-display text-3xl md:text-4xl">New in</h2>
          <Link href="/shop/leather" className="text-[13px] underline underline-offset-4 hover:opacity-60">View all</Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {featured.map((card) => (
            <ProductCard key={card.id} product={card} />
          ))}
        </div>
      </section>

      <section aria-labelledby="studio" className="mt-24 grid bg-surface md:grid-cols-2">
        <div className="grid content-center justify-items-start gap-6 px-4 py-16 md:px-16">
          <h2 id="studio" className="font-display text-4xl leading-none md:text-6xl">Design your own</h2>
          <p className="max-w-[42ch] text-muted">Set the shape, leather, stitching and hardware from a blank pattern. See the price as you go, and we make it to order.</p>
          <LinkButton look="outline" href="/studio">Open the studio</LinkButton>
        </div>
        <div className="relative aspect-square">
          <Image src="/images/studio/weekender.webp" alt="A two-tone leather weekender bag" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-contain" />
        </div>
      </section>
    </>
  );
}
