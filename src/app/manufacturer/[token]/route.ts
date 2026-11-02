import { sheetPage } from "@/lib/server/manufacturer-response";
import { linkAccess, linkRefused } from "./access";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const access = await linkAccess((await params).token, true);
  return typeof access === "number" ? linkRefused(access) : sheetPage(request, access);
}
