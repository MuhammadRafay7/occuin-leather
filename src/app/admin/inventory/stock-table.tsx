"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { setStockInBulk } from "@/lib/actions/admin-catalog";
import { money } from "@/lib/format";
import { MoreInline, Thumb } from "../_components/catalog-ui";
import { useAction } from "../_components/controls";
import { buttonClass, controlClass, linkClass, Notice, primaryButtonClass, StatusDot, Table } from "../_components/ui";
import { STOCK_REASONS } from "./reasons";

type StockRow = { id: string; sku: string; color: string; size: string; priceCents: number; stock: number; productId: string; productName: string; productActive: boolean; productImage: string | null };

function StockState({ variant, lowStockLimit }: { variant: StockRow; lowStockLimit: number }) {
  if (variant.stock === 0) return <StatusDot tone="danger">Sold out</StatusDot>;
  if (variant.productActive && variant.stock <= lowStockLimit) return <StatusDot tone="warn">Running low</StatusDot>;
  return null;
}

function ProductLink({ variant }: { variant: StockRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link href={`/admin/products/${variant.productId}`} className={linkClass}>{variant.productName}</Link>
      {variant.productActive ? null : <StatusDot tone="muted">Hidden</StatusDot>}
    </span>
  );
}

export function StockTable({ rows, lowStockLimit }: { rows: StockRow[]; lowStockLimit: number }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<string>(STOCK_REASONS[0]);
  const [note, setNote] = useState("");
  const { pending, result, run } = useAction();

  const changed = rows.filter((row) => drafts[row.id] !== undefined && drafts[row.id]!.trim() !== String(row.stock));

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = changed.map((row) => ({ variantId: row.id, stock: drafts[row.id]!, expectedStock: row.stock }));
    run(() => setStockInBulk({ reason, note, rows: payload }), (outcome) => {
      if (!outcome.ok) return;
      setDrafts({});
      setNote("");
    });
  }

  const stockInput = (variant: StockRow) => (
    <input
      aria-label={`How many of ${variant.productName}, ${variant.color}, ${variant.size}`}
      inputMode="numeric"
      value={drafts[variant.id] ?? String(variant.stock)}
      onChange={(event) => setDrafts((current) => ({ ...current, [variant.id]: event.target.value }))}
      className={`${controlClass} !w-20 tabular-nums ${changed.includes(variant) ? "border-fg" : ""}`}
    />
  );

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3" noValidate>
      <div className="adm-card grid gap-2 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 gap-1 text-xs text-muted max-sm:w-full">
            Why are you changing the stock?
            <select value={reason} onChange={(event) => setReason(event.target.value)} className={`${controlClass} sm:!w-56`}>
              {STOCK_REASONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending || !changed.length} className={`${primaryButtonClass} max-sm:w-full`}>
            {pending ? "Saving" : changed.length ? `Save ${changed.length} ${changed.length === 1 ? "change" : "changes"}` : "Save"}
          </button>
        </div>
        <MoreInline label="Add a note">
          <label className="grid max-w-sm gap-1 text-xs text-muted">
            Note, optional
            <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} className={controlClass} />
          </label>
        </MoreInline>
      </div>
      <Notice result={result} />

      <ul className="grid gap-2 md:grid-cols-2 lg:hidden">
        {rows.map((variant) => (
          <li key={variant.id} className="adm-card grid gap-2 p-3">
            <div className="flex items-start gap-3">
              <Thumb src={variant.productImage} size={56} />
              <div className="grid min-w-0 gap-0.5">
                <ProductLink variant={variant} />
                <span className="text-xs text-muted">{variant.color}, {variant.size}, {money(variant.priceCents)}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
              {stockInput(variant)}
              <StockState variant={variant} lowStockLimit={lowStockLimit} />
              <Link href={`/admin/inventory/${variant.id}`} className={`${buttonClass} ml-auto`}>History</Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden lg:block">
        <Table caption="Inventory" head={["Product", "Option", "Price", "How many", "History"]} right={["Price", "History"]} minWidth="min-w-[720px]">
          {rows.map((variant) => (
            <tr key={variant.id}>
              <td>
                <div className="flex items-center gap-3">
                  <Thumb src={variant.productImage} />
                  <ProductLink variant={variant} />
                </div>
              </td>
              <td>{variant.color}, {variant.size}</td>
              <td className="tabular-nums">{money(variant.priceCents)}</td>
              <td>
                <div className="flex items-center gap-2">
                  {stockInput(variant)}
                  <StockState variant={variant} lowStockLimit={lowStockLimit} />
                </div>
              </td>
              <td><Link href={`/admin/inventory/${variant.id}`} className={buttonClass}>History</Link></td>
            </tr>
          ))}
        </Table>
      </div>
    </form>
  );
}
