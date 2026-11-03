"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readViewedCards } from "@/lib/actions/bag";
import { money } from "@/lib/format";
import { readLocal, writeLocal } from "@/lib/local-store";
import type { SuggestedCard } from "@/lib/server/suggestions";

const KEY = "occuin-viewed";
const KEEP = 12;
const PRODUCT_PATH = /^\/product\/([a-z0-9-]{1,120})$/;

function readViewed(): string[] {
  try {
    const parsed: unknown = JSON.parse(readLocal(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, KEEP) : [];
  } catch {
    return [];
  }
}

export function ViewedTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const slug = PRODUCT_PATH.exec(pathname)?.[1];
    if (slug) writeLocal(KEY, JSON.stringify([slug, ...readViewed().filter((item) => item !== slug)].slice(0, KEEP)));
  }, [pathname]);
  return null;
}

export function RecentlyViewed() {
  const [cards, setCards] = useState<SuggestedCard[]>([]);

  useEffect(() => {
    const slugs = readViewed();
    if (!slugs.length) return;
    let live = true;
    readViewedCards(slugs).then(
      (found) => {
        if (live) setCards(found);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  function clear() {
    writeLocal(KEY, "[]");
    setCards([]);
  }

  if (!cards.length) return null;

  return (
    <section aria-labelledby="recently-viewed" className="mt-12 grid gap-4 md:mt-16">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recently-viewed" className="font-display text-[28px] leading-tight text-[#f4efe6] md:text-[34px]">Recently viewed</h2>
        <button type="button" onClick={clear} className="flex min-h-11 items-center text-[13px] text-[#f4efe6]/80 underline underline-offset-4 hover:text-[#f4efe6] focus-visible:outline-[#f4efe6]">
          Clear
        </button>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] md:-mx-8 md:gap-4 md:px-8 [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => (
          <li key={card.slug} className="w-[38vw] max-w-[200px] shrink-0 snap-start md:w-[180px]">
            <Link href={`/product/${card.slug}`} className="group grid gap-2 rounded-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4efe6]">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[20px] border border-white/12 bg-white/8">
                <Image src={card.image} alt="" fill sizes="200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </span>
              <span className="grid gap-0.5 px-1">
                <span className="truncate font-display text-[17px] leading-tight text-[#f4efe6]">{card.name}</span>
                <span className="text-[13px] tabular-nums text-[#f4efe6]/80">{card.soldOut ? "Sold out" : money(card.priceCents)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
