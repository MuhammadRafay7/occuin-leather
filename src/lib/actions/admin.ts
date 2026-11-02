"use server";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { variantToInput, type VariantInput } from "@/app/admin/_lib/format";
import { BESPOKE_STATUSES, depositProblem, type BespokeStatus } from "@/lib/bespoke/status";
import { IMAGE_PATH, MAX_PRODUCT_IMAGES, mediaIdsIn } from "@/lib/media";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { applyAdminUpdate, sendQuoteEmail } from "@/lib/server/bespoke";
import { db, schema } from "@/lib/server/db";
import { moveOrder } from "@/lib/server/orders";

const { categories, contactMessages, mediaImages, orders, products, promoCodes, stockMovements, variants } = schema;

export type ActionResult = { ok: boolean; message: string; fieldErrors?: Record<string, string> };
export type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  composition: string;
  categorySlug: string;
  images: string;
  audiences: string[];
  featured: boolean;
  active: boolean;
  variants: VariantInput[];
};
export type ProductResult = ActionResult & { id?: string; variants?: VariantInput[] };
export type MoveInput = { orderId: string; to: OrderStatus; trackingNumber: string; note: string; overrideBalance?: boolean };
export type BespokeInput = { id: string; status: BespokeStatus; quotedPrice: string; depositPercent: string; adminNote: string };
export type PromoInput = { code: string; percentOff: string; minSubtotal: string; expiresOn: string; maxUses: string; oncePerCustomer: boolean };

const MAX_STOCK = 1_000_000;
const uuid = z.uuid();

const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, message, fieldErrors });
const done = (message: string): ActionResult => ({ ok: true, message });
const refreshStore = () => revalidatePath("/", "layout");
const refreshAdmin = () => revalidatePath("/admin", "layout");

function invalid(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] === "images" ? "images" : issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }
  return fail("Check the highlighted fields.", fieldErrors);
}

async function attempt<T extends ActionResult>(task: () => Promise<T>): Promise<T | ActionResult> {
  try {
    return await task();
  } catch (error) {
    console.error("[admin]", error);
    return fail("That did not save. Try again.");
  }
}

function uniqueViolation(error: unknown) {
  const source = ((error as { cause?: unknown }).cause ?? error) as { code?: string; constraint?: string; detail?: string };
  return source.code === "23505" ? source : null;
}

const dollarsToCents = (value: string) => Math.round(Number(value) * 100);
const moneyText = (message: string) => z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, message).transform(dollarsToCents);

const variantSchema = z.object({
  id: uuid.optional(),
  color: z.string().trim().min(1, "Enter a colour.").max(60, "Keep the colour under 60 characters."),
  size: z.string().trim().min(1, "Enter a size.").max(30, "Keep the size under 30 characters."),
  sku: z
    .string()
    .trim()
    .min(1, "Enter a SKU.")
    .max(80, "Keep the SKU under 80 characters.")
    .regex(/^\S+$/, "A SKU cannot contain spaces.")
    .transform((value) => value.toUpperCase()),
  price: moneyText("Enter a price such as 1250 or 1250.50.").refine((cents) => cents > 0, "The price must be above zero."),
  stock: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number, 0 or more.")
    .transform(Number)
    .refine((stock) => stock <= MAX_STOCK, "Stock cannot exceed 1,000,000."),
  expectedStock: z.number().int().optional(),
});

const productSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1, "Enter a name.").max(120, "Keep the name under 120 characters."),
    slug: z
      .string()
      .trim()
      .min(1, "Enter a slug.")
      .max(120, "Keep the slug under 120 characters.")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
    description: z.string().trim().min(1, "Enter a description.").max(4000, "Keep the description under 4000 characters."),
    composition: z.string().trim().min(1, "Enter the composition.").max(1000, "Keep the composition under 1000 characters."),
    categorySlug: z.string().min(1, "Choose a category."),
    images: z
      .string()
      .transform((value) => value.split(/[\n,]+/).map((path) => path.trim()).filter(Boolean))
      .pipe(
        z
          .array(z.string().regex(IMAGE_PATH, "Each image must be an uploaded image or a path under /images."))
          .min(1, "Add at least one image.")
          .max(MAX_PRODUCT_IMAGES, `Use at most ${MAX_PRODUCT_IMAGES} images.`),
      ),
    audiences: z.array(z.enum(["women", "men"])).min(1, "Choose Women, Men or both."),
    featured: z.boolean(),
    active: z.boolean(),
    variants: z.array(variantSchema).min(1, "Add at least one variant."),
  })
  .superRefine((product, ctx) => {
    const skus = new Set<string>();
    const options = new Set<string>();
    product.variants.forEach((variant, index) => {
      if (skus.has(variant.sku)) ctx.addIssue({ code: "custom", path: ["variants", index, "sku"], message: "This SKU is already used in this list." });
      skus.add(variant.sku);
      const option = `${variant.color.toLowerCase()}|${variant.size.toLowerCase()}`;
      if (options.has(option)) ctx.addIssue({ code: "custom", path: ["variants", index, "size"], message: "This colour and size is already listed." });
      options.add(option);
    });
  });

