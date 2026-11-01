import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { designSchema, LIMITS, PRODUCT_TYPES, type BespokeDesign } from "@/lib/bespoke/design";
import { estimateDesign, visibleDesign } from "@/lib/bespoke/estimate";
import { balanceCents, balanceOwedCents, bespokeRef, depositCents, PRICE_LOCKED, quoteExpiry, type BespokeStatus } from "@/lib/bespoke/status";
import { customerSchema, parseDesign, sniffImage, type ImageType } from "@/lib/bespoke/submission";
import { BESPOKE_NOTE, BRAND, longDate, money } from "@/lib/format";
import { ensureOwnerKey, hitRateLimit, tokenHash } from "./auth";
import { clientIp } from "./client-ip";
import { db, schema } from "./db";
import { linkKey } from "./link-key";
import { addBespoke } from "./cart";
import { sendMail } from "./mail";
import { sendWhatsApp } from "./whatsapp";

const MAX_PER_ADDRESS = 5;
const MAX_PER_EMAIL = 5;
const WINDOW_SECONDS = 3600;
const MAX_INPUT_PIXELS = 100_000_000;
const PAST_LIMIT = 12;
const PAID_STATUSES: readonly BespokeStatus[] = ["in_production", "completed"];
const CLOSED_STATUSES: readonly BespokeStatus[] = ["declined", "completed"];
const CLOSED_LINK_DAYS = 14;
const QUOTE_SHARE_SECONDS = 30 * 86_400;
const SHARP_FORMATS: Record<ImageType, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

type Upload = { bytes: Buffer; contentType: ImageType; filename: string };

export type BespokeResult =
  | { ok: true; reference: string; link: string }
  | { ok: false; error?: string; fields?: Record<string, string> };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

async function readImages(form: FormData): Promise<{ images: Upload[] } | { error: string }> {
  const files = form.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > LIMITS.images) return { error: `Add up to ${LIMITS.images} reference images.` };
  if (files.reduce((sum, file) => sum + file.size, 0) > LIMITS.imagesTotalBytes) return { error: "Reference images must be under 3.5 MB in total." };
  const images: Upload[] = [];
  for (const file of files) {
    if (file.size > LIMITS.imageBytes) return { error: "Reference images must be under 3.5 MB in total." };
    const bytes = Buffer.from(await file.arrayBuffer());
    const contentType = sniffImage(bytes);
    if (!contentType) return { error: "Reference images must be JPG, PNG or WebP." };
    const format = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata().then((meta) => meta.format, () => null);
    if (format !== SHARP_FORMATS[contentType]) return { error: "One of the reference images could not be read." };
    images.push({ bytes, contentType, filename: file.name.replace(/\p{Cc}/gu, "").slice(0, 120) || "reference" });
  }
  return { images };
}

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

async function mintLink(requestId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.delete(schema.bespokeTokens).where(lt(schema.bespokeTokens.expiresAt, new Date()));
  await db.insert(schema.bespokeTokens).values({ tokenHash: tokenHash(token), requestId });
  return `/bespoke/${token}`;
}

async function ownsLogos(design: BespokeDesign, ownerKey: string) {
  const logoIds = new Set(design.pieces.flatMap((piece) => (piece.logo ? [piece.logo.id] : [])));
  if (!logoIds.size) return true;
  const found = await db.select({ id: schema.bespokeLogos.id }).from(schema.bespokeLogos).where(and(inArray(schema.bespokeLogos.id, [...logoIds]), eq(schema.bespokeLogos.ownerKey, ownerKey)));
  return found.length === logoIds.size;
}

