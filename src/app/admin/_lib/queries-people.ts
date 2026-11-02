import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";
import { param, type SearchParams } from "./format";
import { PAGE_SIZE } from "./queries";

const { addresses, adminAuditLog, bespokeRequests, contactMessages, newsletterSubscribers, orders, products, reviews, stripeEvents, users, variants } = schema;

const SEARCH_LIMIT = 8;
const EXPORT_LIMIT = 100_000;
export const MIN_SEARCH_LENGTH = 2;

const contains = (text: string) => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

const ownerKeyOf = sql`'u:' || ${users.id}::text`;
const orderNet = sql`o.total_cents - coalesce((select sum(r.amount_cents) from order_refunds r where r.order_id = o.id), 0)`;
const COUNTED = sql`('paid', 'in_production', 'shipped', 'delivered')`;
const spentCents = sql<number>`coalesce((select sum(${orderNet}) from orders o where o.owner_key = ${ownerKeyOf} and o.status in ${COUNTED}), 0)`.mapWith(Number);
const orderCount = sql<number>`(select count(*) from orders o where o.owner_key = ${ownerKeyOf})`.mapWith(Number);

export async function navCounts() {
  try {
    const [ordersWaiting, messagesOpen, bespokeNew] = await Promise.all([
      db.$count(orders, inArray(orders.status, ["paid", "in_production"])),
      db.$count(contactMessages, eq(contactMessages.handled, false)),
      db.$count(bespokeRequests, eq(bespokeRequests.status, "new")),
    ]);
    return { ordersWaiting, messagesOpen, bespokeNew };
  } catch (error) {
    console.error("[admin] nav counts failed", error);
    return { ordersWaiting: 0, messagesOpen: 0, bespokeNew: 0 };
  }
}

function customerFilter(search: SearchParams) {
  const q = param(search, "q");
  const role = param(search, "role");
  const state = param(search, "state");
  const buyers = param(search, "buyers");
  return and(
    q ? or(ilike(users.name, contains(q)), ilike(users.email, contains(q))) : undefined,
    role === "admin" || role === "customer" ? eq(users.role, role) : undefined,
    state === "blocked" ? isNotNull(users.blockedAt) : state === "active" ? isNull(users.blockedAt) : undefined,
    buyers === "yes" ? sql`${orderCount} > 0` : buyers === "no" ? sql`${orderCount} = 0` : undefined,
  );
}

const customerColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  blockedAt: users.blockedAt,
  createdAt: users.createdAt,
  orderCount,
  spentCents,
};

const customerOrder = (sort: string): SQL[] =>
  sort === "newest" ? [desc(users.createdAt)] : sort === "name" ? [asc(users.name)] : [desc(spentCents), desc(users.createdAt)];

export const countCustomers = (search: SearchParams) => db.$count(users, customerFilter(search));

export const listCustomers = (search: SearchParams, offset: number) =>
  db.select(customerColumns).from(users).where(customerFilter(search)).orderBy(...customerOrder(param(search, "sort"))).limit(PAGE_SIZE).offset(offset);

export const exportCustomers = (search: SearchParams) =>
  db.select(customerColumns).from(users).where(customerFilter(search)).orderBy(...customerOrder(param(search, "sort"))).limit(EXPORT_LIMIT);

const within = (column: AnyColumn, span: string) => sql<number>`count(*) filter (where ${column} >= now() - ${span}::interval)`.mapWith(Number);

export async function customerStats() {
  const [row] = await db
    .select({
      total: count(),
      blocked: count(users.blockedAt),
      admins: sql<number>`count(*) filter (where ${users.role} = 'admin')`.mapWith(Number),
      buyers: sql<number>`count(*) filter (where ${orderCount} > 0)`.mapWith(Number),
      recent: within(users.createdAt, "30 days"),
    })
    .from(users);
  return row!;
}

