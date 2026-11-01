import Image from "next/image";
import Link from "next/link";
import { QuickAdd } from "@/components/product/quick-add";
import { money } from "@/lib/format";
import type { ProductCard as Card } from "@/lib/server/catalog";

export function ProductCard({ product, sizes = "(min-width: 1024px) 25vw, 50vw", priority = false }: { product: Card; sizes?: string; priority?: boolean }) {
  return (
    <div className="group relative">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-surface">
          <div className="absolute inset-0 transition-transform duration-700 ease-out [backface-visibility:hidden] group-hover:scale-[1.03]">
            <Image src={product.image} alt={product.name} fill sizes={sizes} preload={priority} className="object-cover" />
            {product.hoverImage ? (
              <Image src={product.hoverImage} alt="" fill sizes={sizes} loading="eager" className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4 text-[13px]">
          <h3>{product.name}</h3>
          <p className="shrink-0">{product.soldOut ? <span className="text-muted">Sold out</span> : money(product.priceCents)}</p>
        </div>
      </Link>
      {product.soldOut ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[3/4]">
          <QuickAdd slug={product.slug} name={product.name} sizes={product.sizes} />
        </div>
      )}
    </div>
  );
}
