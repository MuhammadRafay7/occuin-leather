import { headers } from "next/headers";
import { MAX_REQUEST_BYTES } from "@/lib/bespoke/submission";
import { createBespokeRequest } from "@/lib/server/bespoke";

async function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  return URL.canParse(origin) && new URL(origin).host === host;
}

export async function POST(request: Request) {
  if (!(await sameOrigin(request))) return Response.json({ ok: false, error: "This request was not allowed." }, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (!length) return Response.json({ ok: false, error: "This request was not allowed." }, { status: 411 });
  if (length > MAX_REQUEST_BYTES) return Response.json({ ok: false, error: "This design and its images are too large to send." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "We could not read that request." }, { status: 400 });
  }
  try {
    const result = await createBespokeRequest(form);
    return Response.json(result, { status: result.ok ? 201 : 422 });
  } catch (error) {
    console.error("[bespoke]", error);
    return Response.json({ ok: false, error: "We could not send your design. Try again." }, { status: 500 });
  }
}
