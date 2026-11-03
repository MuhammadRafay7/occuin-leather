import * as THREE from "three";
import { COLORS, FINISHES, THREADS, type DesignSpec, type FinishKey, type Hide } from "./spec";
import { accentSeams, buildOutline, flapFrame, surfaceFrame, type OutlinePoint } from "./geometry";
import { grainTileUrls } from "./grain-files";

type Grain = (typeof FINISHES)[FinishKey]["grain"];

const GRAIN_LOOKS: Record<Grain, { tileMm: number; normal: number; albedo: number; rough: number; ao: number }> = {
  smooth: { tileMm: 300, normal: 0.42, albedo: 0.32, rough: 0.28, ao: 0.25 },
  pebble: { tileMm: 360, normal: 1, albedo: 0.62, rough: 0.5, ao: 0.8 },
  saffiano: { tileMm: 62, normal: 0.8, albedo: 0.55, rough: 0.5, ao: 0.6 },
  croc: { tileMm: 200, normal: 1.2, albedo: 0.95, rough: 0.55, ao: 0.95 },
  suede: { tileMm: 150, normal: 0.55, albedo: 0.9, rough: 0.2, ao: 0.4 },
};

export type GrainTile = { normal: THREE.Texture; detail: THREE.Texture };

const tileCache = new Map<string, Promise<GrainTile>>();

