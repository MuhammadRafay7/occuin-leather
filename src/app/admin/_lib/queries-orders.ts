import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { getCart } from "@/lib/server/cart";
import { db, schema } from "@/lib/server/db";
import { param, type SearchParams } from "./format";
import { NEEDS_ACTION_FILTER, PAGE_SIZE } from "./queries";
import { DAY_MS, eachDay, parseDay, startOfDay } from "./report-range";

const { adminAuditLog, bespokeRequests, carts, categories, contactMessages, orderItems, orderRefunds, orders, products, promoCodes, users, variants } = schema;

export const COUNTED_STATUSES: OrderStatus[] = ["paid", "in_production", "shipped", "delivered"];
export const EVER_PAID_STATUSES: OrderStatus[] = [...COUNTED_STATUSES, "refunded"];
const NEEDS_ACTION_STATUSES: OrderStatus[] = ["paid", "in_production"];
export const ORDER_NOTE_ACTION = "order.note";
const LATE_ORDER_DAYS = 30;
const STUCK_PAYMENT_HOURS = 2;
const EXPORT_LIMIT = 50_000;

const orderRefundedCents = sql`(select coalesce(sum(r.amount_cents), 0) from order_refunds r where r.order_id = orders.id)`;
const sumCents = (expression: SQL) => sql<number>`coalesce(sum(${expression}), 0)`.mapWith(Number);
const utcDay = (column: typeof orders.createdAt | typeof orderRefunds.createdAt) => sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;
const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;
const isOrderStatus = (value: string): value is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(value);
const between = (column: typeof orders.createdAt | typeof orderRefunds.createdAt | typeof bespokeRequests.createdAt, from: Date, end: Date) => and(gte(column, from), lt(column, end));

export const ORDER_SORTS = {
  newest: { label: "Newest first", order: desc(orders.createdAt) },
  oldest: { label: "Oldest first", order: asc(orders.createdAt) },
  total_high: { label: "Total, high to low", order: desc(orders.totalCents) },
  total_low: { label: "Total, low to high", order: asc(orders.totalCents) },
} as const;
export type OrderSort = keyof typeof ORDER_SORTS;

export type OrderFilters = { status: string; q: string; from: string; to: string; method: string; country: string; sort: OrderSort };

export function parseOrderFilters(search: SearchParams): OrderFilters {
  const day = (key: string) => (parseDay(param(search, key)) ? param(search, key) : "");
  const sort = param(search, "sort");
  return {
    status: param(search, "status"),
    q: param(search, "q"),
    from: day("from"),
    to: day("to"),
    method: param(search, "method"),
    country: param(search, "country").toUpperCase(),
    sort: Object.hasOwn(ORDER_SORTS, sort) ? (sort as OrderSort) : "newest",
  };
}

function orderWhere({ status, q, from, to, method, country }: OrderFilters) {
  const toDay = parseDay(to);
  const fromDay = parseDay(from);
  return and(
    status === NEEDS_ACTION_FILTER ? inArray(orders.status, NEEDS_ACTION_STATUSES) : isOrderStatus(status) ? eq(orders.status, status) : undefined,
    q ? or(ilike(orders.email, contains(q)), sql`('OC-' || lpad(${orders.number}::text, 6, '0')) ilike ${contains(q)}`) : undefined,
    fromDay ? gte(orders.createdAt, fromDay) : undefined,
    toDay ? lt(orders.createdAt, new Date(toDay.getTime() + DAY_MS)) : undefined,
    method ? eq(orders.shippingMethod, method) : undefined,
    country ? sql`${orders.shippingAddress}->>'country' = ${country}` : undefined,
  );
}

const orderRow = {
  id: orders.id,
  number: orders.number,
  createdAt: orders.createdAt,
  email: orders.email,
  status: orders.status,
  subtotalCents: orders.subtotalCents,
  discountCents: orders.discountCents,
  shippingCents: orders.shippingCents,
  taxCents: orders.taxCents,
  totalCents: orders.totalCents,
  shippingMethod: orders.shippingMethod,
  promoCode: orders.promoCode,
  trackingNumber: orders.trackingNumber,
  paymentMethod: orders.paymentMethod,
  customerName: sql<string | null>`${orders.shippingAddress}->>'name'`,
  country: sql<string | null>`${orders.shippingAddress}->>'country'`,
  refundedCents: sql<number>`${orderRefundedCents}`.mapWith(Number),
};

export const countFilteredOrders = (filters: OrderFilters) => db.$count(orders, orderWhere(filters));

