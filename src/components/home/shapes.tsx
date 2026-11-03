"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import type { DEFAULT_HOME } from "@/lib/content/defaults";

export type Shape = { slug: string; name: string; image: string; hint: string; price: string };
type Props = { content: typeof DEFAULT_HOME.shapes; body: ReactNode; shapes: Shape[] };

export function Shapes({ content, body, shapes }: Props) {
  const rail = useRef<HTMLUListElement>(null);
  const scroll = (direction: number) => {
    const node = rail.current;
    if (!node) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <section aria-labelledby="shapes-heading" className="mt-16 md:mt-28">
      <div className="px-page flex items-end justify-between gap-6">
        <div>
          <h2 id="shapes-heading" className="font-display text-4xl leading-none md:text-6xl">{content.heading}</h2>
          <p className="mt-3 max-w-[44ch] text-muted [&_a]:underline [&_a]:underline-offset-4">{body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={content.linkHref} className="flex min-h-11 items-center px-2 text-[13px] underline underline-offset-4 hover:opacity-60">{content.linkLabel}</Link>
          <button type="button" aria-label="Previous shapes" onClick={() => scroll(-1)} className="hidden h-11 w-11 place-items-center rounded-full border border-line transition-colors hover:border-fg md:grid">
            <ArrowLeft size={18} />
          </button>
          <button type="button" aria-label="More shapes" onClick={() => scroll(1)} className="hidden h-11 w-11 place-items-center rounded-full border border-line transition-colors hover:border-fg md:grid">
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <ul ref={rail} className="shape-rail px-page mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-4 md:mt-8 md:gap-4">
        {shapes.map((shape) => (
          <li key={shape.slug} className="shape-card w-[72vw] max-w-[340px] shrink-0 snap-start sm:w-[42vw] md:w-[30vw] lg:w-[23vw] short:w-[34vw]">
            <Link href={`/product/${shape.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-surface">
                <Image src={shape.image} alt={shape.name} fill sizes="(min-width: 1024px) 23vw, (min-width: 768px) 30vw, 72vw" className="object-contain p-4 transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl leading-tight">{shape.name}</h3>
                <p className="shrink-0 text-[13px] tabular-nums">{shape.price}</p>
              </div>
              <p className="text-[13px] text-muted">{shape.hint}</p>
            </Link>
            <Link href={`/studio?from=${shape.slug}`} className="mt-1 inline-flex min-h-11 items-center text-[13px] underline underline-offset-4 hover:opacity-60">
              Customise in 3D
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
