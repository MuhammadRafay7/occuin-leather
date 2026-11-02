"use client";

import { useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/admin";
import { useAction } from "./controls";
import { buttonClass, dangerButtonClass, Notice } from "./ui";

export function ConfirmButton<T extends ActionResult>({ action, children, prompt, confirmLabel = "Confirm", onDone }: { action: () => Promise<T>; children: ReactNode; prompt: string; confirmLabel?: string; onDone?: (result: T) => void }) {
  const [asking, setAsking] = useState(false);
  const { pending, result, run } = useAction<T>();

  return (
    <div className="grid justify-items-start gap-1">
      {asking ? (
        <div className="grid gap-1">
          <p className="max-w-64 text-xs text-muted">{prompt}</p>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(action, (outcome) => { setAsking(false); onDone?.(outcome); })}
              className={dangerButtonClass}
            >
              {pending ? "Working" : confirmLabel}
            </button>
            <button type="button" disabled={pending} onClick={() => setAsking(false)} className={buttonClass}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className={buttonClass}>{children}</button>
      )}
      <Notice result={result} compact />
    </div>
  );
}
