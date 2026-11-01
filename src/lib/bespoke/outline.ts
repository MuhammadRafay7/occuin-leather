import { AXIS_TOLERANCE_MM, LIMITS, type BespokeDesign, type BespokePiece, type BespokePoint } from "./design";

export type Vec = { x: number; y: number };
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
export type FullPoint = BespokePoint & { source: number; flipped: boolean };
export type Cubic = { a: Vec; c1: Vec; c2: Vec; b: Vec };
export type StitchRun = { points: Vec[]; ring: boolean };

export const STARTERS = {
  rectangle: "Rectangle",
  rounded: "Rounded",
  circle: "Circle",
  trapezoid: "Trapezoid",
  semicircle: "Semicircle",
} as const;
export type StarterKind = keyof typeof STARTERS;

export const STITCH_INSET_MM = 4;
export const STITCH_PITCH_MM = 4;
export const PUFF_REACH_MM = 55;
const SAMPLE_MM = 4;
const MIN_SEGMENT_MM = 0.02;

const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const round = (value: number) => Math.round(value * 10) / 10;

type Mirrored = Pick<BespokePiece, "points" | "mirror" | "axisX">;

export function fullPoints(piece: Mirrored): FullPoint[] {
  const front = piece.points.map((point, source) => ({ ...point, source, flipped: false }));
  if (!piece.mirror) return front;
  const back: FullPoint[] = [];
  for (let source = piece.points.length - 1; source >= 0; source--) {
    const point = piece.points[source]!;
    if (Math.abs(point.x - piece.axisX) > AXIS_TOLERANCE_MM) back.push({ ...point, x: 2 * piece.axisX - point.x, source, flipped: true });
  }
  return [...front, ...back];
}

function handle(from: Vec, toward: Vec, span: number) {
  const dx = toward.x / 6;
  const dy = toward.y / 6;
  const length = Math.hypot(dx, dy);
  const limit = span * 0.5;
  const scale = length > limit && length > 0 ? limit / length : 1;
  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

export function cubics(points: BespokePoint[], closed: boolean): Cubic[] {
  const count = points.length;
  const result: Cubic[] = [];
  const last = closed ? count : count - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % count]!;
    const before = closed ? points[(i - 1 + count) % count]! : points[Math.max(0, i - 1)]!;
    const after = closed ? points[(i + 2) % count]! : points[Math.min(count - 1, i + 2)]!;
    const span = distance(a, b);
    const c1 = a.smooth ? handle(a, { x: b.x - before.x, y: b.y - before.y }, span) : { x: a.x, y: a.y };
    const c2 = b.smooth ? handle(b, { x: a.x - after.x, y: a.y - after.y }, span) : { x: b.x, y: b.y };
    result.push({ a, c1, c2, b });
  }
  return result;
}

const isStraight = ({ a, c1, c2, b }: Cubic) => a.x === c1.x && a.y === c1.y && b.x === c2.x && b.y === c2.y;

function pointOn({ a, c1, c2, b }: Cubic, t: number): Vec {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return { x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x, y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y };
}

function sampleCount(curve: Cubic) {
  if (isStraight(curve)) return 1;
  const reach = distance(curve.a, curve.c1) + distance(curve.c1, curve.c2) + distance(curve.c2, curve.b);
  return Math.min(24, Math.max(4, Math.ceil(reach / SAMPLE_MM)));
}

function flattenPoints(points: BespokePoint[], closed: boolean) {
  const result: Vec[] = [];
  const push = (point: Vec) => {
    const previous = result[result.length - 1];
    if (!previous || distance(previous, point) > MIN_SEGMENT_MM) result.push(point);
  };
  const curves = cubics(points, closed);
  if (!curves.length) return points.map(({ x, y }) => ({ x, y }));
  for (const curve of curves) {
    const steps = sampleCount(curve);
    for (let step = 0; step < steps; step++) push(pointOn(curve, step / steps));
  }
  if (!closed) push(curves[curves.length - 1]!.b);
  const first = result[0]!;
  if (closed && result.length > 1 && distance(first, result[result.length - 1]!) <= MIN_SEGMENT_MM) result.pop();
  return result;
}

const outlineCache = new WeakMap<object, Vec[]>();

export const outlineFrom = (points: BespokePoint[], mirror: boolean, closed: boolean, axisX = 0) => flattenPoints(fullPoints({ points, mirror, axisX }), closed);

