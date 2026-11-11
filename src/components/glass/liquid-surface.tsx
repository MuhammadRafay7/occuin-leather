"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

// A glass surface that bends what is behind it at its rounded rim, the way a thick pane of glass
// does, instead of only blurring it. The bend comes from a displacement map drawn for the element's
// exact size: flat in the middle, steepening toward the edge along the rim's normal.
//
// Only Chromium can run an SVG filter inside backdrop-filter, and only pointer devices get it (it
// costs a little on every scroll frame). Everyone else keeps the plain frosted `.liquid` look.

const BEZEL = 20;
const STRENGTH = 72;

export function canRefract() {
  if (typeof window === "undefined") return false;
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands ?? [];
  return brands.some(({ brand }) => brand === "Chromium") && window.matchMedia("(hover: hover)").matches && !window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)").matches;
}

function rimMap(width: number, height: number, radius: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(width, height);
  const r = Math.min(radius, width / 2, height / 2);
  const halfW = width / 2;
  const halfH = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - halfW;
      const py = y + 0.5 - halfH;
      const qx = Math.abs(px) - (halfW - r);
      const qy = Math.abs(py) - (halfH - r);
      let nx: number;
      let ny: number;
      let distance: number;
      if (qx > 0 && qy > 0) {
        const length = Math.hypot(qx, qy) || 1;
        nx = (qx / length) * Math.sign(px);
        ny = (qy / length) * Math.sign(py);
        distance = length - r;
      } else if (qx > qy) {
        nx = Math.sign(px);
        ny = 0;
        distance = qx - r;
      } else {
        nx = 0;
        ny = Math.sign(py);
        distance = qy - r;
      }
      const depth = -distance;
      const t = depth >= BEZEL ? 0 : 1 - Math.max(depth, 0) / BEZEL;
      const bend = t * t;
      const index = (y * width + x) * 4;
      image.data[index] = 128 - nx * bend * 127;
      image.data[index + 1] = 128 - ny * bend * 127;
      image.data[index + 2] = 128;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

type Lens = { width: number; height: number; url: string };
type Tone = "light" | "dark";

const DARK_BELOW = 0.36;
const SAMPLE_MS = 90;
const COLOR = /(rgba?\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b)/gi;
const colorCache = new Map<string, [number, number] | null>();
let probe: CanvasRenderingContext2D | null = null;

// Relative luminance and alpha of any CSS colour, read back from a 1px canvas so oklab and friends work.
function readColor(value: string): [number, number] | null {
  const cached = colorCache.get(value);
  if (cached !== undefined) return cached;
  probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
  if (!probe) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const result: [number, number] = [0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!), a! / 255];
  colorCache.set(value, result);
  return result;
}

// Luminance of the first mostly-opaque background found under a point, ignoring the glass itself.
function backdropLuminance(x: number, y: number, skip: Element) {
  // elementsFromPoint lists every box under the point, topmost first, ancestors included, so
  // transparent overlays are passed over on the way down to whatever actually paints there.
  for (const element of document.elementsFromPoint(x, y)) {
    if (skip.contains(element) || element.closest("header, .liquid")) continue;
    const style = getComputedStyle(element);
    if (parseFloat(style.opacity) < 0.5) continue;
    const solid = readColor(style.backgroundColor);
    if (solid && solid[1] > 0.6) return solid[0];
    if (style.backgroundImage.includes("gradient")) {
      const stops = (style.backgroundImage.match(COLOR) ?? []).map(readColor).filter((stop): stop is [number, number] => Boolean(stop && stop[1] > 0.6));
      if (stops.length) return stops.reduce((sum, stop) => sum + stop[0], 0) / stops.length;
    }
  }
  return 1;
}

function useBackdropTone(node: RefObject<HTMLElement | null>, enabled: boolean) {
  const [tone, setTone] = useState<Tone>("light");
  useEffect(() => {
    const element = node.current;
    if (!enabled || !element || window.matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)").matches) return;
    let timer = 0;
    let frame = 0;
    const sample = () => {
      const box = element.getBoundingClientRect();
      const points = [0.2, 0.5, 0.8].map((at) => backdropLuminance(box.left + box.width * at, box.top + box.height / 2, element));
      setTone(points.reduce((sum, value) => sum + value, 0) / points.length < DARK_BELOW ? "dark" : "light");
    };
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(sample);
      }, SAMPLE_MS);
    };
    sample();
    const settle = window.setTimeout(sample, 600);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      cancelAnimationFrame(frame);
      mutations.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [node, enabled]);
  return tone;
}

export function LiquidSurface({ className = "", adaptive = false, children }: { className?: string; adaptive?: boolean; children: ReactNode }) {
  const node = useRef<HTMLDivElement>(null);
  const id = `lens-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const [lens, setLens] = useState<Lens | null>(null);
  const tone = useBackdropTone(node, adaptive);

  useEffect(() => {
    const element = node.current;
    if (!element || !canRefract()) return;
    let frame = 0;
    const draw = () => {
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      if (!width || !height) return;
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      setLens((current) => {
        if (current && current.width === width && current.height === height) return current;
        const url = rimMap(width, height, radius);
        return url ? { width, height, url } : current;
      });
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const filter = lens ? `url(#${id}) blur(3px) saturate(175%) brightness(1.04)` : undefined;

  return (
    <div ref={node} data-tone={tone} className={`liquid ${className}`} style={filter ? { backdropFilter: filter, WebkitBackdropFilter: filter } : undefined}>
      {lens ? (
        <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
          <filter id={id} x="0" y="0" width={lens.width} height={lens.height} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={lens.url} x="0" y="0" width={lens.width} height={lens.height} preserveAspectRatio="none" result="rim" />
            <feDisplacementMap in="SourceGraphic" in2="rim" scale={STRENGTH} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      ) : null}
      {children}
    </div>
  );
}
