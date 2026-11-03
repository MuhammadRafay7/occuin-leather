import { seoContext, getDelivery, getPricing } from "@/lib/server/content";
import { join } from "node:path";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import sharp from "sharp";
import { ProductCard } from "@/components/product-card";
import { Gallery } from "@/components/product/gallery";
import { Making } from "@/components/product/making";
import { Purchase } from "@/components/product/purchase";
import { Quality } from "@/components/product/quality";
import { RecentlyViewed } from "@/components/product/recently-viewed";
import { Reviews } from "@/components/product/reviews";
import { ProductSaveButton } from "@/components/product/product-save-button";
import { Scale } from "@/components/product/scale";
import { swatchHex } from "@/components/shop/swatches";
import { arrivalTime, deliveryEstimate, freeShippingNote, makingTime, money, shippingLabel } from "@/lib/format";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";
import { breadcrumbData, jsonLd, productData, productMeta } from "@/lib/seo";
import { storedImageSize } from "@/lib/server/media";
import { DEPARTMENTS, getProduct, getReviews, listProducts, listRelated } from "@/lib/server/catalog";
import { categoryPath } from "@/lib/server/shop";
import { compareSizes } from "@/lib/shop-params";
import { carryNotes, comparisons, FIT_BASIS, presetMatches } from "@/lib/scale";
import { COLORS, FINISHES, METALS, normalizeSpec, THREADS, type DesignSpec } from "@/lib/studio/spec";

type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = async () => (await listProducts()).map((card) => ({ slug: card.slug }));

const CARE = "Wipe with a soft dry cloth. Keep away from heat and direct sun, and condition twice a year. Do not soak or machine wash.";
const HANDLE_COUNT = ["", "Top handle", "Two top handles"];

