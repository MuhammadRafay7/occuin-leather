import { blankDesign, uniqueName, LIMITS, type BespokeDesign, type BespokePiece, type DesignView, type ProductType } from "./design";
import { bodyOf, boundsOf, contains, edgeAt, isSolidPanel, layerOrder, outlineOf, starterPoints, type StarterKind, type Vec } from "./outline";

type Points = BespokePiece["points"];
type Fit = Omit<BespokePiece["hardware"][number], "id" | "rotation" | "length" | "shape" | "label"> & Partial<Pick<BespokePiece["hardware"][number], "rotation" | "length" | "shape" | "label">>;
type Seed = Partial<BespokePiece> & Pick<BespokePiece, "name" | "points"> & { fittings?: Fit[] };
type Monogram = { value?: string; technique: NonNullable<BespokePiece["text"]>["technique"]; font: NonNullable<BespokePiece["text"]>["font"]; place: BespokePiece["textPlace"] };
type Built = { pieces?: Seed[]; fittings?: Fit[]; monogram?: Monogram };

export type Frame = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number; cx: number; cy: number; top: (x: number) => number; bottom: (x: number) => number };
export type Part = { key: string; name: string; hint: string; view?: DesignView; build: (frame: Frame) => Built };
export type PartCategory = { key: string; label: string; parts: Part[] };

const DEFAULT_BODY = { width: 280, height: 210 };
const LEATHER = { finish: "box", color: "espresso", thread: "honey" } as const;

const at = (x: number, y: number, smooth = false) => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, smooth });
const shape = (kind: StarterKind, cx: number, cy: number, width: number, height: number): Points => starterPoints(kind, width, height).map((point) => ({ ...point, x: point.x + cx, y: point.y + cy }));
const rect = (cx: number, cy: number, width: number, height: number) => shape("rectangle", cx, cy, width, height);
const soft = (cx: number, cy: number, width: number, height: number) => shape("rounded", cx, cy, width, height);

function arch(f: Frame, span: number, rise: number, overlap = 14): Points {
  const left = f.cx - span / 2;
  const right = f.cx + span / 2;
  const foot = Math.max(f.top(left), f.top(right)) + overlap;
  const crest = Math.min(f.top(left), f.top(right)) - rise;
  return [at(left, foot, true), at(left + span * 0.07, foot - (foot - crest) * 0.62, true), at(f.cx, crest, true), at(right - span * 0.07, foot - (foot - crest) * 0.62, true), at(right, foot, true)];
}

const tube = (name: string, points: Points, extra: Partial<BespokePiece> = {}): Seed => ({ ...LEATHER, name, kind: "tube", closed: false, stack: 2, points, ...extra });
const panel = (name: string, points: Points, extra: Partial<BespokePiece> & { fittings?: Fit[] } = {}): Seed => ({ ...LEATHER, name, closed: true, stack: 1, points, ...extra });
const body = (name: string, points: Points, extra: Partial<BespokePiece> = {}): Seed => ({ name, closed: true, finish: "pebble", color: "cognac", thread: "ivory", stack: 0, points, ...extra });

function mirrored(f: Frame, name: string, chain: [number, number, boolean?][], extra: Partial<BespokePiece> & { fittings?: Fit[] } = {}): Seed {
  return panel(name, chain.map(([x, y, smooth]) => at(f.cx + x, y, smooth)), { mirror: true, axisX: f.cx, stack: 2, ...extra });
}

const flapChain = (f: Frame, depth: number, tip: "straight" | "round" | "point" | "saddle") => {
  const half = f.width / 2 + 3;
  const top = f.minY - 2;
  const end = top + depth;
  if (tip === "straight") return [[0, top], [half, top], [half, end], [0, end]] as [number, number, boolean?][];
  if (tip === "point") return [[0, top], [half, top], [half, end - depth * 0.45], [0, end]] as [number, number, boolean?][];
  if (tip === "saddle") return [[0, top], [half, top], [half, end - depth * 0.42, true], [half * 0.7, end - depth * 0.08, true], [0, end, true]] as [number, number, boolean?][];
  return [[0, top], [half, top], [half, end - depth * 0.36, true], [half * 0.72, end - depth * 0.05, true], [0, end, true]] as [number, number, boolean?][];
};

