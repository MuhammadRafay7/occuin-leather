"use client";

import { useState, type FormEvent } from "react";
import { createPromo, type PromoInput } from "@/lib/actions/admin";
import { updatePromo } from "@/lib/actions/admin-orders";
import { useAction } from "../_components/controls";
import { controlClass, Field, Notice, primaryButtonClass } from "../_components/ui";

const BLANK: PromoInput = { code: "", percentOff: "10", minSubtotal: "0", expiresOn: "", maxUses: "", oncePerCustomer: false };

export const PromoForm = () => <PromoFields initial={BLANK} />;

export const PromoEditForm = ({ initial }: { initial: PromoInput }) => <PromoFields initial={initial} editing />;

function PromoFields({ initial, editing = false }: { initial: PromoInput; editing?: boolean }) {
  const [promo, setPromo] = useState(initial);
  const { pending, result, run } = useAction();
  const errors = result?.fieldErrors ?? {};
  const set = (key: keyof PromoInput, value: string | boolean) => setPromo((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) return run(() => updatePromo(promo));
    run(() => createPromo(promo), (created) => {
      if (created.ok) setPromo(BLANK);
    });
  }

  return (
    <form onSubmit={submit} noValidate className={`grid gap-3 ${editing ? "" : "p-3"}`}>
      <div className={`grid items-start gap-3 sm:grid-cols-2 ${editing ? "" : "xl:grid-cols-5"}`}>
        {editing ? null : (
          <Field label="Code" error={errors.code} hint="What customers type. Saved in capitals.">
            <input value={promo.code} onChange={(event) => set("code", event.target.value)} className={controlClass} />
          </Field>
        )}
        <Field label="Percent off" error={errors.percentOff} hint="A number from 1 to 90.">
          <input inputMode="numeric" value={promo.percentOff} onChange={(event) => set("percentOff", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Minimum spend, USD" error={errors.minSubtotal} hint="0 for no minimum.">
          <input inputMode="decimal" value={promo.minSubtotal} onChange={(event) => set("minSubtotal", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Last day" error={errors.expiresOn} hint="Optional. Stops working after this day, UTC.">
          <input type="date" value={promo.expiresOn} onChange={(event) => set("expiresOn", event.target.value)} className={controlClass} />
        </Field>
        <Field label="Use limit" error={errors.maxUses} hint="Optional. Most times it can be used in total.">
          <input inputMode="numeric" value={promo.maxUses} onChange={(event) => set("maxUses", event.target.value)} className={controlClass} />
        </Field>
        <label className="adm-check self-center">
          <input type="checkbox" checked={promo.oncePerCustomer} onChange={(event) => set("oncePerCustomer", event.target.checked)} />
          Each customer can use it once
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Saving" : editing ? "Save changes" : "Create code"}</button>
        <Notice result={result} />
      </div>
    </form>
  );
}
