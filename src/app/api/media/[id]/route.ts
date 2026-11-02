import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/server/db";

const { mediaImages } = schema;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const [row] = await db
    .select({ bytes: mediaImages.bytes, contentType: mediaImages.contentType, filename: mediaImages.filename })
    .from(mediaImages)
    .where(eq(mediaImages.id, parsed.data));
  if (!row) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(row.bytes.length),
      "Content-Disposition": `inline; filename="${row.filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
