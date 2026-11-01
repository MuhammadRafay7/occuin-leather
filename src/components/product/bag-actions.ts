"use server";

import { addToBag } from "@/lib/actions/cart";
import { getOwnerKey } from "@/lib/server/auth";
import { getCart, type CartLine } from "@/lib/server/cart";
import { getProduct } from "@/lib/server/catalog";

export type BagView = { lines: CartLine[]; count: number; subtotalCents: number; discountCents: number };

export async function readBag(): Promise<BagView> {
  const { lines, count, subtotalCents, discountCents } = await getCart(await getOwnerKey());
  return { lines, count, subtotalCents, discountCents };
}

export async function addAndReadBag(slug: string, choice: { variantId?: string; size?: string }) {
  const product = await getProduct(slug);
  const variant = product?.variants.find((option) =>
    choice.variantId ? option.id === choice.variantId : option.stock > 0 && (!choice.size || option.size === choice.size),
  );
  if (!variant) return { error: "This size is sold out." };

  const result = await addToBag(variant.id);
  if ("error" in result && result.error) return { error: result.error };

  const bag = await readBag();
  const line = bag.lines.find((item) => item.href === `/product/${slug}` && item.detail === `${variant.color}, ${variant.size}`);
  return { bag, addedId: line?.id ?? null };
}
