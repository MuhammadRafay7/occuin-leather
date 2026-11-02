import { eq, lt, sql } from "drizzle-orm";
import { newToken, tokenHash } from "./auth";
import { db, schema } from "./db";
import { sendMail } from "./mail";

const { passwordResets, users } = schema;
const RESET_MS = 3_600_000;

export async function issueReset(email: string) {
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()));
  if (!user || user.blockedAt) return false;
  const token = newToken();
  await db.transaction(async (tx) => {
    await tx.delete(passwordResets).where(eq(passwordResets.userId, user.id));
    await tx.insert(passwordResets).values({
      tokenHash: tokenHash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_MS),
    });
  });
  return sendMail({
    to: user.email,
    subject: "Reset your OCCUIN password",
    text: `Use this link to choose a new password. It works for one hour.\n${process.env.APP_URL ?? ""}/reset?token=${token}\nIf you did not ask for this, ignore this email.`,
  });
}
