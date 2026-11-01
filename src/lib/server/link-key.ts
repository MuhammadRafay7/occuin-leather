import { createHash } from "node:crypto";

const MIN_SECRET_LENGTH = 32;
let warned = false;

export function linkKey(purpose: string) {
  const secret = process.env.LINK_SIGNING_SECRET ?? "";
  if (secret.length >= MIN_SECRET_LENGTH) return createHash("sha256").update(`${purpose}:${secret}`).digest();
  const fallback = process.env.DATABASE_URL;
  if (!fallback) throw new Error("LINK_SIGNING_SECRET is not set");
  if (process.env.NODE_ENV === "production" && !warned) {
    warned = true;
    console.error("[links] LINK_SIGNING_SECRET is missing or too short, so links are signed with a key derived from DATABASE_URL");
  }
  return createHash("sha256").update(`${purpose}:${fallback}`).digest();
}
