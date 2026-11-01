import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/server/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const [row] = await db.select({ png: schema.bespokeLogos.png }).from(schema.bespokeLogos).where(eq(schema.bespokeLogos.id, parsed.data));
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
