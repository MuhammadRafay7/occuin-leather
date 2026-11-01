import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

const { bespokeRequestImages } = schema;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const [row] = await db
    .select({ bytes: bespokeRequestImages.bytes, contentType: bespokeRequestImages.contentType })
    .from(bespokeRequestImages)
    .where(eq(bespokeRequestImages.id, parsed.data));
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.bytes.length),
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
