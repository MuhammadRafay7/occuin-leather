"use client";

import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { CHAIN_PITCH_MM, visibleDesign } from "@/lib/bespoke/estimate";
import type { BespokeDesign, BespokePiece, DesignView } from "@/lib/bespoke/design";
import { bodyOf, contains, groupBounds, holeOutlines, isSolidPanel, layerOrder, outlineFrom, outlineOf, stitchRuns, textPlacement, type Vec } from "@/lib/bespoke/outline";
import { COLORS, METALS, THREADS, type FinishKey, type Hide } from "@/lib/studio/spec";
import { createLeather, dressLeather, lightingUniforms, loadGrainTile, patchLighting, shade, threadBump, type GrainTile } from "@/lib/studio/textures";
import { chainLinks, flatPanel, liningPlate, makeSurface, shellPanel, stitchesOn, THICKNESS_MM, tubeGeometry, tubeHeight, tubeStitches, UNIT, wallStrip, type Frame, type Stitch } from "./forms";
import { takeShot, type ShotTaker } from "@/components/studio/shot";
import type { PreviewView } from "./stage";

const STACK_GAP_MM = 0.5;
const STILL_LONG_EDGE_PX = 2000;
const FOV = 26;
const FRAMING = 1.3;
const ENV_ROTATION = 0.6;
const SOFTBOX = { direction: new THREE.Vector3(0.42, 0.52, 0.74), halfWidth: 0.85, halfHeight: 0.62, radiance: 2.6, tint: [1, 0.97, 0.93] };
const ANGLES: Record<PreviewView, { theta: number; phi: number }> = {
  angle: { theta: -0.5, phi: 1.32 },
  front: { theta: 0, phi: Math.PI / 2 - 0.04 },
  back: { theta: Math.PI, phi: Math.PI / 2 - 0.04 },
  side: { theta: Math.PI / 2, phi: Math.PI / 2 - 0.04 },
};

type Tiles = Partial<Record<FinishKey, GrainTile>>;
type OrbitHandle = ComponentRef<typeof OrbitControls>;
type Placed = { piece: BespokePiece; z: number };

function useLeather(finish: FinishKey, color: BespokePiece["color"], tiles: Tiles) {
  const material = useMemo(() => createLeather(), []);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const hide: Hide = { finish, color };
    dressLeather(material, hide, hide, null, 1, tiles);
    invalidate();
  }, [material, finish, color, tiles, invalidate]);
  return material;
}

function useDisposed<T extends { dispose: () => void }>(resource: T) {
  useEffect(() => () => resource.dispose(), [resource]);
  return resource;
}