const BODIES: Part[] = [
  { key: "body-rect", name: "Rectangle tote", hint: "An upright body with square corners", build: () => ({ pieces: [body("Rectangle tote body", rect(0, 0, 300, 300))] }) },
  { key: "body-trap", name: "Trapezoid tote", hint: "Wider at the base, slimmer at the top", build: () => ({ pieces: [body("Trapezoid tote body", shape("trapezoid", 0, 0, 340, 280))] }) },
  { key: "body-satchel", name: "Rounded satchel", hint: "A soft body with rounded corners", build: () => ({ pieces: [body("Rounded satchel body", soft(0, 0, 300, 220))] }) },
  { key: "body-moon", name: "Half-moon saddle", hint: "A curved base with a flat top", build: () => ({ pieces: [body("Half-moon saddle body", [at(-140, -90), at(140, -90), at(140, 10, true), at(100, 75, true), at(0, 105, true), at(-100, 75, true), at(-140, 10, true)])] }) },
  { key: "body-bucket", name: "Bucket", hint: "Tall with a gently rounded base", build: () => ({ pieces: [body("Bucket body", [at(-110, -140), at(110, -140), at(125, 90, true), at(80, 140, true), at(-80, 140, true), at(-125, 90, true)])] }) },
  { key: "body-sleeve", name: "Slim sleeve", hint: "A flat sleeve for a laptop or papers", build: () => ({ pieces: [body("Slim sleeve body", soft(0, 0, 360, 250))] }) },
];

const HANDLES: Part[] = [
  { key: "handle-rolled", name: "Rolled top handle", hint: "A round stitched handle over the top edge", build: (f) => ({ pieces: [tube("Rolled top handle", arch(f, f.width * 0.5, 100))] }) },
  { key: "handle-flat", name: "Flat strap handle", hint: "A flat stitched band with no roll", build: (f) => ({ pieces: [tube("Flat strap handle", arch(f, f.width * 0.55, 120), { tubeStyle: "flat", tubeWidth: 22, rings: false })] }) },
  { key: "handle-arch", name: "Arch handle", hint: "A tall arch for carrying on the shoulder", build: (f) => ({ pieces: [tube("Arch handle", arch(f, f.width * 0.62, 190), { tubeWidth: 16 })] }) },
  {
    key: "handle-ring",
    name: "Ring handle",
    hint: "A flat leather ring with a hole cut through it",
    build: (f) => {
      const y = f.top(f.cx) - 34;
      const ring = panel("Ring handle", soft(f.cx, y, 130, 96), { stack: 2 });
      return { pieces: [ring, { ...ring, name: "Ring handle opening", points: soft(f.cx, y, 86, 52), holeOf: "previous", stitched: false }] };
    },
  },
  { key: "handle-grab", name: "Short grab handle", hint: "A small loop for a quick lift", build: (f) => ({ pieces: [tube("Short grab handle", arch(f, 86, 40), { tubeWidth: 16, rings: false })] }) },
  { key: "handle-bar", name: "Wrapped bar handle", hint: "A firm bar wrapped in leather, on two rings", build: (f) => ({ pieces: [tube("Wrapped bar handle", [at(f.cx - 70, f.top(f.cx) - 34, false), at(f.cx + 70, f.top(f.cx) - 34, false)], { tubeStyle: "bar", tubeWidth: 20 })] }) },
];

const strapPath = (f: Frame, drop: number, spread = 1): Points => {
  const left = f.minX + f.width * (0.5 - 0.46 * spread);
  const right = f.maxX - f.width * (0.5 - 0.46 * spread);
  const foot = Math.min(f.top(left), f.top(right)) + 10;
  return [at(left, foot, true), at(left + 16, foot - drop * 0.6, true), at(f.cx, foot - drop, true), at(right - 16, foot - drop * 0.6, true), at(right, foot, true)];
};

const STRAPS: Part[] = [
  { key: "strap-cross", name: "Slim crossbody", hint: "A long thin strap to wear across the body", build: (f) => ({ pieces: [tube("Slim crossbody strap", strapPath(f, 330), { tubeStyle: "flat", tubeWidth: 14 })] }) },
  { key: "strap-wide", name: "Wide shoulder strap", hint: "A broad strap that spreads the weight", build: (f) => ({ pieces: [tube("Wide shoulder strap", strapPath(f, 300), { tubeStyle: "flat", tubeWidth: 40 })] }) },
  { key: "strap-chain", name: "Chain link strap", hint: "A leather ribbon threaded through metal links", build: (f) => ({ pieces: [tube("Chain link strap", strapPath(f, 280), { tubeStyle: "chain", tubeWidth: 10 })] }) },
  { key: "strap-adjust", name: "Adjustable buckle strap", hint: "A strap with a buckle to change its length", build: (f) => ({ pieces: [tube("Adjustable buckle strap", strapPath(f, 320), { tubeStyle: "flat", tubeWidth: 22 }), panel("Strap buckle keeper", soft(f.cx + f.width * 0.3, f.minY + 26, 50, 30), { stack: 2, fittings: [{ kind: "buckle", x: f.cx + f.width * 0.3, y: f.minY + 26, label: "Strap buckle" }] })] }) },
  {
    key: "strap-backpack",
    name: "Backpack pair",
    hint: "Two matching straps from the top to the base",
    build: (f) => {
      const side = (sign: number) => [at(f.cx + sign * 40, f.minY + 16, true), at(f.cx + sign * 120, f.cy - 40, true), at(f.cx + sign * 110, f.maxY - 16, true)];
      return { pieces: [tube("Backpack strap left", side(-1), { tubeStyle: "flat", tubeWidth: 34 }), tube("Backpack strap right", side(1), { tubeStyle: "flat", tubeWidth: 34 })] };
    },
  },
];

