import type { Icon } from "@phosphor-icons/react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Campaign } from "@/lib/server/campaigns";
import { param, type SearchParams } from "../_lib/format";
import { controlClass, type Tone } from "./ui";

export function hrefWith(path: string, search: SearchParams, changes: Record<string, string>) {
  const query = new URLSearchParams();
  for (const key of Object.keys(search)) {
    const value = param(search, key);
    if (value && key !== "page" && !(key in changes)) query.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export const CAMPAIGN_STATE: Record<Campaign["status"], { label: string; tone: Tone }> = {
  done: { label: "Finished", tone: "success" },
  paused: { label: "Stopped", tone: "warn" },
  sending: { label: "Not finished", tone: "warn" },
};

export type TabItem = { label: string; href: string; active: boolean; count?: number };

export function PillTabs({ label, tabs }: { label: string; tabs: TabItem[] }) {
  return (
    <nav aria-label={label} className="mb-3 flex gap-1 overflow-x-auto pb-1">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-[var(--adm-radius-sm)] px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${tab.active ? "bg-invert-bg text-invert-fg" : "bg-surface text-muted hover:text-fg"}`}
        >
          {tab.label}
          {tab.count === undefined ? null : <span className="text-xs tabular-nums opacity-75">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function LineTabs({ label, tabs }: { label: string; tabs: (TabItem & { icon: Icon })[] }) {
  return (
    <nav aria-label={label} className="mb-4 flex overflow-x-auto shadow-[inset_0_-1px_0_var(--line)]">
      {tabs.map(({ icon: Glyph, ...tab }) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex flex-none items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${tab.active ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
        >
          <Glyph size={14} aria-hidden="true" />
          {tab.label}
          {tab.count === undefined ? null : <span className="text-xs tabular-nums text-muted">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

const initialsOf = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "")).toUpperCase();
};

export const Avatar = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`adm-avatar ${className}`} aria-hidden="true">{initialsOf(name)}</span>
);

export const Person = ({ name, detail, href }: { name: string; detail: string; href: string }) => (
  <span className="flex min-w-0 items-center gap-2.5">
    <Avatar name={name} />
    <span className="min-w-0">
      <Link href={href} className="adm-link block">{name}</Link>
      <span className="block break-all text-xs text-muted">{detail}</span>
    </span>
  </span>
);

export function FilterSelect({ label, name, value, options, width = "sm:w-40" }: { label: string; name: string; value: string; options: [string, string][]; width?: string }) {
  return (
    <label className="grid min-w-0 flex-1 basis-[calc(50%-6px)] gap-1 text-xs text-muted sm:flex-none sm:basis-auto">
      {label}
      <select name={name} defaultValue={value} className={`${controlClass} ${width}`}>
        {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
      </select>
    </label>
  );
}

export const MoreFilters = ({ active, children }: { active: boolean; children: ReactNode }) => (
  <details open={active} className="group order-last basis-full">
    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
      <CaretDown size={12} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      More filters
    </summary>
    <div className="mt-3 flex flex-wrap items-end gap-3">{children}</div>
  </details>
);

export function FlushTable({ caption, head, right, minWidth, children }: { caption: string; head: string[]; right?: number; minWidth: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className={`adm-table ${minWidth}`} data-right={right}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{head.map((label) => <th key={label} scope="col">{label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const IconHeading = ({ icon: Glyph, children }: { icon: Icon; children: ReactNode }) => (
  <span className="flex items-center gap-2">
    <Glyph size={16} aria-hidden="true" className="text-muted" />
    {children}
  </span>
);

export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="adm-skeleton mb-4 h-4 w-24" />
      <div className="mb-6 flex items-start gap-4">
        <div className="adm-skeleton size-12 flex-none sm:size-16" />
        <div className="grid flex-1 gap-2">
          <div className="adm-skeleton h-7 w-56 max-w-full" />
          <div className="adm-skeleton h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="adm-skeleton mb-4 h-9 w-full max-w-md" />
      <div className="adm-grid-detail">
        <div className="adm-stack">
          {[0, 1].map((item) => <div key={item} className="adm-skeleton h-56" />)}
        </div>
        <div className="adm-stack">
          {[0, 1].map((item) => <div key={item} className="adm-skeleton h-36" />)}
        </div>
      </div>
    </div>
  );
}
