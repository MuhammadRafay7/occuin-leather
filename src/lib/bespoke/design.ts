import { z } from "zod";
import { COLORS, FINISHES, METALS, THREADS, type ColorKey, type FinishKey } from "../studio/spec";

export const LIMITS = {
  pieces: 40,
  points: 300,
  halfWidthMm: 800,
  halfHeightMm: 600,
  depthMm: 300,
  stack: 6,
  pieceName: 40,
  pieceText: 24,
  closure: 200,
  notes: 2000,
  images: 4,
  imageBytes: 3_500_000,
  imagesTotalBytes: 3_500_000,
  requestBytes: 4_400_000,
  designChars: 1_500_000,
  hardwarePerPiece: 30,
  puffMm: 40,
  foldDegrees: 170,
  tubeWidthMm: { min: 6, max: 60 },
  totalPoints: 1500,
  totalOutlineSamples: 5000,
  totalPerimeterMm: 40_000,
} as const;

export const PRODUCT_TYPES = {
  bag: "Bag",
  laptop_bag: "Laptop bag",
  wallet: "Wallet",
  card_holder: "Card holder",
  belt: "Belt",
  other: "Other",
} as const;
export type ProductType = keyof typeof PRODUCT_TYPES;

export function uniqueName(pieces: Pick<BespokePiece, "name">[], preferred?: string) {
  const used = new Set(pieces.map((piece) => piece.name));
  if (preferred && !used.has(preferred)) return preferred;
  const free = preferred ? null : PIECE_NAMES.find((name) => !used.has(name));
  if (free) return free;
  const base = (preferred ?? "Panel").slice(0, LIMITS.pieceName - 3);
  let index = 2;
  while (used.has(`${base} ${index}`)) index++;
  return `${base} ${index}`;
}

export const PIECE_NAMES = ["Body", "Flap", "Pocket", "Handle", "Strap", "Back", "Panel"] as const;

export const TEXT_TECHNIQUES = { blind: "Blind press", gold: "Gold foil", palladium: "Palladium foil" } as const;
export const TEXT_FONTS = { didone: "Serif", grotesk: "Sans" } as const;

export const HARDWARE = {
  buckle: { name: "Buckle", cents: 900 },
  turnlock: { name: "Turnlock", cents: 900 },
  zip: { name: "Zip line", cents: 500 },
  rivet: { name: "Rivet", cents: 100 },
  dring: { name: "D-ring", cents: 300 },
  ring: { name: "Ring", cents: 300 },
  foot: { name: "Base foot", cents: 100 },
  snap: { name: "Magnetic snap", cents: 500 },
  stud: { name: "Push stud", cents: 200 },
  pull: { name: "Zip pull", cents: 200 },
  link: { name: "Chain link", cents: 40 },
} as const;
export type HardwareKind = keyof typeof HARDWARE;

const keys = <T extends Record<string, unknown>>(record: T) => z.enum(Object.keys(record) as [keyof T & string, ...(keyof T & string)[]]);
const NO_CONTROL = /^[^\p{Cc}]*$/u;
const NO_CONTROL_EXCEPT_LINES = /^(?:[^\p{Cc}]|[\n\r\t])*$/u;
const line = (max: number) => z.string().trim().max(max).regex(NO_CONTROL);

export const pointSchema = z.strictObject({
  x: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm),
  y: z.number().min(-LIMITS.halfHeightMm).max(LIMITS.halfHeightMm),
  smooth: z.boolean(),
});

const pieceTextSchema = z.strictObject({
  value: line(LIMITS.pieceText).min(1),
  technique: keys(TEXT_TECHNIQUES),
  font: keys(TEXT_FONTS),
});

const hardwareSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]{1,16}$/),
  kind: keys(HARDWARE),
  x: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm),
  y: z.number().min(-LIMITS.halfHeightMm).max(LIMITS.halfHeightMm),
  rotation: z.number().min(-180).max(180),
  length: z.number().min(20).max(600),
  shape: z.enum(["plain", "round", "square", "long"]).default("plain"),
  label: z.string().trim().max(LIMITS.pieceName).regex(NO_CONTROL).default(""),
});

const foldSchema = z.strictObject({
  ax: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm),
  ay: z.number().min(-LIMITS.halfHeightMm).max(LIMITS.halfHeightMm),
  bx: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm),
  by: z.number().min(-LIMITS.halfHeightMm).max(LIMITS.halfHeightMm),
  angle: z.number().min(-LIMITS.foldDegrees).max(LIMITS.foldDegrees),
});

export const VIEWS = { front: "Front", back: "Back", left: "Left side", right: "Right side", base: "Base", interior: "Interior" } as const;
export type DesignView = keyof typeof VIEWS;
export const LOGO_STYLES = { deboss: "Deboss", foil: "Foil", stitched: "Stitched" } as const;

