import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { PRODUCT_TYPES, type ProductType } from "../bespoke/design";
import { balanceBuyable, balanceCents, bespokeBuyable, bespokeRef, depositCents } from "../bespoke/status";
import { cartTotals, discountableCents, type PricedLine } from "../cart-totals";
import { money } from "../format";
import { designSpecSchema } from "../studio/spec";
import { quoteDesign } from "../studio/pricing";
import { getPricing } from "./content";
import { db, schema } from "./db";

const { bespokeRequests, cartItems, carts, designs, products, promoCodes, variants } = schema;
const MAX_QUANTITY = 10;

export type CartLine = {
  id: string;
  kind: "product" | "design" | "bespoke";
  name: string;
  detail: string;
  image: string | null;
  href: string;
  unitCents: number;
  quantity: number;
  available: number;
};

export type CartView = {
  shippingWaived: boolean;
  shippingBasisCents: number;
  promoBaseCents: number;
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  promoError: string | null;
};

const EMPTY: CartView = { shippingWaived: false, shippingBasisCents: 0, promoBaseCents: 0, lines: [], count: 0, subtotalCents: 0, discountCents: 0, promoCode: null, promoError: null };

export function bespokeLineName(request: { design: { name: string }; productType: string }) {
  return request.design.name || `Bespoke ${(PRODUCT_TYPES[request.productType as ProductType] ?? "piece").toLowerCase()}`;
}

export async function findPromo(code: string, baseCents: number, source: Pick<typeof db, "select"> = db) {
  const [promo] = await source
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
  if (promo.maxUses !== null && promo.timesUsed >= promo.maxUses) return { error: "That code is not valid." } as const;
  if (baseCents < promo.minSubtotalCents) return { error: "Your bag does not reach the minimum for that code." } as const;
  return { promo } as const;
}

export async function getCart(ownerKey: string | null): Promise<CartView> {
  if (!ownerKey) return EMPTY;
  const [cart] = await db.select().from(carts).where(eq(carts.ownerKey, ownerKey));
  if (!cart) return EMPTY;
  const rows = await db
    .select({ item: cartItems, variant: variants, product: products, design: designs, bespoke: bespokeRequests })
    .from(cartItems)
    .leftJoin(variants, eq(variants.id, cartItems.variantId))
    .leftJoin(products, eq(products.id, variants.productId))
    .leftJoin(designs, eq(designs.id, cartItems.designId))
    .leftJoin(bespokeRequests, eq(bespokeRequests.id, cartItems.bespokeRequestId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(cartItems.id);

  const pricing = rows.some((row) => row.design) ? await getPricing() : undefined;
  const lines = rows.flatMap(({ item, variant, product, design, bespoke }): CartLine[] => {
    if (bespoke) {
      const quoted = bespoke.quotedPriceCents ?? 0;
      const deposit = depositCents(quoted, bespoke.depositPercent);
      const balance = item.bespokePart === "balance";
      const reference = bespokeRef(bespoke.number);
      const depositDetail = deposit < quoted ? `${bespoke.depositPercent}% deposit for bespoke design ${reference}. Balance ${money(quoted - deposit)} before shipping.` : `Full payment for bespoke design ${reference}`;
      return [{
        id: item.id,
        kind: "bespoke",
        name: bespokeLineName(bespoke),
        detail: balance ? `Balance for bespoke design ${reference}` : depositDetail,
        image: `/api/bespoke/preview/${bespoke.id}`,
        href: `/bespoke/mine/${bespoke.id}`,
        unitCents: balance ? quoted - deposit : deposit,
        quantity: 1,
        available: (balance ? balanceBuyable(bespoke) : bespokeBuyable(bespoke)) ? 1 : 0,
      }];
    }
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
    const { totalCents } = quoteDesign(spec.data, pricing);
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

  const priced = rows.flatMap(({ item, bespoke }): PricedLine[] => {
    const line = lines.find((entry) => entry.id === item.id);
    if (!line) return [];
    if (!bespoke) return [{ amountCents: line.unitCents * line.quantity, bespoke: null }];
    const quoted = bespoke.quotedPriceCents ?? 0;
    return [{ amountCents: line.unitCents, bespoke: { part: item.bespokePart === "balance" ? "balance" : "deposit", depositCents: depositCents(quoted, bespoke.depositPercent), balanceCents: balanceCents(quoted, bespoke.depositPercent) } }];
  });
  const promoBaseCents = discountableCents(priced);
  const found = cart.promoCode && promoBaseCents > 0 ? await findPromo(cart.promoCode, promoBaseCents) : null;
  const { subtotalCents, discountCents, shippingBasisCents, shippingWaived } = cartTotals(priced, found && "promo" in found ? found.promo!.percentOff : 0);
  return {
    shippingWaived,
    shippingBasisCents,
    promoBaseCents,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents,
    discountCents,
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

export async function addBespoke(ownerKey: string, requestId: string, part: "deposit" | "balance" = "deposit") {
  const cart = await openCart(ownerKey);
  await db.insert(cartItems).values({ cartId: cart.id, bespokeRequestId: requestId, bespokePart: part, quantity: 1 }).onConflictDoNothing();
}

export async function setQuantity(ownerKey: string, itemId: string, quantity: number) {
  const [cart] = await db.select().from(carts).where(eq(carts.ownerKey, ownerKey));
  if (!cart) return;
  await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));
  const scope = and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id));
  if (quantity < 1) {
    await db.delete(cartItems).where(scope);
    return;
  }
  await db
    .update(cartItems)
    .set({ quantity: sql`case when ${cartItems.bespokeRequestId} is null then ${Math.min(quantity, MAX_QUANTITY)}::int else 1 end` })
    .where(scope);
}

export async function setPromo(ownerKey: string, code: string | null) {
  const cart = await openCart(ownerKey);
  if (code === null) {
    await db.update(carts).set({ promoCode: null }).where(eq(carts.id, cart.id));
    return { ok: true };
  }
  const view = await getCart(ownerKey);
  if (view.lines.length && !view.promoBaseCents) return { error: "Promo codes do not apply to bespoke deposits or balances." };
  const found = await findPromo(code, view.promoBaseCents);
  if ("error" in found) return { error: found.error };
  await db.update(carts).set({ promoCode: found.promo!.code }).where(eq(carts.id, cart.id));
  return { ok: true };
}
