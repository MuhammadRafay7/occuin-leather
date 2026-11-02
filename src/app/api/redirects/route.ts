import { connection } from "next/server";
import { getContent } from "@/lib/server/content";

export async function GET() {
  await connection();
  const { rules } = await getContent("redirects");
  return Response.json(rules.filter((rule) => rule.enabled), { headers: { "Cache-Control": "no-store" } });
}
