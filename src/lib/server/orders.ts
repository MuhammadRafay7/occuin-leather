import { and, desc, eq, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import Stripe from "stripe";
import { contactDetails, demoPaymentsAllowed, getSettings, type PaymentMode } from "./settings";
import { balanceBuyable, balanceOwedCents, bespokeBuyable, bespokeRef, depositCents } from "../bespoke/status";
import { canTransition, stockIsHeld, type OrderStatus } from "../order-status";
import { cartTotals, discountableCents, type PricedLine } from "../cart-totals";
import { bespokeNote, deliveryEstimate, makingNote, money, orderRef, shippingCents, type ShippingMethod, type ShippingRates } from "../format";
import { designSpecSchema } from "../studio/spec";
import { describeDesign, quoteDesign } from "../studio/pricing";
import { bespokeSnapshotOf, productSnapshotOf } from "../manufacturer/snapshot";
import { getDelivery, getPricing } from "./content";
import { db, schema, type Transaction } from "./db";
import { bespokeLineName, findPromo, getCart } from "./cart";
import { sendMail } from "./mail";
import { freezeBespokeFiles, freezeMediaPhotos } from "./order-files";
import { privateOrderLink } from "./whatsapp-order";
import type { ShippingAddress } from "./schema";

const { bespokeRequests, cartItems, carts, designs, orderEvents, orderItems, orderRefunds, orders, products, promoCodes, stockMovements, variants } = schema;

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export type CheckoutInput = { ownerKey: string; email: string; address: ShippingAddress; method: ShippingMethod; rates: ShippingRates; payment?: PaymentMode };
export type CheckoutResult = { error: string } | { orderId: string; redirectUrl: string };

const PAYMENT_WINDOW_SECONDS = 3600;
const MAX_OPEN_WHATSAPP_ORDERS = 3;
const AUTO_CANCEL_BATCH = 25;
const DAY_MS = 86_400_000;

class StockError extends Error {}

async function reservePromo(tx: Transaction, promo: typeof promoCodes.$inferSelect, input: CheckoutInput) {
  const [locked] = await tx.select({ active: promoCodes.active }).from(promoCodes).where(eq(promoCodes.code, promo.code)).for("update");
  if (!locked?.active) throw new StockError("That code is not valid.");
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

const openWhatsAppOrders = ({ ownerKey, email }: CheckoutInput) =>
  db.$count(
    orders,
    and(eq(orders.status, "pending"), eq(orders.paymentMethod, "whatsapp"), or(eq(orders.ownerKey, ownerKey), sql`lower(${orders.email}) = ${email.toLowerCase()}`)),
  );

async function emptyCart(tx: Transaction, cartId: string) {
  await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
  await tx.update(carts).set({ promoCode: null }).where(eq(carts.id, cartId));
}

async function announceWhatsAppOrder(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order?.email) return;
  const [{ email: storeEmail, whatsapp }, { autoCancelDays }] = await Promise.all([contactDetails(), getSettings()]);
  const reference = orderRef(order.number);
  const address = order.shippingAddress;
  await Promise.allSettled([
    sendMail({
      to: order.email,
      subject: `We have your OCCUIN order ${reference}`,
      text: [
        `Thank you. We have your order ${reference} and we are holding your items. It is not paid yet. Total ${money(order.totalCents)}.`,
        whatsapp ? "Next step: open your order and send it to us on WhatsApp. We will reply with how to pay." : `Next step: write to ${storeEmail} with your reference and we will arrange payment.`,
        autoCancelDays ? `We cancel unpaid orders after ${autoCancelDays} ${autoCancelDays === 1 ? "day" : "days"}.` : "",
        "",
        `Your order: ${privateOrderLink(order.id)}`,
      ].join("\n"),
    }),
    sendMail({
      to: storeEmail,
      subject: `New WhatsApp order ${reference}`,
      text: [`${address?.name ?? order.email}, ${address?.phone ?? "no phone"}, ${order.email}`, `Total ${money(order.totalCents)}. Not paid yet.`, `${process.env.APP_URL ?? "http://localhost:3000"}/admin/orders/${order.id}`].join("\n"),
    }),
  ]);
}

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const whatsapp = input.payment === "whatsapp";
  if (!whatsapp && !stripe && !demoPaymentsAllowed()) return { error: "Card payments are not available right now." };
  await expireUnpaidOrders();
  await releaseAbandonedOrders(input.ownerKey);
  const view = await getCart(input.ownerKey);
  if (!view.lines.length) return { error: "Your bag is empty." };
  if (view.promoError) return { error: view.promoError };
  if (whatsapp && (await openWhatsAppOrders(input)) >= MAX_OPEN_WHATSAPP_ORDERS) return { error: "You already have unpaid orders waiting. Finish those with us before placing another." };
  const [pricing, delivery] = await Promise.all([getPricing(), getDelivery()]);

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
          makingDays: delivery.makingMaxDays,
          paymentMethod: input.payment ?? "stripe",
        })
        .returning();

      for (const { item, variant, product, design } of items) {
        if (variant && product) {
          if (!product.active) throw new StockError(`${product.name} is no longer available.`);
          const taken = await tx
            .update(variants)
            .set({ stock: sql`${variants.stock} - ${item.quantity}` })
            .where(and(eq(variants.id, variant.id), sql`${variants.stock} >= ${item.quantity}`))
            .returning({ id: variants.id, stock: variants.stock });
          if (!taken.length) throw new StockError(`${product.name} in ${variant.size} just sold out.`);
          await tx.insert(stockMovements).values({ variantId: variant.id, delta: -item.quantity, stockAfter: taken[0]!.stock, reason: `Order ${orderRef(order!.number)}` });
          priced.push({ amountCents: variant.priceCents * item.quantity, bespoke: null });
          const snapshot = productSnapshotOf(product, variant);
          const [line] = await tx.insert(orderItems).values({
            orderId: order!.id,
            variantId: variant.id,
            name: product.name,
            detail: `${variant.color}, ${variant.size}`,
            image: product.images[0],
            unitPriceCents: variant.priceCents,
            quantity: item.quantity,
            productSnapshot: snapshot,
          }).returning({ id: orderItems.id });
          await freezeMediaPhotos(tx, line!.id, snapshot.images);
        } else if (design) {
          const spec = designSpecSchema.parse(design.spec);
          const quote = quoteDesign(spec, pricing);
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
        const [line] = await tx.insert(orderItems).values({
          orderId: order!.id,
          bespokeRequestId: request.id,
          bespokePart: balance ? "balance" : "deposit",
          name: bespokeLineName(request),
          detail: balance ? `Balance for bespoke design ${reference}. Total ${money(quoted)}.` : deposit < quoted ? `Deposit ${request.depositPercent}% for bespoke design ${reference}. Total ${money(quoted)}. Balance due before shipping: ${money(quoted - deposit)}.` : `Full payment for bespoke design ${reference}.`,
          image: `/api/bespoke/preview/${request.id}`,
          unitPriceCents: balance ? quoted - deposit : deposit,
          quantity: 1,
          bespokeSnapshot: balance ? null : bespokeSnapshotOf(request, reference),
        }).returning({ id: orderItems.id });
        if (!balance) await freezeBespokeFiles(tx, line!.id, request.id, request.design);
        await tx.update(bespokeRequests).set({ ...(balance ? { balanceOrderId: order!.id } : { orderId: order!.id }), updatedAt: new Date() }).where(eq(bespokeRequests.id, request.id));
      }
      const goodsCents = discountableCents(priced);
      const found = cart!.promoCode && goodsCents > 0 ? await findPromo(cart!.promoCode, goodsCents, tx) : null;
      if (found && "error" in found) throw new StockError(found.error);
      const promo = found?.promo ?? null;
      if (promo) await reservePromo(tx, promo, input);
      const totals = cartTotals(priced, promo?.percentOff ?? 0);
      const shipping = totals.shippingWaived ? 0 : shippingCents(totals.shippingBasisCents, input.method, input.rates);
      const total = totals.subtotalCents - totals.discountCents + shipping;
      await tx
        .update(orders)
        .set({ subtotalCents: totals.subtotalCents, discountCents: totals.discountCents, shippingCents: shipping, totalCents: total, promoCode: promo?.code ?? null })
        .where(eq(orders.id, order!.id));
      await tx.insert(orderEvents).values({ orderId: order!.id, status: "pending" });
      if (whatsapp) await emptyCart(tx, cart!.id);
      return { orderId: order!.id, number: order!.number, totalCents: total };
    }));
  } catch (error) {
    if (error instanceof StockError) return { error: error.message };
    throw error;
  }

  if (whatsapp) {
    await announceWhatsAppOrder(orderId).catch((error) => console.error(`[checkout] order ${orderRef(number)} emails failed`, error));
    return { orderId, redirectUrl: `/orders/${orderId}?placed=1` };
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

export async function markPaid(orderId: string, paymentIntentId: string | null, note?: string) {
  const order = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(orders)
      .set({ status: "paid", stripePaymentIntentId: paymentIntentId })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning();
    if (!updated) return null;
    await tx.insert(orderEvents).values({ orderId, status: "paid", note });
    await tx
      .update(bespokeRequests)
      .set({ status: "in_production", depositPaidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(bespokeRequests.orderId, orderId), eq(bespokeRequests.status, "accepted")));
    await tx.update(bespokeRequests).set({ balancePaidAt: new Date(), updatedAt: new Date() }).where(eq(bespokeRequests.balanceOrderId, orderId));
    const [cart] = updated.paymentMethod === "whatsapp" ? [] : await tx.select().from(carts).where(eq(carts.ownerKey, updated.ownerKey));
    if (cart) await emptyCart(tx, cart.id);
    if (updated.promoCode) {
      await tx.update(promoCodes).set({ timesUsed: sql`${promoCodes.timesUsed} + 1` }).where(eq(promoCodes.code, updated.promoCode));
    }
    return updated;
  });
  if (!order) return false;
  if (order.email) await sendConfirmation(order).catch((error) => console.error(`[orders] confirmation for ${orderRef(order.number)} failed`, error));
  return true;
}

