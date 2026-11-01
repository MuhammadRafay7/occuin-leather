"use server";

import { and, asc, eq, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { variantToInput, type VariantInput } from "@/app/admin/_lib/format";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { moveOrder } from "@/lib/server/orders";

const { categories, contactMessages, orders, products, promoCodes, variants } = schema;

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
export type MoveInput = { orderId: string; to: OrderStatus; trackingNumber: string; note: string };
export type PromoInput = { code: string; percentOff: string; minSubtotal: string; expiresOn: string };

const MAX_STOCK = 1_000_000;
const IMAGE_PATH = /^\/images\/(?!.*\.\.)[\w./-]+$/;
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
          .array(z.string().regex(IMAGE_PATH, "Each path must sit under /images, such as /images/gown-scarlet.webp."))
          .min(1, "Add at least one image path."),
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

class VariantConflict extends Error {
  constructor(readonly index: number, message: string) {
    super(message);
  }
}

function describeSaveError(error: unknown, rows: { sku: string }[]): ActionResult | null {
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
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, variants: rows, ...fields } = parsed.data;

  return attempt(async () => {
    const [category] = await db.select({ slug: categories.slug }).from(categories).where(eq(categories.slug, fields.categorySlug));
    if (!category) return fail("Check the highlighted fields.", { categorySlug: "Choose a category." });

    try {
      const productId = await db.transaction(async (tx) => {
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
            await tx.insert(variants).values({ ...values, productId: saved.id, stock: row.stock });
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
        }
        return saved.id;
      });

      const fresh = await db.select().from(variants).where(eq(variants.productId, productId)).orderBy(asc(variants.sku));
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
  await requireAdmin();
  const parsed = z.object({ productId: uuid, active: z.boolean() }).safeParse({ productId, active });
  if (!parsed.success) return fail("We could not find that product.");
  return attempt(async () => {
    const updated = await db
      .update(products)
      .set({ active: parsed.data.active })
      .where(eq(products.id, parsed.data.productId))
      .returning({ name: products.name });
    if (!updated.length) return fail("We could not find that product.");
    refreshStore();
    return done(`${updated[0]!.name} is now ${parsed.data.active ? "active" : "inactive"}.`);
  });
}

export async function updateStock(variantId: string, stock: string, expectedStock: number): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      variantId: uuid,
      stock: z.string().trim().regex(/^\d+$/, "Enter a whole number, 0 or more.").transform(Number).refine((value) => value <= MAX_STOCK, "Stock cannot exceed 1,000,000."),
      expectedStock: z.number().int(),
    })
    .safeParse({ variantId, stock, expectedStock });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Enter a valid stock count.");
  return attempt(async () => {
    const updated = await db
      .update(variants)
      .set({ stock: parsed.data.stock })
      .where(and(eq(variants.id, parsed.data.variantId), eq(variants.stock, parsed.data.expectedStock)))
      .returning({ sku: variants.sku });
    refreshStore();
    if (!updated.length) return fail("Stock changed while you were editing. The current count is now shown.");
    return done(`Saved ${parsed.data.stock}.`);
  });
}

export async function moveOrderStatus(input: MoveInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      orderId: uuid,
      to: z.enum(ORDER_STATUSES),
      trackingNumber: z.string().trim().max(100, "Keep the tracking number under 100 characters."),
      note: z.string().trim().max(500, "Keep the note under 500 characters."),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { orderId, to, trackingNumber, note } = parsed.data;

  try {
    const result = await moveOrder(orderId, to, {
      note: note || undefined,
      trackingNumber: to === "shipped" && trackingNumber ? trackingNumber : undefined,
    });
    if ("error" in result) return fail(result.error ?? "That move is not allowed.");
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
});

export async function createPromo(input: PromoInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { code, percentOff, minSubtotal, expiresOn } = parsed.data;
  return attempt(async () => {
    try {
      await db.insert(promoCodes).values({
        code,
        percentOff,
        minSubtotalCents: minSubtotal,
        expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59.999Z`) : null,
      });
    } catch (error) {
      if (uniqueViolation(error)) return fail("Check the highlighted fields.", { code: "This code already exists." });
      throw error;
    }
    refreshStore();
    return done(`${code} created.`);
  });
}

export async function setPromoActive(code: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ code: z.string().min(1).max(32), active: z.boolean() }).safeParse({ code, active });
  if (!parsed.success) return fail("We could not find that code.");
  return attempt(async () => {
    const updated = await db
      .update(promoCodes)
      .set({ active: parsed.data.active })
      .where(eq(promoCodes.code, parsed.data.code))
      .returning({ code: promoCodes.code });
    if (!updated.length) return fail("We could not find that code.");
    refreshStore();
    return done(`${parsed.data.code} is now ${parsed.data.active ? "active" : "inactive"}.`);
  });
}

export async function setMessageHandled(messageId: string, handled: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ messageId: uuid, handled: z.boolean() }).safeParse({ messageId, handled });
  if (!parsed.success) return fail("We could not find that message.");
  return attempt(async () => {
    const updated = await db
      .update(contactMessages)
      .set({ handled: parsed.data.handled })
      .where(eq(contactMessages.id, parsed.data.messageId))
      .returning({ id: contactMessages.id });
    if (!updated.length) return fail("We could not find that message.");
    refreshAdmin();
    return done(parsed.data.handled ? "Marked handled." : "Reopened.");
  });
}
