"use server";

import { z } from "zod";
import { hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";
import { CONTACT_TOPICS } from "@/lib/policy";

const messageSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "That name is too long."),
  email: z.email("Enter a valid email address.").max(254),
  topic: z.enum(CONTACT_TOPICS, "Choose a topic."),
  message: z.string().trim().min(10, "Tell us a little more.").max(4000, "Keep it under 4,000 characters."),
});

export type ContactState = { ok?: boolean; error?: string; fields?: Partial<Record<keyof z.infer<typeof messageSchema>, string>> };

export async function sendMessage(_: ContactState, form: FormData): Promise<ContactState> {
  const parsed = messageSchema.safeParse({
    name: form.get("name"),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    topic: form.get("topic"),
    message: form.get("message"),
  });
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      fields: {
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        topic: fieldErrors.topic?.[0],
        message: fieldErrors.message?.[0],
      },
    };
  }
  if (await hitRateLimit(`contact:${await clientIp()}`, 5, 3600)) {
    return { error: "Too many messages. Try again in an hour." };
  }
  await db.insert(schema.contactMessages).values(parsed.data);
  return { ok: true };
}
