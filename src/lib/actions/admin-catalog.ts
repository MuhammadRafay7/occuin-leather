"use server";

import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { matchingProductIds, type ProductQuery } from "@/app/admin/_lib/queries-catalog";
import { STOCK_REASONS, stockReason } from "@/app/admin/inventory/reasons";
import { MAX_IMPORT_CHARS, MAX_PRICE_CENTS, planImport, repricedCents, type Catalog, type ImportIssue } from "@/lib/catalog-import";
import { mediaPath } from "@/lib/media";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { contentUsingMedia } from "@/lib/server/content";
import { db, schema, type Transaction } from "@/lib/server/db";
import { mediaInUse, mediaUsage } from "@/lib/server/media";
import type { ActionResult } from "./admin";

const { categories, mediaImages, orderItems, products, reviews, stockMovements, variants } = schema;

export type BulkOperation = "activate" | "deactivate" | "feature" | "unfeature";
export type PriceLine = { variantId: string; productName: string; sku: string; label: string; fromCents: number; toCents: number };
export type PricePreview = ActionResult & { lines?: PriceLine[] };
export type DuplicateResult = ActionResult & { id?: string };
export type DeleteResult = ActionResult & { archived?: boolean };
export type ImportSummary = {
  rows: number;
  unchanged: number;
  issues: ImportIssue[];
  fingerprint: string;
  products: { key: string; created: boolean; changes: string[] }[];
  variants: { key: string; created: boolean; changes: string[] }[];
};
export type ImportPreview = ActionResult & { summary?: ImportSummary };

const MAX_SKU_LENGTH = 80;
const MAX_SLUG_LENGTH = 120;
const MAX_BULK_PRODUCTS = 200;
const MAX_BULK_STOCK_ROWS = 200;
const MAX_STOCK = 1_000_000;
const uuid = z.uuid();
const ids = z.array(uuid).min(1, "Select at least one product.").max(MAX_BULK_PRODUCTS, `Select at most ${MAX_BULK_PRODUCTS} products.`);

const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, message, fieldErrors });
const done = (message: string): ActionResult => ({ ok: true, message });
const refreshStore = () => revalidatePath("/", "layout");

class Refusal extends Error {}

async function attempt<T extends ActionResult>(task: () => Promise<T>): Promise<T | ActionResult> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof Refusal) return fail(error.message);
    console.error("[admin-catalog]", error);
    return fail("That did not save. Try again.");
  }
}

function fieldProblems(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return fail("Check the highlighted fields.", fieldErrors);
}

const firstProblem = (error: z.ZodError, fallback: string) => fail(error.issues[0]?.message ?? fallback);
const databaseCode = (error: unknown) => (((error as { cause?: unknown }).cause ?? error) as { code?: string }).code;

const department = z.enum(["women", "men", "leather"], "Choose a department.");
const categoryName = z.string().trim().min(1, "Enter a name.").max(60, "Keep the name under 60 characters.");
const categorySlug = z.string().min(1).max(160);
const slugPart = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^leather-/, "");

export async function createCategory(input: { name: string; department: string; address: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ name: categoryName, department, address: z.string().trim().max(60, "Keep the address under 60 characters.") })
    .safeParse(input);
  if (!parsed.success) return fieldProblems(parsed.error);
  const part = slugPart(parsed.data.address || parsed.data.name);
  if (!part) return fail("Check the highlighted fields.", { address: "Use letters or numbers in the address." });
  const slug = `leather-${part}`;
  return attempt(async () => {
    const created = await db.transaction(async (tx) => {
      const rows = await tx.select({ slug: categories.slug, position: categories.position }).from(categories).for("update");
      if (rows.some((row) => row.slug === slug || row.slug === part)) return false;
      const position = Math.max(-1, ...rows.map((row) => row.position)) + 1;
      await tx.insert(categories).values({ slug, name: parsed.data.name, department: parsed.data.department, position });
      return true;
    });
    if (!created) return fail("Check the highlighted fields.", { address: "Another category already uses this address." });
    await recordAudit(admin, { action: "category.create", targetType: "category", targetId: slug, detail: parsed.data.name });
    refreshStore();
    return done(`${parsed.data.name} created.`);
  });
}

