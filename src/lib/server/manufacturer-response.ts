import { patternPdf } from "../bespoke/production";
import { cutSheetPdf } from "../bespoke/export";
import { sheetDocument, type SheetUrls } from "../manufacturer/html";
import { sheetPdf } from "../manufacturer/pdf";
import { bespokeLine, loadSheet, parseUuid, pdfPictures, sheetFile } from "./manufacturer";

export type SheetAccess = { orderId: string; includeAddress: boolean; base: string; back?: string };

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const notFound = () => new Response("Not found", { status: 404, headers: PRIVATE_HEADERS });
const requestNonce = (request: Request) => /'nonce-([^']+)'/.exec(request.headers.get("content-security-policy") ?? "")?.[1];
const pdfResponse = (bytes: Uint8Array, name: string) =>
  new Response(new Uint8Array(bytes), { headers: { ...PRIVATE_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"` } });

function urlsFor(access: SheetAccess): SheetUrls {
  const suffix = access.includeAddress && access.back ? "?address=1" : "";
  return {
    file: (fileId, download) => `${access.base}/file/${fileId}${download ? "?download=1" : ""}`,
    download: (path) => `${access.base}/${path}`,
    pdf: `${access.base}/pdf${suffix}`,
    ...(access.back ? { back: access.back } : {}),
  };
}

export async function sheetPage(request: Request, access: SheetAccess) {
  const sheet = await loadSheet(access.orderId, access.includeAddress);
  if (!sheet) return notFound();
  return new Response(sheetDocument(sheet, urlsFor(access), requestNonce(request)), { headers: { ...PRIVATE_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}

export async function sheetDownload(access: SheetAccess) {
  const sheet = await loadSheet(access.orderId, access.includeAddress);
  if (!sheet) return notFound();
  return pdfResponse(sheetPdf(sheet, await pdfPictures(sheet)), `OCCUIN-${sheet.reference}-manufacturer-sheet.pdf`);
}

export async function sheetFileResponse(request: Request, access: SheetAccess, fileId: string) {
  const id = parseUuid(fileId);
  const file = id ? await sheetFile(access.orderId, id) : null;
  if (!file || !SAFE_IMAGE_TYPES.has(file.contentType)) return notFound();
  const download = new URL(request.url).searchParams.has("download");
  const extension = file.contentType.split("/")[1];
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": file.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.kind}.${extension}"`,
    },
  });
}

export async function bespokeFileResponse(access: SheetAccess, itemId: string, kind: "cut-sheet" | "pattern") {
  const id = parseUuid(itemId);
  const snapshot = id ? await bespokeLine(access.orderId, id) : null;
  if (!snapshot) return notFound();
  const bytes = kind === "cut-sheet" ? cutSheetPdf(snapshot.design, snapshot.reference) : patternPdf(snapshot.design, { reference: snapshot.reference });
  return pdfResponse(bytes, `OCCUIN-${snapshot.reference}-${kind}.pdf`);
}
