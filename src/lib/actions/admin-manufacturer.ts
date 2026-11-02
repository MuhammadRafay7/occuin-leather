"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { orderRef } from "@/lib/format";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { clearViews, createLink, LINK_DAYS, listLinks, linkUrl, revokeLink, setLineSent, storeView } from "@/lib/server/manufacturer";
import { shareMessage } from "@/lib/server/manufacturer-token";
import { db, schema } from "@/lib/server/db";
import { eq } from "drizzle-orm";
import type { ActionResult } from "./admin";

const uuid = z.uuid();
const pagePath = (orderId: string) => `/admin/orders/${orderId}/manufacturer`;
const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });

const UNSHAREABLE = new Set(["pending", "cancelled", "refunded"]);

async function orderHeader(orderId: string) {
  const [order] = await db.select({ number: schema.orders.number, status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, orderId));
  return order ?? null;
}

async function orderReference(orderId: string) {
  const order = await orderHeader(orderId);
  return order ? orderRef(order.number) : null;
}

export async function uploadSheetView(orderId: string, itemId: string, view: string, dataUrl: string): Promise<ActionResult> {
  await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success || typeof dataUrl !== "string") return fail("That image is not for this order.");
  const result = await storeView(orderId, itemId, view, dataUrl);
  return "error" in result ? fail(result.error ?? "The image could not be saved.") : done("Saved.");
}

export async function recordViewsMade(orderId: string, itemId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success) return fail("Order not found.");
  const reference = await orderReference(orderId);
  if (!reference) return fail("Order not found.");
  await recordAudit(admin, { action: "manufacturer_sheet.images", targetType: "order", targetId: orderId, detail: `${reference}, line ${itemId}` });
  revalidatePath(pagePath(orderId));
  return done("Images saved.");
}

export async function makeViewsAgain(orderId: string, itemId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success) return fail("Order not found.");
  if (!(await clearViews(orderId, itemId))) return fail("That line is not on this order.");
  await recordAudit(admin, { action: "manufacturer_sheet.images_cleared", targetType: "order", targetId: orderId, detail: `Line ${itemId}` });
  revalidatePath(pagePath(orderId));
  return done("Old images removed. New ones are being made.");
}

const linkSchema = z.object({ orderId: z.uuid(), days: z.number().refine((days) => (LINK_DAYS as readonly number[]).includes(days)), includeAddress: z.boolean() });

export async function createSheetLink(input: { orderId: string; days: number; includeAddress: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return fail("Choose how long the link should last.");
  const { orderId, days, includeAddress } = parsed.data;
  const order = await orderHeader(orderId);
  if (!order) return fail("Order not found.");
  if (UNSHAREABLE.has(order.status)) return fail("Private links can be made once this order is paid.");
  const reference = orderRef(order.number);
  const link = await createLink(orderId, days, includeAddress, admin.email);
  await recordAudit(admin, { action: "manufacturer_sheet.link_created", targetType: "order", targetId: orderId, detail: `${reference}, link ${link.id}, ${days} days${includeAddress ? ", with delivery address" : ""}` });
  revalidatePath(pagePath(orderId));
  return done("Link made.");
}

export async function revokeSheetLink(orderId: string, linkId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(linkId).success) return fail("Link not found.");
  if (!(await revokeLink(orderId, linkId))) return fail("That link has already been turned off.");
  await recordAudit(admin, { action: "manufacturer_sheet.link_revoked", targetType: "order", targetId: orderId, detail: `Link ${linkId}` });
  revalidatePath(pagePath(orderId));
  return done("Link turned off. It no longer opens.");
}

export async function shareSheetMessage(orderId: string, linkId: string): Promise<ActionResult & { text?: string }> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(linkId).success) return fail("Link not found.");
  const link = (await listLinks(orderId)).find((item) => item.id === linkId && !item.revokedAt && item.expiresAt > new Date());
  const reference = await orderReference(orderId);
  if (!link || !reference) return fail("That link no longer works. Make a new one.");
  await recordAudit(admin, { action: "manufacturer_sheet.whatsapp_copied", targetType: "order", targetId: orderId, detail: `${reference}, link ${link.id}` });
  return { ...done("Message copied. Paste it into WhatsApp."), text: shareMessage(reference, linkUrl(link), link.expiresAt) };
}

export async function markSentToManufacturer(orderId: string, itemId: string, sent: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(itemId).success || typeof sent !== "boolean") return fail("Line not found.");
  if (!(await setLineSent(orderId, itemId, sent, admin.email))) return fail("That line is not on this order.");
  await recordAudit(admin, { action: sent ? "manufacturer_sheet.line_sent" : "manufacturer_sheet.line_unsent", targetType: "order", targetId: orderId, detail: `Line ${itemId}` });
  revalidatePath(pagePath(orderId));
  return done(sent ? "Marked as sent." : "Mark removed.");
}
