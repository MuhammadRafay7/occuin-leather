"use client";

import { ContactShadows, MeshReflectorMaterial, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { buildBag, disposeBag, flapFrame, surfaceFrame, UNIT_PER_MM, type BagGeometry } from "@/lib/studio/geometry";
import { COLORS, METALS, THREADS, type DesignSpec, type FinishKey, type Hide } from "@/lib/studio/spec";
import {
  allFinishes,
  createLeather,
  disposeSurface,
  dressLeather,
  lightingUniforms,
  loadGrainTile,
  paintBody,
  paintFlap,
  patchLighting,
  setMaxAnisotropy,
  shade,
  threadBump,
  type GrainTile,
  type PaintedSurface,
} from "@/lib/studio/textures";
import { takeShot, type ShotTaker } from "./shot";
import { captureBridge, useStudio, type ViewName } from "./store";

const FOV = 26;
const FRAMING = 1.22;
const PAINT_DELAY_MS = 90;
const PREVIEW_SIZE = 800;
const SHORT_CANVAS_PX = 420;
const CONTROL_STRIP_PX = 52;
const HERO_ANGLES = { theta: -0.5, phi: 1.32 };
const REVEAL_ANGLES = { theta: -0.3, phi: 0.78 };
const SHOWCASE_ANGLES = { theta: -0.62, phi: 1.2 };
const SHOWCASE_SPIN = 0.5;
const SHOWCASE_ENV = 0.55;
const FADE_MS = 1400;
const ENV_ROTATION = 0.6;
const ENV_INTENSITY = 0.8;
const EXPOSURE = 1;
const SOFTBOX = { direction: new THREE.Vector3(0.42, 0.52, 0.74), halfWidth: 0.85, halfHeight: 0.62, radiance: 2.6, tint: [1, 0.97, 0.93] };
const VIEW_ANGLES: Record<ViewName, { theta: number; phi: number }> = {
  hero: HERO_ANGLES,
  front: { theta: 0, phi: Math.PI / 2 - 0.04 },
  side: { theta: Math.PI / 2, phi: Math.PI / 2 - 0.04 },
  back: { theta: Math.PI, phi: Math.PI / 2 - 0.04 },
  top: { theta: 0, phi: 0.12 },
};

type OrbitHandle = ComponentRef<typeof OrbitControls>;
type Painted = { surface: PaintedSurface; pxPerMm: number };
type Surfaces = { front: Painted; back: Painted; flap: Painted | null };
type Tiles = Partial<Record<FinishKey, GrainTile>>;
type Quality = { suffix: string; paint: number; flap: number; detail: number; hdri: string; shadow: number; dpr: [number, number] };

const STANDARD_QUALITY: Quality = { suffix: "", paint: 2048, flap: 1536, detail: 1, hdri: "/hdri/studio_small_09_2k.hdr", shadow: 2048, dpr: [1, 2] };
const LOW_QUALITY: Quality = { suffix: "-1k", paint: 1024, flap: 768, detail: 0.6, hdri: "/hdri/studio_small_09_1k.hdr", shadow: 1024, dpr: [1, 1.5] };
const LITE_QUALITY: Quality = { suffix: "-640", paint: 768, flap: 640, detail: 0.6, hdri: "/hdri/hero-env.hdr", shadow: 1024, dpr: [1, 1.5] };
const LITE_PHONE_DPR: [number, number] = [1, 1.25];
const STILL_QUALITY: Quality = { suffix: "", paint: 4096, flap: 3072, detail: 1.5, hdri: "/hdri/studio_small_09_2k.hdr", shadow: 4096, dpr: [1, 1] };

const isPhoneScreen = () => Math.min(window.screen.width, window.screen.height) < 700;

function detectQuality(): Quality {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return isPhoneScreen() || navigator.hardwareConcurrency <= 4 || memory <= 4 ? LOW_QUALITY : STANDARD_QUALITY;
}

const liteQuality = (): Quality => (isPhoneScreen() ? { ...LITE_QUALITY, dpr: LITE_PHONE_DPR } : LITE_QUALITY);

function paintAll(spec: DesignSpec, quality: Quality): Surfaces {
  const body = quality.paint / surfaceFrame(spec.form).span;
  return {
    front: { surface: paintBody(spec, "front", quality.paint), pxPerMm: body },
    back: { surface: paintBody(spec, "back", Math.round(quality.paint / 2)), pxPerMm: body / 2 },
    flap: spec.closure.type === "flap" ? { surface: paintFlap(spec, quality.flap), pxPerMm: quality.flap / flapFrame(spec).span } : null,
  };
}

function disposeSurfaces(surfaces: Surfaces) {
  disposeSurface(surfaces.front.surface);
  disposeSurface(surfaces.back.surface);
  if (surfaces.flap) disposeSurface(surfaces.flap.surface);
}

function fontStack(variable: string) {
  return getComputedStyle(document.body).getPropertyValue(variable).trim();
}

function useFontEpoch(spec: DesignSpec) {
  const [epoch, setEpoch] = useState(0);
  const needed = spec.monogram.text.trim() || spec.surface.pattern === "signature" ? spec.monogram.font : null;
  useEffect(() => {
    if (!needed) return;
    const variable = { didone: "--font-display", grotesk: "--font-sans", script: "--font-script" }[needed];
    const stack = fontStack(variable);
    if (!stack) return;
    let live = true;
    const shorthand = `${needed === "didone" ? 600 : needed === "grotesk" ? 500 : 400} 40px ${stack}`;
    if (document.fonts.check(shorthand, "OCCUIN&.")) return;
    document.fonts
      .load(shorthand, "OCCUIN&.")
      .catch(() => undefined)
      .then(() => {
        if (live) setEpoch((value) => value + 1);
      });
    return () => {
      live = false;
    };
  }, [needed]);
  return epoch;
}

function colorDependentPaint(spec: DesignSpec) {
  return spec.surface.pattern === "none" ? null : [spec.panels.primary.color, spec.stitch.thread];
}

function shapeKeyOf(spec: DesignSpec, reveal: boolean, detail: number) {
  const { form, carry, closure, stitch, hardware, panels, pocket } = spec;
  return JSON.stringify([form, carry, closure, stitch.length, stitch.rows, hardware.feet, pocket, panels.layout, panels.divide, reveal, detail]);
}

function paintKeyOf(spec: DesignSpec, paint: number, fontEpoch: number) {
  const { form, closure, stitch, panels, surface, monogram, edgeColor } = spec;
  return JSON.stringify([
    form, closure.type, closure.flapLength, closure.flapShape, stitch.rows, panels.layout, panels.divide, surface, monogram,
    monogram.technique === "paint" ? edgeColor : null, colorDependentPaint(spec), paint, fontEpoch,
  ]);
}

const NO_UPCOMING: DesignSpec[] = [];
const PREFETCH_START_MS = 400;

function whenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(task, { timeout: 1500 });
    return () => window.cancelIdleCallback(handle);
  }
  const timer = window.setTimeout(task, 120);
  return () => window.clearTimeout(timer);
}

