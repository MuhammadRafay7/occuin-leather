"use client";

import { useState, type FormEvent } from "react";
import { adjustStock } from "@/lib/actions/admin-catalog";
import { useAction } from "../../_components/controls";
import { controlClass, Field, Notice, primaryButtonClass } from "../../_components/ui";
import { STOCK_REASONS } from "../reasons";

export function AdjustForm({ variantId, stock }: { variantId: string; stock: number }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<string>(STOCK_REASONS[0]);
  const [note, setNote] = useState("");
  const { pending, result, run } = useAction();
  const errors = result?.fieldErrors ?? {};

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => adjustStock({ variantId, delta, reason, note, expectedStock: stock }), (outcome) => {
      if (!outcome.ok) return;
      setDelta("");
      setNote("");
    });
  }

  return (
    <form onSubmit={submit} className="adm-card" noValidate>
      <div className="adm-panel-head"><h2>Add or remove stock</h2></div>
      <div className="adm-panel-body grid gap-3">
        <Field label="How many" error={errors.delta} hint="Type 5 to add five, or -2 to remove two.">
          <input value={delta} onChange={(event) => setDelta(event.target.value)} placeholder="5 or -2" className={controlClass} />
        </Field>
        <Field label="Why" error={errors.reason}>
          <select value={reason} onChange={(event) => setReason(event.target.value)} className={controlClass}>
            {STOCK_REASONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Note, optional" error={errors.note}>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} className={controlClass} />
        </Field>
        <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>{pending ? "Saving" : "Save"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
