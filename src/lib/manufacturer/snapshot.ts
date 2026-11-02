import type { BespokeDesign } from "../bespoke/design";
import type { DesignSpec } from "../studio/spec";

export type ProductSnapshot = {
  productId: string;
  slug: string;
  name: string;
  description: string;
  composition: string;
  category: string;
  sku: string;
  color: string;
  size: string;
  images: string[];
  studioPreset: DesignSpec | null;
  frozenAt: string;
  frozenLate?: boolean;
};

export type BespokeSnapshot = {
  requestId: string;
  reference: string;
  productType: string;
  notes: string;
  design: BespokeDesign;
  frozenAt: string;
  frozenLate?: boolean;
};

type ProductSource = { id: string; slug: string; name: string; description: string; composition: string; categorySlug: string; images: string[]; studioPreset: DesignSpec | null };
type VariantSource = { sku: string; color: string; size: string };
type BespokeSource = { id: string; productType: string; notes: string; design: BespokeDesign };

export const productSnapshotOf = (product: ProductSource, variant: VariantSource, now = new Date(), frozenLate = false): ProductSnapshot => ({
  productId: product.id,
  slug: product.slug,
  name: product.name,
  description: product.description,
  composition: product.composition,
  category: product.categorySlug,
  sku: variant.sku,
  color: variant.color,
  size: variant.size,
  images: [...product.images],
  studioPreset: product.studioPreset,
  frozenAt: now.toISOString(),
  ...(frozenLate ? { frozenLate } : {}),
});

export const bespokeSnapshotOf = (request: BespokeSource, reference: string, now = new Date(), frozenLate = false): BespokeSnapshot => ({
  requestId: request.id,
  reference,
  productType: request.productType,
  notes: request.notes,
  design: request.design,
  frozenAt: now.toISOString(),
  ...(frozenLate ? { frozenLate } : {}),
});