const FLAPS: Part[] = [
  { key: "flap-straight", name: "Straight flap", hint: "A plain flap with a level edge", build: (f) => ({ pieces: [mirrored(f, "Straight flap", flapChain(f, f.height * 0.5, "straight"))] }) },
  { key: "flap-round", name: "Rounded flap", hint: "A soft curve along the lower edge", build: (f) => ({ pieces: [mirrored(f, "Rounded flap", flapChain(f, f.height * 0.56, "round"))] }) },
  { key: "flap-point", name: "Envelope point", hint: "Two angled edges that meet at the centre", build: (f) => ({ pieces: [mirrored(f, "Envelope flap", flapChain(f, f.height * 0.62, "point"))] }) },
  { key: "flap-saddle", name: "Curved saddle flap", hint: "A deep curve that hugs the base", build: (f) => ({ pieces: [mirrored(f, "Curved saddle flap", flapChain(f, f.height * 0.86, "saddle"))] }) },
  { key: "flap-tab", name: "Short tab", hint: "A narrow tab that holds the top closed", build: (f) => ({ pieces: [panel("Short tab flap", soft(f.cx, f.minY + 36, 64, 92), { stack: 2 })] }) },
  { key: "flap-fold", name: "Fold-over", hint: "The top folds forward along a line", build: (f) => ({ pieces: [mirrored(f, "Fold-over top", flapChain(f, f.height * 0.34, "straight"), { fold: { ax: f.maxX, ay: f.minY + 12, bx: f.minX, by: f.minY + 12, angle: 18 } })] }) },
];

const pocketAt = (f: Frame) => ({ x: f.cx, y: f.cy + f.height * 0.17, w: f.width * 0.62, h: f.height * 0.42 });

const POCKETS: Part[] = [
  { key: "pocket-patch", name: "Patch pocket", hint: "A flat pocket stitched to the front", build: (f) => { const p = pocketAt(f); return { pieces: [panel("Patch pocket", rect(p.x, p.y, p.w, p.h))] }; } },
  { key: "pocket-round", name: "Rounded patch", hint: "A patch pocket with soft lower corners", build: (f) => { const p = pocketAt(f); return { pieces: [panel("Rounded patch pocket", soft(p.x, p.y, p.w, p.h))] }; } },
  { key: "pocket-zip", name: "Zip pocket", hint: "A flat pocket closed by a zip along the top", build: (f) => { const p = pocketAt(f); return { pieces: [panel("Zip pocket", rect(p.x, p.y, p.w, p.h), { fittings: [{ kind: "zip", x: p.x, y: p.y - p.h / 2 + 12, length: Math.max(20, p.w - 30), label: "Pocket zip" }] })] }; } },
  { key: "pocket-slip", name: "Slip pocket", hint: "An open pocket with a dipped edge", build: (f) => { const p = pocketAt(f); const h = p.h / 2; const w = p.w / 2; return { pieces: [mirrored(f, "Slip pocket", [[0, p.y - h + 14, true], [w * 0.6, p.y - h + 6, true], [w, p.y - h], [w, p.y + h], [0, p.y + h]], { stack: 1 })] }; } },
  { key: "pocket-gusset", name: "Gusset pocket", hint: "A pocket with a little depth to it", build: (f) => { const p = pocketAt(f); return { pieces: [panel("Gusset pocket", soft(p.x, p.y, p.w, p.h), { puff: 12 })] }; } },
  {
    key: "pocket-cards",
    name: "Card slots",
    hint: "Three stepped slots for cards",
    build: (f) => {
      const width = Math.min(96, f.width * 0.8);
      return { pieces: [0, 1, 2].map((row) => panel(`Card slot ${row + 1}`, rect(f.cx, f.cy + 10 + row * 14, width, 60 - row * 6), { stack: 1 + row })) };
    },
  },
];

