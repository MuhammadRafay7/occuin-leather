"use server";

import { and, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { bumpRedirectEpoch } from "@/lib/redirects";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { CONTENT, clearContent, getContent, isContentKey, writeContent, type ContentKey } from "@/lib/server/content";
import { db, schema } from "@/lib/server/db";
import type { ActionResult } from "./admin";

const fail = (message: string, fieldErrors?: Record<string, string>): ActionResult => ({ ok: false, message, fieldErrors });

function fieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
  return fields;
}

async function homeProblems(value: unknown) {
  const { hero } = value as { hero: { forms: { slug: string }[] } };
  const slugs = hero.forms.map((form) => form.slug);
  const rows = await db
    .select({ slug: schema.products.slug })
    .from(schema.products)
    .where(and(inArray(schema.products.slug, slugs), isNotNull(schema.products.studioPreset)));
  const known = new Set(rows.map((row) => row.slug));
  const fields: Record<string, string> = {};
  slugs.forEach((slug, index) => {
    if (!known.has(slug)) fields[`hero.forms.${index}.slug`] = "Please pick a product that opens in the studio.";
  });
  return fields;
}

function refreshStore(key: ContentKey) {
  if (key === "redirects") bumpRedirectEpoch();
  revalidatePath("/", "layout");
}

export async function saveContent(key: string, value: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isContentKey(key)) return fail("We could not find that section.");
  const parsed = CONTENT[key].schema.safeParse(value);
  if (!parsed.success) return fail("Please fix the parts marked in red.", fieldErrors(parsed.error));
  try {
    if (key === "home") {
      const fields = await homeProblems(parsed.data);
      if (Object.keys(fields).length) return fail("Please fix the parts marked in red.", fields);
    }
    if (JSON.stringify(await getContent(key)) === JSON.stringify(parsed.data)) return { ok: true, message: "Nothing changed." };
    await writeContent(key, parsed.data, admin.id);
    await recordAudit(admin, { action: "content.save", targetType: "content", targetId: key, detail: CONTENT[key].label });
    refreshStore(key);
    return { ok: true, message: "Saved. It is live on your site now." };
  } catch (error) {
    console.error("[content]", error);
    return fail("That did not save. Please try again.");
  }
}

export async function resetContent(key: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isContentKey(key)) return fail("We could not find that section.");
  try {
    await clearContent(key);
    await recordAudit(admin, { action: "content.reset", targetType: "content", targetId: key, detail: CONTENT[key].label });
    refreshStore(key);
    return { ok: true, message: "Back to the original." };
  } catch (error) {
    console.error("[content]", error);
    return fail("That did not go through. Please try again.");
  }
}
