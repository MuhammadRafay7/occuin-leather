"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOwnerKey } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

const { products, wishlistItems } = schema;

export async function toggleWishlist(productId: string) {
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { error: "We could not find that piece." };
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.id, parsed.data));
  if (!product) return { error: "We could not find that piece." };

  const ownerKey = await ensureOwnerKey();
  const removed = await db
    .delete(wishlistItems)
    .where(and(eq(wishlistItems.ownerKey, ownerKey), eq(wishlistItems.productId, product.id)))
    .returning({ productId: wishlistItems.productId });
  if (!removed.length) {
    await db.insert(wishlistItems).values({ ownerKey, productId: product.id }).onConflictDoNothing();
  }
  revalidatePath("/", "layout");
  return { saved: !removed.length };
}
