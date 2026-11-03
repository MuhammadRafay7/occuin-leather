"use server";

import { z } from "zod";
import { readBag, type BagView } from "@/components/product/bag-actions";
import { addDesignToBag, addToBag } from "@/lib/actions/cart";
import { saveDesign } from "@/lib/actions/designs";
import { fulfilmentOf } from "@/lib/find-your-bag/match";
import { colorSchema, initialsSchema } from "@/lib/find-your-bag/dress";
import { loadCandidates } from "./candidates";

const inputSchema = z.object({
  candidateId: z.string().max(80),
  color: colorSchema,
  initials: initialsSchema.nullable(),
  preview: z.string().nullable(),
});

export type MatchBagResult = { ok: true; bag: BagView; addedId: string | null } | { ok: false; error: string };

export async function addMatchToBag(input: { candidateId: string; color: string; initials: string | null; preview: string | null }): Promise<MatchBagResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "We could not read that choice. Please try again." };
  const { candidateId, color, initials, preview } = parsed.data;
  const candidate = (await loadCandidates()).find((item) => item.id === candidateId);
  if (!candidate) return { ok: false, error: "That piece is no longer available." };

  const plan = fulfilmentOf(candidate, color, initials);
  if (plan.kind === "ready") {
    const result = await addToBag(plan.variantId);
    if ("error" in result && result.error) return { ok: false, error: result.error };
    const bag = await readBag();
    const line = bag.lines.find((item) => item.href === `/product/${candidate.slug}`);
    return { ok: true, bag, addedId: line?.id ?? null };
  }

  const saved = await saveDesign({ spec: plan.spec, preview });
  if (!saved.ok) return { ok: false, error: saved.error };
  const result = await addDesignToBag(saved.id);
  if ("error" in result && result.error) return { ok: false, error: result.error };
  const bag = await readBag();
  const line = bag.lines.find((item) => item.href.includes(saved.id));
  return { ok: true, bag, addedId: line?.id ?? null };
}
