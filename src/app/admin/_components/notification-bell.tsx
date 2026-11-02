"use client";

import { Bell, ChatCircleText, Package, Scissors, Tray, X, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminNotification, NotificationKind } from "../_lib/notifications";

const POLL_MS = 300_000;

const KINDS: Record<NotificationKind, { icon: Icon; className: string }> = {
  order: { icon: Tray, className: "text-[var(--adm-warn)]" },
  bespoke: { icon: Scissors, className: "text-[var(--adm-chart-4)]" },
  message: { icon: ChatCircleText, className: "text-[var(--adm-chart-2)]" },
  stock: { icon: Package, className: "text-danger" },
};

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(initialCount);
  const panel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { items: AdminNotification[]; total: number };
      setItems(body.items);
      setTotal(body.total);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const poll = setInterval(() => { if (document.visibilityState !== "hidden") void load(); }, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={panel} className="relative">
      <button type="button" className="adm-iconbtn" aria-haspopup="true" aria-expanded={open} aria-label={`Notifications${total ? ` (${total})` : ""}`} onClick={() => setOpen(!open)}>
        <Bell size={16} aria-hidden="true" />
        {total ? <span aria-hidden="true" className="adm-bell-dot" /> : null}
      </button>
      {open ? (
        <div className="adm-bell-panel">
          <div className="adm-bell-head">
            <p>Notifications</p>
            <button type="button" aria-label="Close notifications" className="text-muted hover:text-fg" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          {items.length ? (
            <ul className="max-h-[60dvh] overflow-y-auto py-1">
              {items.map((item) => {
                const { icon: KindIcon, className } = KINDS[item.kind];
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href} className="adm-bell-item" onClick={() => setOpen(false)}>
                      <KindIcon size={16} aria-hidden="true" className={`mt-0.5 flex-none ${className}`} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted">{item.detail}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell size={20} aria-hidden="true" className="mx-auto mb-2 text-muted" />
              <p className="text-muted">All caught up!</p>
            </div>
          )}
          {total > items.length ? <Link href="/admin" className="adm-bell-foot" onClick={() => setOpen(false)}>{total} things to look at. Open dashboard</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
