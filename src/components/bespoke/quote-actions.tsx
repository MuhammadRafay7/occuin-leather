"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptBespoke, askForChange, bagAcceptedBespoke, bagBalance, type Access } from "@/lib/actions/bespoke";

const PRIMARY = "flex min-h-12 w-full items-center justify-center rounded-full bg-invert-bg px-6 text-sm font-medium text-invert-fg hover:opacity-90 disabled:opacity-50";
const SECONDARY = "flex min-h-12 w-full items-center justify-center rounded-full border border-fg/30 px-6 text-sm font-medium hover:bg-fg/5 disabled:opacity-50";

export function QuoteActions({ access, canAccept, canChange, canBag, canPayBalance, payLabel, balanceLabel }: { access: Access; canAccept: boolean; canChange: boolean; canBag: boolean; canPayBalance: boolean; payLabel: string; balanceLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState("");

  const run = (task: () => Promise<{ error?: string; ok?: boolean }>, after: () => void) =>
    start(async () => {
      setError(null);
      try {
        const result = await task();
        if (result.error) setError(result.error);
        else after();
      } catch {
        setError("We could not reach the server. Try again.");
      }
    });

  return (
    <div className="grid gap-3">
      {canAccept ? <button type="button" disabled={pending} onClick={() => run(() => acceptBespoke(access), () => router.push("/bag"))} className={PRIMARY}>Accept and {payLabel}</button> : null}
      {canBag ? <button type="button" disabled={pending} onClick={() => run(() => bagAcceptedBespoke(access), () => router.push("/bag"))} className={PRIMARY}>Go to bag and {payLabel}</button> : null}
      {canPayBalance ? <button type="button" disabled={pending} onClick={() => run(() => bagBalance(access), () => router.push("/bag"))} className={PRIMARY}>{balanceLabel}</button> : null}
      {canChange && !asking ? <button type="button" disabled={pending} onClick={() => setAsking(true)} className={SECONDARY}>Ask for a change</button> : null}
      {asking ? (
        <div className="grid gap-2">
          <label className="grid gap-1.5 text-sm">
            What would you like to change?
            <textarea value={message} maxLength={2000} rows={4} onChange={(event) => setMessage(event.target.value)} className="w-full border border-line bg-transparent p-3 text-[15px] focus:border-fg focus:outline-none" />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => askForChange(access, message), () => router.refresh())} className={PRIMARY}>Send to the workshop</button>
          <button type="button" disabled={pending} onClick={() => setAsking(false)} className={SECONDARY}>Cancel</button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
