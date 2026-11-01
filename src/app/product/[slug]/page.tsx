import { join } from "node:path";
import { ArrowRight, GlobeHemisphereWest, Package, Scissors } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import sharp from "sharp";
import { ProductCard } from "@/components/product-card";
import { Gallery } from "@/components/product/gallery";
import { Purchase } from "@/components/product/purchase";
import { Quality } from "@/components/product/quality";
import { Reviews } from "@/components/product/reviews";
import { SaveButton } from "@/components/product/save-button";
import { BRAND, FREE_SHIPPING_CENTS, MAKING_NOTE, SHIPPING_METHODS, deliveryEstimate, money } from "@/lib/format";
import { getOwnerKey } from "@/lib/server/auth";
import { DEPARTMENTS, getProduct, getReviews, getWishlist, listProducts, listRelated } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import { compareSizes } from "@/lib/shop-params";
import { COLORS, METALS, THREADS, type DesignSpec } from "@/lib/studio/spec";

type Props = { params: Promise<{ slug: string }> };

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const CARE = "Wipe with a soft dry cloth. Keep away from heat and direct sun, and condition twice a year. Do not soak or machine wash.";
const HANDLE_COUNT = ["", "Top handle", "Two top handles"];

async function imageSize(src: string) {
  try {
    const { width, height } = await sharp(join(process.cwd(), "public", src)).metadata();
    return { width, height };
  } catch {
    return { width: 1200, height: 1500 };
  }
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-invert-bg">{title}</h2>
      <div className="mt-2 text-sm leading-[1.6] text-muted">{children}</div>
    </section>
  );
}

function Assurance({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden>{icon}</span>
      {label}
    </li>
  );
}