export async function updateCategory(input: { slug: string; name: string; department: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ slug: categorySlug, name: categoryName, department }).safeParse(input);
  if (!parsed.success) return fieldProblems(parsed.error);
  const { slug, name } = parsed.data;
  return attempt(async () => {
    const updated = await db.update(categories).set({ name, department: parsed.data.department }).where(eq(categories.slug, slug)).returning({ slug: categories.slug });
    if (!updated.length) return fail("We could not find that category.");
    await recordAudit(admin, { action: "category.update", targetType: "category", targetId: slug, detail: `${name}, ${parsed.data.department}` });
    refreshStore();
    return done("Saved.");
  });
}

export async function moveCategory(slug: string, direction: "up" | "down"): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ slug: categorySlug, direction: z.enum(["up", "down"]) }).safeParse({ slug, direction });
  if (!parsed.success) return fail("We could not find that category.");
  return attempt(async () => {
    const moved = await db.transaction(async (tx) => {
      const rows = await tx.select().from(categories).orderBy(asc(categories.position), asc(categories.slug)).for("update");
      const index = rows.findIndex((row) => row.slug === parsed.data.slug);
      if (index < 0) throw new Refusal("We could not find that category.");
      const peers = rows.filter((row) => row.department === rows[index]!.department);
      const peer = peers[peers.indexOf(rows[index]!) + (parsed.data.direction === "up" ? -1 : 1)];
      if (!peer) return false;
      const peerIndex = rows.indexOf(peer);
      [rows[index], rows[peerIndex]] = [rows[peerIndex]!, rows[index]!];
      for (const [position, row] of rows.entries()) {
        if (row.position !== position) await tx.update(categories).set({ position }).where(eq(categories.slug, row.slug));
      }
      return true;
    });
    if (!moved) return done("Already at the end of its department.");
    await recordAudit(admin, { action: "category.reorder", targetType: "category", targetId: parsed.data.slug, detail: parsed.data.direction });
    refreshStore();
    return done("Moved.");
  });
}

export async function deleteCategory(slug: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = categorySlug.safeParse(slug);
  if (!parsed.success) return fail("We could not find that category.");
  return attempt(async () => {
    try {
      const inUse = await db.$count(products, eq(products.categorySlug, parsed.data));
      if (inUse) return fail(`${inUse} ${inUse === 1 ? "product uses" : "products use"} this category, so it cannot be deleted.`);
      const deleted = await db.delete(categories).where(eq(categories.slug, parsed.data)).returning({ name: categories.name });
      if (!deleted.length) return fail("We could not find that category.");
      await recordAudit(admin, { action: "category.delete", targetType: "category", targetId: parsed.data, detail: deleted[0]!.name });
      refreshStore();
      return done(`${deleted[0]!.name} deleted.`);
    } catch (error) {
      if (databaseCode(error) === "23503") return fail("Products use this category, so it cannot be deleted.");
      throw error;
    }
  });
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return fail("We could not find that image.");
  const path = mediaPath(parsed.data);
  return attempt(async () => {
    const filename = await db.transaction(async (tx) => {
      const [image] = await tx.select({ filename: mediaImages.filename }).from(mediaImages).where(eq(mediaImages.id, parsed.data)).for("update");
      if (!image) throw new Refusal("We could not find that image.");
      const pages = await contentUsingMedia(path);
      if (pages.length) throw new Refusal(`The site content uses this image in ${pages.join(", ")}, so it cannot be deleted.`);
      const usage = await mediaUsage([path], tx);
      if (mediaInUse(path, usage)) {
        const names = (usage.usedBy.get(path) ?? []).map((product) => product.name).join(", ");
        throw new Refusal(names ? `This image is used by ${names}, so it cannot be deleted.` : "Past orders show this image, so it cannot be deleted.");
      }
      await tx.delete(mediaImages).where(eq(mediaImages.id, parsed.data));
      return image.filename;
    });
    await recordAudit(admin, { action: "media.delete", targetType: "media", targetId: parsed.data, detail: filename });
    revalidatePath("/admin", "layout");
    return done(`${filename} deleted.`);
  });
}

const BULK_CHANGES: Record<BulkOperation, { active?: boolean; featured?: boolean; label: string }> = {
  activate: { active: true, label: "activated" },
  deactivate: { active: false, label: "deactivated" },
  feature: { featured: true, label: "featured" },
  unfeature: { featured: false, label: "removed from featured" },
};

export async function selectMatchingProducts(query: ProductQuery) {
  await requireAdmin();
  return matchingProductIds(query, MAX_BULK_PRODUCTS);
}

