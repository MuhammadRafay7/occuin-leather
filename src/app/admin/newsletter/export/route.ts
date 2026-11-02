import type { NextRequest } from "next/server";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { csvResponse } from "../../_lib/csv";
import { exportSubscribers } from "../../_lib/queries-people";

export async function GET(request: NextRequest) {
  const actor = await requireAdmin();
  const subscribers = await exportSubscribers(request.nextUrl.searchParams.get("q")?.trim() ?? "");
  await recordAudit(actor, { action: "newsletter.export", targetType: "subscriber", detail: `${subscribers.length} rows` });
  return csvResponse("occuin-newsletter.csv", ["email", "subscribed_at"], subscribers.map((subscriber) => [subscriber.email, subscriber.createdAt.toISOString()]));
}
