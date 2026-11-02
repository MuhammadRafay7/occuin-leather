import { printDocument } from "../print";

export const GET = (request: Request, { params }: { params: Promise<{ id: string }> }) => printDocument(request, params, "invoice");
