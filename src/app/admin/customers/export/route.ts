import type { NextRequest } from "next/server";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { csvResponse } from "../../_lib/csv";
import { exportCustomers } from "../../_lib/queries-people";

export async function GET(request: NextRequest) {
  const actor = await requireAdmin();
  const rows = await exportCustomers(Object.fromEntries(request.nextUrl.searchParams));
  await recordAudit(actor, { action: "customer.export", targetType: "customer", detail: `${rows.length} rows` });
  return csvResponse(
    "occuin-customers.csv",
    ["name", "email", "role", "state", "joined_at", "orders", "lifetime_value_usd"],
    rows.map((row) => [row.name, row.email, row.role, row.blockedAt ? "blocked" : "active", row.createdAt.toISOString(), row.orderCount, (row.spentCents / 100).toFixed(2)]),
  );
}
