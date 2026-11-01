"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/ui";
import { replyToCustomer } from "@/lib/actions/bespoke";
import { useAction } from "../../_components/controls";
import { Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

export function ReplyForm({ requestId }: { requestId: string }) {
  const { pending, result, run } = useAction();
  const [body, setBody] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => replyToCustomer(requestId, body), (outcome) => {
      if (outcome.ok) setBody("");
    });
  }

  return (
    <form onSubmit={submit} className="grid max-w-[70ch] gap-2">
      <Field label="Reply to the customer" hint="Emailed with a private link to this conversation.">
        <textarea value={body} maxLength={2000} rows={4} onChange={(event) => setBody(event.target.value)} className={textAreaClass} />
      </Field>
      <button type="submit" disabled={pending} className={`${primaryButtonClass} justify-self-start`}>{pending ? "Sending" : "Send reply"}</button>
      <Notice result={result} compact />
    </form>
  );
}