class MissingMedia extends Error {}

class VariantConflict extends Error {
  constructor(readonly index: number, message: string) {
    super(message);
  }
}

function describeSaveError(error: unknown, rows: { sku: string }[]): ActionResult | null {
  if (error instanceof MissingMedia) return fail("Nothing was saved. An image was deleted from the media library.", { images: "Remove the missing image and save again." });
  if (error instanceof VariantConflict) {
    return fail("Nothing was saved. A variant changed while you were editing.", { [`variants.${error.index}.stock`]: error.message });
  }
  const unique = uniqueViolation(error);
  if (unique?.constraint === "products_slug_unique") {
    return fail("Nothing was saved. That slug is taken.", { slug: "Another product already uses this slug." });
  }
  if (unique?.constraint === "variants_sku_unique") {
    const sku = unique.detail?.match(/\(sku\)=\((.*)\)/)?.[1];
    const index = rows.findIndex((row) => row.sku === sku);
    return fail(`Nothing was saved. SKU ${sku ?? ""} is taken.`, { [`variants.${Math.max(index, 0)}.sku`]: "Another variant already uses this SKU." });
  }
  return null;
}

export async function saveProduct(input: ProductInput): Promise<ProductResult> {
  const admin = await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, variants: rows, ...fields } = parsed.data;

  return attempt(async () => {
    const [category] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, fields.categorySlug));
    if (!category) return fail("Check the highlighted fields.", { categorySlug: "Choose a category." });

    try {
      const productId = await db.transaction(async (tx) => {
        const mediaIds = [...new Set(mediaIdsIn(fields.images))];
        const found = mediaIds.length ? await tx.select({ id: mediaImages.id }).from(mediaImages).where(inArray(mediaImages.id, mediaIds)).for("share") : [];
        if (found.length !== mediaIds.length) throw new MissingMedia();

        const [saved] = id
          ? await tx.update(products).set(fields).where(eq(products.id, id)).returning({ id: products.id })
          : await tx.insert(products).values(fields).returning({ id: products.id });
        if (!saved) throw new Error(`Product ${id} no longer exists`);

        const kept = rows.flatMap((row) => (row.id ? [row.id] : []));
        await tx
          .delete(variants)
          .where(and(eq(variants.productId, saved.id), kept.length ? notInArray(variants.id, kept) : undefined));

        for (const [index, row] of rows.entries()) {
          const values = { color: row.color, size: row.size, sku: row.sku, priceCents: row.price };
          if (!row.id) {
            const [created] = await tx.insert(variants).values({ ...values, productId: saved.id, stock: row.stock }).returning({ id: variants.id });
            if (row.stock) await tx.insert(stockMovements).values({ variantId: created!.id, delta: row.stock, stockAfter: row.stock, reason: "New variant", actorEmail: admin.email });
            continue;
          }
          const stockEdited = row.expectedStock !== undefined && row.stock !== row.expectedStock;
          const updated = await tx
            .update(variants)
            .set(stockEdited ? { ...values, stock: row.stock } : values)
            .where(
              and(
                eq(variants.id, row.id),
                eq(variants.productId, saved.id),
                stockEdited ? eq(variants.stock, row.expectedStock!) : undefined,
              ),
            )
            .returning({ id: variants.id });
          if (!updated.length) throw new VariantConflict(index, "Stock changed while you were editing. Reload to see the current count.");
          if (stockEdited) await tx.insert(stockMovements).values({ variantId: row.id, delta: row.stock - row.expectedStock!, stockAfter: row.stock, reason: "Product edit", actorEmail: admin.email });
        }
        return saved.id;
      });

      const fresh = await db.select().from(variants).where(eq(variants.productId, productId)).orderBy(asc(variants.sku));
      await recordAudit(admin, { action: id ? "product.update" : "product.create", targetType: "product", targetId: productId, detail: fields.slug });
      refreshStore();
      return { ok: true, message: id ? "Product saved." : "Product created.", id: productId, variants: fresh.map(variantToInput) };
    } catch (error) {
      const known = describeSaveError(error, rows);
      if (known) return known;
      throw error;
    }
  });
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ productId: uuid, active: z.boolean() }).safeParse({ productId, active });
  if (!parsed.success) return fail("We could not find that product.");
  return attempt(async () => {
    const updated = await db
      .update(products)
      .set({ active: parsed.data.active })
      .where(eq(products.id, parsed.data.productId))
      .returning({ name: products.name });
    if (!updated.length) return fail("We could not find that product.");
    await recordAudit(admin, { action: parsed.data.active ? "product.activate" : "product.deactivate", targetType: "product", targetId: parsed.data.productId, detail: updated[0]!.name });
    refreshStore();
    return done(`${updated[0]!.name} is now ${parsed.data.active ? "active" : "inactive"}.`);
  });
}

