import type { NextRequest } from "next/server";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { csvResponse } from "../../_lib/csv";
import { exportActivity } from "../../_lib/queries-people";

export async function GET(request: NextRequest) {
  const actor = await requireAdmin();
  const rows = await exportActivity(Object.fromEntries(request.nextUrl.searchParams));
  await recordAudit(actor, { action: "activity.export", targetType: "activity", detail: `${rows.length} rows` });
  return csvResponse(
    "occuin-activity.csv",
    ["created_at", "actor", "action", "target_type", "target_id", "detail"],
    rows.map((row) => [row.createdAt.toISOString(), row.actorEmail, row.action, row.targetType, row.targetId, row.detail]),
  );
}