async function notify(reference: string, requestId: string, link: string, customer: { name: string; email: string; country: string; phone: string }, summary: string) {
  const adminLink = `${appUrl()}/admin/bespoke/${requestId}`;
  await Promise.allSettled([
    sendMail({
      to: customer.email,
      subject: `We have your design, ${reference}`,
      text: [
        `Thank you. Your design is with the ${BRAND.name} workshop. Your reference is ${reference}.`,
        "",
        "What happens next:",
        "1. We review your design and check how it can be made.",
        "2. We email you a final price.",
        "3. Work starts after you accept it.",
        "",
        summary,
        "The estimate is a guide only. The workshop confirms the final price.",
        "",
        `Follow your request here: ${appUrl()}${link}`,
        "",
        BESPOKE_NOTE,
      ].join("\n"),
    }),
    sendMail({
      to: BRAND.email,
      subject: `New bespoke request ${reference}`,
      text: [
        `${customer.name} <${customer.email}>, ${customer.country}${customer.phone ? `, ${customer.phone}` : ""}`,
        summary,
        adminLink,
      ].join("\n"),
    }),
  ]);
}

export async function createBespokeRequest(form: FormData): Promise<BespokeResult> {
  const customer = customerSchema.safeParse({
    name: text(form, "name"),
    email: text(form, "email"),
    country: text(form, "country"),
    phone: text(form, "phone"),
  });
  if (!customer.success) {
    const { fieldErrors } = z.flattenError(customer.error);
    return { ok: false, fields: Object.fromEntries(Object.entries(fieldErrors).map(([key, messages]) => [key, messages?.[0] ?? ""])) };
  }
  const parsed = parseDesign(form.get("design"));
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { design } = parsed;

  const ownerKey = await ensureOwnerKey();
  if (!(await ownsLogos(design, ownerKey))) return { ok: false, error: "One of the logos could not be found. Upload it again." };

  const estimate = estimateDesign(design);
  if (!estimate) return { ok: false, error: "Draw at least one closed piece." };

  const [byAddress, byEmail] = await Promise.all([
    hitRateLimit(`bespoke:${await clientIp()}`, MAX_PER_ADDRESS, WINDOW_SECONDS),
    hitRateLimit(`bespoke-email:${customer.data.email}`, MAX_PER_EMAIL, WINDOW_SECONDS),
  ]);
  if (byAddress || byEmail) return { ok: false, error: "Too many designs sent. Try again in an hour." };

  const uploaded = await readImages(form);
  if ("error" in uploaded) return { ok: false, error: uploaded.error };

  const { name, email, country, phone } = customer.data;
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.bespokeRequests)
      .values({
        ownerKey,
        name,
        email,
        country,
        phone: phone || null,
        productType: design.productType,
        notes: design.notes,
        design,
        estimateLowCents: estimate.lowCents,
        estimateHighCents: estimate.highCents,
      })
      .returning({ id: schema.bespokeRequests.id, number: schema.bespokeRequests.number });
    if (uploaded.images.length) {
      await tx.insert(schema.bespokeRequestImages).values(
        uploaded.images.map((image, position) => ({
          requestId: created!.id,
          position,
          contentType: image.contentType,
          filename: image.filename,
          byteSize: image.bytes.length,
          bytes: image.bytes,
        })),
      );
    }
    return created!;
  });

  const reference = bespokeRef(row.number);
  const summary = `${PRODUCT_TYPES[design.productType]}, ${estimate.widthMm} x ${estimate.heightMm} x ${estimate.depthMm} mm, ${estimate.pieceCount} ${estimate.pieceCount === 1 ? "piece" : "pieces"}. Estimated ${money(estimate.lowCents)} to ${money(estimate.highCents)}.`;
  const link = await mintLink(row.id);
  await notify(reference, row.id, link, customer.data, summary);
  return { ok: true, reference, link };
}

export async function findByToken(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return null;
  const [row] = await db
    .select({ request: schema.bespokeRequests })
    .from(schema.bespokeTokens)
    .innerJoin(schema.bespokeRequests, eq(schema.bespokeRequests.id, schema.bespokeTokens.requestId))
    .where(and(eq(schema.bespokeTokens.tokenHash, tokenHash(token)), gt(schema.bespokeTokens.expiresAt, new Date())));
  return row?.request ?? null;
}