export async function updateStock(variantId: string, stock: string, expectedStock: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      variantId: uuid,
      stock: z.string().trim().regex(/^\d+$/, "Enter a whole number, 0 or more.").transform(Number).refine((value) => value <= MAX_STOCK, "Stock cannot exceed 1,000,000."),
      expectedStock: z.number().int(),
    })
    .safeParse({ variantId, stock, expectedStock });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid stock count.");
  return attempt(async () => {
    const { variantId: id, stock: next, expectedStock: previous } = parsed.data;
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(variants)
        .set({ stock: next })
        .where(and(eq(variants.id, id), eq(variants.stock, previous)))
        .returning({ sku: variants.sku });
      if (rows.length && next !== previous) await tx.insert(stockMovements).values({ variantId: id, delta: next - previous, stockAfter: next, reason: "Manual stock edit", actorEmail: admin.email });
      return rows;
    });
    refreshStore();
    if (!updated.length) return fail("Stock changed while you were editing. The current count is now shown.");
    await recordAudit(admin, { action: "stock.set", targetType: "variant", targetId: id, detail: `${updated[0]!.sku} ${previous} to ${next}` });
    return done(`Saved ${parsed.data.stock}.`);
  });
}

export async function moveOrderStatus(input: MoveInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      orderId: uuid,
      to: z.enum(ORDER_STATUSES),
      trackingNumber: z.string().trim().max(100, "Keep the tracking number under 100 characters."),
      note: z.string().trim().max(500, "Keep the note under 500 characters."),
      overrideBalance: z.boolean().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, to, trackingNumber, note, overrideBalance } = parsed.data;

  try {
    const result = await moveOrder(orderId, to, {
      note: note || undefined,
      trackingNumber: to === "shipped" && trackingNumber ? trackingNumber : undefined,
      overrideBalance,
      actorEmail: admin.email,
    });
    if ("error" in result) return fail(result.error ?? "That move is not allowed.");
    await recordAudit(admin, { action: "order.status", targetType: "order", targetId: orderId, detail: note ? `${to}: ${note}` : to });
    refreshStore();
    return done(`Status is now ${STATUS_LABELS[to]}.`);
  } catch (error) {
    console.error("[admin]", error);
    refreshStore();
    const [order] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
    if (order?.status !== to) return fail("The order did not move. Try again.");
    return fail(
      to === "refunded"
        ? "The order is marked Refunded, but the Stripe refund failed. Check Stripe before telling the customer."
        : `Status is now ${STATUS_LABELS[to]}, but the follow-up step failed. The customer may not have been emailed.`,
    );
  }
}

const promoSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{3,32}$/, "Use 3 to 32 letters, numbers or hyphens.")),
  percentOff: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number from 1 to 90.")
    .transform(Number)
    .refine((value) => value >= 1 && value <= 90, "Enter a whole number from 1 to 90."),
  minSubtotal: moneyText("Enter an amount such as 0 or 250.50."),
  expiresOn: z.union([
    z.literal(""),
    z.iso
      .date("Enter a valid date.")
      .refine((value) => new Date(`${value}T23:59:59.999Z`) > new Date(), "The expiry date cannot be in the past."),
  ]),
  maxUses: z
    .string()
    .trim()
    .regex(/^$|^[1-9]\d{0,6}$/, "Enter a whole number above zero, or leave it blank.")
    .transform((value) => (value ? Number(value) : null)),
  oncePerCustomer: z.boolean(),
});

