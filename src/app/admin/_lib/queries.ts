import { and, asc, count, desc, eq, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { BESPOKE_STATUSES, type BespokeStatus } from "@/lib/bespoke/status";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { db, schema } from "@/lib/server/db";
import { param, type SearchParams } from "./format";

const { bespokeRequestImages, bespokeRequests, categories, contactMessages, newsletterSubscribers, orders, products, promoCodes, users, variants } = schema;

export const PAGE_SIZE = 30;
export const LOW_STOCK_LIMIT = 5;
export const NEEDS_ACTION_FILTER = "action";

const COUNTED_STATUSES: OrderStatus[] = ["paid", "in_production", "shipped", "delivered"];
const NEEDS_ACTION_STATUSES: OrderStatus[] = ["paid", "in_production"];

export function pageOf(search: SearchParams, total: number) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(last, Math.max(1, Number.parseInt(param(search, "page"), 10) || 1));
  return { page, last, offset: (page - 1) * PAGE_SIZE };
}

const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;
const isOrderStatus = (value: string): value is OrderStatus => (ORDER_STATUSES as readonly string[]).includes(value);
const lowStock = and(lte(variants.stock, LOW_STOCK_LIMIT), eq(products.active, true));

export async function dashboardNumbers() {
  const [totals] = await db
    .select({ revenue: sql<number>`coalesce(sum(${orders.totalCents}), 0)`.mapWith(Number), paidOrders: count() })
    .from(orders)
    .where(inArray(orders.status, COUNTED_STATUSES));
  const needsAction = await db.$count(orders, inArray(orders.status, NEEDS_ACTION_STATUSES));
  const [low] = await db
    .select({ total: count() })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(lowStock);
  const lowVariants = await listVariants({ low: true, limit: 8, offset: 0 });
  const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
  const revenue = totals?.revenue ?? 0;
  const paidOrders = totals?.paidOrders ?? 0;
  return {
    revenue,
    paidOrders,
    averageOrder: paidOrders ? Math.round(revenue / paidOrders) : null,
    needsAction,
    lowStockCount: low?.total ?? 0,
    lowVariants,
    recentOrders,
  };
}

function orderFilter(status: string, q: string) {
  return and(
    status === NEEDS_ACTION_FILTER ? inArray(orders.status, NEEDS_ACTION_STATUSES) : isOrderStatus(status) ? eq(orders.status, status) : undefined,
    q
      ? or(ilike(orders.email, contains(q)), sql`('OC-' || lpad(${orders.number}::text, 6, '0')) ilike ${contains(q)}`)
      : undefined,
  );
}

export const countOrders = (status: string, q: string) => db.$count(orders, orderFilter(status, q));

export const listOrders = (status: string, q: string, offset: number) =>
  db.select().from(orders).where(orderFilter(status, q)).orderBy(desc(orders.createdAt)).limit(PAGE_SIZE).offset(offset);

export async function findCustomer(ownerKey: string) {
  if (!ownerKey.startsWith("u:")) return null;
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(sql`${users.id}::text = ${ownerKey.slice(2)}`);
  return user ?? null;
}

function productFilter(q: string, category: string) {
  return and(
    q ? or(ilike(products.name, contains(q)), ilike(products.slug, contains(q))) : undefined,
    category ? eq(products.categorySlug, category) : undefined,
  );
}

export const countProducts = (q: string, category: string) => db.$count(products, productFilter(q, category));

export const listProducts = (q: string, category: string, offset: number) =>
  db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      active: products.active,
      featured: products.featured,
      categoryName: categories.name,
      variantCount: count(variants.id),
      stock: sql<number>`coalesce(sum(${variants.stock}), 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(categories, eq(categories.slug, products.categorySlug))
    .leftJoin(variants, eq(variants.productId, products.id))
    .where(productFilter(q, category))
    .groupBy(products.id, categories.name)
    .orderBy(desc(products.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

function variantFilter(low: boolean, q: string) {
  return and(
    low ? lowStock : undefined,
    q ? or(ilike(variants.sku, contains(q)), ilike(products.name, contains(q))) : undefined,
  );
}

export async function countVariants(low: boolean, q: string) {
  const [row] = await db
    .select({ total: count() })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(variantFilter(low, q));
  return row?.total ?? 0;
}

export function listVariants({ low, q = "", limit = PAGE_SIZE, offset }: { low: boolean; q?: string; limit?: number; offset: number }) {
  return db
    .select({
      id: variants.id,
      sku: variants.sku,
      color: variants.color,
      size: variants.size,
      priceCents: variants.priceCents,
      stock: variants.stock,
      productId: products.id,
      productName: products.name,
      productActive: products.active,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(variantFilter(low, q))
    .orderBy(...(low ? [asc(variants.stock)] : []), asc(products.name), asc(variants.sku))
    .limit(limit)
    .offset(offset);
}

export const countCustomers = () => db.$count(users);

const spentCents = sql<number>`coalesce(sum(${orders.totalCents}) filter (where ${inArray(orders.status, COUNTED_STATUSES)}), 0)`.mapWith(Number);

export const listCustomers = (offset: number) =>
  db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      orderCount: count(orders.id),
      spentCents,
    })
    .from(users)
    .leftJoin(orders, sql`${orders.ownerKey} = 'u:' || ${users.id}::text`)
    .groupBy(users.id)
    .orderBy(desc(spentCents), desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

export const listPromos = () => db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));

export const countMessages = () => db.$count(contactMessages);

export const listMessages = (offset: number) =>
  db
    .select()
    .from(contactMessages)
    .orderBy(asc(contactMessages.handled), desc(contactMessages.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

export const countSubscribers = () => db.$count(newsletterSubscribers);

export const listSubscribers = (offset: number) =>
  db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(PAGE_SIZE).offset(offset);

export const allSubscribers = () => db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));

const isBespokeStatus = (value: string): value is BespokeStatus => (BESPOKE_STATUSES as readonly string[]).includes(value);
const bespokeFilter = (status: string) => (isBespokeStatus(status) ? eq(bespokeRequests.status, status) : undefined);

export const countBespoke = (status: string) => db.$count(bespokeRequests, bespokeFilter(status));

export const listBespoke = (status: string, offset: number) =>
  db
    .select({
      id: bespokeRequests.id,
      number: bespokeRequests.number,
      status: bespokeRequests.status,
      name: bespokeRequests.name,
      email: bespokeRequests.email,
      country: bespokeRequests.country,
      productType: bespokeRequests.productType,
      estimateLowCents: bespokeRequests.estimateLowCents,
      estimateHighCents: bespokeRequests.estimateHighCents,
      quotedPriceCents: bespokeRequests.quotedPriceCents,
      createdAt: bespokeRequests.createdAt,
    })
    .from(bespokeRequests)
    .where(bespokeFilter(status))
    .orderBy(desc(bespokeRequests.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

export async function getBespoke(id: string) {
  const [request] = await db.select().from(bespokeRequests).where(eq(bespokeRequests.id, id));
  if (!request) return null;
  const images = await db
    .select({ id: bespokeRequestImages.id, position: bespokeRequestImages.position, filename: bespokeRequestImages.filename, byteSize: bespokeRequestImages.byteSize })
    .from(bespokeRequestImages)
    .where(eq(bespokeRequestImages.requestId, id))
    .orderBy(asc(bespokeRequestImages.position));
  return { request, images };
}
