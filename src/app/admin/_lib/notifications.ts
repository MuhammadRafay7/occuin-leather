import { and, count, desc, eq, inArray, lte, asc } from "drizzle-orm";
import { bespokeRef } from "@/lib/bespoke/status";
import { money, orderRef } from "@/lib/format";
import { db, schema } from "@/lib/server/db";
import { getSettings } from "@/lib/server/settings";

const { bespokeRequests, contactMessages, orders, products, variants } = schema;
const PER_KIND = 3;
const WAITING_ORDERS = ["paid", "in_production"] as const;

export type NotificationKind = "order" | "bespoke" | "message" | "stock";
export type AdminNotification = { id: string; kind: NotificationKind; title: string; detail: string; href: string };

export async function listNotifications() {
  const { lowStockLimit } = await getSettings();
  const waiting = inArray(orders.status, WAITING_ORDERS);
  const fresh = eq(bespokeRequests.status, "new");
  const open = eq(contactMessages.handled, false);
  const low = and(lte(variants.stock, lowStockLimit), eq(products.active, true));

  const [orderRows, bespokeRows, messageRows, stockRows, orderTotal, bespokeTotal, messageTotal, [stockTotal]] = await Promise.all([
    db.select({ id: orders.id, number: orders.number, email: orders.email, totalCents: orders.totalCents }).from(orders).where(waiting).orderBy(desc(orders.createdAt)).limit(PER_KIND),
    db.select({ id: bespokeRequests.id, number: bespokeRequests.number, name: bespokeRequests.name, productType: bespokeRequests.productType }).from(bespokeRequests).where(fresh).orderBy(desc(bespokeRequests.createdAt)).limit(PER_KIND),
    db.select({ id: contactMessages.id, name: contactMessages.name, topic: contactMessages.topic }).from(contactMessages).where(open).orderBy(desc(contactMessages.createdAt)).limit(PER_KIND),
    db.select({ id: variants.id, name: products.name, sku: variants.sku, stock: variants.stock }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(low).orderBy(asc(variants.stock), asc(products.name)).limit(PER_KIND),
    db.$count(orders, waiting),
    db.$count(bespokeRequests, fresh),
    db.$count(contactMessages, open),
    db.select({ total: count() }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(low),
  ]);

  const items: AdminNotification[] = [
    ...orderRows.map((row): AdminNotification => ({ id: row.id, kind: "order", title: `Order ${orderRef(row.number)} to deal with`, detail: `${row.email ?? "Guest"}, ${money(row.totalCents)}`, href: `/admin/orders/${row.id}` })),
    ...bespokeRows.map((row): AdminNotification => ({ id: row.id, kind: "bespoke", title: `New bespoke request ${bespokeRef(row.number)}`, detail: `${row.name}, ${row.productType}`, href: `/admin/bespoke/${row.id}` })),
    ...messageRows.map((row): AdminNotification => ({ id: row.id, kind: "message", title: `Message from ${row.name}`, detail: row.topic, href: `/admin/messages/${row.id}` })),
    ...stockRows.map((row): AdminNotification => ({ id: row.id, kind: "stock", title: row.stock === 0 ? `${row.name} is sold out` : `${row.name} is low, ${row.stock} left`, detail: row.sku, href: `/admin/inventory/${row.id}` })),
  ];
  return { items, total: orderTotal + bespokeTotal + messageTotal + (stockTotal?.total ?? 0) };
}