export async function createPromo(input: PromoInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { code, percentOff, minSubtotal, expiresOn, maxUses, oncePerCustomer } = parsed.data;
  return attempt(async () => {
    try {
      await db.insert(promoCodes).values({
        code,
        percentOff,
        minSubtotalCents: minSubtotal,
        expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59.999Z`) : null,
        maxUses,
        oncePerCustomer,
      });
    } catch (error) {
      if (uniqueViolation(error)) return fail("Check the highlighted fields.", { code: "This code already exists." });
      throw error;
    }
    await recordAudit(admin, { action: "promo.create", targetType: "promo", targetId: code, detail: `${percentOff}% off` });
    refreshStore();
    return done(`${code} created.`);
  });
}

export async function setPromoActive(code: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ code: z.string().min(1).max(32), active: z.boolean() }).safeParse({ code, active });
  if (!parsed.success) return fail("We could not find that code.");
  return attempt(async () => {
    const updated = await db
      .update(promoCodes)
      .set({ active: parsed.data.active })
      .where(eq(promoCodes.code, parsed.data.code))
      .returning({ code: promoCodes.code });
    if (!updated.length) return fail("We could not find that code.");
    await recordAudit(admin, { action: parsed.data.active ? "promo.activate" : "promo.deactivate", targetType: "promo", targetId: parsed.data.code });
    refreshStore();
    return done(`${parsed.data.code} is now ${parsed.data.active ? "active" : "inactive"}.`);
  });
}

export async function setMessageHandled(messageId: string, handled: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = z.object({ messageId: uuid, handled: z.boolean() }).safeParse({ messageId, handled });
  if (!parsed.success) return fail("We could not find that message.");
  return attempt(async () => {
    const updated = await db
      .update(contactMessages)
      .set({ handled: parsed.data.handled })
      .where(eq(contactMessages.id, parsed.data.messageId))
      .returning({ id: contactMessages.id });
    if (!updated.length) return fail("We could not find that message.");
    await recordAudit(admin, { action: parsed.data.handled ? "message.handled" : "message.reopened", targetType: "message", targetId: parsed.data.messageId });
    refreshAdmin();
    return done(parsed.data.handled ? "Marked handled." : "Reopened.");
  });
}

const bespokeInput = z.strictObject({
  id: uuid,
  status: z.enum(BESPOKE_STATUSES, "Choose a status."),
  quotedPrice: z.string().trim().regex(/^$|^\d{1,6}(\.\d{1,2})?$/, "Enter a price in dollars, for example 240 or 240.50."),
  depositPercent: z.string().trim().regex(/^\d{1,3}$/, "Enter a whole percent from 1 to 100.").transform(Number).refine((value) => value >= 1 && value <= 100, "Enter a whole percent from 1 to 100."),
  adminNote: z.string().trim().max(4000, "Keep the note under 4,000 characters."),
});

export async function updateBespokeRequest(input: BespokeInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = bespokeInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, status, quotedPrice, depositPercent, adminNote } = parsed.data;
  const quotedPriceCents = quotedPrice ? Math.round(Number(quotedPrice) * 100) : null;
  if (quotedPriceCents === 0) return fail("Check the highlighted fields.", { quotedPrice: "Enter a price above zero, or leave it blank." });
  if (status === "quoted" && !quotedPriceCents) return fail("Check the highlighted fields.", { quotedPrice: "Set the price before marking this as quoted." });
  const tooSmall = quotedPriceCents ? depositProblem(quotedPriceCents, depositPercent) : null;
  if (tooSmall) return fail("Check the highlighted fields.", { depositPercent: tooSmall });
  return attempt(async () => {
    const result = await applyAdminUpdate({ id, status, quotedPriceCents, depositPercent, adminNote });
    if ("error" in result) return fail(result.error ?? "That did not save. Try again.");
    await recordAudit(admin, { action: "bespoke.update", targetType: "bespoke", targetId: id, detail: `${status}${quotedPriceCents ? `, quote ${quotedPriceCents} cents` : ""}${result.requote ? `, quote email ${result.emailed ? "sent" : "failed"}` : ""}` });
    refreshAdmin();
    if (result.requote && !result.emailed) return fail("Saved, but the quote email could not be sent. Try sending it again.");
    return done(result.requote ? "Saved. Quote emailed to the customer." : "Saved.");
  });
}

export async function resendBespokeQuote(requestId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = uuid.safeParse(requestId);
  if (!parsed.success) return fail("We could not find that request.");
  return attempt(async () => {
    const sent = await sendQuoteEmail(parsed.data);
    if (!sent) return fail("The quote email could not be sent.");
    await recordAudit(admin, { action: "bespoke.quote_resend", targetType: "bespoke", targetId: parsed.data });
    refreshAdmin();
    return done("Quote emailed again.");
  });
}
