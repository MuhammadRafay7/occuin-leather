"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "@/lib/local-store";

const KEY = "orsel-cookie-notice";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss() {
  writeLocal(KEY, "seen");
  listeners.forEach((listener) => listener());
}

export function CookieNotice() {
  const seen = useSyncExternalStore(subscribe, () => readLocal(KEY) === "seen", () => true);
  if (seen) return null;

  return (
    <div role="region" aria-label="Cookie notice" className="glass-panel fixed inset-x-2 bottom-2 z-20 flex items-center justify-between gap-6 rounded-[24px] px-5 py-3 text-[13px] md:inset-x-auto md:bottom-6 md:right-6 md:max-w-sm">
      <p>
        We use cookies only to keep you signed in and to hold your bag.{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:opacity-60">Privacy</Link>
      </p>
      <button type="button" onClick={dismiss} className="underline underline-offset-4 hover:opacity-60">OK</button>
    </div>
  );
}
