"use server";

import { z } from "zod";
import { readBag, type BagView } from "@/components/product/bag-actions";
import { getOwnerKey } from "@/lib/server/auth";
import { getCart, setQuantity } from "@/lib/server/cart";
import { cartTooFast } from "@/lib/server/cart-rate";
import { suggestFor, toSuggestion, type SuggestedCard } from "@/lib/server/suggestions";
import { getProduct, listProducts } from "@/lib/server/catalog";

export type BagExtras = { shippingWaived: boolean; suggestions: SuggestedCard[] };

export type QuickViewProduct = {
  slug: string;
  name: string;
  description: string;
  categoryName: string;
  images: string[];
  variants: { id: string; color: string; size: string; priceCents: number; inStock: boolean }[];
};

const slugSchema = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/);
const lineSchema = z.object({ itemId: z.uuid(), quantity: z.number().int().min(0).max(10) });

export async function readBagExtras(): Promise<BagExtras> {
  const cart = await getCart(await getOwnerKey());
  return { shippingWaived: cart.shippingWaived, suggestions: await suggestFor(cart.lines) };
}

export async function updateBagLine(itemId: string, quantity: number): Promise<{ bag: BagView } | { error: string }> {
  const owner = await getOwnerKey();
  const parsed = lineSchema.safeParse({ itemId, quantity });
  if (!owner || !parsed.success) return { error: "We could not change that piece." };
  if (await cartTooFast(owner)) return { error: "Too many changes. Try again in a minute." };
  await setQuantity(owner, parsed.data.itemId, parsed.data.quantity);
  return { bag: await readBag() };
}

export async function readQuickView(slug: string): Promise<QuickViewProduct | null> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const product = await getProduct(parsed.data);
  if (!product) return null;
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    categoryName: product.categoryName,
    images: product.images.slice(0, 5),
    variants: product.variants.map((variant) => ({ id: variant.id, color: variant.color, size: variant.size, priceCents: variant.priceCents, inStock: variant.stock > 0 })),
  };
}

export async function readViewedCards(slugs: string[]): Promise<SuggestedCard[]> {
  const parsed = z.array(slugSchema).max(12).safeParse(slugs);
  if (!parsed.success || !parsed.data.length) return [];
  const cards = await listProducts();
  return parsed.data.flatMap((slug) => {
    const card = cards.find((item) => item.slug === slug);
    return card ? [toSuggestion(card)] : [];
  });
}
