"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { hasPurchased } from "@/lib/server/orders";

export type ReviewAccess = "sign-in" | "buyers-only" | "post" | "update";
export type ProductVisitor = { saved: boolean; review: ReviewAccess };

const { reviews, wishlistItems } = schema;

async function isSaved(ownerKey: string | null, productId: string) {
  if (!ownerKey) return false;
  const rows = await db.select({ id: wishlistItems.productId }).from(wishlistItems).where(and(eq(wishlistItems.ownerKey, ownerKey), eq(wishlistItems.productId, productId)));
  return rows.length > 0;
}

async function reviewAccess(userId: string | undefined, productId: string): Promise<ReviewAccess> {
  if (!userId) return "sign-in";
  if (!(await hasPurchased(userId, productId))) return "buyers-only";
  const rows = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)));
  return rows.length ? "update" : "post";
}

export async function readProductVisitor(productId: string): Promise<ProductVisitor> {
  const parsed = z.uuid().safeParse(productId);
  if (!parsed.success) return { saved: false, review: "sign-in" };
  const [user, ownerKey] = await Promise.all([getUser(), getOwnerKey()]);
  const [saved, review] = await Promise.all([isSaved(ownerKey, parsed.data), reviewAccess(user?.id, parsed.data)]);
  return { saved, review };
}
