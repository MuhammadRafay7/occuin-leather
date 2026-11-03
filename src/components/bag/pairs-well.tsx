"use client";

import { Plus } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { addAndReadBag, type BagView } from "@/components/product/bag-actions";
import { openQuickView } from "@/components/shop/quick-view";
import { money } from "@/lib/format";
import type { SuggestedCard } from "@/lib/server/suggestions";

type Added = { bag: BagView; addedId: string | null };
type Props = { suggestions: SuggestedCard[]; onAdded: (added: Added) => void; onNavigate?: () => void; size?: "drawer" | "page" };

function Suggestion({ card, onAdded, onNavigate, size }: { card: SuggestedCard; onAdded: Props["onAdded"]; onNavigate?: () => void; size: "drawer" | "page" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const single = card.sizes.length === 1;

  function add() {
    if (!single) {
      openQuickView(card.slug);
      return;
    }
    setError(null);
    start(async () => {
      const result = await addAndReadBag(card.slug, { size: card.sizes[0] });
      if ("bag" in result && result.bag) onAdded({ bag: result.bag, addedId: result.addedId });
      else setError(result.error ?? "Could not add this piece.");
    });
  }

  return (
    <li className="grid min-w-0 content-start gap-2">
      <Link href={`/product/${card.slug}`} onClick={onNavigate} className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-surface">
        <Image src={card.image} alt={card.name} fill sizes={size === "drawer" ? "120px" : "(min-width: 1024px) 200px, 33vw"} className="object-cover transition-transform duration-500 hover:scale-[1.03]" />
      </Link>
      <div className="grid min-w-0 gap-0.5">
        <Link href={`/product/${card.slug}`} onClick={onNavigate} className={`truncate leading-tight hover:opacity-60 ${size === "drawer" ? "text-[13px]" : "font-display text-lg"}`}>{card.name}</Link>
        <p className="text-[13px] tabular-nums text-fg/75">{money(card.priceCents)}</p>
      </div>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        aria-label={single ? `Add ${card.name} to bag` : `Choose a size for ${card.name}`}
        className="flex h-11 items-center justify-center gap-1.5 rounded-full border border-fg/20 text-[13px] transition hover:border-fg active:scale-[0.96] disabled:opacity-50 lg:h-9"
      >
        {single ? <Plus size={13} aria-hidden /> : null}
        {pending ? "Adding" : single ? "Add" : "Choose size"}
      </button>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </li>
  );
}

export function PairsWell({ suggestions, onAdded, onNavigate, size = "drawer" }: Props) {
  if (!suggestions.length) return null;
  return (
    <section aria-labelledby={`pairs-${size}`} className="grid gap-3">
      <h3 id={`pairs-${size}`} className={size === "drawer" ? "text-[13px] text-fg/75" : "font-display text-2xl"}>Pairs well with</h3>
      <ul className={`grid grid-cols-3 ${size === "drawer" ? "gap-3" : "gap-4 md:gap-6"}`}>
        {suggestions.map((card) => (
          <Suggestion key={card.slug} card={card} onAdded={onAdded} onNavigate={onNavigate} size={size} />
        ))}
      </ul>
    </section>
  );
}
