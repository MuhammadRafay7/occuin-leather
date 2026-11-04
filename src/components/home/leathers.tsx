"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { buttonClass } from "@/components/ui";
import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { decodeNormals, hexToLinear, relight, type Light, type NormalField } from "@/lib/home/relight";
import { COLORS, FINISHES, type ColorKey, type FinishKey } from "@/lib/studio/spec";
import { useNear } from "./use-near";

type Content = typeof DEFAULT_HOME.leathers;
type Props = { content: Content; body: ReactNode; studioSlug: string; startColor: ColorKey };

const FINISH_KEYS = Object.keys(FINISHES) as FinishKey[];
const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];
const ZOOM = 0.62;
const MAX_PIXELS = 440;
const IDLE_MS = 2600;

const fields = new Map<FinishKey, Promise<NormalField>>();

function loadField(finish: FinishKey) {
  const cached = fields.get(finish);
  if (cached) return cached;
  const promise = new Promise<NormalField>((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onload = () => {
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const scratch = document.createElement("canvas");
      scratch.width = scratch.height = size;
      const context = scratch.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("no 2d context"));
      context.drawImage(image, 0, 0, size, size);
      resolve(decodeNormals(context.getImageData(0, 0, size, size).data, size));
    };
    image.onerror = () => reject(new Error(`could not load ${finish}`));
    image.src = `/textures/${finish}-normal-640.webp`;
  });
  fields.set(finish, promise);
  promise.catch(() => fields.delete(finish));
  return promise;
}

function drift(time: number): Light {
  return { u: 0.5 + Math.sin(time / 2300) * 0.32, v: 0.42 + Math.cos(time / 3100) * 0.22 };
}

export function Leathers({ content, body, studioSlug, startColor }: Props) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { near, visible } = useNear(section, "50% 0px");
  const [finish, setFinish] = useState<FinishKey>("pebble");
  const [color, setColor] = useState<ColorKey>(startColor);
  const [field, setField] = useState<{ finish: FinishKey; field: NormalField } | null>(null);
  const [failed, setFailed] = useState(false);
  const light = useRef<Light>({ u: 0.62, v: 0.3 });
  const touched = useRef(0);
  const paint = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!near) return;
    let live = true;
    loadField(finish)
      .then((loaded) => {
        if (live) setField({ finish, field: loaded });
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [near, finish]);

  useEffect(() => {
    const node = canvas.current;
    if (!node || !field) return;
    const context = node.getContext("2d");
    if (!context) return;
    const size = Math.min(MAX_PIXELS, Math.round(node.clientWidth * Math.min(window.devicePixelRatio, 1.5)));
    if (node.width !== size) node.width = node.height = size;
    const image = context.createImageData(size, size);
    const base = hexToLinear(COLORS[color].hex);
    paint.current = () => {
      relight(image.data, size, field.field, ZOOM, base, field.finish, light.current);
      context.putImageData(image, 0, 0);
    };
    paint.current();
  }, [field, color]);

  useEffect(() => {
    if (!visible || !field) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let last = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - last < 33 || time - touched.current < IDLE_MS) return;
      last = time;
      light.current = drift(time);
      paint.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, field]);

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    light.current = { u: (event.clientX - box.left) / box.width, v: (event.clientY - box.top) / box.height };
    touched.current = performance.now();
    requestAnimationFrame(() => paint.current());
  };

  const look = FINISHES[finish];

  return (
    <section ref={section} aria-labelledby="leathers-heading" className="px-page mt-16 md:mt-28">
      <div className="mx-auto grid max-w-6xl items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14 short:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] short:gap-8">
        <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-[28px] bg-[#2a1a10] short:max-w-[300px]">
          <div aria-hidden style={{ backgroundColor: COLORS[color].hex }} className="absolute inset-0" />
          <canvas
            ref={canvas}
            role="img"
            aria-label={`Close-up of ${look.name.toLowerCase()} in ${COLORS[color].name}`}
            onPointerMove={move}
            onPointerDown={move}
            className={`absolute inset-0 h-full w-full touch-pan-y transition-opacity duration-500 ${field && !failed ? "opacity-100" : "opacity-0"}`}
          />
          <div className="glass-panel absolute inset-x-3 bottom-3 rounded-[20px] px-4 py-3 md:inset-x-4 md:bottom-4">
            <p className="font-display text-xl leading-tight">{look.name}</p>
            <p className="text-[13px] text-muted">{look.note}</p>
          </div>
        </div>

        <div className="grid gap-5 md:gap-6">
          <div>
            <p className="text-[12px] uppercase tracking-[0.22em] text-muted">{content.eyebrow}</p>
            <h2 id="leathers-heading" className="mt-2 font-display text-4xl leading-none md:text-6xl short:text-4xl">{content.heading}</h2>
            <p className="mt-3 max-w-[40ch] text-muted [&_a]:underline [&_a]:underline-offset-4">{body}</p>
          </div>
          <div role="group" aria-label="Leather finish" className="-mx-1 flex flex-wrap gap-1.5">
            {FINISH_KEYS.map((key) => (
              <button key={key} type="button" aria-pressed={finish === key} onClick={() => setFinish(key)} className="min-h-11 rounded-full border border-line px-4 text-[13px] transition-colors hover:border-fg aria-pressed:border-invert-bg aria-pressed:bg-invert-bg aria-pressed:text-invert-fg">
                {FINISHES[key].name}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[13px]"><span className="font-medium">Colour</span> <span className="text-muted">{COLORS[color].name}</span></p>
            <div role="group" aria-label="Leather colour" className="-mx-1.5 mt-1 grid grid-cols-6 sm:flex sm:flex-wrap">
              {COLOR_KEYS.map((key) => (
                <button key={key} type="button" aria-pressed={color === key} aria-label={COLORS[key].name} title={COLORS[key].name} onClick={() => setColor(key)} className="grid h-11 place-items-center sm:w-11">
                  <span style={{ backgroundColor: COLORS[key].hex }} className={`block h-7 w-7 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35),0_0_0_1px_rgb(0_0_0/0.08)] transition-transform ${color === key ? "scale-110 outline-2 outline-offset-2 outline-invert-bg" : "hover:scale-110"}`} />
                </button>
              ))}
            </div>
          </div>
          <Link href={`/studio?from=${studioSlug}&color=${color}`} className={buttonClass("solid", "w-full sm:w-auto sm:justify-self-start")}>
            {content.ctaLabel} {COLORS[color].name}
          </Link>
        </div>
      </div>
    </section>
  );
}
