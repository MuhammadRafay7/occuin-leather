import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/server/db";

const { designPreviews } = schema;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const [row] = await db
    .select({ webp: designPreviews.webp })
    .from(designPreviews)
    .where(and(eq(designPreviews.designId, parsed.data), eq(designPreviews.view, "hero")));
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.webp), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(row.webp.length),
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
