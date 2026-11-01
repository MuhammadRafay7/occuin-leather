import { and, desc, eq, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import Stripe from "stripe";
import { balanceBuyable, balanceOwedCents, bespokeBuyable, bespokeRef, depositCents } from "../bespoke/status";
import { canTransition, stockIsHeld, type OrderStatus } from "../order-status";
import { cartTotals, discountableCents, type PricedLine } from "../cart-totals";
import { BESPOKE_NOTE, BRAND, deliveryEstimate, MAKING_NOTE, money, orderRef, shippingCents, type ShippingMethod } from "../format";
import { designSpecSchema } from "../studio/spec";
import { describeDesign, quoteDesign } from "../studio/pricing";
import { db, schema, type Transaction } from "./db";
import { bespokeLineName, findPromo, getCart } from "./cart";
import { sendMail } from "./mail";
import type { ShippingAddress } from "./schema";

const { bespokeRequests, cartItems, carts, designs, orderEvents, orderItems, orders, products, promoCodes, variants } = schema;

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
export const demoPaymentsAllowed = () => process.env.ALLOW_DEMO_PAYMENTS === "true" && process.env.NODE_ENV !== "production";

export type CheckoutInput = { ownerKey: string; email: string; address: ShippingAddress; method: ShippingMethod };
export type CheckoutResult = { error: string } | { orderId: string; redirectUrl: string };

const PAYMENT_WINDOW_SECONDS = 3600;

class StockError extends Error {}

async function reservePromo(tx: Transaction, promo: typeof promoCodes.$inferSelect, input: CheckoutInput) {
  await tx.select({ code: promoCodes.code }).from(promoCodes).where(eq(promoCodes.code, promo.code)).for("update");
  const claimed = and(eq(orders.promoCode, promo.code), notInArray(orders.status, ["cancelled", "refunded"]));
  if (promo.maxUses !== null && (await tx.$count(orders, claimed)) >= promo.maxUses) throw new StockError("That code is not valid.");
  if (!promo.oncePerCustomer) return;
  const sameCustomer = or(eq(orders.ownerKey, input.ownerKey), sql`lower(${orders.email}) = ${input.email.toLowerCase()}`);
  if (await tx.$count(orders, and(claimed, sameCustomer))) throw new StockError("That code has already been used.");
}

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

  let orderId: string;
  let number: number;
  let totalCents: number;
  try {
    ({ orderId, number, totalCents } = await db.transaction(async (tx) => {
      const [cart] = await tx.select().from(carts).where(eq(carts.ownerKey, input.ownerKey)).for("update");
      const items = await tx
        .select({ item: cartItems, variant: variants, product: products, design: designs })
        .from(cartItems)
        .leftJoin(variants, eq(variants.id, cartItems.variantId))
        .leftJoin(products, eq(products.id, variants.productId))
        .leftJoin(designs, eq(designs.id, cartItems.designId))
        .where(eq(cartItems.cartId, cart!.id));
      if (!items.length) throw new StockError("Your bag is empty.");
      const bespokeLines = items.flatMap(({ item }) => (item.bespokeRequestId ? [{ requestId: item.bespokeRequestId, part: item.bespokePart }] : []));
      const priced: PricedLine[] = [];

      const [order] = await tx
        .insert(orders)
        .values({
          ownerKey: input.ownerKey,
          email: input.email,
          subtotalCents: 0,
          totalCents: 0,
          shippingMethod: input.method,
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
          priced.push({ amountCents: variant.priceCents * item.quantity, bespoke: null });
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
          priced.push({ amountCents: quote.totalCents * item.quantity, bespoke: null });
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
      for (const { requestId, part } of bespokeLines) {
        const [request] = await tx.select().from(bespokeRequests).where(eq(bespokeRequests.id, requestId)).for("update");
        const balance = part === "balance";
        if (!request || !(balance ? balanceBuyable(request) : bespokeBuyable(request))) throw new StockError("A bespoke quote in your bag can no longer be bought. Remove it to check out.");
        const heldId = balance ? request.balanceOrderId : request.orderId;
        if (heldId) {
          const [held] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, heldId));
          if (held && held.status !== "cancelled" && held.status !== "refunded") throw new StockError("This bespoke piece is already being paid for.");
        }
        const quoted = request.quotedPriceCents!;
        const deposit = depositCents(quoted, request.depositPercent);
        const reference = bespokeRef(request.number);
        priced.push({ amountCents: balance ? quoted - deposit : deposit, bespoke: { part: balance ? "balance" : "deposit", depositCents: deposit, balanceCents: quoted - deposit } });
        await tx.insert(orderItems).values({
          orderId: order!.id,
          bespokeRequestId: request.id,
          bespokePart: balance ? "balance" : "deposit",
          name: bespokeLineName(request),
          detail: balance ? `Balance for bespoke design ${reference}. Total ${money(quoted)}.` : deposit < quoted ? `Deposit ${request.depositPercent}% for bespoke design ${reference}. Total ${money(quoted)}. Balance due before shipping: ${money(quoted - deposit)}.` : `Full payment for bespoke design ${reference}.`,
          image: `/api/bespoke/preview/${request.id}`,
          unitPriceCents: balance ? quoted - deposit : deposit,
          quantity: 1,
        });
        await tx.update(bespokeRequests).set({ ...(balance ? { balanceOrderId: order!.id } : { orderId: order!.id }), updatedAt: new Date() }).where(eq(bespokeRequests.id, request.id));
      }
      const goodsCents = discountableCents(priced);
      const found = cart!.promoCode && goodsCents > 0 ? await findPromo(cart!.promoCode, goodsCents, tx) : null;
      if (found && "error" in found) throw new StockError(found.error);
      const promo = found?.promo ?? null;
      if (promo) await reservePromo(tx, promo, input);
      const totals = cartTotals(priced, promo?.percentOff ?? 0);
      const shipping = totals.shippingWaived ? 0 : shippingCents(totals.shippingBasisCents, input.method);
      const total = totals.subtotalCents - totals.discountCents + shipping;
      await tx
        .update(orders)
        .set({ subtotalCents: totals.subtotalCents, discountCents: totals.discountCents, shippingCents: shipping, totalCents: total, promoCode: promo?.code ?? null })
        .where(eq(orders.id, order!.id));
      await tx.insert(orderEvents).values({ orderId: order!.id, status: "pending" });
      return { orderId: order!.id, number: order!.number, totalCents: total };
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
      expires_at: Math.floor(Date.now() / 1000) + PAYMENT_WINDOW_SECONDS,
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
    await tx
      .update(bespokeRequests)
      .set({ status: "in_production", depositPaidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(bespokeRequests.orderId, orderId), eq(bespokeRequests.status, "accepted")));
    await tx.update(bespokeRequests).set({ balancePaidAt: new Date(), updatedAt: new Date() }).where(eq(bespokeRequests.balanceOrderId, orderId));
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
  if (!order) return false;
  if (order.email) {
    const owed = await bespokeOnOrder(orderId);
    const bespokeOrder = owed.length > 0;
    const balanceNote = owed.flatMap((request) => (balanceOwedCents(request) ? [`A balance of ${money(balanceOwedCents(request))} on ${bespokeRef(request.number)} is due before it ships. We will email you a private link when it is time to pay.\n`] : [])).join("");
    await sendMail({
      to: order.email,
      subject: `Your OCCUIN order ${orderRef(order.number)} is confirmed`,
      text: `Thank you for your order. Total ${money(order.totalCents)}.\nYour order reference is ${orderRef(order.number)}.
${balanceNote}${bespokeOrder ? BESPOKE_NOTE : `${MAKING_NOTE} ${deliveryEstimate(order.shippingMethod as ShippingMethod)}.`}
Follow it at ${process.env.APP_URL ?? ""}/track using this reference and your email.`,
    });
  }
  return true;
}

async function flagPayment(order: typeof orders.$inferSelect, note: string) {
  console.error(`[stripe] ${orderRef(order.number)}: ${note}`);
  await db.insert(orderEvents).values({ orderId: order.id, status: order.status, note });
  await sendMail({ to: BRAND.email, subject: `Payment problem on ${orderRef(order.number)}`, text: note }).catch(() => false);
}

async function refundLatePayment(order: typeof orders.$inferSelect, paymentIntentId: string | null) {
  if (!stripe || !paymentIntentId) return flagPayment(order, "A payment arrived after this order was cancelled. Refund it in Stripe.");
  await stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `late-${order.id}` });
  await db.update(orders).set({ stripePaymentIntentId: paymentIntentId }).where(eq(orders.id, order.id));
  await flagPayment(order, "A payment arrived after this order was cancelled, so it was refunded.");
  if (order.email) {
    await sendMail({
      to: order.email,
      subject: `Your OCCUIN order ${orderRef(order.number)} was refunded`,
      text: "Your payment arrived after this order was cancelled, so we have refunded it in full. It can take a few days to reach your account.",
    }).catch(() => false);
  }
}

export async function settleCheckoutSession(session: Stripe.Checkout.Session) {
  const [order] = await db.select().from(orders).where(eq(orders.stripeSessionId, session.id));
  if (!order) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  if (order.status === "pending" && (session.amount_total !== order.totalCents || session.currency !== order.currency)) {
    return flagPayment(order, `Stripe reported ${session.amount_total} ${session.currency} for an order of ${order.totalCents} ${order.currency}, so it was not marked paid.`);
  }
  if (await markPaid(order.id, paymentIntentId)) return;
  const [latest] = await db.select().from(orders).where(eq(orders.id, order.id));
  if (latest?.status === "cancelled") await refundLatePayment(latest, paymentIntentId);
}

export async function cancelCheckoutSession(session: Stripe.Checkout.Session, note: string) {
  const [order] = await db.select().from(orders).where(eq(orders.stripeSessionId, session.id));
  if (order) await moveOrder(order.id, "cancelled", { note });
}

function bespokeOnOrder(orderId: string, source: Pick<typeof db, "select"> = db) {
  return source.select().from(bespokeRequests).where(or(eq(bespokeRequests.orderId, orderId), eq(bespokeRequests.balanceOrderId, orderId)));
}

async function moveLinkedOrder(tx: Transaction, orderId: string, to: OrderStatus, trackingNumber: string | undefined) {
  for (const request of await bespokeOnOrder(orderId, tx)) {
    const linkedId = request.orderId === orderId ? request.balanceOrderId : request.orderId;
    if (!linkedId) continue;
    const [linked] = await tx.select().from(orders).where(eq(orders.id, linkedId)).for("update");
    const others = await tx.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.orderId, linkedId), isNull(orderItems.bespokeRequestId)));
    if (!linked || others.length || !canTransition(linked.status, to)) continue;
    await tx.update(orders).set({ status: to, trackingNumber: trackingNumber ?? linked.trackingNumber }).where(eq(orders.id, linkedId));
    await tx.insert(orderEvents).values({ orderId: linkedId, status: to, note: "Moved with the linked bespoke order" });
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

export async function moveOrder(orderId: string, to: OrderStatus, details: { note?: string; trackingNumber?: string; overrideBalance?: boolean } = {}) {
  if (to === "paid") {
    await markPaid(orderId, null);
    return { ok: true };
  }
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return { error: "Order not found." };
    if (!canTransition(order.status, to)) return { error: `An order cannot move from ${order.status} to ${to}.` };
    const owing = to === "shipped" ? (await bespokeOnOrder(orderId, tx)).filter((request) => balanceOwedCents(request) > 0) : [];
    const owed = owing.map((request) => `${money(balanceOwedCents(request))} on ${bespokeRef(request.number)}`).join(", ");
    if (owing.length && !details.overrideBalance) return { error: `A balance of ${owed} is due, so this order cannot ship yet.` };
    if (owing.length && !details.note) return { error: "Add a note saying why this order ships with a balance due." };
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
    await tx.insert(orderEvents).values({ orderId, status: to, note: owing.length ? `Shipped with a balance of ${owed} due. ${details.note}` : details.note });
    if (to === "cancelled") {
      await tx.update(bespokeRequests).set({ orderId: null, updatedAt: new Date() }).where(and(eq(bespokeRequests.orderId, orderId), eq(bespokeRequests.status, "accepted")));
      await tx.update(bespokeRequests).set({ balanceOrderId: null, updatedAt: new Date() }).where(eq(bespokeRequests.balanceOrderId, orderId));
    }
    if (to === "refunded") {
      await tx.update(bespokeRequests).set({ balanceRequestedAt: null, updatedAt: new Date() }).where(eq(bespokeRequests.orderId, orderId));
      await tx.update(bespokeRequests).set({ balanceOrderId: null, balancePaidAt: null, updatedAt: new Date() }).where(eq(bespokeRequests.balanceOrderId, orderId));
    }
    if (to === "delivered") {
      await tx.update(bespokeRequests).set({ status: "completed", updatedAt: new Date() }).where(and(or(eq(bespokeRequests.orderId, orderId), eq(bespokeRequests.balanceOrderId, orderId)), eq(bespokeRequests.status, "in_production")));
    }
    if (to === "shipped" || to === "delivered") await moveLinkedOrder(tx, orderId, to, details.trackingNumber);
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
  const bespoke = await bespokeOnOrder(orderId);
  return { ...order, items, events, bespoke };
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
