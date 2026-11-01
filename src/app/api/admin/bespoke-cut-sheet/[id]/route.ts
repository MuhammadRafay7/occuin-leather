import { eq } from "drizzle-orm";
import { z } from "zod";
import { PATTERN, SEAM_ALLOWANCE_MM } from "@/lib/bespoke/config";
import { designSchema } from "@/lib/bespoke/design";
import { patternPdf, patternSvg } from "@/lib/bespoke/production";
import { bespokeRef } from "@/lib/bespoke/status";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";

const optionsSchema = z.object({
  format: z.enum(["pdf", "svg"]).default("pdf"),
  seam: z.coerce.number().min(0).max(PATTERN.maxSeamAllowanceMm).default(SEAM_ALLOWANCE_MM),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response(null, { status: 404 });
  const options = optionsSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!options.success) return new Response(null, { status: 400 });
  const [row] = await db.select({ number: schema.bespokeRequests.number, design: schema.bespokeRequests.design }).from(schema.bespokeRequests).where(eq(schema.bespokeRequests.id, parsed.data));
  const design = designSchema.safeParse(row?.design);
  if (!row || !design.success) return new Response(null, { status: 404 });
  const reference = bespokeRef(row.number);
  const { format, seam } = options.data;
  const settings = { reference, seamAllowanceMm: seam };
  const shared = { "Content-Disposition": `attachment; filename="${reference}-draft-pattern.${format}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (format === "svg") return new Response(patternSvg(design.data, settings), { headers: { ...shared, "Content-Type": "image/svg+xml" } });
  return new Response(new Uint8Array(patternPdf(design.data, settings)), { headers: { ...shared, "Content-Type": "application/pdf" } });
}
