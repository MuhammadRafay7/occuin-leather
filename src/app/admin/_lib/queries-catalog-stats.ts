import { avg, count, isNull, sum } from "drizzle-orm";
import { mediaPath } from "@/lib/media";
import { db, schema } from "@/lib/server/db";
import { mediaInUse, mediaUsage } from "@/lib/server/media";

const { mediaImages, reviews, variants } = schema;

export async function unitsInStock() {
  const [row] = await db.select({ units: sum(variants.stock) }).from(variants);
  return Number(row?.units ?? 0);
}

export async function mediaTotals() {
  const rows = await db.select({ id: mediaImages.id, byteSize: mediaImages.byteSize }).from(mediaImages);
  const paths = rows.map((row) => mediaPath(row.id));
  const usage = await mediaUsage(paths);
  const inUse = paths.filter((path) => mediaInUse(path, usage)).length;
  return { total: rows.length, inUse, unused: rows.length - inUse, bytes: rows.reduce((total, row) => total + row.byteSize, 0) };
}

export async function averageVisibleRating() {
  const [row] = await db.select({ average: avg(reviews.rating), total: count() }).from(reviews).where(isNull(reviews.hiddenAt));
  return { average: row?.average ? Number(row.average) : null, visible: row?.total ?? 0 };
}