export async function findOwned(id: string, ownerKey: string | null) {
  if (!ownerKey) return null;
  const [request] = await db
    .select()
    .from(schema.bespokeRequests)
    .where(and(eq(schema.bespokeRequests.id, id), or(eq(schema.bespokeRequests.ownerKey, ownerKey), eq(schema.bespokeRequests.acceptedOwnerKey, ownerKey))));
  return request ?? null;
}

export const listOwnedRequests = (ownerKey: string) =>
  db
    .select({
      id: schema.bespokeRequests.id,
      number: schema.bespokeRequests.number,
      status: schema.bespokeRequests.status,
      productType: schema.bespokeRequests.productType,
      quotedPriceCents: schema.bespokeRequests.quotedPriceCents,
      depositPercent: schema.bespokeRequests.depositPercent,
      depositPaidAt: schema.bespokeRequests.depositPaidAt,
      balancePaidAt: schema.bespokeRequests.balancePaidAt,
      quoteExpiresAt: schema.bespokeRequests.quoteExpiresAt,
      createdAt: schema.bespokeRequests.createdAt,
    })
    .from(schema.bespokeRequests)
    .where(or(eq(schema.bespokeRequests.ownerKey, ownerKey), eq(schema.bespokeRequests.acceptedOwnerKey, ownerKey)))
    .orderBy(sql`${schema.bespokeRequests.createdAt} desc`);

export async function sendQuoteEmail(requestId: string) {
  const [request] = await db.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, requestId));
  if (!request?.quotedPriceCents || !request.quoteExpiresAt) return false;
  const link = await mintLink(request.id);
  const reference = bespokeRef(request.number);
  const balance = balanceCents(request.quotedPriceCents, request.depositPercent);
  const sent = await sendMail({
    to: request.email,
    subject: `Your ${BRAND.name} quote for ${reference}`,
    text: [
      `Our workshop has priced your design ${reference} at ${money(request.quotedPriceCents)}.`,
      balance ? `To start, pay a ${request.depositPercent}% deposit of ${money(depositCents(request.quotedPriceCents, request.depositPercent))}. The balance of ${money(balance)} is due before it ships.` : "Payment is in full when you accept.",
      "",
      `See your design, accept the price or ask for a change here: ${appUrl()}${link}`,
      `This quote is open until ${longDate(request.quoteExpiresAt)}.`,
      "",
      BESPOKE_NOTE,
    ].join("\n"),
  }).catch(() => false);
  if (sent) await db.update(schema.bespokeRequests).set({ quoteEmailedAt: new Date() }).where(eq(schema.bespokeRequests.id, request.id));
  return sent;
}

type ChangeInput = { id: string; status: BespokeStatus; quotedPriceCents: number | null; depositPercent: number; adminNote: string };

export async function applyAdminUpdate({ id, status, quotedPriceCents, depositPercent, adminNote }: ChangeInput) {
  const [current] = await db.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, id));
  if (!current) return { error: "We could not find that request." };
  if (PRICE_LOCKED.includes(current.status) && (quotedPriceCents !== current.quotedPriceCents || depositPercent !== current.depositPercent)) return { error: "This quote was accepted, so its price and deposit can no longer change." };
  if (current.depositPaidAt && !PAID_STATUSES.includes(status)) return { error: "The deposit on this request is paid, so it stays in production or completed." };
  const requote = status === "quoted" && (current.status !== "quoted" || quotedPriceCents !== current.quotedPriceCents || depositPercent !== current.depositPercent);
  const now = new Date();
  await db
    .update(schema.bespokeRequests)
    .set({ status, quotedPriceCents, depositPercent, adminNote, updatedAt: now, ...(requote ? { quotedAt: now, quoteExpiresAt: quoteExpiry(now), quoteEmailedAt: null } : {}) })
    .where(eq(schema.bespokeRequests.id, id));
  if (CLOSED_STATUSES.includes(status)) {
    await db
      .update(schema.bespokeTokens)
      .set({ expiresAt: sql`least(${schema.bespokeTokens.expiresAt}, now() + make_interval(days => ${CLOSED_LINK_DAYS}))` })
      .where(eq(schema.bespokeTokens.requestId, id));
  }
  if (!requote) return { requote, emailed: false };
  return { requote, emailed: await sendQuoteEmail(id) };
}

