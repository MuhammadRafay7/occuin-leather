"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui";
import { moveOrderStatus } from "@/lib/actions/admin";
import { money } from "@/lib/format";
import { nextStatuses, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { useAction } from "../../_components/controls";
import { controlClass, Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

const WARNINGS: Partial<Record<OrderStatus, string>> = {
  refunded: "Refund this order? The customer's payment is returned through Stripe and unshipped stock is released. This cannot be undone.",
  cancelled: "Cancel this order? Its stock is released. This cannot be undone.",
};

export function MoveOrderForm({ orderId, status, balanceDueCents }: { orderId: string; status: OrderStatus; balanceDueCents: number }) {
  const options = nextStatuses(status);
  const [seenStatus, setSeenStatus] = useState(status);
  const [to, setTo] = useState<OrderStatus | undefined>(options[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");
  const [overrideBalance, setOverrideBalance] = useState(false);
  const { pending, result, run } = useAction();

  if (status !== seenStatus) {
    setSeenStatus(status);
    setTo(options[0]);
    setTrackingNumber("");
    setNote("");
    setOverrideBalance(false);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!to) return;
    const warning = WARNINGS[to];
    if (warning && !window.confirm(warning)) return;
    run(() => moveOrderStatus({ orderId, to, trackingNumber, note, overrideBalance }));
  }

  const blocked = to === "shipped" && balanceDueCents > 0;

  if (!to) {
    return (
      <div className="grid gap-2">
        <Notice result={result} compact />
        <p className="text-sm text-muted">This order is closed. It has no further moves.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Move to">
        <select value={to} onChange={(event) => setTo(event.target.value as OrderStatus)} className={controlClass}>
          {options.map((option) => (
            <option key={option} value={option}>{STATUS_LABELS[option]}</option>
          ))}
        </select>
      </Field>
      {to === "shipped" ? (
        <Field label="Tracking number" error={result?.fieldErrors?.trackingNumber} hint="Sent to the customer in the shipping email.">
          <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} className={controlClass} />
        </Field>
      ) : null}
      {blocked ? (
        <div className="grid gap-2 border border-line p-2 text-sm">
          <p role="status" className="text-danger">A balance of {money(balanceDueCents)} is due, so this order cannot ship yet.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={overrideBalance} onChange={(event) => setOverrideBalance(event.target.checked)} className="mt-0.5" />
            Ship anyway. The note below is required and saved on the timeline.
          </label>
        </div>
      ) : null}
      <Field label="Note" error={result?.fieldErrors?.note} hint="Saved on the timeline with this move.">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Moving" : "Move order"}
      </button>
      <Notice result={result} compact />
    </form>
  );
}
