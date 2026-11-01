import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BespokePiece } from "@/lib/bespoke/design";
import { boundsOf, contains, offsetInward, offsetPath, PUFF_REACH_MM, samplePath, type StitchRun, type Vec } from "@/lib/bespoke/outline";

export const UNIT = 0.01;
export const THICKNESS_MM = 2.4;
const BEVEL_MM = 0.7;
const WALL_INSET_MM = 1.1;
const FOLD_SOFTNESS_MM = 4;
const CREASE = { flat: 0.2, shell: 0.7 };

export type Frame = { position: THREE.Vector3; normal: THREE.Vector3 };
export type Surface = { top: (x: number, y: number) => number; place: (x: number, y: number, z: number) => THREE.Vector3; frame: (x: number, y: number, lift: number) => Frame; axis: boolean };
export type Stitch = { position: THREE.Vector3; along: THREE.Vector3; normal: THREE.Vector3 };

function finish(geometry: THREE.BufferGeometry, crease: number, shade?: (z: number) => number) {
  const creased = toCreasedNormals(geometry, crease);
  if (creased !== geometry) geometry.dispose();
  const uv = creased.getAttribute("uv") as THREE.BufferAttribute;
  const position = creased.getAttribute("position") as THREE.BufferAttribute;
  creased.setAttribute("aGrain", uv.clone());
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const value = shade ? shade(position.getZ(i)) : 1;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = value;
  }
  creased.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  creased.scale(UNIT, UNIT, UNIT);
  creased.computeBoundingSphere();
  return creased;
}

const up = (point: Vec) => new THREE.Vector2(point.x, -point.y);

function toShape(outline: Vec[], holes: Vec[][]) {
  const shape = new THREE.Shape(outline.map(up));
  shape.holes = holes.map((hole) => new THREE.Path(hole.map(up)));
  return shape;
}

export function flatPanel(outline: Vec[], holes: Vec[][]) {
  const geometry = new THREE.ExtrudeGeometry(toShape(outline, holes), {
    depth: THICKNESS_MM - BEVEL_MM * 2,
    steps: 1,
    curveSegments: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL_MM,
    bevelSize: BEVEL_MM,
    bevelOffset: -BEVEL_MM,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, BEVEL_MM);
  return finish(geometry, CREASE.flat);
}

export function delaunay(points: Vec[]) {
  const box = boundsOf(points);
  const span = Math.max(box.width, box.height, 1) * 12;
  const mx = (box.minX + box.maxX) / 2;
  const my = (box.minY + box.maxY) / 2;
  const all = [...points, { x: mx - span, y: my - span }, { x: mx + span, y: my - span }, { x: mx, y: my + span }];
  const n = points.length;
  type Tri = { a: number; b: number; c: number; x: number; y: number; r: number };
  const circle = (a: number, b: number, c: number): Tri => {
    const pa = all[a]!;
    const pb = all[b]!;
    const pc = all[c]!;
    const d = 2 * (pa.x * (pb.y - pc.y) + pb.x * (pc.y - pa.y) + pc.x * (pa.y - pb.y)) || 1e-9;
    const sa = pa.x * pa.x + pa.y * pa.y;
    const sb = pb.x * pb.x + pb.y * pb.y;
    const sc = pc.x * pc.x + pc.y * pc.y;
    const x = (sa * (pb.y - pc.y) + sb * (pc.y - pa.y) + sc * (pa.y - pb.y)) / d;
    const y = (sa * (pc.x - pb.x) + sb * (pa.x - pc.x) + sc * (pb.x - pa.x)) / d;
    return { a, b, c, x, y, r: (pa.x - x) ** 2 + (pa.y - y) ** 2 };
  };
  let triangles = [circle(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const point = all[i]!;
    const edges = new Map<string, [number, number]>();
    const kept: Tri[] = [];
    for (const tri of triangles) {
      if ((point.x - tri.x) ** 2 + (point.y - tri.y) ** 2 > tri.r) {
        kept.push(tri);
        continue;
      }
      for (const [u, v] of [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]] as [number, number][]) {
        const key = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (edges.has(key)) edges.delete(key);
        else edges.set(key, [u, v]);
      }
    }
    for (const [u, v] of edges.values()) kept.push(circle(u, v, i));
    triangles = kept;
  }
  return triangles.filter((tri) => tri.a < n && tri.b < n && tri.c < n).map((tri) => [tri.a, tri.b, tri.c] as [number, number, number]);
}

function densify(ring: Vec[], step: number) {
  const result: Vec[] = [];
  ring.forEach((point, i) => {
    const next = ring[(i + 1) % ring.length]!;
    const count = Math.max(1, Math.ceil(Math.hypot(next.x - point.x, next.y - point.y) / step));
    for (let j = 0; j < count; j++) result.push({ x: point.x + ((next.x - point.x) * j) / count, y: point.y + ((next.y - point.y) * j) / count });
  });
  return result;
}

function edgeDistance(point: Vec, rings: Vec[][]) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const span = dx * dx + dy * dy;
      const t = span ? Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / span)) : 0;
      best = Math.min(best, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
    }
  }
  return best;
}