function prune<T>(cache: Map<string, T>, keep: Set<string>, dispose: (value: T) => void) {
  for (const [key, value] of cache) {
    if (keep.has(key)) continue;
    cache.delete(key);
    dispose(value);
  }
}

// Builds and paints the bag for `spec`. Results are cached by key, and any `upcoming` specs are
// prepared during idle time, so switching to one later is a swap instead of a main-thread stall.
function useBagAssets(spec: DesignSpec, quality: Quality, reveal: boolean, upcoming: DesignSpec[] = NO_UPCOMING) {
  const [built, setBuilt] = useState<{ bag: BagGeometry; generation: number; key: string } | null>(null);
  const [painted, setPainted] = useState<{ surfaces: Surfaces; key: string } | null>(null);
  const specRef = useRef(spec);
  const hasPainted = useRef(false);
  const generation = useRef(0);
  const [bags] = useState(() => new Map<string, BagGeometry>());
  const [paints] = useState(() => new Map<string, Surfaces>());
  const fontEpoch = useFontEpoch(spec);
  useLayoutEffect(() => {
    specRef.current = spec;
  });

  const shapeKey = shapeKeyOf(spec, reveal, quality.detail);
  const paintKey = paintKeyOf(spec, quality.paint, fontEpoch);
  const planned = useMemo(
    () => upcoming.map((next) => ({ spec: next, shape: shapeKeyOf(next, reveal, quality.detail), paint: paintKeyOf(next, quality.paint, fontEpoch) })),
    [upcoming, reveal, quality.detail, quality.paint, fontEpoch],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let bag = bags.get(shapeKey);
      if (!bag) {
        bag = buildBag(specRef.current, { open: reveal, detail: quality.detail });
        bags.set(shapeKey, bag);
      }
      generation.current += 1;
      setBuilt({ bag, generation: generation.current, key: shapeKey });
    });
    return () => cancelAnimationFrame(frame);
  }, [bags, shapeKey, reveal, quality.detail]);

  useEffect(() => {
    const cached = paints.has(paintKey);
    const timer = window.setTimeout(() => {
      hasPainted.current = true;
      let surfaces = paints.get(paintKey);
      if (!surfaces) {
        surfaces = paintAll(specRef.current, quality);
        paints.set(paintKey, surfaces);
      }
      setPainted({ surfaces, key: paintKey });
    }, hasPainted.current && !cached ? PAINT_DELAY_MS : 0);
    return () => window.clearTimeout(timer);
  }, [paints, paintKey, quality]);

  const bag = built?.bag ?? null;
  const surfaces = painted?.surfaces ?? null;
  const firstShown = Boolean(bag && surfaces);

  useEffect(() => {
    if (!firstShown || !planned.length) return;
    let cancel = () => {};
    const step = () => {
      const missing = planned.find((item) => !bags.has(item.shape) || !paints.has(item.paint));
      if (!missing) return;
      if (!bags.has(missing.shape)) bags.set(missing.shape, buildBag(missing.spec, { open: reveal, detail: quality.detail }));
      else paints.set(missing.paint, paintAll(missing.spec, quality));
      cancel = whenIdle(step);
    };
    const start = window.setTimeout(() => {
      cancel = whenIdle(step);
    }, PREFETCH_START_MS);
    return () => {
      window.clearTimeout(start);
      cancel();
    };
  }, [firstShown, planned, bags, paints, reveal, quality]);

  useEffect(() => {
    prune(bags, new Set([shapeKey, ...(built ? [built.key] : []), ...planned.map((item) => item.shape)]), disposeBag);
    prune(paints, new Set([paintKey, ...(painted ? [painted.key] : []), ...planned.map((item) => item.paint)]), disposeSurfaces);
  }, [bags, paints, built, painted, shapeKey, paintKey, planned]);

  useEffect(
    () => () => {
      prune(bags, new Set(), disposeBag);
      prune(paints, new Set(), disposeSurfaces);
    },
    [bags, paints],
  );

  const settled = built?.key === shapeKey && painted?.key === paintKey;
  return { bag, surfaces, generation: built?.generation ?? 0, settled };
}

