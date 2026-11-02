"use client";

import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/admin";
import { useAction } from "../_components/controls";
import { buttonClass, dangerButtonClass, Notice } from "../_components/ui";

export function ConfirmActionButton({ action, confirm, danger = false, children }: { action: () => Promise<ActionResult>; confirm: string; danger?: boolean; children: ReactNode }) {
  const { pending, result, run } = useAction();
  return (
    <div className="grid justify-items-start gap-1">
      <button type="button" disabled={pending} onClick={() => window.confirm(confirm) && run(action)} className={danger ? dangerButtonClass : buttonClass}>
        {pending ? "Saving" : children}
      </button>
      <Notice result={result} compact />
    </div>
  );
}
