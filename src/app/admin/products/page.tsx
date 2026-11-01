import type { Metadata } from "next";
import Link from "next/link";
import { setProductActive } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/server/auth";
import { listCategories } from "@/lib/server/catalog";
import { ActionButton } from "../_components/controls";
import { AdminTitle, controlClass, Empty, Filters, linkClass, Pagination, primaryButtonClass, Table, Tag } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { countProducts, listProducts, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const q = param(search, "q");
  const category = param(search, "category");
  const [categories, total] = await Promise.all([listCategories(), countProducts(q, category)]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listProducts(q, category, offset);
  const newProduct = <Link href="/admin/products/new" className={primaryButtonClass}>New product</Link>;

  return (
    <>
      <AdminTitle action={newProduct}>Products</AdminTitle>
      <Filters path="/admin/products" q={q} placeholder="Name or slug">
        <label className="grid gap-1 text-xs text-muted">
          Category
          <select name="category" defaultValue={category} className={`${controlClass} w-48`}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}, {item.department}</option>
            ))}
          </select>
        </label>
      </Filters>

      {rows.length ? (
        <>
          <Table caption="Products" head={["Name", "Category", "Variants", "Stock", "Status", "Visibility"]}>
            {rows.map((product) => (
              <tr key={product.id}>
                <td>
                  <Link href={`/admin/products/${product.id}`} className={linkClass}>{product.name}</Link>
                  <span className="block text-xs text-muted">{product.slug}</span>
                </td>
                <td className="whitespace-nowrap">{product.categoryName}</td>
                <td className="tabular-nums">{product.variantCount}</td>
                <td>{product.stock === 0 ? <Tag tone="danger">Sold out</Tag> : <span className="tabular-nums">{product.stock}</span>}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Tag tone={product.active ? "plain" : "muted"}>{product.active ? "Active" : "Inactive"}</Tag>
                    {product.featured ? <Tag>Featured</Tag> : null}
                  </div>
                </td>
                <td>
                  <ActionButton action={setProductActive.bind(null, product.id, !product.active)}>
                    {product.active ? "Deactivate" : "Activate"}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/products" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={q || category ? "No products match" : "No products yet"}
          body={q || category ? "Try another search or category." : "Create the first product to see it here."}
          action={q || category ? undefined : newProduct}
        />
      )}
    </>
  );
}