function foldAxis(fold: BespokePiece["fold"]) {
  if (!fold || !fold.angle) return null;
  const a = new THREE.Vector3(fold.ax, -fold.ay, 0);
  const u = new THREE.Vector3(fold.bx - fold.ax, -(fold.by - fold.ay), 0);
  if (u.lengthSq() < 1) return null;
  u.normalize();
  return { a, u, n: new THREE.Vector3(-u.y, u.x, 0), angle: THREE.MathUtils.degToRad(fold.angle) };
}

export function makeSurface(outline: Vec[], holes: Vec[][], piece: Pick<BespokePiece, "puff" | "fold">, foldable: boolean, zBase = 0, pivotZ = zBase): Surface {
  const rings = [outline, ...holes];
  const box = boundsOf(outline);
  const reach = Math.max(1, Math.min(PUFF_REACH_MM, Math.min(box.width, box.height) / 2));
  const top = (x: number, y: number) => {
    if (!piece.puff) return 0;
    const point = { x, y };
    if (!contains(outline, point)) return 0;
    const t = Math.min(1, edgeDistance(point, rings) / reach);
    return piece.puff * Math.sqrt(1 - (1 - t) ** 2);
  };
  const axis = foldable ? foldAxis(piece.fold) : null;
  if (axis) axis.a.z = pivotZ;
  const turn = (point: THREE.Vector3) => {
    if (!axis) return point;
    const relative = point.clone().sub(axis.a);
    const t = THREE.MathUtils.smoothstep(relative.dot(axis.n), -FOLD_SOFTNESS_MM, FOLD_SOFTNESS_MM);
    return relative.applyAxisAngle(axis.u, axis.angle * t).add(axis.a);
  };
  const place = (x: number, y: number, z: number) => turn(new THREE.Vector3(x, -y, z + zBase));
  const frame = (x: number, y: number, lift: number) => {
    const position = place(x, y, THICKNESS_MM + top(x, y) + lift);
    const delta = 1.5;
    const east = place(x + delta, y, THICKNESS_MM + top(x + delta, y) + lift).sub(position);
    const north = place(x, y - delta, THICKNESS_MM + top(x, y - delta) + lift).sub(position);
    return { position, normal: east.cross(north).normalize() };
  };
  return { top, place, frame, axis: Boolean(axis) };
}

function capMesh(outline: Vec[], holes: Vec[][], fold: BespokePiece["fold"], dense: boolean) {
  const box = boundsOf(outline);
  const step = dense ? Math.min(24, Math.max(5, Math.max(box.width, box.height) / 28)) : Math.max(box.width, box.height) / 8;
  const ring = densify(outline, step);
  const holeRings = holes.map((hole) => densify(hole, Math.min(step, 8)));
  const allRings = [ring, ...holeRings];
  const inner: Vec[] = [];
  const allowed = (point: Vec, clearance: number) => contains(outline, point) && holes.every((hole) => !contains(hole, point)) && edgeDistance(point, allRings) > clearance;
  if (dense) {
    let row = 0;
    for (let y = box.minY + step / 2; y < box.maxY; y += step * 0.87, row++) {
      for (let x = box.minX + (row % 2 ? step / 2 : 0); x < box.maxX; x += step) {
        const point = { x, y };
        if (allowed(point, step * 0.5)) inner.push(point);
      }
    }
  }
  if (fold?.angle) {
    const dx = fold.bx - fold.ax;
    const dy = fold.by - fold.ay;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const far = Math.hypot(box.width, box.height);
    for (const offset of [-FOLD_SOFTNESS_MM, -FOLD_SOFTNESS_MM / 2, 0, FOLD_SOFTNESS_MM / 2, FOLD_SOFTNESS_MM]) {
      for (let t = -far; t <= far; t += 4) {
        const point = { x: fold.ax + ux * t - uy * offset, y: fold.ay + uy * t + ux * offset };
        if (allowed(point, 1.5) && inner.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > 1.5)) inner.push(point);
      }
    }
  }
  const flat = [...ring, ...holeRings.flat(), ...inner];
  const faces = delaunay(flat).filter(([a, b, c]) => {
    const pa = flat[a]!;
    const pb = flat[b]!;
    const pc = flat[c]!;
    const center = { x: (pa.x + pb.x + pc.x) / 3, y: (pa.y + pb.y + pc.y) / 3 };
    return contains(outline, center) && holes.every((hole) => !contains(hole, center));
  });
  return { ring, holeRings, flat, faces };
}

