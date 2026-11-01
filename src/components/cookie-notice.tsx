"use client";

import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { useIsoLayoutEffect } from "@/components/glass/hooks";
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
  const notice = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const node = notice.current;
    if (!node) return;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--cookie-lift", `${window.innerHeight - node.getBoundingClientRect().top}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--cookie-lift");
    };
  }, [seen]);

  if (seen) return null;

  return (
    <div ref={notice} role="region" aria-label="Cookie notice" className="glass-panel fixed bottom-[max(8px,env(safe-area-inset-bottom))] left-[max(8px,env(safe-area-inset-left))] right-[max(8px,env(safe-area-inset-right))] z-20 flex items-center justify-between gap-3 rounded-[24px] py-2 pl-4 pr-2 text-[13px] leading-snug md:bottom-6 md:left-auto md:right-6 md:max-w-sm md:gap-6 md:py-3 md:pl-5 md:pr-5">
      <p>
        We use cookies only to keep you signed in and to hold your bag.{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:opacity-60">Privacy</Link>
      </p>
      <button type="button" onClick={dismiss} className="grid h-11 min-w-11 shrink-0 place-items-center rounded-full bg-white/70 px-3 font-medium hover:opacity-60 md:h-auto md:min-w-0 md:rounded-none md:bg-transparent md:px-0 md:font-normal md:underline md:underline-offset-4">OK</button>
    </div>
  );
}
