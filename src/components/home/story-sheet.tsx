"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

type Frame = { key: string; title: string; body: string; image: string };
type Props = { frames: Frame[]; label: string; header: ReactNode; footer: ReactNode };

const ADVANCE_MS = 2800;
const SWIPE_PX = 40;
const numeral = (index: number) => String(index + 1).padStart(2, "0");

function CropMarks() {
  const mark = "absolute size-5 border-[#f4efe6]/45";
  return (
    <>
      <span aria-hidden className={`${mark} left-3 top-3 border-l border-t`} />
      <span aria-hidden className={`${mark} right-3 top-3 border-r border-t`} />
      <span aria-hidden className={`${mark} bottom-3 left-3 border-b border-l`} />
      <span aria-hidden className={`${mark} bottom-3 right-3 border-b border-r`} />
    </>
  );
}

export function StorySheet({ frames, label, header, footer }: Props) {
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const swipeFrom = useRef<number | null>(null);
  const current = frames[active]!;
  const last = frames.length - 1;

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (touched || !onScreen || active === last || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => setActive(active + 1), ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [touched, onScreen, active, last]);

  const choose = (index: number) => {
    setTouched(true);
    setActive(Math.min(Math.max(index, 0), last));
  };

  const swipeStart = (event: PointerEvent) => {
    swipeFrom.current = event.pointerType === "mouse" ? null : event.clientX;
  };

  const swipeEnd = (event: PointerEvent) => {
    if (swipeFrom.current === null) return;
    const travel = event.clientX - swipeFrom.current;
    swipeFrom.current = null;
    if (Math.abs(travel) >= SWIPE_PX) choose(active + (travel < 0 ? 1 : -1));
  };

  return (
    <div className="grid gap-8 md:grid-cols-12 md:gap-x-10 lg:gap-x-16">
      <div className="md:col-span-5 md:flex md:flex-col md:justify-between md:gap-10">
        {header}

        <div id="story-note" aria-live={touched ? "polite" : "off"} className="hidden md:block">
          <div key={active} className="spec-note">
            <p aria-hidden className="font-display text-[clamp(5rem,9vw,8rem)] italic leading-[0.8] text-[#d4a85a]">{numeral(active)}</p>
            <h3 className="mt-4 font-display text-3xl leading-none">{current.title}</h3>
            <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-[#f4efe6]/70">{current.body}</p>
          </div>
        </div>

        <div className="hidden md:block">{footer}</div>
      </div>

      <div className="md:col-span-7">
        <div
          ref={stage}
          onPointerDown={swipeStart}
          onPointerUp={swipeEnd}
          onPointerCancel={() => (swipeFrom.current = null)}
          className="relative aspect-square touch-pan-y select-none overflow-hidden rounded-[6px] bg-[radial-gradient(closest-side_at_50%_55%,#2f5248_0%,rgb(27_55_48/0.6)_60%,transparent_100%)]"
        >
          <CropMarks />
          <p className="absolute left-6 top-5 z-10 text-[11px] uppercase tabular-nums tracking-[0.22em] text-[#f4efe6]/60">
            Frame {numeral(active)} <span className="text-[#f4efe6]/30">/ {numeral(last)}</span>
          </p>
          <p className="absolute right-6 top-5 z-10 text-[11px] uppercase tracking-[0.22em] text-[#f4efe6]/60">{label}</p>
          {frames.map((frame, index) => (
            <Image
              key={frame.key}
              src={frame.image}
              alt={index === active ? `${label}, ${frame.title.toLowerCase()}` : ""}
              fill
              draggable={false}
              sizes="(min-width: 768px) 55vw, 100vw"
              className={`object-contain p-6 transition-opacity duration-500 ease-out md:p-10 ${index === active ? "opacity-100" : "opacity-0"}`}
            />
          ))}
        </div>

        <ol aria-label="Steps" className="mt-3 grid grid-cols-6 gap-2 md:mt-4 md:gap-3">
          {frames.map((frame, index) => (
            <li key={frame.key}>
              <button
                type="button"
                aria-pressed={index === active}
                aria-controls="story-note story-note-phone"
                aria-label={`Step ${index + 1}: ${frame.title}`}
                onClick={() => choose(index)}
                onPointerEnter={(event) => event.pointerType === "mouse" && choose(index)}
                className="group block w-full text-left"
              >
                <span className="relative block aspect-square overflow-hidden rounded-[4px] bg-[#f4efe6]/[0.04] ring-1 ring-[#f4efe6]/10 transition-[box-shadow] duration-200 group-hover:ring-[#f4efe6]/30 group-aria-pressed:ring-[#d4a85a]">
                  <Image src={frame.image} alt="" fill sizes="(min-width: 768px) 8vw, 15vw" className="object-contain p-1 opacity-45 transition-opacity duration-300 group-hover:opacity-80 group-aria-pressed:opacity-100" />
                </span>
                <span className="mt-1.5 block font-display text-sm italic tabular-nums text-[#f4efe6]/40 transition-colors group-aria-pressed:text-[#d4a85a]">{numeral(index)}</span>
              </button>
            </li>
          ))}
        </ol>

        <div id="story-note-phone" aria-live={touched ? "polite" : "off"} className="mt-6 min-h-[8.5rem] md:hidden">
          <div key={active} className="spec-note flex gap-4">
            <p aria-hidden className="font-display text-6xl italic leading-[0.8] text-[#d4a85a]">{numeral(active)}</p>
            <div>
              <h3 className="font-display text-2xl leading-none">{current.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#f4efe6]/70">{current.body}</p>
            </div>
          </div>
        </div>

        <div className="mt-2 md:hidden">{footer}</div>
      </div>
    </div>
  );
}
