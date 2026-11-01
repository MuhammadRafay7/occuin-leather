import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { designSpecSchema } from "../studio/spec";
import { quoteDesign } from "../studio/pricing";
import { db, schema } from "./db";

const { cartItems, carts, designs, products, promoCodes, variants } = schema;
const MAX_QUANTITY = 10;

export type CartLine = {
  id: string;
  kind: "product" | "design";
  name: string;
  detail: string;
  image: string | null;
  href: string;
  unitCents: number;
  quantity: number;
  available: number;
};

export type CartView = {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  promoError: string | null;
};

const EMPTY: CartView = { lines: [], count: 0, subtotalCents: 0, discountCents: 0, promoCode: null, promoError: null };

export async function findPromo(code: string, subtotalCents: number) {
  const [promo] = await db
    .select()
    .from(promoCodes)
    .where(
      and(
        eq(promoCodes.code, code.trim().toUpperCase()),
        eq(promoCodes.active, true),
        or(isNull(promoCodes.expiresAt), gt(promoCodes.expiresAt, new Date())),
      ),
    );
  if (!promo) return { error: "That code is not valid." } as const;
  if (subtotalCents < promo.minSubtotalCents) return { error: "Your bag does not reach the minimum for that code." } as const;
  return { promo } as const;
}

export async function getCart(ownerKey: string | null): Promise<CartView> {
  if (!ownerKey) return EMPTY;
  const [cart] = await db.select().from(carts).where(eq(carts.ownerKey, ownerKey));
  if (!cart) return EMPTY;
  const rows = await db
    .select({ item: cartItems, variant: variants, product: products, design: designs })
    .from(cartItems)
    .leftJoin(variants, eq(variants.id, cartItems.variantId))
    .leftJoin(products, eq(products.id, variants.productId))
    .leftJoin(designs, eq(designs.id, cartItems.designId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(cartItems.id);

  const lines = rows.flatMap(({ item, variant, product, design }): CartLine[] => {
    if (variant && product) {
      return [{
        id: item.id,
        kind: "product",
        name: product.name,
        detail: `${variant.color}, ${variant.size}`,
        image: product.images[0] ?? null,
        href: `/product/${product.slug}`,
        unitCents: variant.priceCents,
        quantity: item.quantity,
        available: product.active ? variant.stock : 0,
      }];
    }
    if (!design) return [];
    const spec = designSpecSchema.safeParse(design.spec);
    if (!spec.success) return [];
    const { totalCents } = quoteDesign(spec.data);
    return [{
      id: item.id,
      kind: "design",
      name: design.name,
      detail: `Made to your design, ${spec.data.form.width} × ${spec.data.form.height} × ${spec.data.form.depth} mm`,
      image: `/api/designs/${design.id}/preview`,
      href: `/studio?design=${design.id}`,
      unitCents: totalCents,
      quantity: item.quantity,
      available: MAX_QUANTITY,
    }];
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  const found = cart.promoCode ? await findPromo(cart.promoCode, subtotalCents) : null;
  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    discountCents: found && "promo" in found ? Math.round((subtotalCents * found.promo!.percentOff) / 100) : 0,
    promoCode: cart.promoCode,
    promoError: found && "error" in found ? (found.error ?? null) : null,
  };
}

async function openCart(ownerKey: string) {
  const [cart] = await db
    .insert(carts)
    .values({ ownerKey })
    .onConflictDoUpdate({ target: carts.ownerKey, set: { updatedAt: new Date() } })
    .returning();
  return cart!;
}

export async function addVariant(ownerKey: string, variantId: string) {
  const [row] = await db
    .select({ variant: variants, active: products.active })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(eq(variants.id, variantId));
  const variant = row?.variant;
  if (!variant || !row.active || variant.stock < 1) return { error: "This item is sold out." };
  const cart = await openCart(ownerKey);
  await db
    .insert(cartItems)
    .values({ cartId: cart.id, variantId, quantity: 1 })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.variantId],
      set: { quantity: sql`least(${cartItems.quantity} + 1, ${Math.min(MAX_QUANTITY, variant.stock)})` },
    });
  return { ok: true };
}

export async function addDesign(ownerKey: string, designId: string) {
  const [design] = await db
    .select()
    .from(designs)
    .where(and(eq(designs.id, designId), eq(designs.ownerKey, ownerKey)));
  if (!design) return { error: "We could not find that design." };
  const cart = await openCart(ownerKey);
  await db
    .insert(cartItems)
    .values({ cartId: cart.id, designId, quantity: 1 })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.designId], set: { quantity: cartItems.quantity } });
  return { ok: true };
}

export async function setQuantity(ownerKey: string, itemId: string, quantity: number) {
  const [cart] = await db.select().from(carts).where(eq(carts.ownerKey, ownerKey));
  if (!cart) return;
  const scope = and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id));
  if (quantity < 1) {
    await db.delete(cartItems).where(scope);
    return;
  }
  await db.update(cartItems).set({ quantity: Math.min(quantity, MAX_QUANTITY) }).where(scope);
}

export async function setPromo(ownerKey: string, code: string | null) {
  const cart = await openCart(ownerKey);
  if (code === null) {
    await db.update(carts).set({ promoCode: null }).where(eq(carts.id, cart.id));
    return { ok: true };
  }
  const view = await getCart(ownerKey);
  const found = await findPromo(code, view.subtotalCents);
  if ("error" in found) return { error: found.error };
  await db.update(carts).set({ promoCode: found.promo!.code }).where(eq(carts.id, cart.id));
  return { ok: true };
}