export async function acceptQuote(requestId: string) {
  const ownerKey = await ensureOwnerKey();
  const now = new Date();
  const [accepted] = await db
    .update(schema.bespokeRequests)
    .set({ status: "accepted", acceptedAt: now, acceptedOwnerKey: ownerKey, updatedAt: now })
    .where(and(eq(schema.bespokeRequests.id, requestId), eq(schema.bespokeRequests.status, "quoted"), gt(schema.bespokeRequests.quoteExpiresAt, now), sql`${schema.bespokeRequests.quotedPriceCents} is not null`))
    .returning({ id: schema.bespokeRequests.id });
  if (!accepted) return { error: "This quote can no longer be accepted." };
  await addBespoke(ownerKey, requestId);
  return { ok: true };
}

export async function requestChange(requestId: string, message: string) {
  const now = new Date();
  const [updated] = await db
    .update(schema.bespokeRequests)
    .set({ status: "changes_requested", changeMessage: message, changeRequestedAt: now, updatedAt: now })
    .where(and(eq(schema.bespokeRequests.id, requestId), eq(schema.bespokeRequests.status, "quoted")))
    .returning({ number: schema.bespokeRequests.number });
  if (!updated) return { error: "This quote can no longer be changed." };
  await sendMail({
    to: BRAND.email,
    subject: `Change requested on ${bespokeRef(updated.number)}`,
    text: [message, "", `${appUrl()}/admin/bespoke/${requestId}`].join("\n"),
  }).catch(() => false);
  return { ok: true };
}

export async function findShared(token: string) {
  if (!/^[\w-]{43}$/.test(token)) return null;
  const [row] = await db.select().from(schema.bespokeDesigns).where(eq(schema.bespokeDesigns.shareTokenHash, tokenHash(token)));
  return row ?? null;
}

export async function findSaved(id: string, ownerKey: string | null) {
  if (!ownerKey) return null;
  const [row] = await db.select().from(schema.bespokeDesigns).where(and(eq(schema.bespokeDesigns.id, id), eq(schema.bespokeDesigns.ownerKey, ownerKey)));
  return row ?? null;
}

export async function requestBalance(requestId: string) {
  const [request] = await db.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, requestId));
  const owed = request ? balanceOwedCents(request) : 0;
  if (!request || !owed || !PAID_STATUSES.includes(request.status)) return { error: "No balance is due on this request." };
  const [deposit] = request.orderId ? await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, request.orderId)) : [];
  if (deposit?.status === "refunded") return { error: "The deposit on this request was refunded." };
  await db.update(schema.bespokeRequests).set({ balanceRequestedAt: new Date(), updatedAt: new Date() }).where(eq(schema.bespokeRequests.id, request.id));
  const link = `${appUrl()}${await mintLink(request.id)}`;
  const reference = bespokeRef(request.number);
  const emailed = await sendMail({
    to: request.email,
    subject: `Your balance for ${reference}`,
    text: [
      `Your piece ${reference} is ready for its final payment. The balance is ${money(owed)}.`,
      "",
      `Pay it here. This link is private to you: ${link}`,
      "",
      "We ship as soon as the balance is paid.",
    ].join("\n"),
  }).catch(() => false);
  if (request.phone) await sendWhatsApp({ to: request.phone, text: `Your balance for ${reference} is ${money(owed)}.` });
  return { emailed };
}

