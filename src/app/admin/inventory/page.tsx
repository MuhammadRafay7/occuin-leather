import { Cube, Stack, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { FilterSelect, StatStrip } from "../_components/catalog-ui";
import { AdminTitle, buttonClass, Empty, Filters, MetricCard, Pagination } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countStock, listStock } from "../_lib/queries-catalog";
import { unitsInStock } from "../_lib/queries-catalog-stats";
import { StockTable } from "./stock-table";

export const metadata: Metadata = { title: "Stock" };

const STOCK_OPTIONS = [["", "Everything"], ["low", "Running low"], ["out", "Sold out"]] as const;

export default async function AdminInventory({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const { lowStockLimit } = await getSettings();
  const stock = param(search, "low") === "1" ? "low" : param(search, "stock");
  const q = param(search, "q");
  const [total, allOptions, low, soldOut, units] = await Promise.all([countStock(stock, q), countStock("", ""), countStock("low", ""), countStock("out", ""), unitsInStock()]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listStock(stock, q, offset);
  const filtered = Boolean(stock || q);

  return (
    <>
      <AdminTitle sub="How many of each piece you have. Change a number, then press Save.">Stock</AdminTitle>
      <StatStrip>
        <MetricCard icon={<Stack size={18} />} label="All options" value={allOptions} href="/admin/inventory" />
        <MetricCard icon={<Cube size={18} />} label="Pieces in stock" value={units} />
        <MetricCard icon={<Warning size={18} />} label="Running low" value={low} description={`${lowStockLimit} or fewer left`} href="/admin/inventory?stock=low" />
        <MetricCard icon={<XCircle size={18} />} label="Sold out" value={soldOut} href="/admin/inventory?stock=out" />
      </StatStrip>
      <Filters path="/admin/inventory" q={q} placeholder="Product name or code">
        <FilterSelect label="Show" name="stock" value={stock} width="w-36" options={STOCK_OPTIONS} />
      </Filters>

      {rows.length ? (
        <>
          <StockTable rows={rows} lowStockLimit={lowStockLimit} />
          <Pagination path="/admin/inventory" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={filtered ? "Nothing matches" : "Nothing here yet"}
          body={filtered ? "Try other filters." : "Stock shows here once a product has options."}
          action={filtered ? <Link href="/admin/inventory" className={buttonClass}>Clear filters</Link> : undefined}
        />
      )}
    </>
  );
}
