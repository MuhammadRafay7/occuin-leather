import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DesignSpec } from "./spec";

export const UNIT_PER_MM = 0.01;
const OUTLINE_POINTS = 360;
const PANEL_RINGS = 34;
const GUSSET_RINGS = 28;
const LINING_OUTLINE = 140;
const LINING_RINGS = 8;
const LEATHER_MM = 2.4;
const FLAP_LIFT_MM = 2.6;
const OPEN_FLAP_LEAN = 0.32;

type V3 = THREE.Vector3;
type Form = DesignSpec["form"];
type Warp = (x: number, y: number, z: number) => [number, number, number];

export type OutlinePoint = { x: number; y: number; zone: "base" | "side" | "top" };
export type BuildOptions = { open?: boolean; detail?: number };
export type Stitch = { position: V3; tangent: V3; normal: V3 };

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

function quadratic(a: THREE.Vector2, c: THREE.Vector2, b: THREE.Vector2, t: number) {
  const u = 1 - t;
  return new THREE.Vector2(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y);
}

export function sideX(form: Form, y: number) {
  const halfBase = form.width / 2;
  const halfTop = halfBase * form.taper;
  const t = y / form.height;
  return halfBase + (halfTop - halfBase) * t + form.belly * 0.14 * form.width * Math.sin(Math.PI * t);
}

export function topY(form: Form, x: number) {
  const halfTop = (form.width / 2) * form.taper;
  const r = Math.min(1, Math.abs(x) / halfTop);
  return form.height + form.topArc * 0.32 * form.height * (1 - r * r);
}

function rawRightHalf(form: Form) {
  const pts: { p: THREE.Vector2; zone: OutlinePoint["zone"] }[] = [];
  const rb = form.cornerBottom;
  const rt = Math.max(form.cornerTop, Math.min(form.depth * 0.14, 12));
  const baseEnd = Math.max(sideX(form, 0) - rb, 0);
  for (let i = 0; i <= 20; i++) pts.push({ p: new THREE.Vector2((baseEnd * i) / 20, 0), zone: "base" });
  const sideStart = new THREE.Vector2(sideX(form, rb), rb);
  for (let i = 1; i <= 16; i++) {
    pts.push({ p: quadratic(new THREE.Vector2(baseEnd, 0), new THREE.Vector2(sideX(form, 0), 0), sideStart, i / 16), zone: "side" });
  }
  const shoulderY = Math.max(form.height - rt, rb);
  for (let i = 1; i <= 40; i++) {
    const y = rb + ((shoulderY - rb) * i) / 40;
    pts.push({ p: new THREE.Vector2(sideX(form, y), y), zone: "side" });
  }
  const shoulder = new THREE.Vector2(sideX(form, shoulderY), shoulderY);
  const topStartX = Math.max(sideX(form, form.height) - rt, 0);
  const topStart = new THREE.Vector2(topStartX, topY(form, topStartX));
  const cornerControl = new THREE.Vector2(sideX(form, form.height), topY(form, sideX(form, form.height)));
  for (let i = 1; i <= 16; i++) pts.push({ p: quadratic(shoulder, cornerControl, topStart, i / 16), zone: "side" });
  for (let i = 1; i <= 30; i++) {
    const x = topStartX * (1 - i / 30);
    pts.push({ p: new THREE.Vector2(x, topY(form, x)), zone: "top" });
  }
  return pts;
}

export function buildOutline(form: Form, count = OUTLINE_POINTS): OutlinePoint[] {
  const right = rawRightHalf(form);
  const left = [...right].reverse().slice(1, -1).map(({ p, zone }) => ({ p: new THREE.Vector2(-p.x, p.y), zone }));
  const loop = [...right, ...left];
  const lengths = [0];
  for (let i = 1; i <= loop.length; i++) {
    lengths.push(lengths[i - 1]! + loop[i - 1]!.p.distanceTo(loop[i % loop.length]!.p));
  }
  const total = lengths[lengths.length - 1]!;
  const out: OutlinePoint[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const target = (total * i) / count;
    while (lengths[cursor + 1]! < target) cursor++;
    const a = loop[cursor]!;
    const b = loop[(cursor + 1) % loop.length]!;
    const span = lengths[cursor + 1]! - lengths[cursor]! || 1;
    const t = (target - lengths[cursor]!) / span;
    out.push({ x: a.p.x + (b.p.x - a.p.x) * t, y: a.p.y + (b.p.y - a.p.y) * t, zone: t < 0.5 ? a.zone : b.zone });
  }
  return out;
}

export function outlineBounds(outline: OutlinePoint[]) {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function uvRect(outline: OutlinePoint[]) {
  const b = outlineBounds(outline);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  return { x: (b.minX + b.maxX) / 2 - span / 2, y: (b.minY + b.maxY) / 2 - span / 2, span };
}

export function surfaceFrame(form: Form) {
  return uvRect(buildOutline(form));
}

function panelBulge(form: Form) {
  return Math.min(form.depth * 0.2, 6 + form.softness * 30) * (form.depth < 40 ? 0.5 : 1);
}

function pillow(s: number) {
  const c = Math.min(Math.max(s, 0), 1);
  return (1 - c ** 2.3) ** 0.72;
}

function faceZ(form: Form, s: number) {
  return form.depth / 2 + panelBulge(form) * pillow(s);
}

function polarTable(form: Form, outline: OutlinePoint[]) {
  const cy = form.height / 2;
  const bins = 720;
  const radii = new Float32Array(bins);
  const samples = outline
    .map((p) => ({ angle: Math.atan2(p.y - cy, p.x), radius: Math.hypot(p.x, p.y - cy) }))
    .sort((a, b) => a.angle - b.angle);
  let cursor = 0;
  for (let i = 0; i < bins; i++) {
    const angle = -Math.PI + ((i + 0.5) / bins) * Math.PI * 2;
    while (cursor < samples.length - 1 && samples[cursor + 1]!.angle < angle) cursor++;
    const a = samples[cursor]!;
    const b = samples[Math.min(cursor + 1, samples.length - 1)]!;
    const t = clamp01((angle - a.angle) / (b.angle - a.angle || 1));
    radii[i] = a.radius + (b.radius - a.radius) * t;
  }
  return (x: number, y: number) => {
    const angle = Math.atan2(y - cy, x);
    const index = Math.min(bins - 1, Math.floor(((angle + Math.PI) / (Math.PI * 2)) * bins));
    return Math.hypot(x, y - cy) / (radii[index] || 1);
  };
}

class Patch {
  positions: number[] = [];
  paint: number[] = [];
  grain: number[] = [];
  shade: number[] = [];
  indices: number[] = [];
  get count() {
    return this.positions.length / 3;
  }
  vertex(p: { x: number; y: number; z: number }, paint: [number, number], grain: [number, number], shade = 1) {
    this.positions.push(p.x, p.y, p.z);
    this.paint.push(paint[0], paint[1]);
    this.grain.push(grain[0], grain[1]);
    this.shade.push(shade, shade, shade);
    return this.count - 1;
  }
}

function seal(patch: Patch, warp: Warp | null) {
  const positions = new Float32Array(patch.positions.length);
  for (let i = 0; i < patch.positions.length; i += 3) {
    const [x, y, z] = warp ? warp(patch.positions[i]!, patch.positions[i + 1]!, patch.positions[i + 2]!) : [patch.positions[i]!, patch.positions[i + 1]!, patch.positions[i + 2]!];
    positions[i] = x * UNIT_PER_MM;
    positions[i + 1] = y * UNIT_PER_MM;
    positions[i + 2] = z * UNIT_PER_MM;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(patch.paint, 2));
  geometry.setAttribute("aGrain", new THREE.Float32BufferAttribute(patch.grain, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(patch.shade, 3));
  geometry.setIndex(patch.indices);
  geometry.computeVertexNormals();
  return geometry;
}

function offsetCopy(geometry: THREE.BufferGeometry, distanceMm: number, shade?: (y: number) => number) {
  const out = geometry.clone();
  const position = out.getAttribute("position") as THREE.BufferAttribute;
  const normal = out.getAttribute("normal") as THREE.BufferAttribute;
  const colors = out.getAttribute("color") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) + normal.getY(i) * distanceMm * UNIT_PER_MM;
    position.setXYZ(i, position.getX(i) + normal.getX(i) * distanceMm * UNIT_PER_MM, y, position.getZ(i) + normal.getZ(i) * distanceMm * UNIT_PER_MM);
    if (shade) {
      const value = shade(y / UNIT_PER_MM);
      colors.setXYZ(i, value, value, value);
    }
  }
  return out;
}

