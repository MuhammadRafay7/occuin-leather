import type { Metadata } from "next";
import Link from "next/link";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, Empty, Filters, linkClass, Pagination, Table, Tag } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { countVariants, listVariants, LOW_STOCK_LIMIT, pageOf } from "../_lib/queries";
import { StockForm } from "./stock-form";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventory({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const low = param(search, "low") === "1";
  const q = param(search, "q");
  const total = await countVariants(low, q);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listVariants({ low, q, offset });

  return (
    <>
      <AdminTitle sub={`Low stock means ${LOW_STOCK_LIMIT} or fewer on an active product.`}>Inventory</AdminTitle>
      <Filters path="/admin/inventory" q={q} placeholder="Product or SKU">
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={low} className="size-4 accent-[var(--fg)]" />
          Low stock only
        </label>
      </Filters>

      {rows.length ? (
        <>
          <Table caption="Inventory" head={["Product", "SKU", "Colour", "Size", "Price", "Stock"]} minWidth="min-w-[820px]">
            {rows.map((variant) => (
              <tr key={variant.id}>
                <td>
                  <Link href={`/admin/products/${variant.productId}`} className={linkClass}>{variant.productName}</Link>
                  {variant.productActive ? null : <span className="ml-2"><Tag tone="muted">Inactive</Tag></span>}
                </td>
                <td className="whitespace-nowrap">{variant.sku}</td>
                <td>{variant.color}</td>
                <td>{variant.size}</td>
                <td className="tabular-nums">{money(variant.priceCents)}</td>
                <td><StockForm variantId={variant.id} sku={variant.sku} stock={variant.stock} /></td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/inventory" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={low || q ? "Nothing matches" : "No variants yet"}
          body={low || q ? "No variant fits these filters." : "Variants appear here once a product has them."}
        />
      )}
    </>
  );
}