const closureSpot = (f: Frame) => ({ x: f.cx, y: f.cy - f.height * 0.02 });

const CLOSURES: Part[] = [
  { key: "close-turnlock", name: "Turnlock", hint: "A metal twist lock at the centre", build: (f) => ({ fittings: [{ kind: "turnlock", ...closureSpot(f), label: "Turnlock" }] }) },
  { key: "close-magnet", name: "Magnetic snap", hint: "A hidden closure that clicks shut", build: (f) => ({ fittings: [{ kind: "snap", ...closureSpot(f), label: "Magnetic snap" }] }) },
  { key: "close-zip", name: "Zip", hint: "A zip across the top edge", build: (f) => ({ fittings: [{ kind: "zip", x: f.cx, y: f.minY + 14, length: Math.min(600, Math.max(20, f.width - 50)), label: "Top zip" }, { kind: "pull", x: f.cx + (f.width - 50) / 2 - 8, y: f.minY + 26, shape: "long", label: "Long zip pull" }] }) },
  { key: "close-buckle", name: "Buckle and strap", hint: "A strap that fastens with a buckle", build: (f) => ({ pieces: [panel("Buckle strap", rect(f.cx, f.minY + f.height * 0.3, 34, f.height * 0.56), { stack: 3, fittings: [{ kind: "buckle", x: f.cx, y: f.minY + f.height * 0.46, label: "Closure buckle" }] })] }) },
  {
    key: "close-draw",
    name: "Drawstring",
    hint: "A thin cord through eyelets at the top",
    build: (f) => {
      const y = f.minY + 18;
      const xs = [-0.36, -0.12, 0.12, 0.36].map((share) => f.cx + f.width * share);
      return { pieces: [tube("Drawstring cord", [at(f.minX + 18, y, true), at(f.cx, y + 10, true), at(f.maxX - 18, y, true)], { tubeWidth: 6, rings: false, stitched: false })], fittings: xs.map((x) => ({ kind: "rivet", x, y: y + 3, shape: "long", label: "Eyelet" })) };
    },
  },
  { key: "close-stud", name: "Push stud", hint: "A simple press stud", build: (f) => ({ fittings: [{ kind: "stud", ...closureSpot(f), label: "Push stud" }] }) },
];

const cornerGuard = (x: number, y: number, sx: number, sy: number): Points => [at(x, y), at(x + sx * 46, y), at(x + sx * 34, y + sy * 12, true), at(x + sx * 12, y + sy * 34, true), at(x, y + sy * 46)];

const TRIMS: Part[] = [
  { key: "trim-corners", name: "Corner guards", hint: "A pair of patches on the lower corners", build: (f) => ({ pieces: [panel("Corner guard left", cornerGuard(f.minX, f.maxY, 1, -1)), panel("Corner guard right", [...cornerGuard(f.maxX, f.maxY, -1, -1)].reverse())] }) },
  { key: "trim-binding", name: "Edge binding", hint: "A narrow band along the top edge", build: (f) => ({ pieces: [tube("Edge binding", [at(f.minX + 2, f.minY + 5), at(f.maxX - 2, f.minY + 5)], { tubeStyle: "flat", tubeWidth: 12, rings: false, stack: 3 })] }) },
  { key: "trim-tabs", name: "Side tabs", hint: "Small tabs at each side", build: (f) => ({ pieces: [panel("Side tab left", soft(f.minX + 14, f.cy - 30, 34, 60)), panel("Side tab right", soft(f.maxX - 14, f.cy - 30, 34, 60))] }) },
  { key: "trim-base", name: "Base panel", hint: "A contrast panel across the bottom", build: (f) => ({ pieces: [panel("Base panel", rect(f.cx, f.maxY - f.height * 0.13, f.width, f.height * 0.26))] }) },
  {
    key: "trim-drings",
    name: "D-ring tabs",
    hint: "Tabs with rings to clip a strap on",
    build: (f) => ({ pieces: [-1, 1].map((sign) => {
      const x = f.cx + sign * (f.width / 2 - 26);
      return panel(sign < 0 ? "D-ring tab left" : "D-ring tab right", soft(x, f.minY + 14, 26, 44), { stack: 2, fittings: [{ kind: "dring", x, y: f.minY + 2, label: "Tab D-ring" }] });
    }) }),
  },
];

const fittingAt = (name: string, hint: string, key: string, fit: Omit<Fit, "x" | "y">, spot: (f: Frame) => Vec | Vec[]): Part => ({
  key,
  name,
  hint,
  build: (f) => {
    const places = spot(f);
    return { fittings: (Array.isArray(places) ? places : [places]).map((place) => ({ ...fit, ...place, label: name })) };
  },
});