export async function bulkUpdateProducts(productIds: string[], operation: BulkOperation): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ productIds: ids, operation: z.enum(["activate", "deactivate", "feature", "unfeature"]) }).safeParse({ productIds, operation });
  if (!parsed.success) return firstProblem(parsed.error, "Select at least one product.");
  const { label, ...change } = BULK_CHANGES[parsed.data.operation];
  return attempt(async () => {
    const updated = await db.update(products).set(change).where(inArray(products.id, parsed.data.productIds)).returning({ slug: products.slug });
    if (!updated.length) return fail("We could not find those products.");
    await recordAudit(admin, { action: `product.bulk.${parsed.data.operation}`, targetType: "product", detail: updated.map((row) => row.slug).join(", ") });
    refreshStore();
    return done(`${updated.length} ${updated.length === 1 ? "product" : "products"} ${label}.`);
  });
}

const percentText = z
  .string()
  .trim()
  .regex(/^[+-]?\d{1,3}(\.\d)?$/, "Enter a percentage such as 10 or -7.5.")
  .transform(Number)
  .refine((value) => value !== 0, "Enter a change other than zero.")
  .refine((value) => value >= -90 && value <= 500, "Enter a change from -90 to 500 percent.");

async function pricedLines(tx: Pick<typeof db, "select">, productIds: string[], percent: number): Promise<PriceLine[]> {
  const rows = await tx
    .select({ variant: variants, productName: products.name })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(inArray(products.id, productIds))
    .orderBy(asc(products.name), asc(variants.sku));
  return rows.map(({ variant, productName }) => ({
    variantId: variant.id,
    productName,
    sku: variant.sku,
    label: `${variant.color}, ${variant.size}`,
    fromCents: variant.priceCents,
    toCents: repricedCents(variant.priceCents, percent),
  }));
}

const priceProblem = (lines: PriceLine[]) =>
  lines.some((line) => line.toCents < 1)
    ? "A price would fall to zero. Use a smaller reduction."
    : lines.some((line) => line.toCents > MAX_PRICE_CENTS)
      ? "A price would pass the limit. Use a smaller increase."
      : null;

export async function previewPriceChange(productIds: string[], percent: string): Promise<PricePreview> {
  await requireAdmin();
  const parsed = z.object({ productIds: ids, percent: percentText }).safeParse({ productIds, percent });
  if (!parsed.success) return firstProblem(parsed.error, "Enter a percentage.");
  return attempt(async () => {
    const lines = await pricedLines(db, parsed.data.productIds, parsed.data.percent);
    if (!lines.length) return fail("Those products have no variants.");
    const problem = priceProblem(lines);
    if (problem) return fail(problem);
    return { ok: true, message: `${lines.length} ${lines.length === 1 ? "price" : "prices"} will change.`, lines };
  });
}

export async function applyPriceChange(productIds: string[], percent: string, expected: { variantId: string; fromCents: number }[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      productIds: ids,
      percent: percentText,
      expected: z.array(z.object({ variantId: uuid, fromCents: z.number().int().positive() })).min(1),
    })
    .safeParse({ productIds, percent, expected });
  if (!parsed.success) return firstProblem(parsed.error, "Preview the change first.");
  return attempt(async () => {
    const changed = await db.transaction(async (tx) => {
      await tx.select({ id: variants.id }).from(variants).where(inArray(variants.productId, parsed.data.productIds)).for("update");
      const lines = await pricedLines(tx, parsed.data.productIds, parsed.data.percent);
      const seen = new Map(parsed.data.expected.map((line) => [line.variantId, line.fromCents]));
      if (lines.length !== seen.size || lines.some((line) => seen.get(line.variantId) !== line.fromCents)) {
        throw new Refusal("Prices changed since the preview. Nothing was saved. Preview again.");
      }
      const problem = priceProblem(lines);
      if (problem) throw new Refusal(problem);
      for (const line of lines) await tx.update(variants).set({ priceCents: line.toCents }).where(eq(variants.id, line.variantId));
      return lines.length;
    });
    await recordAudit(admin, { action: "product.bulk.price", targetType: "product", detail: `${parsed.data.percent}% on ${changed} variants of ${parsed.data.productIds.length} products` });
    refreshStore();
    return done(`${changed} ${changed === 1 ? "price" : "prices"} updated.`);
  });
}