export const listFilteredOrders = (filters: OrderFilters, offset: number, limit: number = PAGE_SIZE) =>
  db.select(orderRow).from(orders).where(orderWhere(filters)).orderBy(ORDER_SORTS[filters.sort].order, desc(orders.number)).limit(limit).offset(offset);

export const exportFilteredOrders = (filters: OrderFilters) => listFilteredOrders(filters, 0, EXPORT_LIMIT);

export async function orderCountries() {
  const code = sql<string | null>`${orders.shippingAddress}->>'country'`;
  const rows = await db.selectDistinct({ code }).from(orders).where(sql`${orders.shippingAddress} is not null`);
  return rows.flatMap((row) => (row.code ? [row.code] : [])).sort();
}

export const listOrderRefunds = (orderId: string) =>
  db.select().from(orderRefunds).where(eq(orderRefunds.orderId, orderId)).orderBy(desc(orderRefunds.createdAt));

export const listOrderNotes = (orderId: string) =>
  db
    .select({ id: adminAuditLog.id, body: adminAuditLog.detail, actorEmail: adminAuditLog.actorEmail, createdAt: adminAuditLog.createdAt })
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.action, ORDER_NOTE_ACTION), eq(adminAuditLog.targetType, "order"), eq(adminAuditLog.targetId, orderId)))
    .orderBy(desc(adminAuditLog.createdAt));

export async function findOrderCustomer(ownerKey: string) {
  const id = z.uuid().safeParse(ownerKey.slice(2));
  if (!ownerKey.startsWith("u:") || !id.success) return null;
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, id.data));
  return user ?? null;
}

async function refundsInRange(from: Date, end: Date) {
  const [recorded] = await db.select({ cents: sumCents(sql`${orderRefunds.amountCents}`) }).from(orderRefunds).where(between(orderRefunds.createdAt, from, end));
  const [unrecorded] = await db
    .select({ cents: sumCents(sql`${orders.totalCents} - ${orderRefundedCents}`) })
    .from(orders)
    .where(and(eq(orders.status, "refunded"), between(orders.createdAt, from, end)));
  return (recorded?.cents ?? 0) + (unrecorded?.cents ?? 0);
}

export async function salesSummary(from: Date, end: Date) {
  const [sales] = await db
    .select({ orders: count(), grossCents: sumCents(sql`${orders.totalCents}`) })
    .from(orders)
    .where(and(inArray(orders.status, EVER_PAID_STATUSES), between(orders.createdAt, from, end)));
  const refundsCents = await refundsInRange(from, end);
  const orderTotal = sales?.orders ?? 0;
  const grossCents = sales?.grossCents ?? 0;
  return {
    orders: orderTotal,
    grossCents,
    refundsCents,
    netCents: grossCents - refundsCents,
    averageCents: orderTotal ? Math.round(grossCents / orderTotal) : null,
  };
}

export type SalesSummary = Awaited<ReturnType<typeof salesSummary>>;

export async function dailySales(from: Date, end: Date) {
  const day = utcDay(orders.createdAt);
  const sales = await db
    .select({ day, orders: count(), grossCents: sumCents(sql`${orders.totalCents}`) })
    .from(orders)
    .where(and(inArray(orders.status, EVER_PAID_STATUSES), between(orders.createdAt, from, end)))
    .groupBy(day);
  const refundDay = utcDay(orderRefunds.createdAt);
  const recorded = await db
    .select({ day: refundDay, cents: sumCents(sql`${orderRefunds.amountCents}`) })
    .from(orderRefunds)
    .where(between(orderRefunds.createdAt, from, end))
    .groupBy(refundDay);
  const unrecorded = await db
    .select({ day, cents: sumCents(sql`${orders.totalCents} - ${orderRefundedCents}`) })
    .from(orders)
    .where(and(eq(orders.status, "refunded"), between(orders.createdAt, from, end)))
    .groupBy(day);
  const refunds = new Map<string, number>();
  for (const row of [...recorded, ...unrecorded]) refunds.set(row.day, (refunds.get(row.day) ?? 0) + row.cents);
  const byDay = new Map(sales.map((row) => [row.day, row]));
  return eachDay(from, end).map((date) => ({
    day: date,
    orders: byDay.get(date)?.orders ?? 0,
    grossCents: byDay.get(date)?.grossCents ?? 0,
    refundsCents: refunds.get(date) ?? 0,
  }));
}

const countedItems = (from: Date, end: Date) => and(inArray(orders.status, COUNTED_STATUSES), between(orders.createdAt, from, end));
const lineCents = sql`${orderItems.unitPriceCents} * ${orderItems.quantity}`;