const logoSchema = z.strictObject({
  id: z.uuid(),
  x: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm),
  y: z.number().min(-LIMITS.halfHeightMm).max(LIMITS.halfHeightMm),
  width: z.number().min(10).max(300),
  rotation: z.number().min(-180).max(180),
  style: keys(LOGO_STYLES),
  rightsConfirmed: z.boolean(),
});

export const pieceSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9]{1,16}$/),
    name: line(LIMITS.pieceName).min(1),
    kind: z.enum(["panel", "tube"]).default("panel"),
    view: keys(VIEWS).default("front"),
    logo: logoSchema.nullable().default(null),
    points: z.array(pointSchema).min(1).max(LIMITS.points),
    closed: z.boolean(),
    mirror: z.boolean(),
    axisX: z.number().min(-LIMITS.halfWidthMm).max(LIMITS.halfWidthMm).default(0),
    holeOf: z.string().regex(/^[a-z0-9]{1,16}$/).nullable().default(null),
    puff: z.number().min(0).max(LIMITS.puffMm).default(0),
    fold: foldSchema.nullable().default(null),
    tubeWidth: z.number().min(LIMITS.tubeWidthMm.min).max(LIMITS.tubeWidthMm.max).default(14),
    tubeStyle: z.enum(["rolled", "flat", "bar", "chain"]).default("rolled"),
    textPlace: z.enum(["center", "top", "bottom", "corner"]).default("center"),
    rings: z.boolean().default(true),
    hardware: z.array(hardwareSchema).max(LIMITS.hardwarePerPiece).default([]),
    visible: z.boolean(),
    finish: keys(FINISHES),
    color: keys(COLORS),
    thread: keys(THREADS),
    stitched: z.boolean(),
    stack: z.number().int().min(-LIMITS.stack).max(LIMITS.stack),
    text: pieceTextSchema.nullable(),
  })
  .superRefine((piece, context) => {
    if (piece.mirror && piece.points.some((point) => point.x < piece.axisX - AXIS_TOLERANCE_MM)) {
      context.addIssue({ code: "custom", path: ["points"], message: "A mirrored piece keeps its points on one side of the centre line." });
    }
    if (piece.kind === "panel" && piece.closed && fullPointCount(piece) < 3) {
      context.addIssue({ code: "custom", path: ["points"], message: "A closed piece needs at least three points." });
    }
    if (piece.kind === "tube" && (piece.closed || piece.mirror || piece.points.length < 2 || piece.holeOf)) {
      context.addIssue({ code: "custom", path: ["points"], message: "A handle is an open path of at least two points." });
    }
    if (piece.holeOf && (!piece.closed || piece.holeOf === piece.id)) {
      context.addIssue({ code: "custom", path: ["holeOf"], message: "A cut-out must be a closed shape inside another piece." });
    }
  });

export const designSchema = z
  .strictObject({
    version: z.literal(1),
    name: line(60),
    productType: keys(PRODUCT_TYPES),
    depth: z.number().int().min(0).max(LIMITS.depthMm),
    metal: keys(METALS),
    closure: line(LIMITS.closure),
    lining: keys(COLORS),
    notes: z.string().trim().max(LIMITS.notes).regex(NO_CONTROL_EXCEPT_LINES),
    bodyId: z.string().regex(/^[a-z0-9]{1,16}$/).nullable(),
    pieces: z.array(pieceSchema).max(LIMITS.pieces),
  })
  .superRefine((design, context) => {
    const ids = new Set(design.pieces.map((piece) => piece.id));
    if (ids.size !== design.pieces.length) context.addIssue({ code: "custom", path: ["pieces"], message: "Each piece needs its own id." });
    if (design.bodyId && !ids.has(design.bodyId)) context.addIssue({ code: "custom", path: ["bodyId"], message: "The body must be one of the pieces." });
    for (const piece of design.pieces) {
      if (piece.holeOf && !ids.has(piece.holeOf)) context.addIssue({ code: "custom", path: ["pieces"], message: `${piece.name} cuts a piece that is missing.` });
    }
  });

export type BespokeDesign = z.infer<typeof designSchema>;
export type BespokePiece = z.infer<typeof pieceSchema>;
export type BespokePoint = z.infer<typeof pointSchema>;
export type PieceText = NonNullable<BespokePiece["text"]>;

export function fullPointCount(piece: Pick<BespokePiece, "points" | "mirror" | "axisX">) {
  if (!piece.mirror) return piece.points.length;
  return piece.points.length + piece.points.filter((point) => point.x - piece.axisX > AXIS_TOLERANCE_MM).length;
}

export const AXIS_TOLERANCE_MM = 0.05;

export function blankDesign(): BespokeDesign {
  return {
    version: 1,
    name: "",
    productType: "bag",
    depth: 60,
    metal: "gold",
    closure: "",
    lining: "ivory",
    notes: "",
    bodyId: null,
    pieces: [],
  };
}

export const DEFAULT_LEATHER: { finish: FinishKey; color: ColorKey } = { finish: "box", color: "cognac" };
