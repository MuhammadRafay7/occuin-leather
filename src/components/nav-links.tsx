"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type Item = { href: string; label: string };
type Open = { href: string; left: number; top: number };

const SPRING = { type: "spring", bounce: 0, duration: 0.32 } as const;
const PANEL_GAP = 8;
const PANEL_INSET = 18;
const subscribe = () => () => undefined;

const isCurrent = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function NavLinks({ links, menus }: { links: Item[]; menus: Record<string, Item[]> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Open | null>(null);
  const closing = useRef(0);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const hold = () => window.clearTimeout(closing.current);
  const release = () => {
    hold();
    closing.current = window.setTimeout(() => setOpen(null), 140);
  };
  const enter = (href: string, target: HTMLElement) => {
    hold();
    if (!menus[href]?.length) {
      setOpen(null);
      return;
    }
    const link = target.getBoundingClientRect();
    const bar = target.closest(".liquid")?.getBoundingClientRect() ?? link;
    setOpen({ href, left: Math.max(PANEL_GAP, link.left - PANEL_INSET), top: bar.bottom + PANEL_GAP });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(closing.current);
    };
  }, []);

  const items = open ? menus[open.href] : null;
  const parent = open ? links.find((item) => item.href === open.href) : null;

  return (
    <>
      <nav aria-label="Main" onPointerLeave={release} className="hidden items-center text-[13.5px] min-[1100px]:flex">
        {links.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              aria-expanded={menus[item.href] ? open?.href === item.href : undefined}
              onPointerEnter={(event) => enter(item.href, event.currentTarget)}
              onFocus={(event) => enter(item.href, event.currentTarget)}
              className="group relative flex h-11 items-center px-3 opacity-80 transition-opacity hover:opacity-100 aria-[current=page]:opacity-100 aria-expanded:opacity-100"
            >
              {item.label}
              <span
                aria-hidden
                className="absolute inset-x-3 bottom-[9px] h-px origin-left scale-x-0 bg-current transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 group-aria-[current=page]:scale-x-100 group-aria-expanded:scale-x-100 motion-reduce:transition-none"
              />
            </Link>
          );
        })}
      </nav>
      {!mounted
        ? null
        : createPortal(
            <AnimatePresence>
              {items && open ? (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1, left: open.left }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={SPRING}
                  onPointerEnter={hold}
                  onPointerLeave={release}
                  style={{ transformOrigin: "top left", top: open.top, left: open.left }}
                  className="liquid fixed z-30 hidden w-60 rounded-[26px] !bg-white/72 p-2 lg:block"
                >
                  <ul className="grid text-[14px]">
                    {items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(null)}
                          aria-current={pathname === item.href ? "page" : undefined}
                          className="flex h-10 items-center rounded-[14px] px-3 transition-colors hover:bg-fg/[0.06] aria-[current=page]:font-medium"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {parent ? (
                    <Link href={parent.href} onClick={() => setOpen(null)} className="mt-1 flex h-10 items-center justify-between rounded-[14px] border-t border-fg/10 px-3 pt-px text-[13px] text-muted transition-colors hover:text-fg">
                      Shop all {parent.label.toLowerCase()}
                      <span aria-hidden>→</span>
                    </Link>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )}
    </>
  );
}
