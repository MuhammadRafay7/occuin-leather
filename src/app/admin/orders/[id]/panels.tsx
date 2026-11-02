"use client";

import { useState, type FormEvent } from "react";
import { addOrderNote, issueOrderRefund, saveTrackingNumber } from "@/lib/actions/admin-orders";
import { money } from "@/lib/format";
import { useAction } from "../../_components/controls";
import { buttonClass, controlClass, Field, Notice, textAreaClass } from "../../_components/ui";

type RefundPanelProps = {
  orderId: string;
  refundable: boolean;
  totalCents: number;
  refundedCents: number;
  hasPaymentIntent: boolean;
  stripeConfigured: boolean;
};

export function RefundPanel({ orderId, refundable, totalCents, refundedCents, hasPaymentIntent, stripeConfigured }: RefundPanelProps) {
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState(false);
  const { pending, result, run } = useAction();
  const errors = result?.fieldErrors ?? {};
  const remaining = totalCents - refundedCents;
  const stripeMissing = hasPaymentIntent && !stripeConfigured;
  const needsManual = !hasPaymentIntent && !manual;

  function submit(event: FormEvent) {
    event.preventDefault();
    const size = mode === "full" ? `the full ${money(remaining)} left on this order` : `$${amount}`;
    const question = hasPaymentIntent
      ? `Give back ${size}? The money goes back to the customer's card.`
      : `Record a refund of ${size}? This is only a note here. No money will move.`;
    if (!window.confirm(`${question} You cannot undo this.`)) return;
    run(() => issueOrderRefund({ orderId, mode, amount, reason, manual, expectedRefundedCents: refundedCents }), (outcome) => {
      if (!outcome.ok) return;
      setAmount("");
      setReason("");
      setManual(false);
      setMode("full");
    });
  }

  if (!refundable) {
    return (
      <div className="grid gap-2">
        <Notice result={result} compact />
        <p className="text-muted">{refundedCents ? "This order is fully refunded." : "Only a paid order can be refunded."}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <p className="tabular-nums">You can refund up to {money(remaining)} of the {money(totalCents)} paid.</p>
      {stripeMissing ? (
        <p role="alert" className="text-danger">Card refunds are not set up on this site yet, so this one cannot be done here. Refund it from your Stripe account instead.</p>
      ) : hasPaymentIntent ? (
        <p className="text-xs text-muted">The money goes back to the customer&apos;s card.</p>
      ) : (
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} className="mt-0.5" />
          This order was not paid by card here. Tick this if you already gave the money back another way. It only keeps a note and no money moves.
        </label>
      )}
      <fieldset className="flex flex-wrap gap-4">
        <legend className="sr-only">Refund size</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="refund-mode" checked={mode === "full"} onChange={() => setMode("full")} /> All of it
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="refund-mode" checked={mode === "partial"} onChange={() => setMode("partial")} /> Part of it
        </label>
      </fieldset>
      {mode === "partial" ? (
        <Field label="Amount, USD" error={errors.amount}>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className={controlClass} />
        </Field>
      ) : null}
      <Field label="Reason" error={errors.reason} hint="For your records. The customer does not see this.">
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending || stripeMissing || needsManual} className={buttonClass}>
        {pending ? "Refunding" : mode === "full" ? "Refund in full" : "Refund this amount"}
      </button>
      <Notice result={result} compact />
    </form>
  );
}

export function TrackingForm({ orderId, trackingNumber, editable }: { orderId: string; trackingNumber: string | null; editable: boolean }) {
  const [value, setValue] = useState(trackingNumber ?? "");
  const { pending, result, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => saveTrackingNumber(orderId, value));
  }

  if (!editable) return <p className="text-muted">You can add a tracking number once the order is paid.</p>;
  return (
    <form onSubmit={submit} className="grid gap-2">
      <Field label="Tracking number" error={result?.fieldErrors?.trackingNumber} hint="Saving does not email the customer.">
        <input value={value} onChange={(event) => setValue(event.target.value)} maxLength={100} className={controlClass} />
      </Field>
      <button type="submit" disabled={pending || value.trim() === (trackingNumber ?? "")} className={buttonClass}>{pending ? "Saving" : "Save tracking"}</button>
      <Notice result={result} compact />
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [body, setBody] = useState("");
  const { pending, result, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => addOrderNote(orderId, body), (outcome) => {
      if (outcome.ok) setBody("");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <Field label="Add a note" error={result?.fieldErrors?.body} hint="Customers never see these.">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} className={textAreaClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass}>{pending ? "Saving" : "Save note"}</button>
        <Notice result={result?.fieldErrors ? null : result} compact />
      </div>
    </form>
  );
}