function useGrainTiles(spec: DesignSpec, suffix: string, anisotropy: number, essentialOnly: boolean) {
  const [tiles, setTiles] = useState<Tiles>({});
  const finishes = allFinishes(spec).join(",");
  useEffect(() => {
    let live = true;
    for (const finish of finishes.split(",") as FinishKey[]) {
      loadGrainTile(finish, suffix, anisotropy)
        .then((tile) => {
          if (live) setTiles((current) => (current[finish] === tile ? current : { ...current, [finish]: tile }));
        })
        .catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, [finishes, suffix, anisotropy]);
  const required = essentialOnly ? [spec.panels.primary.finish, spec.panels.gusset.finish] : (finishes.split(",") as FinishKey[]);
  return { tiles, loaded: required.every((finish) => tiles[finish]) };
}

function addSoftbox(texture: THREE.DataTexture, rotation: number) {
  const { width, height, data } = texture.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const halfFloat = data instanceof Uint16Array;
  const center = SOFTBOX.direction.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotation);
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
      const across = Math.abs(offset.dot(axisU)) / SOFTBOX.halfWidth;
      const along = Math.abs(offset.dot(axisV)) / SOFTBOX.halfHeight;
      const edge = Math.max(across, along);
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

function useEnvironment(url: string, intensity: number) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const [environment, setEnvironment] = useState<{ texture: THREE.DataTexture | null } | null>(null);
  useEffect(() => {
    let live = true;
    new HDRLoader().load(
      url,
      (texture) => {
        if (!live) {
          texture.dispose();
          return;
        }
        addSoftbox(texture, ENV_ROTATION);
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        scene.environmentRotation.set(0, ENV_ROTATION, 0);
        scene.environmentIntensity = intensity;
        setEnvironment({ texture });
        invalidate();
      },
      undefined,
      () => {
        if (live) setEnvironment({ texture: null });
      },
    );
    return () => {
      live = false;
    };
  }, [url, scene, invalidate, intensity]);
  useEffect(() => {
    const texture = environment?.texture;
    if (!texture) return;
    return () => {
      if (scene.environment === texture) scene.environment = null;
      texture.dispose();
    };
  }, [environment, scene]);
  return environment;
}

function useMaterials() {
  const set = useMemo(
    () => ({
      front: createLeather(),
      back: createLeather(),
      gusset: createLeather(),
      flap: createLeather(),
      straps: createLeather(),
      edges: createLeather(),
      lining: createLeather(),
      hardware: patchLighting(new THREE.MeshStandardMaterial({ metalness: 1 })),
      zip: patchLighting(new THREE.MeshStandardMaterial({ color: "#191714", roughness: 0.82 })),
    }),
    [],
  );
  useEffect(() => () => Object.values(set).forEach((material) => material.dispose()), [set]);
  return set;
}

type Materials = ReturnType<typeof useMaterials>;

type Fade = (colors: THREE.Color[], apply: () => void) => void;

function useColorFade(enabled: boolean): Fade {
  const invalidate = useThree((state) => state.invalidate);
  const tween = useRef<{ colors: THREE.Color[]; from: THREE.Color[]; to: THREE.Color[]; start: number } | null>(null);
  const primed = useRef(false);
  const allowed = useRef(enabled);
  useLayoutEffect(() => {
    allowed.current = enabled;
  });
  useFrame(() => {
    const current = tween.current;
    if (!current) return;
    const progress = Math.min(1, (performance.now() - current.start) / FADE_MS);
    const eased = progress * progress * (3 - 2 * progress);
    current.colors.forEach((color, index) => color.lerpColors(current.from[index]!, current.to[index]!, eased));
    if (progress >= 1) tween.current = null;
    else invalidate();
  });
  return useCallback<Fade>((colors, apply) => {
    const from = colors.map((color) => color.clone());
    apply();
    if (!allowed.current || !primed.current) {
      primed.current = true;
      tween.current = null;
      return;
    }
    const to = colors.map((color) => color.clone());
    if (to.every((color, index) => color.equals(from[index]!))) return;
    colors.forEach((color, index) => color.copy(from[index]!));
    tween.current = { colors, from, to, start: performance.now() };
    invalidate();
  }, [invalidate]);
}

function useDressedMaterials(materials: Materials, spec: DesignSpec, surfaces: Surfaces | null, tiles: Tiles, fade: Fade) {
  const invalidate = useThree((state) => state.invalidate);
  const { primary, accent, gusset } = spec.panels;
  const metal = spec.hardware.metal;
  const edge: Hide = useMemo(() => ({ finish: "box", color: spec.edgeColor }), [spec.edgeColor]);
  const lining: Hide = useMemo(() => ({ finish: "suede", color: spec.liningColor }), [spec.liningColor]);
  useLayoutEffect(() => {
    const leathers = [materials.front, materials.back, materials.gusset, materials.flap, materials.straps, materials.edges, materials.lining];
    const tints = leathers.flatMap((material) => [material.leather.uTintA.value, material.leather.uTintB.value]);
    fade([...tints, materials.hardware.color], () => {
    if (surfaces) {
      dressLeather(materials.front, primary, accent, surfaces.front.surface, surfaces.front.pxPerMm, tiles);
      dressLeather(materials.back, primary, accent, surfaces.back.surface, surfaces.back.pxPerMm, tiles);
      dressLeather(materials.flap, primary, primary, surfaces.flap?.surface ?? null, surfaces.flap?.pxPerMm ?? 1, tiles);
    }
    dressLeather(materials.gusset, gusset, gusset, null, 1, tiles);
    dressLeather(materials.straps, primary, primary, null, 1, tiles);
    dressLeather(materials.edges, edge, edge, null, 1, tiles);
    dressLeather(materials.lining, lining, lining, null, 1, tiles);
    materials.hardware.color.set(METALS[metal].hex);
    materials.hardware.roughness = METALS[metal].roughness;
    });
    invalidate();
  }, [materials, primary, accent, gusset, edge, lining, metal, surfaces, tiles, invalidate, fade]);
}

function Stitches({ bag, spec, fade }: { bag: BagGeometry; spec: DesignSpec; fade: Fade }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = bag.stitches.length;
  const invalidate = useThree((state) => state.invalidate);
  const thread = THREADS[spec.stitch.thread].hex || shade(COLORS[spec.panels.primary.color].hex, 1.35);
  const material = useMemo(() => patchLighting(new THREE.MeshStandardMaterial({ roughness: 0.62, bumpMap: threadBump(), bumpScale: 0.6 })), []);
  const span = bag.stitchSpan;

  useLayoutEffect(() => {
    fade([material.color], () => material.color.set(thread));
    invalidate();
  }, [material, thread, invalidate, fade]);

  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const slant = 0.26;
    const matrix = new THREE.Matrix4();
    const across = new THREE.Vector3();
    const along = new THREE.Vector3();
    const flatten = new THREE.Matrix4().makeScale(1, 1, 0.78);
    bag.stitches.forEach(({ position, tangent, normal }, index) => {
      across.crossVectors(normal, tangent).normalize();
      along.copy(tangent).multiplyScalar(Math.cos(slant)).addScaledVector(across, Math.sin(slant)).normalize();
      across.crossVectors(along, normal).normalize();
      matrix.makeBasis(across, along, normal).multiply(flatten).setPosition(position);
      target.setMatrixAt(index, matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
    invalidate();
  }, [bag, invalidate]);

  if (!count) return null;
  return (
    <instancedMesh key={`${count}-${span}`} ref={mesh} args={[undefined, material, count]} frustumCulled={false} castShadow>
      <capsuleGeometry args={[0.46 * UNIT_PER_MM, span, 4, 8]} />
    </instancedMesh>
  );
}

function Bag({ bag, materials, spec, fade }: { bag: BagGeometry; materials: Materials; spec: DesignSpec; fade: Fade }) {
  return (
    <group>
      <mesh geometry={bag.front} material={materials.front} castShadow receiveShadow />
      <mesh geometry={bag.back} material={materials.back} castShadow receiveShadow />
      <mesh geometry={bag.gusset} material={materials.gusset} castShadow receiveShadow />
      {bag.lining ? <mesh geometry={bag.lining} material={materials.lining} material-side={THREE.DoubleSide} receiveShadow /> : null}
      {bag.flap ? <mesh geometry={bag.flap} material={materials.flap} castShadow receiveShadow /> : null}
      <mesh geometry={bag.edges} material={materials.edges} castShadow receiveShadow />
      {bag.leatherStraps ? <mesh geometry={bag.leatherStraps} material={materials.straps} castShadow receiveShadow /> : null}
      {bag.hardware ? <mesh geometry={bag.hardware} material={materials.hardware} castShadow /> : null}
      {bag.zipTape ? <mesh geometry={bag.zipTape} material={materials.zip} receiveShadow /> : null}
      <Stitches bag={bag} spec={spec} fade={fade} />
    </group>
  );
}

function fitDistance(radius: number, aspect: number, framing = FRAMING) {
  const vertical = radius / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return (vertical * framing) / Math.min(aspect, 1);
}

type Pose = { radius: number; theta: number; phi: number; target: THREE.Vector3 };

function CameraRig({ bag, controls, reduced, reveal, controlStrip, framing, opening }: { bag: BagGeometry; controls: RefObject<OrbitHandle | null>; reduced: boolean; reveal: boolean; controlStrip: boolean; framing?: number; opening?: { theta: number; phi: number } }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => Math.max(state.size.height, 1));
  const invalidate = useThree((state) => state.invalidate);
  const aspect = width / height;
  const strip = controlStrip && height < SHORT_CANVAS_PX ? CONTROL_STRIP_PX : 0;
  const clearance = height / Math.max(height - strip, 1);
  const goal = useRef<Pose | null>(null);
  const placed = useRef(false);
  const spherical = useMemo(() => new THREE.Spherical(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  const applyPose = (pose: Pose) => {
    const orbit = controls.current;
    if (!orbit) return;
    orbit.target.copy(pose.target);
    spherical.set(pose.radius, pose.phi, pose.theta);
    camera.position.setFromSpherical(spherical).add(pose.target);
    camera.lookAt(pose.target);
    orbit.update();
    invalidate();
  };

  const currentPose = (): Pose | null => {
    const orbit = controls.current;
    if (!orbit) return null;
    spherical.setFromVector3(offset.copy(camera.position).sub(orbit.target));
    return { radius: spherical.radius, theta: spherical.theta, phi: spherical.phi, target: orbit.target.clone() };
  };

  const aim = (angles?: { theta: number; phi: number }) => {
    const pose = currentPose();
    if (!pose) return;
    const next: Pose = {
      radius: fitDistance(bag.radius, aspect, framing) * clearance,
      theta: angles?.theta ?? pose.theta,
      phi: angles?.phi ?? pose.phi,
      target: new THREE.Vector3(0, bag.centerY, 0),
    };
    if (reduced || !placed.current) {
      placed.current = true;
      goal.current = null;
      applyPose(next);
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
    aimRef.current(placed.current ? undefined : (opening ?? VIEW_ANGLES[useStudio.getState().view.name]));
  }, [bag.radius, bag.centerY, aspect, clearance, framing, opening]);

  const wasRevealed = useRef(false);
  useEffect(() => {
    if (reveal === wasRevealed.current) return;
    wasRevealed.current = reveal;
    aimRef.current(reveal ? REVEAL_ANGLES : VIEW_ANGLES[useStudio.getState().view.name]);
  }, [reveal]);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (strip) camera.setViewOffset(width, height, 0, strip / 2, width, height);
    else camera.clearViewOffset();
    invalidate();
  }, [camera, width, height, strip, invalidate]);

  useEffect(() => {
    return useStudio.subscribe((state, previous) => {
      if (state.view.nonce !== previous.view.nonce) aimRef.current(VIEW_ANGLES[state.view.name]);
    });
  }, []);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const release = () => {
      goal.current = null;
    };
    orbit.addEventListener("start", release);
    return () => orbit.removeEventListener("start", release);
  }, [controls]);

  useFrame((_, delta) => {
    const next = goal.current;
    const pose = next && currentPose();
    if (!next || !pose) return;
    const ease = 1 - Math.exp(-delta * 6);
    const turn = Math.atan2(Math.sin(next.theta - pose.theta), Math.cos(next.theta - pose.theta));
    const settled = Math.abs(turn) < 0.002 && Math.abs(next.phi - pose.phi) < 0.002 && Math.abs(next.radius - pose.radius) < 0.005 && pose.target.distanceTo(next.target) < 0.002;
    if (settled) {
      applyPose(next);
      goal.current = null;
      return;
    }
    applyPose({
      radius: pose.radius + (next.radius - pose.radius) * ease,
      theta: pose.theta + turn * ease,
      phi: pose.phi + (next.phi - pose.phi) * ease,
      target: pose.target.clone().lerp(next.target, ease),
    });
  });

  return null;
}

