"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser, hitRateLimit } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { hasPurchased } from "@/lib/server/orders";

export type ReviewState = { ok?: boolean; error?: string };

const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(10).max(2000),
});

export async function postReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const user = await getUser();
  if (!user) return { error: "Sign in to leave a review." };

  const parsed = reviewSchema.safeParse({
    productId: form.get("productId"),
    rating: form.get("rating"),
    title: form.get("title"),
    body: form.get("body"),
  });
  if (!parsed.success) return { error: "Choose a rating, add a title, and write at least 10 characters." };

  const { productId, rating, title, body } = parsed.data;
  if (!(await hasPurchased(user.id, productId))) return { error: "Only customers who bought this piece can review it." };
  if (await hitRateLimit(`review:${user.id}`, 10, 3600)) return { error: "Too many attempts. Try again in an hour." };

  await db
    .insert(schema.reviews)
    .values({ productId, userId: user.id, rating, title, body })
    .onConflictDoUpdate({
      target: [schema.reviews.productId, schema.reviews.userId],
      set: { rating, title, body },
    });

  const [product] = await db
    .select({ slug: schema.products.slug })
    .from(schema.products)
    .where(eq(schema.products.id, productId));
  if (product) revalidatePath(`/product/${product.slug}`);
  return { ok: true };
}