export async function getCustomerProfile(id: string) {
  const [customer] = await db
    .select({ ...customerColumns, adminNote: users.adminNote })
    .from(users)
    .where(eq(users.id, id));
  if (!customer) return null;
  const owner = `u:${id}`;
  const [customerOrders, savedAddresses, requests, customerReviews, [guest]] = await Promise.all([
    db.select().from(orders).where(eq(orders.ownerKey, owner)).orderBy(desc(orders.createdAt)).limit(100),
    db.select().from(addresses).where(eq(addresses.userId, id)).orderBy(desc(addresses.isDefault), asc(addresses.createdAt)),
    db
      .select({ id: bespokeRequests.id, number: bespokeRequests.number, status: bespokeRequests.status, productType: bespokeRequests.productType, quotedPriceCents: bespokeRequests.quotedPriceCents, createdAt: bespokeRequests.createdAt })
      .from(bespokeRequests)
      .where(or(eq(bespokeRequests.ownerKey, owner), eq(bespokeRequests.acceptedOwnerKey, owner), sql`lower(${bespokeRequests.email}) = ${customer.email.toLowerCase()}`))
      .orderBy(desc(bespokeRequests.createdAt))
      .limit(100),
    db
      .select({ id: reviews.id, rating: reviews.rating, title: reviews.title, body: reviews.body, hiddenAt: reviews.hiddenAt, createdAt: reviews.createdAt, productName: products.name, productSlug: products.slug })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .where(eq(reviews.userId, id))
      .orderBy(desc(reviews.createdAt))
      .limit(100),
    db.select({ total: count() }).from(orders).where(and(sql`${orders.ownerKey} <> ${owner}`, sql`lower(${orders.email}) = ${customer.email.toLowerCase()}`)),
  ]);
  return { customer, orders: customerOrders, addresses: savedAddresses, requests, reviews: customerReviews, guestOrders: guest?.total ?? 0 };
}

function messageFilter(search: SearchParams) {
  const q = param(search, "q");
  const status = param(search, "status");
  const topic = param(search, "topic");
  return and(
    q ? or(ilike(contactMessages.name, contains(q)), ilike(contactMessages.email, contains(q)), ilike(contactMessages.message, contains(q))) : undefined,
    status === "open" ? eq(contactMessages.handled, false) : status === "handled" ? eq(contactMessages.handled, true) : undefined,
    status === "replied" ? isNotNull(contactMessages.repliedAt) : status === "unreplied" ? isNull(contactMessages.repliedAt) : undefined,
    topic ? eq(contactMessages.topic, topic) : undefined,
  );
}

export const countMessages = (search: SearchParams) => db.$count(contactMessages, messageFilter(search));

export const listMessages = (search: SearchParams, offset: number) =>
  db.select().from(contactMessages).where(messageFilter(search)).orderBy(asc(contactMessages.handled), desc(contactMessages.createdAt)).limit(PAGE_SIZE).offset(offset);

export async function messageStats() {
  const [row] = await db
    .select({
      total: count(),
      open: sql<number>`count(*) filter (where not ${contactMessages.handled})`.mapWith(Number),
      handled: sql<number>`count(*) filter (where ${contactMessages.handled})`.mapWith(Number),
      replied: count(contactMessages.repliedAt),
      unreplied: sql<number>`count(*) filter (where ${contactMessages.repliedAt} is null)`.mapWith(Number),
      recent: within(contactMessages.createdAt, "7 days"),
    })
    .from(contactMessages);
  return row!;
}

export async function getMessage(id: string) {
  const [message] = await db.select().from(contactMessages).where(eq(contactMessages.id, id));
  return message ?? null;
}

const subscriberFilter = (q: string) => (q ? ilike(newsletterSubscribers.email, contains(q)) : undefined);

export const countSubscribers = (q: string) => db.$count(newsletterSubscribers, subscriberFilter(q));

export async function subscriberStats() {
  const [row] = await db.select({ total: count(), recent: within(newsletterSubscribers.createdAt, "30 days") }).from(newsletterSubscribers);
  return row!;
}

export const listSubscribers = (q: string, offset: number) =>
  db.select().from(newsletterSubscribers).where(subscriberFilter(q)).orderBy(desc(newsletterSubscribers.createdAt)).limit(PAGE_SIZE).offset(offset);

export const exportSubscribers = (q: string) =>
  db.select().from(newsletterSubscribers).where(subscriberFilter(q)).orderBy(desc(newsletterSubscribers.createdAt)).limit(EXPORT_LIMIT);

const validDay = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? new Date(`${value}T00:00:00.000Z`) : null);

function activityFilter(search: SearchParams) {
  const actor = param(search, "actor");
  const action = param(search, "action");
  const target = param(search, "target");
  const targetId = param(search, "targetId");
  const from = validDay(param(search, "from"));
  const to = validDay(param(search, "to"));
  return and(
    actor ? eq(adminAuditLog.actorEmail, actor) : undefined,
    action ? eq(adminAuditLog.action, action) : undefined,
    target ? eq(adminAuditLog.targetType, target) : undefined,
    targetId ? or(ilike(adminAuditLog.targetId, contains(targetId)), ilike(adminAuditLog.detail, contains(targetId))) : undefined,
    from ? gte(adminAuditLog.createdAt, from) : undefined,
    to ? lt(adminAuditLog.createdAt, new Date(to.getTime() + 86_400_000)) : undefined,
  );
}

