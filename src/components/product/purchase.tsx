"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { presentBag } from "@/components/bag-drawer";
import { useFloatingClearance } from "@/components/glass/hooks";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { Button } from "@/components/ui";
import { SWATCH_FALLBACK, swatchHex } from "@/components/shop/swatches";
import { addAndReadBag } from "@/components/product/bag-actions";
import { money } from "@/lib/format";

export type PurchaseOption = { id: string; color: string; size: string; priceCents: number; stock: number };

const PILL = "flex h-11 min-w-11 items-center justify-center rounded-full border bg-bg px-3 text-sm transition active:scale-[0.96] lg:h-10 lg:min-w-10";
const CHOSEN = "border-invert-bg bg-invert-bg text-invert-fg";
const OPEN = "border-fg/25 hover:border-fg";

const subscribe = () => () => undefined;

type Props = { slug: string; options: PurchaseOption[]; saveButton: ReactNode; details: ReactNode };

export function Purchase({ slug, options, saveButton, details }: Props) {
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
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const chosen = fixed ?? shades.find((option) => option.id === chosenId) ?? null;
  const soldOut = shades.every((option) => option.stock === 0);
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
    <div className="flex flex-1 flex-col gap-3">
      <p className="text-xl tabular-nums">{money(priceCents)}</p>

      <div className="grid gap-3 rounded-[22px] bg-white/45 p-4">
        <div>
          <p className="text-[12px] text-fg/75">Colour</p>
          {colors.length > 1 ? (
            <div role="group" aria-label="Colour" className="mt-1 flex flex-wrap items-center gap-1.5">
              {colors.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === color}
                  aria-label={option}
                  onClick={() => pick(null, option)}
                  className={`grid size-11 place-items-center rounded-full border transition active:scale-[0.96] lg:size-9 ${option === color ? "border-fg" : "border-transparent hover:border-fg/40"}`}
                >
                  <span aria-hidden className="size-7 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: swatchHex(option) }} />
                </button>
              ))}
              <span className="ml-1 text-sm">{color}</span>
            </div>
          ) : (
            <p className="mt-1 flex items-center gap-2.5 text-sm">
              <span aria-hidden className="size-5 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: color ? swatchHex(color) : SWATCH_FALLBACK }} />
              {color}
            </p>
          )}
        </div>

        {fixed ? null : (
          <fieldset ref={sizeGroup} className="scroll-mt-24">
            <div className="mb-1.5 flex items-center justify-between text-[12px] lg:items-baseline">
              <legend className="text-fg/75">Size</legend>
              <Link href="/size-guide" className="-my-1 flex min-h-11 items-center underline underline-offset-4 hover:opacity-60 lg:my-0 lg:block lg:min-h-0">Size guide</Link>
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
        {details}
      </div>

      <div className="mt-auto flex items-center gap-2">
        <div className="hidden flex-1 lg:block"><Button type="button" onClick={add} disabled={pending || soldOut} className="w-full">{label}</Button></div>
        <div className="text-[13px] text-fg/75 lg:hidden">Save for later</div>
        <div className="ml-auto lg:ml-0">{saveButton}</div>
      </div>
      {error ? <p aria-live="polite" className="text-[13px] text-danger">{error}</p> : <span aria-live="polite" className="sr-only" />}

      {mounted
        ? createPortal(
            <motion.div
              ref={bar}
              data-buy-bar
              initial={false}
              animate={{ y: nearFooter ? 120 : -lift, opacity: nearFooter ? 0 : 1 }}
              transition={reduceMotion ? INSTANT : SHEET_SPRING}
              inert={nearFooter}
              className="glass-panel fixed bottom-[max(8px,env(safe-area-inset-bottom))] left-[max(8px,env(safe-area-inset-left))] right-[max(8px,env(safe-area-inset-right))] z-[25] flex h-[60px] items-center justify-between gap-4 rounded-full pl-5 pr-2 lg:hidden"
            >
              <div className="min-w-0 text-[12px] leading-tight">
                <p className="text-[15px]">{money(priceCents)}</p>
                <p className={`truncate ${error ? "text-danger" : "text-fg/75"}`}>{error ?? (chosen ? `${color}, ${chosen.size}` : soldOut ? color : "Choose a size")}</p>
              </div>
              <Button type="button" onClick={add} disabled={pending || soldOut} className="!h-11 shrink-0 !px-6 text-[13px]">{label}</Button>
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  );
}
