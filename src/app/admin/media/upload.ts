import { MEDIA_MAX_BYTES } from "@/lib/media";

export type UploadOutcome = { ok: true; path: string; filename: string } | { ok: false; error: string };

export async function uploadImage(file: File): Promise<UploadOutcome> {
  if (file.size > MEDIA_MAX_BYTES) return { ok: false, error: `${file.name} is over 3.5 MB.` };
  const body = new FormData();
  body.set("file", file);
  try {
    const response = await fetch("/api/media", { method: "POST", body });
    if (response.redirected) return { ok: false, error: "Your session ended. Sign in again." };
    const reply = (await response.json()) as UploadOutcome;
    return reply.ok ? reply : { ok: false, error: `${file.name}: ${reply.error}` };
  } catch {
    return { ok: false, error: `${file.name} did not upload. Try again.` };
  }
}
