import { sheetFileResponse } from "@/lib/server/manufacturer-response";
import { adminAccess } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const access = await adminAccess(request, params);
  return access ? sheetFileResponse(request, access, (await params).fileId) : new Response("Not found", { status: 404 });
}
