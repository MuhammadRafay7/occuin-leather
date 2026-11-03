"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { eraseAccount } from "@/lib/server/account-deletion";
import { recordAudit } from "@/lib/server/audit";
import { checkPassword, hitRateLimit, requireAdmin } from "@/lib/server/auth";
import { activeCampaign, BATCH_SIZE, countAudience, createCampaign, getCampaign, resumeCampaign, runBatch, sendToSubscriber, type Campaign } from "@/lib/server/campaigns";
import { db, schema } from "@/lib/server/db";
import { mailConfigured, sendMail } from "@/lib/server/mail";
import { issueReset } from "@/lib/server/password-reset";
import { contactDetails, getSettings, PAYMENT_MODES, saveSettings, settingsSchema, type StoreSettings } from "@/lib/server/settings";
import type { ActionResult } from "./admin";
import { refreshStore } from "@/lib/server/store-cache";

const { adminAuditLog, contactMessages, newsletterSubscribers, passwordResets, sessions, users } = schema;

export type SettingsInput = {
  announcement: string;
  freeShipping: string;
  standardShipping: string;
  expressShipping: string;
  ordersPaused: boolean;
  ordersPausedMessage: string;
  lowStockLimit: string;
  supportEmail: string;
  whatsappNumber: string;
  paymentMode: string;
  autoCancelDays: string;
};
export type ReplyResult = ActionResult & { sent?: boolean };
export type CampaignInput = { subject: string; body: string };
export type CampaignResult = ActionResult & { campaign?: Campaign };

const uuid = z.uuid();
const MAIL_OFF = "Email is not set up yet, so nothing was sent.";
const NOT_DELIVERED = "The email provider did not accept this. Nothing was sent.";
const TOO_MANY = "Too many attempts. Wait a while and try again.";
const NO_CUSTOMER = "We could not find that customer.";
const BAD_PASSWORD = "That password is not correct.";

const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, message, fieldErrors });
const done = (message: string): ActionResult => ({ ok: true, message });
const refreshAdmin = () => revalidatePath("/admin", "layout");

async function attempt<T extends ActionResult>(task: () => Promise<T>): Promise<T | ActionResult> {
  try {
    return await task();
  } catch (error) {
    console.error("[admin-people]", error);
    return fail("That did not work. Try again.");
  }
}

const findCustomer = async (id: string) => {
  if (!uuid.safeParse(id).success) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
};

async function passwordConfirmed(actor: { id: string }, password: string) {
  if (await hitRateLimit(`admin-confirm:${actor.id}`, 5, 900)) return TOO_MANY;
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, actor.id));
  if (!row || !password || password.length > 128 || !(await checkPassword(row.passwordHash, password))) return BAD_PASSWORD;
  return null;
}

export async function saveCustomerNote(userId: string, note: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z.string().trim().max(4000, "Keep the note under 4,000 characters.").safeParse(note);
  if (!parsed.success) return fail("Check the highlighted fields.", { note: parsed.error.issues[0]!.message });
  return attempt(async () => {
    const user = await findCustomer(userId);
    if (!user) return fail(NO_CUSTOMER);
    await db.update(users).set({ adminNote: parsed.data }).where(eq(users.id, user.id));
    await recordAudit(actor, { action: "customer.note", targetType: "customer", targetId: user.id, detail: parsed.data ? "Staff note updated" : "Staff note cleared" });
    refreshAdmin();
    return done("Note saved.");
  });
}

export async function setCustomerBlocked(userId: string, blocked: boolean): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (typeof blocked !== "boolean") return fail(NO_CUSTOMER);
  return attempt(async () => {
    const user = await findCustomer(userId);
    if (!user) return fail(NO_CUSTOMER);
    if (user.id === actor.id) return fail("You cannot block your own account.");
    if (user.role === "admin") return fail("Remove admin access before blocking this account.");
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(users)
        .set({ blockedAt: blocked ? new Date() : null })
        .where(and(eq(users.id, user.id), eq(users.role, "customer")))
        .returning({ id: users.id });
      if (rows.length && blocked) {
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
        await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
      }
      return rows.length > 0;
    });
    if (!updated) return fail("This account changed. Reload and try again.");
    await recordAudit(actor, { action: blocked ? "customer.block" : "customer.unblock", targetType: "customer", targetId: user.id, detail: user.email });
    refreshAdmin();
    return done(blocked ? "Blocked. Their sessions are revoked and they cannot sign in." : "Unblocked. They can sign in again.");
  });
}

