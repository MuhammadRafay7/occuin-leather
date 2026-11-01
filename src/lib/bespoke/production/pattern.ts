import { COLORS, FINISHES, METALS, THREADS } from "../../studio/spec";
import { HIDE_WASTAGE, PATTERN, SEAM_ALLOWANCE_MM } from "../config";
import { HARDWARE, LOGO_STYLES, PRODUCT_TYPES, TEXT_TECHNIQUES, VIEWS, type BespokeDesign, type BespokePiece } from "../design";
import { hardwareList, visibleDesign } from "../estimate";
import { bodyOf, boundsOf, contains, edgeAt, holeOutlines, isSolidPanel, layerOrder, outlineOf, pathLength, perimeter, polygonArea, puffFactor, STITCH_INSET_MM, stitchRuns, textPlacement, type StitchRun, type Vec } from "../outline";
import { checkDesign, type Finding } from "../rules";
import { distanceToLine, offsetOutline, signedArea } from "./geometry";

const MM2_PER_DM2 = 10_000;
const MIN_TURN_DEGREES = 0.5;
const STRAIGHT_RUN = 0.001;
const OPEN_TOP_MATCH = /zip/i;

export type Notch = { at: Vec; normal: Vec; kind: "corner" | "handle" | "centre" };
export type PatternMark = { at: Vec; label: string };
export type PatternLine = { points: Vec[]; closed: boolean };
export type PatternRole = "panel" | "back" | "gusset" | "top" | "strip";

export type PatternPiece = {
  code: string;
  pieceId: string;
  role: PatternRole;
  name: string;
  quantity: number;
  leather: string;
  leatherKey: string;
  width: number;
  height: number;
  cut: Vec[];
  cutHoles: Vec[][];
  seam: Vec[];
  seamHoles: Vec[][];
  stitches: PatternLine[];
  notches: Notch[];
  marks: PatternMark[];
  folds: PatternLine[];
  grain: { from: Vec; to: Vec };
  areaMm2: number;
};

export type HideLine = { leather: string; netDm2: number; withWastageDm2: number; squareFeet: number };
export type ThreadLine = { thread: string; stitchedMm: number; lengthM: number };

export type Pattern = {
  reference: string;
  name: string;
  product: string;
  depthMm: number;
  metal: string;
  lining: string;
  closure: string;
  seamAllowanceMm: number;
  wastage: number;
  pieces: PatternPiece[];
  hide: HideLine[];
  totalNetDm2: number;
  totalWithWastageDm2: number;
  hardware: { name: string; quantity: number; metal: string }[];
  thread: ThreadLine[];
  surface: string[];
  notes: string[];
  findings: Finding[];
};

type Draft = Omit<PatternPiece, "code" | "width" | "height">;

const leatherName = (piece: BespokePiece) => `${COLORS[piece.color].name} ${FINISHES[piece.finish].name.toLowerCase()}`;
const leatherKey = (piece: BespokePiece) => `${piece.finish}|${piece.color}`;
const threadName = (piece: BespokePiece) => (piece.thread === "self" ? `${THREADS.self.name}, ${COLORS[piece.color].name}` : THREADS[piece.thread].name);

const codeFor = (index: number): string => (index < 26 ? String.fromCharCode(65 + index) : `${codeFor(Math.floor(index / 26) - 1)}${codeFor(index % 26)}`);

function clockwise(outline: Vec[]) {
  return signedArea(outline) >= 0 ? outline : [...outline].reverse();
}

