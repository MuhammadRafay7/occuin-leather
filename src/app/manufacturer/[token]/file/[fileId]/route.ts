import { sheetFileResponse } from "@/lib/server/manufacturer-response";
import { linkAccess, linkRefused } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const access = await linkAccess(token);
  return typeof access === "number" ? linkRefused(access) : sheetFileResponse(request, access, fileId);
}
