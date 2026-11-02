"use client";

import { useState } from "react";
import { askForBalance, markBalancePaid } from "@/lib/actions/bespoke";
import { money } from "@/lib/format";
import { useAction } from "../../_components/controls";
import { buttonClass, controlClass, Field, Notice } from "../../_components/ui";

export function BalancePanel({ requestId, owedCents, requestedAt }: { requestId: string; owedCents: number; requestedAt: string | null }) {
  const { pending, result, run } = useAction();
  const [note, setNote] = useState("");
  return (
    <div className="grid gap-3">
      {requestedAt ? <p className="text-muted">Asked for the rest of the money {requestedAt}</p> : null}
      <button type="button" disabled={pending} onClick={() => run(() => askForBalance(requestId))} className={buttonClass}>{requestedAt ? `Email the ${money(owedCents)} payment link again` : `Ask for the remaining ${money(owedCents)}`}</button>
      <Field label="Paid another way?" hint="For a bank transfer or cash. Say how it was paid.">
        <input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className={controlClass} />
      </Field>
      <button type="button" disabled={pending || !note.trim()} onClick={() => run(() => markBalancePaid(requestId, note))} className={buttonClass}>Mark as paid</button>
      <Notice result={result} compact />
    </div>
  );
}
