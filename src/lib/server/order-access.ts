import { createHmac, timingSafeEqual } from "node:crypto";
import { getOwnerKey, getUser } from "./auth";
import { linkKey } from "./link-key";

const TOKEN_SECONDS = 3600;

const signature = (orderId: string, expires: string) =>
  createHmac("sha256", linkKey("order-link")).update(`${orderId}.${expires}`).digest();

export function orderToken(orderId: string, seconds = TOKEN_SECONDS) {
  const expires = String(Math.floor(Date.now() / 1000) + seconds);
  return `${expires}.${signature(orderId, expires).toString("base64url")}`;
}

export function verifyOrderToken(orderId: string, token: string) {
  const [expires, signed] = token.split(".");
  if (!expires || !signed || !/^\d{1,12}$/.test(expires)) return false;
  if (Number(expires) < Date.now() / 1000) return false;
  const given = Buffer.from(signed, "base64url");
  const expected = signature(orderId, expires);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function canViewOrder(order: { id: string; ownerKey: string }, token: string | undefined) {
  if (token && verifyOrderToken(order.id, token)) return true;
  const [ownerKey, user] = await Promise.all([getOwnerKey(), getUser()]);
  return ownerKey === order.ownerKey || user?.role === "admin";
}