function writeCap(positions: number[], normals: number[], uvs: number[], flat: Vec[], faces: [number, number, number][], vertex: (point: Vec) => THREE.Vector3, up_: boolean) {
  const placed = flat.map(vertex);
  const shared = flat.map(() => new THREE.Vector3());
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const face = new THREE.Vector3();
  const oriented = faces.map(([a, b, c]) => {
    ab.subVectors(placed[b]!, placed[a]!);
    ac.subVectors(placed[c]!, placed[a]!);
    face.crossVectors(ab, ac);
    const pa = flat[a]!;
    const pb = flat[b]!;
    const pc = flat[c]!;
    const yUpCross = (pb.x - pa.x) * -(pc.y - pa.y) - -(pb.y - pa.y) * (pc.x - pa.x);
    const swap = up_ ? yUpCross < 0 : yUpCross > 0;
    if (swap) face.negate();
    shared[a]!.add(face);
    shared[b]!.add(face);
    shared[c]!.add(face);
    return swap ? ([a, c, b] as const) : ([a, b, c] as const);
  });
  for (const tri of oriented) {
    for (const index of tri) {
      const point = placed[index]!;
      const normal = shared[index]!.clone().normalize();
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(flat[index]!.x, -flat[index]!.y);
    }
  }
}

function writeWall(positions: number[], normals: number[], uvs: number[], loop: Vec[], vertex: (point: Vec, front: boolean) => THREE.Vector3, outwardFromMaterial: boolean) {
  const clockwise = THREE.ShapeUtils.isClockWise(loop.map(up));
  const keep = clockwise !== outwardFromMaterial;
  const normal = new THREE.Vector3();
  let arc = 0;
  loop.forEach((point, i) => {
    const next = loop[(i + 1) % loop.length]!;
    const span = Math.hypot(next.x - point.x, next.y - point.y);
    const [p, q] = keep ? [point, next] : [next, point];
    const a = vertex(p, false);
    const b = vertex(q, false);
    const c = vertex(q, true);
    const d = vertex(p, true);
    normal.subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    const rise = a.distanceTo(d);
    const rows: [THREE.Vector3, number, number][] = [[a, arc, 0], [b, arc + span, 0], [c, arc + span, rise], [a, arc, 0], [c, arc + span, rise], [d, arc, rise]];
    for (const [vector, u, v] of rows) {
      positions.push(vector.x, vector.y, vector.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, v);
    }
    arc += span;
  });
}

function packed(positions: number[], normals: number[], uvs: number[], shade?: (z: number) => number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aGrain", new THREE.Float32BufferAttribute(uvs, 2));
  const count = positions.length / 3;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const value = shade ? shade(positions[i * 3 + 2]!) : 1;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = value;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.scale(UNIT, UNIT, UNIT);
  geometry.computeBoundingSphere();
  return geometry;
}

export function shellPanel(outline: Vec[], holes: Vec[][], surface: Surface, mirrored: boolean, fold: BespokePiece["fold"]) {
  const { ring, holeRings, flat, faces } = capMesh(outline, holes, fold, true);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const z = (point: Vec, front: boolean) => {
    const value = front ? THICKNESS_MM + surface.top(point.x, point.y) : 0;
    return mirrored ? THICKNESS_MM - value : value;
  };
  const vertex = (point: Vec, front: boolean) => surface.place(point.x, point.y, z(point, front));
  writeCap(positions, normals, uvs, flat, faces, (point) => vertex(point, true), !mirrored);
  writeCap(positions, normals, uvs, flat, faces, (point) => vertex(point, false), mirrored);
  const wall = mirrored ? (point: Vec, front: boolean) => vertex(point, !front) : vertex;
  writeWall(positions, normals, uvs, ring, wall, true);
  holeRings.forEach((hole) => writeWall(positions, normals, uvs, hole, wall, false));
  return packed(positions, normals, uvs);
}

export function wallStrip(outline: Vec[], depth: number, inset: number, surface: Surface, inward: boolean) {
  const loop = densify(offsetInward(outline, inset), 10);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  writeWall(positions, normals, uvs, loop, (point, front) => surface.place(point.x, point.y, front ? depth / 2 : -depth / 2), !inward);
  const shade = inward ? undefined : (z: number) => 0.5 + 0.4 * Math.min(1, (depth / 2 - Math.abs(z)) / Math.max(depth * 0.18, 6));
  return packed(positions, normals, uvs, shade);
}

export function liningPlate(outline: Vec[], holes: Vec[][], surface: Surface, z: number, facesFront: boolean, fold: BespokePiece["fold"]) {
  const { flat, faces } = capMesh(offsetInward(outline, 1.6), holes, fold, Boolean(fold?.angle));
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  writeCap(positions, normals, uvs, flat, faces, (point) => surface.place(point.x, point.y, z), facesFront);
  return packed(positions, normals, uvs);
}