function makeWarp(spec: DesignSpec): Warp {
  const { form, closure } = spec;
  const soft = form.softness;
  const halfDepth = Math.max(form.depth / 2, 1);
  const halfWidth = Math.max(form.width / 2, 1);
  const pinchBase = form.gusset === "bellows" ? 0.12 + 0.2 * soft : soft * 0.09;
  const pinch = pinchBase * (closure.type === "open" ? 1 : 0.55);
  const wobble = form.depth < 40 ? soft * 0.6 : soft * Math.min(6.5, form.depth * 0.05);
  const sag = closure.type === "open" ? soft * Math.min(9, form.height * 0.03) : soft * 1.5;
  return (x, y, z) => {
    const t = clamp01(y / form.height);
    const across = clamp01(Math.abs(x) / halfWidth);
    const face = Math.max(-1, Math.min(1, z / halfDepth));
    const envelope = Math.sin(Math.PI * Math.min(t, 1));
    const dent = wobble * (Math.sin(x * 0.0167 + 1.1 + y * 0.009) * 0.6 + Math.sin(x * 0.031 - 0.7 + y * 0.013) * 0.4) * envelope;
    const crease = wobble * 0.5 * face * Math.sin(x * 0.023 + y * 0.02 + (face > 0 ? 0.8 : 2.1)) * envelope;
    const dy = -sag * (1 - across * across) * t * t * t + wobble * 0.3 * Math.sin(x * 0.012 + 2) * t * t;
    const dx = wobble * 0.32 * Math.sign(x) * Math.sin(y * 0.019 + 0.4) * t;
    return [x + dx, y + dy, z * (1 - pinch * t * t) + dent * 0.6 + crease];
  };
}

type Shell = { form: Form; outline: OutlinePoint[]; radial: (x: number, y: number) => number; frame: ReturnType<typeof uvRect> };

function panelZ(shell: Shell, x: number, y: number) {
  return faceZ(shell.form, shell.radial(x, y));
}

function paintUv(shell: Shell, x: number, y: number, side: 1 | -1): [number, number] {
  return [((side === 1 ? x : -x) - shell.frame.x) / shell.frame.span, (y - shell.frame.y) / shell.frame.span];
}

function buildPanel(shell: Shell, outline: OutlinePoint[], side: 1 | -1, rings: number) {
  const { form } = shell;
  const cy = form.height * 0.5;
  const patch = new Patch();
  const n = outline.length;
  const offset = side === 1 ? 0 : 1000;
  const groundShade = (y: number) => 0.74 + 0.26 * smooth(0, form.height * 0.3, y);
  const push = (x: number, y: number, z: number) =>
    patch.vertex({ x, y, z }, paintUv(shell, x, y, side), [(side === 1 ? x : -x) + offset, y], groundShade(y));
  push(0, cy, side * faceZ(form, 0));
  for (let r = 1; r <= rings; r++) {
    const s = 1 - (1 - r / rings) ** 1.65;
    for (const p of outline) push(p.x * s, cy + (p.y - cy) * s, side * faceZ(form, s));
  }
  const at = (r: number, i: number) => 1 + (r - 1) * n + ((i + n) % n);
  for (let i = 0; i < n; i++) {
    patch.indices.push(...(side === 1 ? [0, at(1, i), at(1, i + 1)] : [0, at(1, i + 1), at(1, i)]));
    for (let r = 1; r < rings; r++) {
      patch.indices.push(
        ...(side === 1
          ? [at(r, i), at(r + 1, i), at(r, i + 1), at(r, i + 1), at(r + 1, i), at(r + 1, i + 1)]
          : [at(r, i), at(r, i + 1), at(r + 1, i), at(r, i + 1), at(r + 1, i + 1), at(r + 1, i)]),
      );
    }
  }
  return patch;
}

function outwardNormals(outline: OutlinePoint[]) {
  const n = outline.length;
  return outline.map((_, i) => {
    const a = outline[(i - 1 + n) % n]!;
    const b = outline[(i + 1) % n]!;
    const tangent = new THREE.Vector2(b.x - a.x, b.y - a.y).normalize();
    return new THREE.Vector2(tangent.y, -tangent.x);
  });
}

function foldWeights(spec: DesignSpec, outline: OutlinePoint[]) {
  const { form, closure } = spec;
  const n = outline.length;
  const raw = outline.map((p) => (p.zone === "top" && closure.type === "zip" ? 0 : smooth(form.height * 0.03, form.height * 0.34, p.y)));
  const window = Math.max(2, Math.round(n * 0.012));
  return raw.map((_, i) => {
    let sum = 0;
    for (let k = -window; k <= window; k++) sum += raw[(i + k + n) % n]!;
    return sum / (window * 2 + 1);
  });
}

function vProfile(t: number) {
  const q = 2 * t - 1;
  const e = 0.3;
  return 1 - Math.sqrt(q * q + e * e) / Math.sqrt(1 + e * e);
}

function gussetSampler(spec: DesignSpec, outline: OutlinePoint[]) {
  const { form, closure } = spec;
  const normals = outwardNormals(outline);
  const weights = foldWeights(spec, outline);
  const fold = form.gusset === "bellows" ? Math.min(form.depth * 0.27, 52) : 0;
  const puffBase = form.gusset === "flat" ? Math.min(form.depth * 0.055, 5) * (0.3 + form.softness) : 0;
  const dip = closure.type === "zip" ? Math.min(form.depth * 0.08, 3.4) : 0;
  return (i: number, t: number) => {
    const index = i % outline.length;
    const p = outline[index]!;
    const n = normals[index]!;
    const w = weights[index]!;
    const profile = vProfile(t);
    const q = 2 * t - 1;
    const top = p.zone === "top";
    const puff = top ? 0 : puffBase * Math.sin(Math.PI * t) ** 0.7 * (p.zone === "base" ? 0.25 : 1);
    const channel = top ? -dip * Math.exp(-((q / 0.26) ** 2)) : 0;
    const offset = -fold * w * profile + puff + channel;
    return {
      position: v3(p.x + n.x * offset, p.y + n.y * offset, q * (form.depth / 2)),
      shade: 1 - 0.62 * (fold ? w * profile ** 1.1 : 0) - (p.y < form.height * 0.1 ? 0.12 : 0),
    };
  };
}

function isOpenTop(spec: DesignSpec) {
  return spec.closure.type !== "zip";
}

