"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";

type Props = { links: { href: string; label: string }[]; signedIn: boolean; isAdmin: boolean };

export function HeaderMenu({ links, signedIn, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const extra = [
    { href: signedIn ? "/account" : "/login", label: signedIn ? "Account" : "Sign in" },
    { href: "/search", label: "Search" },
    { href: "/wishlist", label: "Saved items" },
    { href: "/track", label: "Track an order" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(true)} className="text-[13px] hover:opacity-60 lg:hidden">
        Menu
      </button>
      {open
        ? createPortal(
            <div role="dialog" aria-modal="true" aria-label="Menu" className="glass-panel fixed inset-2 z-40 overflow-y-auto rounded-[28px] px-6 py-6 text-fg">
              <button type="button" onClick={close} className="text-[13px] hover:opacity-60">Close</button>
              <nav aria-label="Mobile" className="mt-10 grid gap-3">
                {links.map((item) => (
                  <Link key={item.href} href={item.href} onClick={close} className="font-display text-4xl">{item.label}</Link>
                ))}
              </nav>
              <nav aria-label="More" className="mt-10 grid gap-2 text-muted">
                {extra.map((item) => (
                  <Link key={item.href} href={item.href} onClick={close}>{item.label}</Link>
                ))}
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
