import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import Stripe from "stripe";
import { canTransition, stockIsHeld, type OrderStatus } from "../order-status";
import { deliveryEstimate, MAKING_NOTE, money, orderRef, shippingCents, type ShippingMethod } from "../format";
import { designSpecSchema } from "../studio/spec";
import { describeDesign, quoteDesign } from "../studio/pricing";
import { db, schema, type Transaction } from "./db";
import { getCart } from "./cart";
import { sendMail } from "./mail";
import type { ShippingAddress } from "./schema";

const { cartItems, carts, designs, orderEvents, orderItems, orders, products, promoCodes, variants } = schema;

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
export const demoPaymentsAllowed = () => process.env.ALLOW_DEMO_PAYMENTS === "true" && process.env.NODE_ENV !== "production";

export type CheckoutInput = { ownerKey: string; email: string; address: ShippingAddress; method: ShippingMethod };
export type CheckoutResult = { error: string } | { orderId: string; redirectUrl: string };

class StockError extends Error {}

async function releaseAbandonedOrders(ownerKey: string) {
  const abandoned = await db
    .select({ id: orders.id, sessionId: orders.stripeSessionId })
    .from(orders)
    .where(and(eq(orders.ownerKey, ownerKey), eq(orders.status, "pending"), isNotNull(orders.stripeSessionId)));
  for (const order of abandoned) {
    const session = await stripe?.checkout.sessions.retrieve(order.sessionId!);
    if (session?.status === "open") await stripe?.checkout.sessions.expire(session.id);
    if (session?.status !== "complete") await moveOrder(order.id, "cancelled", { note: "Replaced by a new checkout" });
  }
}

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (!stripe && !demoPaymentsAllowed()) return { error: "Card payments are not available right now." };
  await releaseAbandonedOrders(input.ownerKey);
  const view = await getCart(input.ownerKey);
  if (!view.lines.length) return { error: "Your bag is empty." };
  if (view.promoError) return { error: view.promoError };
  const shipping = shippingCents(view.subtotalCents - view.discountCents, input.method);
  const totalCents = view.subtotalCents - view.discountCents + shipping;

  let orderId: string;
  let number: number;
  try {
    ({ orderId, number } = await db.transaction(async (tx) => {
      const [cart] = await tx.select().from(carts).where(eq(carts.ownerKey, input.ownerKey));
      const items = await tx
        .select({ item: cartItems, variant: variants, product: products, design: designs })
        .from(cartItems)
        .leftJoin(variants, eq(variants.id, cartItems.variantId))
        .leftJoin(products, eq(products.id, variants.productId))
        .leftJoin(designs, eq(designs.id, cartItems.designId))
        .where(eq(cartItems.cartId, cart!.id));

      const [order] = await tx
        .insert(orders)
        .values({
          ownerKey: input.ownerKey,
          email: input.email,
          subtotalCents: view.subtotalCents,
          shippingCents: shipping,
          discountCents: view.discountCents,
          totalCents,
          shippingMethod: input.method,
          promoCode: view.promoCode,
          shippingAddress: input.address,
        })
        .returning();

      for (const { item, variant, product, design } of items) {
        if (variant && product) {
          if (!product.active) throw new StockError(`${product.name} is no longer available.`);
          const taken = await tx
            .update(variants)
            .set({ stock: sql`${variants.stock} - ${item.quantity}` })
            .where(and(eq(variants.id, variant.id), sql`${variants.stock} >= ${item.quantity}`))
            .returning({ id: variants.id });
          if (!taken.length) throw new StockError(`${product.name} in ${variant.size} just sold out.`);
          await tx.insert(orderItems).values({
            orderId: order!.id,
            variantId: variant.id,
            name: product.name,
            detail: `${variant.color}, ${variant.size}`,
            image: product.images[0],
            unitPriceCents: variant.priceCents,
            quantity: item.quantity,
          });
        } else if (design) {
          const spec = designSpecSchema.parse(design.spec);
          const quote = quoteDesign(spec);
          await tx.insert(orderItems).values({
            orderId: order!.id,
            designId: design.id,
            name: design.name,
            detail: describeDesign(spec).map(([label, value]) => `${label}: ${value}`).join("; "),
            image: `/api/designs/${design.id}/preview`,
            unitPriceCents: quote.totalCents,
            quantity: item.quantity,
            designSpec: spec,
            designPrice: quote,
          });
        }
      }
      await tx.insert(orderEvents).values({ orderId: order!.id, status: "pending" });
      return { orderId: order!.id, number: order!.number };
    }));
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }

  if (!stripe) {
    await markPaid(orderId, null);
    return { orderId, redirectUrl: `/orders/${orderId}?placed=1` };
  }
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.email,
      line_items: [{
        quantity: 1,
        price_data: { currency: "usd", unit_amount: totalCents, product_data: { name: `OCCUIN order ${orderRef(number)}` } },
      }],
      metadata: { orderId },
      success_url: `${appUrl}/orders/${orderId}?placed=1`,
      cancel_url: `${appUrl}/bag`,
    });
  } catch (error) {
    await moveOrder(orderId, "cancelled", { note: "Payment session could not be created" });
    throw error;
  }
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId));
  return { orderId, redirectUrl: session.url! };
}

