import { DEFAULT_PRICING, type StudioPricing } from "../studio/pricing";
import { HARDWARE, type BespokeDesign, type HardwareKind } from "./design";
import { bodyOf, groupBounds, holeOutlines, isSolidPanel, netArea, outlineOf, pathLength, perimeter } from "./outline";

const MM2_PER_DM2 = 10_000;
const BASE_HOURS = 2;
const HOURS_PER_PIECE = 0.5;
const HOURS_PER_DM2 = 0.06;
const HOURS_PER_STITCHED_METRE = 1.2;
const TUBE_WRAP = 2.4;
export const CHAIN_PITCH_MM = 24;

export type DesignMeasures = {
  areaDm2: number;
  stitchedMm: number;
  pieceCount: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
};

export type BespokeEstimate = DesignMeasures & { lowCents: number; highCents: number; hours: number };

export function visibleDesign(design: BespokeDesign): BespokeDesign {
  const shown = design.pieces.filter((piece) => piece.visible);
  const ids = new Set(shown.map((piece) => piece.id));
  const pieces = shown.filter((piece) => !piece.holeOf || ids.has(piece.holeOf));
  return { ...design, pieces, bodyId: design.bodyId && ids.has(design.bodyId) ? design.bodyId : null };
}

export function measureDesign(source: BespokeDesign, pricing: StudioPricing = DEFAULT_PRICING) {
  const design = visibleDesign(source);
  const panels = design.pieces.filter(isSolidPanel);
  const tubes = design.pieces.filter((piece) => piece.kind === "tube");
  if (!panels.length && !tubes.length) return null;
  const body = bodyOf(design);
  let leatherCents = 0;
  let areaDm2 = 0;
  let stitchedMm = 0;
  for (const piece of panels) {
    const edge = perimeter(outlineOf(piece)) + holeOutlines(piece, design.pieces).reduce((sum, hole) => sum + perimeter(hole), 0);
    const area = netArea(piece, design.pieces) / MM2_PER_DM2;
    const isBody = piece === body && design.depth > 0;
    const pieceArea = isBody ? area * 2 + (perimeter(outlineOf(piece)) * design.depth) / MM2_PER_DM2 : area;
    areaDm2 += pieceArea;
    leatherCents += pieceArea * pricing.finishCentsPerDm2[piece.finish];
    if (piece.stitched) stitchedMm += isBody ? edge * 2 : edge;
  }
  for (const tube of tubes) {
    const length = pathLength(outlineOf(tube));
    const area = (length * tube.tubeWidth * TUBE_WRAP) / MM2_PER_DM2;
    areaDm2 += area;
    leatherCents += area * pricing.finishCentsPerDm2[tube.finish];
    if (tube.stitched) stitchedMm += length * 2;
  }
  const fronts = [...panels, ...tubes].filter((piece) => piece.view === "front");
  const box = groupBounds(fronts.length ? fronts : [...panels, ...tubes]);
  const measures: DesignMeasures = {
    areaDm2,
    stitchedMm,
    pieceCount: panels.length + tubes.length,
    widthMm: Math.round(box.width),
    heightMm: Math.round(box.height),
    depthMm: design.depth,
  };
  return { measures, leatherCents, closed: [...panels, ...tubes] };
}

export function hardwareList(design: BespokeDesign) {
  const totals = new Map<string, { kind: HardwareKind; name: string; quantity: number }>();
  const add = (kind: HardwareKind, name: string, quantity: number) => {
    const key = `${kind}|${name}`;
    totals.set(key, { kind, name, quantity: (totals.get(key)?.quantity ?? 0) + quantity });
  };
  for (const piece of visibleDesign(design).pieces) {
    for (const item of piece.hardware) add(item.kind, item.label || HARDWARE[item.kind].name, 1);
    if (piece.kind === "tube" && piece.rings) add("dring", "Handle ring", 2);
    if (piece.kind === "tube" && piece.tubeStyle === "chain") add("link", HARDWARE.link.name, Math.ceil(pathLength(outlineOf(piece)) / CHAIN_PITCH_MM));
  }
  return [...totals.values()];
}

export function estimateDesign(design: BespokeDesign, pricing: StudioPricing = DEFAULT_PRICING): BespokeEstimate | null {
  const measured = measureDesign(design, pricing);
  if (!measured) return null;
  const { measures, leatherCents, closed } = measured;
  const hours =
    BASE_HOURS +
    measures.pieceCount * HOURS_PER_PIECE +
    measures.areaDm2 * HOURS_PER_DM2 +
    (measures.stitchedMm / 1000) * HOURS_PER_STITCHED_METRE;
  const textCents = closed.reduce((sum, piece) => sum + (piece.text ? (piece.text.technique === "blind" ? pricing.blindMonogramCents : pricing.foilMonogramCents) : 0) + (piece.logo ? pricing.bespokeLogoCents : 0), 0);
  const fittingCents = hardwareList(design).reduce<number>((sum, item) => sum + pricing.hardwareCents[item.kind] * item.quantity, pricing.metalCents[design.metal]);
  const total =
    pricing.baseCents +
    leatherCents * pricing.wastage * pricing.margin +
    hours * pricing.labourCentsPerHour * pricing.margin +
    fittingCents * pricing.margin +
    textCents;
  return {
    ...measures,
    hours,
    lowCents: Math.floor((total * pricing.bespokeLowSpread) / pricing.roundToCents) * pricing.roundToCents,
    highCents: Math.ceil((total * pricing.bespokeHighSpread) / pricing.roundToCents) * pricing.roundToCents,
  };
}
