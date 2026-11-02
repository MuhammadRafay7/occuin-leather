"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ORDER_NOTE_ACTION } from "@/app/admin/_lib/queries-orders";
import { money, orderRef } from "@/lib/format";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { emailRefund, getOrder, markPaid, refundOrder, resendConfirmation } from "@/lib/server/orders";
import type { ActionResult } from "./admin";

const { adminAuditLog, carts, orders, promoCodes } = schema;

export type RefundFormInput = { orderId: string; mode: "full" | "partial"; amount: string; reason: string; manual: boolean; expectedRefundedCents: number };
export type PromoEditInput = { code: string; percentOff: string; minSubtotal: string; expiresOn: string; maxUses: string; oncePerCustomer: boolean };

const uuid = z.uuid();
const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, message, fieldErrors });
const done = (message: string): ActionResult => ({ ok: true, message });
const refreshStore = () => revalidatePath("/", "layout");
const refreshAdmin = () => revalidatePath("/admin", "layout");

function invalid(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fail("Check the highlighted fields.", fieldErrors);
}

const toCents = (value: string) => Math.round(Number(value) * 100);

const refundSchema = z
  .object({
    orderId: uuid,
    mode: z.enum(["full", "partial"]),
    amount: z.string().trim(),
    reason: z.string().trim().min(3, "Say why this is being refunded.").max(500, "Keep the reason under 500 characters."),
    manual: z.boolean(),
    expectedRefundedCents: z.number().int().min(0),
  })
  .superRefine((input, ctx) => {
    if (input.mode === "partial" && !/^\d{1,7}(\.\d{1,2})?$/.test(input.amount)) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount such as 25 or 25.50." });
    else if (input.mode === "partial" && toCents(input.amount) <= 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount above zero." });
  });

export async function issueOrderRefund(input: RefundFormInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, mode, amount, reason, manual, expectedRefundedCents } = parsed.data;
  try {
    const result = await refundOrder(orderId, {
      amountCents: mode === "full" ? "remaining" : toCents(amount),
      reason,
      actorEmail: admin.email,
      manual,
      expectedRefundedCents,
    });
    if ("error" in result) return fail(result.error);
    await recordAudit(admin, {
      action: result.full ? "order.refund.full" : "order.refund.partial",
      targetType: "order",
      targetId: orderId,
      detail: `${money(result.amountCents)}${result.stripeBacked ? " through Stripe" : " recorded as manual"}: ${reason}`,
    });
    const refunded = await getOrder(orderId);
    if (refunded) await emailRefund(refunded, result.amountCents);
    refreshStore();
    const kind = result.full ? "Full refund" : "Partial refund";
    return done(result.stripeBacked ? `${kind} of ${money(result.amountCents)} sent through Stripe.` : `${kind} of ${money(result.amountCents)} recorded. No money was moved by this system.`);
  } catch (error) {
    console.error("[admin] refund", error);
    return fail("The refund could not be saved. Check Stripe before trying again. A retry will not charge the refund twice.");
  }
}

const trackingSchema = z.object({ orderId: uuid, trackingNumber: z.string().trim().max(100, "Keep the tracking number under 100 characters.") });

export async function saveTrackingNumber(orderId: string, trackingNumber: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = trackingSchema.safeParse({ orderId, trackingNumber });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const before = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, parsed.data.orderId)).for("update");
      if (!order) return null;
      if (order.status === "pending" || order.status === "cancelled") return order;
      await tx.update(orders).set({ trackingNumber: parsed.data.trackingNumber || null }).where(eq(orders.id, order.id));
      return order;
    });
    if (!before) return fail("We could not find that order.");
    if (before.status === "pending" || before.status === "cancelled") return fail("An unpaid or cancelled order cannot carry a tracking number.");
    await recordAudit(admin, {
      action: "order.tracking",
      targetType: "order",
      targetId: before.id,
      detail: `${before.trackingNumber ?? "None"} to ${parsed.data.trackingNumber || "None"}`,
    });
    refreshStore();
    return done(parsed.data.trackingNumber ? "Tracking number saved." : "Tracking number cleared.");
  } catch (error) {
    console.error("[admin] tracking", error);
    return fail("That did not save. Try again.");
  }
}

export async function resendOrderConfirmation(orderId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(orderId);
  if (!parsed.success) return fail("We could not find that order.");
  try {
    const result = await resendConfirmation(parsed.data);
    if ("error" in result) return fail(result.error ?? "The email could not be sent.");
    await recordAudit(admin, { action: "order.resend_confirmation", targetType: "order", targetId: parsed.data, detail: result.email });
    return done(`Confirmation sent to ${result.email}.`);
  } catch (error) {
    console.error("[admin] resend", error);
    return fail("The email could not be sent. Try again.");
  }
}

const markPaidSchema = z.object({ orderId: uuid, note: z.string().trim().max(500, "Keep the note under 500 characters.") });