async function sendConfirmation(order: typeof orders.$inferSelect) {
  const [owed, delivery] = await Promise.all([bespokeOnOrder(order.id), getDelivery()]);
  const bespokeOrder = owed.length > 0;
  const balanceNote = owed.flatMap((request) => (balanceOwedCents(request) ? [`A balance of ${money(balanceOwedCents(request))} on ${bespokeRef(request.number)} is due before it ships. We will email you a private link when it is time to pay.\n`] : [])).join("");
  return sendMail({
    to: order.email!,
    subject: `Your OCCUIN order ${orderRef(order.number)} is confirmed`,
    text: `Thank you for your order. Total ${money(order.totalCents)}.\nYour order reference is ${orderRef(order.number)}.
${balanceNote}${bespokeOrder ? bespokeNote(delivery) : `${makingNote(delivery)} ${deliveryEstimate(order.shippingMethod as ShippingMethod, delivery)}.`}
Follow it at ${process.env.APP_URL ?? ""}/track using this reference and your email.`,
  });
}

export async function resendConfirmation(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return { error: "Order not found." };
  if (!order.email) return { error: "This order has no email address." };
  if (order.status === "pending" || order.status === "cancelled" || order.status === "refunded") return { error: "Only a paid, open order has a confirmation to resend." };
  return (await sendConfirmation(order)) ? { ok: true, email: order.email } : { error: "The email could not be sent." };
}

