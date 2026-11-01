"use client";

import { ArrowsOut, CheckCircle, Minus, Plus, X } from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { fullPointCount, VIEWS, type BespokePiece, type DesignView } from "@/lib/bespoke/design";
import { bodyOf, boundsOf, contains, crossesItself, fullPoints, groupBounds, holesFor, layerOrder, nearestEdge, nearOutline, outlineOf, pathData, piecePath, pieceBounds, rotation, scaling, type Vec } from "@/lib/bespoke/outline";
import type { FinishKey } from "@/lib/studio/spec";
import { Guide } from "./guide";
import { Library } from "./library";
import { PlanDefs, PlanPiece } from "./plan";
import { useCreator, useSelectedPiece, withCutouts } from "./store";
import { GLASS_PILL, ICON_BUTTON } from "./ui";

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;
const DEFAULT_SPAN = { width: 640, height: 480 };
const RULER_PX = 24;
const FIT_MARGIN_PX = 96;
const TAP_SLOP_PX = 8;
const MOUSE_HIT_PX = 11;
const TOUCH_HIT_PX = 22;
const IVORY = "#f3ecdd";
const FOIL = "#e2b963";

type View = { cx: number; cy: number; scale: number };
type Gesture =
  | { kind: "place"; start: Vec; moved: boolean }
  | { kind: "close" }
  | { kind: "point"; index: number }
  | { kind: "group"; origins: BespokePiece[]; start: Vec }
  | { kind: "scale"; origins: BespokePiece[]; anchor: Vec; corner: Vec }
  | { kind: "rotate"; origins: BespokePiece[]; center: Vec; from: number }
  | { kind: "hardware"; pieceId: string; id: string }
  | { kind: "logo"; pieceId: string }
  | { kind: "fold"; end: "a" | "b" }
  | { kind: "axis" }
  | { kind: "marquee"; start: Vec; extend: boolean }
  | { kind: "line"; start: Vec }
  | { kind: "pan"; start: Vec; view: View }
  | { kind: "pinch"; distance: number; middle: Vec; view: View };

type PieceProps = Parameters<typeof PlanPiece>[0] & { holesKey: string };

const MemoPiece = memo(
  function MemoPiece({ holesKey, ...props }: PieceProps) {
    return <PlanPiece {...props} key={holesKey} />;
  },
  (a, b) => a.piece === b.piece && a.selected === b.selected && a.hardwareId === b.hardwareId && a.holesKey === b.holesKey && a.metal === b.metal && a.grain?.gloss === b.grain?.gloss && a.grain?.shade === b.grain?.shade,
);

const GRAIN_TILES: Record<FinishKey, { file: string; mm: number; gloss: number }> = {
  box: { file: "box", mm: 300, gloss: 0.55 },
  pebble: { file: "pebble", mm: 360, gloss: 0.35 },
  saffiano: { file: "saffiano", mm: 62, gloss: 0.5 },
  croc: { file: "croc", mm: 200, gloss: 0.7 },
  suede: { file: "suede", mm: 150, gloss: 0.12 },
};

function niceStep(scale: number, minPx: number) {
  for (const step of [10, 20, 50, 100, 200, 500, 1000]) {
    if (step * scale >= minPx) return step;
  }
  return 2000;
}

function useBoardSize() {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { host, size };
}

const subscribeToNothing = () => () => undefined;

function useCoarsePointer() {
  return useSyncExternalStore(subscribeToNothing, () => window.matchMedia("(pointer: coarse)").matches, () => false);
}

function Rulers({ view, width, height }: { view: View; width: number; height: number }) {
  const major = niceStep(view.scale, 54);
  const minor = major / 5;
  const toX = (x: number) => width / 2 + (x - view.cx) * view.scale;
  const toY = (y: number) => height / 2 + (y - view.cy) * view.scale;
  const ticks = (from: number, to: number) => {
    const list: number[] = [];
    for (let value = Math.ceil(from / minor) * minor; value <= to; value += minor) list.push(Math.round(value * 10) / 10);
    return list;
  };
  const left = view.cx - width / 2 / view.scale;
  const top = view.cy - height / 2 / view.scale;
  return (
    <g aria-hidden className="pointer-events-none">
      <rect width={width} height={RULER_PX} fill="#10231d" fillOpacity="0.72" />
      <rect width={RULER_PX} height={height} fill="#10231d" fillOpacity="0.72" />
      {ticks(left, left + width / view.scale).map((value) => {
        const x = toX(value);
        if (x < RULER_PX) return null;
        const isMajor = Number.isInteger(value / major);
        return (
          <g key={value}>
            <line x1={x} x2={x} y1={RULER_PX} y2={RULER_PX - (isMajor ? 9 : 4)} stroke={IVORY} strokeOpacity={isMajor ? 0.9 : 0.5} />
            {isMajor ? <text x={x + 3} y={11} fontSize="10" fill={IVORY} className="tabular-nums">{value}</text> : null}
          </g>
        );
      })}
      {ticks(top, top + height / view.scale).map((value) => {
        const y = toY(value);
        if (y < RULER_PX) return null;
        const isMajor = Number.isInteger(value / major);
        return (
          <g key={value}>
            <line y1={y} y2={y} x1={RULER_PX} x2={RULER_PX - (isMajor ? 9 : 4)} stroke={IVORY} strokeOpacity={isMajor ? 0.9 : 0.5} />
            {isMajor ? <text transform={`translate(11 ${y - 3}) rotate(-90)`} fontSize="10" fill={IVORY} className="tabular-nums">{value}</text> : null}
          </g>
        );
      })}
      <rect width={RULER_PX} height={RULER_PX} fill="#10231d" />
      <text x={RULER_PX / 2} y={15} fontSize="9" fill={IVORY} textAnchor="middle">mm</text>
    </g>
  );
}

