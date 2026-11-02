import { CaretDown, DownloadSimple, Eye, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { StatGrid } from "../_components/ui";
import { MoreMenu } from "./more-menu";

type Href = ComponentProps<typeof Link>["href"];

export type FilterTab = { label: string; href: Href; count?: number; active: boolean };

export const StatStrip = ({ columns = 4, children }: { columns?: number; children: ReactNode }) => (
  <div className="mb-4"><StatGrid columns={columns}>{children}</StatGrid></div>
);

export function FilterTabs({ label, tabs, more = [], caption, className = "mb-3" }: { label: string; tabs: FilterTab[]; more?: FilterTab[]; caption?: string; className?: string }) {
  const chosen = more.find((tab) => tab.active);
  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      {caption ? <p className="shrink-0 pr-1 text-xs text-muted">{caption}</p> : null}
      <nav aria-label={label} className="flex min-w-0 gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {tabs.map((tab) => (
          <Link key={tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined} className={`shrink-0 ${tab.active ? "adm-btn" : "adm-btn adm-btn-ghost"}`}>
            {tab.label}
            {tab.count === undefined ? null : <span className="font-normal tabular-nums opacity-70">{tab.count}</span>}
          </Link>
        ))}
      </nav>
      {more.length ? (
        <MoreMenu label={chosen ? chosen.label : "More"}>
          {more.map((tab) => (
            <Link key={tab.label} href={tab.href} aria-current={tab.active ? "page" : undefined} className="adm-menu-item justify-between">
              {tab.label}
              {tab.count === undefined ? null : <span className="tabular-nums text-muted">{tab.count}</span>}
            </Link>
          ))}
        </MoreMenu>
      ) : null}
    </div>
  );
}

export function ActiveFilters({ count, clearHref }: { count: number; clearHref: string }) {
  if (!count) return null;
  return (
    <div className="adm-notice mb-3 flex items-center justify-between gap-2 text-xs" data-tone="plain">
      <p>{count === 1 ? "1 filter is on" : `${count} filters are on`}</p>
      <Link href={clearHref} className="inline-flex items-center gap-1 font-medium hover:underline">Clear filters <X size={12} aria-hidden="true" /></Link>
    </div>
  );
}

export function Reveal({ label, open = false, primary = false, icon, className = "", children }: { label: string; open?: boolean; primary?: boolean; icon?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <details open={open} className={`group ${className}`}>
      <summary className={`${primary ? "adm-btn adm-btn-primary" : "adm-btn"} list-none [&::-webkit-details-marker]:hidden`}>
        {icon ?? <CaretDown size={12} aria-hidden="true" className="transition-transform group-open:rotate-180" />}
        {label}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export const MenuDownload = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="adm-menu-item"><DownloadSimple size={14} aria-hidden="true" />{children}</a>
);

export const ViewLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} aria-label={label} className="adm-btn"><Eye size={14} aria-hidden="true" />View</Link>
);

export const DesktopOnly = ({ children }: { children: ReactNode }) => <div className="adm-only-desktop">{children}</div>;

export const MobileCards = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="adm-only-mobile">
    <ul aria-label={label} className="grid gap-2 sm:grid-cols-2">{children}</ul>
  </div>
);

export function MobileCard({ title, sub, chip, rows, children }: { title: ReactNode; sub?: ReactNode; chip?: ReactNode; rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <li className="adm-card grid content-start gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {sub ? <div className="text-xs text-muted [overflow-wrap:anywhere]">{sub}</div> : null}
        </div>
        {chip ? <div className="flex shrink-0 flex-col items-end gap-1">{chip}</div> : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 border-t border-line pt-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="min-w-0 tabular-nums [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="flex flex-wrap items-start gap-1 border-t border-line pt-2">{children}</div> : null}
    </li>
  );
}

const SkeletonLine = ({ className }: { className: string }) => <div className={`adm-skeleton ${className}`} />;

export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <SkeletonLine className="mb-2 h-3 w-16" />
      <SkeletonLine className="mb-2 h-6 w-44" />
      <SkeletonLine className="mb-5 h-4 w-60 max-w-full" />
      <div className="adm-grid-detail">
        <div className="adm-stack">
          {[0, 1].map((panel) => (
            <div key={panel} className="adm-card grid gap-3 p-3">
              <SkeletonLine className="h-4 w-28" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-11/12" />
              <SkeletonLine className="h-4 w-full" />
            </div>
          ))}
        </div>
        <div className="adm-stack">
          {[0, 1, 2].map((panel) => (
            <div key={panel} className="adm-card grid gap-3 p-3">
              <SkeletonLine className="h-4 w-20" />
              <SkeletonLine className="h-8 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