const fourFeet = (f: Frame) => [-0.38, -0.13, 0.13, 0.38].map((share) => ({ x: f.cx + f.width * share, y: f.maxY - 12 }));
const centre = (f: Frame) => ({ x: f.cx, y: f.cy });
const rivetRow = (f: Frame) => [-0.3, -0.1, 0.1, 0.3].map((share) => ({ x: f.cx + f.width * share, y: f.minY + 22 }));

const HARDWARE_PARTS: Part[] = [
  fittingAt("Square buckle", "A square frame with a prong", "hw-buckle-square", { kind: "buckle", shape: "square" }, centre),
  fittingAt("Round buckle", "A rounded frame with a prong", "hw-buckle-round", { kind: "buckle", shape: "round" }, centre),
  fittingAt("O-ring", "A plain round ring", "hw-ring-o", { kind: "ring", shape: "round" }, centre),
  fittingAt("Small ring", "A small ring for light straps", "hw-ring-small", { kind: "ring", shape: "long" }, centre),
  fittingAt("Square ring", "A squared link", "hw-ring-square", { kind: "ring", shape: "square" }, centre),
  fittingAt("D-ring", "A ring with one flat side", "hw-dring", { kind: "dring" }, centre),
  fittingAt("Dome rivets", "A row of four domed rivets", "hw-rivet-dome", { kind: "rivet", shape: "plain" }, rivetRow),
  fittingAt("Square rivets", "A row of four square rivets", "hw-rivet-square", { kind: "rivet", shape: "square" }, rivetRow),
  fittingAt("Round feet", "Four round feet along the base", "hw-feet-round", { kind: "foot", shape: "round" }, fourFeet),
  fittingAt("Square feet", "Four square feet along the base", "hw-feet-square", { kind: "foot", shape: "square" }, fourFeet),
  fittingAt("Tag zip pull", "A pointed tag", "hw-pull-tag", { kind: "pull", shape: "plain" }, centre),
  fittingAt("Bar zip pull", "A long slim bar", "hw-pull-bar", { kind: "pull", shape: "long" }, centre),
  fittingAt("Disc zip pull", "A small round disc", "hw-pull-disc", { kind: "pull", shape: "round" }, centre),
];

const PERSONAL: Part[] = [
  { key: "mono-gold-centre", name: "Gold serif, centre", hint: "Gold foil letters at the centre", build: () => ({ monogram: { technique: "gold", font: "didone", place: "center" } }) },
  { key: "mono-blind-corner", name: "Blind stamp, corner", hint: "Pressed letters with no colour, in the corner", build: () => ({ monogram: { technique: "blind", font: "didone", place: "corner" } }) },
  { key: "mono-palladium-low", name: "Palladium, low centre", hint: "Silver foil near the lower edge", build: () => ({ monogram: { technique: "palladium", font: "grotesk", place: "bottom" } }) },
  { key: "mono-gold-top", name: "Gold sans, top", hint: "Plain gold letters near the top", build: () => ({ monogram: { technique: "gold", font: "grotesk", place: "top" } }) },
  { key: "mono-blind-centre", name: "Blind sans, centre", hint: "Quiet pressed letters at the centre", build: () => ({ monogram: { technique: "blind", font: "grotesk", place: "center" } }) },
  {
    key: "mono-patch",
    name: "Name patch",
    hint: "A small leather patch with your letters",
    build: (f) => ({ pieces: [panel("Name patch", soft(f.cx + f.width * 0.26, f.maxY - 40, 84, 44), { stack: 3, text: { value: "OC", technique: "gold", font: "didone" } })] }),
  },
];

const liner = (name: string, points: Points, extra: Partial<BespokePiece> & { fittings?: Fit[] } = {}): Seed => ({ ...panel(name, points), finish: "suede", color: "ivory", thread: "ivory", view: "interior", ...extra });