function turnAt(ring: Vec[], index: number) {
  const count = ring.length;
  const a = ring[(index - 1 + count) % count]!;
  const b = ring[index]!;
  const c = ring[(index + 1) % count]!;
  const first = Math.atan2(b.y - a.y, b.x - a.x);
  const second = Math.atan2(c.y - b.y, c.x - b.x);
  return (((second - first + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (180 / Math.PI);
}

function arcPositions(ring: Vec[]) {
  const positions = [0];
  for (let i = 1; i < ring.length; i++) positions.push(positions[i - 1]! + Math.hypot(ring[i]!.x - ring[i - 1]!.x, ring[i]!.y - ring[i - 1]!.y));
  return positions;
}

function afterLongestEdge(ring: Vec[]) {
  let best = 0;
  let longest = -1;
  ring.forEach((point, i) => {
    const next = ring[(i + 1) % ring.length]!;
    const span = Math.hypot(next.x - point.x, next.y - point.y);
    if (span > longest) {
      longest = span;
      best = i;
    }
  });
  return (best + 1) % ring.length;
}

export function cornerIndexes(ring: Vec[], degrees: number = PATTERN.cornerTurnDegrees) {
  const count = ring.length;
  const start = afterLongestEdge(ring);
  const found: number[] = [];
  let bend: { index: number; turn: number }[] = [];
  const settle = () => {
    const total = bend.reduce((sum, item) => sum + Math.abs(item.turn), 0);
    const stops = Math.floor(total / degrees);
    let walked = 0;
    let stop = 0;
    for (const item of bend) {
      walked += Math.abs(item.turn);
      while (stop < stops && walked >= ((stop + 0.5) / stops) * total) {
        found.push(item.index);
        stop++;
      }
    }
    bend = [];
  };
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const turn = turnAt(ring, index);
    if (Math.abs(turn) < MIN_TURN_DEGREES || (bend.length && Math.sign(turn) !== Math.sign(bend[0]!.turn))) settle();
    if (Math.abs(turn) >= MIN_TURN_DEGREES) bend.push({ index, turn });
  }
  settle();
  return [...new Set(found)].sort((a, b) => a - b);
}

function outwardAt(ring: Vec[], index: number) {
  const count = ring.length;
  const a = ring[(index - 1 + count) % count]!;
  const b = ring[(index + 1) % count]!;
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
}

function nearestOn(ring: Vec[], point: Vec) {
  let best = { at: ring[0]!, normal: outwardAt(ring, 0), gap: Infinity };
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return;
    const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    const at = { x: a.x + dx * t, y: a.y + dy * t };
    const gap = Math.hypot(point.x - at.x, point.y - at.y);
    if (gap < best.gap) {
      const length = Math.sqrt(lengthSq);
      best = { at, normal: { x: dy / length, y: -dx / length }, gap };
    }
  });
  return best;
}

export type GussetRun = { name: string; length: number; corners: number[] };
export type BodyWall = { runs: GussetRun[]; top: number; perimeter: number };

const positionName = (points: Vec[], only: boolean) => {
  if (only) return "Gusset";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const length = Math.hypot(last.x - first.x, last.y - first.y) || 1;
  const nx = (last.y - first.y) / length;
  const ny = -(last.x - first.x) / length;
  if (ny > 0.7) return "Base panel";
  if (nx > 0.7) return "Right side panel";
  if (nx < -0.7) return "Left side panel";
  return "Side panel";
};

function topRange(ring: Vec[]) {
  const count = ring.length;
  const reach = Math.cos((PATTERN.openingNormalDegrees * Math.PI) / 180);
  const facesUp = ring.map((a, i) => {
    const b = ring[(i + 1) % count]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return -(b.x - a.x) / length <= -reach;
  });
  if (facesUp.every(Boolean) || !facesUp.some(Boolean)) return null;
  const start = facesUp.findIndex((up, i) => !up && facesUp[(i + 1) % count]);
  let best: { from: number; edges: number; length: number } | null = null;
  let run: { from: number; edges: number; length: number } | null = null;
  for (let step = 1; step <= count; step++) {
    const index = (start + step) % count;
    if (facesUp[index]) {
      const a = ring[index]!;
      const b = ring[(index + 1) % count]!;
      run = run ?? { from: index, edges: 0, length: 0 };
      run.edges++;
      run.length += Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || run.length > best.length) best = run;
    } else run = null;
  }
  return best;
}

export function unfoldWall(outline: Vec[]): BodyWall {
  const ring = clockwise(outline);
  const count = ring.length;
  const total = perimeter(ring);
  const range = topRange(ring);
  const startAt = range ? (range.from + range.edges) % count : ring.reduce((top, point, i) => (point.y < ring[top]!.y ? i : top), 0);
  const rotated = ring.map((_, i) => ring[(startAt + i) % count]!);
  const edges = count - (range?.edges ?? 0);
  const path = [...rotated.slice(0, edges), rotated[edges % count]!];
  const arcs = arcPositions(path);
  const wallLength = arcs[arcs.length - 1]!;
  const splits = path.flatMap((_, i) => (i > 0 && i < path.length - 1 && Math.abs(turnAt(rotated, i)) >= PATTERN.gussetSplitDegrees ? [i] : []));
  const bounds = [0, ...splits, path.length - 1];
  const corners = cornerIndexes(rotated).filter((index) => index > 0 && index < path.length - 1 && !splits.includes(index)).map((index) => arcs[index]!);
  const named = new Map<string, number>();
  const runs: GussetRun[] = bounds.slice(1).map((end, i) => {
    const begin = bounds[i]!;
    const base = positionName(path.slice(begin, end + 1), bounds.length === 2);
    const seen = (named.get(base) ?? 0) + 1;
    named.set(base, seen);
    return { name: seen > 1 ? `${base} ${seen}` : base, length: arcs[end]! - arcs[begin]!, corners: corners.filter((at) => at > arcs[begin]! && at < arcs[end]!).map((at) => at - arcs[begin]!) };
  });
  return { runs: wallLength > STRAIGHT_RUN ? runs : [], top: Math.max(0, total - wallLength), perimeter: total };
}

