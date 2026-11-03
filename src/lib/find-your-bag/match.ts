import { z } from "zod";
import { colorSchema, dressSpec, INITIALS_PATTERN } from "./dress";
import { COLORS, FINISHES, PATTERNS, type ColorKey, type DesignSpec } from "../studio/spec";

export const PURPOSES = ["work", "everyday", "travel", "evening", "gift"] as const;
export const LOADS = ["laptop", "essentials", "lots"] as const;
export const CARRIES = ["hand", "shoulder", "crossbody", "any"] as const;

export type Purpose = (typeof PURPOSES)[number];
export type Load = (typeof LOADS)[number];
export type Carry = (typeof CARRIES)[number];

export type Answers = {
  purpose?: Purpose;
  load?: Load;
  carry?: Carry;
  color?: ColorKey;
  initials?: string;
};

export type CompleteAnswers = Required<Omit<Answers, "initials">> & { initials?: string };

export const STEPS = ["purpose", "load", "carry", "color", "initials"] as const;
export type StepKey = (typeof STEPS)[number] | "result";

export type Candidate = {
  id: string;
  slug: string;
  name: string;
  type: string;
  image: string | null;
  spec: DesignSpec;
  ready: { variantId: string; color: ColorKey | null; colorName: string; priceCents: number; inStock: boolean } | null;
};

export type Match = {
  candidate: Candidate;
  score: number;
  exact: boolean;
  reasons: string[];
  notes: string[];
};

const answerSchema = z.object({
  purpose: z.enum(PURPOSES).optional().catch(undefined),
  load: z.enum(LOADS).optional().catch(undefined),
  carry: z.enum(CARRIES).optional().catch(undefined),
  color: colorSchema.optional().catch(undefined),
  initials: z.string().regex(INITIALS_PATTERN).transform((value) => value.toUpperCase()).optional().catch(undefined),
});

const HASH_KEYS = { purpose: "for", load: "carry", carry: "wear", color: "leather", initials: "initials" } as const;

export function parseHash(hash: string): { answers: Answers; step: StepKey } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = Object.fromEntries(Object.entries(HASH_KEYS).map(([key, name]) => [key, params.get(name) ?? undefined]));
  const answers = stripEmpty(answerSchema.parse(raw));
  const requested = params.get("step");
  const firstOpen = STEPS.find((step) => step !== "initials" && !answers[step]) ?? null;
  if (requested === "result") return { answers, step: firstOpen ?? "result" };
  const index = STEPS.indexOf(requested as (typeof STEPS)[number]);
  if (index < 0) return { answers, step: firstOpen ?? "result" };
  const blocked = STEPS.slice(0, index).find((step) => step !== "initials" && !answers[step]);
  return { answers, step: blocked ?? STEPS[index]! };
}

export function toHash(answers: Answers, step: StepKey) {
  const params = new URLSearchParams();
  for (const [key, name] of Object.entries(HASH_KEYS) as [keyof Answers, string][]) {
    const value = answers[key];
    if (value) params.set(name, value);
  }
  params.set("step", step);
  return `#${params.toString()}`;
}

function stripEmpty(answers: Answers): Answers {
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value !== undefined)) as Answers;
}

export const isComplete = (answers: Answers): answers is CompleteAnswers =>
  Boolean(answers.purpose && answers.load && answers.carry && answers.color);

export type Shape = "bag" | "sleeve" | "clutch" | "small";

export function traitsOf(spec: DesignSpec) {
  const { width, height, depth, softness } = spec.form;
  const { handles, handleDrop, strap, strapLength } = spec.carry;
  const shape: Shape = width < 200 ? "small" : depth < 40 ? (width >= 300 ? "sleeve" : "clutch") : "bag";
  const litres = (width * height * depth) / 1_000_000;
  const laptopInches = shape === "small" || shape === "clutch" ? 0 : width >= 380 && height >= 270 ? 15 : width >= 340 && height >= 240 ? 14 : 0;
  return {
    shape,
    litres,
    laptopInches,
    hand: handles > 0,
    shoulder: (handles > 0 && handleDrop >= 180) || strap,
    crossbody: strap && strapLength >= 1100,
    secure: spec.closure.type !== "open",
    structured: softness <= 0.2,
    dressy: ["croc", "saffiano", "suede"].includes(spec.panels.primary.finish) || spec.surface.pattern !== "none",
  };
}

type Traits = ReturnType<typeof traitsOf>;
type Part = { score: number; reason?: string; note?: string };

const cm = (mm: number) => `${Math.round(mm / 10)} cm`;
const withA = (text: string) => `${/^(8|11|18)/.test(text) ? "an" : "a"} ${text}`;
const size = (spec: DesignSpec) => `${spec.form.width} × ${spec.form.height} × ${spec.form.depth} mm`;

