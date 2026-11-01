import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { designSchema } from "@/lib/bespoke/design";
import { designSvg } from "@/lib/bespoke/export";
import { db, schema } from "@/lib/server/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const [row] = await db.select({ design: schema.bespokeRequests.design }).from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, parsed.data));
  const design = designSchema.safeParse(row?.design);
  const svg = design.success ? designSvg(design.data, "#efeee9") : null;
  if (!svg) return new Response(null, { status: 404 });
  const webp = await sharp(Buffer.from(svg), { density: 96 }).timeout({ seconds: 8 }).resize(480, 640, { fit: "contain", background: "#efeee9" }).webp({ quality: 80 }).toBuffer();
  return new Response(new Uint8Array(webp), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=60", "X-Content-Type-Options": "nosniff" } });
}