export async function sendCustomerReset(userId: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  return attempt(async () => {
    const user = await findCustomer(userId);
    if (!user) return fail(NO_CUSTOMER);
    if (user.blockedAt) return fail("Unblock this customer before sending a reset.");
    if (!mailConfigured()) return fail(MAIL_OFF);
    if (await hitRateLimit(`admin-reset:${user.id}`, 3, 3600)) return fail("This customer has been sent several resets this hour. Try again later.");
    const sent = await issueReset(user.email).catch(() => false);
    if (!sent) return fail(NOT_DELIVERED);
    await recordAudit(actor, { action: "customer.password_reset", targetType: "customer", targetId: user.id, detail: user.email });
    return done(`Reset link sent to ${user.email}. It works for one hour.`);
  });
}

const refusal = (target: typeof users.$inferSelect, role: "customer" | "admin", actorId: string) => {
  if (target.role === role) return role === "admin" ? "This account is already an admin." : "This account is not an admin.";
  if (role === "admin" && target.blockedAt) return "Unblock this customer first.";
  if (role === "customer" && target.id === actorId) return "You cannot remove your own admin access.";
  return null;
};

export async function setCustomerRole(userId: string, role: "customer" | "admin", password: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z.object({ role: z.enum(["customer", "admin"]), password: z.string() }).safeParse({ role, password });
  if (!parsed.success) return fail("Check the highlighted fields.");
  return attempt(async () => {
    const problem = await passwordConfirmed(actor, parsed.data.password);
    if (problem) return fail(problem, { password: problem });
    const target = await findCustomer(userId);
    if (!target) return fail(NO_CUSTOMER);

    const outcome = await db.transaction(async (tx) => {
      const admins = await tx.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), isNull(users.blockedAt))).for("update");
      if (!admins.some((admin) => admin.id === actor.id)) return "You are no longer an admin.";
      const [fresh] = await tx.select().from(users).where(eq(users.id, target.id)).for("update");
      if (!fresh) return NO_CUSTOMER;
      const refused = refusal(fresh, parsed.data.role, actor.id);
      if (refused) return refused;
      if (parsed.data.role === "customer" && admins.length <= 1) return "You cannot remove the last admin.";
      await tx.update(users).set({ role: parsed.data.role }).where(eq(users.id, fresh.id));
      return null;
    });
    if (outcome) return fail(outcome);
    await recordAudit(actor, { action: parsed.data.role === "admin" ? "customer.make_admin" : "customer.remove_admin", targetType: "customer", targetId: target.id, detail: target.email });
    refreshAdmin();
    return done(parsed.data.role === "admin" ? `${target.email} is now an admin.` : `${target.email} is no longer an admin.`);
  });
}

export async function deleteCustomer(userId: string, confirmEmail: string, password: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  const result = await attempt(async () => {
    const user = await findCustomer(userId);
    if (!user) return fail(NO_CUSTOMER);
    if (user.role === "admin") return fail("Remove admin access before deleting this account.");
    if (String(confirmEmail).trim().toLowerCase() !== user.email.toLowerCase()) return fail("Check the highlighted fields.", { confirmEmail: "Type this customer's email exactly." });
    const problem = await passwordConfirmed(actor, String(password));
    if (problem) return fail(problem, { password: problem });
    if (!(await eraseAccount({ id: user.id, email: user.email }))) return fail("This customer has an order or bespoke piece in progress. Finish it, then delete the account.");
    await db.update(adminAuditLog).set({ detail: sql`replace(${adminAuditLog.detail}, ${user.email}, 'deleted customer')` }).where(eq(adminAuditLog.targetId, user.id));
    await recordAudit(actor, { action: "customer.delete", targetType: "customer", targetId: user.id, detail: "Account erased" });
    if (mailConfigured()) {
      after(() => sendMail({ to: user.email, subject: "Your OCCUIN account was deleted", text: "Your OCCUIN account has been deleted by our team. If you did not expect this, reply to this email or contact us." }).catch(() => false));
    }
    refreshStore();
    return done("Customer deleted.");
  });
  if (result.ok) redirect("/admin/customers?deleted=1");
  return result;
}