function Stitches({ stitches, offset, color }: { stitches: Stitch[]; offset: number; color: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const material = useDisposed(useMemo(() => patchLighting(new THREE.MeshStandardMaterial({ roughness: 0.62, bumpMap: threadBump(), bumpScale: 0.6 })), []));
  const geometry = useDisposed(useMemo(() => new THREE.CapsuleGeometry(0.48 * UNIT, 2.2 * UNIT, 3, 6), []));

  useLayoutEffect(() => {
    material.color.set(color);
    invalidate();
  }, [material, color, invalidate]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const matrix = new THREE.Matrix4();
    const flatten = new THREE.Matrix4().makeScale(1, 1, 0.7);
    const across = new THREE.Vector3();
    const along = new THREE.Vector3();
    stitches.forEach((stitch, index) => {
      across.crossVectors(stitch.normal, stitch.along).normalize();
      along.copy(stitch.along).multiplyScalar(Math.cos(0.26)).addScaledVector(across, Math.sin(0.26)).normalize();
      across.crossVectors(along, stitch.normal).normalize();
      matrix.makeBasis(across, along, stitch.normal).multiply(flatten).setPosition(stitch.position.x * UNIT, stitch.position.y * UNIT, (stitch.position.z + offset) * UNIT);
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
    invalidate();
  }, [stitches, offset, invalidate]);

  if (!stitches.length) return null;
  return <instancedMesh key={stitches.length} ref={mesh} args={[geometry, material, stitches.length]} frustumCulled={false} castShadow />;
}

function fontFamily(variable: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || "serif";
}

const AHEAD = new THREE.Vector3(0, 0, 1);
const facing = (normal: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(AHEAD, normal);

function TextMark({ piece, frame, z }: { piece: BespokePiece; frame: Frame; z: number }) {
  const invalidate = useThree((state) => state.invalidate);
  const text = piece.text;
  const value = text?.value ?? "";
  const technique = text?.technique ?? "blind";
  const font = text?.font ?? "didone";
  const placement = textPlacement(piece);
  const built = useMemo(() => {
    const px = 160;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const style = `${font === "didone" ? 600 : 500} ${px}px ${fontFamily(font === "didone" ? "--font-bodoni" : "--font-geist")}, serif`;
    ctx.font = style;
    canvas.width = Math.min(2048, Math.ceil(ctx.measureText(value).width) + 32);
    canvas.height = Math.round(px * 1.5);
    ctx.font = style;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = technique === "gold" ? "#e2b963" : technique === "palladium" ? "#dcdcd8" : "#000000";
    ctx.fillText(value, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return { texture, aspect: canvas.width / canvas.height };
  }, [value, technique, font]);
  const material = useDisposed(
    useMemo(
      () =>
        patchLighting(
          new THREE.MeshStandardMaterial({
            map: built.texture,
            transparent: true,
            opacity: technique === "blind" ? 0.34 : 1,
            metalness: technique === "blind" ? 0 : 0.35,
            roughness: 0.38,
            depthWrite: false,
          }),
        ),
      [built, technique],
    ),
  );
  useEffect(() => () => built.texture.dispose(), [built]);
  useEffect(() => invalidate(), [built, invalidate]);
  const height = placement.size * 1.5 * UNIT;
  return (
    <mesh position={[frame.position.x * UNIT, frame.position.y * UNIT, (frame.position.z + z) * UNIT + 0.0006]} quaternion={facing(frame.normal)} material={material}>
      <planeGeometry args={[height * built.aspect, height]} />
    </mesh>
  );
}

function HardwareMesh({ item, frame, z, material, leather }: { item: BespokePiece["hardware"][number]; frame: Frame; z: number; material: THREE.Material; leather: THREE.Material }) {
  const u = UNIT;
  const quaternion = useMemo(() => facing(frame.normal).multiply(new THREE.Quaternion().setFromAxisAngle(AHEAD, THREE.MathUtils.degToRad(-item.rotation))), [frame.normal, item.rotation]);
  const position: [number, number, number] = [frame.position.x * u, frame.position.y * u, (frame.position.z + z) * u];
  return (
    <group position={position} quaternion={quaternion}>
      {item.kind === "rivet" ? (
        <mesh material={material} castShadow scale={[1, 1, 0.4]} position={[0, 0, 0.3 * u]}>
          <sphereGeometry args={[5 * u, 20, 12]} />
        </mesh>
      ) : null}
      {item.kind === "turnlock" ? (
        <>
          <mesh material={material} castShadow position={[0, 0, 0.8 * u]}><boxGeometry args={[34 * u, 20 * u, 1.6 * u]} /></mesh>
          <mesh material={material} castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 2.6 * u]}><cylinderGeometry args={[6 * u, 7 * u, 2.4 * u, 24]} /></mesh>
          <mesh material={material} castShadow position={[0, 0, 4.6 * u]}><boxGeometry args={[14 * u, 3.4 * u, 2.4 * u]} /></mesh>
        </>
      ) : null}
      {item.kind === "buckle" ? (
        <>
          {[[-17, 0, 3, 28], [17, 0, 3, 28], [0, -13, 37, 3], [0, 13, 37, 3], [0, 0, 2.4, 28]].map(([x, y, w, h], index) => (
            <mesh key={index} material={material} castShadow position={[x! * u, y! * u, 1.4 * u]}><boxGeometry args={[w! * u, h! * u, 2.6 * u]} /></mesh>
          ))}
          <mesh material={material} castShadow position={[9 * u, 0, 2.4 * u]}><boxGeometry args={[20 * u, 2 * u, 1.4 * u]} /></mesh>
        </>
      ) : null}
      {item.kind === "ring" && item.shape !== "square" ? (
        <mesh material={material} castShadow position={[0, 0, 1.6 * u]}><torusGeometry args={[(item.shape === "long" ? 9 : 13) * u, 1.8 * u, 10, 30]} /></mesh>
      ) : null}
      {item.kind === "ring" && item.shape === "square" ? [[-12, 0, 3, 27], [12, 0, 3, 27], [0, -12, 27, 3], [0, 12, 27, 3]].map(([x, y, w, h], index) => (
        <mesh key={index} material={material} castShadow position={[x! * u, y! * u, 1.6 * u]}><boxGeometry args={[w! * u, h! * u, 2.8 * u]} /></mesh>
      )) : null}
      {item.kind === "foot" ? (
        <mesh material={material} castShadow scale={[1, 1, 0.6]} position={[0, 0, 0.6 * u]}>
          {item.shape === "square" ? <boxGeometry args={[12 * u, 12 * u, 5 * u]} /> : <sphereGeometry args={[6.5 * u, 20, 12]} />}
        </mesh>
      ) : null}
      {item.kind === "snap" ? (
        <>
          <mesh material={material} castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.8 * u]}><cylinderGeometry args={[9 * u, 9 * u, 1.6 * u, 28]} /></mesh>
          <mesh material={material} castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.9 * u]}><cylinderGeometry args={[4 * u, 4 * u, 1 * u, 20]} /></mesh>
        </>
      ) : null}
      {item.kind === "stud" ? (
        <mesh material={material} castShadow scale={[1, 1, 0.5]} position={[0, 0, 0.5 * u]}><sphereGeometry args={[7 * u, 20, 12]} /></mesh>
      ) : null}
      {item.kind === "pull" ? (
        <>
          <mesh material={material} castShadow position={[0, -3 * u, 1.2 * u]}><boxGeometry args={[(item.shape === "long" ? 5 : item.shape === "round" ? 11 : 8) * u, (item.shape === "long" ? 26 : 16) * u, 1.8 * u]} /></mesh>
          <mesh material={material} castShadow position={[0, 7 * u, 1.2 * u]}><torusGeometry args={[2.6 * u, 0.9 * u, 8, 16]} /></mesh>
        </>
      ) : null}
      {item.kind === "dring" ? (
        <>
          <mesh material={material} castShadow position={[0, 0, 1.6 * u]}><torusGeometry args={[12 * u, 1.6 * u, 10, 24, Math.PI]} /></mesh>
          <mesh material={material} castShadow rotation={[0, 0, Math.PI / 2]} position={[0, 0, 1.6 * u]}><cylinderGeometry args={[1.6 * u, 1.6 * u, 24 * u, 10]} /></mesh>
        </>
      ) : null}
      {item.kind === "zip" ? (
        <>
          <mesh material={leather} position={[0, 0, 0.4 * u]}><boxGeometry args={[item.length * u, 8 * u, 0.8 * u]} /></mesh>
          <mesh material={material} castShadow position={[0, 0, 1 * u]}><boxGeometry args={[item.length * u, 2.4 * u, 1.2 * u]} /></mesh>
          <mesh material={material} castShadow position={[(item.length / 2 - 8) * u, 0, 1.8 * u]}><boxGeometry args={[7 * u, 6 * u, 2.4 * u]} /></mesh>
          <mesh material={material} castShadow position={[(item.length / 2 - 8) * u, -8 * u, 2 * u]}><boxGeometry args={[3 * u, 13 * u, 1 * u]} /></mesh>
        </>
      ) : null}
    </group>
  );
}

