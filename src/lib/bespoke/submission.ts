import { z } from "zod";
import { COUNTRIES, emailField } from "../validation";
import { designSchema, fullPointCount, LIMITS, type BespokeDesign } from "./design";
import { visibleDesign } from "./estimate";
import { isSolidPanel, outlineOf, pathLength, perimeter } from "./outline";
import { checkDesign } from "./rules";

const COUNTRY_CODES = COUNTRIES.map((country) => country.code) as [string, ...string[]];
const OPTIONAL_PHONE = /^$|^[+()\d][+()\d .-]{4,29}$/;

export const customerSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter your name.").max(120, "That name is too long.").regex(/^[^\p{Cc}]*$/u, "Enter your name."),
  email: emailField,
  country: z.enum(COUNTRY_CODES, "Choose a country."),
  phone: z.string().trim().regex(OPTIONAL_PHONE, "Enter a valid phone number, or leave it blank."),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type ImageType = "image/jpeg" | "image/png" | "image/webp";

export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function designProblem(design: BespokeDesign): string | null {
  const sent = visibleDesign(design);
  if (!sent.pieces.some((piece) => isSolidPanel(piece) || piece.kind === "tube")) return "Draw at least one piece.";
  let points = 0;
  let samples = 0;
  let edges = 0;
  for (const piece of sent.pieces) {
    const outline = outlineOf(piece);
    points += fullPointCount(piece);
    samples += outline.length;
    edges += piece.kind === "tube" ? pathLength(outline) : perimeter(outline);
    if (points > LIMITS.totalPoints || samples > LIMITS.totalOutlineSamples || edges > LIMITS.totalPerimeterMm) return "This design is too detailed to send. Simplify a piece or remove some points.";
  }
  const blocker = checkDesign(sent).find((finding) => finding.level === "blocker");
  return blocker ? `${blocker.title}. ${blocker.fix}` : null;
}

export function parseDesign(raw: unknown): { design: BespokeDesign } | { error: string } {
  if (typeof raw !== "string" || !raw || raw.length > LIMITS.designChars) return { error: "This design is too large to send." };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { error: "This design could not be read." };
  }
  const parsed = designSchema.safeParse(value);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "This design could not be read." };
  const problem = designProblem(parsed.data);
  if (problem) return { error: problem };
  return { design: visibleDesign(parsed.data) };
}

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const UNSAFE_SVG = /<\s*(script|foreignobject|iframe|embed|object|image|style|animate|set|use)\b|\son[a-z]+\s*=|javascript:|<!entity|<!doctype|(?:xlink:)?href\s*=|url\(\s*["']?\s*(?!#)/i;

export const svgIsUnsafe = (text: string) => UNSAFE_SVG.test(text);

export function logoKind(bytes: Uint8Array): "png" | "svg" | null {
  if (sniffImage(bytes) === "image/png") return "png";
  const start = new TextDecoder().decode(bytes.subarray(0, 1024)).trimStart().toLowerCase();
  return start.startsWith("<svg") || (start.startsWith("<?xml") && start.includes("<svg")) ? "svg" : null;
}

export const MAX_REQUEST_BYTES = LIMITS.requestBytes;
