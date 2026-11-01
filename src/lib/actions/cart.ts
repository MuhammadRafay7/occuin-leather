"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureOwnerKey, getOwnerKey } from "@/lib/server/auth";
import { addDesign, addVariant, setPromo, setQuantity } from "@/lib/server/cart";

const id = z.uuid();
const refresh = () => revalidatePath("/", "layout");

export async function addToBag(variantId: string) {
  const parsed = id.safeParse(variantId);
  if (!parsed.success) return { error: "Choose a size first." };
  const result = await addVariant(await ensureOwnerKey(), parsed.data);
  refresh();
  return result;
}

export async function addDesignToBag(designId: string) {
  const parsed = id.safeParse(designId);
  if (!parsed.success) return { error: "We could not find that design." };
  const result = await addDesign(await ensureOwnerKey(), parsed.data);
  refresh();
  return result;
}

export async function changeQuantity(itemId: string, quantity: number) {
  const owner = await getOwnerKey();
  const parsed = z.object({ itemId: id, quantity: z.number().int().min(0).max(10) }).safeParse({ itemId, quantity });
  if (!owner || !parsed.success) return;
  await setQuantity(owner, parsed.data.itemId, parsed.data.quantity);
  refresh();
}

export async function applyPromo(code: string | null) {
  const parsed = z.string().trim().min(1).max(32).nullable().safeParse(code);
  if (!parsed.success) return { error: "That code is not valid." };
  const owner = await ensureOwnerKey();
  const result = await setPromo(owner, parsed.data);
  refresh();
  return result;
}
