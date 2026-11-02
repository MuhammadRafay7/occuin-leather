import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { salesSummary } from "@/app/admin/_lib/queries-orders";
import { addBespoke } from "@/lib/server/cart";
import { db, schema } from "@/lib/server/db";
import { expireUnpaidOrders, getOrder, markPaid, moveOrder, placeOrder, type CheckoutResult } from "@/lib/server/orders";

const { bespokeRequests, cartItems, carts, categories, orders, products, promoCodes, stockMovements, variants } = schema;
const RATES = { freeShippingCents: 1_000_000, standardShippingCents: 1_800, expressShippingCents: 3_800 };
const ADDRESS = { name: "Flow Test", line1: "1 Test Road", city: "Lahore", postalCode: "54000", country: "PK", phone: "+92 300 1234567" };
const STOCK = 10;
const PRICE = 10_000;
const DAY_MS = 86_400_000;

const tag = randomUUID().slice(0, 8);
const promoCode = `WAFLOW${tag}`.toUpperCase();
const owners: string[] = [];
const orderIds: string[] = [];
const requestIds: string[] = [];
let variantId: string;
let productId: string;
let categorySlug: string;

const newOwner = () => {
  const owner = `g:whatsapp-flow-${randomUUID()}`;
  owners.push(owner);
  return owner;
};

async function bag(owner: string, quantity = 1, promo: string | null = null) {
  const [cart] = await db.insert(carts).values({ ownerKey: owner, promoCode: promo }).onConflictDoUpdate({ target: carts.ownerKey, set: { promoCode: promo } }).returning();
  await db.insert(cartItems).values({ cartId: cart!.id, variantId, quantity });
  return cart!.id;
}

async function place(owner: string, payment: "whatsapp" | "stripe" = "whatsapp"): Promise<CheckoutResult> {
  const result = await placeOrder({ ownerKey: owner, email: `${owner.slice(-12)}@example.com`, address: ADDRESS, method: "standard", rates: RATES, payment });
  if ("orderId" in result) orderIds.push(result.orderId);
  return result;
}

async function placed(owner: string) {
  const result = await place(owner);
  if ("error" in result) throw new Error(result.error);
  return result.orderId;
}

const stock = async () => (await db.select({ stock: variants.stock }).from(variants).where(eq(variants.id, variantId)))[0]!.stock;
const orderOf = async (id: string) => (await getOrder(id))!;
const itemsIn = (cartId: string) => db.$count(cartItems, eq(cartItems.cartId, cartId));
const timesUsed = async () => (await db.select({ timesUsed: promoCodes.timesUsed }).from(promoCodes).where(eq(promoCodes.code, promoCode)))[0]!.timesUsed;

async function bespoke(owner: string, values: Partial<typeof bespokeRequests.$inferInsert> = {}) {
  const [request] = await db
    .insert(bespokeRequests)
    .values({
      ownerKey: owner,
      acceptedOwnerKey: owner,
      name: "Flow Test",
      email: "flow@example.com",
      country: "PK",
      productType: "tote",
      design: { version: 1, name: "Flow tote", productType: "tote", depth: 100, metal: "brass", closure: "", lining: "black", notes: "", bodyId: null, pieces: [] } as never,
      estimateLowCents: 10_000,
      estimateHighCents: 20_000,
      status: "accepted",
      quotedPriceCents: 40_000,
      depositPercent: 50,
      quoteExpiresAt: new Date(Date.now() + 30 * DAY_MS),
      ...values,
    })
    .returning();
  requestIds.push(request!.id);
  return request!;
}

const requestOf = async (id: string) => (await db.select().from(bespokeRequests).where(eq(bespokeRequests.id, id)))[0]!;

