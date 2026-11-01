import type { BespokeDesign } from "../design";
import { buildPattern } from "./pattern";
import { patternSheets, sheetsToPdf, sheetsToSvg } from "./sheets";

type Options = { reference: string; seamAllowanceMm?: number };

export function patternPdf(design: BespokeDesign, options: Options) {
  return sheetsToPdf(patternSheets(buildPattern(design, options)));
}

export function patternSvg(design: BespokeDesign, options: Options) {
  return sheetsToSvg(patternSheets(buildPattern(design, options)), `Draft pattern ${options.reference}, for the workshop to confirm`);
}
