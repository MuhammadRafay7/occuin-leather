"use server";

import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { ensureOwnerKey, getOwnerKey, hitRateLimit } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { quoteDesign } from "@/lib/studio/pricing";
import { designSpecSchema, type DesignSpec } from "@/lib/studio/spec";

const { designPreviews, designs } = schema;

const PREVIEW_VIEW = "hero";
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const WEBP_PREFIX = "data:image/webp;base64,";
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const RATE_WINDOW_SECONDS = 3600;
const MAX_SAVES_PER_OWNER = 40;
const MAX_SAVES_PER_ADDRESS = 120;
const MAX_LISTED = 50;

const id = z.uuid();

export type SavedDesign = { id: string; name: string; priceCents: number; updatedAt: string; spec: DesignSpec };
export type SaveResult = { ok: true; id: string; priceCents: number } | { ok: false; error: string };

function decodePreview(dataUrl: unknown) {
  if (dataUrl === null || dataUrl === undefined) return { bytes: null };
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(WEBP_PREFIX)) return { error: true };
  const encoded = dataUrl.slice(WEBP_PREFIX.length);
  if (encoded.length > Math.ceil((MAX_PREVIEW_BYTES * 4) / 3) + 4 || !BASE64.test(encoded)) return { error: true };
  const bytes = Buffer.from(encoded, "base64");
  const isWebp = bytes.length > 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP";
  if (!isWebp || bytes.length > MAX_PREVIEW_BYTES) return { error: true };
  return { bytes };
}

async function overLimit(owner: string) {
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const [byOwner, byAddress] = await Promise.all([
    hitRateLimit(`design-save:${owner}`, MAX_SAVES_PER_OWNER, RATE_WINDOW_SECONDS),
    hitRateLimit(`design-save-ip:${forwarded || "unknown"}`, MAX_SAVES_PER_ADDRESS, RATE_WINDOW_SECONDS),
  ]);
  return byOwner || byAddress;
}

export async function saveDesign(input: { id?: string | null; spec: unknown; preview?: string | null }): Promise<SaveResult> {
  const owner = await ensureOwnerKey();
  if (await overLimit(owner)) return { ok: false, error: "You have saved a great deal this hour. Please try again shortly." };

  const parsed = designSpecSchema.safeParse(input.spec);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "This design cannot be made as it stands." };

  const preview = decodePreview(input.preview);
  if (preview.error) return { ok: false, error: "The preview image could not be read." };

  const spec = parsed.data;
  const priceCents = quoteDesign(spec).totalCents;
  const existingId = id.safeParse(input.id).data;

  const savedId = await db.transaction(async (tx) => {
    const [updated] = existingId
      ? await tx
          .update(designs)
          .set({ name: spec.name, spec, priceCents, updatedAt: new Date() })
          .where(and(eq(designs.id, existingId), eq(designs.ownerKey, owner)))
          .returning({ id: designs.id })
      : [];
    const row = updated ?? (await tx.insert(designs).values({ ownerKey: owner, name: spec.name, spec, priceCents }).returning({ id: designs.id }))[0]!;
    if (preview.bytes) {
      await tx
        .insert(designPreviews)
        .values({ designId: row.id, view: PREVIEW_VIEW, webp: preview.bytes })
        .onConflictDoUpdate({ target: [designPreviews.designId, designPreviews.view], set: { webp: preview.bytes } });
    }
    return row.id;
  });

  return { ok: true, id: savedId, priceCents };
}

export async function listDesigns(): Promise<SavedDesign[]> {
  const owner = await getOwnerKey();
  if (!owner) return [];
  const rows = await db
    .select({ id: designs.id, name: designs.name, priceCents: designs.priceCents, updatedAt: designs.updatedAt, spec: designs.spec })
    .from(designs)
    .where(eq(designs.ownerKey, owner))
    .orderBy(desc(designs.updatedAt))
    .limit(MAX_LISTED);
  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export async function deleteDesign(designId: string) {
  const owner = await getOwnerKey();
  const parsed = id.safeParse(designId);
  if (!owner || !parsed.success) return { ok: false };
  await db.delete(designs).where(and(eq(designs.id, parsed.data), eq(designs.ownerKey, owner)));
  return { ok: true };
}
