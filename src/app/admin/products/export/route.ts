import { CSV_COLUMNS } from "@/lib/catalog-import";
import { csvLine } from "@/lib/csv";
import { requireAdmin } from "@/lib/server/auth";
import { exportRows } from "../../_lib/queries-catalog";

export async function GET() {
  await requireAdmin();
  const rows = await exportRows();
  const lines = rows.map(({ product, variant }) =>
    csvLine([
      product.slug,
      product.name,
      product.description,
      product.composition,
      product.categorySlug,
      product.images.join("|"),
      product.audiences.join("|"),
      String(product.featured),
      String(product.active),
      variant.sku,
      variant.color,
      variant.size,
      (variant.priceCents / 100).toFixed(2),
      String(variant.stock),
    ]),
  );
  return new Response(`﻿${[csvLine([...CSV_COLUMNS]), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="occuin-products.csv"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
