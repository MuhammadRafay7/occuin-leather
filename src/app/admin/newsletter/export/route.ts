import { requireAdmin } from "@/lib/server/auth";
import { allSubscribers } from "../../_lib/queries";

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireAdmin();
  const subscribers = await allSubscribers();
  const rows = subscribers.map((subscriber) => [subscriber.email, subscriber.createdAt.toISOString()].map(csvCell).join(","));
  return new Response(["email,subscribed_at", ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orsel-newsletter.csv"',
      "Cache-Control": "no-store",
    },
  });
}
