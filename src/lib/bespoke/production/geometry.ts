import { cubics, fullPoints, perimeter, polygonArea, contains, boundsOf, type Cubic, type Vec } from "../outline";
import type { BespokePiece } from "../design";

const MITRE_MIN_COS = 0.5;
const CROSSING_PASSES = 200;
const NECK_SAMPLES = 120;
const NECK_ARC_RATIO = 3.2;
const GAP_SAMPLES = 64;
const CURVE_STEP_MM = 1;
const CURVE_WINDOW_MM = 4;
const MAX_CURVE_SAMPLES = 400;

const gap = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function signedArea(ring: Vec[]) {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}

const dedupe = (ring: Vec[]) => ring.filter((point, i) => gap(point, ring[(i + 1) % ring.length]!) > 1e-6);

function crossing(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (!denominator) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function firstCrossing(ring: Vec[], from: number) {
  const count = ring.length;
  for (let i = from; i < count; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % count]!;
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    for (let j = i + 2; j < count; j++) {
      if (i === 0 && j === count - 1) continue;
      const c = ring[j]!;
      const d = ring[(j + 1) % count]!;
      if (Math.max(c.x, d.x) < minX || Math.min(c.x, d.x) > maxX || Math.max(c.y, d.y) < minY || Math.min(c.y, d.y) > maxY) continue;
      const at = crossing(a, b, c, d);
      if (at) return { i, j, at };
    }
  }
  return null;
}

function dropLoops(source: Vec[]) {
  let ring = source;
  let from = 0;
  for (let pass = 0; pass < CROSSING_PASSES; pass++) {
    const found = firstCrossing(ring, from);
    if (!found) break;
    const { i, j, at } = found;
    const loop = [at, ...ring.slice(i + 1, j + 1)];
    const rest = [...ring.slice(0, i + 1), at, ...ring.slice(j + 1)];
    const keepRest = polygonArea(rest) >= polygonArea(loop);
    ring = keepRest ? rest : loop;
    from = keepRest ? Math.max(0, i - 1) : 0;
  }
  return ring;
}

export function offsetOutline(outline: Vec[], distance: number) {
  const ring = dedupe(outline);
  if (!distance || ring.length < 3) return ring;
  const turn = signedArea(ring) >= 0 ? 1 : -1;
  const count = ring.length;
  const normal = (a: Vec, b: Vec) => {
    const length = gap(a, b);
    return { x: (turn * (b.y - a.y)) / length, y: (-turn * (b.x - a.x)) / length };
  };
  const moved: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const point = ring[i]!;
    const before = normal(ring[(i - 1 + count) % count]!, point);
    const after = normal(point, ring[(i + 1) % count]!);
    const mx = before.x + after.x;
    const my = before.y + after.y;
    const length = Math.hypot(mx, my);
    const cos = length ? (mx / length) * after.x + (my / length) * after.y : 0;
    if (cos >= MITRE_MIN_COS) {
      moved.push({ x: point.x + ((mx / length) * distance) / cos, y: point.y + ((my / length) * distance) / cos });
    } else {
      moved.push({ x: point.x + before.x * distance, y: point.y + before.y * distance }, { x: point.x + after.x * distance, y: point.y + after.y * distance });
    }
  }
  return dropLoops(moved);
}