export async function markOrderPaid(orderId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = markPaidSchema.safeParse({ orderId, note });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const marked = await markPaid(parsed.data.orderId, null, parsed.data.note ? `Marked as paid. ${parsed.data.note}` : "Marked as paid.");
    if (!marked) return fail("Only an order waiting for payment can be marked as paid.");
    await recordAudit(admin, { action: "order.mark_paid", targetType: "order", targetId: parsed.data.orderId, detail: parsed.data.note });
    refreshStore();
    return done("Marked as paid. The customer gets a confirmation email.");
  } catch (error) {
    console.error("[admin] mark paid", error);
    return fail("That did not save. Try again.");
  }
}

const noteSchema = z.object({ orderId: uuid, body: z.string().trim().min(1, "Write a note first.").max(2000, "Keep the note under 2,000 characters.") });

export async function addOrderNote(orderId: string, body: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = noteSchema.safeParse({ orderId, body });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const [order] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, parsed.data.orderId));
    if (!order) return fail("We could not find that order.");
    await db.insert(adminAuditLog).values({
      actorId: admin.id,
      actorEmail: admin.email,
      action: ORDER_NOTE_ACTION,
      targetType: "order",
      targetId: parsed.data.orderId,
      detail: parsed.data.body,
    });
    refreshAdmin();
    return done(`Note added to ${orderRef(order.number)}.`);
  } catch (error) {
    console.error("[admin] note", error);
    return fail("That did not save. Try again.");
  }
}

const promoEditSchema = z.object({
  code: z.string().trim().min(1).max(32),
  percentOff: z.string().trim().regex(/^\d+$/, "Enter a whole number from 1 to 90.").transform(Number).refine((value) => value >= 1 && value <= 90, "Enter a whole number from 1 to 90."),
  minSubtotal: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount such as 0 or 250.50.").transform(toCents),
  expiresOn: z.union([z.literal(""), z.iso.date("Enter a valid date.")]),
  maxUses: z.string().trim().regex(/^$|^[1-9]\d{0,6}$/, "Enter a whole number above zero, or leave it blank.").transform((value) => (value ? Number(value) : null)),
  oncePerCustomer: z.boolean(),
});

const endOfDay = (day: string) => new Date(`${day}T23:59:59.999Z`);

export async function updatePromo(input: PromoEditInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = promoEditSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { code, percentOff, minSubtotal, expiresOn, maxUses, oncePerCustomer } = parsed.data;
  try {
    const [current] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));
    if (!current) return fail("We could not find that code.");
    const unchangedExpiry = current.expiresAt?.toISOString().slice(0, 10) === expiresOn;
    if (expiresOn && !unchangedExpiry && endOfDay(expiresOn) <= new Date()) return fail("Check the highlighted fields.", { expiresOn: "The expiry date cannot be in the past." });
    await db
      .update(promoCodes)
      .set({ percentOff, minSubtotalCents: minSubtotal, expiresAt: expiresOn ? (unchangedExpiry ? current.expiresAt : endOfDay(expiresOn)) : null, maxUses, oncePerCustomer })
      .where(eq(promoCodes.code, code));
    await recordAudit(admin, {
      action: "promo.update",
      targetType: "promo",
      targetId: code,
      detail: `${percentOff}% off, minimum ${money(minSubtotal)}, expires ${expiresOn || "never"}, limit ${maxUses ?? "none"}, once per customer ${oncePerCustomer ? "yes" : "no"}`,
    });
    refreshStore();
    return done(`${code} saved.`);
  } catch (error) {
    console.error("[admin] promo update", error);
    return fail("That did not save. Try again.");
  }
}

export async function deleteOrDeactivatePromo(code: string, leavePage = false): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.string().trim().min(1).max(32).safeParse(code);
  if (!parsed.success) return fail("We could not find that code.");
  let outcome: "missing" | "deactivated" | "deleted";
  try {
    outcome = await db.transaction(async (tx) => {
      const [promo] = await tx.select().from(promoCodes).where(eq(promoCodes.code, parsed.data)).for("update");
      if (!promo) return "missing";
      const used = promo.timesUsed > 0 || (await tx.$count(orders, eq(orders.promoCode, promo.code))) > 0;
      if (used) {
        await tx.update(promoCodes).set({ active: false }).where(eq(promoCodes.code, promo.code));
        return "deactivated";
      }
      await tx.update(carts).set({ promoCode: null }).where(eq(carts.promoCode, promo.code));
      await tx.delete(promoCodes).where(eq(promoCodes.code, promo.code));
      return "deleted";
    });
    if (outcome === "missing") return fail("We could not find that code.");
    await recordAudit(admin, { action: outcome === "deleted" ? "promo.delete" : "promo.deactivate", targetType: "promo", targetId: parsed.data });
    refreshStore();
  } catch (error) {
    console.error("[admin] promo delete", error);
    return fail("That did not save. Try again.");
  }
  if (outcome === "deleted" && leavePage) redirect("/admin/promos");
  return done(outcome === "deleted" ? `${parsed.data} deleted.` : `${parsed.data} has been used, so it was deactivated instead of deleted.`);
}
