"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap, useScrollLock } from "@/components/glass/hooks";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { useVisitor } from "@/components/visitor";

type NavItem = { href: string; label: string };
type Props = { links: NavItem[]; moreLinks: NavItem[] };

const subscribe = () => () => undefined;

export function HeaderMenu({ links, moreLinks }: Props) {
  const { signedIn, isAdmin } = useVisitor();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownPath, setShownPath] = useState(pathname);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const reduceMotion = useReducedMotion();
  const close = useCallback(() => setOpen(false), []);

  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  useFocusTrap(panel, open, close);
  useScrollLock(panel, open);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  const extra = [
    { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in" },
    { href: "/search", label: "Search" },
    { href: "/wishlist", label: "Saved items" },
    ...moreLinks,
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)} className="-mx-2 h-11 px-2 text-[13px] hover:opacity-60 min-[1100px]:hidden">
        Menu
      </button>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  key="menu"
                  ref={panel}
                  data-scroll
                  role="dialog"
                  aria-modal="true"
                  aria-label="Menu"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
                  transition={reduceMotion ? INSTANT : SHEET_SPRING}
                  className="glass-panel fixed bottom-[max(8px,env(safe-area-inset-bottom))] left-[max(8px,env(safe-area-inset-left))] right-[max(8px,env(safe-area-inset-right))] top-[max(8px,env(safe-area-inset-top))] z-40 overflow-y-auto overscroll-contain rounded-[28px] !bg-bg/90 px-5 py-1.5 text-fg"
                >
                  <button type="button" onClick={close} className="-ml-2 h-11 px-2 text-[13px] hover:opacity-60">Close</button>
                  <nav aria-label="Mobile" className="mt-6 grid short:mt-1">
                    {links.map((item) => (
                      <Link key={item.href} href={item.href} onClick={close} className="flex min-h-14 items-center font-display text-4xl short:min-h-11 short:text-2xl">{item.label}</Link>
                    ))}
                  </nav>
                  <nav aria-label="More" className="mt-6 grid text-muted short:mt-2 short:grid-cols-2">
                    {extra.map((item, index) => (
                      <Link key={`${item.href}-${index}`} href={item.href} onClick={close} className="flex min-h-11 items-center">{item.label}</Link>
                    ))}
                  </nav>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
