"use client";

import { useState, type FormEvent } from "react";
import { moveOrderStatus } from "@/lib/actions/admin";
import { money } from "@/lib/format";
import { nextStatuses, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { useAction } from "../../_components/controls";
import { controlClass, Field, Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

const WARNINGS: Partial<Record<OrderStatus, string>> = {
  cancelled: "Cancel this order? Its items go back into stock. You cannot undo this.",
};

export function MoveOrderForm({ orderId, status, balanceDueCents }: { orderId: string; status: OrderStatus; balanceDueCents: number }) {
  const options = nextStatuses(status).filter((option) => option !== "refunded");
  const [seenStatus, setSeenStatus] = useState(status);
  const [to, setTo] = useState<OrderStatus | undefined>(status === "pending" ? undefined : options[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");
  const [overrideBalance, setOverrideBalance] = useState(false);
  const { pending, result, run } = useAction();

  if (status !== seenStatus) {
    setSeenStatus(status);
    setTo(status === "pending" ? undefined : options[0]);
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

  if (!options.length) {
    return (
      <div className="grid gap-2">
        <Notice result={result} compact />
        <p className="text-muted">
          {nextStatuses(status).length ? "There is nothing more to update. Use Refund below to give money back." : "This order is finished. There is nothing more to update."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field label="Change to">
        <select value={to ?? ""} onChange={(event) => setTo(event.target.value as OrderStatus)} className={controlClass}>
          {to ? null : <option value="" disabled>Choose what happens next</option>}
          {options.map((option) => (
            <option key={option} value={option}>{STATUS_LABELS[option]}</option>
          ))}
        </select>
      </Field>
      {to === "shipped" ? (
        <Field label="Tracking number" error={result?.fieldErrors?.trackingNumber} hint="The customer gets this by email.">
          <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} className={controlClass} />
        </Field>
      ) : null}
      {blocked ? (
        <div className="adm-notice grid gap-2" data-tone="plain">
          <p role="status" className="text-danger">The customer still owes {money(balanceDueCents)}, so this order cannot ship yet.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={overrideBalance} onChange={(event) => setOverrideBalance(event.target.checked)} className="mt-0.5" />
            Ship it anyway. Add a note below saying why.
          </label>
        </div>
      ) : null}
      <Field label="Note" error={result?.fieldErrors?.note} hint="Kept in the history of this order.">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending || !to} className={primaryButtonClass}>
        {pending ? "Saving" : "Update status"}
      </button>
      <Notice result={result} compact />
    </form>
  );
}
