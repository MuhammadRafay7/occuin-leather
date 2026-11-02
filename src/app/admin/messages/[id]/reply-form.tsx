"use client";

import { useState } from "react";
import { replyToMessage } from "@/lib/actions/admin-people";
import { useAction } from "../../_components/controls";
import { Notice, primaryButtonClass, textAreaClass } from "../../_components/ui";

export function ReplyForm({ messageId, email, mailReady, seenRepliedAt }: { messageId: string; email: string; mailReady: boolean; seenRepliedAt: string | null }) {
  const { pending, result, run } = useAction();
  const [body, setBody] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => replyToMessage(messageId, body, seenRepliedAt), (outcome) => { if (outcome.ok) setBody(""); });
      }}
    >
      {mailReady ? null : <p role="status" className="adm-notice" data-tone="danger">Email is not set up yet, so replies cannot be sent from here. Write to {email} from your own mailbox.</p>}
      <textarea aria-label={`Reply to ${email}`} rows={8} maxLength={10_000} required value={body} onChange={(event) => setBody(event.target.value)} className={textAreaClass} placeholder="Write your reply. Their message is included underneath." />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !body.trim()} className={primaryButtonClass}>{pending ? "Sending" : "Send reply"}</button>
        <Notice result={result} compact />
      </div>
    </form>
  );
}
