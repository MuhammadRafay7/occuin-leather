import { headers } from "next/headers";
import { MEDIA_MAX_BYTES, mediaPath, safeFilename } from "@/lib/media";
import { recordAudit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { encodeMedia } from "@/lib/server/media";

const FORM_OVERHEAD_BYTES = 4096;
const TOO_LARGE = "Images must be under 3.5 MB.";

const refuse = (error: string, status = 422) => Response.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const origin = request.headers.get("origin");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!origin || !URL.canParse(origin) || new URL(origin).host !== host) return refuse("This request was not allowed.", 403);
  if (Number(request.headers.get("content-length")) > MEDIA_MAX_BYTES + FORM_OVERHEAD_BYTES) return refuse(TOO_LARGE, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse("We could not read that upload.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return refuse("Choose an image.");
  if (file.size > MEDIA_MAX_BYTES) return refuse(TOO_LARGE, 413);

  const encoded = await encodeMedia(Buffer.from(await file.arrayBuffer()));
  if ("error" in encoded) return refuse(encoded.error);

  const filename = safeFilename(file.name);
  const [row] = await db
    .insert(schema.mediaImages)
    .values({ filename, contentType: "image/webp", width: encoded.width, height: encoded.height, byteSize: encoded.bytes.length, bytes: encoded.bytes })
    .returning({ id: schema.mediaImages.id });
  await recordAudit(admin, { action: "media.upload", targetType: "media", targetId: row!.id, detail: filename });
  return Response.json(
    { ok: true, id: row!.id, path: mediaPath(row!.id), filename, width: encoded.width, height: encoded.height, byteSize: encoded.bytes.length },
    { status: 201 },
  );
}