function buildGusset(spec: DesignSpec, outline: OutlinePoint[], rings: number, reveal: boolean) {
  const { form } = spec;
  const sample = gussetSampler(spec, outline);
  const n = outline.length;
  const patch = new Patch();
  let run = 0;
  for (let i = 0; i <= n; i++) {
    const prev = outline[(i - 1 + n) % n]!;
    const now = outline[i % n]!;
    if (i) run += Math.hypot(now.x - prev.x, now.y - prev.y);
    for (let v = 0; v <= rings; v++) {
      const t = v / rings;
      const { position, shade } = sample(i, t);
      patch.vertex(position, [0, 0], [run, t * form.depth + 2200], shade);
    }
  }
  const omit = (i: number, v: number) => {
    const zone = outline[i % n]!.zone;
    if (zone !== "top") return false;
    if (isOpenTop(spec)) return true;
    if (!reveal) return false;
    const t = (v + 0.5) / rings;
    return Math.abs(t - 0.5) < 0.2;
  };
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < rings; v++) {
      if (omit(i, v) || omit(i + 1, v)) continue;
      const a = i * (rings + 1) + v;
      const b = (i + 1) * (rings + 1) + v;
      patch.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return patch;
}

function gussetRims(spec: DesignSpec, outline: OutlinePoint[]) {
  if (!isOpenTop(spec)) return [];
  const sample = gussetSampler(spec, outline);
  const n = outline.length;
  const rims: V3[][] = [];
  for (let i = 0; i < n; i++) {
    const a = outline[i]!.zone === "top";
    const b = outline[(i + 1) % n]!.zone === "top";
    if (a === b) continue;
    const column = a ? i + 1 : i;
    const path: V3[] = [];
    for (let v = 0; v <= 36; v++) path.push(sample(column, v / 36).position);
    rims.push(path);
  }
  return rims;
}

type Section = { hw: number; ht: number; exp: number };