export async function recordBalancePaid(requestId: string, note: string) {
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, requestId)).for("update");
    const owed = request ? balanceOwedCents(request) : 0;
    if (!request || !owed) return { error: "No balance is due on this request." };
    if (request.balanceOrderId) {
      const [held] = await tx.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, request.balanceOrderId));
      if (held?.status === "pending") return { error: "The customer is paying this balance at checkout right now." };
    }
    await tx.update(schema.bespokeRequests).set({ balancePaidAt: new Date(), updatedAt: new Date() }).where(eq(schema.bespokeRequests.id, request.id));
    await tx.delete(schema.cartItems).where(and(eq(schema.cartItems.bespokeRequestId, request.id), eq(schema.cartItems.bespokePart, "balance")));
    if (request.orderId) {
      const [order] = await tx.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, request.orderId));
      if (order) await tx.insert(schema.orderEvents).values({ orderId: request.orderId, status: order.status, note: `Balance of ${money(owed)} on ${bespokeRef(request.number)} recorded as paid. ${note}` });
    }
    return { ok: true };
  });
}

const shareSignature = (requestId: string, expires: string) => createHmac("sha256", linkKey("bespoke-quote-share")).update(`${requestId}.${expires}`).digest();

export function quoteSharePath(requestId: string) {
  const expires = String(Math.floor(Date.now() / 1000) + QUOTE_SHARE_SECONDS);
  return `/bespoke/quote/${requestId}/${expires}.${shareSignature(requestId, expires).toString("base64url")}`;
}

export async function findQuoteShare(requestId: string, signature: string) {
  const [expires, signed] = signature.split(".");
  if (!expires || !signed || !/^\d{1,12}$/.test(expires) || Number(expires) < Date.now() / 1000) return null;
  const given = Buffer.from(signed, "base64url");
  const expected = shareSignature(requestId, expires);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const [request] = await db.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, requestId));
  return request ?? null;
}

export type MessageAuthor = "customer" | "team";
type Asker = { name: string; email: string; country: string; phone: string };

export const listMessages = (requestId: string) =>
  db
    .select({ id: schema.bespokeMessages.id, author: schema.bespokeMessages.author, body: schema.bespokeMessages.body, createdAt: schema.bespokeMessages.createdAt })
    .from(schema.bespokeMessages)
    .where(eq(schema.bespokeMessages.requestId, requestId))
    .orderBy(asc(schema.bespokeMessages.createdAt));

export async function awaitingReply(requestIds: string[]) {
  if (!requestIds.length) return new Set<string>();
  const rows = await db
    .selectDistinctOn([schema.bespokeMessages.requestId], { requestId: schema.bespokeMessages.requestId, author: schema.bespokeMessages.author })
    .from(schema.bespokeMessages)
    .where(inArray(schema.bespokeMessages.requestId, requestIds))
    .orderBy(schema.bespokeMessages.requestId, desc(schema.bespokeMessages.createdAt));
  return new Set(rows.filter((row) => row.author === "customer").map((row) => row.requestId));
}

function questionMail(reference: string, requestId: string, body: string, customer: { name: string; email: string }) {
  return sendMail({
    to: BRAND.email,
    subject: `Question on ${reference}`,
    text: [`${customer.name} <${customer.email}> asks:`, "", body, "", `Reply here: ${appUrl()}/admin/bespoke/${requestId}`].join("\n"),
  }).catch(() => false);
}

