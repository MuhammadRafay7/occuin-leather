"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import {
  adoptGuestData,
  checkPassword,
  endSession,
  hashPassword,
  hitRateLimit,
  newToken,
  startSession,
  tokenHash,
} from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";
import { sendMail } from "@/lib/server/mail";
import { issueReset } from "@/lib/server/password-reset";
import { fieldErrors, formText as text, type FormState } from "@/lib/form-state";
import { ADMIN_LOGIN, safeAdminNext, safeNext } from "@/lib/safe-next";
import { emailField, newPasswordField } from "@/lib/validation";

const { passwordResets, sessions, users } = schema;
const TOO_MANY = "Too many attempts. Try again in a few minutes.";
const BAD_LOGIN = "That email and password do not match.";
const BLOCKED_LOGIN = "This account cannot sign in. Contact us if you think this is a mistake.";
const RESET_SENT = "If that email has an account, a reset link is on its way. It works for one hour.";

const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(128) });
const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120, "Your name is too long."),
  email: emailField,
  password: newPasswordField,
});
const resetSchema = z
  .object({ token: z.string().min(20).max(200), password: newPasswordField, confirm: z.string() })
  .refine((input) => input.password === input.confirm, { path: ["confirm"], message: "The passwords do not match." });

let decoyHash: Promise<string> | undefined;
const decoy = () => (decoyHash ??= hashPassword(newToken()));

const findUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  return user;
};

async function enterSession(userId: string, destination: string): Promise<never> {
  await startSession(userId);
  await adoptGuestData(userId);
  refresh();
  redirect(destination);
}

async function checkLogin(data: FormData) {
  const values = { email: text(data, "email") };
  const parsed = loginSchema.safeParse({ email: values.email, password: text(data, "password") });
  if (!parsed.success) return { error: BAD_LOGIN, values };

  const { email, password } = parsed.data;
  const [ipLimited, emailLimited] = await Promise.all([
    hitRateLimit(`login:ip:${await clientIp()}`, 30, 900),
    hitRateLimit(`login:email:${tokenHash(email)}`, 8, 900),
  ]);
  if (ipLimited || emailLimited) return { error: TOO_MANY, values };

  const user = await findUserByEmail(email);
  const matches = await checkPassword(user?.passwordHash ?? (await decoy()), password);
  if (!user || !matches) return { error: BAD_LOGIN, values };
  return { user, values };
}

export async function signIn(_: FormState, data: FormData): Promise<FormState> {
  const { user, error, values } = await checkLogin(data);
  if (!user) return { error, values };
  if (user.blockedAt) return { error: BLOCKED_LOGIN, values };
  return enterSession(user.id, safeNext(data.get("next")));
}

export async function signInAdmin(_: FormState, data: FormData): Promise<FormState> {
  const { user, error, values } = await checkLogin(data);
  if (!user) return { error, values };
  if (user.blockedAt || user.role !== "admin") return { error: BAD_LOGIN, values };
  return enterSession(user.id, safeAdminNext(data.get("next")));
}

export async function register(_: FormState, data: FormData): Promise<FormState> {
  const values = { name: text(data, "name"), email: text(data, "email") };
  const parsed = registerSchema.safeParse({ ...values, password: text(data, "password") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  if (await hitRateLimit(`register:ip:${await clientIp()}`, 5, 3600)) return { error: TOO_MANY, values };

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  const taken = await findUserByEmail(email);
  const [user] = taken
    ? []
    : await db.insert(users).values({ name, email, passwordHash }).onConflictDoNothing().returning({ id: users.id });
  if (!user) {
    if (taken && !(await hitRateLimit(`register:notice:${tokenHash(email)}`, 1, 86_400))) {
      after(() =>
        sendMail({
          to: taken.email,
          subject: "Someone tried to register with your email",
          text: "Someone tried to create an OCCUIN account with this email, but you already have one. If this was you, sign in or reset your password. If not, you can ignore this email.",
        }).catch(() => false),
      );
    }
    return { error: "We could not create that account. If you already have one, sign in or reset your password.", values };
  }

  return enterSession(user.id, safeNext(data.get("next")));
}

export async function requestReset(_: FormState, data: FormData): Promise<FormState> {
  const values = { email: text(data, "email") };
  const parsed = emailField.safeParse(values.email);
  if (!parsed.success) return { fields: { email: "Enter a valid email." }, values };

  const [ipLimited, emailLimited] = await Promise.all([
    hitRateLimit(`forgot:ip:${await clientIp()}`, 10, 3600),
    hitRateLimit(`forgot:email:${tokenHash(parsed.data)}`, 3, 3600),
  ]);
  if (ipLimited) return { error: TOO_MANY, values };
  if (!emailLimited) after(() => issueReset(parsed.data));
  return { notice: RESET_SENT };
}

export async function resetPassword(_: FormState, data: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: text(data, "token"),
    password: text(data, "password"),
    confirm: text(data, "confirm"),
  });
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return fields.token ? { error: "This link is not valid or has expired." } : { fields };
  }
  if (await hitRateLimit(`reset:ip:${await clientIp()}`, 10, 900)) return { error: TOO_MANY };

  const passwordHash = await hashPassword(parsed.data.password);
  const done = await db.transaction(async (tx) => {
    const [reset] = await tx
      .delete(passwordResets)
      .where(and(eq(passwordResets.tokenHash, tokenHash(parsed.data.token)), gt(passwordResets.expiresAt, new Date())))
      .returning({ userId: passwordResets.userId });
    if (!reset) return false;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId));
    await tx.delete(passwordResets).where(eq(passwordResets.userId, reset.userId));
    return true;
  });
  if (!done) return { error: "This link is not valid or has expired." };
  redirect("/login?reset=1");
}

export async function signOut() {
  await endSession();
  refresh();
  redirect("/");
}

export async function signOutAdmin() {
  await endSession();
  refresh();
  redirect(ADMIN_LOGIN);
}
