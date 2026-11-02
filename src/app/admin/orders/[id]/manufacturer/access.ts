import { orderRef } from "@/lib/format";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { eq } from "drizzle-orm";
import { parseUuid } from "@/lib/server/manufacturer";
import type { SheetAccess } from "@/lib/server/manufacturer-response";

export async function adminAccess(request: Request, params: Promise<{ id: string }>, audit?: string) {
  const admin = await requireAdmin();
  const orderId = parseUuid((await params).id);
  if (!orderId) return null;
  const [order] = await db.select({ number: schema.orders.number }).from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!order) return null;
  const includeAddress = new URL(request.url).searchParams.get("address") === "1";
  if (audit) await recordAudit(admin, { action: audit, targetType: "order", targetId: orderId, detail: `${orderRef(order.number)}${includeAddress ? ", with delivery address" : ""}` });
  const base = `/admin/orders/${orderId}/manufacturer`;
  return { orderId, includeAddress, base, back: base } satisfies SheetAccess;
}
