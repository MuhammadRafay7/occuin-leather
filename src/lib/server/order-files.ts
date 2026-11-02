import { and, eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { BespokeDesign } from "../bespoke/design";
import { IMAGE_PATH, mediaIdOf } from "../media";
import { db, schema, type Transaction } from "./db";

const { bespokeLogos, bespokeRequestImages, mediaImages, orderItemFiles } = schema;

const MAX_FILE_BYTES = 4_194_304;
const PHOTO_EDGE_PX = 1600;
const MAX_INPUT_PIXELS = 100_000_000;
export const MAX_SHEET_PHOTOS = 6;

type Writer = Pick<typeof db, "select" | "insert">;
type NewFile = { kind: "photo" | "logo" | "reference"; slot: string; label: string; contentType: string; width?: number | null; height?: number | null; bytes: Buffer };

async function storeFile(source: Writer, orderItemId: string, file: NewFile) {
  if (file.bytes.length > MAX_FILE_BYTES) return;
  await source.insert(orderItemFiles).values({ orderItemId, ...file, width: file.width ?? null, height: file.height ?? null, byteSize: file.bytes.length }).onConflictDoNothing();
}

const logoIds = (design: BespokeDesign) => [...new Set(design.pieces.flatMap((piece) => (piece.logo ? [piece.logo.id] : [])))];

export async function freezeBespokeFiles(source: Writer, orderItemId: string, requestId: string, design: BespokeDesign) {
  const ids = logoIds(design);
  const logos = ids.length ? await source.select().from(bespokeLogos).where(inArray(bespokeLogos.id, ids)) : [];
  for (const logo of logos) await storeFile(source, orderItemId, { kind: "logo", slot: logo.id, label: logo.filename, contentType: "image/png", bytes: logo.png });
  const references = await source.select().from(bespokeRequestImages).where(eq(bespokeRequestImages.requestId, requestId));
  for (const image of references) await storeFile(source, orderItemId, { kind: "reference", slot: String(image.position), label: image.filename, contentType: image.contentType, bytes: image.bytes });
}

export async function freezeMediaPhotos(source: Writer, orderItemId: string, images: string[]) {
  const wanted = images.slice(0, MAX_SHEET_PHOTOS).map((path, index) => ({ id: mediaIdOf(path), index })).filter((entry): entry is { id: string; index: number } => Boolean(entry.id));
  if (!wanted.length) return;
  const rows = await source.select().from(mediaImages).where(inArray(mediaImages.id, wanted.map((entry) => entry.id)));
  for (const { id, index } of wanted) {
    const row = rows.find((item) => item.id === id);
    if (row) await storeFile(source, orderItemId, { kind: "photo", slot: String(index), label: `Product photo ${index + 1}`, contentType: row.contentType, width: row.width, height: row.height, bytes: row.bytes });
  }
}

async function publicImage(path: string) {
  if (!IMAGE_PATH.test(path) || !path.startsWith("/images/")) return null;
  const fromDisk = await readFile(join(process.cwd(), "public", path)).catch(() => null);
  if (fromDisk) return fromDisk;
  const response = await fetch(new URL(path, process.env.APP_URL ?? "http://localhost:3000"), { signal: AbortSignal.timeout(8000) }).catch(() => null);
  return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

export async function freezeStaticPhotos(orderItemId: string, images: string[]) {
  const shown = images.slice(0, MAX_SHEET_PHOTOS);
  const held = await db.select({ slot: orderItemFiles.slot }).from(orderItemFiles).where(and(eq(orderItemFiles.orderItemId, orderItemId), eq(orderItemFiles.kind, "photo")));
  for (const [index, path] of shown.entries()) {
    if (held.some((file) => file.slot === String(index)) || mediaIdOf(path)) continue;
    const bytes = await publicImage(path);
    if (!bytes) continue;
    const encoded = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).resize(PHOTO_EDGE_PX, PHOTO_EDGE_PX, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toBuffer({ resolveWithObject: true }).catch(() => null);
    if (encoded) await storeFile(db, orderItemId, { kind: "photo", slot: String(index), label: `Product photo ${index + 1}`, contentType: "image/jpeg", width: encoded.info.width, height: encoded.info.height, bytes: encoded.data });
  }
}

