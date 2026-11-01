import { isNotNull } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/server/db";

export const listCustomisable = cache(async () => {
  const rows = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(isNotNull(schema.products.studioPreset));
  return new Set(rows.map((row) => row.id));
});