const INTERIOR: Part[] = [
  { key: "in-pocket", name: "Inside pocket", hint: "A flat pocket on the inner back wall", view: "interior", build: (f) => ({ pieces: [liner("Inside pocket", rect(0, f.height * 0.16, f.width * 0.6, f.height * 0.4))] }) },
  { key: "in-zip", name: "Inside zip pocket", hint: "A zipped pocket for small things", view: "interior", build: (f) => ({ pieces: [liner("Inside zip pocket", rect(0, f.height * 0.1, f.width * 0.66, f.height * 0.46), { fittings: [{ kind: "zip", x: 0, y: f.height * 0.1 - f.height * 0.23 + 12, length: Math.max(20, f.width * 0.66 - 30), label: "Inside zip" }] })] }) },
  { key: "in-divider", name: "Divider", hint: "A leather wall that splits the inside", view: "interior", build: (f) => ({ pieces: [liner("Divider", rect(0, f.height * 0.08, f.width * 0.86, f.height * 0.7), { finish: "box", color: "cognac" })] }) },
  { key: "in-cards", name: "Inside card slots", hint: "Three stepped slots inside", view: "interior", build: (f) => ({ pieces: [0, 1, 2].map((row) => liner(`Inside card slot ${row + 1}`, rect(-f.width * 0.2, -f.height * 0.1 + row * 14, 96, 60 - row * 6), { stack: 1 + row })) }) },
  { key: "in-laptop", name: "Laptop padding", hint: "A soft padded panel to protect a laptop", view: "interior", build: (f) => ({ pieces: [liner("Laptop padding", soft(0, 0, f.width * 0.9, f.height * 0.84), { puff: 8 })] }) },
  { key: "in-leash", name: "Key leash", hint: "A short strap with a clip for keys", view: "interior", build: (f) => ({ pieces: [{ ...tube("Key leash", [at(f.width * 0.3, -f.height * 0.38, true), at(f.width * 0.34, -f.height * 0.2, true), at(f.width * 0.3, -f.height * 0.05, true)], { tubeStyle: "flat", tubeWidth: 8, color: "cognac", finish: "box" }), view: "interior" }] }) },
];

export const PART_CATEGORIES: PartCategory[] = [
  { key: "body", label: "Body shapes", parts: BODIES },
  { key: "handles", label: "Handles", parts: HANDLES },
  { key: "straps", label: "Straps", parts: STRAPS },
  { key: "flaps", label: "Flaps", parts: FLAPS },
  { key: "pockets", label: "Pockets", parts: POCKETS },
  { key: "closures", label: "Closures", parts: CLOSURES },
  { key: "trims", label: "Corners and trims", parts: TRIMS },
  { key: "hardware", label: "Hardware", parts: HARDWARE_PARTS },
  { key: "personal", label: "Personal", parts: PERSONAL },
  { key: "interior", label: "Interior", parts: INTERIOR },
];

const PARTS = new Map(PART_CATEGORIES.flatMap((category) => category.parts.map((part) => [part.key, part] as const)));
export const needsBody = (key: string) => !key.startsWith("body-");

export function frameOf(design: BespokeDesign): Frame {
  const main = bodyOf(design);
  const outline = main ? outlineOf(main) : null;
  const box = outline ? boundsOf(outline) : { minX: -DEFAULT_BODY.width / 2, maxX: DEFAULT_BODY.width / 2, minY: -DEFAULT_BODY.height / 2, maxY: DEFAULT_BODY.height / 2, width: DEFAULT_BODY.width, height: DEFAULT_BODY.height };
  const edge = (x: number) => (outline ? edgeAt(outline, x) : null);
  return {
    ...box,
    cx: (box.minX + box.maxX) / 2,
    cy: (box.minY + box.maxY) / 2,
    top: (x) => edge(x)?.top ?? box.minY,
    bottom: (x) => edge(x)?.bottom ?? box.maxY,
  };
}

function toPiece(seed: Seed, pieces: BespokePiece[], newId: () => string): BespokePiece {
  const { fittings, ...values } = seed;
  return {
    kind: "panel",
    view: "front",
    logo: null,
    closed: true,
    mirror: false,
    axisX: 0,
    holeOf: null,
    puff: 0,
    fold: null,
    tubeWidth: 14,
    tubeStyle: "rolled",
    textPlace: "center",
    rings: true,
    visible: true,
    finish: "box",
    color: "cognac",
    thread: "ivory",
    stitched: true,
    stack: 0,
    text: null,
    ...values,
    id: newId(),
    name: uniqueName(pieces, seed.name.slice(0, LIMITS.pieceName)),
    hardware: (fittings ?? []).map((fit) => fittingFrom(fit, newId)),
  };
}

const fittingFrom = (fit: Fit, newId: () => string): BespokePiece["hardware"][number] => ({ id: newId(), rotation: 0, length: 180, shape: "plain", label: "", ...fit });

function hostFor(pieces: BespokePiece[], point: Vec, view: DesignView) {
  return layerOrder(pieces).filter((piece) => piece.visible && isSolidPanel(piece) && piece.view === view).reverse().find((piece) => contains(outlineOf(piece), point)) ?? null;
}

export type Placed = { design: BespokeDesign; ids: string[]; name: string; view: DesignView };