export function sweep(path: V3[], section: Section | ((f: number, i: number) => Section), hint: V3 | V3[] | null, closed = false, segments = 14) {
  const patch = new Patch();
  const count = path.length;
  let length = 0;
  let transported = hint instanceof THREE.Vector3 ? hint.clone() : v3(1, 0, 0);
  const lengths: number[] = [0];
  for (let i = 1; i < count; i++) lengths.push(lengths[i - 1]! + path[i]!.distanceTo(path[i - 1]!));
  const total = lengths[count - 1] || 1;
  const rows: number[] = [];
  for (let i = 0; i < count; i++) {
    const prev = path[closed ? (i - 1 + count) % count : Math.max(i - 1, 0)]!;
    const next = path[closed ? (i + 1) % count : Math.min(i + 1, count - 1)]!;
    const tangent = next.clone().sub(prev).normalize();
    const axis = Array.isArray(hint) ? hint[i]! : hint ?? transported;
    const side = axis.clone().sub(tangent.clone().multiplyScalar(axis.dot(tangent))).normalize();
    transported = side.clone();
    const up = side.clone().cross(tangent).normalize();
    length = lengths[i]!;
    const shape = typeof section === "function" ? section(length / total, i) : section;
    rows.push(patch.count);
    const perimeter = (shape.hw + shape.ht) * 4;
    for (let s = 0; s <= segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const q = Math.sin(a);
      const wx = Math.sign(c) * Math.abs(c) ** shape.exp * shape.hw;
      const wy = Math.sign(q) * Math.abs(q) ** shape.exp * shape.ht;
      patch.vertex(path[i]!.clone().addScaledVector(side, wx).addScaledVector(up, wy), [0, 0], [length, (s / segments) * perimeter + 4200], 1);
    }
  }
  const stops = closed ? count : count - 1;
  for (let i = 0; i < stops; i++) {
    for (let s = 0; s < segments; s++) {
      const a = rows[i]! + s;
      const b = rows[(i + 1) % count]! + s;
      patch.indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  if (!closed) {
    for (const [row, flip] of [[0, true], [count - 1, false]] as const) {
      const center = patch.vertex(path[row]!, [0, 0], [lengths[row]!, 4200], 1);
      for (let s = 0; s < segments; s++) {
        const a = rows[row]! + s;
        patch.indices.push(...(flip ? [center, a + 1, a] : [center, a, a + 1]));
      }
    }
  }
  return patch;
}

function placeOnPath(points: V3[], pitch: number, normal: V3 | ((position: V3) => V3)): Stitch[] {
  const out: Stitch[] = [];
  let carry = pitch * 0.5;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const segment = a.distanceTo(b);
    if (!segment) continue;
    const tangent = b.clone().sub(a).normalize();
    while (carry < segment) {
      const position = a.clone().addScaledVector(tangent, carry);
      const hint = normal instanceof THREE.Vector3 ? normal : normal(position);
      const facing = hint.clone().sub(tangent.clone().multiplyScalar(hint.dot(tangent))).normalize();
      out.push({ position, tangent, normal: facing });
      carry += pitch;
    }
    carry -= segment;
  }
  return out;
}

function rimRuns(shell: Shell, inset: number, side: 1 | -1, keep: (p: OutlinePoint) => boolean) {
  const { form, outline } = shell;
  const cy = form.height / 2;
  const n = outline.length;
  const mapped = outline.map((p) => {
    const dist = Math.hypot(p.x, p.y - cy) || 1;
    const s = 1 - inset / dist;
    return v3(p.x * s, cy + (p.y - cy) * s, side * (faceZ(form, s) + 0.12));
  });
  const flags = outline.map(keep);
  if (flags.every(Boolean)) return [[...mapped, mapped[0]!]];
  const start = flags.findIndex((flag, i) => flag && !flags[(i - 1 + n) % n]);
  const runs: V3[][] = [];
  let run: V3[] = [];
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    if (flags[i]) run.push(mapped[i]!);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

function flapHalfWidth(form: Form) {
  return Math.max(sideX(form, form.height) - Math.min(form.cornerTop * 0.3, 4), 10);
}

function flapLengthAt(spec: DesignSpec, u: number) {
  const { flapShape, flapLength } = spec.closure;
  const length = spec.form.height * flapLength;
  const a = Math.abs(u);
  if (flapShape === "point") return length * (0.55 + 0.45 * (1 - a ** 1.4));
  if (flapShape === "round") return length * Math.sqrt(Math.max(1 - a ** 2.6, 0.0025));
  return length * Math.min(1, (1 - a ** 12) ** 0.5 + 0.04);
}

function flapSpans(form: Form) {
  return { back: form.depth * 0.5, crown: ((form.depth / 2) * 1.06 * Math.PI) / 2 };
}

export function flapFrame(spec: DesignSpec) {
  const { back, crown } = flapSpans(spec.form);
  const halfWidth = flapHalfWidth(spec.form);
  const length = back + crown + spec.form.height * spec.closure.flapLength;
  return { halfWidth, length, span: Math.max(halfWidth * 2, length), start: back + crown };
}

function flapPoint(shell: Shell, spec: DesignSpec, u: number, s: number, open: boolean) {
  const { form } = spec;
  const x = u * flapHalfWidth(form);
  const lift = FLAP_LIFT_MM;
  const crownY = topY(form, x) + lift;
  const { back, crown } = flapSpans(form);
  if (s < back) return v3(x, crownY - (back - s) * 0.5, -form.depth / 2 - lift - panelZ(shell, x, crownY - (back - s) * 0.5) + form.depth / 2);
  if (open) {
    const reach = s - back;
    return v3(x, crownY + reach * Math.cos(OPEN_FLAP_LEAN), -form.depth / 2 - lift - reach * Math.sin(OPEN_FLAP_LEAN));
  }
  if (s < back + crown) {
    const a = ((s - back) / crown) * Math.PI;
    return v3(x, crownY + Math.sin(a) * Math.min(5, form.depth * 0.08), -Math.cos(a) * (form.depth / 2 + lift));
  }
  const down = s - back - crown;
  const y = crownY - down;
  const blend = smooth(0, Math.max(form.height * 0.16, 8), down);
  return v3(x, y, form.depth / 2 + (panelZ(shell, x, y) - form.depth / 2) * blend + lift);
}

function buildFlap(shell: Shell, spec: DesignSpec, open: boolean, detail: number) {
  const cols = Math.round(64 * detail);
  const rows = Math.round(76 * detail);
  const frame = flapFrame(spec);
  const { back, crown } = flapSpans(spec.form);
  const patch = new Patch();
  for (let c = 0; c <= cols; c++) {
    const u = (c / cols) * 2 - 1;
    const total = back + crown + flapLengthAt(spec, u);
    for (let r = 0; r <= rows; r++) {
      const s = (r / rows) * total;
      const p = flapPoint(shell, spec, u, s, open);
      patch.vertex(p, [0.5 + (u * frame.halfWidth) / frame.span, 1 - s / frame.span], [u * frame.halfWidth + 3100, 3100 - s], 1);
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const a = c * (rows + 1) + r;
      const b = (c + 1) * (rows + 1) + r;
      patch.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return patch;
}

function flapBorder(shell: Shell, spec: DesignSpec, inset: number, open: boolean) {
  const { back, crown } = flapSpans(spec.form);
  const halfWidth = flapHalfWidth(spec.form);
  const edgeU = 1 - inset / halfWidth;
  const pts: V3[] = [];
  const normals: V3[] = [];
  const free = (u: number) => back + crown + flapLengthAt(spec, u) - inset;
  const add = (u: number, s: number) => {
    const p = flapPoint(shell, spec, u, s, open);
    const du = flapPoint(shell, spec, Math.min(u + 0.01, 1), s, open).sub(flapPoint(shell, spec, Math.max(u - 0.01, -1), s, open));
    const ds = flapPoint(shell, spec, u, s + 1, open).sub(flapPoint(shell, spec, u, s - 1, open));
    normals.push(du.cross(ds).normalize().multiplyScalar(-1));
    pts.push(p);
  };
  const sideSteps = 40;
  for (let i = 0; i <= sideSteps; i++) add(-edgeU, back * 0.1 + (free(-edgeU) - back * 0.1) * (i / sideSteps));
  for (let i = 1; i < 90; i++) {
    const u = ((i / 90) * 2 - 1) * edgeU;
    add(u, free(u));
  }
  for (let i = sideSteps; i >= 0; i--) add(edgeU, back * 0.1 + (free(edgeU) - back * 0.1) * (i / sideSteps));
  return { points: pts, normals };
}

export function accentSeams(spec: DesignSpec): { x: number; y: number }[][] {
  const { form, panels } = spec;
  const panelY = form.height * panels.divide;
  const line = (ax: number, ay: number, bx: number, by: number) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 80; i++) pts.push({ x: ax + ((bx - ax) * i) / 80, y: ay + ((by - ay) * i) / 80 });
    return pts;
  };
  if (panels.layout === "yoke") return [line(-form.width, panelY, form.width, panelY)];
  if (panels.layout === "split") {
    const x = (panels.divide - 0.5) * form.width;
    return [line(x, -form.height, x, form.height * 2)];
  }
  if (panels.layout === "diagonal") return [line(-form.width, panelY - form.height * 0.45, form.width, panelY + form.height * 0.45)];
  if (panels.layout === "tipped") {
    const r = Math.min(form.width, form.height) * 0.3;
    return [-1, 1].map((sign) => {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 90; i++) {
        const a = (i / 90) * Math.PI * 2;
        pts.push({ x: (sign * form.width) / 2 + Math.cos(a) * r, y: Math.sin(a) * r });
      }
      return pts;
    });
  }
  return [];
}

function seamStitches(shell: Shell, spec: DesignSpec, side: 1 | -1, pitch: number) {
  const out: Stitch[] = [];
  const offsets = spec.stitch.rows === 2 ? [2.6, 6] : [2.6];
  for (const polyline of accentSeams(spec)) {
    for (const offset of offsets) {
      let run: V3[] = [];
      const flush = () => {
        if (run.length > 1) out.push(...placeOnPath(run, pitch, v3(0, 0, side)));
        run = [];
      };
      polyline.forEach((point, i) => {
        const next = polyline[Math.min(i + 1, polyline.length - 1)]!;
        const prev = polyline[Math.max(i - 1, 0)]!;
        const nx = -(next.y - prev.y);
        const ny = next.x - prev.x;
        const length = Math.hypot(nx, ny) || 1;
        const x = point.x + (nx / length) * offset;
        const y = point.y + (ny / length) * offset;
        const worldX = side === 1 ? x : -x;
        if (shell.radial(worldX, y) > 0.965) return flush();
        run.push(v3(worldX, y, side * (panelZ(shell, worldX, y) + 0.12)));
      });
      flush();
    }
  }
  return out;
}

function cleanForMerge(geometry: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", geometry.getAttribute("position"));
  out.setAttribute("normal", geometry.getAttribute("normal"));
  return out;
}

function place(geometry: THREE.BufferGeometry, position: V3, rotation = new THREE.Quaternion(), scale = 1) {
  const matrix = new THREE.Matrix4().compose(position.clone().multiplyScalar(UNIT_PER_MM), rotation, new THREE.Vector3(1, 1, 1).multiplyScalar(UNIT_PER_MM * scale));
  const out = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
  return cleanForMerge(out);
}

const euler = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const facing = (normal: V3) => new THREE.Quaternion().setFromUnitVectors(v3(0, 0, 1), normal.clone().normalize());

function lathe(profile: [number, number][], segments = 28) {
  const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments);
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function roundedPlate(width: number, height: number, thick: number, radius: number, bevel: number) {
  const w = width / 2 - bevel;
  const h = height / 2 - bevel;
  const r = Math.min(Math.max(radius - bevel, 0.05), Math.min(w, h));
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(thick - bevel * 2, 0.05), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 8 });
  geometry.translate(0, 0, -thick / 2 + bevel);
  return geometry;
}

function rivetGeometry(radius: number) {
  return lathe([[radius * 0.9, 0], [radius * 0.98, 0.04], [radius, 0.34], [radius * 0.96, 0.7], [radius * 0.78, 1.14], [radius * 0.45, 1.42], [0, 1.5]], 24);
}

function millimetres(patch: Patch) {
  const geometry = seal(patch, null);
  geometry.scale(1 / UNIT_PER_MM, 1 / UNIT_PER_MM, 1 / UNIT_PER_MM);
  return geometry;
}

function closedTube(points: V3[], radius: number) {
  return millimetres(sweep([...points, points[0]!.clone()], { hw: radius, ht: radius, exp: 1 }, v3(0, 0, 1), false, 10));
}

function dRing(width: number, height: number, wire: number) {
  const pts: V3[] = [];
  const half = width / 2;
  for (let i = 0; i <= 10; i++) pts.push(v3(-half + (width * i) / 10, 0, 0));
  for (let i = 1; i < 40; i++) {
    const a = (i / 40) * Math.PI;
    pts.push(v3(Math.cos(a) * half, Math.sin(a) ** 0.7 * height, 0));
  }
  return closedTube(pts, wire);
}

