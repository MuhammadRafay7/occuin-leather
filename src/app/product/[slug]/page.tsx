import { join } from "node:path";
import { Plus } from "@phosphor-icons/react/dist/ssr";
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
import { RETURN_DAYS } from "@/lib/policy";
import { getOwnerKey } from "@/lib/server/auth";
import { DEPARTMENTS, getProduct, getReviews, getWishlist, listProducts, listRelated } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import { compareSizes } from "@/lib/shop-params";
import type { DesignSpec } from "@/lib/studio/spec";

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

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details name="product-details" className="group border-b border-line">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between text-[12px] hover:opacity-60 [&::-webkit-details-marker]:hidden">
        {title}
        <Plus size={12} aria-hidden className="transition-transform group-open:rotate-45" />
      </summary>
      <div className="pb-3 text-[12px] leading-[1.5] text-muted">{children}</div>
    </details>
  );
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[84px_1fr] gap-2 border-t border-line py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
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

  return (
    <div className="pb-20 pt-[72px] lg:pb-0 lg:pt-[84px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <div className="mx-auto max-w-[1280px] lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 lg:px-8 xl:gap-14">
        <Gallery images={gallery} />

        <div className="px-4 pt-5 lg:sticky lg:top-[84px] lg:max-h-[calc(100dvh-96px)] lg:self-start lg:overflow-y-auto lg:p-0 lg:pr-1 lg:[scrollbar-width:thin]">
          <nav aria-label="Breadcrumb" className="mb-2 flex gap-1.5 text-[11px] text-muted">
            <Link href={`/shop/${product.department}`} className="hover:text-fg">{DEPARTMENTS[product.department].name}</Link>
            <span aria-hidden>/</span>
            <Link href={categoryPath(product.department, product.categorySlug)} className="hover:text-fg">{product.categoryName}</Link>
          </nav>
          <h1 className="font-display text-[26px] leading-[1.15] text-invert-bg">{product.name}</h1>
          <p className="mt-2 text-[13px] leading-[1.5] text-muted">{product.description}</p>

          <div className="mt-4">
            <Purchase
              slug={product.slug}
              options={options.map(({ id, color, size, priceCents, stock }) => ({ id, color, size, priceCents, stock }))}
              saveButton={<SaveButton productId={product.id} productName={product.name} saved={saved} />}
              customise={
                product.studioPreset ? (
                  <Link href={`/studio?from=${product.slug}`} className="text-[12px] underline underline-offset-4 hover:opacity-60">
                    Customise in the studio
                  </Link>
                ) : null
              }
            />
          </div>

          <dl className="mt-4 border-b border-line text-[12px]">
            <Spec label="Material">{product.composition}</Spec>
            {dimensions ? <Spec label="Dimensions">{dimensions}</Spec> : null}
            <Spec label="Delivery">{deliveryEstimate("standard")}</Spec>
          </dl>

          <div className="mt-1">
            <Fold title="Making and delivery">
              <span className="block">{MAKING_NOTE}</span>
              <span className="mt-2 block">{SHIPPING_METHODS.standard.label}: {deliveryEstimate("standard").toLowerCase()}, {money(SHIPPING_METHODS.standard.cents)}, free over {money(FREE_SHIPPING_CENTS)}.</span>
              <span className="block">{SHIPPING_METHODS.express.label}: {deliveryEstimate("express").toLowerCase()}, {money(SHIPPING_METHODS.express.cents)}.</span>
            </Fold>
            {included.length ? (
              <Fold title="What is included">
                {included.map((item) => (
                  <span key={item} className="block">{item}</span>
                ))}
              </Fold>
            ) : null}
            <Fold title="Care">
              {CARE}{" "}
              <Link href="/care" className="text-fg underline underline-offset-4">Care guide</Link>
            </Fold>
            <Fold title="Returns">
              Return unworn pieces within {RETURN_DAYS} days.{" "}
              <Link href="/shipping-returns" className="text-fg underline underline-offset-4">Full policy</Link>
            </Fold>
          </div>
        </div>
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
