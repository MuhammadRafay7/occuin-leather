"use client";

import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/admin";
import { useAction } from "./controls";
import { buttonClass, dangerButtonClass, Notice, primaryButtonClass } from "./ui";

export function ConfirmButton({ action, label, confirmLabel, warning, danger = false }: { action: () => Promise<ActionResult>; label: ReactNode; confirmLabel: string; warning: string; danger?: boolean }) {
  const { pending, result, run } = useAction();
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <div className="grid justify-items-start gap-1">
        <button type="button" onClick={() => setAsking(true)} className={danger ? dangerButtonClass : buttonClass}>{label}</button>
        <Notice result={result} compact />
      </div>
    );
  }
  return (
    <div className="grid justify-items-start gap-2">
      <p className="text-xs text-muted">{warning}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(action, (outcome) => { if (outcome.ok) setAsking(false); })} className={danger ? dangerButtonClass : primaryButtonClass}>{pending ? "Working" : confirmLabel}</button>
        <button type="button" disabled={pending} onClick={() => setAsking(false)} className={buttonClass}>Cancel</button>
      </div>
      <Notice result={result} compact />
    </div>
  );
}

export function MoreMenu({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <details ref={menu} className="relative" onKeyDown={(event) => { if (event.key === "Escape" && menu.current) menu.current.open = false; }}>
      <summary className={`${buttonClass} list-none [&::-webkit-details-marker]:hidden`}>More<CaretDown size={12} aria-hidden="true" /></summary>
      <div className="adm-menu right-auto left-0 sm:right-0 sm:left-auto">{children}</div>
    </details>
  );
}
