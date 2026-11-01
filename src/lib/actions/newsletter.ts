"use server";

import { z } from "zod";
import { hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";

export type NewsletterState = { ok?: boolean; error?: string };

const email = z.email().max(254);

export async function subscribe(_: NewsletterState, form: FormData): Promise<NewsletterState> {
  const parsed = email.safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (await hitRateLimit(`newsletter:${await clientIp()}`, 5, 3600)) {
    return { error: "Too many attempts. Try again in an hour." };
  }
  await db.insert(schema.newsletterSubscribers).values({ email: parsed.data }).onConflictDoNothing();
  return { ok: true };
}
