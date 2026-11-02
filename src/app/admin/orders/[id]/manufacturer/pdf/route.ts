import { sheetDownload } from "@/lib/server/manufacturer-response";
import { adminAccess } from "../access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await adminAccess(request, params, "manufacturer_sheet.pdf");
  return access ? sheetDownload(access) : new Response("Not found", { status: 404 });
}