export async function replyToMessage(messageId: string, body: string, seenRepliedAt: string | null): Promise<ReplyResult> {
  const actor = await requireAdmin();
  const parsed = z
    .object({ messageId: uuid, body: z.string().trim().min(1, "Write a reply first.").max(10_000, "Keep the reply under 10,000 characters."), seenRepliedAt: z.string().nullable() })
    .safeParse({ messageId, body, seenRepliedAt });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Write a reply first.", { body: parsed.error.issues[0]?.message ?? "" });
  return attempt(async () => {
    const [message] = await db.select().from(contactMessages).where(eq(contactMessages.id, parsed.data.messageId));
    if (!message) return fail("We could not find that message.");
    if ((message.repliedAt?.toISOString() ?? null) !== parsed.data.seenRepliedAt) return fail("Someone replied while you were writing. Reload to see it before sending.");
    if (!mailConfigured()) return fail(MAIL_OFF);
    if (await hitRateLimit(`admin-reply:${actor.id}`, 40, 3600)) return fail("You have sent many replies this hour. Try again later.");

    const { email: replyTo } = await contactDetails();
    const sent = await sendMail({
      to: message.email,
      subject: `Re: ${message.topic} (your message to OCCUIN)`,
      text: `${parsed.data.body}\n\n--\nYou wrote:\n${message.message}`,
      replyTo,
    }).catch(() => false);
    if (!sent) return fail(`${NOT_DELIVERED} The reply was not saved as sent.`);

    const now = new Date();
    const stamp = now.toISOString().slice(0, 16).replace("T", " ");
    try {
      await db
        .update(contactMessages)
        .set({ reply: message.reply ? `${message.reply}\n\n[${stamp} UTC]\n${parsed.data.body}` : parsed.data.body, repliedAt: now, handled: true })
        .where(eq(contactMessages.id, message.id));
    } catch (error) {
      console.error("[admin-people] reply sent but not stored", error);
      await recordAudit(actor, { action: "message.reply", targetType: "message", targetId: message.id, detail: `Sent to ${message.email}, but saving the reply failed` });
      return fail("The email was sent, but saving it failed. Do not send it again.");
    }
    await recordAudit(actor, { action: "message.reply", targetType: "message", targetId: message.id, detail: `Sent to ${message.email}` });
    refreshAdmin();
    return { ...done(`Reply sent to ${message.email}.`), sent: true };
  });
}

export async function removeNewsletterSubscriber(email: string): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z.string().max(254).min(3).safeParse(email);
  if (!parsed.success) return fail("We could not find that subscriber.");
  return attempt(async () => {
    const removed = await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, parsed.data.toLowerCase())).returning({ email: newsletterSubscribers.email });
    if (!removed.length) return fail("That subscriber is already gone.");
    await recordAudit(actor, { action: "newsletter.remove", targetType: "subscriber", targetId: parsed.data });
    refreshAdmin();
    return done(`${parsed.data} removed.`);
  });
}

const campaignSchema = z.strictObject({
  subject: z.string().trim().min(1, "Enter a subject.").max(150, "Keep the subject under 150 characters.").regex(/^[^\r\n]+$/, "The subject must be one line."),
  body: z.string().trim().min(1, "Write the message.").max(20_000, "Keep the message under 20,000 characters."),
});

function invalidCampaign(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[String(issue.path[0])] ??= issue.message;
  return fail("Check the highlighted fields.", fields);
}

export async function sendCampaignTest(input: CampaignInput): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return invalidCampaign(parsed.error);
  return attempt(async () => {
    if (!mailConfigured()) return fail(MAIL_OFF);
    if (await hitRateLimit(`campaign-test:${actor.id}`, 10, 3600)) return fail("Too many test sends this hour. Try again later.");
    const sent = await sendToSubscriber(actor.email, `[Test] ${parsed.data.subject}`, parsed.data.body);
    if (!sent) return fail(NOT_DELIVERED);
    await recordAudit(actor, { action: "newsletter.test", targetType: "campaign", detail: parsed.data.subject });
    return done(`Test sent to ${actor.email}.`);
  });
}

export async function startCampaign(input: CampaignInput, confirmCount: number): Promise<CampaignResult> {
  const actor = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return invalidCampaign(parsed.error);
  return attempt(async () => {
    if (!mailConfigured()) return fail(MAIL_OFF);
    const total = await countAudience();
    if (!total) return fail("There are no subscribers to send to.");
    if (confirmCount !== total) return fail(`The list is now ${total} subscribers. Confirm that number to send.`);
    if (await activeCampaign()) return fail("Another campaign is still sending. Finish it first.");
    if (await hitRateLimit(`campaign:${actor.id}`, 3, 86_400)) return fail("You have started three campaigns today. Try again tomorrow.");
    const campaign = await createCampaign({ ...parsed.data, total, actorEmail: actor.email });
    if (!campaign) return fail("Another campaign is still sending. Finish it first.");
    await recordAudit(actor, { action: "newsletter.campaign_start", targetType: "campaign", targetId: campaign.id, detail: `${parsed.data.subject} (${total} subscribers)` });
    return { ...done("Sending started."), campaign };
  });
}