export async function markPaid(orderId: string, paymentIntentId: string | null) {
  const order = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: "paid", stripePaymentIntentId: paymentIntentId })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning();
    if (!updated) return null;
    await tx.insert(orderEvents).values({ orderId, status: "paid" });
    const [cart] = await tx.select().from(carts).where(eq(carts.ownerKey, updated.ownerKey));
    if (cart) {
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await tx.update(carts).set({ promoCode: null }).where(eq(carts.id, cart.id));
    }
    if (updated.promoCode) {
      await tx.update(promoCodes).set({ timesUsed: sql`${promoCodes.timesUsed} + 1` }).where(eq(promoCodes.code, updated.promoCode));
    }
    return updated;
  });
  if (order?.email) {
    await sendMail({
      to: order.email,
      subject: `Your OCCUIN order ${orderRef(order.number)} is confirmed`,
      text: `Thank you for your order. Total ${money(order.totalCents)}.\nYour order reference is ${orderRef(order.number)}.
${MAKING_NOTE} ${deliveryEstimate(order.shippingMethod as ShippingMethod)}.
Follow it at ${process.env.APP_URL ?? ""}/track using this reference and your email.`,
    });
  }
}

async function releaseStock(tx: Transaction, orderId: string) {
  const items = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNotNull(orderItems.variantId)));
  for (const item of items) {
    await tx.update(variants).set({ stock: sql`${variants.stock} + ${item.quantity}` }).where(eq(variants.id, item.variantId!));
  }
}

export async function moveOrder(orderId: string, to: OrderStatus, details: { note?: string; trackingNumber?: string } = {}) {
  if (to === "paid") {
    await markPaid(orderId, null);
    return { ok: true };
  }
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return { error: "Order not found." };
    if (!canTransition(order.status, to)) return { error: `An order cannot move from ${order.status} to ${to}.` };
    if (to === "refunded" && order.stripePaymentIntentId && stripe) {
      try {
        await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId }, { idempotencyKey: `refund-${orderId}` });
      } catch {
        return { error: "Stripe refused the refund, so the order was not changed." };
      }
    }
    if ((to === "cancelled" || to === "refunded") && stockIsHeld(order.status)) await releaseStock(tx, orderId);
    await tx
      .update(orders)
      .set({ status: to, trackingNumber: details.trackingNumber ?? order.trackingNumber })
      .where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, status: to, note: details.note });
    return { order };
  });
  if ("error" in result) return result;
  const { order } = result;
  if (to === "shipped" && order.email) {
    await sendMail({
      to: order.email,
      subject: `Your OCCUIN order ${orderRef(order.number)} has shipped`,
      text: details.trackingNumber ? `Tracking number: ${details.trackingNumber}` : "It is on its way.",
    });
  }
  return { ok: true };
}

export async function getOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(orderEvents.createdAt);
  return { ...order, items, events };
}

export const listOrders = (ownerKey: string) =>
  db.select().from(orders).where(eq(orders.ownerKey, ownerKey)).orderBy(desc(orders.createdAt));

export async function findOrderByRef(number: number, email: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), sql`lower(${orders.email}) = ${email.trim().toLowerCase()}`));
  return order ?? null;
}

export async function hasPurchased(userId: string, productId: string) {
  const owned = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.ownerKey, `u:${userId}`),
        eq(variants.productId, productId),
        inArray(orders.status, ["paid", "in_production", "shipped", "delivered"]),
      ),
    )
    .limit(1);
  return owned.length > 0;
}