export function applyPart(design: BespokeDesign, key: string, selectedId: string | null, newId: () => string): Placed | { error: string } {
  const part = PARTS.get(key);
  if (!part) return { error: "That part could not be found." };
  const main = bodyOf(design);
  if (needsBody(key) && !main) return { error: "Add a body shape first, then this part can attach to it." };
  const base = frameOf(design);
  const built = part.build(part.view === "interior" ? { ...base, minX: -base.width / 2, maxX: base.width / 2, minY: -base.height / 2, maxY: base.height / 2, cx: 0, cy: 0 } : base);
  const pieces = [...design.pieces];
  const ids: string[] = [];
  if (pieces.length + (built.pieces?.length ?? 0) > LIMITS.pieces) return { error: `A design can have up to ${LIMITS.pieces} pieces.` };
  let previous: BespokePiece | null = null;
  for (const seed of built.pieces ?? []) {
    const piece = toPiece(seed.holeOf === "previous" ? { ...seed, holeOf: previous!.id } : seed, pieces, newId);
    pieces.push(piece);
    if (!piece.holeOf) ids.push(piece.id);
    previous = piece;
  }
  for (const fit of built.fittings ?? []) {
    const host = hostFor(pieces, fit, part.view ?? "front") ?? main;
    if (!host) return { error: "Add a body shape first." };
    const index = pieces.findIndex((piece) => piece.id === host.id);
    if (pieces[index]!.hardware.length >= LIMITS.hardwarePerPiece) return { error: `A piece can hold up to ${LIMITS.hardwarePerPiece} fittings.` };
    pieces[index] = { ...pieces[index]!, hardware: [...pieces[index]!.hardware, fittingFrom(fit, newId)] };
    if (!ids.includes(host.id)) ids.push(host.id);
  }
  if (built.monogram) {
    const { place, value, ...style } = built.monogram;
    const selected = pieces.find((piece) => piece.id === selectedId && isSolidPanel(piece));
    const host = selected ?? main!;
    const index = pieces.findIndex((piece) => piece.id === host.id);
    pieces[index] = { ...pieces[index]!, textPlace: place, text: { value: pieces[index]!.text?.value ?? value ?? "OC", ...style } };
    ids.push(host.id);
  }
  return { design: { ...design, pieces }, ids, name: part.name, view: part.view ?? "front" };
}

let sampleCounter = 0;
const sampleId = () => `s${(sampleCounter++).toString(36)}`.slice(-16);

export function partPreview(key: string) {
  const start = blankDesign();
  const base = needsBody(key) ? applyPart(start, "body-satchel", null, sampleId) : { design: start };
  if ("error" in base) return null;
  const result = applyPart(base.design, key, null, sampleId);
  if ("error" in result) return null;
  return { design: { ...result.design, depth: 0 }, ghostId: needsBody(key) ? base.design.pieces[0]!.id : null };
}

type Recipe = { label: string; note: string; depth: number; parts: string[]; body?: Partial<BespokePiece>; detail?: Partial<BespokePiece>; metal?: BespokeDesign["metal"]; custom?: Seed[] };

const dress = (design: BespokeDesign, recipe: Recipe): BespokeDesign => {
  const main = bodyOf(design);
  return {
    ...design,
    pieces: design.pieces.map((piece) => (piece === main ? { ...piece, ...recipe.body } : piece.holeOf ? piece : { ...piece, ...recipe.detail })),
  };
};

const wallet = (name: string, width: number, height: number): Seed[] => [{ name, closed: true, finish: "box", color: "cognac", stack: 0, points: soft(0, 0, width, height) }];

