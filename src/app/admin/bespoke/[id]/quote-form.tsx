"use client";

import { useState, type FormEvent } from "react";
import { resendBespokeQuote, updateBespokeRequest } from "@/lib/actions/admin";
import { balanceCents, BESPOKE_STATUS_LABELS, BESPOKE_STATUSES, depositCents, type BespokeStatus } from "@/lib/bespoke/status";
import { money } from "@/lib/format";
import { useAction } from "../../_components/controls";
import { buttonClass, controlClass, Field, Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

function splitHint(quotedPrice: string, percent: string) {
  const cents = Math.round(Number(quotedPrice) * 100);
  const share = Number(percent);
  if (!cents || !Number.isInteger(share) || share < 1 || share > 100) return "A whole number from 1 to 100. Use 100 to take the full price up front.";
  return `${money(depositCents(cents, share))} up front, ${money(balanceCents(cents, share))} later.`;
}

export function QuoteForm({ id, status, quotedPriceCents, depositPercent, adminNote, priceLocked, canResend }: { id: string; status: BespokeStatus; quotedPriceCents: number | null; depositPercent: number; adminNote: string; priceLocked: boolean; canResend: boolean }) {
  const [nextStatus, setNextStatus] = useState(status);
  const [quotedPrice, setQuotedPrice] = useState(quotedPriceCents ? (quotedPriceCents / 100).toFixed(2) : "");
  const [percent, setPercent] = useState(String(depositPercent));
  const [note, setNote] = useState(adminNote);
  const { pending, result, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => updateBespokeRequest({ id, status: nextStatus, quotedPrice, depositPercent: percent, adminNote: note }));
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Status" error={result?.fieldErrors?.status}>
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as BespokeStatus)} className={controlClass}>
          {BESPOKE_STATUSES.map((value) => (
            <option key={value} value={value}>{BESPOKE_STATUS_LABELS[value]}</option>
          ))}
        </select>
      </Field>
      <Field label="Price, USD" error={result?.fieldErrors?.quotedPrice} hint={priceLocked ? "The customer accepted, so the price cannot change." : "Setting the status to Quoted emails the customer a private link."}>
        <input value={quotedPrice} disabled={priceLocked} onChange={(event) => setQuotedPrice(event.target.value)} inputMode="decimal" className={controlClass} />
      </Field>
      <Field label="Deposit, percent of the price" error={result?.fieldErrors?.depositPercent} hint={splitHint(quotedPrice, percent)}>
        <input value={percent} disabled={priceLocked} onChange={(event) => setPercent(event.target.value)} inputMode="numeric" maxLength={3} className={controlClass} />
      </Field>
      <Field label="Private note" error={result?.fieldErrors?.adminNote} hint="The customer does not see this.">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={4000} rows={4} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Saving" : "Save price"}</button>
      {canResend ? <button type="button" disabled={pending} onClick={() => run(() => resendBespokeQuote(id))} className={buttonClass}>Email the price again</button> : null}
      <Notice result={result} compact />
    </form>
  );
}
