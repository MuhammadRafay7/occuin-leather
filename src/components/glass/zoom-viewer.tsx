"use client";

import { CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from "@phosphor-icons/react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { useScrollLock } from "./hooks";
import type { ZoomImage } from "./liquid-lens";
import { INSTANT, SHEET_SPRING } from "./motion";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 1.5;
const PAN_STEP = 80;
const SWIPE_DISTANCE = 64;
const TAP_DISTANCE = 8;
const TAP_TIME = 260;
const DOUBLE_TAP = 300;
const BUTTON = "glass-panel grid size-12 place-items-center rounded-full text-fg transition-transform active:scale-[0.94] disabled:text-fg/40";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
type Point = { x: number; y: number };

export function ZoomViewer({ images, start, onClose }: { images: ZoomImage[]; start: number; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const scale = useMotionValue(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; scale: number; mid: Point; x: number; y: number } | null>(null);
  const press = useRef<{ start: Point; time: number } | null>(null);
  const lastTap = useRef(0);
  const target = useRef({ scale: 1, x: 0, y: 0 });
  const image = images[index]!;
  const aspectRatio = `${image.width} / ${image.height}`;
  const motionTransition = reduceMotion ? INSTANT : SHEET_SPRING;

  useScrollLock(dialog, true);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  function limits(nextScale: number) {
    const box = stage.current?.getBoundingClientRect();
    const size = photo.current;
    if (!box || !size) return { x: 0, y: 0 };
    return {
      x: Math.max((size.offsetWidth * nextScale - box.width) / 2, 0),
      y: Math.max((size.offsetHeight * nextScale - box.height) / 2, 0),
    };
  }

  function settle(nextScale: number, nextX: number, nextY: number) {
    const bound = limits(nextScale);
    target.current = { scale: nextScale, x: clamp(nextX, -bound.x, bound.x), y: clamp(nextY, -bound.y, bound.y) };
    animate(scale, target.current.scale, motionTransition);
    animate(x, target.current.x, motionTransition);
    animate(y, target.current.y, motionTransition);
    setZoomed(nextScale > 1.01);
  }

  function relative(point: Point) {
    const box = stage.current?.getBoundingClientRect();
    return box ? { x: point.x - box.left - box.width / 2, y: point.y - box.top - box.height / 2 } : { x: 0, y: 0 };
  }

  function zoomTo(nextScale: number, around: Point = { x: 0, y: 0 }) {
    const bounded = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    const { scale: from, x: fromX, y: fromY } = target.current;
    const ratio = bounded / from;
    settle(bounded, around.x - (around.x - fromX) * ratio, around.y - (around.y - fromY) * ratio);
  }

  function show(next: number) {
    if (next < 0 || next >= images.length) return;
    scale.set(1);
    x.set(0);
    y.set(0);
    target.current = { scale: 1, x: 0, y: 0 };
    setZoomed(false);
    setIndex(next);
  }

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: scale.get(),
        mid: relative({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
        x: x.get(),
        y: y.get(),
      };
      press.current = null;
    } else {
      press.current = { start: { x: event.clientX, y: event.clientY }, time: performance.now() };
    }
  }

  function moved(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point];
      const from = pinch.current;
      const nextScale = clamp((from.scale * Math.hypot(a.x - b.x, a.y - b.y)) / from.distance, MIN_SCALE, MAX_SCALE);
      const mid = relative({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      const ratio = nextScale / from.scale;
      scale.set(nextScale);
      x.set(mid.x - (from.mid.x - from.x) * ratio);
      y.set(mid.y - (from.mid.y - from.y) * ratio);
      return;
    }
    x.set(x.get() + event.clientX - previous.x);
    if (scale.get() > 1.01) y.set(y.get() + event.clientY - previous.y);
  }

  function up(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size) return;

    const began = press.current;
    press.current = null;
    if (began) {
      const dx = event.clientX - began.start.x;
      const dy = event.clientY - began.start.y;
      const tap = Math.hypot(dx, dy) < TAP_DISTANCE && performance.now() - began.time < TAP_TIME;
      if (tap) {
        const now = performance.now();
        if (now - lastTap.current < DOUBLE_TAP) {
          lastTap.current = 0;
          zoomTo(target.current.scale > 1.01 ? 1 : 2.5, relative({ x: event.clientX, y: event.clientY }));
          return;
        }
        lastTap.current = now;
      }
      if (scale.get() <= 1.01 && Math.abs(dx) > SWIPE_DISTANCE) {
        const next = index + (dx < 0 ? 1 : -1);
        if (next >= 0 && next < images.length) {
          show(next);
          return;
        }
      }
    }
    settle(scale.get(), x.get(), y.get());
  }

  function wheel(event: ReactWheelEvent<HTMLDivElement>) {
    zoomTo(target.current.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), relative({ x: event.clientX, y: event.clientY }));
  }

  function keys(event: ReactKeyboardEvent<HTMLDialogElement>) {
    const panned = (dx: number, dy: number) => settle(target.current.scale, target.current.x + dx, target.current.y + dy);
    const actions: Record<string, () => void> = {
      "+": () => zoomTo(target.current.scale * STEP),
      "=": () => zoomTo(target.current.scale * STEP),
      "-": () => zoomTo(target.current.scale / STEP),
      "0": () => zoomTo(1),
      ArrowLeft: () => (zoomed ? panned(PAN_STEP, 0) : show(index - 1)),
      ArrowRight: () => (zoomed ? panned(-PAN_STEP, 0) : show(index + 1)),
      ArrowUp: () => panned(0, PAN_STEP),
      ArrowDown: () => panned(0, -PAN_STEP),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  return (
    <dialog
      ref={dialog}
      aria-label={`${image.alt}, zoomed view`}
      onClose={onClose}
      onKeyDown={keys}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-bg p-0 text-fg"
    >
      <div
        ref={stage}
        data-zoom-stage
        onPointerDown={down}
        onPointerMove={moved}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        className={`absolute inset-0 grid touch-none select-none place-items-center overflow-hidden ${zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
      >
        <motion.div
          ref={photo}
          data-zoom-photo
          style={{ x, y, scale, aspectRatio, width: `min(100vw, calc(100dvh * ${image.width / image.height}))` }}
          className="relative"
        >
          <Image src={image.src} alt={image.alt} width={image.width} height={image.height} unoptimized loading="eager" draggable={false} className="block size-full" />
        </motion.div>
      </div>

      <button type="button" aria-label="Close zoomed view" onClick={() => dialog.current?.close()} className={`${BUTTON} absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10`}>
        <X size={20} />
      </button>

      <div className="absolute inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-10 flex items-center justify-center gap-2">
        {images.length > 1 ? (
          <>
            <button type="button" aria-label="Previous image" disabled={index === 0} onClick={() => show(index - 1)} className={BUTTON}><CaretLeft size={18} /></button>
            <button type="button" aria-label="Next image" disabled={index === images.length - 1} onClick={() => show(index + 1)} className={BUTTON}><CaretRight size={18} /></button>
          </>
        ) : null}
        <button type="button" aria-label="Zoom out" disabled={!zoomed} onClick={() => zoomTo(target.current.scale / STEP)} className={BUTTON}><MagnifyingGlassMinus size={18} /></button>
        <button type="button" aria-label="Zoom in" onClick={() => zoomTo(target.current.scale * STEP)} className={BUTTON}><MagnifyingGlassPlus size={18} /></button>
      </div>
      <p className="sr-only" aria-live="polite">Image {index + 1} of {images.length}. Use plus and minus to zoom, arrow keys to move, Escape to close.</p>
    </dialog>
  );
}
