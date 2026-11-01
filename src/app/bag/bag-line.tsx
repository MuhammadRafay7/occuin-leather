"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useTransition } from "react";
import { LineImage } from "@/components/line-image";
import { changeQuantity } from "@/lib/actions/cart";
import { money } from "@/lib/format";
import type { CartLine } from "@/lib/server/cart";

const MAX_QUANTITY = 10;

function stockWarning(line: CartLine) {
  if (line.quantity <= line.available) return null;
  if (line.available < 1) return "Sold out. Remove this item to check out.";
  return `Only ${line.available} left. Lower the quantity to check out.`;
}

export function BagLine({ line }: { line: CartLine }) {
  const [pending, startTransition] = useTransition();
  const update = (quantity: number) => startTransition(() => changeQuantity(line.id, quantity));
  const warning = stockWarning(line);
  const ceiling = Math.min(MAX_QUANTITY, line.available);

  return (
    <li className="grid grid-cols-[88px_1fr] gap-4 border-b border-line py-6 sm:grid-cols-[120px_1fr]" aria-busy={pending}>
      <Link href={line.href} className="relative block aspect-[3/4] overflow-hidden bg-surface">
        <LineImage src={line.image} alt={line.name} sizes="120px" />
      </Link>
      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href={line.href} className="font-display text-xl leading-tight hover:opacity-60">{line.name}</Link>
            <p className="mt-1 text-sm text-muted">{line.detail}</p>
          </div>
          <p className="shrink-0 text-sm">{money(line.unitCents * line.quantity)}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center border border-line">
            <button
              type="button"
              aria-label={`Reduce quantity of ${line.name}`}
              disabled={pending || line.quantity <= 1}
              onClick={() => update(line.quantity - 1)}
              className="grid size-11 place-items-center disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span aria-live="polite" className="w-8 text-center text-sm">{line.quantity}</span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.name}`}
              disabled={pending || line.quantity >= ceiling}
              onClick={() => update(line.quantity + 1)}
              className="grid size-11 place-items-center disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
          <button type="button" disabled={pending} onClick={() => update(0)} className="min-h-11 text-sm underline underline-offset-4 hover:opacity-60 disabled:opacity-40">
            Remove
          </button>
        </div>
        {warning ? <p role="alert" className="text-sm text-danger">{warning}</p> : null}
      </div>
    </li>
  );
}
