import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, like, sql } from "drizzle-orm";
import { newsletterText } from "../newsletter";
import { db, schema } from "./db";
import { sendMail } from "./mail";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "./unsubscribe";

const { newsletterSubscribers, siteSettings } = schema;
const KEY_PREFIX = "campaign:";
const START_LOCK = 7_204_411;
export const BATCH_SIZE = 10;
const PACE_MS = 600;

export type Campaign = {
  id: string;
  subject: string;
  body: string;
  status: "sending" | "paused" | "done";
  total: number;
  cursor: string;
  retry: string[];
  sent: number;
  failed: string[];
  claimed: number;
  actorEmail: string;
  createdAt: string;
  finishedAt: string | null;
};

const keyOf = (id: string) => `${KEY_PREFIX}${id}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const write = (source: Pick<typeof db, "update">, campaign: Campaign) =>
  source.update(siteSettings).set({ value: campaign, updatedAt: sql`now()` }).where(eq(siteSettings.key, keyOf(campaign.id)));

export const countAudience = () => db.$count(newsletterSubscribers);

export async function getCampaign(id: string) {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, keyOf(id)));
  return (row?.value as Campaign | undefined) ?? null;
}

export async function listCampaigns() {
  const rows = await db.select({ value: siteSettings.value }).from(siteSettings).where(like(siteSettings.key, `${KEY_PREFIX}%`)).orderBy(desc(siteSettings.updatedAt)).limit(20);
  return rows.map((row) => row.value as Campaign);
}

export async function activeCampaign(source: Pick<typeof db, "select"> = db) {
  const [row] = await source
    .select({ total: count() })
    .from(siteSettings)
    .where(and(like(siteSettings.key, `${KEY_PREFIX}%`), sql`${siteSettings.value}->>'status' = 'sending'`));
  return (row?.total ?? 0) > 0;
}

export async function createCampaign(input: { subject: string; body: string; total: number; actorEmail: string }) {
  const campaign: Campaign = {
    ...input,
    id: randomUUID(),
    status: "sending",
    cursor: "",
    retry: [],
    sent: 0,
    failed: [],
    claimed: 0,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${START_LOCK})`);
    if (await activeCampaign(tx)) return null;
    await tx.insert(siteSettings).values({ key: keyOf(campaign.id), value: campaign });
    return campaign;
  });
}

export function sendToSubscriber(email: string, subject: string, body: string) {
  return sendMail({
    to: email,
    subject,
    text: newsletterText(body, unsubscribePageUrl(email)),
    headers: { "List-Unsubscribe": `<${unsubscribeOneClickUrl(email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  }).catch(() => false);
}

async function claimBatch(id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, keyOf(id))).for("update");
    const campaign = row?.value as Campaign | undefined;
    if (!campaign || campaign.status !== "sending") return { campaign: campaign ?? null, recipients: [] };

    const retrying = campaign.retry.slice(0, BATCH_SIZE);
    const stillSubscribed = retrying.length
      ? await tx.select({ email: newsletterSubscribers.email }).from(newsletterSubscribers).where(inArray(newsletterSubscribers.email, retrying))
      : [];
    const fresh = await tx
      .select({ email: newsletterSubscribers.email })
      .from(newsletterSubscribers)
      .where(campaign.cursor ? gt(newsletterSubscribers.email, campaign.cursor) : undefined)
      .orderBy(asc(newsletterSubscribers.email))
      .limit(BATCH_SIZE - retrying.length);

    const recipients = [...stillSubscribed, ...fresh].map((subscriber) => subscriber.email);
    const next: Campaign = {
      ...campaign,
      retry: campaign.retry.slice(retrying.length),
      cursor: fresh.at(-1)?.email ?? campaign.cursor,
      claimed: campaign.claimed + recipients.length,
      ...(!recipients.length && !campaign.retry.length ? { status: "done" as const, finishedAt: new Date().toISOString() } : {}),
    };
    await write(tx, next);
    return { campaign: next, recipients };
  });
}

async function settleBatch(id: string, sent: number, failed: string[], stop: boolean) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, keyOf(id))).for("update");
    const campaign = row!.value as Campaign;
    const next: Campaign = {
      ...campaign,
      sent: campaign.sent + sent,
      failed: [...campaign.failed, ...failed],
      status: stop && campaign.status === "sending" ? "paused" : campaign.status,
    };
    await write(tx, next);
    return next;
  });
}

export async function runBatch(id: string) {
  const { campaign, recipients } = await claimBatch(id);
  if (!campaign || !recipients.length) return campaign;
  const failed: string[] = [];
  for (const email of recipients) {
    if (!(await sendToSubscriber(email, campaign.subject, campaign.body))) failed.push(email);
    await pause(PACE_MS);
  }
  return settleBatch(id, recipients.length - failed.length, failed, failed.length * 2 >= recipients.length);
}

export async function resumeCampaign(id: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, keyOf(id))).for("update");
    const campaign = row?.value as Campaign | undefined;
    if (!campaign) return null;
    const next: Campaign = {
      ...campaign,
      status: "sending",
      finishedAt: null,
      retry: [...campaign.failed, ...campaign.retry],
      claimed: campaign.claimed - campaign.failed.length,
      failed: [],
    };
    await write(tx, next);
    return next;
  });
}
