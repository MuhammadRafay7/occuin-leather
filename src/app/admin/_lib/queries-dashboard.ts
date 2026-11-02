import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/server/db";

const { products, reviews, users } = schema;

export async function dashboardTotals() {
  const [customers, activeProducts, unanswered] = await Promise.all([
    db.$count(users, eq(users.role, "customer")),
    db.$count(products, eq(products.active, true)),
    db.$count(reviews, isNull(reviews.reply)),
  ]);
  return { customers, activeProducts, unanswered };
}

export async function newCustomersByDay(from: Date, end: Date) {
  const day = sql<string>`to_char(${users.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const window = and(eq(users.role, "customer"), gte(users.createdAt, from), lt(users.createdAt, end));
  const rows = await db.select({ day, total: sql<number>`count(*)`.mapWith(Number) }).from(users).where(window).groupBy(day);
  return new Map(rows.map((row) => [row.day, row.total]));
}

export const countNewCustomers = (from: Date, end: Date) => db.$count(users, and(eq(users.role, "customer"), gte(users.createdAt, from), lt(users.createdAt, end)));
