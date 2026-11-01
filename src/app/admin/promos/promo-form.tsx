"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui";
import { createPromo, type PromoInput } from "@/lib/actions/admin";
import { useAction } from "../_components/controls";
import { controlClass, Notice, primaryButtonClass } from "../_components/ui";

const BLANK: PromoInput = { code: "", percentOff: "10", minSubtotal: "0", expiresOn: "", maxUses: "", oncePerCustomer: false };

export function PromoForm() {
  const [promo, setPromo] = useState(BLANK);
  const { pending, result, run } = useAction();
  const errors = result?.fieldErrors ?? {};
  const set = (key: keyof PromoInput, value: string | boolean) => setPromo((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => createPromo(promo), (created) => {
      if (created.ok) setPromo(BLANK);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 border border-line p-4">
      <h2 className="text-sm font-medium">New code</h2>
      <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Code" error={errors.code} hint="Saved in capitals.">
          <input value={promo.code} onChange={(event) => set("code", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Percent off" error={errors.percentOff} hint="1 to 90.">
          <input inputMode="numeric" value={promo.percentOff} onChange={(event) => set("percentOff", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Minimum subtotal, USD" error={errors.minSubtotal} hint="0 for no minimum.">
          <input inputMode="decimal" value={promo.minSubtotal} onChange={(event) => set("minSubtotal", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Expires" error={errors.expiresOn} hint="Optional. Ends at the close of this day, UTC.">
          <input type="date" value={promo.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Use limit" error={errors.maxUses} hint="Optional. Total uses across all customers.">
          <input inputMode="numeric" value={promo.maxUses} onChange={(event) => set("maxUses", event.target.value)} className={controlClass} />
        </Field>
        <label className="flex items-center gap-2 self-center text-sm">
          <input type="checkbox" checked={promo.oncePerCustomer} onChange={(event) => set("oncePerCustomer", event.target.checked)} />
          Once per customer
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Creating" : "Create code"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
