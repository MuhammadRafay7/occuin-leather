import { CheckCircle, Package, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { FilterSelect, MoreFilters, MoreMenu, StatStrip } from "../_components/catalog-ui";
import { AdminTitle, buttonClass, Empty, Filters, MetricCard, Pagination, primaryButtonClass } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countProductsFiltered, listAllCategories, listProductsFiltered, PRODUCT_SORTS, type ProductQuery } from "../_lib/queries-catalog";
import { ProductsTable } from "./products-table";

export const metadata: Metadata = { title: "Products" };

const FILTER_OPTIONS = {
  status: [["", "Any status"], ["active", "In the store"], ["inactive", "Hidden"], ["featured", "Featured"]],
  department: [["", "All departments"], ["women", "Women"], ["men", "Men"], ["leather", "All leather"]],
  stock: [["", "Any stock"], ["in", "In stock"], ["low", "Running low"], ["out", "Sold out"]],
} as const;

const EVERYTHING: ProductQuery = { q: "", category: "", status: "", department: "", stock: "", sort: "" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const query = {
    q: param(search, "q"),
    category: param(search, "category"),
    status: param(search, "status"),
    department: param(search, "department"),
    stock: param(search, "stock"),
    sort: param(search, "sort"),
  };
  const [categories, total, catalogue, active, low, soldOut] = await Promise.all([
    listAllCategories(),
    countProductsFiltered(query),
    countProductsFiltered(EVERYTHING),
    countProductsFiltered({ ...EVERYTHING, status: "active" }),
    countProductsFiltered({ ...EVERYTHING, stock: "low" }),
    countProductsFiltered({ ...EVERYTHING, stock: "out" }),
  ]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listProductsFiltered(query, offset);
  const filtered = Boolean(query.q || query.category || query.status || query.department || query.stock);
  const newProduct = <Link href="/admin/products/new" className={primaryButtonClass}>New product</Link>;
  const actions = (
    <>
      {newProduct}
      <MoreMenu>
        <a href="/admin/products/export" className="adm-menu-item">Download product list</a>
        <Link href="/admin/products/import" className="adm-menu-item">Upload product list</Link>
      </MoreMenu>
    </>
  );

  return (
    <>
      <AdminTitle sub="Everything you sell, with its price and how many you have." action={actions}>Products</AdminTitle>
      <StatStrip>
        <MetricCard icon={<Package size={18} />} label="All products" value={catalogue} href="/admin/products" />
        <MetricCard icon={<CheckCircle size={18} />} label="In the store" value={active} description={`${catalogue - active} hidden`} href="/admin/products?status=active" />
        <MetricCard icon={<Warning size={18} />} label="Running low" value={low} href="/admin/products?stock=low" />
        <MetricCard icon={<XCircle size={18} />} label="Sold out" value={soldOut} href="/admin/products?stock=out" />
      </StatStrip>
      <Filters path="/admin/products" q={query.q} placeholder="Product name">
        <FilterSelect label="Status" name="status" value={query.status} options={FILTER_OPTIONS.status} />
        <FilterSelect label="Stock" name="stock" value={query.stock} options={FILTER_OPTIONS.stock} />
        <MoreFilters active={Boolean(query.category || query.department || query.sort)}>
          <FilterSelect label="Category" name="category" value={query.category} width="w-36" options={[["", "All categories"], ...categories.map((item): [string, string] => [item.slug, `${item.name}, ${item.department}`])]} />
          <FilterSelect label="Department" name="department" value={query.department} options={FILTER_OPTIONS.department} />
          <FilterSelect label="Sort" name="sort" value={query.sort} options={Object.entries(PRODUCT_SORTS).map(([key, sort]): [string, string] => [key === "newest" ? "" : key, sort.label])} />
        </MoreFilters>
      </Filters>

      {rows.length ? (
        <>
          <ProductsTable key={JSON.stringify(query)} rows={rows} total={total} query={query} />
          <Pagination path="/admin/products" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={filtered ? "No products match" : "No products yet"}
          body={filtered ? "Try other filters." : "Add your first product to see it here."}
          action={filtered ? <Link href="/admin/products" className={buttonClass}>Clear filters</Link> : newProduct}
        />
      )}
    </>
  );
}
