import { bespokeFileResponse } from "@/lib/server/manufacturer-response";
import { adminAccess } from "../../access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const access = await adminAccess(request, params);
  return access ? bespokeFileResponse(access, (await params).itemId, "pattern") : new Response("Not found", { status: 404 });
}