export function outlineOf(piece: BespokePiece) {
  const cached = outlineCache.get(piece);
  if (cached) return cached;
  const outline = outlineFrom(piece.points, piece.mirror, piece.closed, piece.axisX);
  outlineCache.set(piece, outline);
  return outline;
}

const fixed = (value: number) => Number(value.toFixed(2));

export function pathData(points: BespokePoint[], closed: boolean) {
  const curves = cubics(points, closed);
  if (!curves.length) return points.length ? `M${fixed(points[0]!.x)} ${fixed(points[0]!.y)}` : "";
  const parts = [`M${fixed(curves[0]!.a.x)} ${fixed(curves[0]!.a.y)}`];
  for (const curve of curves) {
    parts.push(isStraight(curve) ? `L${fixed(curve.b.x)} ${fixed(curve.b.y)}` : `C${fixed(curve.c1.x)} ${fixed(curve.c1.y)} ${fixed(curve.c2.x)} ${fixed(curve.c2.y)} ${fixed(curve.b.x)} ${fixed(curve.b.y)}`);
  }
  if (closed) parts.push("Z");
  return parts.join(" ");
}

export function piecePath(piece: BespokePiece) {
  return pathData(fullPoints(piece), piece.closed);
}

export function polygonArea(polygon: Vec[]) {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

export function perimeter(polygon: Vec[]) {
  let total = 0;
  for (let i = 0; i < polygon.length; i++) total += distance(polygon[i]!, polygon[(i + 1) % polygon.length]!);
  return total;
}

export function boundsOf(points: Vec[]): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { x, y } of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

export function contains(polygon: Vec[], point: Vec) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function distanceToOutline(point: Vec, outline: Vec[], closed = true) {
  let nearest = Infinity;
  const last = closed ? outline.length : outline.length - 1;
  for (let i = 0; i < last; i++) nearest = Math.min(nearest, distanceToSegment(point, outline[i]!, outline[(i + 1) % outline.length]!));
  return nearest;
}

export function nearOutline(piece: BespokePiece, point: Vec, tolerance: number) {
  const reach = piece.kind === "tube" ? tolerance + piece.tubeWidth / 2 : tolerance;
  return distanceToOutline(point, outlineOf(piece), piece.closed) <= reach;
}

function resample(outline: Vec[], step: number) {
  const total = perimeter(outline);
  const count = Math.floor(total / step);
  if (count < 3) return [];
  const spacing = total / count;
  const result: Vec[] = [];
  let walked = 0;
  let index = 0;
  let span = distance(outline[0]!, outline[1 % outline.length]!);
  for (let i = 0; i < count; i++) {
    const target = i * spacing;
    while (walked + span < target && index < outline.length - 1) {
      walked += span;
      index++;
      span = distance(outline[index]!, outline[(index + 1) % outline.length]!);
    }
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    const t = span ? (target - walked) / span : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

function signedArea(polygon: Vec[]) {
  let twice = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

export function offsetInward(outline: Vec[], inset: number) {
  const turn = signedArea(outline) > 0 ? 1 : -1;
  const count = outline.length;
  const normal = (a: Vec, b: Vec) => {
    const length = distance(a, b) || 1;
    return { x: (-turn * (b.y - a.y)) / length, y: (turn * (b.x - a.x)) / length };
  };
  return outline.map((point, i) => {
    const before = normal(outline[(i - 1 + count) % count]!, point);
    const after = normal(point, outline[(i + 1) % count]!);
    const mx = before.x + after.x;
    const my = before.y + after.y;
    const length = Math.hypot(mx, my) || 1;
    const nx = mx / length;
    const ny = my / length;
    const reach = inset / Math.max(nx * after.x + ny * after.y, 0.5);
    return { x: point.x + nx * reach, y: point.y + ny * reach };
  });
}

function runsFrom(placed: (Vec | null)[]) {
  const kept = placed.filter(Boolean).length;
  if (kept === placed.length) return kept ? [{ points: placed as Vec[], ring: true }] : [];
  if (kept < 2) return [];
  const gap = placed.findIndex((point) => !point);
  const runs: StitchRun[] = [];
  let run: Vec[] = [];
  for (let i = 1; i <= placed.length; i++) {
    const point = placed[(gap + i) % placed.length];
    if (point) {
      run.push(point);
      continue;
    }
    if (run.length >= 2) runs.push({ points: run, ring: false });
    run = [];
  }
  return runs;
}

export function stitchRuns(outline: Vec[], holes: Vec[][] = [], inset = STITCH_INSET_MM, pitch = STITCH_PITCH_MM): StitchRun[] {
  if (outline.length < 3) return [];
  const clear = inset * 0.8;
  const onLeather = (point: Vec) =>
    contains(outline, point) &&
    distanceToOutline(point, outline) >= clear &&
    holes.every((hole) => !contains(hole, point) && distanceToOutline(point, hole) >= clear);
  const lines = [offsetInward(outline, inset), ...holes.map((hole) => offsetInward(hole, -inset))];
  return lines.flatMap((line) => runsFrom(resample(line, pitch).map((point) => (onLeather(point) ? point : null))));
}

export function offsetPath(path: Vec[], distanceMm: number) {
  return path.map((point, i) => {
    const before = path[Math.max(0, i - 1)]!;
    const after = path[Math.min(path.length - 1, i + 1)]!;
    const length = distance(before, after) || 1;
    return { x: point.x - ((after.y - before.y) / length) * distanceMm, y: point.y + ((after.x - before.x) / length) * distanceMm };
  });
}

export function pathLength(path: Vec[]) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distance(path[i - 1]!, path[i]!);
  return total;
}

export function samplePath(path: Vec[], pitch: number) {
  const total = pathLength(path);
  const count = Math.max(1, Math.round(total / pitch));
  const result: Vec[] = [];
  let walked = 0;
  let index = 0;
  for (let i = 0; i <= count; i++) {
    const target = (i / count) * total;
    while (index < path.length - 2 && walked + distance(path[index]!, path[index + 1]!) < target) {
      walked += distance(path[index]!, path[index + 1]!);
      index++;
    }
    const a = path[index]!;
    const b = path[index + 1] ?? a;
    const span = distance(a, b);
    const t = span ? Math.min(1, (target - walked) / span) : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

const orientation = (a: Vec, b: Vec, c: Vec) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

export function crossesItself(outline: Vec[], sampled = false) {
  const stride = sampled ? Math.max(1, Math.ceil(outline.length / 220)) : 1;
  const ring = outline.filter((_, index) => index % stride === 0);
  const count = ring.length;
  for (let i = 0; i < count; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % count]!;
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      const c = ring[j]!;
      const d = ring[(j + 1) % count]!;
      if (orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0) return true;
    }
  }
  return false;
}

export function nearestEdge(piece: BespokePiece, point: Vec) {
  const full = fullPoints(piece);
  let best: { edge: number; distance: number; at: Vec; curved: boolean } | null = null;
  cubics(full, piece.closed).forEach((curve, edge) => {
    const steps = Math.max(sampleCount(curve), 8);
    for (let step = 0; step <= steps; step++) {
      const at = pointOn(curve, step / steps);
      const gap = distance(at, point);
      if (!best || gap < best.distance) best = { edge, distance: gap, at, curved: !isStraight(curve) };
    }
  });
  return best as { edge: number; distance: number; at: Vec; curved: boolean } | null;
}

export function insertOnEdge(piece: BespokePiece, edge: number, at: Vec, smooth: boolean): { points: BespokePoint[]; index: number } {
  const full = fullPoints(piece);
  const a = full[edge]!;
  const b = full[(edge + 1) % full.length]!;
  let index = edge + 1;
  if (piece.mirror) {
    if (a.source !== b.source) index = Math.max(a.source, b.source);
    else index = a.flipped ? a.source : a.source + 1;
  }
  const point = { x: piece.mirror ? piece.axisX + Math.abs(at.x - piece.axisX) : at.x, y: at.y, smooth };
  const points = [...piece.points.slice(0, index), { ...point, x: round(point.x), y: round(point.y) }, ...piece.points.slice(index)];
  return { points, index };
}

function axisCrossing(a: BespokePoint, b: BespokePoint): BespokePoint {
  const t = a.x / (a.x - b.x);
  return { x: 0, y: round(a.y + (b.y - a.y) * t), smooth: a.smooth && b.smooth };
}

export function halfChain(points: BespokePoint[], axis = 0): BespokePoint[] {
  const local = points.map((point) => ({ ...point, x: point.x - axis }));
  const rightward = local.reduce((sum, point) => sum + Math.max(0, point.x), 0);
  const leftward = local.reduce((sum, point) => sum + Math.max(0, -point.x), 0);
  const ring = rightward >= leftward ? local : local.map((point) => ({ ...point, x: -point.x }));
  const split: BespokePoint[] = [];
  ring.forEach((point, i) => {
    const next = ring[(i + 1) % ring.length]!;
    split.push(point);
    if (point.x * next.x < 0) split.push(axisCrossing(point, next));
  });
  const start = split.findIndex((point, i) => {
    const before = split[(i - 1 + split.length) % split.length]!;
    return point.x >= -AXIS_TOLERANCE_MM && before.x < -AXIS_TOLERANCE_MM;
  });
  const back = (point: BespokePoint) => ({ ...point, x: round(axis + Math.max(0, point.x)) });
  if (start < 0) return split.map((point) => ({ ...point, x: axis + Math.abs(point.x) }));
  const rotated = [...split.slice(start), ...split.slice(0, start)];
  const end = rotated.findIndex((point) => point.x < -AXIS_TOLERANCE_MM);
  return (end < 0 ? rotated : rotated.slice(0, end)).map(back);
}

export function bakeMirror(piece: Mirrored): BespokePoint[] {
  return fullPoints(piece).map(({ x, y, smooth }) => ({ x, y, smooth }));
}

export function starterPoints(kind: StarterKind, width: number, height: number): BespokePoint[] {
  const w = width / 2;
  const h = height / 2;
  const sharp = (x: number, y: number): BespokePoint => ({ x: round(x), y: round(y), smooth: false });
  const curve = (x: number, y: number): BespokePoint => ({ x: round(x), y: round(y), smooth: true });
  if (kind === "rectangle") return [sharp(-w, -h), sharp(w, -h), sharp(w, h), sharp(-w, h)];
  if (kind === "trapezoid") return [sharp(-w * 0.72, -h), sharp(w * 0.72, -h), sharp(w, h), sharp(-w, h)];
  if (kind === "circle") {
    const radius = Math.min(w, h);
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      return curve(Math.cos(angle) * radius, Math.sin(angle) * radius);
    });
  }
  if (kind === "semicircle") {
    const arc = Array.from({ length: 7 }, (_, i) => {
      const angle = Math.PI + (i / 8) * Math.PI + Math.PI / 8;
      return curve(Math.cos(angle) * w, h + Math.sin(angle) * height);
    });
    return [sharp(-w, h), ...arc, sharp(w, h)];
  }
  const radius = Math.min(w, h) * 0.3;
  const corner = (cx: number, cy: number, start: number) =>
    [0, 1, 2].map((step) => {
      const angle = start + (step * Math.PI) / 4;
      return curve(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    });
  return [
    ...corner(w - radius, -h + radius, -Math.PI / 2),
    ...corner(w - radius, h - radius, 0),
    ...corner(-w + radius, h - radius, Math.PI / 2),
    ...corner(-w + radius, -h + radius, Math.PI),
  ];
}

export function layerOrder(pieces: BespokePiece[]) {
  return pieces
    .map((piece, index) => ({ piece, index }))
    .sort((a, b) => a.piece.stack - b.piece.stack || a.index - b.index)
    .map(({ piece }) => piece);
}

export const isSolidPanel = (piece: BespokePiece) => piece.kind === "panel" && piece.closed && !piece.holeOf;

export function holesFor(piece: BespokePiece, pieces: BespokePiece[]) {
  return pieces.filter((item) => item.holeOf === piece.id && item.closed && item.visible);
}

export function holeOutlines(piece: BespokePiece, pieces: BespokePiece[]) {
  return holesFor(piece, pieces).map((hole) => outlineOf(hole));
}

export function puffFactor(piece: BespokePiece) {
  if (!piece.puff) return 1;
  const box = boundsOf(outlineOf(piece));
  const reach = Math.max(1, Math.min(PUFF_REACH_MM, Math.min(box.width, box.height) / 2));
  return 1 + Math.min(0.6, 0.5 * (piece.puff / reach) ** 2);
}

export function netArea(piece: BespokePiece, pieces: BespokePiece[]) {
  const area = polygonArea(outlineOf(piece));
  return Math.max(0, holeOutlines(piece, pieces).reduce((sum, hole) => sum - polygonArea(hole), area)) * puffFactor(piece);
}

export function parentAt(pieces: BespokePiece[], hole: BespokePiece) {
  const center = boundsOf(outlineOf(hole));
  const point = { x: (center.minX + center.maxX) / 2, y: (center.minY + center.maxY) / 2 };
  const ordered = layerOrder(pieces.filter((piece) => piece.view === hole.view));
  const below = ordered.slice(0, ordered.indexOf(hole)).reverse();
  return [...below, ...ordered.slice(ordered.indexOf(hole) + 1)].find((piece) => isSolidPanel(piece) && contains(outlineOf(piece), point)) ?? null;
}

export function pieceBounds(piece: BespokePiece): Bounds {
  const box = boundsOf(outlineOf(piece));
  if (piece.kind !== "tube") return box;
  const half = piece.tubeWidth / 2;
  return { minX: box.minX - half, maxX: box.maxX + half, minY: box.minY - half, maxY: box.maxY + half, width: box.width + half * 2, height: box.height + half * 2 };
}

export function groupBounds(pieces: BespokePiece[]) {
  const boxes = pieces.map(pieceBounds);
  const minX = Math.min(...boxes.map((box) => box.minX));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxY = Math.max(...boxes.map((box) => box.maxY));
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

type Transform = (point: Vec) => Vec;

export function mapPiece(piece: BespokePiece, transform: Transform, flipsWinding = false, spinDegrees = 0): BespokePiece {
  const source = piece.mirror ? bakeMirror(piece) : piece.points;
  const keep = (point: Vec) => {
    const moved = clampToBoard(transform(point));
    return { x: round(moved.x), y: round(moved.y) };
  };
  const points = source.map((point) => ({ ...point, ...keep(point) }));
  const hardware = piece.hardware.map((item) => ({ ...item, ...keep(item), rotation: ((item.rotation + spinDegrees + 540) % 360) - 180 }));
  let fold = piece.fold;
  if (fold) {
    const a = keep({ x: fold.ax, y: fold.ay });
    const b = keep({ x: fold.bx, y: fold.by });
    fold = { ...fold, ax: a.x, ay: a.y, bx: b.x, by: b.y };
  }
  return { ...piece, mirror: false, points: flipsWinding ? [...points].reverse() : points, hardware, fold };
}

export const translation = (dx: number, dy: number): Transform => ({ x, y }) => ({ x: x + dx, y: y + dy });

export const rotation = (center: Vec, radians: number): Transform => {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return ({ x, y }) => ({ x: center.x + (x - center.x) * cos - (y - center.y) * sin, y: center.y + (x - center.x) * sin + (y - center.y) * cos });
};

export const scaling = (center: Vec, sx: number, sy: number): Transform => ({ x, y }) => ({ x: center.x + (x - center.x) * sx, y: center.y + (y - center.y) * sy });

export const reflection = (a: Vec, b: Vec): Transform => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy || 1;
  return ({ x, y }) => {
    const t = ((x - a.x) * dx + (y - a.y) * dy) / lengthSq;
    const footX = a.x + t * dx;
    const footY = a.y + t * dy;
    return { x: 2 * footX - x, y: 2 * footY - y };
  };
};

export function bodyOf(design: Pick<BespokeDesign, "bodyId" | "pieces">) {
  const closed = design.pieces.filter((piece) => isSolidPanel(piece) && piece.visible && piece.view === "front");
  const chosen = closed.find((piece) => piece.id === design.bodyId);
  if (chosen) return chosen;
  let largest: BespokePiece | null = null;
  let area = -1;
  for (const piece of closed) {
    const size = polygonArea(outlineOf(piece));
    if (size > area) {
      largest = piece;
      area = size;
    }
  }
  return largest;
}

export function clampToBoard(point: Vec): Vec {
  return {
    x: Math.min(LIMITS.halfWidthMm, Math.max(-LIMITS.halfWidthMm, point.x)),
    y: Math.min(LIMITS.halfHeightMm, Math.max(-LIMITS.halfHeightMm, point.y)),
  };
}

export function edgeAt(outline: Vec[], x: number) {
  const crossings: number[] = [];
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    if (a.x <= x !== b.x <= x) crossings.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
  });
  return crossings.length ? { top: Math.min(...crossings), bottom: Math.max(...crossings) } : null;
}

export function compoundPath(piece: BespokePiece, pieces: BespokePiece[]) {
  return [piecePath(piece), ...holesFor(piece, pieces).map(piecePath)].join(" ");
}

export function textPlacement(piece: BespokePiece) {
  const box = boundsOf(outlineOf(piece));
  const length = Math.max(1, piece.text?.value.length ?? 1);
  const size = Math.min(48, Math.max(6, Math.min(box.height * 0.2, (box.width * 1.3) / length)));
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  if (piece.textPlace === "top") return { x: cx, y: box.minY + box.height * 0.22, size };
  if (piece.textPlace === "bottom") return { x: cx, y: box.maxY - box.height * 0.2, size };
  if (piece.textPlace === "corner") return { x: box.maxX - box.width * 0.2, y: box.maxY - box.height * 0.16, size: size * 0.7 };
  return { x: cx, y: cy, size };
}
