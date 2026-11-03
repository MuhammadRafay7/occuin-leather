import { and, asc, eq, inArray } from "drizzle-orm";
import { cache } from "react";
import { colorKeyOf, type Candidate } from "@/lib/find-your-bag/match";
import { ownsStudioModel } from "@/lib/server/catalog";
import { db, schema } from "@/lib/server/db";
import { PRESETS, STARTING_POINTS, type PresetKey } from "@/lib/studio/presets";
import { designSpecSchema, normalizeSpec } from "@/lib/studio/spec";

const { categories, products, variants } = schema;

const presetKeyByName = new Map(
  (Object.entries(PRESETS) as [PresetKey, (typeof PRESETS)[PresetKey]][]).filter(([key]) => key !== "blank").map(([key, spec]) => [spec.name, key]),
);
const typeLabel = (key: PresetKey | undefined) => STARTING_POINTS.find((point) => point.key === key)?.label ?? null;

export const loadCandidates = cache(async (): Promise<Candidate[]> => {
  const rows = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .where(and(eq(products.active, true), ownsStudioModel));
  const options = rows.length
    ? await db.select().from(variants).where(inArray(variants.productId, rows.map((row) => row.product.id))).orderBy(asc(variants.sku))
    : [];

  return rows.flatMap(({ product, categoryName }): Candidate[] => {
    const parsed = designSpecSchema.safeParse(product.studioPreset ? normalizeSpec(product.studioPreset) : null);
    if (!parsed.success || parsed.data.name !== product.name) return [];
    const own = options.filter((variant) => variant.productId === product.id);
    const variant = own.find((option) => option.stock > 0) ?? own[0];
    const presetKey = presetKeyByName.get(product.name);
    return [
      {
        id: `product:${product.slug}`,
        slug: product.slug,
        name: product.name,
        type: typeLabel(presetKey) ?? categoryName,
        image: product.images[0] ?? null,
        spec: parsed.data,
        ready: variant
          ? { variantId: variant.id, color: colorKeyOf(variant.color), colorName: variant.color, priceCents: variant.priceCents, inStock: variant.stock > 0 }
          : null,
      },
    ];
  });
});
