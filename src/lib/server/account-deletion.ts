import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "./db";

const { bespokeDesigns, bespokeLogos, bespokeMessages, bespokeRequestImages, bespokeRequests, bespokeTokens, carts, contactMessages, designs, newsletterSubscribers, orders, users, wishlistItems } = schema;


export async function eraseAccount(user: { id: string; email: string }) {
  const owner = `u:${user.id}`;
  return db.transaction(async (tx) => {
    const mine = or(eq(bespokeRequests.ownerKey, owner), eq(bespokeRequests.acceptedOwnerKey, owner));
    const openOrders = await tx.$count(orders, and(eq(orders.ownerKey, owner), inArray(orders.status, ["pending", "paid", "in_production", "shipped"])));
    const openBespoke = await tx.$count(bespokeRequests, and(mine, inArray(bespokeRequests.status, ["accepted", "in_production"])));
    if (openOrders || openBespoke) return false;

    await tx.update(orders).set({ ownerKey: `deleted:${randomUUID()}` }).where(eq(orders.ownerKey, owner));

    const kept = await tx
      .select({ id: bespokeRequests.id })
      .from(bespokeRequests)
      .where(and(mine, or(isNotNull(bespokeRequests.orderId), isNotNull(bespokeRequests.balanceOrderId))));
    for (const { id } of kept) {
      await tx.delete(bespokeTokens).where(eq(bespokeTokens.requestId, id));
      await tx.delete(bespokeMessages).where(eq(bespokeMessages.requestId, id));
      await tx.delete(bespokeRequestImages).where(eq(bespokeRequestImages.requestId, id));
      await tx
        .update(bespokeRequests)
        .set({ ownerKey: null, acceptedOwnerKey: null, name: "Deleted customer", email: `deleted-${id}@deleted.invalid`, phone: null, notes: "", changeMessage: null, adminNote: "", updatedAt: new Date() })
        .where(eq(bespokeRequests.id, id));
    }
    await tx.delete(bespokeRequests).where(and(mine, isNull(bespokeRequests.orderId), isNull(bespokeRequests.balanceOrderId)));

    await tx.delete(designs).where(eq(designs.ownerKey, owner));
    await tx.delete(bespokeDesigns).where(eq(bespokeDesigns.ownerKey, owner));
    await tx.delete(bespokeLogos).where(eq(bespokeLogos.ownerKey, owner));
    await tx.delete(wishlistItems).where(eq(wishlistItems.ownerKey, owner));
    await tx.delete(carts).where(eq(carts.ownerKey, owner));
    await tx.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, user.email.toLowerCase()));
    await tx.delete(contactMessages).where(eq(contactMessages.email, user.email.toLowerCase()));
    await tx.delete(users).where(eq(users.id, user.id));
    return true;
  });
}
