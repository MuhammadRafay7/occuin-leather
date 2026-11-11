import { ArrowDownRight, ArrowLeft, ArrowUpRight, Info, MagnifyingGlass, Minus, Tray } from "@phosphor-icons/react/dist/ssr";
import Form from "next/form";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { BespokeStatus } from "@/lib/bespoke/status";
import { BESPOKE_STATUS_LABELS } from "@/lib/bespoke/status";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { param, type SearchParams } from "../_lib/format";

export const controlClass = "adm-control";
export const textAreaClass = "adm-control";
export const buttonClass = "adm-btn";
export const primaryButtonClass = "adm-btn adm-btn-primary";
export const dangerButtonClass = "adm-btn adm-btn-danger";
export const ghostButtonClass = "adm-btn adm-btn-ghost";
export const linkClass = "adm-link";

export type Tone = "plain" | "danger" | "muted" | "success" | "warn";

const ORDER_TONES: Record<OrderStatus, Tone> = {
  pending: "warn",
  paid: "plain",
  in_production: "plain",
  shipped: "plain",
  delivered: "success",
  cancelled: "muted",
  refunded: "muted",
};

const BESPOKE_TONES: Record<BespokeStatus, Tone> = {
  question: "warn",
  new: "warn",
  quoted: "plain",
  changes_requested: "warn",
  accepted: "plain",
  declined: "muted",
  in_production: "plain",
  completed: "success",
};