function CaptureBridge({ bag }: { bag: BagGeometry | null }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useEffect(() => {
    if (!bag) return;
    captureBridge.current = () => {
      const shot = new THREE.PerspectiveCamera(FOV, size.width / Math.max(size.height, 1), 0.05, 400);
      const target = new THREE.Vector3(0, bag.centerY, 0);
      shot.position.setFromSpherical(new THREE.Spherical(fitDistance(bag.radius, shot.aspect), HERO_ANGLES.phi, HERO_ANGLES.theta)).add(target);
      shot.lookAt(target);
      shot.updateMatrixWorld();
      gl.render(scene, shot);
      const source = gl.domElement;
      const output = document.createElement("canvas");
      output.width = output.height = PREVIEW_SIZE;
      const ctx = output.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#f1f1f1";
      ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
      const scale = Math.min(PREVIEW_SIZE / source.width, PREVIEW_SIZE / source.height);
      const width = source.width * scale;
      const height = source.height * scale;
      ctx.drawImage(source, (PREVIEW_SIZE - width) / 2, (PREVIEW_SIZE - height) / 2, width, height);
      gl.render(scene, camera);
      const url = output.toDataURL("image/webp", 0.82);
      return url.startsWith("data:image/webp") ? url : null;
    };
    return () => {
      captureBridge.current = null;
    };
  }, [bag, camera, gl, scene, size]);

  return null;
}

function ShotBridge({ bag, ready, shotRef }: { bag: BagGeometry | null; ready: boolean; shotRef?: RefObject<ShotTaker | null> }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    if (!shotRef || !bag || !ready) return;
    shotRef.current = (angle) => takeShot(gl, scene, bag.radius, new THREE.Vector3(0, bag.centerY, 0), angle);
    return () => {
      shotRef.current = null;
    };
  }, [bag, gl, ready, scene, shotRef]);
  return null;
}

function ReadySignal({ ready, onReady }: { ready: boolean; onReady?: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (ready) invalidate();
  }, [ready, invalidate]);
  useFrame(() => {
    if (!ready || done.current) return;
    frames.current += 1;
    if (frames.current > 4) {
      done.current = true;
      onReady?.();
      return;
    }
    invalidate();
  });
  return null;
}

function Invalidator({ spec, generation, surfaces, tiles, environment }: { spec: DesignSpec; generation: number; surfaces: Surfaces | null; tiles: Tiles; environment: unknown }) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [spec, gl, invalidate, generation, surfaces, tiles, environment]);
  return null;
}

