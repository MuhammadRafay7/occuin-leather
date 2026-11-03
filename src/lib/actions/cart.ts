"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOwnerKey, getOwnerKey, hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { addDesign, addVariant, setPromo, setQuantity } from "@/lib/server/cart";
import { cartTooFast as tooFast } from "@/lib/server/cart-rate";

const id = z.uuid();
const refresh = () => revalidatePath("/", "layout");
const TOO_FAST = "Too many changes. Try again in a minute.";
const TOO_MANY_CODES = "Too many attempts. Try again in a few minutes.";

export async function addToBag(variantId: string) {
  const parsed = id.safeParse(variantId);
  if (!parsed.success) return { error: "Choose a size first." };
  const owner = await ensureOwnerKey();
  if (await tooFast(owner)) return { error: TOO_FAST };
  return addVariant(owner, parsed.data);
}

export async function addDesignToBag(designId: string) {
  const parsed = id.safeParse(designId);
  if (!parsed.success) return { error: "We could not find that design." };
  const owner = await ensureOwnerKey();
  if (await tooFast(owner)) return { error: TOO_FAST };
  const result = await addDesign(owner, parsed.data);
  refresh();
  return result;
}

export async function changeQuantity(itemId: string, quantity: number) {
  const owner = await getOwnerKey();
  const parsed = z.object({ itemId: id, quantity: z.number().int().min(0).max(10) }).safeParse({ itemId, quantity });
  if (!owner || !parsed.success || (await tooFast(owner))) return;
  await setQuantity(owner, parsed.data.itemId, parsed.data.quantity);
  refresh();
}

export async function applyPromo(code: string | null) {
  const parsed = z.string().trim().min(1).max(32).nullable().safeParse(code);
  if (!parsed.success) return { error: "That code is not valid." };
  const owner = await ensureOwnerKey();
  if (parsed.data !== null) {
    const [byOwner, byAddress] = await Promise.all([hitRateLimit(`promo:owner:${owner}`, 10, 600), hitRateLimit(`promo:ip:${await clientIp()}`, 30, 600)]);
    if (byOwner || byAddress) return { error: TOO_MANY_CODES };
  }
  const result = await setPromo(owner, parsed.data);
  refresh();
  return result;
}