export function AdminTitle({ children, sub, action, back, meta }: { children: ReactNode; sub?: ReactNode; action?: ReactNode; back?: { href: string; label: string }; meta?: ReactNode }) {
  return (
    <header className="adm-title">
      <div className="min-w-0">
        {back ? <Link href={back.href} className="adm-back"><ArrowLeft size={12} aria-hidden="true" />{back.label}</Link> : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1>{children}</h1>
          {meta}
        </div>
        {sub ? <p className="adm-title-sub">{sub}</p> : null}
      </div>
      {action ? <div className="adm-title-actions">{action}</div> : null}
    </header>
  );
}

export function Section({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="adm-section">
      <div className="adm-section-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const ContentGrid = ({ cols = 3, children }: { cols?: 1 | 2 | 3 | 4; children: ReactNode }) => (
  <div className="adm-grid" data-cols={cols}>{children}</div>
);

export const TableContainer = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="adm-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div>
);

export function Trend({ current, previous, label = "the 30 days before" }: { current: number; previous: number; label?: string }) {
  if (previous === 0 && current === 0) return <span className="adm-trend" data-dir="flat"><Minus size={12} aria-hidden="true" /> Same as {label}</span>;
  const change = previous === 0 ? 100 : ((current - previous) / previous) * 100;
  const up = change >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return <span className="adm-trend" data-dir={up ? "up" : "down"}><Arrow size={12} aria-hidden="true" /> {up ? "Up" : "Down"} {Math.abs(change).toFixed(0)}% on {label}</span>;
}

export const Help = ({ children }: { children: ReactNode }) => (
  <p className="adm-help"><Info size={14} aria-hidden="true" />{children}</p>
);

export function MetricCard({ label, value, icon, href, description, trend }: { label: string; value: ReactNode; icon?: ReactNode; href?: string; description?: string; trend?: ReactNode }) {
  const body = (
    <>
      <div className="adm-metric-top">
        <p className="adm-metric-label">{label}</p>
        {icon ? <span className="adm-metric-chip" aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="adm-metric-value">{value}</p>
      {trend ? <p className="mt-1">{trend}</p> : null}
      {description ? <p className="adm-metric-note truncate">{description}</p> : null}
    </>
  );
  return href ? <Link href={href} className="adm-metric adm-sheen">{body}</Link> : <div className="adm-metric adm-sheen">{body}</div>;
}

export function ChartCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="adm-chart-card adm-sheen">
      <div className="adm-chart-head">
        <div className="min-w-0">
          <h3>{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export const StatusDot = ({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) => (
  <span className="adm-tag" data-tone={tone} data-dot="true">{children}</span>
);

export function Panel({ title, action, children, flush = false, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={`adm-card ${className}`}>
      {title ? (
        <div className="adm-panel-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      {flush ? children : <div className="adm-panel-body">{children}</div>}
    </section>
  );
}

export const DetailGrid = ({ main, side }: { main: ReactNode; side: ReactNode }) => (
  <div className="adm-grid-detail">
    <div className="adm-stack">{main}</div>
    <aside className="adm-stack">{side}</aside>
  </div>
);

export const StatGrid = ({ columns = 4, children }: { columns?: number; children: ReactNode }) => (
  <div className="adm-stats" style={{ "--adm-stat-cols": columns } as CSSProperties}>{children}</div>
);

export function Pairs({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="adm-pairs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="adm-field">
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="adm-field-hint">{hint}</span> : null}
      {error ? <span role="alert" className="adm-field-error">{error}</span> : null}
    </label>
  );
}

export function Table({ caption, head, right = [], minWidth = "min-w-[720px]", children }: { caption: string; head: ReactNode[]; right?: string[]; minWidth?: string; children: ReactNode }) {
  const aligned = head.flatMap((label, index) => (typeof label === "string" && right.includes(label) ? [index + 1] : [])).join(" ");
  return (
    <div className="adm-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className={`adm-table ${minWidth}`} data-right={aligned || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((label, index) => (
              <th key={index} scope="col">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <Tray size={20} aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Filters({ path, q, placeholder, children }: { path: string; q?: string; placeholder?: string; children?: ReactNode }) {
  return (
    <Form action={path} className="adm-filters">
      {placeholder ? (
        <label className="grid min-w-44 flex-1 gap-1 text-xs text-muted md:max-w-xs">
          Search
          <span className="relative block">
            <MagnifyingGlass size={14} aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
            <input name="q" type="search" defaultValue={q} placeholder={placeholder} className={`${controlClass} pl-7`} />
          </span>
        </label>
      ) : null}
      {children}
      <span className="flex gap-1">
        <button type="submit" className={buttonClass}>Apply</button>
        <Link href={path} className={ghostButtonClass}>Clear</Link>
      </span>
    </Form>
  );
}

export function Pagination({ path, search, page, last, total }: { path: string; search: SearchParams; page: number; last: number; total: number }) {
  if (last <= 1) return <p className="mt-2 text-xs text-muted">{total} total</p>;
  const query = Object.fromEntries(Object.keys(search).map((key) => [key, param(search, key)]));
  const to = (target: number) => ({ pathname: path, query: { ...query, page: target } });
  return (
    <nav aria-label="Pagination" className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-muted">Page {page} of {last}, {total} total</span>
      <span className="flex gap-1">
        {page > 1 ? <Link href={to(page - 1)} className={buttonClass}>Previous</Link> : null}
        {page < last ? <Link href={to(page + 1)} className={buttonClass}>Next</Link> : null}
      </span>
    </nav>
  );
}

export const Tag = ({ children, tone = "plain" }: { children: ReactNode; tone?: Tone }) => (
  <span className="adm-tag" data-tone={tone}>{children}</span>
);

export const StatusBadge = ({ status }: { status: OrderStatus }) => <StatusDot tone={ORDER_TONES[status]}>{STATUS_LABELS[status]}</StatusDot>;

export const BespokeBadge = ({ status }: { status: BespokeStatus }) => <StatusDot tone={BESPOKE_TONES[status]}>{BESPOKE_STATUS_LABELS[status]}</StatusDot>;

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="adm-skeleton mb-2 h-8 w-64 max-w-full" />
      <div className="adm-skeleton mb-6 h-4 w-96 max-w-full" />
      <div className="adm-stats mb-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="adm-card p-6">
            <div className="adm-skeleton mb-4 size-10" />
            <div className="adm-skeleton mb-2 h-6 w-24" />
            <div className="adm-skeleton h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="adm-card mb-4 p-4">
        <div className="adm-skeleton mb-3 h-4 w-20" />
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2].map((item) => <div key={item} className="adm-skeleton h-10 w-40" />)}
        </div>
      </div>
      <div className="adm-card overflow-hidden">
        <div className="border-b border-line bg-surface p-4"><div className="adm-skeleton h-4 w-1/2 bg-line" /></div>
        <div className="divide-y divide-line">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="grid gap-2 p-4">
              <div className="adm-skeleton h-4" />
              <div className="adm-skeleton h-4 w-5/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <div className="adm-skeleton mb-2 h-8 w-64 max-w-full" />
      <div className="adm-skeleton mb-6 h-4 w-96 max-w-full" />
      <div className="adm-stack">
        {Array.from({ length: sections }, (_, section) => (
          <div key={section} className="adm-card grid gap-5 p-6">
            <div className="adm-skeleton h-5 w-40" />
            {[0, 1, 2].map((field) => (
              <div key={field} className="grid gap-2">
                <div className="adm-skeleton h-4 w-24" />
                <div className="adm-skeleton h-10 w-full" />
              </div>
            ))}
          </div>
        ))}
        <div className="adm-skeleton h-10 w-36" />
      </div>
    </div>
  );
}

export function Notice({ result, compact = false }: { result: { ok: boolean; message: string } | null; compact?: boolean }) {
  if (!result) return null;
  const role = result.ok ? "status" : "alert";
  if (compact) return <p role={role} className={`text-xs ${result.ok ? "text-muted" : "text-danger"}`}>{result.message}</p>;
  return <p role={role} className="adm-notice">{result.message}</p>;
}
