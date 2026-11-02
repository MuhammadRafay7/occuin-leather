"use client";

import { ArrowSquareOut, ArrowRight, Lightning, MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { NAV_GROUPS } from "./nav-items";

export type CommandAction = { id: string; label: string; keywords?: string; run: () => void };

type Command = { id: string; label: string; group: string; keywords: string; kind: "section" | "action" | "external"; run: () => void };

const SHORTCUTS: { label: string; href: string; keywords?: string; download?: boolean }[] = [
  { label: "New product", href: "/admin/products/new", keywords: "create add" },
  { label: "Import products", href: "/admin/products/import", keywords: "csv upload" },
  { label: "Export products", href: "/admin/products/export", keywords: "csv download", download: true },
  { label: "Export orders", href: "/admin/orders/export", keywords: "csv download", download: true },
  { label: "Export customers", href: "/admin/customers/export", keywords: "csv download", download: true },
  { label: "Orders to deal with", href: "/admin/orders?status=action", keywords: "fulfil ship" },
  { label: "Low stock", href: "/admin/inventory?low=1", keywords: "inventory" },
  { label: "Open messages", href: "/admin/messages?status=open", keywords: "inbox" },
  { label: "New discount code", href: "/admin/promos", keywords: "discount create add" },
  { label: "Write a newsletter", href: "/admin/newsletter/compose", keywords: "email send" },
  { label: "Add photos", href: "/admin/media", keywords: "media library" },
];

function Palette({ actions, onClose }: { actions: CommandAction[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const sections = NAV_GROUPS.flatMap((group) => (group.href
      ? [{ id: group.href, label: group.title, group: "Go to", keywords: "overview home", kind: "section", run: go(group.href) } satisfies Command]
      : group.links.map((link): Command => ({ id: link.href, label: link.label, group: "Go to", keywords: group.title, kind: "section", run: go(link.href) }))));
    const shortcuts = SHORTCUTS.map((item): Command => ({
      id: item.label,
      label: item.label,
      group: "Shortcuts",
      keywords: item.keywords ?? "",
      kind: "action",
      run: item.download ? () => window.location.assign(item.href) : go(item.href),
    }));
    return [...sections, ...shortcuts, ...actions.map((action): Command => ({ ...action, group: "Shortcuts", keywords: action.keywords ?? "", kind: action.id === "store" ? "external" : "action" }))];
  }, [actions, router]);

  const needle = query.trim().toLowerCase();
  const matches = needle ? commands.filter((command) => `${command.label} ${command.keywords} ${command.group}`.toLowerCase().includes(needle)) : commands;
  const search: Command | null = needle.length >= 2
    ? { id: "search", label: `Search everything for "${query.trim()}"`, group: "Search", keywords: "", kind: "action", run: () => router.push(`/admin/search?q=${encodeURIComponent(query.trim())}`) }
    : null;
  const shown = search ? [...matches, search] : matches;
  const active = Math.min(cursor, Math.max(0, shown.length - 1));

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!shown.length) return;
      setCursor((active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(shown[active]);
    }
  }

  return (
    <div className="adm-palette-inner">
      <div className="adm-palette-head">
        <MagnifyingGlass size={16} aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="admin-commands"
          aria-activedescendant={shown[active] ? `command-${active}` : undefined}
          aria-label="Search pages and shortcuts"
          placeholder="Search, or type a page name"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
          onKeyDown={onKeyDown}
          className="adm-palette-input"
        />
        <kbd className="adm-kbd">Esc</kbd>
      </div>
      <div ref={list} id="admin-commands" role="listbox" aria-label="Commands" className="adm-palette-list">
        {shown.map((command, index) => (
          <div key={command.id}>
            {index === 0 || shown[index - 1]!.group !== command.group ? <div className="adm-palette-group">{command.group}</div> : null}
            <div
              id={`command-${index}`}
              role="option"
              aria-selected={index === active}
              className="adm-palette-item"
              onMouseMove={() => setCursor(index)}
              onClick={() => choose(command)}
            >
              {command.kind === "external" ? <ArrowSquareOut size={14} aria-hidden="true" /> : command.kind === "action" ? <Lightning size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
              <span className="truncate">{command.label}</span>
            </div>
          </div>
        ))}
        {shown.length ? null : <p className="px-2 py-6 text-center text-muted">Type at least 2 characters to search everything.</p>}
      </div>
    </div>
  );
}

export function CommandPalette({ open, actions, onClose }: { open: boolean; actions: CommandAction[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="adm-palette" aria-label="Command palette" onClose={onClose} onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      {open ? <Palette actions={actions} onClose={onClose} /> : null}
    </dialog>
  );
}