const RECIPES: Record<Exclude<ProductType, "other">, Recipe[]> = {
  bag: [
    { label: "Everyday flap bag", note: "Satchel body, saddle flap and a top handle", depth: 80, parts: ["body-satchel", "flap-saddle", "close-turnlock", "handle-rolled"], body: { color: "tan" }, detail: { color: "espresso" } },
    { label: "City tote", note: "Trapezoid tote with an arch handle and a patch pocket", depth: 110, parts: ["body-trap", "pocket-patch", "handle-arch", "trim-corners"], body: { color: "forest", finish: "saffiano" }, detail: { color: "forest", finish: "saffiano", thread: "ivory" } },
    { label: "Crossbody saddle", note: "Half-moon saddle with a crossbody strap", depth: 60, parts: ["body-moon", "flap-round", "strap-cross", "close-stud"], body: { color: "bordeaux", finish: "pebble" }, detail: { color: "bordeaux", finish: "box" } },
  ],
  laptop_bag: [
    { label: "Slim laptop sleeve", note: "Sleeve body, top zip and a short grab handle", depth: 20, parts: ["body-sleeve", "close-zip", "handle-grab"], body: { color: "noir", finish: "box" }, detail: { color: "noir" }, metal: "gunmetal" },
    { label: "Work briefcase", note: "Sleeve body, fold-over top and a wide strap", depth: 70, parts: ["body-sleeve", "flap-fold", "strap-wide", "pocket-zip", "close-buckle"], body: { color: "espresso", finish: "pebble" }, detail: { color: "espresso" } },
    { label: "Soft portfolio", note: "A puffed sleeve with a patch pocket", depth: 30, parts: ["body-sleeve", "pocket-round", "handle-flat"], body: { color: "navy", finish: "suede", puff: 6 }, detail: { color: "navy" }, metal: "palladium" },
  ],
  wallet: [
    { label: "Bifold wallet", note: "Card slots and a stitched edge", depth: 6, parts: ["pocket-cards"], custom: wallet("Wallet body", 200, 96), body: { color: "cognac" }, detail: { color: "tan" } },
    { label: "Snap wallet", note: "A short tab with a push stud", depth: 10, parts: ["flap-tab", "close-stud"], custom: wallet("Wallet body", 190, 110), body: { color: "bordeaux", finish: "saffiano" }, detail: { color: "bordeaux", finish: "saffiano" } },
    { label: "Zip wallet", note: "A top zip and a name patch", depth: 14, parts: ["close-zip", "mono-patch"], custom: wallet("Wallet body", 196, 100), body: { color: "noir", finish: "croc" }, detail: { color: "noir" } },
  ],
  card_holder: [
    { label: "Slim card holder", note: "Three stepped slots", depth: 0, parts: ["pocket-cards"], custom: wallet("Holder body", 105, 78), body: { color: "sage" }, detail: { color: "ivory" } },
    { label: "Tab card case", note: "A short tab and a push stud", depth: 6, parts: ["flap-tab", "close-stud"], custom: wallet("Holder body", 110, 78), body: { color: "cobalt", finish: "saffiano" }, detail: { color: "cobalt", finish: "saffiano" } },
    { label: "Monogram holder", note: "A blind stamp in the corner", depth: 0, parts: ["mono-blind-corner"], custom: wallet("Holder body", 108, 76), body: { color: "rose", finish: "box" } },
  ],
  belt: [
    { label: "Classic dress belt", note: "A slim strap with a square buckle", depth: 0, parts: [], custom: [{ name: "Belt strap", closed: true, finish: "box", color: "noir", stack: 0, points: soft(0, 0, 1000, 30), fittings: [{ kind: "buckle", x: -480, y: 0, label: "Square buckle" }, { kind: "rivet", x: -440, y: 0, label: "Rivet" }] }] },
    { label: "Wide casual belt", note: "A broad strap with a round buckle", depth: 0, parts: [], custom: [{ name: "Belt strap", closed: true, finish: "pebble", color: "cognac", stack: 0, points: soft(0, 0, 1050, 42), fittings: [{ kind: "buckle", x: -500, y: 0, shape: "round", label: "Round buckle" }, { kind: "rivet", x: -456, y: 0, label: "Rivet" }, { kind: "rivet", x: -436, y: 0, label: "Rivet" }] }] },
    { label: "Ring belt", note: "A strap that fastens through two rings", depth: 0, parts: [], custom: [{ name: "Belt strap", closed: true, finish: "suede", color: "sage", stack: 0, points: soft(0, 0, 1000, 34), fittings: [{ kind: "ring", x: -470, y: 0, shape: "round", label: "O-ring" }, { kind: "ring", x: -440, y: 0, shape: "round", label: "O-ring" }] }] },
  ],
};

export const INSPIRATION = (Object.entries(RECIPES) as [Exclude<ProductType, "other">, Recipe[]][]).map(([productType, recipes]) => ({
  productType,
  designs: recipes.map((recipe, index) => ({
    key: `${productType}-${index}`,
    label: recipe.label,
    note: recipe.note,
    build(newId: () => string): BespokeDesign {
      let design: BespokeDesign = { ...blankDesign(), productType, depth: recipe.depth, metal: recipe.metal ?? "gold", name: `Example: ${recipe.label}` };
      for (const seed of recipe.custom ?? []) design = { ...design, pieces: [...design.pieces, toPiece(seed, design.pieces, newId)] };
      for (const key of recipe.parts) {
        const placed = applyPart(design, key, null, newId);
        if ("error" in placed) throw new Error(placed.error);
        design = placed.design;
      }
      return dress(design, recipe);
    },
  })),
}));