export function topProducts(from: Date, end: Date, limit: number | null = 10) {
  const key = sql<string>`coalesce(${products.id}::text, ${orderItems.name})`;
  const name = sql<string>`coalesce(max(${products.name}), max(${orderItems.name}))`;
  const units = sql<number>`sum(${orderItems.quantity})`.mapWith(Number);
  const cents = sumCents(lineCents);
  const query = db
    .select({ key, name, units, cents, orders: sql<number>`count(distinct ${orders.id})`.mapWith(Number) })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(variants, eq(variants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, variants.productId))
    .where(countedItems(from, end))
    .groupBy(key)
    .orderBy(desc(cents), asc(name));
  return limit === null ? query : query.limit(limit);
}

export function salesByCategory(from: Date, end: Date) {
  const category = sql<string>`case
    when ${orderItems.designSpec} is not null then 'Made to order'
    when ${orderItems.bespokePart} is not null then 'Bespoke'
    else coalesce(${categories.name}, 'Other')
  end`;
  const cents = sumCents(lineCents);
  return db
    .select({ category, units: sql<number>`sum(${orderItems.quantity})`.mapWith(Number), cents })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(variants, eq(variants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, variants.productId))
    .leftJoin(categories, eq(categories.slug, products.categorySlug))
    .where(countedItems(from, end))
    .groupBy(category)
    .orderBy(desc(cents));
}

export function salesByCountry(from: Date, end: Date) {
  const country = sql<string>`coalesce(${orders.shippingAddress}->>'country', 'Unknown')`;
  const cents = sumCents(sql`${orders.totalCents} - ${orderRefundedCents}`);
  return db.select({ country, orders: count(), cents }).from(orders).where(countedItems(from, end)).groupBy(country).orderBy(desc(cents));
}

export async function bespokeFunnel(from: Date, end: Date) {
  const stage = (condition: SQL) => sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
  const [row] = await db
    .select({
      requests: count(),
      quoted: stage(sql`${bespokeRequests.quotedAt} is not null`),
      accepted: stage(sql`${bespokeRequests.acceptedAt} is not null`),
      deposit: stage(sql`${bespokeRequests.depositPaidAt} is not null`),
      paid: stage(sql`${bespokeRequests.balancePaidAt} is not null or (${bespokeRequests.depositPaidAt} is not null and ${bespokeRequests.depositPercent} = 100)`),
      completed: stage(sql`${bespokeRequests.status} = 'completed'`),
      declined: stage(sql`${bespokeRequests.status} = 'declined'`),
    })
    .from(bespokeRequests)
    .where(and(between(bespokeRequests.createdAt, from, end), sql`${bespokeRequests.status} <> 'question'`));
  const stages = [
    { label: "Requests", count: row?.requests ?? 0 },
    { label: "Quoted", count: row?.quoted ?? 0 },
    { label: "Accepted", count: row?.accepted ?? 0 },
    { label: "Deposit paid", count: row?.deposit ?? 0 },
    { label: "Paid in full", count: row?.paid ?? 0 },
    { label: "Completed", count: row?.completed ?? 0 },
  ];
  return { stages, declined: row?.declined ?? 0 };
}

const cartHasItems = sql`exists (select 1 from cart_items i where i.cart_id = ${carts.id})`;
const idleSince = (hours: number, now: Date) => and(cartHasItems, lte(carts.updatedAt, new Date(now.getTime() - hours * 3_600_000)));

export const countAbandonedCarts = (hours: number, now = new Date()) => db.$count(carts, idleSince(hours, now));

export async function listAbandonedCarts(hours: number, offset: number, now = new Date()) {
  const rows = await db.select().from(carts).where(idleSince(hours, now)).orderBy(desc(carts.updatedAt)).limit(PAGE_SIZE).offset(offset);
  const ownerKeys = rows.map((row) => row.ownerKey);
  const userIds = ownerKeys.flatMap((key) => {
    const id = z.uuid().safeParse(key.slice(2));
    return key.startsWith("u:") && id.success ? [id.data] : [];
  });
  const owners = userIds.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, userIds)) : [];
  const lastEmails = ownerKeys.length
    ? await db
        .selectDistinctOn([orders.ownerKey], { ownerKey: orders.ownerKey, email: orders.email })
        .from(orders)
        .where(and(inArray(orders.ownerKey, ownerKeys), isNotNull(orders.email)))
        .orderBy(orders.ownerKey, desc(orders.createdAt))
    : [];
  return Promise.all(
    rows.map(async (row) => {
      const view = await getCart(row.ownerKey);
      const owner = owners.find((user) => `u:${user.id}` === row.ownerKey) ?? null;
      return {
        id: row.id,
        updatedAt: row.updatedAt,
        guest: row.ownerKey.startsWith("g:"),
        owner,
        email: owner?.email ?? lastEmails.find((entry) => entry.ownerKey === row.ownerKey)?.email ?? null,
        promoCode: view.promoError ? null : view.promoCode,
        valueCents: view.subtotalCents - view.discountCents,
        count: view.count,
        lines: view.lines.map((line) => ({ id: line.id, name: line.name, quantity: line.quantity })),
      };
    }),
  );
}