function closureReason(spec: DesignSpec) {
  if (spec.closure.type === "zip") return "Closes with a zip, so nothing falls out.";
  if (spec.closure.type === "flap") return spec.closure.clasp === "none" ? "A leather flap folds over the top." : `A flap with a ${spec.closure.clasp} clasp keeps it shut.`;
  return "An open top, so everything is in easy reach.";
}

function purposePart(purpose: Purpose, spec: DesignSpec, t: Traits): Part {
  switch (purpose) {
    case "work": {
      if (t.shape === "small") return { score: -6, note: "It is a small leather piece, not a bag for work." };
      if (t.laptopInches) return { score: 4 + (t.secure ? 1 : 0) + (t.structured ? 1 : 0), reason: t.structured && t.secure ? "A firm, structured shape that keeps papers flat." : closureReason(spec) };
      if (t.shape === "clutch") return { score: -2, note: "It is slim, sized for an evening rather than a working day." };
      return { score: 1 + (t.secure ? 1 : 0), reason: closureReason(spec) };
    }
    case "everyday": {
      if (t.shape === "small") return { score: -6, note: "It is a small leather piece, not a bag." };
      if (t.shape === "sleeve") return { score: -3, note: "It is a sleeve with no handle or strap." };
      if (t.litres > 25) return { score: -2, note: "It is built for travel, so it is large for every day." };
      const medium = t.litres >= 2.5 && t.litres <= 18;
      return { score: (t.shape === "bag" ? 3 : 0) + (medium ? 2 : 0) + (t.hand || t.shoulder ? 1 : 0), reason: closureReason(spec) };
    }
    case "travel": {
      if (t.shape === "small") return { score: -6, note: "It is a small leather piece, not a travel bag." };
      if (t.litres >= 20) return { score: 5 + (spec.closure.type === "zip" ? 1 : 0) + (spec.carry.strap ? 1 : 0), reason: spec.closure.type === "zip" ? "Zips shut across the top, with room to pack for a short trip." : "Room to pack for a short trip." };
      if (t.shape === "clutch") return { score: -3, note: "It is too slim to pack for a trip." };
      if (t.shape === "sleeve") return { score: 0, note: "It is a sleeve with no handle or strap." };
      if (t.litres < 10) return { score: 1 + (t.secure ? 1 : 0) + (t.crossbody ? 1 : 0), reason: t.secure ? "Shuts securely, for days out once you arrive." : closureReason(spec) };
      return { score: 2 + (t.laptopInches ? 1 : 0), reason: closureReason(spec) };
    }
    case "evening": {
      if (t.shape === "small") return { score: -3, note: "It is a wallet or card case, not an evening bag." };
      if (t.laptopInches || t.litres > 12) return { score: -2, note: "It is large for an evening out." };
      const small = t.litres <= 7.5;
      return { score: (small ? 3 : 0) + (t.dressy ? 2 : 0) + (t.secure ? 1 : 0) + (t.shape === "clutch" ? 2 : 0), reason: t.dressy ? finishReason(spec) : closureReason(spec) };
    }
    case "gift":
      if (t.shape === "small") return { score: 3, reason: "Easy to give, and slips into any pocket." };
      if (t.shape === "clutch") return { score: 2, reason: "Easy to give, and slim enough for any bag." };
      return { score: 1 };
  }
}

function loadPart(load: Load, spec: DesignSpec, t: Traits): Part {
  switch (load) {
    case "laptop":
      if (!t.laptopInches) return { score: -6, note: "A laptop will not fit inside." };
      return {
        score: 5 + (t.laptopInches === 15 ? 1 : 0),
        reason: `At ${spec.form.width} × ${spec.form.height} mm it takes a laptop up to ${t.laptopInches} inches. Check yours against it.`,
      };
    case "essentials":
      if (t.litres > 15) return { score: -3, note: "It is roomy for just phone, keys and cards." };
      if (t.litres <= 7.5) return { score: 3 + (t.shape === "small" ? 1 : 0), reason: t.shape === "small" ? "Pocket-sized, for cards and notes." : `Compact at ${size(spec)}, for phone, keys and cards.` };
      return { score: t.laptopInches ? -1 : 1 };
    case "lots":
      if (t.shape === "small") return { score: -6, note: "It holds cards and notes only." };
      if (t.shape === "clutch" || t.shape === "sleeve") return { score: -4, note: "It is slim, with room for a few things only." };
      if (t.litres >= 10) return { score: 3 + (t.litres >= 20 ? 1 : 0), reason: `Roomy at ${size(spec)}${spec.form.gusset === "bellows" ? ", with bellows sides that open wide" : ""}.` };
      return { score: 0, note: t.litres < 5 ? "It is on the small side for carrying a lot." : undefined };
  }
}