async function flagPayment(order: typeof orders.$inferSelect, note: string) {
  console.error(`[stripe] ${orderRef(order.number)}: ${note}`);
  await db.insert(orderEvents).values({ orderId: order.id, status: order.status, note });
  await sendMail({ to: (await contactDetails()).email, subject: `Payment problem on ${orderRef(order.number)}`, text: note }).catch(() => false);
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
  else if (latest && paymentIntentId) await db.update(orders).set({ stripePaymentIntentId: paymentIntentId }).where(and(eq(orders.id, latest.id), isNull(orders.stripePaymentIntentId)));
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

async function releaseStock(tx: Transaction, orderId: string, reason: string) {
  const items = await tx
    .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
    .from(orderItems)
    .where(and(eq(orderItems.orderId, orderId), isNotNull(orderItems.variantId)));
  for (const item of items) {
    const [released] = await tx.update(variants).set({ stock: sql`${variants.stock} + ${item.quantity}` }).where(eq(variants.id, item.variantId!)).returning({ stock: variants.stock });
    if (released) await tx.insert(stockMovements).values({ variantId: item.variantId!, delta: item.quantity, stockAfter: released.stock, reason });
  }
}

async function refundedSoFar(tx: Transaction, orderId: string) {
  const [row] = await tx
    .select({ cents: sql<number>`coalesce(sum(${orderRefunds.amountCents}), 0)`.mapWith(Number) })
    .from(orderRefunds)
    .where(eq(orderRefunds.orderId, orderId));
  return row?.cents ?? 0;
}

type RefundDetails = { amountCents: number; reason: string; actorEmail: string; manual?: boolean };

async function issueRefund(tx: Transaction, order: typeof orders.$inferSelect, refundedCents: number, details: RefundDetails): Promise<{ error: string } | { amountCents: number; stripeRefundId: string | null }> {
  const { amountCents, reason, actorEmail, manual } = details;
  const paymentIntent = order.stripePaymentIntentId;
  if (paymentIntent && !stripe) return { error: "Stripe is not configured on this server, so this payment cannot be refunded here. Nothing was changed." };
  if (!paymentIntent && !manual) return { error: "This order has no Stripe payment to refund. Nothing was changed. If the money was returned another way, record it as a manual refund." };
  let stripeRefundId: string | null = null;
  if (paymentIntent && stripe) {
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntent, amount: amountCents, metadata: { orderId: order.id, reference: orderRef(order.number) } },
        { idempotencyKey: `refund-${order.id}-${refundedCents}-${amountCents}` },
      );
      if (refund.status === "failed" || refund.status === "canceled") return { error: `Stripe reported the refund as ${refund.status}, so nothing was changed.` };
      stripeRefundId = refund.id;
    } catch (error) {
      console.error(`[stripe] refund on ${orderRef(order.number)} failed`, error);
      const detail = error instanceof Stripe.errors.StripeError ? ` ${error.message}` : "";
      return { error: `Stripe refused the refund, so nothing was changed.${detail}` };
    }
  }
  await tx.insert(orderRefunds).values({ orderId: order.id, amountCents, reason, stripeRefundId, actorEmail });
  return { amountCents, stripeRefundId };
}