const promoUsage = () =>
  db
    .select({
      code: sql<string>`${orders.promoCode}`.as("usage_code"),
      claimed: count().as("claimed"),
      paidOrders: sql<number>`count(*) filter (where ${inArray(orders.status, COUNTED_STATUSES)})`.mapWith(Number).as("paid_orders"),
      revenueCents: sql<number>`coalesce(sum(${orders.totalCents} - ${orderRefundedCents}) filter (where ${inArray(orders.status, COUNTED_STATUSES)}), 0)`.mapWith(Number).as("revenue_cents"),
      discountCents: sql<number>`coalesce(sum(${orders.discountCents}) filter (where ${inArray(orders.status, COUNTED_STATUSES)}), 0)`.mapWith(Number).as("discount_cents"),
    })
    .from(orders)
    .where(isNotNull(orders.promoCode))
    .groupBy(orders.promoCode)
    .as("usage");

const promoRow = () => {
  const usage = promoUsage();
  return db
    .select({
      code: promoCodes.code,
      percentOff: promoCodes.percentOff,
      minSubtotalCents: promoCodes.minSubtotalCents,
      expiresAt: promoCodes.expiresAt,
      active: promoCodes.active,
      timesUsed: promoCodes.timesUsed,
      maxUses: promoCodes.maxUses,
      oncePerCustomer: promoCodes.oncePerCustomer,
      claimed: sql<number>`coalesce(${usage.claimed}, 0)`.mapWith(Number),
      paidOrders: sql<number>`coalesce(${usage.paidOrders}, 0)`.mapWith(Number),
      revenueCents: sql<number>`coalesce(${usage.revenueCents}, 0)`.mapWith(Number),
      discountCents: sql<number>`coalesce(${usage.discountCents}, 0)`.mapWith(Number),
    })
    .from(promoCodes)
    .leftJoin(usage, eq(usage.code, promoCodes.code));
};

export const listPromosWithUsage = () => promoRow().orderBy(desc(promoCodes.createdAt));

export async function getPromoWithUsage(code: string) {
  const [promo] = await promoRow().where(eq(promoCodes.code, code));
  return promo ?? null;
}

export const promoIsUsed = (promo: { claimed: number; timesUsed: number }) => promo.claimed > 0 || promo.timesUsed > 0;

export async function dashboardAttention(lowStockLimit: number, now = new Date()) {
  const lowStock = and(lte(variants.stock, lowStockLimit), eq(products.active, true));
  const [low] = await db.select({ total: count() }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(lowStock);
  const lowVariants = await db
    .select({ id: variants.id, sku: variants.sku, color: variants.color, size: variants.size, stock: variants.stock, productId: products.id, productName: products.name })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(lowStock)
    .orderBy(asc(variants.stock), asc(products.name), asc(variants.sku))
    .limit(8);
  const [needsAction, late, stuck, bespokeWaiting, messages, abandoned] = await Promise.all([
    db.$count(orders, inArray(orders.status, NEEDS_ACTION_STATUSES)),
    db.$count(orders, and(inArray(orders.status, NEEDS_ACTION_STATUSES), lt(orders.createdAt, new Date(now.getTime() - LATE_ORDER_DAYS * DAY_MS)))),
    db.$count(orders, and(eq(orders.status, "pending"), lt(orders.createdAt, new Date(now.getTime() - STUCK_PAYMENT_HOURS * 3_600_000)))),
    db.$count(bespokeRequests, inArray(bespokeRequests.status, ["new", "changes_requested"])),
    db.$count(contactMessages, eq(contactMessages.handled, false)),
    countAbandonedCarts(24, now),
  ]);
  return { needsAction, late, lateDays: LATE_ORDER_DAYS, stuck, stuckHours: STUCK_PAYMENT_HOURS, bespokeWaiting, messages, abandoned, lowStockCount: low?.total ?? 0, lowVariants };
}

export const recentOrders = () => db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);

export function dashboardWindows(now = new Date()) {
  const today = startOfDay(now);
  const end = new Date(today.getTime() + DAY_MS);
  return { today, end, week: new Date(end.getTime() - 7 * DAY_MS), month: new Date(end.getTime() - 30 * DAY_MS) };
}
