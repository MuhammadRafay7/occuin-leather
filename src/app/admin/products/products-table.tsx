"use client";

import { X } from "@phosphor-icons/react";
import type { ProductQuery } from "../_lib/queries-catalog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { setProductActive } from "@/lib/actions/admin";
import { applyPriceChange, bulkUpdateProducts, deleteProduct, selectMatchingProducts, duplicateProduct, previewPriceChange, type BulkOperation, type DuplicateResult, type PriceLine, type PricePreview } from "@/lib/actions/admin-catalog";
import { money } from "@/lib/format";
import { MoreInline, Thumb } from "../_components/catalog-ui";
import { ConfirmButton } from "../_components/confirm-button";
import { ActionButton, useAction } from "../_components/controls";
import { buttonClass, controlClass, ghostButtonClass, linkClass, Notice, primaryButtonClass, StatusDot, Table } from "../_components/ui";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  featured: boolean;
  image: string | null;
  categoryName: string;
  variantCount: number;
  stock: number;
  priceLowCents: number;
  priceHighCents: number;
};

const BULK_BUTTONS: { operation: BulkOperation; label: string }[] = [
  { operation: "activate", label: "Show in store" },
  { operation: "deactivate", label: "Hide from store" },
  { operation: "feature", label: "Feature" },
  { operation: "unfeature", label: "Stop featuring" },
];
const PREVIEW_LIMIT = 50;

const priceRange = ({ priceLowCents: low, priceHighCents: high }: ProductRow) => (low === high ? money(low) : `${money(low)} to ${money(high)}`);

