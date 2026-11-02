import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { linkKey } from "./link-key";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const signature = (email: string) => createHmac("sha256", linkKey("newsletter-unsubscribe")).update(email.toLowerCase()).digest();
const query = (email: string) => `email=${encodeURIComponent(email)}&token=${signature(email).toString("base64url")}`;

export function verifyUnsubscribe(email: string, token: string) {
  const given = Buffer.from(token, "base64url");
  const expected = signature(email);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const unsubscribePageUrl = (email: string) => `${appUrl()}/unsubscribe?${query(email)}`;
export const unsubscribeOneClickUrl = (email: string) => `${appUrl()}/api/newsletter/unsubscribe?${query(email)}`;

export async function removeSubscriber(email: string) {
  await db.delete(schema.newsletterSubscribers).where(eq(schema.newsletterSubscribers.email, email.toLowerCase()));
}