type StillOptions = {
  spec: DesignSpec;
  width: number;
  height: number;
  frames: number;
  theta?: number;
  phi?: number;
  fov?: number;
  framing?: number;
  focus?: [number, number, number];
  distance?: number;
  aperture?: number;
  exposure?: number;
  background?: [number, number, number];
  ambient?: number;
  rotation?: number;
  lift?: number;
  shadowFrames?: number;
  shadowStrength?: number;
  variants?: { name: string; hex: string }[];
};

const halton = (index: number, base: number) => {
  let f = 1;
  let r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
};

function sampleEnvironment(texture: THREE.DataTexture, rotation: number) {
  const { width, height, data } = texture.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const cols = 180;
  const rows = 45;
  const read = (x: number, y: number, channel: number) => {
    const value = data[(y * width + x) * 4 + channel]!;
    return data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat(value) : value;
  };
  const cells: { r: number; g: number; b: number; lum: number }[] = [];
  let total = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      const y0 = Math.floor((row / (rows * 2)) * height);
      const x0 = Math.floor((col / cols) * width);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const x = Math.min(width - 1, x0 + Math.floor((i * width) / cols / 4));
          const y = Math.min(height - 1, y0 + Math.floor((j * height) / (rows * 2) / 4));
          r += read(x, y, 0);
          g += read(x, y, 1);
          b += read(x, y, 2);
        }
      }
      const theta = ((row + 0.5) / rows) * (Math.PI / 2);
      const solid = Math.sin(theta) * (Math.PI / 2 / rows) * ((Math.PI * 2) / cols);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 16;
      const power = lum * solid;
      total += power;
      cells.push({ r: r / 16, g: g / 16, b: b / 16, lum: power });
    }
  }
  const cumulative = new Float64Array(cells.length);
  let running = 0;
  cells.forEach((cell, i) => {
    running += cell.lum / total;
    cumulative[i] = running;
  });
  return (u: number, v: number) => {
    let low = 0;
    let high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (cumulative[mid]! < u) low = mid + 1;
      else high = mid;
    }
    const cell = cells[low]!;
    const row = Math.floor(low / cols);
    const col = low % cols;
    const theta = ((row + v) / rows) * (Math.PI / 2);
    const phi = ((col + ((v * 7.13) % 1)) / cols) * Math.PI * 2 - Math.PI;
    const direction = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    const peak = Math.max((0.2126 * cell.r + 0.7152 * cell.g + 0.0722 * cell.b), 1e-4);
    return { direction, color: new THREE.Color(cell.r / peak, cell.g / peak, cell.b / peak), power: total };
  };
}

function neutralTone(color: [number, number, number]) {
  const startCompression = 0.8 - 0.04;
  const desaturation = 0.15;
  const x = Math.min(color[0], color[1], color[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let [r, g, b] = [color[0] - offset, color[1] - offset, color[2] - offset];
  const peak = Math.max(r, g, b);
  if (peak < startCompression) return [r, g, b];
  const d = 1 - startCompression;
  const newPeak = 1 - (d * d) / (peak + d - startCompression);
  r *= newPeak / peak;
  g *= newPeak / peak;
  b *= newPeak / peak;
  const mix = 1 - 1 / (desaturation * (peak - newPeak) + 1);
  return [r * (1 - mix) + newPeak * mix, g * (1 - mix) + newPeak * mix, b * (1 - mix) + newPeak * mix];
}

const encode = (value: number) => {
  const v = Math.min(1, Math.max(0, value));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
};

type StillRig = { materials: Materials; thread: THREE.Material | null };

function createStillPass(gl: THREE.WebGLRenderer, bag: BagGeometry, environment: THREE.DataTexture, options: StillOptions) {
  const aspect = options.width / options.height;
  const fov = options.fov ?? FOV;
  const center = options.focus ? new THREE.Vector3(...options.focus).multiplyScalar(UNIT_PER_MM) : new THREE.Vector3(0, bag.centerY + (options.lift ?? 0) * bag.radius, 0);
  const distance = options.distance ?? ((bag.radius / Math.tan(THREE.MathUtils.degToRad(fov / 2))) * (options.framing ?? 1.04)) / Math.min(aspect, 1);
  const eye = new THREE.Vector3().setFromSpherical(new THREE.Spherical(distance, options.phi ?? HERO_ANGLES.phi, options.theta ?? HERO_ANGLES.theta)).add(center);
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.02, 400);
  camera.position.copy(eye);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const light = new THREE.DirectionalLight("#ffffff", 1);
  const reach = bag.radius * 1.5;
  light.castShadow = true;
  light.shadow.bias = -0.00012;
  light.shadow.normalBias = 0.012;
  light.shadow.radius = 3;
  Object.assign(light.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.1, far: reach * 6 });
  light.shadow.camera.updateProjectionMatrix();
  light.target.position.set(0, bag.centerY, 0);
  const sampler = sampleEnvironment(environment, options.rotation ?? ENV_ROTATION);
  const integrate = async (scene: THREE.Scene, width: number, height: number, frames: number, mapSize: number, intensity: number) => {
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: true, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    light.shadow.map?.dispose();
    light.shadow.map = null;
    light.shadow.mapSize.set(mapSize, mapSize);
    scene.add(light, light.target);
    gl.setClearColor(0x000000, 0);
    const pixels = new Float32Array(width * height * 4);
    const sum = new Float32Array(width * height * 4);
    for (let frame = 0; frame < frames; frame++) {
      const sample = sampler((frame + 0.5) / frames, halton(frame + 1, 3));
      light.position.copy(sample.direction).multiplyScalar(reach * 3).add(light.target.position);
      light.color.copy(sample.color);
      light.intensity = sample.power * intensity;
      camera.setViewOffset(width, height, halton(frame + 1, 2) - 0.5, halton(frame + 1, 5) - 0.5, width, height);
      if (options.aperture) {
        const angle = halton(frame + 1, 7) * Math.PI * 2;
        const r = Math.sqrt(halton(frame + 1, 11)) * options.aperture;
        camera.position.copy(eye).addScaledVector(right, Math.cos(angle) * r).addScaledVector(up, Math.sin(angle) * r);
        camera.lookAt(center);
      }
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, camera);
      gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      for (let i = 0; i < sum.length; i++) sum[i]! += pixels[i]! / frames;
      await new Promise((resolve) => setTimeout(resolve));
    }
    gl.setRenderTarget(null);
    scene.remove(light, light.target);
    target.dispose();
    return sum;
  };
  return { integrate, dispose: () => light.dispose() };
}

