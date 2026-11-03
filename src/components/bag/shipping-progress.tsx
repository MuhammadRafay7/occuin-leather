"use client";

import { Check } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { money } from "@/lib/format";

type Props = { merchandiseCents: number; thresholdCents: number; waived?: boolean };

export function ShippingProgress({ merchandiseCents, thresholdCents, waived = false }: Props) {
  const reduceMotion = useReducedMotion();
  if (waived) return <p className="text-[13px] text-fg/75">Shipping is added when you pay the balance.</p>;

  const remaining = thresholdCents - merchandiseCents;
  const reached = thresholdCents > 0 ? Math.min(Math.max(merchandiseCents / thresholdCents, 0), 1) : 1;
  const done = remaining <= 0;

  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-1.5 text-[13px] leading-snug">
        {done ? <Check size={14} weight="bold" aria-hidden className="shrink-0 text-invert-bg" /> : null}
        {done ? (
          thresholdCents > 0 ? "Your order ships free with standard shipping." : "Standard shipping is free on every order."
        ) : (
          <span>
            <span className="font-medium tabular-nums">{money(remaining)}</span> away from free standard shipping
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progress to free standard shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(reached * 100)}
        className="h-[3px] overflow-hidden rounded-full bg-fg/12"
      >
        <motion.div initial={false} animate={{ scaleX: reached }} transition={reduceMotion ? INSTANT : SHEET_SPRING} className="h-full origin-left rounded-full bg-invert-bg" />
      </div>
    </div>
  );
}
