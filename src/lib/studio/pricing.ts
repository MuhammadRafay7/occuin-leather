import { HARDWARE, type HardwareKind } from "../bespoke/design";
import { COLORS, FINISHES, METALS, PATTERNS, THREADS, type DesignSpec, type FinishKey } from "./spec";

export type PriceLine = { label: string; cents: number };
export type DesignQuote = { lines: PriceLine[]; totalCents: number; leadWeeks: number; areaDm2: number };

export const ATELIER_BASE_CENTS = 1500;
export const LABOUR_CENTS_PER_HOUR = 700;
export const WASTAGE = 1.35;
export const MARGIN = 1.6;
export const ROUND_TO_CENTS = 500;

type MetalKey = keyof typeof METALS;
type PatternKey = keyof typeof PATTERNS;

const costs = <K extends string>(record: Record<K, { cents: number }>) =>
  Object.fromEntries(Object.entries<{ cents: number }>(record).map(([key, value]) => [key, value.cents])) as Record<K, number>;

export type StudioPricing = {
  baseCents: number;
  labourCentsPerHour: number;
  wastage: number;
  margin: number;
  roundToCents: number;
  finishCentsPerDm2: Record<FinishKey, number>;
  metalCents: Record<MetalKey, number>;
  patternCents: Record<PatternKey, number>;
  zipCents: number;
  zipPocketCents: number;
  flapClaspCents: number;
  handleCents: number;
  strapCents: number;
  feetCents: number;
  blindMonogramCents: number;
  foilMonogramCents: number;
  bespokeLogoCents: number;
  bespokeLowSpread: number;
  bespokeHighSpread: number;
  hardwareCents: Record<HardwareKind, number>;
};

export const DEFAULT_PRICING: StudioPricing = {
  baseCents: ATELIER_BASE_CENTS,
  labourCentsPerHour: LABOUR_CENTS_PER_HOUR,
  wastage: WASTAGE,
  margin: MARGIN,
  roundToCents: ROUND_TO_CENTS,
  finishCentsPerDm2: Object.fromEntries(Object.entries(FINISHES).map(([key, value]) => [key, value.centsPerDm2])) as Record<FinishKey, number>,
  metalCents: costs(METALS),
  patternCents: costs(PATTERNS),
  zipCents: 500,
  zipPocketCents: 400,
  flapClaspCents: 900,
  handleCents: 400,
  strapCents: 1000,
  feetCents: 300,
  blindMonogramCents: 800,
  foilMonogramCents: 1500,
  bespokeLogoCents: 2500,
  bespokeLowSpread: 0.9,
  bespokeHighSpread: 1.25,
  hardwareCents: costs(HARDWARE),
};

function panelAreas(spec: DesignSpec) {
  const { width, height, depth, taper } = spec.form;
  const meanWidth = (width * (1 + taper)) / 2;
  const face = (meanWidth * height) / 10_000;
  const perimeter = (2 * height + width + meanWidth) / 100;
  const gusset = (perimeter * depth) / 100 / (spec.closure.type === "open" ? 1.25 : 1);
  const flap = spec.closure.type === "flap" ? (meanWidth * height * spec.closure.flapLength) / 10_000 : 0;
  return { face, gusset, flap };
}