function useHardware(metal: BespokeDesign["metal"]) {
  const metalMaterial = useDisposed(useMemo(() => patchLighting(new THREE.MeshStandardMaterial({ metalness: 1 })), []));
  const tape = useDisposed(useMemo(() => patchLighting(new THREE.MeshStandardMaterial({ color: "#191714", roughness: 0.82 })), []));
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    metalMaterial.color.set(METALS[metal].hex);
    metalMaterial.setValues({ roughness: METALS[metal].roughness });
    invalidate();
  }, [metal, metalMaterial, invalidate]);
  return { metalMaterial, tape };
}

type PanelProps = { piece: BespokePiece; z: number; face?: "front" | "back"; holesKey: string; foldable: boolean; pivot?: number; tiles: Tiles; metal: BespokeDesign["metal"] };

const Panel = memo(function Panel({ piece, z, face = "front", holesKey, foldable, pivot, tiles, metal }: PanelProps) {
  const { points, mirror, closed, axisX, finish, color, stitched, thread, puff, fold, hardware } = piece;
  const outline = useMemo(() => outlineFrom(points, mirror, closed, axisX), [points, mirror, closed, axisX]);
  const holes = useMemo(() => JSON.parse(holesKey) as Vec[][], [holesKey]);
  const deformed = Boolean(puff) || Boolean(foldable && fold?.angle);
  const surface = useMemo(() => makeSurface(outline, holes, { puff, fold }, foldable, z, pivot ?? z), [outline, holes, puff, fold, foldable, z, pivot]);
  const geometry = useDisposed(useMemo(() => (deformed ? shellPanel(outline, holes, surface, face === "back", fold) : flatPanel(outline, holes)), [outline, holes, deformed, surface, face, fold]));
  const runs = useMemo(() => (stitched ? stitchRuns(outline, holes) : []), [outline, holes, stitched]);
  const stitches = useMemo(() => stitchesOn(runs, surface, 0.08, face === "back"), [runs, surface, face]);
  const material = useLeather(finish, color, tiles);
  const { metalMaterial, tape } = useHardware(metal);
  const threadColor = THREADS[thread].hex || shade(COLORS[color].hex, 1.35);
  const textAt = textPlacement(piece);
  return (
    <group>
      <group position={[0, 0, deformed ? 0 : z * UNIT]}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
      </group>
      <Stitches stitches={stitches} offset={0} color={threadColor} />
      {face === "front" && piece.text ? <TextMark piece={piece} frame={surface.frame(textAt.x, textAt.y, 0)} z={0} /> : null}
      {face === "front" && piece.logo ? <LogoMark logo={piece.logo} frame={surface.frame(piece.logo.x, piece.logo.y, 0)} /> : null}
      {face === "front" ? hardware.map((item) => <HardwareMesh key={item.id} item={item} frame={surface.frame(item.x, item.y, 0)} z={0} material={metalMaterial} leather={tape} />) : null}
    </group>
  );
});

