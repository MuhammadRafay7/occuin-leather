import { createHmac, timingSafeEqual } from "node:crypto";
import { SHOT_MAX_BYTES } from "../manufacturer/views";
import { linkKey } from "./link-key";

const LINK_PURPOSE = "manufacturer-sheet-v1";
const IMAGE_PREFIX = /^data:image\/(jpeg|png|webp);base64,/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type SignedLink = { id: string; orderId: string; expiresAt: Date };

const packId = (id: string) => Buffer.from(id.replaceAll("-", ""), "hex").toString("base64url");

function unpackId(packed: string) {
  const hex = Buffer.from(packed, "base64url").toString("hex");
  return hex.length === 32 ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` : null;
}

const signature = (orderId: string, linkId: string, expires: number) => createHmac("sha256", linkKey(LINK_PURPOSE)).update(`${orderId}.${linkId}.${expires}`).digest();

export function signLink(link: SignedLink) {
  const expires = Math.floor(link.expiresAt.getTime() / 1000);
  return [packId(link.orderId), packId(link.id), expires.toString(36), signature(link.orderId, link.id, expires).toString("base64url")].join(".");
}

export function readToken(token: string, now = Date.now()) {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [orderPart, linkPart, expiresPart, signed] = parts as [string, string, string, string];
  const orderId = unpackId(orderPart);
  const linkId = unpackId(linkPart);
  const expires = parseInt(expiresPart, 36);
  if (!orderId || !linkId || !Number.isSafeInteger(expires)) return null;
  const given = Buffer.from(signed, "base64url");
  const wanted = signature(orderId, linkId, expires);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  return expires * 1000 > now ? { orderId, linkId } : null;
}

export function decodeShot(dataUrl: string) {
  const prefix = IMAGE_PREFIX.exec(dataUrl);
  if (!prefix) return null;
  const encoded = dataUrl.slice(prefix[0].length);
  if (encoded.length > Math.ceil((SHOT_MAX_BYTES * 4) / 3) + 4 || !BASE64.test(encoded)) return null;
  return Buffer.from(encoded, "base64");
}

export const shareMessage = (reference: string, url: string, expiresAt: Date) =>
  `OCCUIN order ${reference}. Please use this private manufacturer sheet for the exact details and images. Do not forward it. It stops working on ${expiresAt.toISOString().slice(0, 10)}.\n${url}`;