function firstFree(base: string, taken: Set<string>, maxLength: number, copyWord: string) {
  for (let copy = 1; ; copy++) {
    const suffix = copy === 1 ? `-${copyWord}` : `-${copyWord}-${copy}`;
    const candidate = `${base.slice(0, maxLength - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function duplicateProduct(productId: string): Promise<DuplicateResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(productId);
  if (!parsed.success) return fail("We could not find that product.");
  return attempt(async () => {
    const copy = await db.transaction(async (tx) => {
      const [source] = await tx.select().from(products).where(eq(products.id, parsed.data));
      if (!source) throw new Refusal("We could not find that product.");
      const options = await tx.select().from(variants).where(eq(variants.productId, source.id)).orderBy(asc(variants.sku));
      const slugs = new Set((await tx.select({ slug: products.slug }).from(products)).map((row) => row.slug));
      const skus = new Set((await tx.select({ sku: variants.sku }).from(variants)).map((row) => row.sku));
      const { id: _id, createdAt: _createdAt, ...fields } = source;
      const [created] = await tx
        .insert(products)
        .values({ ...fields, name: `${source.name} copy`.slice(0, 120), slug: firstFree(source.slug, slugs, MAX_SLUG_LENGTH, "copy"), active: false, featured: false })
        .returning();
      for (const option of options) {
        const sku = firstFree(option.sku, skus, MAX_SKU_LENGTH, "COPY");
        skus.add(sku);
        await tx.insert(variants).values({ productId: created!.id, sku, color: option.color, size: option.size, priceCents: option.priceCents, stock: 0 });
      }
      return created!;
    });
    await recordAudit(admin, { action: "product.duplicate", targetType: "product", targetId: copy.id, detail: `from ${parsed.data}` });
    refreshStore();
    return { ok: true, message: `${copy.name} created. It stays inactive until you activate it.`, id: copy.id };
  });
}

export async function deleteProduct(productId: string): Promise<DeleteResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(productId);
  if (!parsed.success) return fail("We could not find that product.");
  return attempt(async () => {
    const outcome = await db.transaction(async (tx) => {
      const [product] = await tx.select({ name: products.name, slug: products.slug }).from(products).where(eq(products.id, parsed.data)).for("update");
      if (!product) throw new Refusal("We could not find that product.");
      const options = await tx.select({ id: variants.id }).from(variants).where(eq(variants.productId, parsed.data)).for("update");
      const ordered = options.length ? await tx.$count(orderItems, inArray(orderItems.variantId, options.map((option) => option.id))) : 0;
      if (ordered) {
        await tx.update(products).set({ active: false, featured: false }).where(eq(products.id, parsed.data));
        return { ...product, archived: true };
      }
      await tx.delete(products).where(eq(products.id, parsed.data));
      return { ...product, archived: false };
    });
    await recordAudit(admin, {
      action: outcome.archived ? "product.archive" : "product.delete",
      targetType: "product",
      targetId: parsed.data,
      detail: outcome.slug,
    });
    refreshStore();
    return outcome.archived
      ? { ok: true, archived: true, message: `${outcome.name} is on past orders, so it was archived and hidden from the store instead.` }
      : { ok: true, archived: false, message: `${outcome.name} deleted.` };
  });
}

async function loadCatalog(source: Pick<typeof db, "select">, lock: boolean): Promise<Catalog> {
  const categoryRows = await source.select({ slug: categories.slug }).from(categories);
  const mediaRows = await source.select({ id: mediaImages.id }).from(mediaImages);
  const productQuery = source.select().from(products);
  const productRows = await (lock ? productQuery.for("update") : productQuery);
  const variantQuery = source.select().from(variants);
  const variantRows = await (lock ? variantQuery.for("update") : variantQuery);
  return { categories: categoryRows.map((row) => row.slug), mediaIds: mediaRows.map((row) => row.id), products: productRows, variants: variantRows };
}

const planFingerprint = (plan: ReturnType<typeof planImport>) => createHash("sha256").update(JSON.stringify([plan.products, plan.variants])).digest("hex");

function importText(text: string): string | null {
  if (typeof text !== "string" || !text.trim()) return "Choose a CSV file.";
  return text.length > MAX_IMPORT_CHARS ? "The file must be under 3.5 MB." : null;
}

export async function previewProductImport(text: string): Promise<ImportPreview> {
  await requireAdmin();
  const problem = importText(text);
  if (problem) return fail(problem);
  return attempt(async () => {
    const plan = planImport(text, await loadCatalog(db, false));
    const summary: ImportSummary = {
      rows: plan.rows,
      unchanged: plan.unchanged,
      issues: plan.issues,
      fingerprint: planFingerprint(plan),
      products: plan.products.map((op) => ({ key: op.slug, created: !op.id, changes: op.changes })),
      variants: plan.variants.map((op) => ({ key: `${op.productSlug}, ${op.values.sku}`, created: !op.id, changes: op.changes })),
    };
    return { ok: !plan.issues.length, message: plan.issues.length ? `${plan.issues.length} ${plan.issues.length === 1 ? "problem" : "problems"} to fix. Nothing was saved.` : "Check the changes below, then apply them.", summary };
  });
}

async function writeImport(tx: Transaction, plan: ReturnType<typeof planImport>, actorEmail: string) {
  const idBySlug = new Map((await tx.select({ id: products.id, slug: products.slug }).from(products)).map((row) => [row.slug, row.id]));
  for (const op of plan.products) {
    if (op.id) {
      await tx.update(products).set(op.values).where(eq(products.id, op.id));
      continue;
    }
    const [created] = await tx.insert(products).values(op.values).returning({ id: products.id });
    idBySlug.set(op.slug, created!.id);
  }
  for (const op of plan.variants) {
    const { sku, color, size, priceCents, stock } = op.values;
    if (op.id) {
      await tx.update(variants).set({ color, size, priceCents, stock }).where(eq(variants.id, op.id));
      if (op.previousStock !== stock) {
        await tx.insert(stockMovements).values({ variantId: op.id, delta: stock - op.previousStock!, stockAfter: stock, reason: "CSV import", actorEmail });
      }
      continue;
    }
    const [created] = await tx.insert(variants).values({ productId: idBySlug.get(op.productSlug)!, sku, color, size, priceCents, stock }).returning({ id: variants.id });
    if (stock) await tx.insert(stockMovements).values({ variantId: created!.id, delta: stock, stockAfter: stock, reason: "CSV import, opening stock", actorEmail });
  }
}

export async function applyProductImport(text: string, fingerprint: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const problem = importText(text);
  if (problem) return fail(problem);
  return attempt(async () => {
    const plan = await db.transaction(async (tx) => {
      const current = planImport(text, await loadCatalog(tx, true));
      if (current.issues.length) throw new Refusal("The file no longer passes validation. Nothing was saved. Preview it again.");
      if (planFingerprint(current) !== fingerprint) throw new Refusal("The catalogue changed since the preview. Nothing was saved. Preview it again.");
      await writeImport(tx, current, admin.email);
      return current;
    });
    await recordAudit(admin, { action: "product.import", targetType: "product", detail: `${plan.products.length} products and ${plan.variants.length} variants changed` });
    refreshStore();
    return done(`Imported. ${plan.products.length} ${plan.products.length === 1 ? "product" : "products"} and ${plan.variants.length} ${plan.variants.length === 1 ? "variant" : "variants"} changed.`);
  });
}

const stockText = z
  .string()
  .trim()
  .regex(/^\d+$/, "Enter a whole number, 0 or more.")
  .transform(Number)
  .refine((value) => value <= MAX_STOCK, "Stock cannot exceed 1,000,000.");
const reason = z.enum(STOCK_REASONS, "Choose a reason.");
const note = z.string().trim().max(200, "Keep the note under 200 characters.");

export async function setStockInBulk(input: { reason: string; note: string; rows: { variantId: string; stock: string; expectedStock: number }[] }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      reason,
      note,
      rows: z
        .array(z.object({ variantId: uuid, stock: stockText, expectedStock: z.number().int() }))
        .min(1, "Change at least one count.")
        .max(MAX_BULK_STOCK_ROWS),
    })
    .safeParse(input);
  if (!parsed.success) return firstProblem(parsed.error, "Check the counts.");
  const recorded = stockReason(parsed.data.reason, parsed.data.note);
  return attempt(async () => {
    const changed = parsed.data.rows.filter((row) => row.stock !== row.expectedStock);
    try {
      await db.transaction(async (tx) => {
        for (const row of changed) {
          const [updated] = await tx
            .update(variants)
            .set({ stock: row.stock })
            .where(and(eq(variants.id, row.variantId), eq(variants.stock, row.expectedStock)))
            .returning({ id: variants.id });
          if (!updated) throw new Refusal("Stock changed while you were editing. Nothing was saved. The current counts are now shown.");
          await tx.insert(stockMovements).values({ variantId: row.variantId, delta: row.stock - row.expectedStock, stockAfter: row.stock, reason: recorded, actorEmail: admin.email });
        }
      });
    } catch (error) {
      refreshStore();
      throw error;
    }
    await recordAudit(admin, { action: "stock.bulk", targetType: "variant", detail: `${changed.length} variants, ${recorded}` });
    refreshStore();
    return done(`${changed.length} ${changed.length === 1 ? "count" : "counts"} saved.`);
  });
}

export async function adjustStock(input: { variantId: string; delta: string; reason: string; note: string; expectedStock: number }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      variantId: uuid,
      delta: z
        .string()
        .trim()
        .regex(/^[+-]?\d{1,7}$/, "Enter a change such as 5 or -2.")
        .transform(Number)
        .refine((value) => value !== 0, "Enter a change other than zero."),
      reason,
      note,
      expectedStock: z.number().int(),
    })
    .safeParse(input);
  if (!parsed.success) return fieldProblems(parsed.error);
  const { variantId, delta, expectedStock } = parsed.data;
  const stockAfter = expectedStock + delta;
  if (stockAfter < 0) return fail("Check the highlighted fields.", { delta: `Stock is ${expectedStock}, so it cannot fall by ${-delta}.` });
  if (stockAfter > MAX_STOCK) return fail("Check the highlighted fields.", { delta: "Stock cannot exceed 1,000,000." });
  const recorded = stockReason(parsed.data.reason, parsed.data.note);
  return attempt(async () => {
    const saved = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(variants)
        .set({ stock: sql`${variants.stock} + ${delta}` })
        .where(and(eq(variants.id, variantId), eq(variants.stock, expectedStock)))
        .returning({ sku: variants.sku });
      if (!updated) return null;
      await tx.insert(stockMovements).values({ variantId, delta, stockAfter, reason: recorded, actorEmail: admin.email });
      return updated;
    });
    refreshStore();
    if (!saved) return fail("Stock changed while you were editing. The current count is now shown.");
    await recordAudit(admin, { action: "stock.adjust", targetType: "variant", targetId: variantId, detail: `${saved.sku} ${delta > 0 ? "+" : ""}${delta}, ${recorded}` });
    return done(`Stock is now ${stockAfter}.`);
  });
}

async function reviewedProduct(reviewId: string) {
  const [row] = await db
    .select({ title: reviews.title, slug: products.slug })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.id, reviewId));
  return row ?? null;
}

export async function setReviewHidden(reviewId: string, hidden: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ reviewId: uuid, hidden: z.boolean() }).safeParse({ reviewId, hidden });
  if (!parsed.success) return fail("We could not find that review.");
  return attempt(async () => {
    const updated = await db.update(reviews).set({ hiddenAt: parsed.data.hidden ? new Date() : null }).where(eq(reviews.id, parsed.data.reviewId)).returning({ id: reviews.id });
    if (!updated.length) return fail("We could not find that review.");
    await recordAudit(admin, { action: parsed.data.hidden ? "review.hide" : "review.unhide", targetType: "review", targetId: parsed.data.reviewId });
    refreshStore();
    return done(parsed.data.hidden ? "Hidden from the store." : "Visible in the store.");
  });
}

export async function replyToReview(reviewId: string, reply: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ reviewId: uuid, reply: z.string().trim().max(2000, "Keep the reply under 2,000 characters.") })
    .safeParse({ reviewId, reply });
  if (!parsed.success) return firstProblem(parsed.error, "We could not find that review.");
  const text = parsed.data.reply || null;
  return attempt(async () => {
    const updated = await db
      .update(reviews)
      .set({ reply: text, repliedAt: text ? new Date() : null })
      .where(eq(reviews.id, parsed.data.reviewId))
      .returning({ id: reviews.id });
    if (!updated.length) return fail("We could not find that review.");
    await recordAudit(admin, { action: text ? "review.reply" : "review.reply_remove", targetType: "review", targetId: parsed.data.reviewId, detail: text ?? "" });
    refreshStore();
    return done(text ? "Reply published." : "Reply removed.");
  });
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(reviewId);
  if (!parsed.success) return fail("We could not find that review.");
  return attempt(async () => {
    const review = await reviewedProduct(parsed.data);
    if (!review) return fail("We could not find that review.");
    await db.delete(reviews).where(eq(reviews.id, parsed.data));
    await recordAudit(admin, { action: "review.delete", targetType: "review", targetId: parsed.data, detail: `${review.slug}: ${review.title}` });
    refreshStore();
    return done("Review deleted.");
  });
}