function loadMap(url: string, anisotropy: number) {
  return new THREE.TextureLoader().loadAsync(url).then((texture) => {
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = anisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
}

export function loadGrainTile(finish: FinishKey, suffix: string, anisotropy: number) {
  const key = `${finish}${suffix}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const urls = grainTileUrls(finish, suffix);
  const pending = Promise.all([loadMap(urls.normal, anisotropy), loadMap(urls.detail, anisotropy)]).then(([normal, detail]) => ({ normal, detail }));
  pending.catch(() => tileCache.delete(key));
  tileCache.set(key, pending);
  return pending;
}

function blankCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  return canvas;
}

type Layers = { overlay: CanvasRenderingContext2D; height: CanvasRenderingContext2D; mask: CanvasRenderingContext2D; size: number; pxPerMm: number };

function makeLayers(size: number, pxPerMm: number): Layers {
  const context = () => blankCanvas(size).getContext("2d")!;
  const layers = { overlay: context(), height: context(), mask: context(), size, pxPerMm };
  layers.height.fillStyle = "#808080";
  layers.height.fillRect(0, 0, size, size);
  layers.mask.fillStyle = "#000";
  layers.mask.fillRect(0, 0, size, size);
  return layers;
}

function fillAccent(layers: Layers, path: Path2D) {
  layers.mask.fillStyle = "#f00";
  layers.mask.fill(path);
  layers.height.fillStyle = "rgba(255,255,255,.09)";
  layers.height.fill(path);
}

function threadHex(spec: DesignSpec) {
  const thread = THREADS[spec.stitch.thread];
  if (thread.hex) return thread.hex;
  return shade(COLORS[spec.panels.primary.color].hex, 1.35);
}

export function shade(hex: string, factor: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

function seam(layers: Layers, draw: (ctx: CanvasRenderingContext2D) => void) {
  const px = layers.pxPerMm;
  const { overlay, height } = layers;
  height.save();
  height.strokeStyle = "rgba(0,0,0,.8)";
  height.lineWidth = 1.5 * px;
  height.beginPath();
  draw(height);
  height.stroke();
  height.restore();
  overlay.save();
  overlay.strokeStyle = "rgba(0,0,0,.4)";
  overlay.lineWidth = 0.6 * px;
  overlay.beginPath();
  draw(overlay);
  overlay.stroke();
  overlay.restore();
}

function stitchGroove(layers: Layers, path: Path2D) {
  const { height, pxPerMm: px } = layers;
  height.save();
  height.strokeStyle = "rgba(0,0,0,.34)";
  height.lineWidth = 1.5 * px;
  height.lineJoin = "round";
  height.stroke(path);
  height.restore();
}

function monogramFont(spec: DesignSpec, px: number) {
  const families: Record<DesignSpec["monogram"]["font"], string> = {
    didone: `600 ${px}px ${cssFont("--font-display")}, "Bodoni Moda", Didot, serif`,
    grotesk: `500 ${px}px ${cssFont("--font-sans")}, "Jost", "Helvetica Neue", sans-serif`,
    script: `400 ${px * 1.35}px ${cssFont("--font-script")}, "Pinyon Script", cursive`,
  };
  return families[spec.monogram.font];
}

function cssFont(variable: string) {
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return value || "serif";
}

function drawMark(layers: Layers, spec: DesignSpec, text: string, x: number, y: number, px: number, technique = spec.monogram.technique) {
  const { overlay, height, mask } = layers;
  const font = monogramFont(spec, px);
  for (const ctx of [overlay, height, mask]) {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }
  height.save();
  height.shadowColor = "rgba(0,0,0,.9)";
  height.shadowBlur = px * 0.04;
  height.fillStyle = "rgba(0,0,0,.72)";
  height.fillText(text, x, y);
  height.restore();
  if (technique === "blind") {
    overlay.fillStyle = "rgba(0,0,0,.24)";
    overlay.fillText(text, x, y);
    return;
  }
  const foil = technique === "gold" ? "#e2b963" : technique === "palladium" ? "#dcdcd8" : shade(COLORS[spec.edgeColor].hex, 1.1);
  overlay.fillStyle = foil;
  overlay.fillText(text, x, y);
  if (technique === "paint") return;
  mask.fillStyle = "#0f0";
  mask.fillText(text, x, y);
}

function quiltCell(step: number) {
  const cell = blankCanvas(Math.max(8, Math.round(step)));
  const ctx = cell.getContext("2d")!;
  const size = cell.width;
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.62);
  glow.addColorStop(0, "#d8d8d8");
  glow.addColorStop(0.62, "#a4a4a4");
  glow.addColorStop(1, "#4a4a4a");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  return cell;
}

function drawPattern(layers: Layers, spec: DesignSpec, clip: Path2D) {
  const { overlay, height, size, pxPerMm: px } = layers;
  const scale = spec.surface.scale;
  const pattern = spec.surface.pattern;
  if (pattern === "none") return;
  const text = spec.monogram.text.trim().toUpperCase() || "OC";
  for (const ctx of [overlay, height]) {
    ctx.save();
    ctx.clip(clip);
  }
  if (pattern === "quilted") {
    const step = 26 * scale * px;
    const cellSize = step / Math.SQRT2 * Math.SQRT2;
    const cell = quiltCell(cellSize);
    const fill = height.createPattern(cell, "repeat")!;
    fill.setTransform(new DOMMatrix().rotate(45).scale(step / Math.SQRT2 / cell.width * Math.SQRT2 * 0.7071));
    height.fillStyle = fill;
    height.fillRect(0, 0, size, size);
    const gap = step;
    overlay.strokeStyle = threadHex(spec);
    overlay.lineWidth = 0.75 * px;
    overlay.setLineDash([2.5 * px, 1.3 * px]);
    overlay.lineCap = "round";
    for (let i = -size * 2; i < size * 3; i += gap) {
      overlay.beginPath(); overlay.moveTo(i, 0); overlay.lineTo(i + size, size); overlay.stroke();
      overlay.beginPath(); overlay.moveTo(i, 0); overlay.lineTo(i - size, size); overlay.stroke();
    }
  } else if (pattern === "woven") {
    const strip = 11 * scale * px;
    overlay.save();
    overlay.translate(size / 2, size / 2);
    overlay.rotate(Math.PI / 4);
    height.save();
    height.translate(size / 2, size / 2);
    height.rotate(Math.PI / 4);
    const reach = Math.ceil(size / strip);
    for (let j = -reach; j < reach; j++) {
      for (let i = -reach; i < reach; i++) {
        const x = i * strip;
        const y = j * strip;
        const over = (i + j) % 2 === 0;
        const across = over ? height.createLinearGradient(x, 0, x + strip, 0) : height.createLinearGradient(0, y, 0, y + strip);
        across.addColorStop(0, "#1d1d1d");
        across.addColorStop(0.14, "#909090");
        across.addColorStop(0.5, "#e8e8e8");
        across.addColorStop(0.86, "#909090");
        across.addColorStop(1, "#1d1d1d");
        height.fillStyle = across;
        height.fillRect(x, y, strip, strip);
        overlay.fillStyle = over ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.2)";
        overlay.fillRect(x, y, strip, strip);
      }
    }
    overlay.restore();
    height.restore();
  } else if (pattern === "perforated") {
    const step = 11 * scale * px;
    for (let y = 0, row = 0; y < size; y += step * 0.86, row++) {
      for (let x = row % 2 ? step / 2 : 0; x < size; x += step) {
        for (const ctx of [overlay, height]) {
          ctx.fillStyle = "#050403";
          ctx.beginPath();
          ctx.arc(x, y, 1.5 * scale * px, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    const step = 46 * scale * px;
    const glyph = 15 * scale * px;
    const hexColor = shade(COLORS[spec.panels.primary.color].hex, 1.65);
    overlay.fillStyle = hexColor;
    height.fillStyle = "rgba(0,0,0,.45)";
    for (const ctx of [overlay, height]) {
      ctx.font = monogramFont(spec, glyph);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }
    for (let y = 0, row = 0; y < size + step; y += step * 0.62, row++) {
      for (let x = row % 2 ? step / 2 : 0; x < size + step; x += step) {
        overlay.fillText(text, x, y);
        height.fillText(text, x, y);
      }
    }
  }
  for (const ctx of [overlay, height]) ctx.restore();
}

function bodyPath(outline: OutlinePoint[], map: (x: number, y: number) => [number, number]) {
  const path = new Path2D();
  outline.forEach((p, i) => {
    const [x, y] = map(p.x, p.y);
    if (i) path.lineTo(x, y);
    else path.moveTo(x, y);
  });
  path.closePath();
  return path;
}

function rimPath(outline: OutlinePoint[], cy: number, inset: number, map: (x: number, y: number) => [number, number]) {
  return bodyPath(outline.map((p) => {
    const dist = Math.hypot(p.x, p.y - cy) || 1;
    const s = 1 - inset / dist;
    return { x: p.x * s, y: cy + (p.y - cy) * s, zone: p.zone };
  }), map);
}

export type PaintedSurface = { overlay: THREE.Texture; height: THREE.Texture; mask: THREE.Texture; texel: number; owned: boolean };

let maxAnisotropy = 16;

export function setMaxAnisotropy(value: number) {
  maxAnisotropy = value;
}

function canvasTexture(ctx: CanvasRenderingContext2D, srgb: boolean) {
  const texture = new THREE.CanvasTexture(ctx.canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function toTextures(layers: Layers): PaintedSurface {
  return {
    overlay: canvasTexture(layers.overlay, true),
    height: canvasTexture(layers.height, false),
    mask: canvasTexture(layers.mask, false),
    texel: 1 / layers.size,
    owned: true,
  };
}

export function paintBody(spec: DesignSpec, side: "front" | "back", size = 2048): PaintedSurface {
  const outline = buildOutline(spec.form);
  const frame = surfaceFrame(spec.form);
  const px = size / frame.span;
  const layers = makeLayers(size, px);
  const map = (x: number, y: number): [number, number] => [(x - frame.x) * px, size - (y - frame.y) * px];
  const whole = bodyPath(outline, map);
  drawPattern(layers, spec, whole);

  const { panels, form } = spec;
  const panelY = form.height * panels.divide;
  const lines = accentSeams(spec);
  const trace = (ctx: CanvasRenderingContext2D) => {
    for (const line of lines) {
      line.forEach((point, i) => {
        const [x, y] = map(point.x, point.y);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
    }
  };
  if (panels.layout === "yoke") {
    const [, y] = map(0, panelY);
    const path = new Path2D();
    path.rect(0, 0, size, y);
    fillAccent(layers, path);
  } else if (panels.layout === "split") {
    const [x] = map((panels.divide - 0.5) * form.width, 0);
    const path = new Path2D();
    path.rect(x, 0, size - x, size);
    fillAccent(layers, path);
  } else if (panels.layout === "diagonal") {
    const [lx, ly] = map(-form.width, panelY - form.height * 0.45);
    const [rx, ry] = map(form.width, panelY + form.height * 0.45);
    const path = new Path2D();
    path.moveTo(lx, ly); path.lineTo(rx, ry); path.lineTo(rx, 0); path.lineTo(lx, 0); path.closePath();
    fillAccent(layers, path);
  } else if (panels.layout === "tipped") {
    const r = Math.min(form.width, form.height) * 0.3;
    for (const sign of [-1, 1]) {
      const [cx, cy] = map(sign * (form.width / 2), 0);
      const path = new Path2D();
      path.arc(cx, cy, r * px, 0, Math.PI * 2);
      fillAccent(layers, path);
    }
  }
  if (lines.length) seam(layers, trace);

  const scale = Math.min(1, Math.max(0.35, Math.min(form.width, form.height) / 200));
  for (const inset of spec.stitch.rows === 2 ? [5 * scale, 8.5 * scale] : [5 * scale]) {
    stitchGroove(layers, rimPath(outline, form.height / 2, inset, map));
  }

  const text = spec.monogram.text.trim().toUpperCase();
  if (text && side === "front" && spec.monogram.placement !== "flap" && spec.surface.pattern !== "signature") {
    const glyph = Math.max(Math.min(form.height * 0.13, 40), 9);
    const [x, y] = spec.monogram.placement === "center"
      ? map(0, form.height * 0.5)
      : map(form.width * 0.33, Math.max(form.height * 0.14, glyph * 0.9));
    drawMark(layers, spec, text, x, y, glyph * px);
  }

  return toTextures(layers);
}

export function paintFlap(spec: DesignSpec, size = 1536): PaintedSurface {
  const frame = flapFrame(spec);
  const px = size / frame.span;
  const layers = makeLayers(size, px);
  const clip = new Path2D();
  clip.rect(0, 0, size, size);
  drawPattern(layers, spec, clip);
  const text = spec.monogram.text.trim().toUpperCase();
  if (text && spec.monogram.placement === "flap" && spec.surface.pattern !== "signature") {
    const drop = spec.form.height * spec.closure.flapLength;
    const glyph = Math.max(Math.min(spec.form.height * 0.13, 36), 9) * px;
    drawMark(layers, spec, text, size / 2, (frame.start + drop * 0.46) * px, glyph);
  }
  return toTextures(layers);
}

let blank: PaintedSurface | null = null;

export function blankSurface(): PaintedSurface {
  if (blank) return blank;
  const layers = makeLayers(4, 1);
  blank = { ...toTextures(layers), owned: false };
  return blank;
}

export function disposeSurface(surface: PaintedSurface) {
  if (!surface.owned) return;
  surface.overlay.dispose();
  surface.height.dispose();
  surface.mask.dispose();
}

let threadMap: THREE.CanvasTexture | null = null;

export function threadBump() {
  if (threadMap) return threadMap;
  const canvas = blankCanvas(64);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6a6a6a";
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "#e4e4e4";
  ctx.lineWidth = 7;
  for (let i = -64; i < 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 40, 64);
    ctx.stroke();
  }
  threadMap = new THREE.CanvasTexture(canvas);
  threadMap.wrapS = threadMap.wrapT = THREE.RepeatWrapping;
  threadMap.repeat.set(1, 3);
  return threadMap;
}

export const lightingUniforms = {
  uIndirectDiffuse: { value: 1 },
  uDirectSpecular: { value: 1 },
  uSpecular: { value: 1 },
};

const LIGHTING_PARS = `
uniform float uIndirectDiffuse;
uniform float uDirectSpecular;
uniform float uSpecular;
`;
const LIGHTING_BODY = `
reflectedLight.indirectDiffuse *= uIndirectDiffuse;
reflectedLight.directSpecular *= uDirectSpecular;
reflectedLight.indirectSpecular *= uSpecular;
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect *= uSpecular;
clearcoatSpecularDirect *= uDirectSpecular;
#endif
`;

export function patchLighting<T extends THREE.Material>(material: T) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uIndirectDiffuse = lightingUniforms.uIndirectDiffuse;
    shader.uniforms.uDirectSpecular = lightingUniforms.uDirectSpecular;
    shader.uniforms.uSpecular = lightingUniforms.uSpecular;
    shader.fragmentShader = LIGHTING_PARS + shader.fragmentShader.replace("#include <aomap_fragment>", `#include <aomap_fragment>\n${LIGHTING_BODY}`);
  };
  return material;
}

const LEATHER_VERTEX_PARS = `
attribute vec2 aGrain;
varying vec2 vGrain;
varying vec2 vPaintUv;
`;

const LEATHER_FRAGMENT_PARS = `
${LIGHTING_PARS}
uniform sampler2D uOverlay;
uniform sampler2D uHeight;
uniform sampler2D uMask;
uniform sampler2D uNormalA;
uniform sampler2D uDetailA;
uniform sampler2D uNormalB;
uniform sampler2D uDetailB;
uniform float uPaintTexel;
uniform float uHeightGain;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec4 uSurfaceA;
uniform vec4 uSurfaceB;
uniform vec4 uAmountA;
uniform vec4 uAmountB;
varying vec2 vGrain;
varying vec2 vPaintUv;

const mat2 grainTurn = mat2(0.8, -0.6, 0.6, 0.8);

float antiTile(vec2 g) {
  return smoothstep(-0.28, 0.28, sin(g.x * 2.7 + sin(g.y * 3.1) * 1.3) * sin(g.y * 2.3 + sin(g.x * 1.9) * 1.1));
}

float mottle(vec2 g) {
  return sin(g.x * 4.3 + sin(g.y * 5.7) * 1.7) * 0.5 + sin(g.y * 7.1 + sin(g.x * 3.3) * 2.1) * 0.3 + sin((g.x + g.y) * 11.0) * 0.2;
}

void sampleGrain(sampler2D normals, sampler2D details, vec2 g, out vec3 n, out vec3 d) {
  vec2 h = grainTurn * g + 0.37;
  float blend = antiTile(g);
  vec3 n1 = texture2D(normals, g).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(normals, h).xyz * 2.0 - 1.0;
  n2.xy = n2.xy * grainTurn;
  n = mix(n1, n2, blend);
  d = mix(texture2D(details, g).xyz, texture2D(details, h).xyz, blend);
}
`;

const COLOR_FRAGMENT = `
vec4 paintOverlay = texture2D(uOverlay, vPaintUv);
vec4 paintMask = texture2D(uMask, vPaintUv);
float accentMask = paintMask.r;
float foilMask = paintMask.g;
vec2 grainA = vGrain * uAmountA.w;
vec2 grainB = vGrain * uAmountB.w;
vec3 grainNormalA; vec3 grainDetailA; vec3 grainNormalB; vec3 grainDetailB;
sampleGrain(uNormalA, uDetailA, grainA, grainNormalA, grainDetailA);
sampleGrain(uNormalB, uDetailB, grainB, grainNormalB, grainDetailB);
vec3 grainDetail = mix(grainDetailA, grainDetailB, accentMask);
vec3 grainNormal = mix(grainNormalA * vec3(uSurfaceA.w, uSurfaceA.w, 1.0), grainNormalB * vec3(uSurfaceB.w, uSurfaceB.w, 1.0), accentMask);
vec4 hideAmount = mix(uAmountA, uAmountB, accentMask);
float albedoRatio = mix(1.0, grainDetail.r * 2.0, hideAmount.x);
float mottling = 1.0 + 0.045 * mottle(vGrain * 0.0061);
vec3 hideTint = mix(uTintA, uTintB, accentMask);
vec3 hideColor = hideTint * albedoRatio * mottling;
hideColor *= mix(vec3(1.0), pow(hideTint / max(max(hideTint.r, max(hideTint.g, hideTint.b)), 0.001), vec3(0.32)), clamp(1.0 - albedoRatio, 0.0, 1.0));
diffuseColor.rgb = mix(hideColor, paintOverlay.rgb, paintOverlay.a);
`;

const ROUGHNESS_FRAGMENT = `
float grainVariance = clamp(1.0 - length(mix(grainNormalA, grainNormalB, accentMask)), 0.0, 1.0);
float roughnessFactor = mix(uSurfaceA.x, uSurfaceB.x, accentMask) + (grainDetail.g - 0.5) * hideAmount.y + grainVariance * 0.12;
roughnessFactor = clamp(mix(roughnessFactor, 0.4, foilMask), 0.08, 1.0);
`;

const METALNESS_FRAGMENT = `
float metalnessFactor = foilMask * 0.75;
`;

const NORMAL_FRAGMENT = `
float heightLeft = texture2D(uHeight, vPaintUv - vec2(uPaintTexel, 0.0)).r;
float heightRight = texture2D(uHeight, vPaintUv + vec2(uPaintTexel, 0.0)).r;
float heightDown = texture2D(uHeight, vPaintUv - vec2(0.0, uPaintTexel)).r;
float heightUp = texture2D(uHeight, vPaintUv + vec2(0.0, uPaintTexel)).r;
vec2 paintSlope = vec2(heightLeft - heightRight, heightDown - heightUp) * uHeightGain;
vec3 detailNormal = normalize(vec3(grainNormal.xy * (1.0 - foilMask * 0.65) + paintSlope, 1.0));
vec3 surfaceDx = dFdx(-vViewPosition);
vec3 surfaceDy = dFdy(-vViewPosition);
vec2 grainDx = dFdx(vGrain);
vec2 grainDy = dFdy(vGrain);
vec3 crossY = cross(surfaceDy, normal);
vec3 crossX = cross(normal, surfaceDx);
vec3 tangentAxis = crossY * grainDx.x + crossX * grainDy.x;
vec3 bitangentAxis = crossY * grainDx.y + crossX * grainDy.y;
float frameScale = max(dot(tangentAxis, tangentAxis), dot(bitangentAxis, bitangentAxis));
frameScale = frameScale <= 0.0 ? 0.0 : inversesqrt(frameScale);
vec3 clearcoatSource = normal;
normal = normalize(tangentAxis * frameScale * detailNormal.x + bitangentAxis * frameScale * detailNormal.y + normal * detailNormal.z);
`;

const PHYSICAL_FRAGMENT = `
#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat = saturate(mix(uSurfaceA.y, uSurfaceB.y, accentMask) * (1.0 - foilMask));
#endif
#ifdef USE_SHEEN
material.sheenColor = mix(vec3(0.0), diffuseColor.rgb * 1.6 + 0.05, mix(uSurfaceA.z, uSurfaceB.z, accentMask));
#endif
`;

const OCCLUSION_FRAGMENT = `
float grainOcclusion = mix(1.0, grainDetail.b, hideAmount.z);
float bodyOcclusion = vColor.r * grainOcclusion;
reflectedLight.indirectDiffuse *= bodyOcclusion;
reflectedLight.indirectSpecular *= mix(1.0, bodyOcclusion, 0.8);
reflectedLight.directDiffuse *= mix(1.0, grainOcclusion, 0.6) * mix(1.0, vColor.r, 0.45);
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect *= mix(1.0, bodyOcclusion, 0.8);
#endif
${LIGHTING_BODY}
`;

export type LeatherUniforms = {
  uOverlay: { value: THREE.Texture };
  uHeight: { value: THREE.Texture };
  uMask: { value: THREE.Texture };
  uNormalA: { value: THREE.Texture };
  uDetailA: { value: THREE.Texture };
  uNormalB: { value: THREE.Texture };
  uDetailB: { value: THREE.Texture };
  uPaintTexel: { value: number };
  uHeightGain: { value: number };
  uTintA: { value: THREE.Color };
  uTintB: { value: THREE.Color };
  uSurfaceA: { value: THREE.Vector4 };
  uSurfaceB: { value: THREE.Vector4 };
  uAmountA: { value: THREE.Vector4 };
  uAmountB: { value: THREE.Vector4 };
};

let flatTexture: THREE.DataTexture | null = null;

function flatGrain() {
  if (flatTexture) return flatTexture;
  flatTexture = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  flatTexture.needsUpdate = true;
  return flatTexture;
}

export type LeatherMaterial = THREE.MeshPhysicalMaterial & { leather: LeatherUniforms };

export function createLeather(): LeatherMaterial {
  const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.34, sheen: 1, sheenRoughness: 0.72, roughness: 1, metalness: 0 });
  const blankTextures = blankSurface();
  const flat = flatGrain();
  const leather: LeatherUniforms = {
    uOverlay: { value: blankTextures.overlay },
    uHeight: { value: blankTextures.height },
    uMask: { value: blankTextures.mask },
    uNormalA: { value: flat },
    uDetailA: { value: flat },
    uNormalB: { value: flat },
    uDetailB: { value: flat },
    uPaintTexel: { value: 0.25 },
    uHeightGain: { value: 0 },
    uTintA: { value: new THREE.Color() },
    uTintB: { value: new THREE.Color() },
    uSurfaceA: { value: new THREE.Vector4(0.5, 0, 0, 1) },
    uSurfaceB: { value: new THREE.Vector4(0.5, 0, 0, 1) },
    uAmountA: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.003) },
    uAmountB: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.003) },
  };
  material.customProgramCacheKey = () => "occuin-leather-1";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, leather, lightingUniforms);
    shader.vertexShader = LEATHER_VERTEX_PARS + shader.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvGrain = aGrain;\nvPaintUv = uv;");
    shader.fragmentShader = LEATHER_FRAGMENT_PARS + shader.fragmentShader
      .replace("#include <map_fragment>", COLOR_FRAGMENT)
      .replace("#include <color_fragment>", "")
      .replace("#include <roughnessmap_fragment>", ROUGHNESS_FRAGMENT)
      .replace("#include <metalnessmap_fragment>", METALNESS_FRAGMENT)
      .replace("#include <normal_fragment_maps>", NORMAL_FRAGMENT)
      .replace("#include <clearcoat_normal_fragment_begin>", "vec3 clearcoatNormal = normalize(mix(clearcoatSource, normal, 0.55));")
      .replace("#include <lights_physical_fragment>", PHYSICAL_FRAGMENT)
      .replace("#include <aomap_fragment>", OCCLUSION_FRAGMENT);
  };
  return Object.assign(material, { leather });
}

