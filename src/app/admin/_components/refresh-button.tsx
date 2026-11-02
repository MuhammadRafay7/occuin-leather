"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { buttonClass } from "./ui";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label="Refresh dashboard" className={buttonClass} onClick={() => start(() => router.refresh())}>
      <ArrowsClockwise size={16} aria-hidden="true" className={pending ? "animate-spin" : undefined} />
      {pending ? "Refreshing" : "Refresh"}
    </button>
  );
}