function stripDraft(source: BespokePiece, role: PatternRole, name: string, length: number, width: number, allowance: number, notchAt: number[], quantity = 1): Draft {
  const seam = [{ x: 0, y: 0 }, { x: length, y: 0 }, { x: length, y: width }, { x: 0, y: width }];
  const cut = [{ x: -allowance, y: -allowance }, { x: length + allowance, y: -allowance }, { x: length + allowance, y: width + allowance }, { x: -allowance, y: width + allowance }];
  const edges = (x: number, kind: Notch["kind"]): Notch[] => [{ at: { x, y: 0 }, normal: { x: 0, y: -1 }, kind }, { at: { x, y: width }, normal: { x: 0, y: 1 }, kind }];
  const inset = Math.min(STITCH_INSET_MM, width / 2);
  const stitches = source.stitched ? [inset, width - inset].map((y) => ({ points: [{ x: 0, y }, { x: length, y }], closed: false })) : [];
  const reach = Math.min(length * 0.25, PATTERN.grainArrowMaxMm / 2);
  return {
    pieceId: source.id,
    role,
    name,
    quantity,
    leather: leatherName(source),
    leatherKey: leatherKey(source),
    cut,
    cutHoles: [],
    seam,
    seamHoles: [],
    stitches,
    notches: [...edges(length / 2, "centre"), ...notchAt.flatMap((x) => edges(x, "corner"))],
    marks: [],
    folds: [],
    grain: { from: { x: length / 2 - reach, y: width / 2 }, to: { x: length / 2 + reach, y: width / 2 } },
    areaMm2: polygonArea(cut),
  };
}

function interiorPoint(ring: Vec[]) {
  const box = boundsOf(ring);
  const middle = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
  if (contains(ring, middle)) return { point: middle, span: box.height };
  const cross = edgeAt(ring, middle.x);
  if (cross) return { point: { x: middle.x, y: (cross.top + cross.bottom) / 2 }, span: cross.bottom - cross.top };
  return { point: ring[0]!, span: box.height };
}

function runLine(run: StitchRun, map: (point: Vec) => Vec): PatternLine {
  return { points: run.points.map(map), closed: run.ring };
}

function panelDraft(piece: BespokePiece, name: string, role: PatternRole, allowance: number, design: BespokeDesign, flip: boolean, extra: { notches: Notch[]; marks: PatternMark[] }): Draft {
  const map = (point: Vec) => (flip ? { x: -point.x, y: point.y } : { x: point.x, y: point.y });
  const seam = clockwise(outlineOf(piece).map(map));
  const sourceHoles = role === "back" ? [] : holeOutlines(piece, design.pieces);
  const seamHoles = sourceHoles.map((hole) => hole.map(map));
  const cut = offsetOutline(seam, allowance);
  const cutHoles = seamHoles.map((hole) => {
    const shrunk = offsetOutline(hole, -allowance);
    return shrunk.length >= 3 && polygonArea(shrunk) < polygonArea(hole) ? shrunk : hole;
  });
  const stitches = piece.stitched ? stitchRuns(outlineOf(piece), sourceHoles).map((run) => runLine(run, map)) : [];
  const notches: Notch[] = cornerIndexes(seam).map((index) => ({ at: seam[index]!, normal: outwardAt(seam, index), kind: "corner" }));
  if (piece.mirror) {
    const axis = flip ? -piece.axisX : piece.axisX;
    const cross = edgeAt(seam, axis);
    if (cross) for (const y of [cross.top, cross.bottom]) notches.push({ ...nearestOn(seam, { x: axis, y }), kind: "centre" });
  }
  const { point, span } = interiorPoint(seam);
  const reach = Math.min(span * 0.3, PATTERN.grainArrowMaxMm / 2);
  const folds = piece.fold && role !== "back" ? [{ points: [map({ x: piece.fold.ax, y: piece.fold.ay }), map({ x: piece.fold.bx, y: piece.fold.by })], closed: false }] : [];
  return {
    pieceId: piece.id,
    role,
    name,
    quantity: 1,
    leather: leatherName(piece),
    leatherKey: leatherKey(piece),
    cut,
    cutHoles,
    seam,
    seamHoles,
    stitches,
    notches: [...notches, ...extra.notches],
    marks: extra.marks,
    folds,
    grain: { from: { x: point.x, y: point.y - reach }, to: { x: point.x, y: point.y + reach } },
    areaMm2: Math.max(0, cutHoles.reduce((sum, hole) => sum - polygonArea(hole), polygonArea(cut))) * puffFactor(piece),
  };
}

