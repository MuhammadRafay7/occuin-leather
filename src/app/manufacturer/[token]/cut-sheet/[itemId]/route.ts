import { bespokeFileResponse } from "@/lib/server/manufacturer-response";
import { linkAccess, linkRefused } from "../../access";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const access = await linkAccess(token);
  return typeof access === "number" ? linkRefused(access) : bespokeFileResponse(access, itemId, "cut-sheet");
}
