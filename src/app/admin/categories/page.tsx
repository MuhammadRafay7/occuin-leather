import { FolderOpen, FolderSimple, Package, Stack } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { StatStrip } from "../_components/catalog-ui";
import { AdminTitle, Empty, MetricCard, Section, Table } from "../_components/ui";
import { listAllCategories } from "../_lib/queries-catalog";
import { CategoryForm } from "./category-form";
import { CategoryCard, CategoryRow } from "./category-row";

export const metadata: Metadata = { title: "Categories" };

const DEPARTMENTS = [
  { value: "leather", label: "All leather" },
  { value: "women", label: "Women" },
  { value: "men", label: "Men" },
] as const;

export default async function AdminCategories() {
  await requireAdmin();
  const categories = await listAllCategories();
  const filled = categories.filter((category) => category.productCount > 0).length;
  const products = categories.reduce((total, category) => total + category.productCount, 0);

  return (
    <>
      <AdminTitle sub="Groups that organise your products. A category shows in the store once it has a product on sale.">Categories</AdminTitle>
      <StatStrip>
        <MetricCard icon={<Stack size={18} />} label="All categories" value={categories.length} />
        <MetricCard icon={<FolderSimple size={18} />} label="With products" value={filled} />
        <MetricCard icon={<FolderOpen size={18} />} label="Empty" value={categories.length - filled} />
        <MetricCard icon={<Package size={18} />} label="Products" value={products} />
      </StatStrip>
      <CategoryForm />
      {categories.length ? (
        DEPARTMENTS.map(({ value, label }) => {
          const rows = categories.filter((category) => category.department === value);
          return (
            <Section key={value} title={label}>
              {rows.length ? (
                <>
                  <ul className="grid items-start gap-2 md:grid-cols-2 lg:hidden">
                    {rows.map((category, index) => (
                      <CategoryCard key={category.slug} category={category} first={index === 0} last={index === rows.length - 1} />
                    ))}
                  </ul>
                  <div className="hidden lg:block">
                    <Table caption={`${label} categories`} head={["Name", "Department", "Products", "Order", "Delete"]} right={["Products", "Delete"]} minWidth="min-w-[680px]">
                      {rows.map((category, index) => (
                        <CategoryRow key={category.slug} category={category} first={index === 0} last={index === rows.length - 1} />
                      ))}
                    </Table>
                  </div>
                </>
              ) : (
                <Empty title="No categories here" body="Move a category here or add one above." />
              )}
            </Section>
          );
        })
      ) : (
        <div className="mt-8"><Empty title="No categories yet" body="Add your first category above." /></div>
      )}
    </>
  );
}
