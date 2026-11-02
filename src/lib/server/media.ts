import { arrayOverlaps, count, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { sniffImage } from "../bespoke/submission";
import { MEDIA_MAX_BYTES, mediaIdOf } from "../media";
import { db, schema } from "./db";

const { mediaImages, orderItems, products } = schema;

const MAX_INPUT_PIXELS = 100_000_000;
const MAX_EDGE_PX = 2400;
const QUALITIES = [82, 70, 58];
const ENCODE_TIMEOUT_SECONDS = 20;
const SHARP_FORMATS = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };

export type EncodedMedia = { bytes: Buffer; width: number; height: number };
type Reader = Pick<typeof db, "select">;

export async function encodeMedia(input: Buffer): Promise<EncodedMedia | { error: string }> {
  const type = sniffImage(input);
  if (!type) return { error: "Use a JPG, PNG or WebP image." };
  const format = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata().then((meta) => meta.format, () => null);
  if (format !== SHARP_FORMATS[type]) return { error: "This image could not be read." };
  try {
    for (const quality of QUALITIES) {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .timeout({ seconds: ENCODE_TIMEOUT_SECONDS })
        .autoOrient()
        .resize(MAX_EDGE_PX, MAX_EDGE_PX, { fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= MEDIA_MAX_BYTES) return { bytes: data, width: info.width, height: info.height };
    }
  } catch {
    return { error: "This image could not be read." };
  }
  return { error: "This image stays too large after compression. Use a smaller one." };
}

export async function mediaUsage(paths: string[], source: Reader = db) {
  const usedBy = new Map<string, { id: string; name: string }[]>();
  const orderLines = new Map<string, number>();
  if (!paths.length) return { usedBy, orderLines };
  const rows = await source.select({ id: products.id, name: products.name, images: products.images }).from(products).where(arrayOverlaps(products.images, paths));
  const lines = await source.select({ image: orderItems.image, total: count() }).from(orderItems).where(inArray(orderItems.image, paths)).groupBy(orderItems.image);
  for (const path of paths) usedBy.set(path, rows.filter((row) => row.images.includes(path)).map(({ id, name }) => ({ id, name })));
  for (const line of lines) orderLines.set(line.image!, line.total);
  return { usedBy, orderLines };
}

export const mediaInUse = (path: string, usage: Awaited<ReturnType<typeof mediaUsage>>) =>
  (usage.usedBy.get(path)?.length ?? 0) > 0 || (usage.orderLines.get(path) ?? 0) > 0;

export async function storedImageSize(src: string) {
  const id = mediaIdOf(src);
  if (!id) return null;
  const [row] = await db.select({ width: mediaImages.width, height: mediaImages.height }).from(mediaImages).where(eq(mediaImages.id, id));
  return row ?? null;
}
