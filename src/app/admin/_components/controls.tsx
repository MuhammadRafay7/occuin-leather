"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/admin";
import { buttonClass, Notice } from "./ui";

export function useAction<T extends ActionResult>() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = (task: () => Promise<T>, onResult?: (result: T) => void) =>
    start(async () => {
      try {
        const outcome = await task();
        setResult(outcome);
        onResult?.(outcome);
      } catch (error) {
        unstable_rethrow(error);
        setResult({ ok: false, message: "We could not reach the server. Try again." });
      }
    });

  return { pending, result, run, clear: () => setResult(null) };
}

export function ActionButton({ action, children }: { action: () => Promise<ActionResult>; children: ReactNode }) {
  const { pending, result, run } = useAction();
  return (
    <div className="grid justify-items-start gap-1">
      <button type="button" disabled={pending} onClick={() => run(action)} className={buttonClass}>
        {pending ? "Saving" : children}
      </button>
      <Notice result={result} compact />
    </div>
  );
}
