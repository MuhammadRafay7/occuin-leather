import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { designSchema } from "../bespoke/design";
import { bespokeRef } from "../bespoke/status";
import { orderRef } from "../format";
import { buildSheet, type Sheet, type SheetFile, type SheetOrder } from "../manufacturer/sheet";
import type { PdfPicture } from "../manufacturer/pdf";
import { bespokeSnapshotOf, productSnapshotOf } from "../manufacturer/snapshot";
import { isSheetView, SHOT_BACKGROUND, SHOT_MAX_BYTES, SHOT_PX, type SheetView } from "../manufacturer/views";
import { getDelivery } from "./content";
import { db, schema } from "./db";
import { decodeShot, readToken, signLink } from "./manufacturer-token";
import { freezeBespokeFiles, freezeMediaPhotos, freezeStaticPhotos } from "./order-files";
import { getOrder } from "./orders";

const { bespokeRequests, manufacturerLinks, orderItemFiles, orderItems, orders, products, variants } = schema;

const DAY_MS = 86_400_000;
const MAX_INPUT_PIXELS = 40_000_000;
const MIN_IMAGE_DETAIL = 3;
const PDF_MAX_BYTES = 3_600_000;
const PDF_STEPS = [{ edge: 1200, quality: 80 }, { edge: 1000, quality: 74 }, { edge: 800, quality: 70 }, { edge: 640, quality: 64 }, { edge: 480, quality: 58 }];

export const LINK_DAYS = [7, 14, 30, 90] as const;
export type LoadedOrder = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
export type LinkRow = typeof manufacturerLinks.$inferSelect;

async function freezeProductLine(item: LoadedOrder["items"][number]) {
  let snapshot = item.productSnapshot;
  if (!snapshot && item.variantId) {
    const [row] = await db.select({ variant: variants, product: products }).from(variants).innerJoin(products, eq(products.id, variants.productId)).where(eq(variants.id, item.variantId));
    if (!row) return;
    snapshot = productSnapshotOf(row.product, row.variant, new Date(), true);
    await db.update(orderItems).set({ productSnapshot: snapshot }).where(eq(orderItems.id, item.id));
    await freezeMediaPhotos(db, item.id, snapshot.images);
  }
  if (snapshot) await freezeStaticPhotos(item.id, snapshot.images);
}

async function freezeBespokeLine(item: LoadedOrder["items"][number]) {
  if (item.bespokeSnapshot || !item.bespokeRequestId || item.bespokePart === "balance") return;
  const [request] = await db.select().from(bespokeRequests).where(eq(bespokeRequests.id, item.bespokeRequestId));
  const design = designSchema.safeParse(request?.design);
  if (!request || !design.success) return;
  const snapshot = bespokeSnapshotOf({ ...request, design: design.data }, bespokeRef(request.number), new Date(), true);
  await db.update(orderItems).set({ bespokeSnapshot: snapshot }).where(eq(orderItems.id, item.id));
  await freezeBespokeFiles(db, item.id, request.id, design.data);
}

export async function loadOrderForSheet(orderId: string) {
  const order = await getOrder(orderId);
  if (!order) return null;
  if (order.makingDays === null) await db.update(orders).set({ makingDays: (await getDelivery()).makingMaxDays }).where(eq(orders.id, order.id));
  for (const item of order.items) {
    if (item.variantId || item.productSnapshot) await freezeProductLine(item);
    await freezeBespokeLine(item);
  }
  return getOrder(orderId);
}

const fileColumns = { id: orderItemFiles.id, orderItemId: orderItemFiles.orderItemId, kind: orderItemFiles.kind, slot: orderItemFiles.slot, label: orderItemFiles.label, contentType: orderItemFiles.contentType, width: orderItemFiles.width, height: orderItemFiles.height };

export async function sheetFiles(orderId: string): Promise<SheetFile[]> {
  return db.select(fileColumns).from(orderItemFiles).innerJoin(orderItems, eq(orderItems.id, orderItemFiles.orderItemId)).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItemFiles.createdAt));
}

const paidAt = (order: LoadedOrder) => order.events.find((event) => event.status === "paid")?.createdAt ?? null;

export const sheetOrder = (order: LoadedOrder): SheetOrder => ({
  id: order.id,
  number: order.number,
  status: order.status,
  createdAt: order.createdAt,
  paidAt: paidAt(order),
  makingDays: order.makingDays,
  shippingAddress: order.shippingAddress,
  items: order.items.map(({ id, name, quantity, designSpec, productSnapshot, bespokeSnapshot, bespokePart }) => ({ id, name, quantity, designSpec, productSnapshot, bespokeSnapshot, bespokePart })),
});

export async function loadSheet(orderId: string, includeAddress: boolean): Promise<Sheet | null> {
  const order = await loadOrderForSheet(orderId);
  if (!order) return null;
  return buildSheet(sheetOrder(order), await sheetFiles(orderId), { includeAddress });
}

export async function sheetFile(orderId: string, fileId: string) {
  const [row] = await db.select({ contentType: orderItemFiles.contentType, label: orderItemFiles.label, kind: orderItemFiles.kind, bytes: orderItemFiles.bytes }).from(orderItemFiles).innerJoin(orderItems, eq(orderItems.id, orderItemFiles.orderItemId)).where(and(eq(orderItemFiles.id, fileId), eq(orderItems.orderId, orderId)));
  return row ?? null;
}

export async function bespokeLine(orderId: string, itemId: string) {
  const [row] = await db.select({ snapshot: orderItems.bespokeSnapshot }).from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));
  return row?.snapshot ?? null;
}