function ScaleBar({ scale }: { scale: number }) {
  const mm = niceStep(scale, 70);
  return (
    <div className={`${GLASS_PILL} pointer-events-none flex h-9 items-center gap-2 whitespace-nowrap px-3 text-[12px] font-medium tabular-nums`}>
      <span aria-hidden className="block h-1.5 border-x border-b border-fg" style={{ width: mm * scale }} />
      {mm} mm
    </div>
  );
}

function OpenPiece({ piece }: { piece: BespokePiece }) {
  const mirrored = piece.points.map((point) => ({ ...point, x: 2 * piece.axisX - point.x }));
  return (
    <g fill="none" stroke={FOIL} strokeWidth="1.75" strokeLinejoin="round">
      <path d={pathData(piece.points, false)} vectorEffect="non-scaling-stroke" />
      {piece.mirror ? <path d={pathData(mirrored, false)} vectorEffect="non-scaling-stroke" strokeOpacity="0.7" strokeDasharray="6 4" /> : null}
    </g>
  );
}

function Handle({ x, y, smooth, active, ghost, first, size }: { x: number; y: number; smooth: boolean; active: boolean; ghost: boolean; first: boolean; size: number }) {
  const fill = active ? FOIL : first ? "#17312a" : IVORY;
  const stroke = active ? IVORY : first ? FOIL : "#17312a";
  const opacity = ghost ? 0.55 : 1;
  if (smooth) return <circle cx={x} cy={y} r={size} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
  return <rect x={x - size + 0.5} y={y - size + 0.5} width={size * 2 - 1} height={size * 2 - 1} fill={fill} stroke={stroke} strokeWidth="1.5" opacity={opacity} />;
}

function hitHandle(piece: BespokePiece, world: Vec, tolerance: number) {
  let best: { source: number; gap: number } | null = null;
  for (const point of fullPoints(piece)) {
    const gap = Math.hypot(point.x - world.x, point.y - world.y);
    if (gap <= tolerance && (!best || gap < best.gap)) best = { source: point.source, gap };
  }
  return best?.source ?? null;
}

function pieceAt(pieces: BespokePiece[], world: Vec, tolerance: number) {
  const ordered = layerOrder(pieces).filter((piece) => piece.visible).reverse();
  return ordered.find((piece) => (piece.closed && contains(outlineOf(piece), world)) || nearOutline(piece, world, tolerance)) ?? null;
}

function hardwareAt(pieces: BespokePiece[], world: Vec, tolerance: number) {
  for (const piece of layerOrder(pieces).filter((item) => item.visible).reverse()) {
    for (const item of piece.hardware) {
      const reach = item.kind === "zip" ? Math.max(tolerance, 10) : Math.max(tolerance, 16);
      const radians = (-item.rotation * Math.PI) / 180;
      const dx = world.x - item.x;
      const dy = world.y - item.y;
      const along = dx * Math.cos(radians) - dy * Math.sin(radians);
      const across = dx * Math.sin(radians) + dy * Math.cos(radians);
      const half = item.kind === "zip" ? item.length / 2 : reach;
      if (Math.abs(along) <= half && Math.abs(across) <= reach) return { pieceId: piece.id, id: item.id };
    }
  }
  return null;
}

const CORNER_INDEX = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const ROTATE_LIFT_PX = 28;
const BOX_MARGIN_PX = 8;