export const countActivity = (search: SearchParams) => db.$count(adminAuditLog, activityFilter(search));

export const listActivity = (search: SearchParams, offset: number) =>
  db.select().from(adminAuditLog).where(activityFilter(search)).orderBy(desc(adminAuditLog.createdAt)).limit(PAGE_SIZE).offset(offset);

export const exportActivity = (search: SearchParams) =>
  db.select().from(adminAuditLog).where(activityFilter(search)).orderBy(desc(adminAuditLog.createdAt)).limit(EXPORT_LIMIT);

export async function activityStats() {
  const [row] = await db
    .select({
      recent: within(adminAuditLog.createdAt, "24 hours"),
      actors: sql<number>`count(distinct ${adminAuditLog.actorEmail}) filter (where ${adminAuditLog.createdAt} >= now() - interval '24 hours')`.mapWith(Number),
    })
    .from(adminAuditLog);
  return row!;
}

export async function activityOptions() {
  const [actors, actions, targets] = await Promise.all([
    db.selectDistinct({ value: adminAuditLog.actorEmail }).from(adminAuditLog).orderBy(asc(adminAuditLog.actorEmail)),
    db.selectDistinct({ value: adminAuditLog.action }).from(adminAuditLog).orderBy(asc(adminAuditLog.action)),
    db.selectDistinct({ value: adminAuditLog.targetType }).from(adminAuditLog).orderBy(asc(adminAuditLog.targetType)),
  ]);
  return { actors: actors.map((row) => row.value), actions: actions.map((row) => row.value), targets: targets.map((row) => row.value) };
}

export async function searchEverything(q: string) {
  const like = contains(q);
  const [orderRows, customerRows, productRows, bespokeRows, messageRows] = await Promise.all([
    db
      .select({ id: orders.id, number: orders.number, email: orders.email, status: orders.status, totalCents: orders.totalCents, createdAt: orders.createdAt })
      .from(orders)
      .where(or(ilike(orders.email, like), ilike(orders.trackingNumber, like), sql`('OC-' || lpad(${orders.number}::text, 6, '0')) ilike ${like}`, sql`${orders.shippingAddress}->>'name' ilike ${like}`))
      .orderBy(desc(orders.createdAt))
      .limit(SEARCH_LIMIT),
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, blockedAt: users.blockedAt })
      .from(users)
      .where(or(ilike(users.name, like), ilike(users.email, like)))
      .orderBy(desc(users.createdAt))
      .limit(SEARCH_LIMIT),
    db
      .select({ id: products.id, name: products.name, slug: products.slug, active: products.active })
      .from(products)
      .where(
        or(
          ilike(products.name, like),
          ilike(products.slug, like),
          sql`exists (select 1 from ${variants} where ${variants.productId} = ${products.id} and ${variants.sku} ilike ${like})`,
        ),
      )
      .orderBy(asc(products.name))
      .limit(SEARCH_LIMIT),
    db
      .select({ id: bespokeRequests.id, number: bespokeRequests.number, name: bespokeRequests.name, email: bespokeRequests.email, status: bespokeRequests.status, productType: bespokeRequests.productType })
      .from(bespokeRequests)
      .where(or(ilike(bespokeRequests.name, like), ilike(bespokeRequests.email, like), sql`('BR-' || lpad(${bespokeRequests.number}::text, 6, '0')) ilike ${like}`))
      .orderBy(desc(bespokeRequests.createdAt))
      .limit(SEARCH_LIMIT),
    db
      .select({ id: contactMessages.id, name: contactMessages.name, email: contactMessages.email, topic: contactMessages.topic, message: contactMessages.message, handled: contactMessages.handled })
      .from(contactMessages)
      .where(or(ilike(contactMessages.name, like), ilike(contactMessages.email, like), ilike(contactMessages.message, like)))
      .orderBy(desc(contactMessages.createdAt))
      .limit(SEARCH_LIMIT),
  ]);
  return { orders: orderRows, customers: customerRows, products: productRows, bespoke: bespokeRows, messages: messageRows };
}

export const SEARCH_RESULT_LIMIT = SEARCH_LIMIT;

export async function latestWebhook() {
  const [row] = await db.select({ receivedAt: stripeEvents.receivedAt }).from(stripeEvents).orderBy(desc(stripeEvents.receivedAt)).limit(1);
  return row?.receivedAt ?? null;
}

export async function databaseReachable() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (error) {
    console.error("[admin] database check failed", error);
    return false;
  }
}
