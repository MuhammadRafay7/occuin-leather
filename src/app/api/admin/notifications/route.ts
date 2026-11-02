import { listNotifications } from "@/app/admin/_lib/notifications";
import { getUser } from "@/lib/server/auth";

export async function GET() {
  const user = await getUser();
  if (user?.role !== "admin") return Response.json({ error: "Not allowed." }, { status: 403 });
  return Response.json(await listNotifications(), { headers: { "Cache-Control": "no-store" } });
}
