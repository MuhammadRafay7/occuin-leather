"use client";

import { MagnifyingGlassPlus } from "@phosphor-icons/react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useMediaQuery } from "./hooks";
import { INSTANT, TRACK_SPRING, critical } from "./motion";

export type ZoomImage = { src: string; alt: string; width: number; height: number };

const DIAMETER = 208;
const RADIUS = DIAMETER / 2;
const ZOOM = 2.1;
const NAV_CLEARANCE = 84;
const EDGE_OVERHANG = 0.4;

type Geometry = { width: number; height: number; offsetX: number; offsetY: number; preview?: string };

const isRender = (image: ZoomImage) => image.src.includes("/images/studio/");

function coverGeometry(frameWidth: number, frameHeight: number, image: ZoomImage): Geometry {
  const fit = isRender(image) ? Math.min : Math.max;
  const scale = fit(frameWidth / image.width, frameHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, offsetX: (frameWidth - width) / 2, offsetY: (frameHeight - height) / 2 };
}

const GLASS_EDGE: CSSProperties = {
  boxShadow: [
    "inset 0 0 0 0.5px rgb(255 255 255 / 0.55)",
    "inset 0 1px 1px rgb(255 255 255 / 0.7)",
    "inset 0 -1px 2px rgb(255 255 255 / 0.28)",
    "inset 0 0 22px rgb(10 24 20 / 0.16)",
    "inset 0 -14px 26px rgb(255 255 255 / 0.1)",
  ].join(", "),
};

const GLASS_RIM: CSSProperties = {
  WebkitBackdropFilter: "blur(7px) saturate(140%) brightness(1.06)",
  backdropFilter: "blur(7px) saturate(140%) brightness(1.06)",
  WebkitMaskImage: "radial-gradient(closest-side, transparent 80%, black 97%)",
  maskImage: "radial-gradient(closest-side, transparent 80%, black 97%)",
};

const SPECULAR: CSSProperties = {
  background: [
    "radial-gradient(38% 15% at 33% 13%, rgb(255 255 255 / 0.62), transparent 100%)",
    "radial-gradient(26% 8% at 66% 91%, rgb(255 255 255 / 0.26), transparent 100%)",
  ].join(", "),
};

type Props = { image: ZoomImage; priority: boolean; ratio: number; sizes: string; onOpen: () => void };

export function LensFrame({ image, priority, ratio, sizes, onOpen }: Props) {
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useMediaQuery("(prefers-reduced-transparency: reduce)");
  const frame = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
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
      className="relative aspect-square w-full shrink-0 snap-start lg:aspect-auto lg:h-full"
    >
      <button
        type="button"
        onClick={() => {
          setActive(false);
          onOpen();
        }}
        aria-label={`Inspect ${image.alt} up close`}
        className={`absolute inset-0 block w-full overflow-hidden focus-visible:outline-offset-[-6px] ${active ? "cursor-none" : "cursor-zoom-in"}`}
      >
        <Image src={image.src} alt={image.alt} fill sizes={sizes} preload={priority} className={`rounded-[32px] ${isRender(image) ? "object-contain" : "object-cover"}`} />
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
            className="pointer-events-none absolute left-0 top-0 z-10 rounded-full shadow-[0_1px_2px_rgb(10_24_20/0.18),0_18px_40px_-12px_rgb(10_24_20/0.42)]"
          >
            <div className="absolute inset-0 overflow-hidden rounded-full bg-[#254640]">
              <div className="absolute inset-0">
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
                <div className="absolute inset-0 rounded-full" style={GLASS_RIM} />
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