function softenAlpha(pixels: Float32Array, width: number, height: number, radius: number) {
  const span = radius * 2 + 1;
  const line = new Float32Array(Math.max(width, height));
  const blur = (length: number, read: (index: number) => number, write: (index: number, value: number) => void) => {
    for (let index = 0; index < length; index++) line[index] = read(index);
    let total = 0;
    for (let index = -radius; index <= radius; index++) total += line[Math.min(length - 1, Math.max(0, index))]!;
    for (let index = 0; index < length; index++) {
      write(index, Math.max(0, total / span));
      total += line[Math.min(length - 1, index + radius + 1)]! - line[Math.max(0, index - radius)]!;
    }
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < height; y++) {
      const row = y * width * 4 + 3;
      blur(width, (x) => pixels[row + x * 4]!, (x, value) => {
        pixels[row + x * 4] = value;
      });
    }
    for (let x = 0; x < width; x++) {
      blur(height, (y) => pixels[(y * width + x) * 4 + 3]!, (y, value) => {
        pixels[(y * width + x) * 4 + 3] = value;
      });
    }
  }
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = Math.min(1, pixels[index]! ** 1.9);
  return pixels;
}

async function groundShadow(gl: THREE.WebGLRenderer, pass: ReturnType<typeof createStillPass>, bag: BagGeometry, options: StillOptions) {
  const scale = Math.min(1, 1100 / Math.max(options.width, options.height));
  const width = Math.round(options.width * scale);
  const height = Math.round(options.height * scale);
  const stage = new THREE.Scene();
  const hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const geometry of [bag.front, bag.back, bag.gusset, bag.flap, bag.edges, bag.leatherStraps, bag.hardware]) {
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, hidden);
    mesh.castShadow = true;
    stage.add(mesh);
  }
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 1, color: "#000000" }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = bag.groundY;
  catcher.receiveShadow = true;
  stage.add(catcher);
  const alpha = softenAlpha(await pass.integrate(stage, width, height, options.shadowFrames ?? 160, 2048, 1), width, height, Math.round(width * 0.018));
  hidden.dispose();
  catcher.geometry.dispose();
  (catcher.material as THREE.Material).dispose();
  return { alpha, width, height };
}

function splitIntoLayers(rig: StillRig, mode: "tintable" | "rest", spec: DesignSpec) {
  const { materials, thread } = rig;
  const black = new THREE.Color(0, 0, 0);
  const white = new THREE.Color(1, 1, 1);
  const hides = [materials.front, materials.back, materials.flap, materials.straps, materials.gusset];
  const others = [materials.edges, materials.lining];
  const memory = [...hides, ...others].map((material) => ({ material, a: material.leather.uTintA.value.clone(), b: material.leather.uTintB.value.clone() }));
  const metal = materials.hardware.color.clone();
  const zip = materials.zip.color.clone();
  const threadColor = thread instanceof THREE.MeshStandardMaterial ? thread.color.clone() : null;
  const selfThread = !THREADS[spec.stitch.thread].hex;
  if (mode === "tintable") {
    for (const material of hides) {
      material.leather.uTintA.value.copy(white);
      if (material !== materials.front && material !== materials.back) material.leather.uTintB.value.copy(white);
      else material.leather.uTintB.value.copy(black);
    }
    for (const material of others) {
      material.leather.uTintA.value.copy(black);
      material.leather.uTintB.value.copy(black);
    }
    materials.hardware.color.copy(black);
    materials.zip.color.copy(black);
    if (thread instanceof THREE.MeshStandardMaterial) thread.color.copy(selfThread ? white : black);
    lightingUniforms.uSpecular.value = 0;
  } else {
    for (const material of hides) {
      material.leather.uTintA.value.copy(black);
      if (material !== materials.front && material !== materials.back) material.leather.uTintB.value.copy(black);
    }
    if (selfThread && thread instanceof THREE.MeshStandardMaterial) thread.color.copy(black);
    lightingUniforms.uSpecular.value = 1;
  }
  return () => {
    for (const { material, a, b } of memory) {
      material.leather.uTintA.value.copy(a);
      material.leather.uTintB.value.copy(b);
    }
    materials.hardware.color.copy(metal);
    materials.zip.color.copy(zip);
    if (threadColor && thread instanceof THREE.MeshStandardMaterial) thread.color.copy(threadColor);
    lightingUniforms.uSpecular.value = 1;
  };
}

