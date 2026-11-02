import type { BespokeDesign } from "../design";
import type { PdfDocument } from "../pdf";
import { buildPattern } from "./pattern";
import { drawSheets, patternSheets, sheetsToPdf, sheetsToSvg } from "./sheets";

type Options = { reference: string; seamAllowanceMm?: number };

export function patternPdf(design: BespokeDesign, options: Options) {
  return sheetsToPdf(patternSheets(buildPattern(design, options)));
}

export function appendPattern(pdf: PdfDocument, design: BespokeDesign, options: Options) {
  drawSheets(pdf, patternSheets(buildPattern(design, options)));
}

export function patternSvg(design: BespokeDesign, options: Options) {
  return sheetsToSvg(patternSheets(buildPattern(design, options)), `Draft pattern ${options.reference}, for the workshop to confirm`);
}