function LogoMark({ logo, frame }: { logo: NonNullable<BespokePiece["logo"]>; frame: Frame }) {
  const invalidate = useThree((state) => state.invalidate);
  const [aspect, setAspect] = useState(1);
  const material = useDisposed(
    useMemo(() => {
      const created = patchLighting(new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.4, opacity: logo.style === "deboss" ? 0.45 : 1, metalness: logo.style === "foil" ? 0.5 : 0, color: logo.style === "deboss" ? "#000000" : "#ffffff" }));
      return created;
    }, [logo.style]),
  );
  useEffect(() => {
    let live = true;
    let loaded: THREE.Texture | null = null;
    new THREE.TextureLoader().load(`/api/bespoke/logo/${logo.id}`, (texture) => {
      if (!live) {
        texture.dispose();
        return;
      }
      loaded = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      const image = texture.image as { width: number; height: number };
      setAspect(image.width / Math.max(image.height, 1));
      material.setValues({ map: texture });
      material.needsUpdate = true;
      invalidate();
    });
    return () => {
      live = false;
      loaded?.dispose();
    };
  }, [logo.id, material, invalidate]);
  const quaternion = useMemo(() => facing(frame.normal).multiply(new THREE.Quaternion().setFromAxisAngle(AHEAD, THREE.MathUtils.degToRad(-logo.rotation))), [frame.normal, logo.rotation]);
  return (
    <mesh position={[frame.position.x * UNIT, frame.position.y * UNIT, frame.position.z * UNIT + 0.0008]} quaternion={quaternion} material={material}>
      <planeGeometry args={[logo.width * UNIT, (logo.width / aspect) * UNIT]} />
    </mesh>
  );
}

function BodyShell({ piece, depth, holesKey, lining, tiles }: { piece: BespokePiece; depth: number; holesKey: string; lining: BespokeDesign["lining"]; tiles: Tiles }) {
  const { points, mirror, closed, axisX, finish, color, fold } = piece;
  const outline = useMemo(() => outlineFrom(points, mirror, closed, axisX), [points, mirror, closed, axisX]);
  const holes = useMemo(() => JSON.parse(holesKey) as Vec[][], [holesKey]);
  const surface = useMemo(() => makeSurface(outline, [], { puff: 0, fold }, true, 0, 0), [outline, fold]);
  const wall = useDisposed(useMemo(() => wallStrip(outline, depth, 1.1, surface, false), [outline, depth, surface]));
  const innerWall = useDisposed(useMemo(() => wallStrip(outline, depth, 1.6, surface, true), [outline, depth, surface]));
  const front = useDisposed(useMemo(() => liningPlate(outline, holes, surface, depth / 2 - 0.3, false, fold), [outline, holes, surface, depth, fold]));
  const back = useDisposed(useMemo(() => liningPlate(outline, [], surface, -depth / 2 + 0.3, true, fold), [outline, surface, depth, fold]));
  const leather = useLeather(finish, color, tiles);
  const inside = useLeather("suede", lining, tiles);
  return (
    <>
      <mesh geometry={wall} material={leather} castShadow receiveShadow />
      <mesh geometry={innerWall} material={inside} receiveShadow />
      <mesh geometry={front} material={inside} />
      <mesh geometry={back} material={inside} receiveShadow />
    </>
  );
}