function shadowAt(shadow: { alpha: Float32Array; width: number; height: number }, u: number, v: number) {
  const x = Math.min(shadow.width - 1.001, Math.max(0, u * shadow.width - 0.5));
  const y = Math.min(shadow.height - 1.001, Math.max(0, v * shadow.height - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (ix: number, iy: number) => shadow.alpha[(iy * shadow.width + ix) * 4 + 3]!;
  return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
}

function developStill(options: StillOptions, shadow: { alpha: Float32Array; width: number; height: number } | null, sample: (index: number, out: [number, number, number, number]) => void) {
  const { width, height } = options;
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const ctx = output.getContext("2d")!;
  const image = ctx.createImageData(width, height);
  const exposure = options.exposure ?? EXPOSURE;
  const background = options.background;
  const strength = options.shadowStrength ?? 1.35;
  const ink = [0.07, 0.05, 0.035];
  const pixel: [number, number, number, number] = [0, 0, 0, 0];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const row = height - 1 - y;
      sample((row * width + x) * 4, pixel);
      const to = (y * width + x) * 4;
      const alpha = pixel[3];
      const safe = Math.max(alpha, 1e-4);
      const tone = neutralTone([(pixel[0] / safe) * exposure, (pixel[1] / safe) * exposure, (pixel[2] / safe) * exposure]);
      const dark = shadow ? Math.min(1, shadowAt(shadow, (x + 0.5) / width, (row + 0.5) / height) ** 0.8 * strength) : 0;
      const under = dark * (1 - alpha);
      const total = alpha + under;
      for (let c = 0; c < 3; c++) {
        const bag = encode(tone[c]!) * 255;
        const shade = ink[c]! * 255;
        if (background) image.data[to + c] = bag * alpha + (background[c]! * (1 - dark) + shade * dark) * (1 - alpha);
        else image.data[to + c] = total > 0 ? (bag * alpha + shade * under) / total : 0;
      }
      image.data[to + 3] = background ? 255 : Math.min(255, total * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return output.toDataURL("image/png");
}

async function accumulateStill(gl: THREE.WebGLRenderer, scene: THREE.Scene, bag: BagGeometry, environment: THREE.DataTexture, rig: StillRig, options: StillOptions) {
  const previousAuto = gl.shadowMap.autoUpdate;
  const clear = gl.getClearAlpha();
  const baseIntensity = scene.environmentIntensity;
  const ambient = options.ambient ?? 0.3;
  const rotation = scene.environmentRotation.y;
  scene.environmentRotation.y = options.rotation ?? ENV_ROTATION;
  gl.shadowMap.autoUpdate = true;
  lightingUniforms.uDirectSpecular.value = 0;
  const pass = createStillPass(gl, bag, environment, options);
  const shadow = options.focus ? null : await groundShadow(gl, pass, bag, options);
  lightingUniforms.uIndirectDiffuse.value = ambient;
  const intensity = baseIntensity * (1 - ambient * 0.5);
  const results: Record<string, string> = {};
  const mapSize = 4096;
  if (options.variants?.length) {
    let restore = splitIntoLayers(rig, "tintable", options.spec);
    const tintable = await pass.integrate(scene, options.width, options.height, options.frames, mapSize, intensity);
    restore();
    restore = splitIntoLayers(rig, "rest", options.spec);
    const rest = await pass.integrate(scene, options.width, options.height, options.frames, mapSize, intensity);
    restore();
    for (const variant of options.variants) {
      const tint = new THREE.Color(variant.hex);
      results[variant.name] = developStill(options, shadow, (index, out) => {
        out[0] = tintable[index]! * tint.r + rest[index]!;
        out[1] = tintable[index + 1]! * tint.g + rest[index + 1]!;
        out[2] = tintable[index + 2]! * tint.b + rest[index + 2]!;
        out[3] = rest[index + 3]!;
      });
    }
  } else {
    const beauty = await pass.integrate(scene, options.width, options.height, options.frames, mapSize, intensity);
    results.still = developStill(options, shadow, (index, out) => {
      out[0] = beauty[index]!;
      out[1] = beauty[index + 1]!;
      out[2] = beauty[index + 2]!;
      out[3] = beauty[index + 3]!;
    });
  }
  pass.dispose();
  gl.setClearColor(0x000000, clear);
  gl.shadowMap.autoUpdate = previousAuto;
  lightingUniforms.uIndirectDiffuse.value = 1;
  lightingUniforms.uDirectSpecular.value = 1;
  scene.environmentRotation.y = rotation;
  return results;
}

function StillBridge({ forceSpec, settled, bag, environment, materials }: { forceSpec: (spec: DesignSpec) => void; settled: boolean; bag: BagGeometry | null; environment: THREE.DataTexture | null; materials: Materials }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const live = useRef({ settled, bag, environment });
  useLayoutEffect(() => {
    live.current = { settled, bag, environment };
  });
  useEffect(() => {
    if (!window.location.pathname.startsWith("/studio/render")) return;
    const render = async (options: StillOptions) => {
      forceSpec(options.spec);
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 400));
      for (let i = 0; i < 1200 && !(live.current.settled && live.current.bag && live.current.environment); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
      invalidate();
      let thread: THREE.Material | null = null;
      scene.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) thread = object.material as THREE.Material;
      });
      return accumulateStill(gl, scene, live.current.bag!, live.current.environment!, { materials, thread }, options);
    };
    (window as unknown as { __occuinStill?: typeof render }).__occuinStill = render;
  }, [forceSpec, gl, scene, invalidate, materials]);
  return null;
}

function exposeStoreInDevelopment() {
  if (process.env.NODE_ENV !== "development") return;
  (window as unknown as { __occuinStudio?: typeof useStudio }).__occuinStudio = useStudio;
}

export type Showcase = "plinth" | "lights";

const SHOWCASE_LIGHTS = [
  { offset: new THREE.Vector3(-1.5, 1.3, 1.1), color: "#ffd6a8", intensity: 1.9 },
  { offset: new THREE.Vector3(1.6, 1.1, -1.7), color: "#a9c9ff", intensity: 3.2 },
  { offset: new THREE.Vector3(-1.7, 0.5, -1.4), color: "#cfe2ff", intensity: 1.6 },
];

