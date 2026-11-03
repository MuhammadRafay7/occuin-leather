"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOwnerKey, hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";

const { products, wishlistItems } = schema;

export async function toggleWishlist(productId: string) {
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { error: "We could not find that piece." };
  if (await hitRateLimit(`wishlist:ip:${await clientIp()}`, 120, 60)) return { error: "Too many changes. Try again in a minute." };
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
  revalidatePath("/wishlist");
  return { saved: !removed.length };
}