export function quoteDesign(spec: DesignSpec, pricing: StudioPricing = DEFAULT_PRICING): DesignQuote {
  const { face, gusset, flap } = panelAreas(spec);
  const accentShare = { single: 0, yoke: 1 - spec.panels.divide, split: 0.5, diagonal: 0.5, tipped: 0.2 }[spec.panels.layout];
  const faces = face * 2 + flap;
  const primaryArea = faces * (1 - accentShare);
  const accentArea = faces * accentShare;

  const leather = Math.round(
    (primaryArea * pricing.finishCentsPerDm2[spec.panels.primary.finish] +
      accentArea * pricing.finishCentsPerDm2[spec.panels.accent.finish] +
      gusset * pricing.finishCentsPerDm2[spec.panels.gusset.finish]) *
      pricing.wastage,
  );

  const hours =
    1 +
    (face * 2 + gusset) * 0.06 +
    (spec.panels.layout === "single" ? 0 : 1.5) +
    (spec.form.gusset === "bellows" ? 1 : 0) +
    (spec.closure.type === "zip" ? 1 : spec.closure.type === "flap" ? 1.5 : 0) +
    spec.carry.handles * 1.25 +
    (spec.carry.strap ? 1.5 : 0) +
    (spec.pocket === "none" ? 0 : spec.pocket === "slip" ? 0.75 : 1.5) +
    (spec.stitch.rows === 2 ? 1 : 0) +
    (6 - spec.stitch.length) * 0.35;

  const fittings =
    (spec.closure.type === "zip" ? pricing.zipCents : 0) +
    (spec.pocket === "zip" ? pricing.zipPocketCents : 0) +
    (spec.closure.type === "flap" && spec.closure.clasp !== "none" ? pricing.flapClaspCents : 0) +
    spec.carry.handles * pricing.handleCents +
    (spec.carry.strap ? pricing.strapCents : 0) +
    (spec.hardware.feet ? pricing.feetCents : 0) +
    pricing.metalCents[spec.hardware.metal];

  const pattern = Math.round(pricing.patternCents[spec.surface.pattern] * Math.max(0.3, faces / 12));
  const monogram = spec.monogram.text.trim() ? (spec.monogram.technique === "blind" ? pricing.blindMonogramCents : pricing.foilMonogramCents) : 0;

  const lines: PriceLine[] = [
    { label: "Pattern cutting and setup", cents: pricing.baseCents },
    { label: `Leather, ${(faces + gusset).toFixed(1)} dm²`, cents: Math.round(leather * pricing.margin) },
    { label: `Handwork, ${hours.toFixed(1)} hours`, cents: Math.round(hours * pricing.labourCentsPerHour * pricing.margin) },
  ];
  if (fittings) lines.push({ label: "Hardware and fittings", cents: Math.round(fittings * pricing.margin) });
  if (pattern) lines.push({ label: PATTERNS[spec.surface.pattern].name, cents: pattern });
  if (monogram) lines.push({ label: "Monogram", cents: monogram });

  const raw = lines.reduce((sum, line) => sum + line.cents, 0);
  const totalCents = Math.ceil(raw / pricing.roundToCents) * pricing.roundToCents;
  const rounding = totalCents - raw;
  if (rounding) lines[0] = { label: lines[0]!.label, cents: lines[0]!.cents + rounding };

  return { lines, totalCents, leadWeeks: Math.round(3 + hours / 4), areaDm2: faces + gusset };
}

export function describeDesign(spec: DesignSpec) {
  const hide = (h: DesignSpec["panels"]["primary"]) => `${COLORS[h.color].name} ${FINISHES[h.finish].name.toLowerCase()}`;
  const rows: [string, string][] = [
    ["Size", `${spec.form.width} × ${spec.form.height} × ${spec.form.depth} mm`],
    ["Body", hide(spec.panels.primary)],
    ["Gusset", hide(spec.panels.gusset)],
  ];
  if (spec.panels.layout !== "single") rows.push(["Panels", `${spec.panels.layout}, ${hide(spec.panels.accent)}`]);
  if (spec.surface.pattern !== "none") rows.push(["Surface", PATTERNS[spec.surface.pattern].name]);
  rows.push(["Closure", spec.closure.type === "flap" ? `${spec.closure.flapShape} flap, ${spec.closure.clasp === "none" ? "no clasp" : spec.closure.clasp}` : spec.closure.type]);
  if (spec.carry.handles) rows.push(["Handles", `${spec.carry.handles} × ${spec.carry.handleWidth} mm, ${spec.carry.handleDrop} mm drop`]);
  if (spec.carry.strap) rows.push(["Strap", `${spec.carry.strapLength} × ${spec.carry.strapWidth} mm`]);
  if (spec.pocket !== "none") rows.push(["Pocket", spec.pocket]);
  rows.push(
    ["Hardware", `${METALS[spec.hardware.metal].name}${spec.hardware.feet ? ", base feet" : ""}`],
    ["Stitching", `${THREADS[spec.stitch.thread].name}, ${spec.stitch.length} mm, ${spec.stitch.rows === 2 ? "double" : "single"} row`],
    ["Edge paint", COLORS[spec.edgeColor].name],
    ["Lining", COLORS[spec.liningColor].name],
  );
  if (spec.monogram.text.trim()) rows.push(["Monogram", `${spec.monogram.text.trim().toUpperCase()}, ${spec.monogram.technique}, ${spec.monogram.placement}`]);
  return rows;
}