const Tube = memo(function Tube({ piece, z, tiles, metal }: { piece: BespokePiece; z: number; tiles: Tiles; metal: BespokeDesign["metal"] }) {
  const { points, axisX, finish, color, stitched, thread, tubeWidth, tubeStyle, rings } = piece;
  const path = useMemo(() => outlineFrom(points, false, false, axisX), [points, axisX]);
  const geometry = useDisposed(useMemo(() => tubeGeometry(path, tubeWidth, tubeStyle), [path, tubeWidth, tubeStyle]));
  const stitches = useMemo(() => (stitched ? tubeStitches(path, tubeWidth, tubeStyle) : []), [path, tubeWidth, tubeStyle, stitched]);
  const material = useLeather(finish, color, tiles);
  const { metalMaterial } = useHardware(metal);
  const threadColor = THREADS[thread].hex || shade(COLORS[color].hex, 1.35);
  const ends = rings && path.length > 1 ? [{ at: path[0]!, from: path[1]! }, { at: path[path.length - 1]!, from: path[path.length - 2]! }] : [];
  const radius = tubeWidth * 0.5 + 3;
  const links = useMemo(() => (tubeStyle === "chain" ? chainLinks(path, CHAIN_PITCH_MM) : []), [path, tubeStyle]);
  return (
    <group>
      <group position={[0, 0, z * UNIT]}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
      </group>
      <Stitches stitches={stitches} offset={z} color={threadColor} />
      {links.map((link, index) => (
        <mesh key={index} material={metalMaterial} castShadow position={[link.x * UNIT, -link.y * UNIT, (z + 2) * UNIT]} rotation={[link.turned ? 0 : 0.9, 0, link.angle]} scale={[1.5, 1, 1]}>
          <torusGeometry args={[(tubeWidth * 0.42 + 1.4) * UNIT, 1.1 * UNIT, 8, 16]} />
        </mesh>
      ))}
      {ends.map(({ at, from }, index) => {
        const length = Math.hypot(at.x - from.x, at.y - from.y) || 1;
        const x = at.x + ((at.x - from.x) / length) * (radius - 1);
        const y = at.y + ((at.y - from.y) / length) * (radius - 1);
        return (
          <mesh key={index} material={metalMaterial} castShadow position={[x * UNIT, -y * UNIT, (z + tubeHeight(tubeWidth, tubeStyle) / 2) * UNIT]} rotation={[Math.PI / 2 - 0.5, 0, Math.atan2(-(at.y - from.y), at.x - from.x) + Math.PI / 2]}>
            <torusGeometry args={[radius * UNIT, 1.8 * UNIT, 10, 28]} />
          </mesh>
        );
      })}
    </group>
  );
});

function holesKeyFor(piece: BespokePiece, pieces: BespokePiece[]) {
  const outline = outlineOf(piece);
  return JSON.stringify(holeOutlines(piece, pieces).filter((hole) => hole.every((point) => contains(outline, point))));
}

const pieceDepth = (piece: BespokePiece) => (piece.kind === "tube" ? tubeHeight(piece.tubeWidth, piece.tubeStyle) : THICKNESS_MM + piece.puff);

function stackView(pieces: BespokePiece[], start = 0.15) {
  const placed: Placed[] = [];
  let cursor = start;
  let below = pieces[0]?.stack ?? 0;
  for (const piece of pieces) {
    cursor += STACK_GAP_MM * Math.max(0, piece.stack - below) + 0.12;
    placed.push({ piece, z: cursor });
    cursor += pieceDepth(piece);
    below = piece.stack;
  }
  return placed;
}

function arrange(source: BespokeDesign) {
  const design = visibleDesign(source);
  const solid = (view: DesignView) => layerOrder(design.pieces.filter((piece) => (isSolidPanel(piece) || piece.kind === "tube") && piece.view === view));
  const fronts = solid("front");
  if (!fronts.length) return null;
  const chosen = bodyOf(design);
  const body = chosen && fronts.includes(chosen) ? chosen : (fronts.find(isSolidPanel) ?? fronts[0]!);
  const bodyAt = fronts.indexOf(body);
  const depth = body.kind === "tube" ? 0 : source.depth;
  const placed: Placed[] = [{ piece: body, z: depth ? depth / 2 : 0 }];
  let front = (depth ? depth / 2 : 0) + pieceDepth(body);
  let below = body.stack;
  for (const piece of fronts.slice(bodyAt + 1)) {
    front += STACK_GAP_MM * Math.max(0, piece.stack - below) + 0.12;
    placed.push({ piece, z: front });
    front += pieceDepth(piece);
    below = piece.stack;
  }
  let back = depth ? -depth / 2 - THICKNESS_MM - body.puff : 0;
  let above = body.stack;
  for (const piece of fronts.slice(0, bodyAt).reverse()) {
    back -= STACK_GAP_MM * Math.max(0, above - piece.stack) + 0.12 + pieceDepth(piece);
    placed.push({ piece, z: back });
    above = piece.stack;
  }
  const bodyBox = groupBounds([body]);
  const faces = (["back", "left", "right", "base", "interior"] as const).map((view) => ({ view, placed: stackView(solid(view)) })).filter((face) => face.placed.length);
  return { placed, body, depth, bodyBox, faces, box: groupBounds(fronts), frontZ: front, backZ: back, pieces: design.pieces };
}

function faceTransform(view: DesignView, box: ReturnType<typeof groupBounds>, depth: number, puff: number) {
  const cx = ((box.minX + box.maxX) / 2) * UNIT;
  const cy = (-(box.minY + box.maxY) / 2) * UNIT;
  const half = (depth / 2 + THICKNESS_MM + puff * 0.92) * UNIT;
  if (view === "back") return { position: [cx, cy, -half] as const, rotation: [0, Math.PI, 0] as const };
  if (view === "left") return { position: [box.minX * UNIT, cy, 0] as const, rotation: [0, -Math.PI / 2, 0] as const };
  if (view === "right") return { position: [box.maxX * UNIT, cy, 0] as const, rotation: [0, Math.PI / 2, 0] as const };
  if (view === "base") return { position: [cx, -box.maxY * UNIT, 0] as const, rotation: [Math.PI / 2, 0, 0] as const };
  return { position: [cx, cy, (-depth / 2 + 0.6) * UNIT] as const, rotation: [0, 0, 0] as const };
}

