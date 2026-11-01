import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "./db";

const SESSION_COOKIE = "orsel_session";
const GUEST_COOKIE = "orsel_guest";
const SESSION_DAYS = 30;
const secure = process.env.NODE_ENV === "production";

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const hashPassword = (password: string) => hash(password);
export const checkPassword = (stored: string, password: string) => verify(stored, password);

export async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ tokenHash: tokenHash(token), userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", expires: expiresAt });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, tokenHash(token)));
  jar.delete(SESSION_COOKIE);
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, tokenHash(token)), gt(schema.sessions.expiresAt, new Date())));
  return row ?? null;
});

export async function requireUser(next = "/account") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function getOwnerKey() {
  const user = await getUser();
  if (user) return `u:${user.id}`;
  const guest = (await cookies()).get(GUEST_COOKIE)?.value;
  return guest ? `g:${guest}` : null;
}

export async function ensureOwnerKey() {
  const existing = await getOwnerKey();
  if (existing) return existing;
  const guest = randomUUID();
  (await cookies()).set(GUEST_COOKIE, guest, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 60 * 86_400 });
  return `g:${guest}`;
}

export async function adoptGuestData(userId: string) {
  const jar = await cookies();
  const guest = jar.get(GUEST_COOKIE)?.value;
  if (!guest) return;
  const from = `g:${guest}`;
  const to = `u:${userId}`;
  await db.transaction(async (tx) => {
    await tx.update(schema.designs).set({ ownerKey: to }).where(eq(schema.designs.ownerKey, from));
    await tx.update(schema.orders).set({ ownerKey: to }).where(eq(schema.orders.ownerKey, from));
    await tx.execute(sql`
      insert into wishlist_items (owner_key, product_id)
      select ${to}, product_id from wishlist_items where owner_key = ${from}
      on conflict do nothing`);
    await tx.delete(schema.wishlistItems).where(eq(schema.wishlistItems.ownerKey, from));
    const [guestCart] = await tx.select().from(schema.carts).where(eq(schema.carts.ownerKey, from));
    if (!guestCart) return;
    const [userCart] = await tx.select().from(schema.carts).where(eq(schema.carts.ownerKey, to));
    if (!userCart) {
      await tx.update(schema.carts).set({ ownerKey: to }).where(eq(schema.carts.id, guestCart.id));
      return;
    }
    await tx.execute(sql`
      insert into cart_items (cart_id, variant_id, design_id, quantity)
      select ${userCart.id}, variant_id, design_id, quantity from cart_items where cart_id = ${guestCart.id}
      on conflict do nothing`);
    await tx.delete(schema.carts).where(eq(schema.carts.id, guestCart.id));
  });
  jar.delete(GUEST_COOKIE);
}

export async function hitRateLimit(key: string, max: number, windowSeconds: number) {
  const result = await db.execute<{ hits: number }>(sql`
    insert into rate_limits (key, hits, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      hits = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.hits + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning hits`);
  return Number(result.rows[0]?.hits ?? 0) > max;
}
