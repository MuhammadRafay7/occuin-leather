import { hitRateLimit } from "@/lib/server/auth";
import { clientIp } from "@/lib/server/client-ip";
import { linkPath, resolveLink, touchLink } from "@/lib/server/manufacturer";
import type { SheetAccess } from "@/lib/server/manufacturer-response";

const OPENS_PER_HOUR = 600;
const WINDOW_SECONDS = 3600;
const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };

export const linkRefused = (status = 404) => new Response(status === 429 ? "Please try again later." : "This link is not available. Ask OCCUIN for a new one.", { status, headers: HEADERS });

export async function linkAccess(token: string, opened = false): Promise<SheetAccess | number> {
  if (await hitRateLimit(`manufacturer-link:${await clientIp()}`, OPENS_PER_HOUR, WINDOW_SECONDS)) return 429;
  const link = await resolveLink(token);
  if (!link) return 404;
  if (opened) await touchLink(link.id);
  return { orderId: link.orderId, includeAddress: link.includeAddress, base: linkPath(link) };
}
