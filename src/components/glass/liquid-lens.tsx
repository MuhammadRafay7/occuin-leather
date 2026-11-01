"use client";

import { MagnifyingGlassPlus } from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useMediaQuery } from "./hooks";
import { INSTANT, TRACK_SPRING, critical } from "./motion";

export type ZoomImage = { src: string; alt: string; width: number; height: number };

const DIAMETER = 208;
const RADIUS = DIAMETER / 2;
const ZOOM = 2.75;
const NAV_CLEARANCE = 84;
const EDGE_OVERHANG = 0.4;
const RIM_START = 0.72;
const REFRACTION = 44;

type Geometry = { width: number; height: number; offsetX: number; offsetY: number; preview?: string };

function coverGeometry(frameWidth: number, frameHeight: number, image: ZoomImage): Geometry {
  const scale = Math.max(frameWidth / image.width, frameHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, offsetX: (frameWidth - width) / 2, offsetY: (frameHeight - height) / 2 };
}

function refractionMap() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const pixels = context.createImageData(size, size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const nx = (column + 0.5) / (size / 2) - 1;
      const ny = (row + 0.5) / (size / 2) - 1;
      const distance = Math.min(Math.hypot(nx, ny), 1);
      const depth = Math.max((distance - RIM_START) / (1 - RIM_START), 0);
      const bend = depth * depth * depth;
      const angle = Math.atan2(ny, nx);
      const at = (row * size + column) * 4;
      pixels.data[at] = 127.5 - Math.cos(angle) * bend * 127.5;
      pixels.data[at + 1] = 127.5 - Math.sin(angle) * bend * 127.5;
      pixels.data[at + 2] = 128;
      pixels.data[at + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

const CHANNELS = [
  { scale: REFRACTION, matrix: "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" },
  { scale: REFRACTION + 5, matrix: "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" },
  { scale: REFRACTION + 10, matrix: "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" },
];

function RefractionFilter({ id }: { id: string }) {
  const [map, setMap] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (live) setMap(refractionMap());
    });
    return () => {
      live = false;
    };
  }, []);
  if (!map) return null;
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <filter id={id} x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={map} x="0" y="0" width={DIAMETER} height={DIAMETER} preserveAspectRatio="none" result="map" />
        {CHANNELS.map((channel, index) => (
          <Fragment key={channel.scale}>
            <feDisplacementMap in="SourceGraphic" in2="map" scale={channel.scale} xChannelSelector="R" yChannelSelector="G" result={`bent${index}`} />
            <feColorMatrix in={`bent${index}`} type="matrix" values={channel.matrix} result={`tone${index}`} />
          </Fragment>
        ))}
        <feBlend in="tone0" in2="tone1" mode="screen" result="warm" />
        <feBlend in="warm" in2="tone2" mode="screen" />
      </filter>
    </svg>
  );
}

const GLASS_EDGE: CSSProperties = {
  boxShadow: [
    "inset 0 0 0 1.5px rgb(255 255 255 / 0.85)",
    "inset 0 3px 4px rgb(255 255 255 / 0.95)",
    "inset 0 -4px 8px rgb(255 255 255 / 0.3)",
    "inset 0 0 14px rgb(255 255 255 / 0.22)",
    "inset 0 0 3px rgb(23 49 42 / 0.3)",
  ].join(", "),
};

const SPECULAR: CSSProperties = {
  background:
    "conic-gradient(from 285deg, rgb(255 255 255 / 0.95), transparent 80deg, transparent 165deg, rgb(255 255 255 / 0.4) 200deg, transparent 240deg, transparent 320deg, rgb(255 255 255 / 0.95) 360deg)",
  mask: "radial-gradient(closest-side, transparent 84%, black 94%, black 98%, transparent 100%)",
};

type Props = { image: ZoomImage; priority: boolean; ratio: number; sizes: string; onOpen: () => void };

