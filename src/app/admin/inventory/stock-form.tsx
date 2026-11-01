"use client";

import { useState, type FormEvent } from "react";
import { updateStock } from "@/lib/actions/admin";
import { useAction } from "../_components/controls";
import { buttonClass, controlClass, Notice } from "../_components/ui";

export function StockForm({ variantId, sku, stock }: { variantId: string; sku: string; stock: number }) {
  const [seenStock, setSeenStock] = useState(stock);
  const [value, setValue] = useState(String(stock));
  const { pending, result, run } = useAction();

  if (stock !== seenStock) {
    setSeenStock(stock);
    setValue(String(stock));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => updateStock(variantId, value, stock));
  }

  return (
    <form onSubmit={submit} className="grid gap-1">
      <div className="flex gap-1">
        <input
          aria-label={`Stock for ${sku}`}
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`${controlClass} w-20 tabular-nums`}
        />
        <button type="submit" disabled={pending || value === String(stock)} className={buttonClass}>
          {pending ? "Saving" : "Save"}
        </button>
      </div>
      <Notice result={result} compact />
    </form>
  );
}