function rectangleLoop(width: number, height: number, radius: number) {
  const pts: V3[] = [];
  const hw = width / 2 - radius;
  const hh = height / 2 - radius;
  for (const [cx, cy, start] of [[hw, hh, 0], [-hw, hh, 1], [-hw, -hh, 2], [hw, -hh, 3]] as const) {
    for (let i = 0; i <= 8; i++) {
      const a = ((start + i / 8) * Math.PI) / 2;
      pts.push(v3(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 0));
    }
  }
  return pts;
}

function buckleGeometry(width: number, height: number) {
  const frame = closedTube(rectangleLoop(width, height, 2.2), 1.25);
  const prongPath = [v3(0, -height / 2, 0.4), v3(0, -height * 0.15, 2.2), v3(0, height * 0.42, 1.7), v3(0, height / 2 + 1, 0.8)];
  const prong = millimetres(sweep(prongPath, { hw: 1, ht: 0.8, exp: 0.9 }, v3(1, 0, 0), false, 8));
  return mergeGeometries([frame, prong].map((g) => cleanForMerge(g.toNonIndexed())))!;
}

function zipPullGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-3.2, -11);
  shape.quadraticCurveTo(-3.8, 0, -2.2, 10);
  shape.quadraticCurveTo(0, 12, 2.2, 10);
  shape.quadraticCurveTo(3.8, 0, 3.2, -11);
  shape.quadraticCurveTo(0, -13, -3.2, -11);
  const hole = new THREE.Path();
  hole.absellipse(0, 7, 1.3, 2.1, 0, Math.PI * 2, false, 0);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3, curveSegments: 10 });
  geometry.translate(0, 0, -0.4);
  return geometry;
}

function archPoints(spec: DesignSpec, shell: Shell, spread: number, side: 1 | -1, tabLength: number, faceLift: number) {
  const { form, carry } = spec;
  const yTop = topY(form, spread);
  const zAt = (x: number, y: number) => side * (panelZ(shell, Math.min(Math.abs(x), sideX(form, Math.min(y, form.height)) * 0.98), Math.min(y, form.height - 1)) + faceLift);
  const left: V3[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = yTop - tabLength + (tabLength * i) / 12;
    left.push(v3(-spread, y, zAt(spread, y)));
  }
  const rimZ = left[left.length - 1]!.z;
  const arch: V3[] = [];
  for (let i = 1; i < 64; i++) {
    const a = (i / 64) * Math.PI;
    const rise = Math.sin(a) ** 0.82 * carry.handleDrop;
    const lean = Math.sin(a) ** 2 * Math.min(form.depth * 0.09, 12);
    arch.push(v3(-Math.cos(a) * spread, yTop + rise, rimZ - side * lean));
  }
  const right = [...left].reverse().map((p) => v3(-p.x, p.y, p.z));
  return { path: [...left, ...arch, ...right], yTop };
}

function strapRise({ carry }: DesignSpec) {
  return Math.max(carry.strapLength * (carry.handles ? 0.1 : 0.2), 70) + (carry.handles ? carry.handleDrop * 0.2 : 0);
}

export type BagGeometry = {
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  gusset: THREE.BufferGeometry;
  lining: THREE.BufferGeometry | null;
  flap: THREE.BufferGeometry | null;
  edges: THREE.BufferGeometry;
  leatherStraps: THREE.BufferGeometry | null;
  hardware: THREE.BufferGeometry | null;
  zipTape: THREE.BufferGeometry | null;
  stitches: Stitch[];
  centerY: number;
  radius: number;
  groundY: number;
  stitchSpan: number;
};

