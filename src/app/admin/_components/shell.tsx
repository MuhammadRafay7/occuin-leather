"use client";

import { ArrowSquareOut, CaretRight, House, List, MagnifyingGlass, Moon, SidebarSimple, Sun, X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { signOutAdmin } from "@/lib/actions/auth";
import { CommandPalette, type CommandAction } from "./command-palette";
import { AdminNav, type Account } from "./nav";
import { breadcrumbChain, COOKIES, remember, type NavCounts } from "./nav-items";
import { NotificationBell } from "./notification-bell";

export type Theme = "light" | "dark";

function Crumbs() {
  const chain = breadcrumbChain(usePathname());
  return (
    <nav aria-label="Breadcrumb" className="adm-crumbs">
      <Link href="/admin" aria-label="Admin home"><House size={16} aria-hidden="true" /></Link>
      {chain.map((item, index) => {
        const last = index === chain.length - 1;
        return (
          <Fragment key={item.label}>
            <span className={last ? "contents" : "adm-crumb-parent"}>
              <CaretRight size={14} aria-hidden="true" className="flex-none" />
              {last ? <span aria-current="page">{item.label}</span> : item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}

const RESIZE_MS = 220;

export function AdminShell({ account, counts, attention, theme: initialTheme, rail: initialRail, children }: { account: Account; counts: NavCounts; attention: number; theme: Theme; rail: boolean; children: ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);
  const [rail, setRail] = useState(initialRail);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [resizing, setResizing] = useState(false);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleTheme = useCallback(() => setTheme((current) => {
    const next = current === "dark" ? "light" : "dark";
    remember(COOKIES.theme, next);
    return next;
  }), []);

  const toggleRail = useCallback(() => {
    if (resizeTimer.current) clearTimeout(resizeTimer.current);
    setResizing(true);
    resizeTimer.current = setTimeout(() => setResizing(false), RESIZE_MS);
    setRail((current) => {
      remember(COOKIES.rail, current ? "0" : "1");
      return !current;
    });
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".adm-sheen");
      if (!card) return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty("--adm-mx", `${event.clientX - bounds.left}px`);
      card.style.setProperty("--adm-my", `${event.clientY - bounds.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setPalette((current) => !current);
      }
      if ((event.metaKey || event.ctrlKey) && key === "b") {
        event.preventDefault();
        toggleRail();
      }
      if (event.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleRail]);

  const actions = useMemo<CommandAction[]>(() => [
    { id: "store", label: "View store", keywords: "website shop", run: () => window.open("/", "_blank", "noopener") },
    { id: "theme", label: "Switch between light and dark", keywords: "appearance mode", run: toggleTheme },
    { id: "rail", label: "Hide or show the side menu", keywords: "menu", run: toggleRail },
    { id: "signout", label: "Sign out", keywords: "log out", run: () => void signOutAdmin() },
  ], [toggleRail, toggleTheme]);

  return (
    <div className="adm" data-theme={theme} data-rail={rail} data-resizing={resizing}>
      <AdminNav counts={counts} account={account} open={drawer} rail={rail} onToggleRail={toggleRail} onNavigate={() => setDrawer(false)} />
      {drawer ? <button type="button" aria-label="Close menu" className="adm-scrim" onClick={() => setDrawer(false)} /> : null}
      <div className="adm-main">
        <header className="adm-topbar">
          <button type="button" className="adm-iconbtn adm-only-mobile -ml-1" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer} aria-controls="admin-sidebar" onClick={() => setDrawer(!drawer)}>
            {drawer ? <X size={16} /> : <List size={16} />}
          </button>
          <button type="button" className="adm-iconbtn adm-only-desktop -ml-1" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={rail} onClick={toggleRail}>
            <SidebarSimple size={16} />
          </button>
          <span aria-hidden="true" className="adm-topbar-divider" />
          <Crumbs />
          <div className="adm-topbar-actions">
            <button type="button" className="adm-iconbtn" aria-label="Search" title="Search" onClick={() => setPalette(true)}><MagnifyingGlass size={16} /></button>
            <a href="/" target="_blank" rel="noopener noreferrer" className="adm-iconbtn adm-only-wide" aria-label="View store" title="View store"><ArrowSquareOut size={16} aria-hidden="true" /></a>
            <button type="button" className="adm-iconbtn" aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"} onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <NotificationBell initialCount={attention} />
          </div>
        </header>
        <main className="adm-page">{children}</main>
      </div>
      <CommandPalette open={palette} actions={actions} onClose={() => setPalette(false)} />
    </div>
  );
}
