"use client";

import { X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { openBag } from "@/components/bag-drawer";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { useVisitor } from "@/components/visitor";
import { readLocal, writeLocal } from "@/lib/local-store";

const LAST_VISIT = "occuin-last-visit";
const SESSION = "occuin-session";
const AWAY_MS = 30 * 60 * 1000;
const SHOW_DELAY = 900;
const QUIET_PATHS = ["/bag", "/checkout", "/orders", "/login", "/register"];

let returningVisit: boolean | null = null;

function startsSession() {
  try {
    if (window.sessionStorage.getItem(SESSION)) return false;
    window.sessionStorage.setItem(SESSION, "1");
    return true;
  } catch {
    return false;
  }
}

function isReturningVisit() {
  if (returningVisit === null) {
    const previous = Number(readLocal(LAST_VISIT) ?? 0);
    returningVisit = startsSession() && previous > 0 && Date.now() - previous > AWAY_MS;
  }
  writeLocal(LAST_VISIT, String(Date.now()));
  return returningVisit;
}

export function BagReminder() {
  const pathname = usePathname();
  const { count } = useVisitor();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState<number | undefined>(undefined);
  const firstPath = useRef<string | null>(null);

  useEffect(() => {
    const returning = isReturningVisit();
    if (firstPath.current === null) firstPath.current = pathname;
    if (firstPath.current !== pathname) {
      setVisible(false);
      return;
    }
    if (!returning || count < 1 || QUIET_PATHS.some((path) => pathname.startsWith(path))) return;
    const timer = setTimeout(() => {
      const header = document.querySelector("header")?.getBoundingClientRect();
      setTop(header && header.bottom > 0 ? header.bottom + 8 : undefined);
      setVisible(true);
    }, SHOW_DELAY);
    return () => clearTimeout(timer);
  }, [pathname, count]);

  function view() {
    setVisible(false);
    openBag();
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          style={top === undefined ? undefined : { top }}
          aria-label="Your bag is waiting"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0, transition: INSTANT } : { opacity: 0, y: -8, transition: { duration: 0.18 } }}
          transition={reduceMotion ? INSTANT : SHEET_SPRING}
          className="glass-panel fixed right-[max(8px,env(safe-area-inset-right))] top-[calc(max(8px,env(safe-area-inset-top))+64px)] z-[29] flex w-[min(340px,calc(100vw-16px))] items-center gap-3 rounded-[22px] py-2 pl-4 pr-2 md:right-[max(16px,env(safe-area-inset-right))] md:top-[calc(max(12px,env(safe-area-inset-top))+66px)]"
        >
          <div className="min-w-0 flex-1 py-1">
            <p className="font-display text-lg leading-tight">Your bag is waiting</p>
            <p className="text-[13px] leading-snug text-fg/75">
              {count} {count === 1 ? "piece" : "pieces"} from your last visit.
            </p>
          </div>
          <button type="button" onClick={view} className="flex h-11 shrink-0 items-center rounded-full bg-invert-bg px-4 text-[13px] font-medium text-invert-fg transition active:scale-[0.96]">
            View bag
          </button>
          <button type="button" aria-label="Dismiss" onClick={() => setVisible(false)} className="grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-fg/5 active:scale-[0.94]">
            <X size={16} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
