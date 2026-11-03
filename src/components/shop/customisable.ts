import { cache } from "react";
import { ownsStudioModel } from "@/lib/server/catalog";
import { db, schema } from "@/lib/server/db";

export const listCustomisable = cache(async () => {
  const rows = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(ownsStudioModel);
  return new Set(rows.map((row) => row.id));
});
