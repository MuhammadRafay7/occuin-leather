"use client";

import { ArrowSquareOut, CaretRight, CaretUpDown, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAdmin } from "@/lib/actions/auth";
import { BrandMark } from "./brand";
import { isCurrent, NAV_GROUPS, type NavCounts, type NavGroup, type NavLink } from "./nav-items";

export type Account = { id: string; name: string; email: string };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "A";

function SubItem({ link, counts, onNavigate }: { link: NavLink; counts: NavCounts; onNavigate: () => void }) {
  const pathname = usePathname();
  const value = link.badge ? counts[link.badge] : 0;
  return (
    <li>
      <Link
        href={link.href}
        onClick={onNavigate}
        aria-current={isCurrent(pathname, link) ? "page" : undefined}
        aria-label={value ? `${link.label}, ${value} ${link.badgeLabel}` : undefined}
        className="adm-nav-item"
      >
        <span className="truncate">{link.label}</span>
        {value ? <span aria-hidden="true" className="adm-nav-count">{value}</span> : null}
      </Link>
    </li>
  );
}

function Entry({ group, counts, rail, onExpandRail, onNavigate }: { group: NavGroup; counts: NavCounts; rail: boolean; onExpandRail: () => void; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = group.links.some((link) => isCurrent(pathname, link));
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  const Icon = group.icon;

  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  if (group.href) {
    return (
      <li>
        <Link href={group.href} onClick={onNavigate} title={group.title} aria-current={pathname === group.href ? "page" : undefined} className="adm-nav-item">
          <Icon size={16} aria-hidden="true" className="flex-none" />
          <span className="adm-nav-text truncate">{group.title}</span>
        </Link>
      </li>
    );
  }

  const total = group.links.reduce((sum, link) => sum + (link.badge ? counts[link.badge] : 0), 0);
  return (
    <li>
      <button
        type="button"
        className="adm-nav-item"
        title={group.title}
        aria-expanded={open}
        data-has-active={active}
        onClick={() => {
          if (rail) {
            onExpandRail();
            setOpen(true);
          } else {
            setOpen(!open);
          }
        }}
      >
        <Icon size={16} aria-hidden="true" className="flex-none" />
        <span className="adm-nav-text truncate">{group.title}</span>
        {total ? <span aria-hidden="true" className="adm-nav-count">{total}</span> : null}
        {total ? <span aria-hidden="true" className="adm-nav-dot" /> : null}
        <CaretRight size={14} aria-hidden="true" className="adm-nav-chevron" />
      </button>
      {open ? (
        <ul className="adm-nav-sub">
          {group.links.map((link) => <SubItem key={link.href} link={link} counts={counts} onNavigate={onNavigate} />)}
        </ul>
      ) : null}
    </li>
  );
}

function NavUser({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={root} className="adm-sidebar-foot">
      <button type="button" className="adm-user" aria-label="Account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="adm-avatar">{initials(account.name)}</span>
        <span className="adm-user-text">
          <span className="truncate text-sm font-semibold">{account.name}</span>
          <span className="truncate text-xs opacity-70">{account.email}</span>
        </span>
        <CaretUpDown size={16} aria-hidden="true" className="adm-user-caret flex-none" />
      </button>
      {open ? (
        <div role="menu" className="adm-menu">
          <div className="border-b border-line px-2 pb-2 pt-1">
            <p className="truncate font-semibold">{account.name}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
          <div className="grid gap-px pt-1">
            <a role="menuitem" href="/" target="_blank" rel="noopener noreferrer" className="adm-menu-item" onClick={() => setOpen(false)}><ArrowSquareOut size={16} aria-hidden="true" />View store</a>
            <form action={signOutAdmin} className="border-t border-line pt-1">
              <button role="menuitem" type="submit" className="adm-menu-item" data-danger="true"><SignOut size={16} aria-hidden="true" />Sign out</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminNav({ counts, account, open, rail, onToggleRail, onNavigate }: { counts: NavCounts; account: Account; open: boolean; rail: boolean; onToggleRail: () => void; onNavigate: () => void }) {
  return (
    <aside id="admin-sidebar" className="adm-sidebar" data-open={open}>
      <Link href="/admin" className="adm-brand" onClick={onNavigate} aria-label="OCCUIN admin dashboard">
        <span className="adm-brand-tile"><BrandMark size={20} /></span>
        <span className="adm-brand-text">
          <strong className="truncate">OCCUIN</strong>
          <small className="truncate">Admin</small>
        </span>
      </Link>
      <nav aria-label="Admin" className="adm-nav">
        <p className="adm-nav-label">Menu</p>
        <ul className="grid gap-1">
          {NAV_GROUPS.map((group) => <Entry key={group.title} group={group} counts={counts} rail={rail} onExpandRail={onToggleRail} onNavigate={onNavigate} />)}
        </ul>
      </nav>
      <NavUser account={account} />
      <button type="button" tabIndex={-1} aria-hidden="true" title="Toggle sidebar" className="adm-rail-handle" onClick={onToggleRail} />
    </aside>
  );
}
