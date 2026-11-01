"use server";

import { and, asc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { eraseAccount } from "@/lib/server/account-deletion";
import { checkPassword, endSession, hashPassword, hitRateLimit, requireUser, startSession } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { sendMail } from "@/lib/server/mail";
import { fieldErrors, formText as text, type FormState } from "@/lib/form-state";
import { addressInput, addressSchema, emailField, newPasswordField } from "@/lib/validation";

const { addresses, passwordResets, sessions, users } = schema;
const MAX_ADDRESSES = 20;
const UNIQUE_VIOLATION = "23505";
const TOO_MANY = "Too many attempts. Try again in a few minutes.";
const id = z.uuid();

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Your name is too long."),
  email: emailField,
});
const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password.").max(128), password: newPasswordField, confirm: z.string() })
  .refine((input) => input.password === input.confirm, { path: ["confirm"], message: "The passwords do not match." });

const passwordMatches = async (userId: string, password: string) => {
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  return Boolean(row) && password.length <= 128 && checkPassword(row!.hash, password);
};

export async function updateProfile(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("/account/profile");
  const parsed = profileSchema.safeParse({ name: text(data, "name"), email: text(data, "email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  if (await hitRateLimit(`profile:${user.id}`, 20, 900)) return { error: TOO_MANY };

  const { name, email } = parsed.data;
  const emailChanged = email !== user.email.toLowerCase();
  if (emailChanged) {
    const password = text(data, "password");
    if (!password) return { fields: { password: "Enter your password to change your email." } };
    if (!(await passwordMatches(user.id, password))) return { fields: { password: "That password is not correct." } };
    const [taken] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, user.id)));
    if (taken) return { fields: { email: "We could not use that email." } };
  }

  const updated = await db
    .transaction(async (tx) => {
      const rows = await tx
        .update(users)
        .set(emailChanged ? { name, email } : { name })
        .where(eq(users.id, user.id))
        .returning({ id: users.id });
      if (emailChanged) {
        await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
        await tx.delete(sessions).where(eq(sessions.userId, user.id));
      }
      return rows;
    })
    .catch((error) => {
      if (error?.cause?.code === UNIQUE_VIOLATION) return [];
      throw error;
    });
  if (!updated.length) return { fields: { email: "We could not use that email." } };

  if (emailChanged) {
    await startSession(user.id);
    after(() =>
      sendMail({
        to: user.email,
        subject: "Your OCCUIN email was changed",
        text: "The email on your OCCUIN account was just changed. If this was not you, contact us straight away.",
      }).catch(() => false),
    );
  }
  revalidatePath("/", "layout");
  return { notice: "Your details are saved." };
}

export async function changePassword(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("/account/profile");
  const parsed = passwordSchema.safeParse({
    current: text(data, "current"),
    password: text(data, "password"),
    confirm: text(data, "confirm"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  if (await hitRateLimit(`password:${user.id}`, 8, 900)) return { error: TOO_MANY };
  if (!(await passwordMatches(user.id, parsed.data.current))) return { fields: { current: "That password is not correct." } };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  await startSession(user.id);
  return { notice: "Your password is changed. Other devices are signed out." };
}

export async function deleteAccount(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("/account/profile");
  if (user.role === "admin") return { error: "Administrator accounts cannot be deleted here." };
  if (await hitRateLimit(`delete-account:${user.id}`, 5, 900)) return { error: TOO_MANY };
  if (!(await passwordMatches(user.id, text(data, "password")))) return { fields: { password: "That password is not correct." } };
  if (!(await eraseAccount(user))) return { error: "You have an order or bespoke piece in progress. We can delete your account once it is finished." };

  await endSession();
  after(() =>
    sendMail({ to: user.email, subject: "Your OCCUIN account was deleted", text: "Your OCCUIN account has been deleted. If this was not you, contact us straight away." }).catch(() => false),
  );
  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveAddress(_: FormState, data: FormData): Promise<FormState> {
  const user = await requireUser("/account/addresses");
  const parsed = addressSchema.safeParse(addressInput(data));
  if (!parsed.success) return { error: "Check the marked fields.", fields: fieldErrors(parsed.error) };
  const addressId = text(data, "id");
  if (addressId && !id.safeParse(addressId).success) return { error: "We could not find that address." };
  const makeDefault = data.get("isDefault") === "on";

  const failure = await db.transaction(async (tx) => {
    const rows = await tx.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, user.id));
    if (addressId && !rows.some((row) => row.id === addressId)) return "We could not find that address.";
    if (!addressId && rows.length >= MAX_ADDRESSES) return "You have reached the limit of saved addresses.";
    if (makeDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    if (addressId) {
      await tx
        .update(addresses)
        .set(makeDefault ? { address: parsed.data, isDefault: true } : { address: parsed.data })
        .where(eq(addresses.id, addressId));
    } else {
      await tx.insert(addresses).values({ userId: user.id, address: parsed.data, isDefault: makeDefault || rows.length === 0 });
    }
    return null;
  });
  if (failure) return { error: failure };

  revalidatePath("/account", "layout");
  redirect("/account/addresses");
}

export async function deleteAddress(data: FormData) {
  const user = await requireUser("/account/addresses");
  const parsed = id.safeParse(data.get("id"));
  if (!parsed.success) return;
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(addresses)
      .where(and(eq(addresses.id, parsed.data), eq(addresses.userId, user.id)))
      .returning({ isDefault: addresses.isDefault });
    if (!removed?.isDefault) return;
    const [next] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.userId, user.id))
      .orderBy(asc(addresses.createdAt))
      .limit(1);
    if (next) await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, next.id));
  });
  revalidatePath("/account", "layout");
}

export async function setDefaultAddress(data: FormData) {
  const user = await requireUser("/account/addresses");
  const parsed = id.safeParse(data.get("id"));
  if (!parsed.success) return;
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, parsed.data), eq(addresses.userId, user.id)));
    if (!owned) return;
    await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, user.id));
    await tx.update(addresses).set({ isDefault: true }).where(eq(addresses.id, owned.id));
  });
  revalidatePath("/account", "layout");
}