function addSoftbox(texture: THREE.DataTexture) {
  const { width, height, data } = texture.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const halfFloat = data instanceof Uint16Array;
  const center = SOFTBOX.direction.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -ENV_ROTATION);
  const axisU = new THREE.Vector3(0, 1, 0).cross(center).normalize();
  const axisV = center.clone().cross(axisU).normalize();
  const direction = new THREE.Vector3();
  const offset = new THREE.Vector3();
  for (let y = 0; y < height; y++) {
    const polar = ((y + 0.5) / height) * Math.PI;
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      direction.set(Math.sin(polar) * Math.cos(azimuth), Math.cos(polar), Math.sin(polar) * Math.sin(azimuth));
      const facing = direction.dot(center);
      if (facing <= 0.1) continue;
      offset.copy(direction).divideScalar(facing);
      const edge = Math.max(Math.abs(offset.dot(axisU)) / SOFTBOX.halfWidth, Math.abs(offset.dot(axisV)) / SOFTBOX.halfHeight);
      if (edge >= 1) continue;
      const glow = (1 - Math.max(0, (edge - 0.72) / 0.28) ** 2) * SOFTBOX.radiance;
      const index = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        if (halfFloat) data[index + c] = THREE.DataUtils.toHalfFloat(THREE.DataUtils.fromHalfFloat(data[index + c]!) + glow * SOFTBOX.tint[c]!);
        else data[index + c]! += glow * SOFTBOX.tint[c]!;
      }
    }
  }
  texture.needsUpdate = true;
}

function useEnvironment() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let live = true;
    let loaded: THREE.DataTexture | null = null;
    new HDRLoader().load(
      "/hdri/hero-env.hdr",
      (texture) => {
        if (!live) {
          texture.dispose();
          return;
        }
        loaded = texture;
        addSoftbox(texture);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.environmentRotation.set(0, ENV_ROTATION, 0);
        scene.environmentIntensity = 0.8;
        invalidate();
      },
      undefined,
      () => undefined,
    );
    return () => {
      live = false;
      if (loaded) {
        if (scene.environment === loaded) scene.environment = null;
        loaded.dispose();
      }
    };
  }, [scene, invalidate]);
}

