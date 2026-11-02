"use client";

import { useState, type FormEvent } from "react";
import { markOrderPaid } from "@/lib/actions/admin-orders";
import { useAction } from "../../_components/controls";
import { Field, Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

export function MarkPaidForm({ orderId }: { orderId: string }) {
  const [note, setNote] = useState("");
  const { pending, result, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Mark this order as paid? The customer gets a confirmation email. You cannot undo this.")) return;
    run(() => markOrderPaid(orderId, note));
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <Field label="How they paid" hint="Optional. Kept in the history of this order." error={result?.fieldErrors?.note}>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Saving" : "Mark as paid"}</button>
      <Notice result={result?.fieldErrors ? null : result} compact />
    </form>
  );
}