function carryPart(carry: Carry, spec: DesignSpec, t: Traits): Part {
  if (carry === "any" || t.shape === "small") return { score: 0 };
  const { handles, handleDrop, strapLength } = spec.carry;
  const handleText = `${handles === 2 ? "Two top handles" : "A top handle"} with ${withA(cm(handleDrop))} drop.`;
  switch (carry) {
    case "hand":
      if (t.hand) return { score: 3, reason: handleText };
      if (t.shape === "clutch") return { score: 2, reason: "Made to be held in the hand." };
      return { score: -2, note: spec.carry.strap ? "It has a strap, not a top handle." : "It has no handle." };
    case "shoulder":
      if (t.shoulder) return { score: 3, reason: spec.carry.strap ? `A shoulder strap of ${cm(strapLength)}.` : `Handles with ${withA(cm(handleDrop))} drop sit on the shoulder.` };
      return { score: -2, note: t.hand ? "Its handles are short, for carrying by hand." : "It has no strap or handle." };
    case "crossbody":
      if (t.crossbody) return { score: 4, reason: `${withA(cm(strapLength)).replace(/^a/, "A")} strap, long enough to wear across the body.` };
      if (spec.carry.strap) return { score: -1, note: `The ${cm(strapLength)} strap sits on the shoulder rather than across the body.` };
      return { score: -3, note: "It has no strap to wear across the body." };
  }
}

function finishReason(spec: DesignSpec) {
  const finish = FINISHES[spec.panels.primary.finish];
  if (spec.surface.pattern !== "none") return `${PATTERNS[spec.surface.pattern].name} ${finish.name.toLowerCase()}.`;
  return `${finish.name}: ${finish.note.charAt(0).toLowerCase()}${finish.note.slice(1)}.`;
}

export function leatherLine(spec: DesignSpec) {
  return `${COLORS[spec.panels.primary.color].name} ${FINISHES[spec.panels.primary.finish].name.toLowerCase()}`;
}

export function scoreCandidate(candidate: Candidate, answers: CompleteAnswers): Match {
  const t = traitsOf(candidate.spec);
  const parts = [purposePart(answers.purpose, candidate.spec, t), loadPart(answers.load, candidate.spec, t), carryPart(answers.carry, candidate.spec, t)];
  const readyInColor = candidate.ready?.color === answers.color;
  const reasons = [...new Set(parts.flatMap((part) => (part.reason ? [part.reason] : [])))];
  if (!reasons.some((reason) => reason.startsWith(FINISHES[candidate.spec.panels.primary.finish].name))) reasons.push(finishReason(candidate.spec));
  return {
    candidate,
    score: parts.reduce((sum, part) => sum + part.score, 0) + (readyInColor ? 0.5 : 0),
    exact: parts.every((part) => part.score >= 0 && !part.note),
    reasons: reasons.slice(0, 3),
    notes: parts.flatMap((part) => (part.note ? [part.note] : [])),
  };
}

export function rankMatches(candidates: Candidate[], answers: CompleteAnswers, limit = 2): Match[] {
  const ranked = candidates
    .map((candidate) => scoreCandidate(candidate, answers))
    .sort((a, b) => b.score - a.score || Number(b.exact) - Number(a.exact) || a.candidate.name.localeCompare(b.candidate.name));
  const picked: Match[] = [];
  for (const match of ranked) {
    if (picked.length >= limit) break;
    if (picked.some((item) => item.candidate.type === match.candidate.type) && ranked.length > limit) continue;
    picked.push(match);
  }
  for (const match of ranked) {
    if (picked.length >= limit) break;
    if (!picked.includes(match)) picked.push(match);
  }
  return picked;
}

export type Fulfilment = { kind: "ready"; variantId: string; priceCents: number } | { kind: "made"; spec: DesignSpec };

export function fulfilmentOf(candidate: Candidate, color: ColorKey, initials?: string | null): Fulfilment {
  const ready = candidate.ready;
  if (ready && ready.inStock && ready.color === color && !initials) return { kind: "ready", variantId: ready.variantId, priceCents: ready.priceCents };
  return { kind: "made", spec: { ...dressSpec(candidate.spec, color, initials ?? null), name: `${candidate.name} in ${COLORS[color].name}` } };
}

export function colorKeyOf(name: string): ColorKey | null {
  const needle = name.trim().toLowerCase();
  const found = (Object.keys(COLORS) as ColorKey[]).find((key) => key === needle || COLORS[key].name.toLowerCase() === needle);
  return found ?? null;
}

export function studioHref(candidate: Candidate, color: ColorKey, initials?: string | null) {
  const params = new URLSearchParams();
  params.set("from", candidate.slug);
  params.set("color", color);
  if (initials) params.set("initials", initials);
  return `/studio?${params.toString()}`;
}