export function buildBag(spec: DesignSpec, options: BuildOptions = {}): BagGeometry {
  const { form, carry, closure } = spec;
  const open = options.open ?? false;
  const detail = options.detail ?? 1;
  const outline = buildOutline(form, Math.round(OUTLINE_POINTS * detail));
  const shell: Shell = { form, outline, radial: polarTable(form, outline), frame: uvRect(outline) };
  const warp = makeWarp(spec);
  const warped = (p: V3) => {
    const [x, y, z] = warp(p.x, p.y, p.z);
    return v3(x, y, z);
  };
  const bagScale = Math.min(1, Math.max(0.35, Math.min(form.width, form.height) / 200));
  const thin = form.depth < 40;
  const rings = Math.round(PANEL_RINGS * detail);
  const beadRadial = thin ? 1.1 : 2.1;
  const beadAxial = thin ? 1 : 1.8;
  const pitch = spec.stitch.length;
  const metal: THREE.BufferGeometry[] = [];
  const straps: Patch[] = [];
  const edgeParts: Patch[] = [];
  const frontExtras: Patch[] = [];
  const stitches: Stitch[] = [];
  const hasFlap = closure.type === "flap";

  const frontPatch = buildPanel(shell, outline, 1, rings);
  const backPatch = buildPanel(shell, outline, -1, rings);
  const gusset = seal(buildGusset(spec, outline, Math.round(GUSSET_RINGS * Math.max(detail, 0.7)), open), warp);
  const flapPatch = hasFlap ? buildFlap(shell, spec, open, detail) : null;
  const flap = flapPatch ? seal(flapPatch, warp) : null;

  for (const side of [1, -1] as const) {
    const ring = outline.map((p) => v3(p.x, p.y, (side * form.depth) / 2));
    edgeParts.push(sweep([...ring, ring[0]!.clone()], { hw: beadAxial, ht: beadRadial, exp: 0.82 }, v3(0, 0, 1)));
  }
  for (const rim of gussetRims(spec, outline)) edgeParts.push(sweep(rim, { hw: beadRadial * 0.8, ht: beadAxial * 0.9, exp: 0.85 }, null));

  if (flap) {
    const border = flapBorder(shell, spec, 0.2, open);
    edgeParts.push(sweep(border.points, { hw: 1.5, ht: 1.75, exp: 0.82 }, border.normals));
  }

  const insets = spec.stitch.rows === 2 ? [5 * bagScale, 8.5 * bagScale] : [5 * bagScale];
  for (const inset of insets) {
    for (const side of [1, -1] as const) {
      const keep = hasFlap && side === 1 ? (p: OutlinePoint) => p.zone !== "top" : () => true;
      for (const run of rimRuns(shell, inset, side, keep)) stitches.push(...placeOnPath(run, pitch, v3(0, 0, side)));
    }
    if (flap) {
      const border = flapBorder(shell, spec, inset + 2, open);
      stitches.push(...placeOnPath(border.points, pitch, v3(0, open ? 0.3 : 0, open ? -1 : 1)));
    }
  }
  for (const side of [1, -1] as const) stitches.push(...seamStitches(shell, spec, side, pitch));

  const rivet = rivetGeometry(Math.max(3.1 * bagScale, 2.2));

  const sideAnchor = (x: number, y: number, ringWidth: number) => {
    const sign = Math.sign(x);
    const tabPath: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const v = y - 30 + (i / 10) * 34;
      tabPath.push(v3(x + sign * 1.4, v, 0));
    }
    straps.push(sweep(tabPath, { hw: ringWidth / 2 - 1.5, ht: 1.5, exp: 0.55 }, v3(0, 0, 1)));
    edgeParts.push(sweep(tabPath, { hw: ringWidth / 2 - 1.1, ht: 0.95, exp: 0.7 }, v3(0, 0, 1), false, 8));
    const ringGeometry = dRing(ringWidth, 13, 1.45);
    metal.push(place(ringGeometry, warped(v3(x + sign * 1.4, y + 3, 0)), euler(0, Math.PI / 2, 0)));
    metal.push(place(rivet, warped(v3(x + sign * 3, y - 20, 0)), euler(0, (sign * Math.PI) / 2, 0)));
    const normal = v3(sign, 0, 0);
    for (const z of [-1, 1]) {
      stitches.push(...placeOnPath([v3(x + sign * 2.9, y - 28, (z * ringWidth) / 2 - z * 3), v3(x + sign * 2.9, y - 4, (z * ringWidth) / 2 - z * 3)], pitch * 0.85, normal));
    }
    return y + 16;
  };

  const foldedSideX = (y: number) => {
    const fold = form.gusset === "bellows" ? Math.min(form.depth * 0.27, 52) * smooth(form.height * 0.03, form.height * 0.34, y) * vProfile(0.5) : 0;
    return sideX(form, y) - fold;
  };

  if (carry.handles === 2) {
    const spread = Math.min(sideX(form, form.height) * 0.46, Math.max(carry.handleDrop * 0.75, 40));
    const tabLength = Math.min(Math.max(form.height * 0.26, 34), 86);
    const tube = Math.max(carry.handleWidth * 0.34, 4.2);
    const flat = carry.handleWidth / 2;
    const faceLift = 1.7 + (hasFlap ? FLAP_LIFT_MM + 1 : 0);
    for (const side of [1, -1] as const) {
      const { path, yTop } = archPoints(spec, shell, spread, side, tabLength, faceLift);
      let total = 0;
      for (let i = 1; i < path.length; i++) total += path[i]!.distanceTo(path[i - 1]!);
      const blendSpan = Math.min((tabLength + 26) / total, 0.3);
      const section = (f: number): Section => {
        const blend = smooth(blendSpan * 0.42, blendSpan, Math.min(f, 1 - f));
        return { hw: flat + (tube - flat) * blend, ht: 1.5 + (tube - 1.5) * blend, exp: 0.55 + 0.45 * blend };
      };
      straps.push(sweep(path, section, null));
      const normal = v3(0, 0, side);
      for (const sign of [-1, 1]) {
        const x = sign * spread;
        const bottom = yTop - tabLength + 3;
        const top = yTop - 4;
        const z = (y: number) => side * (panelZ(shell, Math.abs(x), Math.min(y, form.height - 1)) + faceLift + 1.75);
        const box = [
          v3(x - flat + 2.6, bottom, z(bottom)),
          v3(x + flat - 2.6, bottom, z(bottom)),
          v3(x + flat - 2.6, top, z(top)),
          v3(x - flat + 2.6, top, z(top)),
          v3(x - flat + 2.6, bottom, z(bottom)),
          v3(x + flat - 2.6, top, z(top)),
        ];
        stitches.push(...placeOnPath(box, pitch * 0.82, normal));
        const lowest = Math.round(tabLength * 0.36);
        for (const edgeSign of [-1, 1]) {
          const trim: V3[] = [];
          for (let i = 0; i <= 12; i++) {
            const y = yTop - tabLength + (lowest * i) / 12;
            trim.push(v3(x + edgeSign * (flat - 0.2), y, z(y) - side * 1.75));
          }
          edgeParts.push(sweep(trim, { hw: 0.7, ht: 1.65, exp: 0.8 }, v3(1, 0, 0), false, 8));
        }
        const tip: V3[] = [];
        for (let i = 0; i <= 10; i++) tip.push(v3(x - flat + (2 * flat * i) / 10, yTop - tabLength, z(yTop - tabLength) - side * 1.75));
        edgeParts.push(sweep(tip, { hw: 1.65, ht: 0.7, exp: 0.8 }, v3(0, 0, 1), false, 8));
        const stud = side === 1 ? euler(0, 0, 0) : euler(0, Math.PI, 0);
        const rivetZ = (y: number) => z(y) - side * 0.15;
        metal.push(place(rivet, warped(v3(x, yTop - tabLength * 0.34, rivetZ(yTop - tabLength * 0.34))), stud));
        metal.push(place(rivet, warped(v3(x, yTop - tabLength * 0.72, rivetZ(yTop - tabLength * 0.72))), stud));
        stitches.push(...placeOnPath([v3(x - flat + 2.6, top, z(top)), v3(x + flat - 2.6, bottom, z(bottom))], pitch * 0.82, normal));
      }
      const seam = path.map((p, i) => {
        const next = path[Math.min(i + 1, path.length - 1)]!;
        const prev = path[Math.max(i - 1, 0)]!;
        const tangent = next.clone().sub(prev).normalize();
        const inner = v3(-tangent.y * -1, -tangent.x, 0).normalize();
        const f = i / (path.length - 1);
        const shape = section(f);
        return { point: p.clone().addScaledVector(inner, shape.hw * 0.98), inner, keep: shape.exp > 0.9 };
      }).filter((entry) => entry.keep);
      stitches.push(...placeOnPath(seam.map((entry) => entry.point), pitch, v3(0, -1, 0)));
    }
  }

  if (carry.handles === 1) {
    const anchored = closure.type === "open";
    const spread = anchored ? foldedSideX(form.height - 28) : Math.min(sideX(form, form.height) * 0.46, Math.max(carry.handleDrop * 0.75, 40));
    const tube = Math.max(carry.handleWidth * 0.36, 4.2);
    let startY: number;
    if (anchored) {
      const ringY = form.height - 28;
      startY = sideAnchor(spread, ringY, carry.handleWidth + 8);
      sideAnchor(-spread, ringY, carry.handleWidth + 8);
    } else {
      const baseY = topY(form, spread) + (hasFlap ? FLAP_LIFT_MM + 1 : 0);
      startY = baseY + 15;
      for (const sign of [-1, 1]) {
        const x = sign * spread;
        const saddle: V3[] = [];
        const reach = Math.min(form.depth * 0.42, 20);
        for (let i = 0; i <= 14; i++) {
          const z = -reach + (i / 14) * reach * 2;
          saddle.push(v3(x, baseY + 1.2 - ((z / reach) ** 2) * 2.2, z));
        }
        const tabWidth = carry.handleWidth + 4;
        straps.push(sweep(saddle, { hw: tabWidth / 2, ht: 1.4, exp: 0.55 }, v3(1, 0, 0)));
        metal.push(place(rivet, warped(v3(x, baseY + 0.4, reach * 0.72)), euler(-Math.PI / 2, 0, 0)));
        metal.push(place(rivet, warped(v3(x, baseY + 0.4, -reach * 0.72)), euler(-Math.PI / 2, 0, 0)));
        const ringGeometry = dRing(carry.handleWidth + 6, 13, 1.45);
        metal.push(place(ringGeometry, warped(v3(x, baseY + 2, 0)), euler(0, 0, 0)));
      }
    }
    const path: V3[] = [];
    const rise = carry.handleDrop;
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI;
      path.push(v3(-Math.cos(a) * spread, startY + Math.sin(a) ** 0.78 * rise, 0));
    }
    const flat = carry.handleWidth / 2;
    const section = (f: number): Section => {
      const blend = smooth(0.015, 0.09, Math.min(f, 1 - f));
      return { hw: flat + (tube - flat) * blend, ht: 1.4 + (tube - 1.4) * blend, exp: 0.55 + 0.45 * blend };
    };
    straps.push(sweep(path, section, v3(0, 0, 1)));
    const seam = path.slice(6, -6).map((p) => {
      const inner = v3(p.x, startY - p.y, 0).normalize();
      return p.clone().addScaledVector(inner, tube * 0.98);
    });
    stitches.push(...placeOnPath(seam, pitch, v3(0, -1, 0)));
  }

  if (carry.strap) {
    const attachY = form.height * 0.82;
    const attachX = foldedSideX(attachY) + beadRadial * 0.5;
    const ringWidth = carry.strapWidth + 6;
    const startY = sideAnchor(attachX, attachY, ringWidth);
    sideAnchor(-attachX, attachY, ringWidth);
    const rise = strapRise(spec);
    const path: V3[] = [];
    const count = 96;
    for (let i = 0; i <= count; i++) {
      const a = (i / count) * Math.PI;
      path.push(v3(-Math.cos(a) * attachX, startY + Math.sin(a) ** 0.62 * rise, 0));
    }
    const half = carry.strapWidth / 2;
    const thick = 1.55;
    straps.push(sweep(path, { hw: half, ht: thick, exp: 0.52 }, v3(0, 0, 1)));
    for (const sign of [-1, 1]) {
      const edge = path.map((p) => p.clone().add(v3(0, 0, sign * (half - 0.25))));
      edgeParts.push(sweep(edge, { hw: 0.55, ht: thick + 0.12, exp: 0.8 }, v3(0, 0, 1), false, 8));
      const seamZ = sign * Math.max(half - 2.2, 1.2);
      for (const lift of [1, -1]) {
        const seam = path.map((p, i) => {
          const next = path[Math.min(i + 1, count)]!;
          const prev = path[Math.max(i - 1, 0)]!;
          const tangent = next.clone().sub(prev).normalize();
          const outward = v3(-tangent.y, tangent.x, 0).multiplyScalar(-lift);
          return p.clone().addScaledVector(outward, thick + 0.02).add(v3(0, 0, seamZ));
        });
        stitches.push(...placeOnPath(seam, pitch, (position) => position.clone().sub(v3(position.x * 0.2, startY, 0)).setZ(0).multiplyScalar(lift).normalize()));
      }
    }
    const index = Math.floor(count * 0.2);
    const point = path[index]!;
    const tangent = path[index + 1]!.clone().sub(path[index - 1]!).normalize();
    const outward = v3(tangent.y, -tangent.x, 0).multiplyScalar(-1).normalize();
    const basis = new THREE.Matrix4().makeBasis(v3(0, 0, 1), tangent, v3(0, 0, 1).cross(tangent).normalize());
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    metal.push(place(buckleGeometry(carry.strapWidth + 6, 17), point.clone().addScaledVector(outward, 2.1), quaternion));
    const keeperCenter = path[index + 5]!;
    const keeperLoop = rectangleLoop(carry.strapWidth + 5, 6.4, 1.8).map((p) => keeperCenter.clone().addScaledVector(v3(0, 0, 1), p.x).addScaledVector(outward, p.y));
    straps.push(sweep([...keeperLoop, keeperLoop[0]!.clone()], { hw: 4.5, ht: 0.8, exp: 0.6 }, tangent.clone()));
  }

  let zipTape: THREE.BufferGeometry | null = null;
  const zipParts: Patch[] = [];
  const toothGeometry = new THREE.BoxGeometry(1.7, 3.2, 1);
  const addZip = (path: V3[], normal: V3, spacing: number, halfGap: number) => {
    const rows = halfGap ? [-1, 1] : [0];
    for (const row of rows) {
      const shifted = path.map((p) => p.clone().add(row ? v3(0, 0, row * (halfGap + 5)) : v3(0, 0, 0)));
      zipParts.push(sweep(shifted, { hw: halfGap ? 6 : 6.5, ht: 0.45, exp: 0.7 }, v3(0, 0, 1), false, 8));
      for (const tooth of placeOnPath(path, spacing, normal)) {
        const quaternion = euler(Math.PI / 2, 0, Math.atan2(tooth.tangent.y, tooth.tangent.x) * 0);
        const position = tooth.position.clone().add(v3(0, 0.6, row * halfGap));
        metal.push(place(toothGeometry, warped(position), quaternion));
      }
    }
  };

  if (closure.type === "zip") {
    const top = outline.filter((p) => p.zone === "top").sort((a, b) => a.x - b.x);
    const dip = Math.min(form.depth * 0.08, 3.4);
    const path = top.map((p) => v3(p.x, p.y - dip + 0.4, 0));
    const halfGap = open ? form.depth * 0.18 : 0;
    addZip(path, v3(0, 1, 0), 2.7, halfGap);
    const end = top[Math.floor(top.length * 0.82)] ?? top[top.length - 1]!;
    const anchor = warped(v3(end.x, end.y - dip + 2.2, 0));
    metal.push(place(roundedPlate(10, 7, 3.6, 1.6, 0.6), anchor, euler(Math.PI / 2, 0, 0)));
    metal.push(place(zipPullGeometry(), warped(v3(end.x, end.y - dip + 3, Math.min(form.depth / 2 - 9, 16))), euler(1.32, 0, 0)));
  }

  if (flap && closure.clasp !== "none") {
    const { back, crown } = flapSpans(form);
    const s = back + crown + flapLengthAt(spec, 0) - Math.max(form.height * closure.flapLength * 0.13, 12);
    const p = flapPoint(shell, spec, 0, s, open);
    const du = flapPoint(shell, spec, 0.02, s, open).sub(flapPoint(shell, spec, -0.02, s, open));
    const ds = flapPoint(shell, spec, 0, s + 1, open).sub(flapPoint(shell, spec, 0, s - 1, open));
    const normal = du.cross(ds).normalize().multiplyScalar(-1);
    const position = warped(p);
    const quaternion = facing(normal);
    if (closure.clasp === "turnlock") {
      const size = bagScale > 0.7 ? 1 : 0.72;
      metal.push(place(lathe([[0, 0], [14.2, 0], [14.6, 0.5], [14.4, 1.3], [13.4, 1.8], [8.2, 1.9], [7.8, 2.6], [0, 2.6]], 48), position, quaternion, size));
      metal.push(place(roundedPlate(23, 7.4, 4.6, 3.6, 1.1), position.clone().addScaledVector(normal, 4.4 * size), quaternion.clone().multiply(euler(0, 0, 0.62)), size));
      for (const a of [0.5, 2.1, 3.65, 5.2]) {
        const offset = v3(Math.cos(a) * 11.2, Math.sin(a) * 11.2, 2.1).applyQuaternion(quaternion).multiplyScalar(size);
        metal.push(place(rivetGeometry(1.2), position.clone().add(offset), quaternion, size));
      }
    } else {
      const width = Math.min(form.width * 0.3, 70);
      metal.push(place(roundedPlate(width, 7.6, 3.4, 3.4, 1), position.clone().addScaledVector(normal, 2.2), quaternion));
      for (const sign of [-1, 1]) metal.push(place(rivetGeometry(2.4), position.clone().addScaledVector(normal, 3.9).add(v3((sign * width) / 2 - sign * 5, 0, 0).applyQuaternion(quaternion)), quaternion));
    }
  }

  if (spec.pocket !== "none" && form.height > 100) {
    const mouthY = form.height * 0.52;
    const halfWidth = form.width * 0.33;
    const bottom = form.height * 0.16;
    if (spec.pocket === "slip") {
      const columns = Math.round(44 * detail);
      const rowsCount = Math.round(28 * detail);
      const patch = new Patch();
      const raised = (x: number, y: number) => {
        const edgeX = 1 - Math.abs(x) / halfWidth;
        const edgeY = Math.min((y - bottom) / (mouthY - bottom), 1);
        return 2.2 * smooth(0, 0.05, edgeX) * smooth(0, 0.08, edgeY) + 0.5 + (1 - (2 * Math.abs(x) / (halfWidth * 2)) ** 2) * edgeY * (1 - edgeY) * 3;
      };
      for (let c = 0; c <= columns; c++) {
        for (let r = 0; r <= rowsCount; r++) {
          const x = -halfWidth + (2 * halfWidth * c) / columns;
          const y = bottom + ((mouthY - bottom) * r) / rowsCount;
          patch.vertex(v3(x, y, panelZ(shell, x, y) + raised(x, y)), paintUv(shell, x, y, 1), [x + 800, y + 800], 1);
        }
      }
      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rowsCount; r++) {
          const a = c * (rowsCount + 1) + r;
          const b = (c + 1) * (rowsCount + 1) + r;
          patch.indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      frontExtras.push(patch);
      const edge = (x: number, y: number, lift: number) => v3(x, y, panelZ(shell, x, y) + lift);
      const hem: V3[] = [];
      for (let i = 0; i <= 50; i++) hem.push(edge(-halfWidth + (2 * halfWidth * i) / 50, mouthY, 2.2));
      edgeParts.push(sweep(hem, { hw: 1.05, ht: 1.3, exp: 0.8 }, v3(0, 0, 1), false, 8));
      const seam: V3[] = [];
      const inner = halfWidth - 4;
      for (let i = 0; i <= 12; i++) seam.push(edge(-inner, mouthY - 3 - ((mouthY - bottom - 7) * i) / 12, 3));
      for (let i = 1; i <= 30; i++) seam.push(edge(-inner + (2 * inner * i) / 30, bottom + 4, 3));
      for (let i = 1; i <= 12; i++) seam.push(edge(inner, bottom + 4 + ((mouthY - bottom - 7) * i) / 12, 3));
      stitches.push(...placeOnPath(seam, pitch, v3(0, 0, 1)));
    } else {
      const lift = 1;
      const zipLine: V3[] = [];
      for (let i = 0; i <= 50; i++) {
        const x = -halfWidth + (2 * halfWidth * i) / 50;
        zipLine.push(v3(x, mouthY, panelZ(shell, x, mouthY) + lift));
      }
      zipParts.push(sweep(zipLine, { hw: 4.2, ht: 0.5, exp: 0.7 }, v3(0, 1, 0), false, 8));
      for (const sign of [-1, 1]) {
        const welt = zipLine.map((p) => p.clone().add(v3(0, sign * 5.4, 0.5)));
        edgeParts.push(sweep(welt, { hw: 1.3, ht: 0.9, exp: 0.8 }, v3(0, 1, 0), false, 8));
        const seam = zipLine.map((p) => p.clone().add(v3(0, sign * 8.6, 0)));
        stitches.push(...placeOnPath(seam, pitch, v3(0, 0, 1)));
      }
      for (const tooth of placeOnPath(zipLine, 2.7, v3(0, 0, 1))) metal.push(place(toothGeometry, warped(tooth.position.clone().add(v3(0, 0, 0.5)))));
      const end = zipLine[Math.floor(zipLine.length * 0.84)]!;
      metal.push(place(roundedPlate(8, 8, 3.2, 1.6, 0.6), warped(end.clone().add(v3(0, 0, 1.6)))));
      metal.push(place(zipPullGeometry(), warped(end.clone().add(v3(0, -11, 3)))));
    }
  }

  if (spec.hardware.feet && form.depth >= 40) {
    const foot = lathe([[4.4, 0], [5.1, 0.3], [5.3, 1.6], [4.8, 3.2], [3.2, 4.2], [0, 4.4]], 24);
    const fx = sideX(form, 0) * 0.76;
    const fz = form.depth * 0.34;
    for (const x of [-fx, fx]) for (const z of [-fz, fz]) metal.push(place(foot, v3(x, 0.4, z), euler(Math.PI / 2, 0, 0)));
  }

  const front = seal(frontExtras.length ? mergePatches([frontPatch, ...frontExtras]) : frontPatch, warp);
  const back = seal(backPatch, warp);

  let lining: THREE.BufferGeometry | null = null;
  if (isOpenTop(spec) || open) {
    const coarse = buildOutline(form, Math.round(LINING_OUTLINE * Math.max(detail, 0.7)));
    const interior = (y: number) => 0.2 + 0.8 * smooth(form.height * 0.1, form.height * 0.98, y);
    const parts: THREE.BufferGeometry[] = [
      offsetCopy(seal(buildPanel(shell, coarse, 1, LINING_RINGS), warp), -LEATHER_MM, interior),
      offsetCopy(seal(buildPanel(shell, coarse, -1, LINING_RINGS), warp), -LEATHER_MM, interior),
      offsetCopy(seal(buildGusset(spec, coarse, 14, open), warp), -LEATHER_MM, interior),
    ];
    if (flap) {
      parts.push(offsetCopy(flap, -LEATHER_MM * 0.8, () => 0.82));
    }
    lining = mergeGeometries(parts);
  }

  const hardware = metal.length ? mergeGeometries(metal) : null;
  const leatherStraps = straps.length ? seal(mergePatches(straps), warpRigid(warp, form)) : null;
  const edges = seal(mergePatches(edgeParts), warp);
  zipTape = zipParts.length ? seal(mergePatches(zipParts), warp) : null;

  const finalStitches = stitches.map(({ position, tangent, normal }) => {
    const anchor = warped(position);
    const ahead = warped(position.clone().addScaledVector(tangent, 1)).sub(anchor).normalize();
    return { position: anchor.multiplyScalar(UNIT_PER_MM), tangent: ahead, normal };
  });

  const maxY = form.height + Math.max(form.topArc, 0) * 0.32 * form.height + Math.max(carry.handles ? carry.handleDrop : 0, carry.strap ? strapRise(spec) + 20 : 0);
  return {
    front, back, gusset, lining, flap, edges, leatherStraps, hardware, zipTape,
    stitches: finalStitches,
    centerY: (maxY / 2) * UNIT_PER_MM,
    radius: (Math.hypot(form.width, maxY, form.depth) / 2) * UNIT_PER_MM,
    stitchSpan: spec.stitch.length * 0.7 * UNIT_PER_MM,
    groundY: (spec.hardware.feet && form.depth >= 40 ? -5 : -beadRadial - 0.2) * UNIT_PER_MM,
  };
}

function warpRigid(warp: Warp, form: Form): Warp {
  return (x, y, z) => warp(x, Math.min(y, form.height * 1.0), z).map((value, axis) => (axis === 1 && y > form.height ? value + (y - form.height) : value)) as [number, number, number];
}

function mergePatches(patches: Patch[]) {
  const out = new Patch();
  for (const patch of patches) {
    const base = out.count;
    out.positions.push(...patch.positions);
    out.paint.push(...patch.paint);
    out.grain.push(...patch.grain);
    out.shade.push(...patch.shade);
    for (const index of patch.indices) out.indices.push(index + base);
  }
  return out;
}

export function disposeBag(bag: BagGeometry) {
  for (const value of Object.values(bag)) {
    if (value instanceof THREE.BufferGeometry) value.dispose();
  }
}