describe.skipIf(!process.env.DATABASE_URL)("WhatsApp order flow", () => {
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const [category] = await db.select({ slug: categories.slug }).from(categories).limit(1);
    categorySlug = category!.slug;
    const [product] = await db.insert(products).values({ slug: `whatsapp-flow-${tag}`, name: "Flow bag", description: "Test", composition: "Test", categorySlug, images: ["/images/test.jpg"] }).returning();
    productId = product!.id;
    const [variant] = await db.insert(variants).values({ productId, sku: `WA-FLOW-${tag}`, color: "Brown", size: "One size", priceCents: PRICE, stock: STOCK }).returning();
    variantId = variant!.id;
    await db.insert(promoCodes).values({ code: promoCode, percentOff: 10, maxUses: 1 });
  });

  afterEach(() => vi.unstubAllEnvs());

  afterAll(async () => {
    if (requestIds.length) await db.update(bespokeRequests).set({ orderId: null, balanceOrderId: null }).where(inArray(bespokeRequests.id, requestIds));
    if (orderIds.length) await db.delete(orders).where(inArray(orders.id, orderIds));
    if (requestIds.length) await db.delete(bespokeRequests).where(inArray(bespokeRequests.id, requestIds));
    await db.delete(carts).where(inArray(carts.ownerKey, owners));
    await db.delete(stockMovements).where(eq(stockMovements.variantId, variantId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(promoCodes).where(eq(promoCodes.code, promoCode));
  });

  it("saves a pending order, holds stock, reserves the promo and empties the bag", async () => {
    const owner = newOwner();
    const cartId = await bag(owner, 2, promoCode);
    const before = await stock();
    const result = await place(owner);
    expect("redirectUrl" in result && result.redirectUrl).toMatch(/^\/orders\/.+\?placed=1$/);
    const order = await orderOf((result as { orderId: string }).orderId);
    expect(order.status).toBe("pending");
    expect(order.paymentMethod).toBe("whatsapp");
    expect(order.shippingAddress?.phone).toBe(ADDRESS.phone);
    expect(order.subtotalCents).toBe(2 * PRICE);
    expect(order.discountCents).toBe(2_000);
    expect(order.shippingCents).toBe(1_800);
    expect(order.totalCents).toBe(19_800);
    expect(order.items[0]).toMatchObject({ name: "Flow bag", detail: "Brown, One size", quantity: 2 });
    expect(await stock()).toBe(before - 2);
    expect(await itemsIn(cartId)).toBe(0);

    const rival = newOwner();
    await bag(rival, 1, promoCode);
    const refused = await place(rival);
    expect(refused).toEqual({ error: expect.stringMatching(/code/) });

    await db.delete(carts).where(eq(carts.ownerKey, rival));
    expect((await moveOrder(order.id, "cancelled")).ok).toBe(true);
    expect(await stock()).toBe(before);
    const again = newOwner();
    await bag(again, 1, promoCode);
    const retaken = await placed(again);
    expect((await orderOf(retaken)).promoCode).toBe(promoCode);
    await moveOrder(retaken, "cancelled");
  });

  it("never marks a WhatsApp order paid on its own, with demo payments on or in production", async () => {
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    const owner = newOwner();
    await bag(owner);
    const demoOrder = await placed(owner);
    expect((await orderOf(demoOrder)).status).toBe("pending");

    vi.stubEnv("NODE_ENV", "production");
    const prod = newOwner();
    await bag(prod);
    const prodOrder = await placed(prod);
    expect((await orderOf(prodOrder)).status).toBe("pending");
    await moveOrder(demoOrder, "cancelled");
    await moveOrder(prodOrder, "cancelled");
  });

  it("keeps Stripe mode working as before", async () => {
    vi.stubEnv("ALLOW_DEMO_PAYMENTS", "true");
    const owner = newOwner();
    await bag(owner);
    const result = await place(owner, "stripe");
    const order = await orderOf((result as { orderId: string }).orderId);
    expect(order.paymentMethod).toBe("stripe");
    expect(order.status).toBe("paid");
    expect(order.shippingAddress?.phone).toBe(ADDRESS.phone);

    vi.stubEnv("NODE_ENV", "production");
    const blocked = newOwner();
    await bag(blocked);
    expect(await place(blocked, "stripe")).toEqual({ error: "Card payments are not available right now." });
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
    await db.update(variants).set({ stock: STOCK }).where(eq(variants.id, variantId));
  });

  it("marks paid once, keeps the note, counts the promo and leaves a new bag alone", async () => {
    const owner = newOwner();
    await bag(owner);
    const orderId = await placed(owner);
    const newCart = await bag(owner, 1);
    expect(await markPaid(orderId, null, "Marked as paid. Bank transfer")).toBe(true);
    expect(await markPaid(orderId, null)).toBe(false);
    const order = await orderOf(orderId);
    expect(order.status).toBe("paid");
    expect(order.events.at(-1)?.note).toBe("Marked as paid. Bank transfer");
    expect(await itemsIn(newCart)).toBe(1);
    await db.delete(cartItems).where(eq(cartItems.cartId, newCart));
  });

  it("increments promo use only when paid", async () => {
    await db.update(promoCodes).set({ maxUses: null, timesUsed: 0 }).where(eq(promoCodes.code, promoCode));
    const owner = newOwner();
    await bag(owner, 1, promoCode);
    const orderId = await placed(owner);
    expect(await timesUsed()).toBe(0);
    await markPaid(orderId, null);
    expect(await timesUsed()).toBe(1);
  });

  it("leaves unpaid orders out of revenue until they are paid", async () => {
    const from = new Date(Date.now() - DAY_MS);
    const end = new Date(Date.now() + DAY_MS);
    const before = await salesSummary(from, end);
    const owner = newOwner();
    await bag(owner);
    const orderId = await placed(owner);
    const pending = await salesSummary(from, end);
    expect(pending.grossCents).toBe(before.grossCents);
    expect(pending.orders).toBe(before.orders);
    await markPaid(orderId, null);
    expect((await salesSummary(from, end)).grossCents).toBe(before.grossCents + (await orderOf(orderId)).totalCents);
  });

  it("limits how many unpaid orders one customer can hold", async () => {
    const owner = newOwner();
    const held: string[] = [];
    for (let count = 0; count < 3; count += 1) {
      await bag(owner);
      held.push(await placed(owner));
    }
    await bag(owner);
    expect(await place(owner)).toEqual({ error: expect.stringMatching(/unpaid orders/) });
    for (const id of held) await moveOrder(id, "cancelled");
    expect("orderId" in (await place(owner))).toBe(true);
    await moveOrder(orderIds.at(-1)!, "cancelled");
  });

  it("auto cancels overdue WhatsApp orders once, and only those", async () => {
    await db.update(orders).set({ promoCode: null }).where(inArray(orders.id, orderIds));
    await db.update(promoCodes).set({ maxUses: 1, timesUsed: 0 }).where(eq(promoCodes.code, promoCode));
    const owner = newOwner();
    await bag(owner, 2, promoCode);
    const before = await stock();
    const overdue = await placed(owner);
    const freshOwner = newOwner();
    await bag(freshOwner);
    const fresh = await placed(freshOwner);
    const cardOwner = newOwner();
    await bag(cardOwner);
    const [card] = await db.insert(orders).values({ ownerKey: cardOwner, subtotalCents: 1, totalCents: 1, status: "pending", createdAt: new Date(Date.now() - 30 * DAY_MS) }).returning();
    orderIds.push(card!.id);
    await db.update(orders).set({ createdAt: new Date(Date.now() - 8 * DAY_MS) }).where(eq(orders.id, overdue));

    await Promise.all([expireUnpaidOrders(), expireUnpaidOrders()]);
    await expireUnpaidOrders();

    expect((await orderOf(overdue)).status).toBe("cancelled");
    expect((await orderOf(overdue)).events.at(-1)?.note).toMatch(/not paid within 7 days/);
    expect((await orderOf(fresh)).status).toBe("pending");
    expect((await orderOf(card!.id)).status).toBe("pending");
    expect(await stock()).toBe(before - 1);

    const next = newOwner();
    await bag(next, 1, promoCode);
    const reused = await placed(next);
    expect((await orderOf(reused)).promoCode).toBe(promoCode);
    await moveOrder(reused, "cancelled");
    await moveOrder(fresh, "cancelled");
    await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, card!.id));
  });

  it("takes a bespoke deposit through a pending order and records it when paid", async () => {
    const owner = newOwner();
    const request = await bespoke(owner);
    await addBespoke(owner, request.id);
    const orderId = await placed(owner);
    const order = await orderOf(orderId);
    expect(order.status).toBe("pending");
    expect(order.totalCents).toBe(20_000);
    expect(order.shippingCents).toBe(0);
    expect(order.items[0]).toMatchObject({ bespokePart: "deposit" });
    const held = await requestOf(request.id);
    expect(held.orderId).toBe(orderId);
    expect(held.depositPaidAt).toBeNull();
    expect(held.status).toBe("accepted");

    await addBespoke(owner, request.id);
    expect(await place(owner)).toEqual({ error: expect.stringMatching(/already being paid/) });
    await db.delete(cartItems).where(eq(cartItems.bespokeRequestId, request.id));

    await markPaid(orderId, null, "Marked as paid.");
    const paid = await requestOf(request.id);
    expect(paid.status).toBe("in_production");
    expect(paid.depositPaidAt).not.toBeNull();
    expect(paid.balancePaidAt).toBeNull();
  });

  it("frees a bespoke deposit when its unpaid order is cancelled", async () => {
    const owner = newOwner();
    const request = await bespoke(owner);
    await addBespoke(owner, request.id);
    const orderId = await placed(owner);
    await moveOrder(orderId, "cancelled");
    const freed = await requestOf(request.id);
    expect(freed.orderId).toBeNull();
    expect(freed.status).toBe("accepted");
    expect(freed.depositPaidAt).toBeNull();
  });

  it("takes a bespoke balance through a pending order and records it when paid", async () => {
    const owner = newOwner();
    const request = await bespoke(owner, { status: "in_production", depositPaidAt: new Date(), balanceRequestedAt: new Date() });
    await addBespoke(owner, request.id, "balance");
    const orderId = await placed(owner);
    const order = await orderOf(orderId);
    expect(order.status).toBe("pending");
    expect(order.subtotalCents).toBe(20_000);
    expect(order.items[0]).toMatchObject({ bespokePart: "balance" });
    expect((await requestOf(request.id)).balanceOrderId).toBe(orderId);
    expect((await requestOf(request.id)).balancePaidAt).toBeNull();
    await markPaid(orderId, null, "Marked as paid.");
    const paid = await requestOf(request.id);
    expect(paid.balancePaidAt).not.toBeNull();
    expect(paid.status).toBe("in_production");
  });
});
