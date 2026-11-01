import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { param, type SearchParams } from "../_lib/format";

export const controlClass =
  "h-9 w-full rounded-none border border-line bg-bg px-2 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none";
export const textAreaClass =
  "w-full rounded-none border border-line bg-bg p-2 text-sm text-fg placeholder:text-muted focus:border-fg focus:outline-none";

const BUTTON = "inline-flex h-9 items-center justify-center whitespace-nowrap border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";
export const buttonClass = `${BUTTON} border-line text-fg hover:border-fg`;
export const primaryButtonClass = `${BUTTON} border-invert-bg bg-invert-bg text-invert-fg hover:opacity-85`;
export const linkClass = "underline underline-offset-4 hover:opacity-60";

export function AdminTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl leading-tight">{children}</h1>
        {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Table({ caption, head, minWidth = "min-w-[720px]", children }: { caption: string; head: string[]; minWidth?: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-line" role="region" aria-label={caption} tabIndex={0}>
      <table className={`w-full ${minWidth} border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top`}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface">
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted">{label}</th>
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
    <div className="border border-line px-4 py-8">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Filters({ path, q, placeholder, children }: { path: string; q?: string; placeholder?: string; children?: ReactNode }) {
  return (
    <Form action={path} className="mb-4 flex flex-wrap items-end gap-2">
      {placeholder ? (
        <label className="grid min-w-56 flex-1 gap-1 text-xs text-muted md:max-w-sm">
          Search
          <input name="q" type="search" defaultValue={q} placeholder={placeholder} className={controlClass} />
        </label>
      ) : null}
      {children}
      <button type="submit" className={buttonClass}>Apply</button>
      <Link href={path} className={`${buttonClass} border-transparent text-muted`}>Clear</Link>
    </Form>
  );
}

export function Pagination({ path, search, page, last, total }: { path: string; search: SearchParams; page: number; last: number; total: number }) {
  if (last <= 1) return <p className="mt-3 text-xs text-muted">{total} total</p>;
  const query = Object.fromEntries(Object.keys(search).map((key) => [key, param(search, key)]));
  const to = (target: number) => ({ pathname: path, query: { ...query, page: target } });
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center gap-3 text-sm">
      <span className="text-xs text-muted">Page {page} of {last}, {total} total</span>
      {page > 1 ? <Link href={to(page - 1)} className={linkClass}>Previous</Link> : null}
      {page < last ? <Link href={to(page + 1)} className={linkClass}>Next</Link> : null}
    </nav>
  );
}

export const StatusBadge = ({ status }: { status: OrderStatus }) => (
  <span className="inline-block whitespace-nowrap border border-line px-1.5 text-xs">{STATUS_LABELS[status]}</span>
);

export const Tag = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "danger" | "muted" }) => (
  <span className={`inline-block whitespace-nowrap border border-line px-1.5 text-xs ${tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted" : ""}`}>{children}</span>
);

export function Notice({ result, compact = false }: { result: { ok: boolean; message: string } | null; compact?: boolean }) {
  if (!result) return null;
  const tone = result.ok ? "text-fg" : "text-danger";
  return (
    <p role={result.ok ? "status" : "alert"} className={compact ? `text-xs ${tone}` : `border border-line bg-surface px-3 py-2 text-sm ${tone}`}>
      {result.message}
    </p>
  );
}