function handleFeet(design: BespokeDesign, body: BespokePiece | null) {
  const feet = new Map<string, { notches: Notch[]; marks: PatternMark[] }>();
  const panels = design.pieces.filter(isSolidPanel);
  for (const tube of design.pieces.filter((piece) => piece.kind === "tube")) {
    const path = outlineOf(tube);
    for (const end of [path[0]!, path[path.length - 1]!]) {
      const onFace = panels.filter((panel) => panel.view === tube.view);
      const ranked = onFace
        .map((panel) => ({ panel, gap: contains(outlineOf(panel), end) ? 0 : distanceToLine(end, outlineOf(panel), true) }))
        .filter(({ gap }) => gap <= PATTERN.handleReachMm)
        .sort((a, b) => a.gap - b.gap || Number(b.panel === body) - Number(a.panel === body));
      const host = ranked.find(({ panel }) => panel === body && ranked[0]!.gap === 0 && contains(outlineOf(panel), end))?.panel ?? ranked[0]?.panel;
      if (!host) continue;
      const entry = feet.get(host.id) ?? { notches: [], marks: [] };
      const near = nearestOn(clockwise(outlineOf(host)), end);
      entry.notches.push({ at: near.at, normal: near.normal, kind: "handle" });
      entry.marks.push({ at: end, label: `${tube.name} end` });
      feet.set(host.id, entry);
    }
  }
  return feet;
}

function panelMarks(piece: BespokePiece) {
  const marks: PatternMark[] = piece.hardware.map((item) => ({ at: { x: item.x, y: item.y }, label: item.label || HARDWARE[item.kind].name }));
  if (piece.text) {
    const place = textPlacement(piece);
    marks.push({ at: { x: place.x, y: place.y }, label: `Text ${piece.text.value}` });
  }
  if (piece.logo) marks.push({ at: { x: piece.logo.x, y: piece.logo.y }, label: `Logo, ${LOGO_STYLES[piece.logo.style].toLowerCase()}` });
  return marks;
}

function normalize(draft: Draft, index: number): PatternPiece {
  const box = boundsOf(draft.cut);
  const move = (point: Vec) => ({ x: point.x - box.minX, y: point.y - box.minY });
  const line = (item: PatternLine) => ({ ...item, points: item.points.map(move) });
  return {
    ...draft,
    code: codeFor(index),
    width: box.width,
    height: box.height,
    cut: draft.cut.map(move),
    cutHoles: draft.cutHoles.map((hole) => hole.map(move)),
    seam: draft.seam.map(move),
    seamHoles: draft.seamHoles.map((hole) => hole.map(move)),
    stitches: draft.stitches.map(line),
    notches: draft.notches.map((notch) => ({ ...notch, at: move(notch.at) })),
    marks: draft.marks.map((mark) => ({ ...mark, at: move(mark.at) })),
    folds: draft.folds.map(line),
    grain: { from: move(draft.grain.from), to: move(draft.grain.to) },
  };
}

function threadLines(design: BespokeDesign, body: BespokePiece | null) {
  const totals = new Map<string, number>();
  const add = (piece: BespokePiece, length: number) => totals.set(threadName(piece), (totals.get(threadName(piece)) ?? 0) + length);
  for (const piece of design.pieces.filter((item) => item.stitched)) {
    if (piece.kind === "tube") add(piece, pathLength(outlineOf(piece)) * 2);
    else if (isSolidPanel(piece)) {
      const edge = perimeter(outlineOf(piece)) + holeOutlines(piece, design.pieces).reduce((sum, hole) => sum + perimeter(hole), 0);
      add(piece, piece === body && design.depth > 0 ? edge * 2 : edge);
    }
  }
  return [...totals].map(([thread, stitchedMm]): ThreadLine => ({ thread, stitchedMm, lengthM: (stitchedMm * PATTERN.threadPerStitchedMm) / 1000 }));
}

function hideLines(pieces: PatternPiece[], wastage: number) {
  const groups = new Map<string, { leather: string; area: number }>();
  for (const piece of pieces) {
    const entry = groups.get(piece.leatherKey) ?? { leather: piece.leather, area: 0 };
    entry.area += piece.areaMm2 * piece.quantity;
    groups.set(piece.leatherKey, entry);
  }
  return [...groups.values()].map(({ leather, area }): HideLine => {
    const netDm2 = area / MM2_PER_DM2;
    return { leather, netDm2, withWastageDm2: netDm2 * wastage, squareFeet: netDm2 * wastage * PATTERN.squareFeetPerDm2 };
  });
}