type MoveDetails = { note?: string; trackingNumber?: string; overrideBalance?: boolean; actorEmail?: string; manualRefund?: boolean };

async function applyMove(tx: Transaction, order: typeof orders.$inferSelect, to: OrderStatus, details: MoveDetails): Promise<{ error: string } | { order: typeof orders.$inferSelect }> {
  const orderId = order.id;
  if (!canTransition(order.status, to)) return { error: `An order cannot move from ${order.status} to ${to}.` };
  const owing = to === "shipped" ? (await bespokeOnOrder(orderId, tx)).filter((request) => balanceOwedCents(request) > 0) : [];
  const owed = owing.map((request) => `${money(balanceOwedCents(request))} on ${bespokeRef(request.number)}`).join(", ");
  if (owing.length && !details.overrideBalance) return { error: `A balance of ${owed} is due, so this order cannot ship yet.` };
  if (owing.length && !details.note) return { error: "Add a note saying why this order ships with a balance due." };
  if (to === "refunded") {
    const refundedCents = await refundedSoFar(tx, orderId);
    const remaining = order.totalCents - refundedCents;
    if (remaining > 0) {
      const issued = await issueRefund(tx, order, refundedCents, {
        amountCents: remaining,
        reason: details.note || "Full refund",
        actorEmail: details.actorEmail ?? "system",
        manual: details.manualRefund,
      });
      if ("error" in issued) return issued;
    }
  }
  if ((to === "cancelled" || to === "refunded") && stockIsHeld(order.status)) await releaseStock(tx, orderId, `Order ${orderRef(order.number)} ${to}`);
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
}