function PriceChange({ selected }: { selected: string[] }) {
  const [percent, setPercent] = useState("");
  const [lines, setLines] = useState<PriceLine[] | null>(null);
  const preview = useAction<PricePreview>();
  const apply = useAction();

  function showPreview(event: FormEvent) {
    event.preventDefault();
    setLines(null);
    apply.clear();
    preview.run(() => previewPriceChange(selected, percent), (outcome) => setLines(outcome.lines ?? null));
  }

  function confirm() {
    const expected = lines!.map(({ variantId, fromCents }) => ({ variantId, fromCents }));
    apply.run(() => applyPriceChange(selected, percent, expected), () => {
      setLines(null);
      preview.clear();
    });
  }

  return (
    <div className="grid gap-2">
      <form onSubmit={showPreview} className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted">
          Raise or lower prices by this percent
          <input value={percent} onChange={(event) => { setPercent(event.target.value); setLines(null); }} inputMode="text" placeholder="10 or -7.5" className={`${controlClass} w-32`} />
        </label>
        <button type="submit" disabled={preview.pending} className={buttonClass}>{preview.pending ? "Working" : "Show new prices"}</button>
      </form>
      <Notice result={preview.result} compact />
      <Notice result={apply.result} compact />
      {lines ? (
        <div className="grid gap-2">
          <Table caption="New prices" head={["Product", "Option", "Now", "New"]} minWidth="min-w-[480px]">
            {lines.slice(0, PREVIEW_LIMIT).map((line) => (
              <tr key={line.variantId}>
                <td>{line.productName}</td>
                <td>{line.label}</td>
                <td className="tabular-nums">{money(line.fromCents)}</td>
                <td className="tabular-nums">{money(line.toCents)}</td>
              </tr>
            ))}
          </Table>
          {lines.length > PREVIEW_LIMIT ? <p className="text-xs text-muted">Showing {PREVIEW_LIMIT} of {lines.length} prices.</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={apply.pending} onClick={confirm} className={primaryButtonClass}>{apply.pending ? "Saving" : `Change ${lines.length} ${lines.length === 1 ? "price" : "prices"}`}</button>
            <button type="button" disabled={apply.pending} onClick={() => setLines(null)} className={buttonClass}>Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BulkBar({ selected, onClear }: { selected: string[]; onClear: () => void }) {
  const { pending, result, run } = useAction();
  return (
    <div className="adm-card mb-2 grid gap-2 p-3" aria-label="Actions for selected products" role="group">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tabular-nums">{selected.length} selected</span>
        {BULK_BUTTONS.map(({ operation, label }) => (
          <button key={operation} type="button" disabled={pending} onClick={() => run(() => bulkUpdateProducts(selected, operation))} className={buttonClass}>{label}</button>
        ))}
        <button type="button" onClick={onClear} className={`${ghostButtonClass} ml-auto`}><X size={14} aria-hidden="true" />Clear selection</button>
      </div>
      <Notice result={result} compact />
      <MoreInline label="Change prices">
        <PriceChange selected={selected} />
      </MoreInline>
    </div>
  );
}

function RowActions({ product }: { product: ProductRow }) {
  const router = useRouter();
  const duplicate = useAction<DuplicateResult>();
  return (
    <div className="flex flex-wrap items-start gap-1 lg:justify-end">
      <Link href={`/admin/products/${product.id}`} className={buttonClass}>Edit</Link>
      <MoreInline>
        <div className="grid justify-items-start gap-1 lg:justify-items-end">
          {product.active ? <Link href={`/product/${product.slug}`} target="_blank" className={buttonClass}>View in store</Link> : null}
          <ActionButton action={() => setProductActive(product.id, !product.active)}>{product.active ? "Hide from store" : "Show in store"}</ActionButton>
          <button type="button" disabled={duplicate.pending} onClick={() => duplicate.run(() => duplicateProduct(product.id), (outcome) => { if (outcome.id) router.push(`/admin/products/${outcome.id}`); })} className={buttonClass}>
            {duplicate.pending ? "Copying" : "Make a copy"}
          </button>
          {duplicate.result && !duplicate.result.ok ? <Notice result={duplicate.result} compact /> : null}
          <ConfirmButton
            action={() => deleteProduct(product.id)}
            prompt={`Delete ${product.name}? Its reviews go too, and it leaves customers' bags. If someone has ordered it, it is hidden instead so your order records stay complete.`}
            confirmLabel="Yes, delete"
          >
            Delete
          </ConfirmButton>
        </div>
      </MoreInline>
    </div>
  );
}

function StatusChips({ product }: { product: ProductRow }) {
  return (
    <div className="flex flex-wrap gap-1">
      <StatusDot tone={product.active ? "success" : "muted"}>{product.active ? "In the store" : "Hidden"}</StatusDot>
      {product.featured ? <StatusDot>Featured</StatusDot> : null}
    </div>
  );
}

function StockCell({ product }: { product: ProductRow }) {
  return (
    <>
      {product.stock === 0 ? <StatusDot tone="danger">Sold out</StatusDot> : <span className="block tabular-nums">{product.stock}</span>}
      <span className="block text-xs text-muted">{product.variantCount} {product.variantCount === 1 ? "option" : "options"}</span>
    </>
  );
}

function ProductName({ product }: { product: ProductRow }) {
  return (
    <div className="min-w-0">
      <Link href={`/admin/products/${product.id}`} className={`${linkClass} block truncate`}>{product.name}</Link>
      <span className="block truncate text-xs text-muted">{product.categoryName}</span>
    </div>
  );
}

function ProductCard({ product, checked, onToggle }: { product: ProductRow; checked: boolean; onToggle: (on: boolean) => void }) {
  return (
    <li className="adm-card grid gap-3 p-3">
      <div className="flex items-start gap-3">
        <input type="checkbox" aria-label={`Select ${product.name}`} checked={checked} onChange={(event) => onToggle(event.target.checked)} className="mt-1 block shrink-0" />
        <Thumb src={product.image} size={56} />
        <ProductName product={product} />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div>
          <dt className="text-xs text-muted">Price</dt>
          <dd className="tabular-nums">{priceRange(product)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">In stock</dt>
          <dd><StockCell product={product} /></dd>
        </div>
        <div className="col-span-2">
          <dt className="sr-only">Status</dt>
          <dd><StatusChips product={product} /></dd>
        </div>
      </dl>
      <RowActions product={product} />
    </li>
  );
}

export function ProductsTable({ rows, total, query }: { rows: ProductRow[]; total: number; query: ProductQuery }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [matching, setMatching] = useState<string[] | null>(null);
  const visible = selected.filter((id) => rows.some((row) => row.id === id));
  const allSelected = visible.length === rows.length;
  const clear = () => {
    setSelected([]);
    setMatching(null);
  };
  const toggle = (id: string, on: boolean) => {
    setMatching(null);
    setSelected(on ? [...visible, id] : visible.filter((item) => item !== id));
  };
  const toggleAll = (on: boolean) => {
    setMatching(null);
    setSelected(on ? rows.map((row) => row.id) : []);
  };

  return (
    <>
      {matching || visible.length ? <BulkBar selected={matching ?? visible} onClear={clear} /> : null}
      {allSelected && !matching && total > rows.length ? (
        <button type="button" onClick={async () => setMatching(await selectMatchingProducts(query))} className={`mb-2 text-sm ${linkClass}`}>
          Select all {total} matching products{total > 200 ? " (first 200)" : ""}
        </button>
      ) : null}

      <div className="lg:hidden">
        <label className="adm-check mb-2 px-1">
          <input type="checkbox" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
          Select all on this page
        </label>
        <ul className="grid items-start gap-2 md:grid-cols-2">
          {rows.map((product) => (
            <ProductCard key={product.id} product={product} checked={visible.includes(product.id)} onToggle={(on) => toggle(product.id, on)} />
          ))}
        </ul>
      </div>

      <div className="hidden lg:block">
        <Table
          caption="Products"
          head={[
            <input key="all" type="checkbox" aria-label="Select all on this page" checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} className="block" />,
            "Product",
            "Price",
            "In stock",
            "Status",
            "Actions",
          ]}
          right={["Price", "In stock", "Actions"]}
          minWidth="min-w-[760px]"
        >
          {rows.map((product) => (
            <tr key={product.id}>
              <td className="w-9 align-top">
                <input type="checkbox" aria-label={`Select ${product.name}`} checked={visible.includes(product.id)} onChange={(event) => toggle(product.id, event.target.checked)} className="block" />
              </td>
              <td className="max-w-80 align-top">
                <div className="flex items-center gap-3">
                  <Thumb src={product.image} />
                  <ProductName product={product} />
                </div>
              </td>
              <td className="whitespace-nowrap align-top tabular-nums">{priceRange(product)}</td>
              <td className="whitespace-nowrap align-top"><StockCell product={product} /></td>
              <td className="align-top"><StatusChips product={product} /></td>
              <td className="w-44 align-top"><RowActions product={product} /></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