export function LensFrame({ image, priority, ratio, sizes, onOpen }: Props) {
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useMediaQuery("(prefers-reduced-transparency: reduce)");
  const filterId = `lens${useId().replace(/\W/g, "")}`;
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const [armed, setArmed] = useState(false);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const shape = useRef<Geometry | null>(null);

  const rawFocusX = useMotionValue(0);
  const rawFocusY = useMotionValue(0);
  const rawLensX = useMotionValue(0);
  const rawLensY = useMotionValue(0);
  const smoothFocusX = useSpring(rawFocusX, TRACK_SPRING);
  const smoothFocusY = useSpring(rawFocusY, TRACK_SPRING);
  const smoothLensX = useSpring(rawLensX, TRACK_SPRING);
  const smoothLensY = useSpring(rawLensY, TRACK_SPRING);
  const lensX = reduceMotion ? rawLensX : smoothLensX;
  const lensY = reduceMotion ? rawLensY : smoothLensY;
  const focusX = reduceMotion ? rawFocusX : smoothFocusX;
  const focusY = reduceMotion ? rawFocusY : smoothFocusY;
  const zoomX = useTransform(focusX, (value) => RADIUS - (value - (shape.current?.offsetX ?? 0)) * ZOOM);
  const zoomY = useTransform(focusY, (value) => RADIUS - (value - (shape.current?.offsetY ?? 0)) * ZOOM);
  const left = useTransform(lensX, (value) => value - RADIUS);
  const top = useTransform(lensY, (value) => value - RADIUS);

  function place(clientX: number, clientY: number, jump: boolean) {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return false;
    const x = clientX - box.left;
    const y = clientY - box.top;
    if (x < 0 || y < 0 || x > box.width || y > box.height) return false;
    const overhang = RADIUS * EDGE_OVERHANG;
    const minY = Math.max(overhang, NAV_CLEARANCE + RADIUS - box.top);
    const lensTargetX = Math.min(Math.max(x, overhang), box.width - overhang);
    const lensTargetY = Math.min(Math.max(y, minY), Math.max(box.height - overhang, minY));
    if (jump) {
      smoothFocusX.jump(x);
      smoothFocusY.jump(y);
      smoothLensX.jump(lensTargetX);
      smoothLensY.jump(lensTargetY);
    }
    rawFocusX.set(x);
    rawFocusY.set(y);
    rawLensX.set(lensTargetX);
    rawLensY.set(lensTargetY);
    return true;
  }

  function enter(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const shown = frame.current?.querySelector("img")?.currentSrc;
    const next = { ...coverGeometry(box.width, box.height, image), preview: shown ? `url("${shown}")` : undefined };
    shape.current = next;
    setGeometry(next);
    setArmed(true);
    setActive(true);
    pointer.current = { x: event.clientX, y: event.clientY };
    place(event.clientX, event.clientY, true);
  }

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    if (!active) {
      enter(event);
      return;
    }
    pointer.current = { x: event.clientX, y: event.clientY };
    place(event.clientX, event.clientY, false);
  }

  useEffect(() => {
    if (!active) return;
    const follow = () => {
      if (!place(pointer.current.x, pointer.current.y, false)) setActive(false);
    };
    window.addEventListener("scroll", follow, { passive: true });
    return () => window.removeEventListener("scroll", follow);
  });

  const visibility = reduceMotion ? INSTANT : critical(460);

  return (
    <div
      ref={frame}
      data-lens-frame
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={() => setActive(false)}
      style={{ "--ratio": ratio } as CSSProperties}
      className="relative aspect-square w-full shrink-0 snap-start bg-surface lg:h-[min(calc(100dvh-108px),720px)] lg:w-auto lg:[aspect-ratio:var(--ratio)]"
    >
      {armed ? <RefractionFilter id={filterId} /> : null}
      <button
        type="button"
        onClick={() => {
          setActive(false);
          onOpen();
        }}
        aria-label={`Inspect ${image.alt} up close`}
        className={`absolute inset-0 block w-full overflow-hidden focus-visible:outline-offset-[-6px] ${active ? "cursor-none" : "cursor-zoom-in"}`}
      >
        <Image src={image.src} alt={image.alt} fill sizes={sizes} preload={priority} className="object-cover" />
      </button>

      <span
        aria-hidden
        className={`glass-panel pointer-events-none absolute bottom-3 left-3 flex h-8 items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[11px] text-fg transition-opacity duration-200 ${active ? "opacity-0" : "opacity-100"}`}
      >
        <MagnifyingGlassPlus size={14} />
        <span className="lg:hidden">Tap to zoom</span>
        <span className="hidden lg:inline">Hover to inspect</span>
      </span>

      <AnimatePresence>
        {active && geometry ? (
          <motion.div
            data-lens
            aria-hidden
            initial={reduceMotion ? false : { opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0, transition: INSTANT } : { opacity: 0, scale: 0.8 }}
            transition={visibility}
            style={{ x: left, y: top, width: DIAMETER, height: DIAMETER }}
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-full shadow-[0_2px_6px_rgb(23_49_42/0.24),0_26px_60px_-14px_rgb(23_49_42/0.55)]"
          >
            <div className="absolute inset-0 overflow-hidden rounded-full bg-surface">
              <div className="absolute inset-0" style={{ filter: reduceTransparency ? undefined : `url(#${filterId})` }}>
                <motion.div style={{ x: zoomX, y: zoomY, width: geometry.width * ZOOM, height: geometry.height * ZOOM, backgroundImage: geometry.preview }} className="absolute left-0 top-0 bg-[length:100%_100%]" >
                  <Image
                    src={image.src}
                    alt=""
                    width={image.width}
                    height={image.height}
                    unoptimized
                    loading="eager"
                    decoding="sync"
                    draggable={false}
                    className="block size-full max-w-none select-none"
                  />
                </motion.div>
              </div>
            </div>
            {reduceTransparency ? (
              <div className="absolute inset-0 rounded-full border-2 border-fg" />
            ) : (
              <>
                <div className="absolute inset-0 rounded-full" style={GLASS_EDGE} />
                <div className="absolute inset-0 rounded-full" style={SPECULAR} />
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
