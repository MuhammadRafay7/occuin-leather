import Link from "next/link";
import { PRICE_RANGES, SORTS, shopHref, toggled, type ShopState } from "@/lib/shop-params";

type Props = { path: string; state: ShopState; colors: string[]; sizes: string[] };

const LINK = "text-[13px] underline underline-offset-4";

export function FilterLinks({ path, state, colors, sizes }: Props) {
  return (
    <nav aria-label="Filters" className="mt-14 flex flex-wrap gap-4">
      {SORTS.map((option) => (
        <Link key={option.value} href={shopHref(path, state, { sort: option.value })} className={LINK}>{option.label}</Link>
      ))}
      {colors.map((color) => (
        <Link key={color} href={shopHref(path, state, { colors: toggled(state.colors, color) })} className={LINK}>{color}</Link>
      ))}
      {sizes.length > 1
        ? sizes.map((size) => (
            <Link key={size} href={shopHref(path, state, { sizes: toggled(state.sizes, size) })} className={LINK}>{size}</Link>
          ))
        : null}
      {PRICE_RANGES.map((range) => (
        <Link key={range.label} href={shopHref(path, state, { min: range.min, max: range.max })} className={LINK}>{range.label}</Link>
      ))}
    </nav>
  );
}