export function stitchesOn(runs: StitchRun[], surface: Surface, lift: number, atBack: boolean): Stitch[] {
  const list: Stitch[] = [];
  for (const { points, ring } of runs) {
    const count = points.length;
    const located = points.map((point) => {
      if (atBack) return { position: surface.place(point.x, point.y, -lift - surface.top(point.x, point.y)), normal: new THREE.Vector3(0, 0, -1) };
      return surface.frame(point.x, point.y, lift);
    });
    located.forEach((item, index) => {
      const next = located[index + 1] ?? (ring ? located[0]! : item);
      const previous = located[index - 1] ?? (ring ? located[count - 1]! : item);
      const along = next.position.clone().sub(previous.position);
      if (along.lengthSq() < 1e-6) return;
      list.push({ position: item.position, along: along.normalize(), normal: item.normal });
    });
  }
  return list;
}

export function tubeHeight(width: number, style: BespokePiece["tubeStyle"] = "rolled") {
  if (style === "flat") return Math.min(width * 0.2, 3.2);
  if (style === "bar") return Math.min(width * 0.9, 16);
  if (style === "chain") return Math.min(width * 0.3, 3);
  return Math.min(width * 0.5, 8);
}

export function tubePath(path: Vec[]) {
  return samplePath(path, 4);
}

export function tubeGeometry(path: Vec[], width: number, style: BespokePiece["tubeStyle"]) {
  const sampled = tubePath(path);
  const height = tubeHeight(width, style);
  const sides = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let walked = 0;
  sampled.forEach((point, index) => {
    const before = sampled[Math.max(0, index - 1)]!;
    const after = sampled[Math.min(sampled.length - 1, index + 1)]!;
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    const nx = -(after.y - before.y) / length;
    const ny = (after.x - before.x) / length;
    if (index) walked += Math.hypot(point.x - sampled[index - 1]!.x, point.y - sampled[index - 1]!.y);
    for (let side = 0; side <= sides; side++) {
      const angle = (side / sides) * Math.PI * 2;
      const across = (Math.cos(angle) * width) / 2;
      positions.push(point.x + nx * across, -(point.y + ny * across), height / 2 + (Math.sin(angle) * height) / 2);
      uvs.push(walked, (side / sides) * width * 2);
    }
  });
  const stride = sides + 1;
  for (let i = 0; i < sampled.length - 1; i++) {
    for (let side = 0; side < sides; side++) {
      const a = i * stride + side;
      const b = a + stride;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const capBase = positions.length / 3;
  [0, sampled.length - 1].forEach((row, cap) => {
    const center = sampled[row]!;
    positions.push(center.x, -center.y, height / 2);
    uvs.push(0, 0);
    const hub = capBase + cap * (stride + 1);
    for (let side = 0; side <= sides; side++) {
      const at = row * stride + side;
      positions.push(positions[at * 3]!, positions[at * 3 + 1]!, positions[at * 3 + 2]!);
      uvs.push(side, 0);
      if (side < sides) {
        if (cap) indices.push(hub, hub + side + 1, hub + side + 2);
        else indices.push(hub, hub + side + 2, hub + side + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const open = geometry.toNonIndexed();
  geometry.dispose();
  open.computeVertexNormals();
  return finish(open, 0.9);
}

export function chainLinks(path: Vec[], pitch: number) {
  const points = samplePath(path, pitch / 2);
  return points.flatMap((point, index) => {
    if (index % 2 || !points[index + 1]) return [];
    const next = points[index + 1]!;
    return [{ x: point.x, y: point.y, angle: Math.atan2(-(next.y - point.y), next.x - point.x), turned: index % 4 === 0 }];
  });
}

export function tubeStitches(path: Vec[], width: number, style: BespokePiece["tubeStyle"]): Stitch[] {
  if (style === "chain") return [];
  const height = tubeHeight(width, style);
  const list: Stitch[] = [];
  for (const side of [-1, 1]) {
    const across = (width / 2 - Math.min(3, width * 0.18)) * side;
    const line = samplePath(offsetPath(path, across), 4);
    const rise = (Math.sqrt(Math.max(0, 1 - (across / (width / 2)) ** 2)) * height) / 2 + height / 2 + 0.05;
    line.forEach((point, index) => {
      const next = line[Math.min(line.length - 1, index + 1)]!;
      const previous = line[Math.max(0, index - 1)]!;
      const along = new THREE.Vector3(next.x - previous.x, -(next.y - previous.y), 0);
      if (along.lengthSq() < 1e-6) return;
      list.push({ position: new THREE.Vector3(point.x, -point.y, rise), along: along.normalize(), normal: new THREE.Vector3(0, 0, 1) });
    });
  }
  return list;
}