export async function createQuestion(asker: Asker, question: string, rawDesign: unknown): Promise<{ error: string } | { link: string; reference: string }> {
  if (JSON.stringify(rawDesign ?? null).length > LIMITS.designChars) return { error: "This design is too large to attach." };
  const parsed = designSchema.safeParse(rawDesign);
  if (!parsed.success) return { error: "This design could not be attached. Finish the piece you are drawing and try again." };
  const design: BespokeDesign = visibleDesign(parsed.data);
  const estimate = estimateDesign(design);
  if (!estimate) return { error: "Draw at least one closed piece so we can see what you mean." };
  const ownerKey = await ensureOwnerKey();
  if (!(await ownsLogos(design, ownerKey))) return { error: "One of the logos could not be found. Upload it again." };
  const [byAddress, byEmail] = await Promise.all([hitRateLimit(`bespoke-ask:${await clientIp()}`, MAX_PER_ADDRESS, WINDOW_SECONDS), hitRateLimit(`bespoke-ask-email:${asker.email}`, MAX_PER_EMAIL, WINDOW_SECONDS)]);
  if (byAddress || byEmail) return { error: "Too many questions sent. Try again in an hour." };

  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.bespokeRequests)
      .values({
        status: "question",
        ownerKey,
        name: asker.name,
        email: asker.email,
        country: asker.country,
        phone: asker.phone || null,
        productType: design.productType,
        notes: design.notes,
        design,
        estimateLowCents: estimate.lowCents,
        estimateHighCents: estimate.highCents,
      })
      .returning({ id: schema.bespokeRequests.id, number: schema.bespokeRequests.number });
    await tx.insert(schema.bespokeMessages).values({ requestId: created!.id, author: "customer", body: question });
    return created!;
  });

  const reference = bespokeRef(row.number);
  const link = await mintLink(row.id);
  await Promise.allSettled([
    sendMail({
      to: asker.email,
      subject: `We have your question, ${reference}`,
      text: [`Thank you. Your question and design are with the ${BRAND.name} workshop, and we will reply by email.`, "", `Follow the conversation here. This link is private to you: ${appUrl()}${link}`].join("\n"),
    }),
    questionMail(reference, row.id, question, asker),
  ]);
  return { link, reference };
}

export async function postCustomerMessage(request: { id: string; number: number; name: string; email: string }, body: string) {
  const [byRequest, byAddress] = await Promise.all([hitRateLimit(`bespoke-message:${request.id}`, 10, WINDOW_SECONDS), hitRateLimit(`bespoke-message-ip:${await clientIp()}`, 30, WINDOW_SECONDS)]);
  if (byRequest || byAddress) return { error: "Too many messages. Try again in an hour." };
  await db.insert(schema.bespokeMessages).values({ requestId: request.id, author: "customer", body });
  await questionMail(bespokeRef(request.number), request.id, body, request);
  return { ok: true };
}

export async function postTeamMessage(requestId: string, body: string) {
  const [request] = await db.select().from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, requestId));
  if (!request) return { error: "We could not find that request." };
  await db.insert(schema.bespokeMessages).values({ requestId, author: "team", body });
  const link = await mintLink(requestId);
  const reference = bespokeRef(request.number);
  const emailed = await sendMail({
    to: request.email,
    subject: `A reply from ${BRAND.name} on ${reference}`,
    text: [body, "", `Read the conversation and reply here. This link is private to you: ${appUrl()}${link}`].join("\n"),
  }).catch(() => false);
  return { emailed };
}

export async function listPastDesigns(ownerKey: string | null) {
  if (!ownerKey) return { saved: [], requests: [] };
  const [saved, requests] = await Promise.all([
    db.select().from(schema.bespokeDesigns).where(eq(schema.bespokeDesigns.ownerKey, ownerKey)).orderBy(desc(schema.bespokeDesigns.updatedAt)).limit(PAST_LIMIT),
    db
      .select({ id: schema.bespokeRequests.id, number: schema.bespokeRequests.number, status: schema.bespokeRequests.status, design: schema.bespokeRequests.design, createdAt: schema.bespokeRequests.createdAt })
      .from(schema.bespokeRequests)
      .where(or(eq(schema.bespokeRequests.ownerKey, ownerKey), eq(schema.bespokeRequests.acceptedOwnerKey, ownerKey)))
      .orderBy(desc(schema.bespokeRequests.createdAt))
      .limit(PAST_LIMIT),
  ]);
  return { saved, requests };
}