function useTiles(finishes: string) {
  const gl = useThree((state) => state.gl);
  const [tiles, setTiles] = useState<Tiles>({});
  useEffect(() => {
    let live = true;
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const finish of finishes.split(",").filter(Boolean) as FinishKey[]) {
      loadGrainTile(finish, "-640", anisotropy)
        .then((tile) => {
          if (live) setTiles((current) => (current[finish] === tile ? current : { ...current, [finish]: tile }));
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [finishes, gl]);
  return tiles;
}

function fitDistance(radius: number, aspect: number) {
  return ((radius / Math.tan(THREE.MathUtils.degToRad(FOV / 2))) * FRAMING) / Math.min(aspect, 1);
}

function CameraRig({ controls, radius, height, reduced, view }: { controls: RefObject<OrbitHandle | null>; radius: number; height: number; reduced: boolean; view: { key: PreviewView; nonce: number } }) {
  const camera = useThree((state) => state.camera);
  const aspect = useThree((state) => state.size.width / Math.max(state.size.height, 1));
  const invalidate = useThree((state) => state.invalidate);
  const goal = useRef<{ radius: number; theta: number; phi: number; targetY: number } | null>(null);
  const placed = useRef(false);
  const spherical = useMemo(() => new THREE.Spherical(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  const apply = (next: { radius: number; theta: number; phi: number; targetY: number }) => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.target.set(0, next.targetY, 0);
    spherical.set(next.radius, next.phi, next.theta);
    camera.position.setFromSpherical(spherical).add(orbit.target);
    camera.lookAt(orbit.target);
    orbit.update();
    invalidate();
  };

  const aim = (angles?: { theta: number; phi: number }) => {
    const orbit = controls.current;
    if (!orbit) return;
    spherical.setFromVector3(offset.copy(camera.position).sub(orbit.target));
    const next = {
      radius: fitDistance(radius, aspect),
      theta: angles?.theta ?? spherical.theta,
      phi: angles?.phi ?? spherical.phi,
      targetY: height / 2 + radius * 0.04,
    };
    if (reduced || !placed.current) {
      placed.current = true;
      goal.current = null;
      apply(next);
      return;
    }
    goal.current = next;
    invalidate();
  };
  const aimRef = useRef(aim);
  useLayoutEffect(() => {
    aimRef.current = aim;
  });

  useLayoutEffect(() => {
    aimRef.current(placed.current ? undefined : ANGLES.angle);
  }, [radius, height, aspect]);

  useEffect(() => {
    if (view.nonce) aimRef.current(ANGLES[view.key]);
  }, [view]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const release = () => {
      if (goal.current) goal.current = { ...goal.current, theta: NaN };
    };
    orbit.addEventListener("start", release);
    return () => orbit.removeEventListener("start", release);
  }, [controls]);

  useFrame((_, delta) => {
    const next = goal.current;
    const orbit = controls.current;
    if (!next || !orbit) return;
    spherical.setFromVector3(offset.copy(camera.position).sub(orbit.target));
    const theta = spherical.theta;
    const phi = spherical.phi;
    const currentRadius = spherical.radius;
    const ease = 1 - Math.exp(-delta * 7);
    const wantTheta = Number.isNaN(next.theta) ? theta : next.theta;
    const turn = Math.atan2(Math.sin(wantTheta - theta), Math.cos(wantTheta - theta));
    const settled = Math.abs(turn) < 0.002 && Math.abs(next.phi - phi) < 0.002 && Math.abs(next.radius - currentRadius) < 0.005 && Math.abs(next.targetY - orbit.target.y) < 0.002;
    if (settled) {
      apply({ ...next, theta: wantTheta });
      goal.current = null;
      return;
    }
    apply({
      radius: currentRadius + (next.radius - currentRadius) * ease,
      theta: theta + turn * ease,
      phi: phi + (next.phi - phi) * ease,
      targetY: orbit.target.y + (next.targetY - orbit.target.y) * ease,
    });
  });

  return null;
}

function ShotBridge({ radius, centerY, ready, shotRef }: { radius: number; centerY: number; ready: boolean; shotRef?: RefObject<ShotTaker | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    if (!shotRef || !ready) return;
    shotRef.current = (angle) => takeShot(gl, scene, radius, new THREE.Vector3(0, centerY, 0), angle);
    return () => {
      shotRef.current = null;
    };
  }, [centerY, gl, radius, ready, scene, shotRef]);
  return null;
}

function Workshop({ design, view, reduced, lookInside, shotRef }: { design: BespokeDesign; view: { key: PreviewView; nonce: number }; reduced: boolean; lookInside: boolean; shotRef?: RefObject<ShotTaker | null> }) {
  const invalidate = useThree((state) => state.invalidate);
  useEnvironment();
  const finishes = [...new Set([...design.pieces.map((piece) => piece.finish), "suede"])].sort().join(",");
  const tiles = useTiles(finishes);
  const layout = useMemo(() => arrange(design), [design]);
  const controls = useRef<OrbitHandle>(null);
  const box = layout?.box;
  const centerX = box ? ((box.minX + box.maxX) / 2) * UNIT : 0;
  const groundOffset = box ? box.maxY * UNIT : 0;
  const widthUnits = box ? box.width * UNIT : 2;
  const heightUnits = box ? box.height * UNIT : 2;
  const depthUnits = layout ? (layout.frontZ - layout.backZ) * UNIT : 0.2;
  const radius = Math.max(0.3, Math.hypot(widthUnits, heightUnits, depthUnits) / 2);
  const midZ = layout ? ((layout.frontZ + layout.backZ) / 2) * UNIT : 0;

  useEffect(() => invalidate(), [design, tiles, invalidate]);

  useEffect(() => {
    const { uSpecular, uDirectSpecular } = lightingUniforms;
    const before = { specular: uSpecular.value, direct: uDirectSpecular.value };
    uSpecular.value = 0.55;
    uDirectSpecular.value = 0.8;
    invalidate();
    return () => {
      uSpecular.value = before.specular;
      uDirectSpecular.value = before.direct;
    };
  }, [invalidate]);

  return (
    <>
      <hemisphereLight args={["#fff4e4", "#25382f", 0.35]} />
      <directionalLight position={[-radius * 2.4, radius * 1.2, -radius * 1.6]} intensity={0.35} color="#ffe9cc" />
      <directionalLight position={[radius * 1.4, radius * 3, radius * 2.2]} intensity={1.1} castShadow shadow-mapSize={[1536, 1536]} shadow-bias={-0.00025} shadow-normalBias={0.02} shadow-radius={7} shadow-camera-left={-radius * 1.8} shadow-camera-right={radius * 1.8} shadow-camera-top={radius * 1.8} shadow-camera-bottom={-radius * 1.8} shadow-camera-near={0.1} shadow-camera-far={radius * 10} />
      <OrbitControls ref={controls} enablePan={false} enableDamping={!reduced} dampingFactor={0.08} minDistance={radius * 0.6} maxDistance={fitDistance(radius, 1) * 2.4} maxPolarAngle={Math.PI * 0.6} />
      <CameraRig controls={controls} radius={radius} height={heightUnits} reduced={reduced} view={view} />
      <ShotBridge radius={radius} centerY={heightUnits / 2 + radius * 0.04} ready={Boolean(layout) && (finishes.split(",") as FinishKey[]).every((finish) => tiles[finish])} shotRef={shotRef} />
      {layout ? (
        <group position={[-centerX, groundOffset, -midZ]}>
          {layout.placed.filter(({ piece }) => !lookInside || piece.kind === "tube" || piece === layout.body).map(({ piece, z }) => {
            if (piece.kind === "tube") return <Tube key={piece.id} piece={piece} z={z} tiles={tiles} metal={design.metal} />;
            const isBody = piece === layout.body;
            if (isBody && lookInside && layout.depth) return null;
            return <Panel key={piece.id} piece={piece} z={z} holesKey={holesKeyFor(piece, layout.pieces)} foldable pivot={isBody && layout.depth ? 0 : undefined} tiles={tiles} metal={design.metal} />;
          })}
          {layout.depth ? (
            <>
              <BodyShell piece={layout.body} depth={layout.depth} holesKey={lookInside ? "[]" : holesKeyFor(layout.body, layout.pieces)} lining={design.lining} tiles={tiles} />
              <Panel piece={{ ...layout.body, hardware: [], text: null, logo: null }} z={-layout.depth / 2 - THICKNESS_MM} face="back" holesKey="[]" foldable pivot={0} tiles={tiles} metal={design.metal} />
            </>
          ) : null}
          {layout.faces.map(({ view, placed }) => {
            const { position, rotation } = faceTransform(view, layout.bodyBox, layout.depth, layout.body.puff);
            return (
              <group key={view} position={[...position]} rotation={[...rotation]}>
                {placed.map(({ piece, z }) => (piece.kind === "tube" ? <Tube key={piece.id} piece={piece} z={z} tiles={tiles} metal={design.metal} /> : <Panel key={piece.id} piece={piece} z={z} holesKey={holesKeyFor(piece, layout.pieces)} foldable tiles={tiles} metal={design.metal} />))}
              </group>
            );
          })}
        </group>
      ) : null}
      {layout ? (
        <>
          <ContactShadows position={[0, 0.002, 0]} scale={Math.max(widthUnits, depthUnits) * 3 + 1} far={Math.max(heightUnits * 1.1, 0.6)} resolution={512} blur={3.2} opacity={0.5} color="#0c1410" />
          <ContactShadows position={[0, 0.004, 0]} scale={Math.max(widthUnits, depthUnits) * 2 + 0.6} far={Math.max(heightUnits * 0.12, 0.08)} resolution={512} blur={1.2} opacity={0.7} color="#070c09" />
        </>
      ) : null}
    </>
  );
}

function Capture({ captureRef }: { captureRef: RefObject<(() => string | null) | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    captureRef.current = () => {
      const ratio = gl.getPixelRatio();
      const { width, height } = gl.getSize(new THREE.Vector2());
      const scale = Math.min(STILL_LONG_EDGE_PX / Math.max(width, height), 4);
      gl.setPixelRatio(scale);
      gl.setSize(width, height, false);
      gl.render(scene, camera);
      const source = gl.domElement;
      const output = document.createElement("canvas");
      output.width = source.width;
      output.height = source.height;
      const ctx = output.getContext("2d")!;
      ctx.fillStyle = "#17312a";
      ctx.fillRect(0, 0, output.width, output.height);
      ctx.drawImage(source, 0, 0);
      ctx.fillStyle = "#f3ecdd";
      ctx.font = `${Math.round(output.width / 60)}px ${fontFamily("--font-geist")}, sans-serif`;
      ctx.fillText("OCCUIN design preview", output.width / 40, output.height - output.width / 40);
      const url = output.toDataURL("image/png");
      gl.setPixelRatio(ratio);
      gl.setSize(width, height, false);
      gl.render(scene, camera);
      return url;
    };
    return () => {
      captureRef.current = null;
    };
  }, [camera, captureRef, gl, scene]);
  return null;
}

export default function BespokeScene({ design, view, lookInside = false, captureRef, onContextLost, shotRef }: { design: BespokeDesign; view: { key: PreviewView; nonce: number }; lookInside?: boolean; captureRef: RefObject<(() => string | null) | null>; onContextLost?: () => void; shotRef?: RefObject<ShotTaker | null> }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      shadows="soft"
      camera={{ fov: FOV, near: 0.05, far: 200, position: [0, 3, 18] }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1, powerPreference: "high-performance" }}
      aria-label="Live three dimensional preview of your design"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", () => {
          if (gl.domElement.isConnected) onContextLost?.();
        });
      }}
    >
      <Workshop design={design} view={view} reduced={reduced} lookInside={lookInside} shotRef={shotRef} />
      <Capture captureRef={captureRef} />
    </Canvas>
  );
}