function assignHide(leather: LeatherUniforms, slot: "A" | "B", hide: Hide, tile: GrainTile | null) {
  const finish = FINISHES[hide.finish];
  const grain = GRAIN_LOOKS[finish.grain];
  leather[`uTint${slot}`].value.set(COLORS[hide.color].hex);
  leather[`uSurface${slot}`].value.set(finish.roughness, finish.clearcoat, finish.sheen, grain.normal);
  leather[`uAmount${slot}`].value.set(grain.albedo, grain.rough, grain.ao, 1 / grain.tileMm);
  if (!tile) return;
  leather[`uNormal${slot}`].value = tile.normal;
  leather[`uDetail${slot}`].value = tile.detail;
}

const HEIGHT_GAIN_PER_MM = 1.1;

export function dressLeather(material: LeatherMaterial, primary: Hide, accent: Hide, surface: PaintedSurface | null, pxPerMm: number, tiles: Partial<Record<FinishKey, GrainTile>>) {
  const { leather } = material;
  assignHide(leather, "A", primary, tiles[primary.finish] ?? null);
  assignHide(leather, "B", accent, tiles[accent.finish] ?? null);
  const painted = surface ?? blankSurface();
  leather.uOverlay.value = painted.overlay;
  leather.uHeight.value = painted.height;
  leather.uMask.value = painted.mask;
  leather.uPaintTexel.value = painted.texel;
  leather.uHeightGain.value = surface ? HEIGHT_GAIN_PER_MM * pxPerMm : 0;
}

export function allFinishes(spec: DesignSpec): FinishKey[] {
  return [...new Set<FinishKey>([spec.panels.primary.finish, spec.panels.accent.finish, spec.panels.gusset.finish, "box", "suede"])];
}
