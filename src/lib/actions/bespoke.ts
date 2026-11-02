"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { designSchema, LIMITS, type BespokeDesign } from "@/lib/bespoke/design";
import { customerSchema } from "@/lib/bespoke/submission";
import { recordAudit } from "@/lib/server/audit";
import { ensureOwnerKey, getOwnerKey, getUser, hitRateLimit, requireAdmin, tokenHash } from "@/lib/server/auth";
import { acceptQuote, createQuestion, findByToken, findOwned, listPastDesigns, postCustomerMessage, postTeamMessage, recordBalancePaid, requestBalance, requestChange } from "@/lib/server/bespoke";
import { addBespoke } from "@/lib/server/cart";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";
import { balanceBuyable, bespokeBuyable, BESPOKE_STATUS_LABELS, bespokeRef } from "@/lib/bespoke/status";
import { contactDetails } from "@/lib/server/settings";
import type { ActionResult } from "./admin";

const { bespokeDesigns } = schema;
const MAX_SAVED = 60;
const id = z.uuid();
const MESSAGE_MAX = 2000;
const message = z
  .string()
  .transform((value) => value.replace(/[^\P{Cc}\n\t]/gu, "").trim())
  .pipe(z.string().min(5, "Tell us a little more.").max(MESSAGE_MAX, "Keep it under 2,000 characters."));
const changeMessage = z.string().trim().min(5, "Tell us a little more.").max(2000, "Keep it under 2,000 characters.");

export type Access = { token?: string; id?: string };
export type SavedBespoke = { id: string; name: string; updatedAt: string; design: BespokeDesign };
export type PastDesign = { key: string; kind: "saved" | "request"; name: string; note: string; design: BespokeDesign };
export type AskContext = { whatsapp: string | null; name: string; email: string };

const accessSchema = z.strictObject({ token: z.string().regex(/^[\w-]{43}$/).optional(), id: id.optional() });

async function locate(access: Access) {
  const parsed = accessSchema.safeParse(access);
  if (!parsed.success) return null;
  const { token, id: requestId } = parsed.data;
  if (token) return findByToken(token);
  if (requestId) return findOwned(requestId, await getOwnerKey());
  return null;
}

export async function acceptBespoke(access: Access) {
  const request = await locate(access);
  if (!request) return { error: "We could not find that quote." };
  const result = await acceptQuote(request.id);
  revalidatePath("/", "layout");
  return result;
}

