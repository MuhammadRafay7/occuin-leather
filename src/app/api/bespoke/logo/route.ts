import { headers } from "next/headers";
import sharp from "sharp";
import { LOGO_MAX_BYTES, logoKind, svgIsUnsafe } from "@/lib/bespoke/submission";
import { ensureOwnerKey, hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { db, schema } from "@/lib/server/db";

const MAX_INPUT_PIXELS = 40_000_000;
const OUTPUT_EDGE_PX = 1024;
const RENDER_TIMEOUT_SECONDS = 8;

const refuse = (error: string, status = 422) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return refuse("This request was not allowed.", 403);
  if (Number(request.headers.get("content-length")) > LOGO_MAX_BYTES + 4096) return refuse("A logo must be under 2 MB.", 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse("We could not read that file.", 400);
  }
  const file = form.get("logo");
  if (form.get("rights") !== "yes") return refuse("Please confirm you own this logo or may use it.");
  if (!(file instanceof File) || !file.size) return refuse("Choose a PNG or SVG file.");
  if (file.size > LOGO_MAX_BYTES) return refuse("A logo must be under 2 MB.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = logoKind(bytes);
  if (!kind) return refuse("A logo must be a PNG or SVG file.");
  if (kind === "svg" && svgIsUnsafe(bytes.toString("utf8"))) return refuse("This SVG has scripts or links, so we cannot accept it. Export a plain SVG or a PNG.");
  if (await hitRateLimit(`bespoke-logo:${await clientIp()}`, 20, 3600)) return refuse("Too many uploads. Try again in an hour.");
  let png: Buffer;
  try {
    png = await sharp(bytes, { density: 300, limitInputPixels: MAX_INPUT_PIXELS }).timeout({ seconds: RENDER_TIMEOUT_SECONDS }).resize(OUTPUT_EDGE_PX, OUTPUT_EDGE_PX, { fit: "inside", withoutEnlargement: kind === "png" }).png().toBuffer();
  } catch {
    return refuse("We could not read that file.");
  }
  const [row] = await db
    .insert(schema.bespokeLogos)
    .values({ ownerKey: await ensureOwnerKey(), filename: file.name.replace(/\p{Cc}/gu, "").slice(0, 120) || "logo", rightsConfirmedAt: new Date(), png })
    .returning({ id: schema.bespokeLogos.id });
  return Response.json({ ok: true, id: row!.id }, { status: 201 });
}