export async function moveOrder(orderId: string, to: OrderStatus, details: MoveDetails = {}) {
  if (to === "paid") return (await markPaid(orderId, null, details.note)) ? { ok: true } : { error: "Only an order awaiting payment can be marked paid." };
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return { error: "Order not found." };
    return applyMove(tx, order, to, details);
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

async function expireWhatsAppOrder(order: { id: string; number: number; email: string | null }, days: number) {
  const moved = await moveOrder(order.id, "cancelled", { note: `Cancelled automatically: not paid within ${days} ${days === 1 ? "day" : "days"}.`, actorEmail: "system" });
  if ("error" in moved || !order.email) return;
  await sendMail({
    to: order.email,
    subject: `Your OCCUIN order ${orderRef(order.number)} was cancelled`,
    text: `We did not receive payment for order ${orderRef(order.number)} within ${days} ${days === 1 ? "day" : "days"}, so we have cancelled it and released your items. You have not been charged. You are welcome to order again.`,
  }).catch(() => false);
}

export async function expireUnpaidOrders() {
  try {
    const { autoCancelDays } = await getSettings();
    if (!autoCancelDays) return;
    const overdue = await db
      .select({ id: orders.id, number: orders.number, email: orders.email })
      .from(orders)
      .where(and(eq(orders.status, "pending"), eq(orders.paymentMethod, "whatsapp"), lt(orders.createdAt, new Date(Date.now() - autoCancelDays * DAY_MS))))
      .orderBy(orders.createdAt)
      .limit(AUTO_CANCEL_BATCH);
    for (const order of overdue) await expireWhatsAppOrder(order, autoCancelDays);
  } catch (error) {
    console.error("[orders] auto cancel failed", error);
  }
}

export type RefundInput = {
  amountCents: number | "remaining";
  reason: string;
  actorEmail: string;
  manual?: boolean;
  expectedRefundedCents?: number;
};

export type RefundResult = { error: string } | { amountCents: number; full: boolean; stripeBacked: boolean };

export async function refundOrder(orderId: string, input: RefundInput): Promise<RefundResult> {
  const { reason, actorEmail, manual, expectedRefundedCents } = input;
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return { error: "Order not found." };
    if (!canTransition(order.status, "refunded")) return { error: "Only a paid order can be refunded." };
    const refundedCents = await refundedSoFar(tx, orderId);
    if (expectedRefundedCents !== undefined && expectedRefundedCents !== refundedCents) {
      return { error: "Another refund was recorded while this page was open. Reload and check the amount. Nothing was changed." };
    }
    const remaining = order.totalCents - refundedCents;
    const amountCents = input.amountCents === "remaining" ? remaining : input.amountCents;
    if (!Number.isInteger(amountCents) || amountCents <= 0) return { error: "Enter an amount above zero." };
    if (amountCents > remaining) return { error: `Only ${money(remaining)} is left to refund on this order.` };
    const stripeBacked = Boolean(order.stripePaymentIntentId);
    if (amountCents === remaining) {
      const moved = await applyMove(tx, order, "refunded", { note: reason, actorEmail, manualRefund: manual });
      if ("error" in moved) return moved;
      return { amountCents, full: true, stripeBacked };
    }
    const issued = await issueRefund(tx, order, refundedCents, { amountCents, reason, actorEmail, manual });
    if ("error" in issued) return issued;
    return { amountCents, full: false, stripeBacked };
  });
}

export async function emailRefund(order: { email: string | null; number: number; paymentMethod: PaymentMode }, amountCents: number) {
  if (!order.email) return false;
  const timing = order.paymentMethod === "whatsapp" ? "" : " It can take 5 to 10 business days to appear on your statement.";
  return sendMail({
    to: order.email,
    subject: `Your OCCUIN order ${orderRef(order.number)} was refunded`,
    text: `We have refunded ${money(amountCents)} on order ${orderRef(order.number)}.${timing} Reply to this email if you have a question.`,
  }).catch(() => false);
}

export async function syncStripeRefund(charge: Stripe.Charge) {
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return;
  const synced = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, paymentIntent)).for("update");
    if (!order) return null;
    const recorded = await refundedSoFar(tx, order.id);
    const missing = charge.amount_refunded - recorded;
    if (missing <= 0) return null;
    const note = `Refund of ${money(missing)} made in the Stripe dashboard.`;
    await tx.insert(orderRefunds).values({ orderId: order.id, amountCents: missing, reason: note, actorEmail: "Stripe" });
    if (recorded + missing >= order.totalCents && canTransition(order.status, "refunded")) {
      const moved = await applyMove(tx, order, "refunded", { note, actorEmail: "Stripe" });
      if ("error" in moved) throw new Error(moved.error);
    } else {
      await tx.insert(orderEvents).values({ orderId: order.id, status: order.status, note });
    }
    return { order, missing };
  });
  if (synced) await emailRefund(synced.order, synced.missing);
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
