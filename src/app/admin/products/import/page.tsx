import type { Metadata } from "next";
import { CSV_COLUMNS } from "@/lib/catalog-import";
import { requireAdmin } from "@/lib/server/auth";
import { MoreInline } from "../../_components/catalog-ui";
import { AdminTitle, DetailGrid, linkClass, Panel } from "../../_components/ui";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Upload product list" };

export default async function ImportProducts() {
  await requireAdmin();
  return (
    <>
      <AdminTitle back={{ href: "/admin/products", label: "Products" }} sub="Change many products at once using a spreadsheet file.">Upload product list</AdminTitle>
      <DetailGrid
        main={<ImportForm />}
        side={
          <Panel title="How it works">
            <ol className="grid list-decimal gap-2 pl-4 text-muted">
              <li><a href="/admin/products/export" className={linkClass}>Download your product list</a>.</li>
              <li>Edit it in a spreadsheet and save it as a CSV file. Each row is one option of a product.</li>
              <li>Upload it here. You will see every change before anything is saved.</li>
            </ol>
            <p className="mt-2 text-muted">Nothing is ever deleted. Rows you leave out stay as they are.</p>
            <div className="mt-3">
              <MoreInline label="Advanced">
                <p className="break-words text-xs text-muted">Rows are matched by the sku column, and products by product_slug. Columns: {CSV_COLUMNS.join(", ")}.</p>
              </MoreInline>
            </div>
          </Panel>
        }
      />
    </>
  );
}
