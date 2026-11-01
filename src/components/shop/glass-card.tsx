import { Sliders } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/product/quick-add";
import { money } from "@/lib/format";
import type { ProductCard } from "@/lib/server/catalog";
import { cellClass, imageSizes, stageClass, type Placement } from "./rhythm";
import styles from "./shop.module.css";

type Props = { product: ProductCard; placement: Placement; customisable: boolean; priority?: boolean };

const isCutout = (src: string) => src.startsWith("/images/studio/");

const NAME_SIZE = {
  phone: { base: "text-[18px]", wide: "text-[24px]", feature: "text-[24px]", full: "text-[24px]" },
  tablet: { base: "md:text-[21px]", wide: "md:text-[26px]", feature: "md:text-[32px]", full: "md:text-[40px]" },
  desktop: { base: "lg:text-[22px]", wide: "lg:text-[28px]", feature: "lg:text-[36px]", full: "lg:text-[48px]" },
};

const LINK_FOCUS = "after:absolute after:inset-0 after:rounded-[27px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-[#f4efe6]";

function Picture({ src, alt, sizes, priority, cutout, alternate }: { src: string; alt: string; sizes: string; priority?: boolean; cutout: boolean; alternate?: boolean }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      loading={alternate ? "lazy" : undefined}
      className={`${cutout ? "object-contain" : "object-cover"} ${alternate ? styles.alternate : ""}`}
    />
  );
}

export function GlassCard({ product, placement, customisable, priority = false }: Props) {
  const cutout = isCutout(product.image);
  const sizes = imageSizes(placement);
  const nameSize = `${NAME_SIZE.phone[placement.phone]} ${NAME_SIZE.tablet[placement.tablet]} ${NAME_SIZE.desktop[placement.desktop]}`;
  const emphasised = placement.desktop !== "base";
  const iconOnly = placement.phone === "base" ? "hidden md:inline" : "";
  const picture = (
    <>
      <Picture src={product.image} alt={product.name} sizes={sizes} priority={priority} cutout={cutout} />
      {product.hoverImage ? <Picture src={product.hoverImage} alt="" sizes={sizes} cutout={cutout} alternate /> : null}
    </>
  );

  return (
    <article className={`${styles.pane} group relative flex min-w-0 flex-col rounded-[28px] ${cellClass(placement)}`}>
      <div aria-hidden className={styles.sweepClip}>
        <span className={styles.sweep} />
      </div>

      <div className={`relative w-full min-w-0 ${stageClass(placement)}`}>
        {cutout ? (
          <>
            <span aria-hidden className={styles.pool} />
            <span aria-hidden className={styles.ground} />
            <div className={styles.lift}>{picture}</div>
          </>
        ) : (
          <div className={styles.photo}>
            <div className={styles.zoom}>{picture}</div>
          </div>
        )}
        {customisable ? (
          <Link
            href={`/studio?from=${product.slug}`}
            aria-label={`Customise ${product.name}`}
            className={`absolute left-2.5 top-2.5 z-10 flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full border border-white/25 bg-[#0f211d]/55 text-[11px] ${placement.phone === "base" ? "md:px-3" : "px-3"} text-[#f4efe6] transition-colors before:absolute before:-inset-2 hover:bg-[#0f211d]/85 focus-visible:outline-[#f4efe6] ${emphasised ? "" : styles.reveal}`}
          >
            <Sliders size={13} aria-hidden />
            <span className={iconOnly}>Customise</span>
          </Link>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3 pt-2 md:p-4 md:pt-2.5 lg:p-5 lg:pt-3">
        <h3 className={`font-display leading-[1.12] text-[#f4efe6] ${nameSize}`}>
          <Link href={`/product/${product.slug}`} className={LINK_FOCUS}>{product.name}</Link>
        </h3>
        <p className="mt-auto flex min-h-11 min-w-0 flex-col justify-center pr-12 text-[#f4efe6] xl:flex-row xl:items-baseline xl:justify-start xl:gap-2 xl:self-stretch xl:pt-2 [@media(hover:hover)]:min-h-9">
          <span className="text-[14px] leading-tight tabular-nums">{product.soldOut ? "Sold out" : money(product.priceCents)}</span>
          <span className={`truncate text-[12px] leading-tight text-[#f4efe6]/88 ${placement.phone === "base" ? "hidden md:block" : ""}`}>{product.categoryName}</span>
        </p>
      </div>

      {product.soldOut ? null : <QuickAdd surface="stage" slug={product.slug} name={product.name} sizes={product.sizes} />}
    </article>
  );
}
