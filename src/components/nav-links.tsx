"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type Item = { href: string; label: string };
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;
const PANEL_GAP = 8;
const subscribe = () => () => undefined;

export function NavLinks({ links, menus }: { links: Item[]; menus: Record<string, Item[]> }) {
  const [active, setActive] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [panelTop, setPanelTop] = useState(0);
  const closing = useRef(0);
  const bar = useRef<HTMLElement>(null);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const hold = () => window.clearTimeout(closing.current);
  const release = () => {
    hold();
    closing.current = window.setTimeout(() => setMenu(null), 140);
  };
  const enter = (href: string) => {
    hold();
    setActive(href);
    setPanelTop((bar.current?.closest("header")?.getBoundingClientRect().bottom ?? 0) + PANEL_GAP);
    setMenu(menus[href]?.length ? href : null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(closing.current);
    };
  }, []);

  const items = menu ? menus[menu] : null;

  return (
    <>
      <nav
        ref={bar}
        aria-label="Main"
        onPointerLeave={() => {
          setActive(null);
          release();
        }}
        className="hidden items-center text-[13px] min-[1100px]:flex"
      >
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-expanded={menus[item.href] ? menu === item.href : undefined}
            onPointerEnter={() => enter(item.href)}
            onFocus={() => enter(item.href)}
            className="relative rounded-full px-3 py-1.5"
          >
            {active === item.href ? (
              <motion.span layoutId="nav-lens" transition={SPRING} className="absolute inset-0 rounded-full bg-white/70 shadow-[inset_0_1px_0_white,0_2px_8px_rgb(23_49_42/0.12)]" />
            ) : null}
            <span className="relative">{item.label}</span>
          </Link>
        ))}
      </nav>
      {!mounted
        ? null
        : createPortal(
            <AnimatePresence>
              {items ? (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, y: -8, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.985 }}
                  transition={SPRING}
                  onPointerEnter={hold}
                  onPointerLeave={release}
                  style={{ transformOrigin: "top left", top: panelTop }}
                  className="glass-panel fixed left-4 z-30 hidden min-w-64 rounded-[24px] p-3 lg:block"
                >
                  <ul className="grid text-sm">
                    {items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} onClick={() => setMenu(null)} className="block rounded-full px-4 py-2 transition-colors hover:bg-white/70">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </>
  );
}