export async function bagAcceptedBespoke(access: Access) {
  const request = await locate(access);
  if (!request || !bespokeBuyable(request)) return { error: "This quote can no longer be bought." };
  await addBespoke(await ensureOwnerKey(), request.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function bagBalance(access: Access) {
  const request = await locate(access);
  if (!request || !balanceBuyable(request)) return { error: "This balance can no longer be paid here." };
  await addBespoke(await ensureOwnerKey(), request.id, "balance");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function askForChange(access: Access, text: string) {
  const parsed = changeMessage.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tell us a little more." };
  const request = await locate(access);
  if (!request) return { error: "We could not find that quote." };
  if (await hitRateLimit(`bespoke-change:${request.id}`, 5, 3600)) return { error: "Too many messages. Try again in an hour." };
  const result = await requestChange(request.id, parsed.data);
  revalidatePath("/", "layout");
  return result;
}

const saveInput = z.strictObject({ id: id.nullable(), name: z.string().trim().min(1, "Give your design a name.").max(60, "Keep the name under 60 characters.") });

export async function listSavedBespoke(): Promise<SavedBespoke[]> {
  const owner = await getOwnerKey();
  if (!owner) return [];
  const rows = await db.select().from(bespokeDesigns).where(eq(bespokeDesigns.ownerKey, owner)).orderBy(desc(bespokeDesigns.updatedAt)).limit(MAX_SAVED);
  return rows.map((row) => ({ id: row.id, name: row.name, updatedAt: row.updatedAt.toISOString(), design: row.design }));
}

export async function saveBespoke(input: { id: string | null; name: string; design: unknown }) {
  const meta = saveInput.safeParse({ id: input.id, name: input.name });
  if (!meta.success) return { error: meta.error.issues[0]?.message ?? "Give your design a name." };
  if (JSON.stringify(input.design ?? null).length > LIMITS.designChars) return { error: "This design is too large to save." };
  const design = designSchema.safeParse(input.design);
  if (!design.success) return { error: "This design could not be saved." };
  const owner = await ensureOwnerKey();
  const [byOwner, byAddress] = await Promise.all([hitRateLimit(`bespoke-save:${owner}`, 60, 3600), hitRateLimit(`bespoke-save-ip:${await clientIp()}`, 120, 3600)]);
  if (byOwner || byAddress) return { error: "You have saved a great deal this hour. Try again shortly." };
  if (meta.data.id) {
    const [row] = await db
      .update(bespokeDesigns)
      .set({ name: meta.data.name, design: design.data, updatedAt: new Date() })
      .where(and(eq(bespokeDesigns.id, meta.data.id), eq(bespokeDesigns.ownerKey, owner)))
      .returning({ id: bespokeDesigns.id });
    if (row) return { id: row.id };
  }
  const count = await db.$count(bespokeDesigns, eq(bespokeDesigns.ownerKey, owner));
  if (count >= MAX_SAVED) return { error: `You can keep up to ${MAX_SAVED} designs. Delete one first.` };
  const [row] = await db.insert(bespokeDesigns).values({ ownerKey: owner, name: meta.data.name, design: design.data }).returning({ id: bespokeDesigns.id });
  return { id: row!.id };
}

async function ownedDesign(designId: string) {
  const owner = await getOwnerKey();
  if (!owner || !id.safeParse(designId).success) return null;
  const [row] = await db.select().from(bespokeDesigns).where(and(eq(bespokeDesigns.id, designId), eq(bespokeDesigns.ownerKey, owner)));
  return row ?? null;
}

export async function duplicateSavedBespoke(designId: string) {
  const row = await ownedDesign(designId);
  if (!row) return { error: "We could not find that design." };
  return saveBespoke({ id: null, name: `${row.name} copy`.slice(0, 60), design: row.design });
}

export async function deleteSavedBespoke(designId: string) {
  const row = await ownedDesign(designId);
  if (!row) return { error: "We could not find that design." };
  await db.delete(bespokeDesigns).where(eq(bespokeDesigns.id, row.id));
  return { ok: true };
}

export async function shareSavedBespoke(designId: string) {
  const row = await ownedDesign(designId);
  if (!row) return { error: "We could not find that design." };
  const token = randomBytes(32).toString("base64url");
  await db.update(bespokeDesigns).set({ shareTokenHash: tokenHash(token) }).where(eq(bespokeDesigns.id, row.id));
  return { link: `/bespoke/shared/${token}` };
}

export async function askContext(): Promise<AskContext> {
  const user = await getUser();
  return { whatsapp: (await contactDetails()).whatsapp, name: user?.name ?? "", email: user?.email ?? "" };
}

export async function askTeam(input: { name: string; email: string; country: string; question: string; design: unknown }) {
  const asker = customerSchema.safeParse({ name: input.name, email: input.email, country: input.country, phone: "" });
  if (!asker.success) return { error: asker.error.issues[0]?.message ?? "Check your details." };
  const question = message.safeParse(input.question);
  if (!question.success) return { error: question.error.issues[0]?.message ?? "Tell us a little more." };
  const result = await createQuestion(asker.data, question.data, input.design);
  revalidatePath("/account/bespoke");
  return result;
}

export async function sendMessage(access: Access, text: string) {
  const parsed = message.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Tell us a little more." };
  const request = await locate(access);
  if (!request) return { error: "We could not find this conversation." };
  const result = await postCustomerMessage(request, parsed.data);
  revalidatePath("/admin/bespoke", "layout");
  return result;
}

export async function loadPastDesigns(): Promise<PastDesign[]> {
  const { saved, requests } = await listPastDesigns(await getOwnerKey());
  const fromSaved = saved.flatMap((row): PastDesign[] => {
    const design = designSchema.safeParse(row.design);
    return design.success ? [{ key: `saved-${row.id}`, kind: "saved", name: row.name, note: "Saved design", design: design.data }] : [];
  });
  const fromRequests = requests.flatMap((row): PastDesign[] => {
    const design = designSchema.safeParse(row.design);
    return design.success ? [{ key: `request-${row.id}`, kind: "request", name: design.data.name || bespokeRef(row.number), note: `${bespokeRef(row.number)}, ${BESPOKE_STATUS_LABELS[row.status]}`, design: design.data }] : [];
  });
  return [...fromSaved, ...fromRequests];
}

const adminResult = (ok: boolean, text: string): ActionResult => ({ ok, message: text });

export async function askForBalance(requestId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!id.safeParse(requestId).success) return adminResult(false, "We could not find that request.");
  if (await hitRateLimit(`bespoke-balance:${requestId}`, 5, 3600)) return adminResult(false, "This customer has been emailed several times this hour. Try again later.");
  const result = await requestBalance(requestId);
  if ("error" in result) return adminResult(false, result.error ?? "That did not save. Try again.");
  await recordAudit(admin, { action: "bespoke.balance_request", targetType: "bespoke", targetId: requestId, detail: result.emailed ? "Email sent" : "Email failed" });
  revalidatePath("/admin", "layout");
  return result.emailed ? adminResult(true, "Balance requested. The customer has a private link by email.") : adminResult(false, "Balance requested, but the email could not be sent. Try again.");
}

export async function markBalancePaid(requestId: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.string().trim().min(5, "Say how the balance was paid.").max(500, "Keep the note under 500 characters.").safeParse(note);
  if (!parsed.success) return adminResult(false, parsed.error.issues[0]?.message ?? "Say how the balance was paid.");
  if (!id.safeParse(requestId).success) return adminResult(false, "We could not find that request.");
  const result = await recordBalancePaid(requestId, parsed.data);
  if ("error" in result) return adminResult(false, result.error ?? "That did not save. Try again.");
  await recordAudit(admin, { action: "bespoke.balance_paid", targetType: "bespoke", targetId: requestId, detail: parsed.data });
  revalidatePath("/", "layout");
  return adminResult(true, "Balance recorded as paid.");
}

export async function replyToCustomer(requestId: string, text: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.string().transform((value) => value.replace(/[^\P{Cc}\n\t]/gu, "").trim()).pipe(z.string().min(1, "Write a reply first.").max(MESSAGE_MAX, "Keep it under 2,000 characters.")).safeParse(text);
  if (!parsed.success) return adminResult(false, parsed.error.issues[0]?.message ?? "Write a reply first.");
  if (!id.safeParse(requestId).success) return adminResult(false, "We could not find that request.");
  const result = await postTeamMessage(requestId, parsed.data);
  if ("error" in result) return adminResult(false, result.error ?? "That did not save. Try again.");
  await recordAudit(admin, { action: "bespoke.reply", targetType: "bespoke", targetId: requestId, detail: result.emailed ? "Email sent" : "Saved, email failed" });
  revalidatePath("/admin", "layout");
  return result.emailed ? adminResult(true, "Reply sent.") : adminResult(false, "Reply saved, but the email could not be sent.");
}
