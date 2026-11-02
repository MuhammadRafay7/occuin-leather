import { db, schema } from "./db";

type Actor = { id: string; email: string };
type AuditEntry = { action: string; targetType: string; targetId?: string; detail?: string };

export async function recordAudit(actor: Actor, entry: AuditEntry) {
  try {
    await db.insert(schema.adminAuditLog).values({
      actorId: actor.id,
      actorEmail: actor.email,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      detail: entry.detail ?? "",
    });
  } catch (error) {
    console.error("[audit] could not record", entry.action, error);
  }
}