function includedItems(spec: DesignSpec | null) {
  if (!spec) return [];
  const { handles, strap, strapLength } = spec.carry;
  return [HANDLE_COUNT[handles], strap ? `Shoulder strap, ${strapLength / 10} cm` : ""].filter((item): item is string => Boolean(item));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description: product.description, images: [product.images[0]!] },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const [related, wishlist, reviews, department] = await Promise.all([
    listRelated(product.id, product.categorySlug),
    getOwnerKey().then(getWishlist),
    getReviews(product.id),
    listProducts({ department: product.department }),
  ]);
  const gallery = await Promise.all(
    product.images.map(async (src, index) => ({
      src,
      alt: index === 0 ? product.name : `${product.name}, view ${index + 1}`,
      ...(await imageSize(src)),
    })),
  );
  const options = [...product.variants].sort((a, b) => compareSizes(a.size, b.size));
  const dimensions = product.studioPreset
    ? `${product.studioPreset.form.width} × ${product.studioPreset.form.height} × ${product.studioPreset.form.depth} mm`
    : null;
  const included = includedItems(product.studioPreset);
  const saved = wishlist.some((item) => item.id === product.id);
  const shownIds = new Set([product.id, ...related.map((card) => card.id)]);
  const more = [...related, ...department.filter((card) => !shownIds.has(card.id))].slice(0, 6);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((image) => new URL(image, APP_URL).href),
    sku: options[0]?.sku,
    brand: { "@type": "Brand", name: BRAND.name },
    material: product.composition,
    offers: options.map((option) => ({
      "@type": "Offer",
      sku: option.sku,
      url: new URL(`/product/${product.slug}`, APP_URL).href,
      price: (option.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: `https://schema.org/${option.stock > 0 ? "InStock" : "OutOfStock"}`,
    })),
    ...(reviews.total
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.average.toFixed(1), reviewCount: reviews.total } }
      : {}),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: new URL(`/shop/${product.department}`, APP_URL).href },
      { "@type": "ListItem", position: 2, name: product.categoryName, item: new URL(categoryPath(product.department, product.categorySlug), APP_URL).href },
      { "@type": "ListItem", position: 3, name: product.name },
    ],
  };

  return (
    <div className="pb-20 lg:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs).replace(/</g, "\\u003c") }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <section className="overflow-hidden bg-[radial-gradient(90%_90%_at_38%_46%,#3b5a50_0%,#20403a_46%,#0f211d_100%)] pt-[72px] lg:flex lg:min-h-[100dvh] lg:items-center lg:px-6 lg:pb-5 lg:pt-[84px]">
        <div className="mx-auto grid w-full max-w-[1400px] gap-3 lg:h-[min(calc(100dvh-104px),740px)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-5">
          <div className="min-w-0">
            <Gallery images={gallery} />
          </div>

        <div className="glass relative z-10 mx-2 mb-2 flex flex-col rounded-[32px] p-5 lg:m-0 lg:p-7">
          <nav aria-label="Breadcrumb" className="mb-2 flex gap-1.5 text-[12px] text-fg/75">
            <Link href={`/shop/${product.department}`} className="hover:text-fg">{DEPARTMENTS[product.department].name}</Link>
            <span aria-hidden>/</span>
            <Link href={categoryPath(product.department, product.categorySlug)} className="hover:text-fg">{product.categoryName}</Link>
          </nav>
          <h1 className="font-display text-[38px] leading-[1.08] text-invert-bg">{product.name}</h1>
          <p className="mt-2 text-sm leading-[1.5] text-fg/80">{product.description}</p>

          <div className="mt-3 flex flex-1 flex-col">
            <Purchase
              slug={product.slug}
              options={options.map(({ id, color, size, priceCents, stock }) => ({ id, color, size, priceCents, stock }))}
              saveButton={<SaveButton productId={product.id} productName={product.name} saved={saved} />}
              details={
                <dl className="grid gap-1.5 border-t border-fg/10 pt-3 text-[13px]">
                  {[["Material", product.composition.split(".")[0]!], ...(dimensions ? [["Size", dimensions]] : []), ...(included.length ? [["Carry", included.join(", ")]] : []), ...(product.studioPreset ? [["Hardware", METALS[product.studioPreset.hardware.metal].name], ["Stitching", THREADS[product.studioPreset.stitch.thread].name], ["Lining", COLORS[product.studioPreset.liningColor].name]] : [])].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[72px_1fr] gap-2">
                      <dt className="text-fg/70">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              }
            />
          </div>

          {product.studioPreset ? (
            <Link href={`/studio?from=${product.slug}`} className="group mt-3 flex items-center justify-between gap-3 rounded-[22px] bg-invert-bg px-4 py-3 text-invert-fg transition active:scale-[0.99]">
              <span>
                <span className="block font-display text-xl leading-tight">Make it yours</span>
                <span className="block text-[12px] text-invert-fg/80">Change the size, leather and stitching.</span>
              </span>
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-invert-fg text-invert-bg transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight size={16} />
              </span>
            </Link>
          ) : null}

          <ul className="mt-3 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px]">
            <Assurance icon={<Scissors size={14} />} label="Made to order" />
            <Assurance icon={<Package size={14} />} label={deliveryEstimate("standard").replace("Arrives in ", "")} />
            <Assurance icon={<GlobeHemisphereWest size={14} />} label="Ships worldwide" />
          </ul>
        </div>
        </div>
      </section>

      <div className="mx-auto mt-12 grid max-w-[1280px] gap-8 px-4 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <Column title="Details">
          <span className="block">{product.composition}</span>
          {dimensions ? <span className="mt-1 block">{dimensions}</span> : null}
          {included.map((item) => (
            <span key={item} className="mt-1 block">{item}</span>
          ))}
        </Column>
        <Column title="Making and delivery">
          <span className="block">{MAKING_NOTE}</span>
          <span className="mt-2 block">{SHIPPING_METHODS.standard.label}: {deliveryEstimate("standard").toLowerCase()}, {money(SHIPPING_METHODS.standard.cents)}, free over {money(FREE_SHIPPING_CENTS)}.</span>
          <span className="mt-1 block">{SHIPPING_METHODS.express.label}: {deliveryEstimate("express").toLowerCase()}, {money(SHIPPING_METHODS.express.cents)}.</span>
        </Column>
        <Column title="Care">
          {CARE}{" "}
          <Link href="/care" className="text-fg underline underline-offset-4">Care guide</Link>
        </Column>
        <Column title="Returns">
          Every piece is made to order, so we only take back pieces that arrive faulty or differ from your order.{" "}
          <Link href="/shipping-returns" className="text-fg underline underline-offset-4">Full policy</Link>
        </Column>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 lg:px-8">
        <Quality />
        <Reviews productId={product.id} slug={product.slug} />

        {more.length ? (
          <section aria-labelledby="related" className="mt-14">
            <h2 id="related" className="mb-4 font-display text-xl">You may also like</h2>
            <div className="grid grid-cols-2 gap-x-2 gap-y-6 md:grid-cols-4 lg:grid-cols-6">
              {more.map((card) => (
                <ProductCard key={card.id} product={card} sizes="(min-width: 1024px) 200px, (min-width: 768px) 25vw, 50vw" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