export function resampleRing(ring: Vec[], count: number) {
  const total = perimeter(ring);
  const result: Vec[] = [];
  let walked = 0;
  let index = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * total;
    let span = gap(ring[index]!, ring[(index + 1) % ring.length]!);
    while (walked + span < target && index < ring.length - 1) {
      walked += span;
      index++;
      span = gap(ring[index]!, ring[(index + 1) % ring.length]!);
    }
    const a = ring[index]!;
    const b = ring[(index + 1) % ring.length]!;
    const t = span ? (target - walked) / span : 0;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

export function equivalentWidth(ring: Vec[]) {
  const area = polygonArea(ring);
  const edge = perimeter(ring);
  const root = edge * edge - 16 * area;
  return root > 0 ? (edge - Math.sqrt(root)) / 4 : Math.sqrt(area);
}

export function narrowestNeck(ring: Vec[]) {
  const total = perimeter(ring);
  const count = NECK_SAMPLES;
  const samples = resampleRing(ring, count);
  const spacing = total / count;
  let narrowest = Infinity;
  for (let i = 0; i < count; i++) {
    for (let j = i + 2; j < count; j++) {
      const across = gap(samples[i]!, samples[j]!);
      if (across >= narrowest) continue;
      const steps = j - i;
      const arc = Math.min(steps, count - steps) * spacing;
      if (arc < across * NECK_ARC_RATIO) continue;
      const middle = { x: (samples[i]!.x + samples[j]!.x) / 2, y: (samples[i]!.y + samples[j]!.y) / 2 };
      if (contains(ring, middle)) narrowest = across;
    }
  }
  return narrowest;
}

export const narrowestWidth = (ring: Vec[]) => Math.min(equivalentWidth(ring), narrowestNeck(ring));

function bezier({ a, c1, c2, b }: Cubic, t: number): Vec {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return { x: w0 * a.x + w1 * c1.x + w2 * c2.x + w3 * b.x, y: w0 * a.y + w1 * c1.y + w2 * c2.y + w3 * b.y };
}

function circumradius(a: Vec, b: Vec, c: Vec) {
  const twice = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return twice < 1e-9 ? Infinity : (gap(a, b) * gap(b, c) * gap(c, a)) / (2 * twice);
}

export function tightestCurveRadius(piece: BespokePiece) {
  const full = fullPoints(piece);
  const curves = cubics(full, piece.closed);
  if (!curves.length) return Infinity;
  const starts = full.flatMap((point, i) => (point.smooth ? [] : [i]));
  const first = starts[0] ?? 0;
  let tightest = Infinity;
  let run: Vec[] = [];
  const settle = () => {
    const stride = Math.max(1, Math.round(CURVE_WINDOW_MM / CURVE_STEP_MM));
    for (let i = stride; i < run.length - stride; i++) tightest = Math.min(tightest, circumradius(run[i - stride]!, run[i]!, run[i + stride]!));
    run = [];
  };
  for (let index = 0; index < curves.length; index++) {
    const edge = (first + index) % curves.length;
    const curve = curves[edge]!;
    if (!full[edge]!.smooth) settle();
    const reach = gap(curve.a, curve.c1) + gap(curve.c1, curve.c2) + gap(curve.c2, curve.b);
    const steps = Math.min(MAX_CURVE_SAMPLES, Math.max(4, Math.ceil(reach / CURVE_STEP_MM)));
    for (let step = 0; step < steps; step++) run.push(bezier(curve, step / steps));
  }
  if (starts.length) run.push(curves[(first - 1 + curves.length) % curves.length]!.b);
  else run.push(...run.slice(0, Math.round(CURVE_WINDOW_MM / CURVE_STEP_MM) * 2));
  settle();
  return tightest;
}

function segmentDistance(point: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

export function distanceToLine(point: Vec, line: Vec[], closed: boolean) {
  let nearest = Infinity;
  const last = closed ? line.length : line.length - 1;
  for (let i = 0; i < last; i++) nearest = Math.min(nearest, segmentDistance(point, line[i]!, line[(i + 1) % line.length]!));
  return nearest;
}

export type Shape = { line: Vec[]; closed: boolean; reach: number };

const thinned = (line: Vec[]) => {
  const stride = Math.max(1, Math.ceil(line.length / GAP_SAMPLES));
  return line.filter((_, i) => i % stride === 0);
};

function oneWayGap(from: Shape, to: Shape) {
  let nearest = Infinity;
  for (const point of thinned(from.line)) {
    if (to.closed && contains(to.line, point)) return 0;
    nearest = Math.min(nearest, distanceToLine(point, to.line, to.closed));
    if (nearest <= 0) return 0;
  }
  return nearest;
}

export function shapeGap(a: Shape, b: Shape) {
  const first = boundsOf(a.line);
  const second = boundsOf(b.line);
  const apart = Math.hypot(Math.max(0, first.minX - second.maxX, second.minX - first.maxX), Math.max(0, first.minY - second.maxY, second.minY - first.maxY));
  const reach = a.reach + b.reach;
  return Math.max(0, Math.max(apart, Math.min(oneWayGap(a, b), oneWayGap(b, a))) - reach);
}