export function Board() {
  const { host, size } = useBoardSize();
  const design = useCreator((state) => state.design);
  const activeView = useCreator((state) => state.activeView);
  const pieces = useMemo(() => design.pieces.filter((piece) => piece.view === activeView), [design.pieces, activeView]);
  const tool = useCreator((state) => state.tool);
  const snap = useCreator((state) => state.snap);
  const mirrorDefault = useCreator((state) => state.mirror);
  const axisX = useCreator((state) => state.axisX);
  const pointIndex = useCreator((state) => state.pointIndex);
  const hardwareId = useCreator((state) => state.hardwareId);
  const drawingId = useCreator((state) => state.drawingId);
  const others = useCreator((state) => state.others);
  const measure = useCreator((state) => state.measure);
  const leatherView = useCreator((state) => state.leatherView);
  const guideStep = useCreator((state) => state.guideStep);
  const libraryOpen = useCreator((state) => state.libraryOpen);
  const notice = useCreator((state) => state.notice);
  const selected = useSelectedPiece();
  const coarse = useCoarsePointer();
  const [view, setView] = useState<View>({ cx: 0, cy: 0, scale: 0 });
  const [hover, setHover] = useState<Vec | null>(null);
  const [marquee, setMarquee] = useState<{ a: Vec; b: Vec } | null>(null);
  const [liveLine, setLiveLine] = useState<{ a: Vec; b: Vec } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Vec>());
  const latest = useRef<Vec | null>(null);
  const shiftHeld = useRef(false);
  const frame = useRef(0);
  const viewRef = useRef(view);
  const sizeRef = useRef(size);

  useLayoutEffect(() => {
    viewRef.current = view;
    sizeRef.current = size;
  });

  const fitted = size.width > 0 && view.scale > 0;
  const startScale = size.width ? Math.min(size.width / DEFAULT_SPAN.width, size.height / DEFAULT_SPAN.height) : 0;
  if (!view.scale && startScale) setView({ cx: 0, cy: 0, scale: startScale });

  const toWorld = useCallback((screen: Vec) => {
    const { cx, cy, scale } = viewRef.current;
    const { width, height } = sizeRef.current;
    return { x: cx + (screen.x - width / 2) / scale, y: cy + (screen.y - height / 2) / scale };
  }, []);

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = svg.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const zoomAround = useCallback((screen: Vec, factor: number) => {
    setView((current) => {
      const { width, height } = sizeRef.current;
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor));
      const worldX = current.cx + (screen.x - width / 2) / current.scale;
      const worldY = current.cy + (screen.y - height / 2) / current.scale;
      return { scale, cx: worldX - (screen.x - width / 2) / scale, cy: worldY - (screen.y - height / 2) / scale };
    });
  }, []);

  const fitToPieces = () => {
    const shown = pieces.filter((piece) => piece.points.length > 1);
    if (!shown.length) {
      setView({ cx: 0, cy: 0, scale: startScale });
      return;
    }
    const box = groupBounds(shown);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((size.width - FIT_MARGIN_PX * 2) / Math.max(box.width, 1), (size.height - FIT_MARGIN_PX * 2) / Math.max(box.height, 1))));
    setView({ cx: (box.minX + box.maxX) / 2, cy: (box.minY + box.maxY) / 2, scale });
  };

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAround({ x: event.clientX - rect.left, y: event.clientY - rect.top }, Math.exp(-event.deltaY * 0.0015));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomAround, fitted]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const apply = useCallback(() => {
    frame.current = 0;
    const screen = latest.current;
    const active = gesture.current;
    const store = useCreator.getState();
    if (active?.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (active.view.scale * distance) / active.distance));
      const { width, height } = sizeRef.current;
      const worldX = active.view.cx + (active.middle.x - width / 2) / active.view.scale;
      const worldY = active.view.cy + (active.middle.y - height / 2) / active.view.scale;
      setView({ scale, cx: worldX - (middle.x - width / 2) / scale, cy: worldY - (middle.y - height / 2) / scale });
      return;
    }
    if (!screen) return;
    const world = toWorld(screen);
    if (!active) {
      if (store.tool !== "select" && store.tool !== "hand") setHover(world);
      return;
    }
    switch (active.kind) {
      case "point":
        store.dragPoint(active.index, world);
        break;
      case "group":
        store.dragGroup(active.origins, world.x - active.start.x, world.y - active.start.y);
        break;
      case "scale": {
        const spanX = active.corner.x - active.anchor.x;
        const spanY = active.corner.y - active.anchor.y;
        let sx = spanX ? Math.max(0.05, (world.x - active.anchor.x) / spanX) : 1;
        let sy = spanY ? Math.max(0.05, (world.y - active.anchor.y) / spanY) : 1;
        if (shiftHeld.current) sx = sy = Math.max(sx, sy);
        store.transformGroup(active.origins, scaling(active.anchor, sx, sy));
        break;
      }
      case "rotate": {
        const raw = Math.atan2(world.y - active.center.y, world.x - active.center.x) - active.from;
        const step = (5 * Math.PI) / 180;
        const turn = store.snap ? Math.round(raw / step) * step : raw;
        store.transformGroup(active.origins, rotation(active.center, turn), (turn * 180) / Math.PI);
        break;
      }
      case "hardware":
        store.dragHardware(active.pieceId, active.id, world);
        break;
      case "logo":
        store.dragLogo(active.pieceId, world);
        break;
      case "fold":
        store.dragFold(active.end, world);
        break;
      case "axis":
        store.setAxisX(store.snap ? Math.round(world.x / 5) * 5 : world.x);
        break;
      case "marquee":
        setMarquee({ a: active.start, b: world });
        break;
      case "line": {
        const snapped = store.snap ? { x: Math.round(world.x / 5) * 5, y: Math.round(world.y / 5) * 5 } : world;
        setLiveLine({ a: active.start, b: snapped });
        if (store.tool === "measure") store.setMeasure({ a: active.start, b: snapped });
        break;
      }
      case "pan":
        setView({
          ...active.view,
          cx: active.view.cx - (screen.x - active.start.x) / active.view.scale,
          cy: active.view.cy - (screen.y - active.start.y) / active.view.scale,
        });
        break;
      case "place":
        if (Math.hypot(screen.x - active.start.x, screen.y - active.start.y) > TAP_SLOP_PX) active.moved = true;
        setHover(world);
        break;
      default:
        break;
    }
  }, [toWorld]);

  const flush = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    apply();
  };

  const selectionPieces = () => {
    const { design: current, selectedId, others: extra } = useCreator.getState();
    return withCutouts(current.pieces, [...extra, ...(selectedId ? [selectedId] : [])]);
  };

  const transformHit = (screen: Vec) => {
    const chosen = selectionPieces();
    if (!chosen.length || useCreator.getState().tool !== "select") return null;
    const box = groupBounds(chosen);
    const { scale } = viewRef.current;
    const reach = (coarse ? TOUCH_HIT_PX : MOUSE_HIT_PX) + 2;
    const margin = BOX_MARGIN_PX / scale;
    const corners = CORNER_INDEX.map(({ x, y }) => ({ x: box.minX - margin + (box.width + margin * 2) * x, y: box.minY - margin + (box.height + margin * 2) * y }));
    const toScreen = (point: Vec) => ({ x: sizeRef.current.width / 2 + (point.x - viewRef.current.cx) * scale, y: sizeRef.current.height / 2 + (point.y - viewRef.current.cy) * scale });
    const center = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const knob = toScreen({ x: center.x, y: box.minY - margin });
    if (Math.hypot(knob.x - screen.x, knob.y - ROTATE_LIFT_PX - screen.y) <= reach) return { type: "rotate" as const, chosen, center };
    const index = corners.findIndex((corner) => {
      const at = toScreen(corner);
      return Math.hypot(at.x - screen.x, at.y - screen.y) <= reach;
    });
    if (index < 0) return null;
    const flat = CORNER_INDEX[index]!;
    return { type: "scale" as const, chosen, anchor: { x: flat.x ? box.minX : box.maxX, y: flat.y ? box.minY : box.maxY }, corner: { x: flat.x ? box.maxX : box.minX, y: flat.y ? box.maxY : box.minY } };
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    shiftHeld.current = event.shiftKey;
    const screen = local(event);
    pointers.current.set(event.pointerId, screen);
    latest.current = screen;
    const store = useCreator.getState();
    if (pointers.current.size === 2) {
      if (gesture.current && ["point", "group", "scale", "rotate", "hardware", "fold"].includes(gesture.current.kind)) store.cancelGesture();
      setMarquee(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", distance: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, middle: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, view: viewRef.current };
      return;
    }
    if (pointers.current.size > 2) return;

    const world = toWorld(screen);
    const hitPx = event.pointerType === "touch" ? TOUCH_HIT_PX : MOUSE_HIT_PX;
    const tolerance = hitPx / viewRef.current.scale;
    const piece = store.design.pieces.find((item) => item.id === store.selectedId) ?? null;
    const hit = piece ? hitHandle(piece, world, tolerance) : null;
    const axisPx = sizeRef.current.width / 2 + (store.axisX - viewRef.current.cx) * viewRef.current.scale;
    const mirrorShown = piece ? piece.mirror : store.mirror;

    if (mirrorShown && !piece?.mirror && screen.y < RULER_PX + 14 && Math.abs(screen.x - axisPx) < hitPx + 4) {
      gesture.current = { kind: "axis" };
      return;
    }
    if (store.tool === "hand") {
      gesture.current = { kind: "pan", start: screen, view: viewRef.current };
      return;
    }
    if (store.tool === "draw" || store.tool === "tube") {
      const drawing = store.design.pieces.find((item) => item.id === store.drawingId) ?? null;
      const closing = drawing?.kind === "panel" && hit === 0 && fullPointCount(drawing) >= 3;
      gesture.current = closing ? { kind: "close" } : { kind: "place", start: screen, moved: false };
      return;
    }
    if (store.tool === "measure" || store.tool === "reflect") {
      const start = store.snap ? { x: Math.round(world.x / 5) * 5, y: Math.round(world.y / 5) * 5 } : world;
      gesture.current = { kind: "line", start };
      setLiveLine(null);
      if (store.tool === "measure") store.setMeasure(null);
      return;
    }
    if (store.tool === "hardware") {
      store.beginGesture();
      store.placeHardware(world);
      const placed = useCreator.getState();
      if (placed.hardwareId && placed.selectedId) gesture.current = { kind: "hardware", pieceId: placed.selectedId, id: placed.hardwareId };
      else store.cancelGesture();
      return;
    }
    if (store.tool === "select") {
      if (piece?.fold) {
        const near = (x: number, y: number) => Math.hypot(x - world.x, y - world.y) <= tolerance;
        const end = near(piece.fold.ax, piece.fold.ay) ? "a" : near(piece.fold.bx, piece.fold.by) ? "b" : null;
        if (end) {
          store.beginGesture();
          gesture.current = { kind: "fold", end };
          return;
        }
      }
      if (hit === null) {
        const handle = transformHit(screen);
        if (handle) {
          store.beginGesture();
          gesture.current = handle.type === "rotate"
            ? { kind: "rotate", origins: handle.chosen, center: handle.center, from: Math.atan2(world.y - handle.center.y, world.x - handle.center.x) }
            : { kind: "scale", origins: handle.chosen, anchor: handle.anchor, corner: handle.corner };
          return;
        }
      }
    }
    if (hit !== null && !store.others.length) {
      store.selectPoint(hit);
      store.beginGesture();
      gesture.current = { kind: "point", index: hit };
      return;
    }
    if (store.tool === "add" && piece) {
      store.beginGesture();
      const added = store.addPointOnEdge(world, tolerance);
      if (added) {
        const index = useCreator.getState().pointIndex;
        if (index !== null) {
          gesture.current = { kind: "point", index };
          return;
        }
      }
      store.cancelGesture();
    }
    const onView = store.design.pieces.filter((item) => item.view === store.activeView);
    if (store.tool === "select") {
      const logoPiece = layerOrder(onView).filter((item) => item.visible && item.logo).reverse().find((item) => Math.abs(world.x - item.logo!.x) < item.logo!.width / 2 && Math.abs(world.y - item.logo!.y) < item.logo!.width / 2);
      if (logoPiece) {
        store.selectPiece(logoPiece.id);
        store.beginGesture();
        gesture.current = { kind: "logo", pieceId: logoPiece.id };
        return;
      }
      const fitting = hardwareAt(onView, world, tolerance);
      if (fitting) {
        store.selectHardware(fitting.pieceId, fitting.id);
        store.beginGesture();
        gesture.current = { kind: "hardware", ...fitting };
        return;
      }
    }
    const target = pieceAt(onView, world, tolerance);
    if (target) {
      const extend = event.shiftKey || store.additive;
      const current = selectionPieces().map((item) => item.id);
      if (extend) store.toggleInSelection(target.id);
      else if (!current.includes(target.id)) store.selectPiece(target.id);
      else store.selectPoint(null);
      if (store.tool === "select" && !extend) {
        const origins = selectionPieces();
        store.beginGesture();
        gesture.current = { kind: "group", origins, start: world };
      }
      return;
    }
    if (store.tool === "select") {
      const extend = event.shiftKey || store.additive;
      if (!extend) store.selectPiece(null);
      gesture.current = { kind: "marquee", start: world, extend };
      return;
    }
    store.selectPiece(null);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const screen = local(event);
    shiftHeld.current = event.shiftKey;
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, screen);
    if (event.pointerType === "touch" && !gesture.current) return;
    latest.current = screen;
    if (!frame.current) frame.current = requestAnimationFrame(apply);
  };

  const endPointer = (event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    if (!pointers.current.delete(event.pointerId)) return;
    latest.current = local(event);
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "pinch") {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    if (!cancelled) flush();
    gesture.current = null;
    const store = useCreator.getState();
    setMarquee(null);
    setLiveLine(null);
    if (cancelled) {
      store.cancelGesture();
      return;
    }
    const world = toWorld(latest.current);
    if (active.kind === "close") store.closeShape();
    else if (active.kind === "place" && !active.moved) store.placePoint(world);
    else if (active.kind === "marquee") {
      const left = Math.min(active.start.x, world.x);
      const right = Math.max(active.start.x, world.x);
      const top = Math.min(active.start.y, world.y);
      const bottom = Math.max(active.start.y, world.y);
      if (right - left > 1 || bottom - top > 1) {
        const inside = store.design.pieces
          .filter((piece) => piece.visible && piece.view === store.activeView)
          .filter((piece) => {
            const box = pieceBounds(piece);
            return box.minX < right && box.maxX > left && box.minY < bottom && box.maxY > top;
          })
          .map((piece) => piece.id);
        store.setSelection(active.extend ? [...new Set([...selectionPieces().map((piece) => piece.id), ...inside])] : inside);
      }
    } else if (active.kind === "line") {
      if (store.tool === "reflect") {
        const end = store.snap ? { x: Math.round(world.x / 5) * 5, y: Math.round(world.y / 5) * 5 } : world;
        store.reflect(active.start, end);
      }
    } else if (active.kind !== "pan" && active.kind !== "axis") store.endGesture();
    if (event.pointerType === "touch") setHover(null);
  };

  const onDoubleClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const store = useCreator.getState();
    if (store.tool === "draw") return;
    if (store.tool === "tube") {
      store.closeShape();
      return;
    }
    const piece = store.design.pieces.find((item) => item.id === store.selectedId);
    if (!piece) return;
    const hit = hitHandle(piece, toWorld(local(event)), MOUSE_HIT_PX / viewRef.current.scale);
    if (hit === null) return;
    store.selectPoint(hit);
    store.togglePointSmooth();
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const store = useCreator.getState();
    const coarseStep = event.shiftKey ? 10 : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-coarseStep, 0], ArrowRight: [coarseStep, 0], ArrowUp: [0, -coarseStep], ArrowDown: [0, coarseStep] };
    const arrow = arrows[event.key];
    if (arrow) {
      event.preventDefault();
      store.nudge(arrow[0], arrow[1]);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      store.deleteSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      store.closeShape();
    } else if (event.key === "Escape") {
      store.setTool("select");
    } else if (event.key === "]") {
      store.stepPoint(1);
    } else if (event.key === "[") {
      store.stepPoint(-1);
    } else if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey) {
      store.togglePointSmooth();
    }
  };

  const verb = coarse ? "Tap" : "Click";
  const drawing = pieces.find((piece) => piece.id === drawingId) ?? null;
  const chosenIds = useMemo(() => new Set([...others, ...(selected ? [selected.id] : [])]), [others, selected]);
  const chosen = useMemo(() => pieces.filter((piece) => chosenIds.has(piece.id)), [pieces, chosenIds]);
  const crossing = useMemo(() => (selected?.closed ? crossesItself(outlineOf(selected), true) : false), [selected]);
  const hints: Record<string, string> = {
    hand: "Drag to move around the board.",
    measure: "Drag between two points to measure.",
    reflect: chosen.length ? "Drag a line to mirror the selection across it." : "Select a piece first, then draw the mirror line.",
    hardware: `${verb} a piece to place the fitting.`,
    tube: drawing ? `${verb} to continue the path. Finish when you are done.` : `${verb} to start a handle or strap.`,
  };
  const hint = drawing && drawing.kind === "panel"
    ? drawing.points.length < 3 && !drawing.mirror
      ? `${verb} to place the next point.`
      : `${verb} the first point to close the shape.`
    : hints[tool] ?? (tool === "draw"
      ? `${verb} to place the first point of a new piece.`
      : tool === "add"
        ? selected ? `${verb} an edge to add a point.` : `${verb} a piece first.`
        : others.length
          ? `${chosen.length} pieces selected. Drag to move them together.`
          : selected
            ? pointIndex !== null ? "Drag the point, or use the tools to curve or delete it." : "Drag the piece, its points or the corner handles."
            : `${verb} a piece, or drag across the board to select several.`);

  const { width, height } = size;
  const originX = width / 2 - view.cx * view.scale;
  const originY = height / 2 - view.cy * view.scale;
  const minor = view.scale * 10 >= 6 ? 10 : view.scale * 50 >= 6 ? 50 : 100;
  const major = minor * 5;
  const mirrorOn = selected ? selected.mirror : mirrorDefault;
  const centreX = selected?.mirror ? selected.axisX : axisX;
  const ordered = useMemo(() => layerOrder(pieces.filter((piece) => piece.visible && (piece.closed || piece.kind === "tube"))), [pieces]);
  const openPieces = pieces.filter((piece) => piece.kind === "panel" && !piece.closed && piece.visible);
  const usedFinishes = [...new Set(ordered.map((piece) => piece.finish))];
  const handleSize = coarse ? 7 : 5.5;
  const screenOf = (point: Vec) => ({ x: originX + point.x * view.scale, y: originY + point.y * view.scale });
  const lastPoint = drawing?.points[drawing.points.length - 1];
  const edgePreview = tool === "add" && selected && hover ? nearestEdge(selected, hover) : null;
  const edgeInReach = edgePreview && edgePreview.distance * view.scale <= MOUSE_HIT_PX * 1.5 ? edgePreview : null;
  const box = chosen.length && chosen.every((piece) => piece.points.length) ? groupBounds(chosen) : null;
  const showBox = tool === "select" && box && !leatherView && !drawing;
  const screenBox = showBox ? { left: originX + box.minX * view.scale - BOX_MARGIN_PX, top: originY + box.minY * view.scale - BOX_MARGIN_PX, width: box.width * view.scale + BOX_MARGIN_PX * 2, height: box.height * view.scale + BOX_MARGIN_PX * 2 } : null;
  const measured = measure ?? (tool === "reflect" ? liveLine : null);
  const showGrid = !leatherView;
  const ghost = useMemo(() => {
    if (activeView === "front") return null;
    const body = bodyOf(design);
    if (!body) return null;
    const box = boundsOf(outlineOf(body));
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    const sign = activeView === "back" ? -1 : 1;
    if (activeView === "back" || activeView === "interior") return outlineOf(body).map((point, index) => `${index ? "L" : "M"}${((point.x - cx) * sign).toFixed(1)} ${(point.y - cy).toFixed(1)}`).join("") + "Z";
    const w = activeView === "base" ? box.width : design.depth;
    const h = activeView === "base" ? design.depth : box.height;
    return `M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}Z`;
  }, [activeView, design]);
  const finishDrawLabel = drawing?.kind === "tube" ? "Finish handle" : "Close shape";
  const canFinish = drawing ? (drawing.kind === "tube" ? drawing.points.length >= 2 : fullPointCount(drawing) >= 3) : false;

  return (
    <section aria-label="Pattern board" className="relative h-full min-h-0 overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#25473c,#1b3a30)] shadow-[inset_0_0_0_1px_rgb(243_236_221/0.12),inset_0_2px_24px_rgb(0_0_0/0.28),0_18px_40px_-16px_rgb(0_0_0/0.5)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url(/textures/suede-detail-640.webp)] bg-[length:320px] opacity-[0.1] mix-blend-soft-light" />
      <div ref={host} className="absolute inset-0">
        {fitted ? (
          <svg
            ref={svg}
            role="application"
            aria-label="Pattern board. Arrow keys move the selection. Hold Shift for larger steps. Square brackets step through points. C switches a point between sharp and curved. Delete removes it. Press question mark for all shortcuts."
            tabIndex={0}
            width={width}
            height={height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(event) => endPointer(event, false)}
            onPointerCancel={(event) => endPointer(event, true)}
            onPointerLeave={() => setHover(null)}
            onDoubleClick={onDoubleClick}
            onKeyDown={onKeyDown}
            data-tool={tool}
            className={`absolute inset-0 block touch-none select-none rounded-[28px] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#f3ecdd] ${tool === "select" ? "cursor-default" : tool === "hand" ? "cursor-grab" : "cursor-crosshair"}`}
          >
            <defs>
              <PlanDefs />
              <pattern id="board-minor" width={minor * view.scale} height={minor * view.scale} patternUnits="userSpaceOnUse" patternTransform={`translate(${originX} ${originY})`}>
                <path d={`M${minor * view.scale} 0H0V${minor * view.scale}`} fill="none" stroke={IVORY} strokeOpacity="0.09" />
              </pattern>
              <pattern id="board-major" width={major * view.scale} height={major * view.scale} patternUnits="userSpaceOnUse" patternTransform={`translate(${originX} ${originY})`}>
                <path d={`M${major * view.scale} 0H0V${major * view.scale}`} fill="none" stroke={IVORY} strokeOpacity="0.2" />
              </pattern>
              <filter id="grain-shade" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.3" />
              </filter>
              <filter id="grain-light" colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.9  1.6 0 0 0 -0.78" />
              </filter>
              {usedFinishes.flatMap((finish) => {
                const tile = GRAIN_TILES[finish];
                return ["shade", "light"].map((kind) => (
                  <pattern key={`${finish}-${kind}`} id={`grain-${kind}-${finish}`} width={tile.mm} height={tile.mm} patternUnits="userSpaceOnUse">
                    <image href={`/textures/${tile.file}-detail-640.webp`} width={tile.mm} height={tile.mm} preserveAspectRatio="none" filter={`url(#grain-${kind})`} />
                  </pattern>
                ));
              })}
            </defs>
            {showGrid ? <rect width={width} height={height} fill="url(#board-minor)" /> : null}
            {showGrid ? <rect width={width} height={height} fill="url(#board-major)" /> : null}
            {showGrid || mirrorOn ? <line x1={originX + centreX * view.scale} x2={originX + centreX * view.scale} y1={0} y2={height} stroke={mirrorOn ? FOIL : IVORY} strokeOpacity={mirrorOn ? 0.9 : 0.22} strokeDasharray={mirrorOn ? "8 5" : "2 6"} /> : null}
            {mirrorOn ? <text x={originX + centreX * view.scale + 7} y={RULER_PX + 16} fontSize="11" fill={FOIL}>Centre line</text> : null}
            {ghost ? <path aria-hidden transform={`translate(${originX} ${originY}) scale(${view.scale})`} d={ghost} fill={IVORY} fillOpacity="0.06" stroke={IVORY} strokeOpacity="0.55" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" /> : null}
            <g transform={`translate(${originX} ${originY}) scale(${view.scale})`} style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.42))" }}>
              {ordered.map((piece) => (
                <MemoPiece
                  key={piece.id}
                  piece={piece}
                  pieces={pieces}
                  metal={design.metal}
                  holesKey={holesFor(piece, pieces).map(piecePath).join("|")}
                  selected={chosenIds.has(piece.id)}
                  hardwareId={piece.id === selected?.id ? hardwareId : null}
                  grain={{ shade: `url(#grain-shade-${piece.finish})`, light: `url(#grain-light-${piece.finish})`, gloss: leatherView ? GRAIN_TILES[piece.finish].gloss : 0 }}
                />
              ))}
              {openPieces.map((piece) => (
                <OpenPiece key={piece.id} piece={piece} />
              ))}
              {drawing?.kind === "tube" && drawing.points.length === 1 ? <circle cx={drawing.points[0]!.x} cy={drawing.points[0]!.y} r={drawing.tubeWidth / 2} fill={FOIL} /> : null}
            </g>
            {drawing && lastPoint && hover ? (
              <g aria-hidden stroke={FOIL} strokeDasharray="4 4" strokeOpacity="0.85">
                <line x1={screenOf(lastPoint).x} y1={screenOf(lastPoint).y} x2={screenOf(hover).x} y2={screenOf(hover).y} />
              </g>
            ) : null}
            {selected && selected.visible && !others.length && !leatherView
              ? fullPoints(selected).map((point) => {
                  const at = screenOf(point);
                  return (
                    <Handle
                      key={`${point.source}-${point.flipped}`}
                      x={at.x}
                      y={at.y}
                      smooth={point.smooth}
                      ghost={point.flipped}
                      first={Boolean(drawing) && point.source === 0}
                      active={pointIndex === point.source}
                      size={drawing && point.source === 0 ? handleSize + 2 : handleSize}
                    />
                  );
                })
              : null}
            {selected?.fold && tool === "select" && !leatherView
              ? [[selected.fold.ax, selected.fold.ay], [selected.fold.bx, selected.fold.by]].map(([x, y], index) => (
                  <circle key={index} cx={screenOf({ x: x!, y: y! }).x} cy={screenOf({ x: x!, y: y! }).y} r={handleSize + 1} fill={FOIL} stroke="#17312a" strokeWidth="1.5" />
                ))
              : null}
            {screenBox ? (
              <g aria-hidden>
                <rect x={screenBox.left} y={screenBox.top} width={screenBox.width} height={screenBox.height} fill="none" stroke={FOIL} strokeOpacity="0.8" strokeDasharray="5 4" />
                <line x1={screenBox.left + screenBox.width / 2} x2={screenBox.left + screenBox.width / 2} y1={screenBox.top} y2={screenBox.top - ROTATE_LIFT_PX} stroke={FOIL} />
                <circle data-handle="rotate" cx={screenBox.left + screenBox.width / 2} cy={screenBox.top - ROTATE_LIFT_PX} r={handleSize + 2} fill={IVORY} stroke="#17312a" strokeWidth="1.5" />
                {CORNER_INDEX.map(({ x, y }, index) => (
                  <rect key={index} data-handle={`corner-${index}`} x={screenBox.left + screenBox.width * x - handleSize} y={screenBox.top + screenBox.height * y - handleSize} width={handleSize * 2} height={handleSize * 2} rx="2" fill={FOIL} stroke="#17312a" strokeWidth="1.5" />
                ))}
              </g>
            ) : null}
            {marquee ? (
              <rect aria-hidden x={Math.min(screenOf(marquee.a).x, screenOf(marquee.b).x)} y={Math.min(screenOf(marquee.a).y, screenOf(marquee.b).y)} width={Math.abs(screenOf(marquee.a).x - screenOf(marquee.b).x)} height={Math.abs(screenOf(marquee.a).y - screenOf(marquee.b).y)} fill={FOIL} fillOpacity="0.12" stroke={FOIL} strokeDasharray="5 4" />
            ) : null}
            {measured ? (
              <g aria-hidden>
                <line x1={screenOf(measured.a).x} y1={screenOf(measured.a).y} x2={screenOf(measured.b).x} y2={screenOf(measured.b).y} stroke={FOIL} strokeWidth="1.5" strokeDasharray={tool === "reflect" ? "8 5" : undefined} />
                <circle cx={screenOf(measured.a).x} cy={screenOf(measured.a).y} r="3.5" fill={FOIL} />
                <circle cx={screenOf(measured.b).x} cy={screenOf(measured.b).y} r="3.5" fill={FOIL} />
              </g>
            ) : null}
            {edgeInReach ? <circle cx={screenOf(edgeInReach.at).x} cy={screenOf(edgeInReach.at).y} r="6" fill="none" stroke={FOIL} strokeWidth="2" /> : null}
            <Rulers view={view} width={width} height={height} />
            {mirrorOn && !selected?.mirror ? <path aria-hidden d={`M${originX + centreX * view.scale - 7} 12 h14 v6 l-7 7 l-7 -7 Z`} fill={FOIL} stroke="#17312a" /> : null}
          </svg>
        ) : null}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-[8px] rounded-[21px] border-[1.5px] border-dashed border-[#f3ecdd]/25" />

      {design.pieces.length || guideStep !== null ? null : (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-8 text-center">
          <div className="grid max-w-[30ch] justify-items-center gap-4">
            <p className="font-display text-[30px] leading-[1.12] tracking-[-0.01em] text-[#f3ecdd] md:text-[36px]">Start with a shape or {coarse ? "tap" : "click"} to place your first point</p>
            <div className="pointer-events-auto grid justify-items-center gap-2">
              <p className="text-[13px] text-[#f3ecdd]/85">Or start from the parts library and examples. Everything stays editable.</p>
              <button type="button" onClick={() => useCreator.getState().setLibrary(true)} className={`${GLASS_PILL} flex min-h-11 items-center px-5 text-[13px] font-medium hover:bg-bg`}>Browse parts and examples</button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-8 top-8 flex flex-col items-start gap-2">
        <div role="tablist" aria-label="Board view" className={`${GLASS_PILL} pointer-events-auto flex max-w-full touch-pan-x overflow-x-auto p-0.5 [scrollbar-width:none]`}>
          {(Object.keys(VIEWS) as DesignView[]).map((key) => {
            const count = design.pieces.filter((piece) => piece.view === key).length;
            return (
              <button key={key} type="button" role="tab" aria-selected={activeView === key} onClick={() => useCreator.getState().setView(key)} className="flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium hover:bg-fg/10 aria-selected:bg-invert-bg aria-selected:text-invert-fg">
                {VIEWS[key]}
                {key !== "front" && count ? <span className="tabular-nums opacity-80">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <p role="status" className={`${GLASS_PILL} flex min-h-9 items-center px-3.5 py-1 text-[13px] font-medium`}>{notice ?? hint}</p>
        {crossing ? <p role="alert" className={`${GLASS_PILL} flex min-h-9 items-center px-3.5 py-1 text-[13px] font-medium text-danger`}>This outline crosses itself. Move a point to open it out.</p> : null}
        {measure ? (
          <p data-testid="measure" className={`${GLASS_PILL} pointer-events-auto flex min-h-9 items-center gap-2 px-3.5 py-1 text-[13px] font-medium tabular-nums`}>
            {Math.hypot(measure.a.x - measure.b.x, measure.a.y - measure.b.y).toFixed(1)} mm
            <span className="font-normal text-fg/75">({Math.abs(measure.a.x - measure.b.x).toFixed(0)} across, {Math.abs(measure.a.y - measure.b.y).toFixed(0)} down)</span>
            <button type="button" aria-label="Clear measurement" onClick={() => useCreator.getState().setMeasure(null)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-fg/10"><X size={12} aria-hidden /></button>
          </p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-10 bottom-6 flex items-end justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          {fitted ? <ScaleBar scale={view.scale} /> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {box && chosen.length ? (
            <p className={`${GLASS_PILL} hidden h-9 items-center whitespace-nowrap px-3.5 text-[12px] font-medium tabular-nums sm:flex`}>{others.length ? `${chosen.length} pieces` : selected?.name}: {Math.round(box.width)} × {Math.round(box.height)} mm</p>
          ) : null}
          {canFinish ? (
            <button type="button" onClick={() => useCreator.getState().closeShape()} className={`${GLASS_PILL} pointer-events-auto flex min-h-11 items-center gap-1.5 px-4 text-[13px] font-medium hover:bg-bg`}>
              <CheckCircle size={16} weight="fill" aria-hidden />
              {finishDrawLabel}
            </button>
          ) : null}
          <div role="group" aria-label="Zoom" className={`${GLASS_PILL} pointer-events-auto flex items-center p-0.5`}>
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomAround({ x: width / 2, y: height / 2 }, 0.8)} className={ICON_BUTTON}><Minus size={16} aria-hidden /></button>
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomAround({ x: width / 2, y: height / 2 }, 1.25)} className={ICON_BUTTON}><Plus size={16} aria-hidden /></button>
            <button type="button" aria-label="Fit pieces to the board" title="Fit pieces to the board" onClick={fitToPieces} className={ICON_BUTTON}><ArrowsOut size={16} aria-hidden /></button>
          </div>
        </div>
      </div>
      {libraryOpen ? <Library /> : null}
      {guideStep !== null ? <Guide step={guideStep} verb={verb} /> : null}
      <span className="sr-only" aria-live="polite">{snap ? "Snap to grid is on." : "Snap to grid is off."}</span>
    </section>
  );
}
