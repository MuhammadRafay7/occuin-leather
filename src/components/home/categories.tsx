// Bento layout and hover lift adapted from Watermelon UI's bento-01 block
// (https://ui.watermelon.sh, MIT licence; see THIRD-PARTY-NOTICES.md).

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { DEFAULT_HOME } from "@/lib/content/defaults";

type Category = (typeof DEFAULT_HOME.categories.items)[number];

const RENDER = /^\/images\/studio\/[a-z]+\.webp$/;

// Column spans on the 4-column desktop grid. The first tile always takes a 2×2 block;
// the rest fill the two rows beside it, then any extra rows, with no empty cells left over.
export function desktopSpans(count: number): number[] {
  if (count <= 0) return [];
  const rest = count - 1;
  const beside = Math.min(rest, 4);
  const besideSpans = beside === 1 ? [2] : beside === 2 ? [2, 2] : beside === 3 ? [2, 1, 1] : Array(beside).fill(1);
  const spans = [2, ...besideSpans];
  let left = rest - beside;
  while (left > 0) {
    const row = Math.min(left, 4);
    spans.push(...(row === 1 ? [4] : row === 2 ? [2, 2] : row === 3 ? [2, 1, 1] : [1, 1, 1, 1]));
    left -= row;
  }
  return spans;
}

const COL: Record<number, string> = { 1: "md:col-span-1", 2: "md:col-span-2", 4: "md:col-span-4" };

export function Categories({ items }: { items: Category[] }) {
  const spans = desktopSpans(items.length);
  // A lone tile beside the big one needs both rows so the block stays square.
  const tallSecond = items.length === 2;
  const oddPhoneTail = (items.length - 1) % 2 === 1;

  return (
    <section aria-label="Categories" className="px-page mt-14 md:mt-24">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:auto-rows-[clamp(13rem,21vw,21rem)] md:gap-4">
        {items.map((category, index) => {
          const lead = index === 0;
          const render = RENDER.test(category.image);
          const phoneWide = lead || (oddPhoneTail && index === items.length - 1);
          return (
            <Link
              key={category.href}
              href={category.href}
              className={[
                "group relative block overflow-hidden rounded-[22px] bg-surface outline-offset-4",
                "shadow-[inset_0_0_0_1px_rgb(20_32_28/0.06)] transition-[transform,box-shadow] duration-500 ease-out",
                "hover:-translate-y-1 hover:shadow-[inset_0_0_0_1px_rgb(20_32_28/0.08),0_22px_40px_-24px_rgb(20_49_42/0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                phoneWide ? "col-span-2 aspect-[16/11]" : "aspect-[4/5]",
                "md:aspect-auto",
                COL[spans[index] ?? 1],
                lead || (tallSecond && index === 1) ? "md:row-span-2" : "",
              ].join(" ")}
            >
              <Image
                src={category.image}
                alt={category.alt}
                fill
                sizes={lead ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"}
                unoptimized={category.image.startsWith("/api/")}
                className={`transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${render ? (lead ? "object-contain p-8 md:p-14" : "object-contain p-5 md:p-7") : "object-cover"}`}
              />
              <div className="glass absolute bottom-3 left-3 flex min-h-10 items-center gap-2 rounded-full px-4 text-[#14231f] md:bottom-4 md:left-4">
                <h2 className={lead ? "font-display text-xl md:text-[1.75rem]" : "font-display text-lg md:text-xl"}>{category.name}</h2>
                <ArrowRight aria-hidden size={14} className="-ml-1 w-0 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-3.5 group-hover:opacity-100 group-focus-visible:ml-0 group-focus-visible:w-3.5 group-focus-visible:opacity-100" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