export async function storeView(orderId: string, itemId: string, view: string, dataUrl: string) {
  if (!isSheetView(view)) return { error: "That view is not on the sheet." };
  const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));
  if (!item || !(item.designSpec || item.bespokeSnapshot)) return { error: "That line has no 3D design." };
  const bytes = decodeShot(dataUrl);
  if (!bytes) return { error: "The image is too large or could not be read." };
  const stats = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).stats().catch(() => null);
  if (!stats || stats.channels.every((channel) => channel.stdev < MIN_IMAGE_DETAIL)) return { error: "The image came out empty. Try again." };
  const encoded = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .resize(SHOT_PX, SHOT_PX, { fit: "contain", withoutEnlargement: true, background: SHOT_BACKGROUND })
    .flatten({ background: SHOT_BACKGROUND })
    .jpeg({ quality: 88, progressive: false })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null);
  if (!encoded || encoded.data.length > SHOT_MAX_BYTES) return { error: "The image is too large or could not be read." };
  const stored = await db
    .insert(orderItemFiles)
    .values({ orderItemId: itemId, kind: "view", slot: view, contentType: "image/jpeg", width: encoded.info.width, height: encoded.info.height, byteSize: encoded.data.length, bytes: encoded.data })
    .onConflictDoNothing()
    .returning({ id: orderItemFiles.id });
  return { stored: stored.length > 0 };
}

export async function clearViews(orderId: string, itemId: string) {
  const [item] = await db.select({ id: orderItems.id }).from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)));
  if (!item) return false;
  await db.delete(orderItemFiles).where(and(eq(orderItemFiles.orderItemId, itemId), eq(orderItemFiles.kind, "view")));
  return true;
}

export const missingViews = async (itemId: string, views: SheetView[]) => {
  const held = await db.select({ slot: orderItemFiles.slot }).from(orderItemFiles).where(and(eq(orderItemFiles.orderItemId, itemId), eq(orderItemFiles.kind, "view")));
  return views.filter((view) => !held.some((file) => file.slot === view));
};

async function encodeForPdf(files: { id: string; bytes: Buffer }[], step: (typeof PDF_STEPS)[number]) {
  const out = new Map<string, PdfPicture>();
  for (const file of files) {
    const encoded = await sharp(file.bytes, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize(step.edge, step.edge, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#d9d9d9" })
      .toColourspace("srgb")
      .jpeg({ quality: step.quality, progressive: false })
      .toBuffer({ resolveWithObject: true })
      .catch(() => null);
    if (encoded) out.set(file.id, { bytes: encoded.data, width: encoded.info.width, height: encoded.info.height });
  }
  return out;
}

export async function pdfPictures(sheet: Sheet) {
  const ids = sheet.lines.flatMap((line) => [...line.pictures, ...line.logos, ...line.references].map((picture) => picture.fileId));
  if (!ids.length) return new Map<string, PdfPicture>();
  const files = await db.select({ id: orderItemFiles.id, bytes: orderItemFiles.bytes }).from(orderItemFiles).where(inArray(orderItemFiles.id, ids));
  let pictures = new Map<string, PdfPicture>();
  for (const step of PDF_STEPS) {
    pictures = await encodeForPdf(files, step);
    if ([...pictures.values()].reduce((sum, picture) => sum + picture.bytes.length, 0) <= PDF_MAX_BYTES) break;
  }
  return pictures;
}

export const linkPath = (link: Pick<LinkRow, "id" | "orderId" | "expiresAt">) => `/manufacturer/${signLink(link)}`;
export const linkUrl = (link: Pick<LinkRow, "id" | "orderId" | "expiresAt">) => `${process.env.APP_URL ?? "http://localhost:3000"}${linkPath(link)}`;

export async function resolveLink(token: string) {
  const claim = readToken(token);
  if (!claim) return null;
  const [link] = await db
    .select()
    .from(manufacturerLinks)
    .where(and(eq(manufacturerLinks.id, claim.linkId), eq(manufacturerLinks.orderId, claim.orderId), isNull(manufacturerLinks.revokedAt), gt(manufacturerLinks.expiresAt, new Date())));
  return link ?? null;
}

export const touchLink = (linkId: string) => db.update(manufacturerLinks).set({ lastOpenedAt: new Date() }).where(eq(manufacturerLinks.id, linkId));

export async function createLink(orderId: string, days: number, includeAddress: boolean, createdBy: string) {
  const expiresAt = new Date(Date.now() + days * DAY_MS);
  const [link] = await db.insert(manufacturerLinks).values({ orderId, includeAddress, expiresAt, createdBy }).returning();
  return link!;
}

export const listLinks = (orderId: string) => db.select().from(manufacturerLinks).where(eq(manufacturerLinks.orderId, orderId)).orderBy(desc(manufacturerLinks.createdAt));

export async function revokeLink(orderId: string, linkId: string) {
  const [link] = await db.update(manufacturerLinks).set({ revokedAt: new Date() }).where(and(eq(manufacturerLinks.id, linkId), eq(manufacturerLinks.orderId, orderId), isNull(manufacturerLinks.revokedAt))).returning({ id: manufacturerLinks.id });
  return Boolean(link);
}

export async function setLineSent(orderId: string, itemId: string, sent: boolean, actorEmail: string) {
  const [row] = await db
    .update(orderItems)
    .set({ sentToMakerAt: sent ? new Date() : null, sentToMakerBy: sent ? actorEmail : null })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning({ id: orderItems.id });
  return Boolean(row);
}

export const sheetFilename = (number: number, suffix: string) => `OCCUIN-${orderRef(number)}-${suffix}`;
export const parseUuid = (value: string) => z.uuid().safeParse(value).data ?? null;