export async function sendCampaignBatch(campaignId: string): Promise<CampaignResult> {
  const actor = await requireAdmin();
  if (!uuid.safeParse(campaignId).success) return fail("We could not find that campaign.");
  return attempt(async () => {
    if (!mailConfigured()) return fail(MAIL_OFF);
    const before = await getCampaign(campaignId);
    if (!before) return fail("We could not find that campaign.");
    if (before.status !== "sending") return { ...done("This campaign is not sending."), campaign: before };
    const campaign = await runBatch(campaignId);
    if (!campaign) return fail("We could not find that campaign.");
    if (campaign.status === "paused") {
      await recordAudit(actor, { action: "newsletter.campaign_pause", targetType: "campaign", targetId: campaign.id, detail: `${campaign.sent} sent, ${campaign.failed.length} failed` });
      refreshAdmin();
      return { ok: false, message: `Sending stopped: the email provider refused most of the last ${BATCH_SIZE} messages. ${campaign.sent} sent so far.`, campaign };
    }
    if (campaign.status === "done") {
      await recordAudit(actor, { action: "newsletter.campaign_done", targetType: "campaign", targetId: campaign.id, detail: `${campaign.sent} sent, ${campaign.failed.length} failed` });
      refreshAdmin();
    }
    return { ...done(campaign.status === "done" ? "Finished." : "Sending."), campaign };
  });
}

export async function resumeNewsletterCampaign(campaignId: string): Promise<CampaignResult> {
  const actor = await requireAdmin();
  if (!uuid.safeParse(campaignId).success) return fail("We could not find that campaign.");
  return attempt(async () => {
    if (!mailConfigured()) return fail(MAIL_OFF);
    const current = await getCampaign(campaignId);
    if (!current) return fail("We could not find that campaign.");
    if (current.status === "done" && !current.failed.length) return fail("This campaign has nothing left to send.");
    const campaign = await resumeCampaign(campaignId);
    if (!campaign) return fail("We could not find that campaign.");
    await recordAudit(actor, { action: "newsletter.campaign_resume", targetType: "campaign", targetId: campaign.id, detail: `${campaign.retry.length} to retry` });
    return { ...done("Sending resumed."), campaign };
  });
}

const dollars = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{1,7}(\.\d{1,2})?$/, `Enter ${label} in dollars, such as 18 or 18.50.`)
    .transform((value) => Math.round(Number(value) * 100));

const settingsInput = z.strictObject({
  announcement: settingsSchema.shape.announcement,
  freeShipping: dollars("the threshold"),
  standardShipping: dollars("the price"),
  expressShipping: dollars("the price"),
  ordersPaused: z.boolean(),
  ordersPausedMessage: settingsSchema.shape.ordersPausedMessage,
  lowStockLimit: z.string().trim().regex(/^\d{1,4}$/, "Enter a whole number from 0 to 1000.").transform(Number),
  supportEmail: settingsSchema.shape.supportEmail,
  whatsappNumber: settingsSchema.shape.whatsappNumber,
  paymentMode: z.enum(PAYMENT_MODES, "Choose how you take orders."),
  autoCancelDays: z.string().trim().regex(/^\d{1,2}$/, "Enter a whole number from 0 to 90.").transform(Number),
});

const FIELD_NAMES: Record<string, keyof SettingsInput> = {
  freeShippingCents: "freeShipping",
  standardShippingCents: "standardShipping",
  expressShippingCents: "expressShipping",
};

function settingsFields(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    fields[FIELD_NAMES[key] ?? key] ??= issue.message;
  }
  return fail("Check the highlighted fields.", fields);
}

const changes = (before: StoreSettings, after_: StoreSettings) =>
  (Object.keys(after_) as (keyof StoreSettings)[])
    .filter((key) => before[key] !== after_[key])
    .map((key) => `${key}: ${JSON.stringify(before[key])} to ${JSON.stringify(after_[key])}`)
    .join("; ");

export async function saveStoreSettings(input: SettingsInput): Promise<ActionResult> {
  const actor = await requireAdmin();
  const form = settingsInput.safeParse(input);
  if (!form.success) return settingsFields(form.error);
  const { freeShipping, standardShipping, expressShipping, ...rest } = form.data;
  const parsed = settingsSchema.safeParse({ ...rest, freeShippingCents: freeShipping, standardShippingCents: standardShipping, expressShippingCents: expressShipping });
  if (!parsed.success) return settingsFields(parsed.error);
  return attempt(async () => {
    const before = await getSettings();
    await saveSettings(parsed.data);
    const detail = changes(before, parsed.data);
    if (detail) await recordAudit(actor, { action: "settings.update", targetType: "settings", targetId: "store", detail });
    refreshStore();
    return done(detail ? "Settings saved. The store has them now." : "Nothing changed.");
  });
}
