"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { presentBag } from "@/components/bag-drawer";
import { useFloatingClearance } from "@/components/glass/hooks";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { Button } from "@/components/ui";
import { SWATCH_FALLBACK, swatchHex } from "@/components/shop/swatches";
import { addAndReadBag } from "@/components/product/bag-actions";
import { money } from "@/lib/format";
import { LOW_STOCK_AT } from "@/lib/policy";

export type PurchaseOption = { id: string; color: string; size: string; priceCents: number; stock: number };

const PILL = "flex h-10 min-w-10 items-center justify-center rounded-full border px-2.5 text-xs transition active:scale-[0.96] lg:h-8 lg:min-w-8";
const CHOSEN = "border-invert-bg bg-invert-bg text-invert-fg";
const OPEN = "border-fg/25 hover:border-fg";

type Props = { slug: string; options: PurchaseOption[]; saveButton: ReactNode; customise: ReactNode };

export function Purchase({ slug, options, saveButton, customise }: Props) {
  const reduceMotion = useReducedMotion();
  const colors = [...new Set(options.map((option) => option.color))];
  const [color, setColor] = useState(colors[0]);
  const shades = options.filter((option) => option.color === color);
  const fixed = shades.length === 1 ? shades[0]! : null;

  const [chosenId, setChosenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startAdding] = useTransition();
  const sizeGroup = useRef<HTMLFieldSetElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const { nearFooter, lift } = useFloatingClearance(bar);

  const chosen = fixed ?? shades.find((option) => option.id === chosenId) ?? null;
  const soldOut = shades.every((option) => option.stock === 0);
  const low = chosen && chosen.stock > 0 && chosen.stock <= LOW_STOCK_AT;
  const priceCents = chosen?.priceCents ?? Math.min(...shades.map((option) => option.priceCents));
  const label = soldOut ? "Sold out" : pending ? "Adding" : "Add to bag";

  function pick(id: string | null, nextColor = color) {
    setColor(nextColor);
    setChosenId(id);
    setError(null);
  }

  function add() {
    if (!chosen) {
      setError("Choose a size first.");
      sizeGroup.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      sizeGroup.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
      return;
    }
    startAdding(async () => {
      const result = await addAndReadBag(slug, { variantId: chosen.id });
      if ("bag" in result && result.bag) {
        setError(null);
        presentBag({ bag: result.bag, addedId: result.addedId });
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-[15px]">{money(priceCents)}</p>

      <div className="grid grid-cols-[84px_1fr] items-center gap-2 text-[12px]">
        <span className="text-muted">Colour</span>
        {colors.length > 1 ? (
          <div role="group" aria-label="Colour" className="flex flex-wrap items-center gap-1">
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === color}
                aria-label={option}
                onClick={() => pick(null, option)}
                className={`grid size-7 place-items-center rounded-full border transition active:scale-[0.96] ${option === color ? "border-fg" : "border-transparent hover:border-fg/40"}`}
              >
                <span aria-hidden className="size-5 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: swatchHex(option) }} />
              </button>
            ))}
            <span className="ml-1">{color}</span>
          </div>
        ) : (
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: color ? swatchHex(color) : SWATCH_FALLBACK }} />
            {color}
          </span>
        )}
      </div>

      {fixed ? (
        <div className="grid grid-cols-[84px_1fr] gap-2 text-[12px]">
          <span className="text-muted">Size</span>
          <span>{fixed.size}</span>
        </div>
      ) : (
        <fieldset ref={sizeGroup} className="scroll-mt-24">
          <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
            <legend className="text-muted">Size</legend>
            <Link href="/size-guide" className="underline underline-offset-4 hover:opacity-60">Size guide</Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shades.map((option) => {
              const out = option.stock === 0;
              const active = option.id === chosen?.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={out}
                  aria-pressed={active}
                  aria-label={out ? `${option.size}, sold out` : option.size}
                  onClick={() => pick(option.id)}
                  className={`${PILL} ${active ? CHOSEN : OPEN} disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:line-through`}
                >
                  {option.size}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {low ? <p className="text-[12px]">Only {chosen.stock} left{fixed ? "" : ` in ${chosen.size}`}.</p> : null}

      <div className="hidden lg:block">
        <Button type="button" onClick={add} disabled={pending || soldOut} className="!h-10 w-full text-[13px]">{label}</Button>
      </div>
      {error ? <p aria-live="polite" className="text-[12px] text-danger">{error}</p> : <span aria-live="polite" className="sr-only" />}

      <div className="flex items-center justify-between gap-4">
        {saveButton}
        {customise}
      </div>

      <motion.div
        ref={bar}
        data-buy-bar
        initial={false}
        animate={{ y: nearFooter ? 120 : -lift, opacity: nearFooter ? 0 : 1 }}
        transition={reduceMotion ? INSTANT : SHEET_SPRING}
        inert={nearFooter}
        className="glass-panel fixed inset-x-2 bottom-[max(8px,env(safe-area-inset-bottom))] z-[25] flex h-14 items-center justify-between gap-4 rounded-full pl-5 pr-2 lg:hidden"
      >
        <div className="min-w-0 text-[12px] leading-tight">
          <p className="text-[15px]">{money(priceCents)}</p>
          <p className="truncate text-fg/75">{chosen ? `${color}, ${chosen.size}` : soldOut ? color : "Choose a size"}</p>
        </div>
        <Button type="button" onClick={add} disabled={pending || soldOut} className="!h-10 !px-5 text-[13px]">{label}</Button>
      </motion.div>
    </div>
  );
}