async function imageSize(src: string) {
  try {
    const stored = await storedImageSize(src);
    if (stored) return stored;
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

function includedItems(spec: DesignSpec | null) {
  if (!spec) return [];
  const { handles, strap, strapLength } = spec.carry;
  return [HANDLE_COUNT[handles], strap ? `Shoulder strap, ${strapLength / 10} cm` : ""].filter((item): item is string => Boolean(item));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return product ? productMeta(product, await seoContext()) : {};
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const delivery = await getDelivery();
  const [related, reviews, department, rates, pricing, contact] = await Promise.all([
    listRelated(product.id, product.categorySlug),
    getReviews(product.id),
    listProducts({ department: product.department }),
    getSettings(),
    getPricing(),
    contactDetails(),
  ]);
  const gallery = await Promise.all(
    product.images.map(async (src, index) => ({
      src,
      alt: index === 0 ? `${product.name}, ${product.categoryName.toLowerCase()} in leather` : `${product.name}, ${product.categoryName.toLowerCase()} in leather, view ${index + 1}`,
      ...(await imageSize(src)),
    })),
  );
  const options = [...product.variants].sort((a, b) => compareSizes(a.size, b.size));
  const dimensions = product.studioPreset
    ? `${product.studioPreset.form.width} × ${product.studioPreset.form.height} × ${product.studioPreset.form.depth} mm`
    : null;
  const included = includedItems(product.studioPreset);
  const preset = product.studioPreset ? normalizeSpec(product.studioPreset) : null;
  const colours = [...new Set(options.map((option) => option.color))];
  const model = preset && presetMatches(preset, colours) ? { spec: preset, slug: product.slug, name: product.name, initialsPrice: money(pricing.foilMonogramCents) } : null;
  const specRows: [string, ReactNode][] = [
    ["Material", product.composition.split(".")[0]!],
    ...(dimensions ? [["Size", <a key="size" href="#size" className="underline decoration-fg/30 underline-offset-4 hover:decoration-fg">{dimensions}</a>] as [string, ReactNode]] : []),
    ...(included.length ? [["Carry", included.join(", ")] as [string, ReactNode]] : []),
    ...(product.studioPreset
      ? ([["Hardware", METALS[product.studioPreset.hardware.metal].name], ["Stitching", THREADS[product.studioPreset.stitch.thread].name], ["Lining", COLORS[product.studioPreset.liningColor].name]] as [string, ReactNode][])
      : []),
  ];
  const payment = paymentModeOf(rates) === "stripe" ? "card" : contact.whatsapp ? "whatsapp" : "email";
  const shipping = [
    `${shippingLabel("standard", delivery)}, ${money(rates.standardShippingCents)}, ${freeShippingNote(rates)}.`,
    `${shippingLabel("express", delivery)}, ${money(rates.expressShippingCents)}.`,
    `With making time, it reaches you ${arrivalTime("standard", delivery)} after you order, or ${arrivalTime("express", delivery)} by express.`,
  ];
  const shownIds = new Set([product.id, ...related.map((card) => card.id)]);
  const more = [...related, ...department.filter((card) => !shownIds.has(card.id))].slice(0, 6);

  const breadcrumbs = breadcrumbData([
    { name: "Home", path: "/" },
    { name: DEPARTMENTS[product.department].name, path: `/shop/${product.department}` },
    { name: product.categoryName, path: categoryPath(product.department, product.categorySlug) },
    { name: product.name, path: `/product/${product.slug}` },
  ]);

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productData(product, options, reviews, rates, delivery))} />

      <section className="overflow-hidden bg-[radial-gradient(90%_90%_at_38%_46%,#3b5a50_0%,#20403a_46%,#0f211d_100%)] pt-[72px] lg:flex lg:min-h-[100dvh] lg:items-center lg:px-6 lg:pb-5 lg:pt-[84px]">
        <div className="mx-auto grid w-full max-w-[1400px] gap-3 lg:h-[min(calc(100dvh-104px),740px)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-5">
          <div className="min-w-0">
            <Gallery images={gallery} model={model} />
          </div>

        <div className="glass relative z-10 mx-2 mb-2 flex flex-col rounded-[32px] p-5 lg:m-0 lg:p-7">
          <nav aria-label="Breadcrumb" className="-mt-3 mb-0 flex items-center gap-1.5 text-[12px] text-fg/75 lg:mt-0 lg:mb-2">
            <Link href={`/shop/${product.department}`} className="flex min-h-11 items-center hover:text-fg lg:block lg:min-h-0">{DEPARTMENTS[product.department].name}</Link>
            <span aria-hidden>/</span>
            <Link href={categoryPath(product.department, product.categorySlug)} className="flex min-h-11 items-center hover:text-fg lg:block lg:min-h-0">{product.categoryName}</Link>
          </nav>
          <h1 className="font-display text-[38px] leading-[1.08] text-invert-bg">{product.name}</h1>
          <p className="mt-2 text-sm leading-[1.5] text-fg/80">{product.description}</p>

          <div className="mt-3 flex flex-1 flex-col">
            <Purchase
              slug={product.slug}
              options={options.map(({ id, color, size, priceCents, stock }) => ({ id, color, size, priceCents, stock }))}
              saveButton={<ProductSaveButton productId={product.id} productName={product.name} />}
              details={
                <dl className="grid gap-1.5 border-t border-fg/10 pt-3 text-[13px]">
                  {specRows.map(([label, value]) => (
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
                <span className="block font-display text-xl leading-tight">Change this piece</span>
                <span className="block text-[12px] text-invert-fg/80">Size, leather, stitching and hardware.</span>
              </span>
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-invert-fg text-invert-bg transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight size={16} />
              </span>
            </Link>
          ) : null}

          <p className="mt-3 text-[12px] leading-snug">Made after you order. {deliveryEstimate("standard", delivery)}.</p>
        </div>
        </div>
      </section>

      <div className="px-page mx-auto max-w-[1280px]">
        {preset ? (
          <Scale
            bag={{
              name: product.name,
              width: preset.form.width,
              height: preset.form.height,
              depth: preset.form.depth,
              taper: preset.form.taper,
              cornerBottom: preset.form.cornerBottom,
              cornerTop: preset.form.cornerTop,
              handles: preset.carry.handles,
              handleDrop: preset.carry.handleDrop,
              handleWidth: preset.carry.handleWidth,
              flap: preset.closure.type === "flap" ? preset.closure.flapLength : 0,
              colour: swatchHex(colours[0] ?? ""),
            }}
            items={comparisons(preset.form)}
            carry={carryNotes(preset)}
            leather={model ? { finish: FINISHES[preset.panels.primary.finish].name, note: FINISHES[preset.panels.primary.finish].note, colour: COLORS[preset.panels.primary.color].name, hex: COLORS[preset.panels.primary.color].hex } : null}
            basis={FIT_BASIS}
          />
        ) : null}
        <Making payment={payment} makingTime={makingTime(delivery)} shipping={shipping} />
      </div>

      <div className="px-page mx-auto mt-10 grid max-w-[1280px] gap-7 md:mt-12 md:grid-cols-3 lg:gap-8">
        <Column title="Details">
          <span className="block">{product.composition}</span>
          {dimensions ? <span className="mt-1 block">{dimensions}</span> : null}
          {included.map((item) => (
            <span key={item} className="mt-1 block">{item}</span>
          ))}
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

      <div className="px-page mx-auto max-w-[1280px]">
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
        <RecentlyViewed current={{ slug: product.slug, name: product.name, image: product.images[0]! }} />
      </div>
    </div>
  );
}