function fadeOut(size: number, inner: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(inner, "#fff");
  gradient.addColorStop(1, "#000");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function ShowcaseStage({ bag, kind, phone }: { bag: BagGeometry; kind: Showcase; phone: boolean }) {
  const lights = useRef<(THREE.DirectionalLight | null)[]>([]);
  const target = useMemo(() => new THREE.Object3D(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const alpha = useMemo(() => fadeOut(256, 0.86), []);
  useEffect(() => () => alpha.dispose(), [alpha]);
  const groundY = bag.groundY;
  const reach = bag.radius * 0.8;
  const depth = reach * 0.07;

  useFrame(({ camera }) => {
    target.position.set(0, bag.centerY, 0);
    target.updateMatrixWorld();
    SHOWCASE_LIGHTS.forEach((light, index) => {
      const node = lights.current[index];
      if (!node) return;
      aim.copy(light.offset).multiplyScalar(bag.radius * 2).applyQuaternion(camera.quaternion);
      node.position.copy(target.position).add(aim);
    });
  });

  return (
    <>
      <primitive object={target} />
      {SHOWCASE_LIGHTS.map((light, index) => (
        <directionalLight key={index} ref={(node) => { lights.current[index] = node; }} color={light.color} intensity={light.intensity} target={target} />
      ))}
      {kind === "plinth" ? (
        <>
      <mesh rotation-x={-Math.PI / 2} position={[0, groundY + 0.0004, 0]} renderOrder={-1}>
        <circleGeometry args={[reach, 96]} />
        <MeshReflectorMaterial
          resolution={phone ? 256 : 512}
          blur={[320, 90]}
          mixBlur={1}
          mixStrength={3.2}
          mirror={0.75}
          depthScale={0}
          color="#2c4a42"
          roughness={0.9}
          metalness={0.2}
          transparent
          opacity={0.92}
          alphaMap={alpha}
          depthWrite={false}
        />
      </mesh>
          <mesh position={[0, groundY - depth / 2, 0]} receiveShadow>
            <cylinderGeometry args={[reach, reach * 0.97, depth, 96, 1, true]} />
            <meshPhysicalMaterial color="#e3efe9" roughness={0.18} clearcoat={1} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation-x={-Math.PI / 2} position={[0, groundY + 0.0008, 0]}>
            <ringGeometry args={[reach * 0.985, reach, 96]} />
            <meshBasicMaterial color="#f4efe6" transparent opacity={0.5} depthWrite={false} />
          </mesh>
        </>
      ) : null}
    </>
  );
}

function Studio({ spec, upcoming, interactive, spin, paused, reduced, quality, onReady, shotRef, showcase, fade, framing }: { spec: DesignSpec; upcoming?: DesignSpec[]; interactive: boolean; spin: boolean; paused: boolean; reduced: boolean; quality: Quality; onReady?: () => void; shotRef?: RefObject<ShotTaker | null>; showcase?: Showcase; fade: boolean; framing?: number }) {
  const [forced, setForced] = useState<DesignSpec | null>(null);
  const active = forced ?? spec;
  const section = useStudio((state) => state.section);
  const reveal = interactive && !spin && section === "lining";
  const tier = forced ? STILL_QUALITY : quality;
  const { bag, surfaces, generation, settled } = useBagAssets(active, tier, reveal, forced ? undefined : upcoming);
  const gl = useThree((state) => state.gl);
  const anisotropy = useMemo(() => {
    const max = gl.capabilities.getMaxAnisotropy();
    setMaxAnisotropy(max);
    return max;
  }, [gl]);
  const { tiles, loaded } = useGrainTiles(active, tier.suffix, anisotropy, spin);
  const environment = useEnvironment(quality.hdri, showcase ? SHOWCASE_ENV : ENV_INTENSITY);
  const materials = useMaterials();
  const fadeColors = useColorFade(fade && !reduced);
  useDressedMaterials(materials, active, surfaces, tiles, fadeColors);
  const controls = useRef<OrbitHandle>(null);
  const autoRotate = useStudio((state) => state.autoRotate);
  const footprint = Math.max(active.form.width, active.form.depth) * UNIT_PER_MM;
  const rise = active.form.height * UNIT_PER_MM;
  const groundY = bag?.groundY ?? 0;
  const liveLights = !forced;
  const keyReach = bag ? bag.radius * 1.6 : 4;

  const pointerTarget = useThree((state) => state.events.connected);

  useEffect(() => {
    const surface = controls.current?.domElement;
    if (spin && surface) surface.style.touchAction = "pan-y pinch-zoom";
  }, [spin, pointerTarget]);

  return (
    <>
      <Invalidator spec={active} generation={generation} surfaces={surfaces} tiles={tiles} environment={environment} />
      {liveLights ? (
        <directionalLight
          position={[bag ? bag.radius * 1.4 : 3, bag ? bag.radius * 3 : 6, bag ? bag.radius * 2.2 : 4]}
          intensity={1.1}
          castShadow
          shadow-mapSize={[quality.shadow, quality.shadow]}
          shadow-bias={-0.00025}
          shadow-normalBias={0.02}
          shadow-radius={5}
          shadow-camera-left={-keyReach}
          shadow-camera-right={keyReach}
          shadow-camera-top={keyReach}
          shadow-camera-bottom={-keyReach}
          shadow-camera-near={0.1}
          shadow-camera-far={keyReach * 6}
        />
      ) : null}
      <OrbitControls
        ref={controls}
        enabled={interactive}
        enablePan={false}
        enableZoom={!spin}
        enableDamping={!reduced}
        dampingFactor={0.08}
        minDistance={bag ? bag.radius * 0.55 : 1}
        maxDistance={bag ? fitDistance(bag.radius, 1) * 2.2 : 60}
        maxPolarAngle={Math.PI * 0.62}
        autoRotate={(autoRotate || spin) && !reduced && !paused}
        autoRotateSpeed={spin ? (showcase ? SHOWCASE_SPIN : 1.1) : 0.7}
      />
      {bag ? <CameraRig bag={bag} controls={controls} reduced={reduced} reveal={reveal} controlStrip={!spin} framing={framing} opening={showcase ? SHOWCASE_ANGLES : undefined} /> : null}
      {bag ? <Bag bag={bag} materials={materials} spec={active} fade={fadeColors} /> : null}
      {liveLights && bag && showcase ? <ShowcaseStage bag={bag} kind={showcase} phone={quality.dpr[1] < 1.5} /> : null}
      {liveLights && bag ? (
        <>
          {showcase === "plinth" ? null : <ContactShadows key={`wide-${generation}`} frames={2} position={[0, groundY + 0.002, 0]} scale={Math.max(footprint * 3.4, 2)} far={Math.max(rise * 1.1, 0.6)} resolution={1024} blur={3.2} opacity={0.5} color="#1a130c" />}
          <ContactShadows key={`tight-${generation}`} frames={2} position={[0, groundY + 0.004, 0]} scale={Math.max(footprint * 2.2, 1.5)} far={Math.max(rise * 0.12, 0.08)} resolution={1024} blur={1.2} opacity={0.72} color="#120c07" />
        </>
      ) : null}
      <CaptureBridge bag={bag} />
      <ShotBridge bag={bag} ready={Boolean(settled && loaded && environment)} shotRef={shotRef} />
      <StillBridge forceSpec={setForced} settled={settled && loaded} bag={bag} environment={environment?.texture ?? null} materials={materials} />
      <ReadySignal ready={Boolean(bag && surfaces && environment && loaded)} onReady={onReady} />
    </>
  );
}

export default function Scene({ spec, upcoming, interactive = true, spin = false, lite = false, still = false, paused = false, onReady, onContextLost, shotRef, showcase, fade = false, framing }: { spec: DesignSpec; upcoming?: DesignSpec[]; interactive?: boolean; spin?: boolean; lite?: boolean; still?: boolean; paused?: boolean; onReady?: () => void; onContextLost?: () => void; shotRef?: RefObject<ShotTaker | null>; showcase?: Showcase; fade?: boolean; framing?: number }) {
  const [reduced, setReduced] = useState(false);
  const [quality] = useState(() => (still ? STILL_QUALITY : lite ? liteQuality() : detectQuality()));
  const autoRotate = useStudio((state) => state.autoRotate);

  useEffect(() => {
    exposeStoreInDevelopment();
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return (
    <Canvas
      frameloop={(autoRotate || spin) && !reduced && !paused ? "always" : "demand"}
      dpr={quality.dpr}
      resize={{ offsetSize: true }}
      shadows
      camera={{ fov: FOV, near: 0.05, far: 400, position: [0, 3, 18] }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: !lite, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: EXPOSURE, powerPreference: "high-performance" }}
      aria-label="Live three dimensional preview of your design"
      onCreated={({ gl }) => {
        gl.shadowMap.autoUpdate = false;
        gl.domElement.addEventListener("webglcontextlost", () => {
          if (gl.domElement.isConnected) onContextLost?.();
        });
      }}
    >
      <Studio spec={spec} upcoming={upcoming} interactive={interactive} spin={spin} paused={paused} reduced={reduced} quality={quality} onReady={onReady} shotRef={shotRef} showcase={showcase} fade={fade} framing={framing} />
    </Canvas>
  );
}