function wantsTopBand(design: BespokeDesign, body: BespokePiece) {
  return OPEN_TOP_MATCH.test(design.closure) || body.hardware.some((item) => item.kind === "zip" && item.y < (boundsOf(outlineOf(body)).minY + boundsOf(outlineOf(body)).maxY) / 2);
}

export function buildPattern(source: BespokeDesign, options: { reference?: string; seamAllowanceMm?: number } = {}): Pattern {
  const design = visibleDesign(source);
  const allowance = options.seamAllowanceMm ?? SEAM_ALLOWANCE_MM;
  const body = bodyOf(design);
  const feet = handleFeet(design, body);
  const extraFor = (piece: BespokePiece) => ({ notches: feet.get(piece.id)?.notches ?? [], marks: [...panelMarks(piece), ...(feet.get(piece.id)?.marks ?? [])] });
  const label = (piece: BespokePiece) => (piece.view === "front" ? piece.name : `${piece.name}, ${VIEWS[piece.view].toLowerCase()}`);
  const drafts: Draft[] = [];
  const notes: string[] = [];

  if (body) {
    const walled = design.depth > 0;
    drafts.push(panelDraft(body, walled ? `${body.name}, front` : body.name, "panel", allowance, design, false, extraFor(body)));
    if (walled) {
      drafts.push(panelDraft(body, `${body.name}, back`, "back", allowance, design, true, { notches: [], marks: [] }));
      const wall = unfoldWall(outlineOf(body));
      for (const run of wall.runs) drafts.push(stripDraft(body, "gusset", `${run.name}, ${body.name}`.slice(0, 60), run.length, design.depth, allowance, run.corners));
      if (wall.top > 0 && wantsTopBand(design, body)) drafts.push(stripDraft(body, "top", `Top band, ${body.name}`.slice(0, 60), wall.top, design.depth, allowance, []));
      else if (wall.top > 0) notes.push(`The top edge is left open, so no top band is cut. Add a band ${Math.round(wall.top)} x ${design.depth} mm if the workshop closes it.`);
    }
  }
  for (const piece of layerOrder(design.pieces)) {
    if (piece === body || piece.holeOf) continue;
    if (isSolidPanel(piece)) drafts.push(panelDraft(piece, label(piece), "panel", allowance, design, false, extraFor(piece)));
    if (piece.kind === "tube") {
      const length = pathLength(outlineOf(piece));
      drafts.push(stripDraft(piece, "strip", label(piece), length, piece.tubeWidth * PATTERN.tubeWrap, allowance, []));
    }
  }

  const pieces = drafts.map(normalize);
  if (design.pieces.some((piece) => piece.kind === "tube")) notes.push(`Handle and strap strips are ${PATTERN.tubeWrap} times the finished width, an estimate for the wrap. One strip is drawn per path on the board.`);
  for (const piece of design.pieces.filter((item) => item.puff)) notes.push(`${piece.name} is puffed ${piece.puff} mm. The pattern shows the flat outline and the area allows for the extra leather. The workshop sets the fullness.`);
  for (const piece of design.pieces.filter((item) => item.fold)) notes.push(`${piece.name} folds ${piece.fold!.angle} degrees along the dashed blue line.`);
  if (body) notes.push(`Lining in ${COLORS[design.lining].name} is not drawn. The workshop cuts it from the body and gusset pieces.`);

  const hide = hideLines(pieces, HIDE_WASTAGE);
  const totalNetDm2 = hide.reduce((sum, line) => sum + line.netDm2, 0);
  return {
    reference: options.reference ?? "Draft",
    name: design.name,
    product: PRODUCT_TYPES[design.productType],
    depthMm: design.depth,
    metal: METALS[design.metal].name,
    lining: COLORS[design.lining].name,
    closure: design.closure,
    seamAllowanceMm: allowance,
    wastage: HIDE_WASTAGE,
    pieces,
    hide,
    totalNetDm2,
    totalWithWastageDm2: totalNetDm2 * HIDE_WASTAGE,
    hardware: hardwareList(design).map((item) => ({ name: item.name, quantity: item.quantity, metal: METALS[design.metal].name })),
    thread: threadLines(design, body),
    surface: design.pieces.filter((piece) => piece.text).map((piece) => `${piece.name}: ${piece.text!.value}, ${TEXT_TECHNIQUES[piece.text!.technique].toLowerCase()}`),
    notes,
    findings: checkDesign(design),
  };
}
