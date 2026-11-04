"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWebgl } from "@/components/studio/viewport";
import { buttonClass } from "@/components/ui";
import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { money } from "@/lib/format";
import { recolor, STORY_STEPS, storyStage } from "@/lib/home/story";
import { PRESETS } from "@/lib/studio/presets";
import { quoteDesign, type StudioPricing } from "@/lib/studio/pricing";
import { COLORS, type ColorKey } from "@/lib/studio/spec";
import { useNear } from "./use-near";

const Scene = dynamic(() => import("@/components/studio/scene"), { ssr: false });

type Content = typeof DEFAULT_HOME.story;
type Props = { content: Content; pricing: StudioPricing; leathers: ColorKey[]; productName: string | null; intro: ReactNode; endBody: ReactNode };

const FINAL = STORY_STEPS.length;
const BAND = "-50% 0px -49% 0px";
const DIP_OUT_MS = 160;
const SETTLE_MS = 240;

function Progress({ stage, finished, dark = false }: { stage: number; finished: boolean; dark?: boolean }) {
  const on = dark ? "bg-invert-bg" : "bg-[#f4efe6]";
  const off = dark ? "bg-invert-bg/20" : "bg-[#f4efe6]/25";
  return (
    <ol className="flex gap-1.5">
      {STORY_STEPS.map((step, index) => (
        <li key={step} className={`h-[3px] w-5 rounded-full transition-colors duration-500 md:w-7 ${index <= stage || finished ? on : off}`} />
      ))}
    </ol>
  );
}

function PriceChip({ cents }: { cents: number }) {
  return <p className="glass-panel rounded-full px-3.5 py-1.5 text-[13px] tabular-nums text-fg">{money(cents)}</p>;
}

function useActiveStep(items: React.RefObject<(HTMLElement | null)[]>) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const nodes = items.current.filter((node): node is HTMLElement => Boolean(node));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
      },
      { rootMargin: BAND },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);
  return active;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function useDip<T>(value: T, smooth: boolean) {
  const [shown, setShown] = useState(value);
  const [swaps, setSwaps] = useState(0);
  const [calm, setCalm] = useState(0);
  if (!smooth && shown !== value) setShown(value);

  useEffect(() => {
    if (!smooth || shown === value) return;
    const timer = window.setTimeout(() => {
      setShown(value);
      setSwaps((count) => count + 1);
    }, DIP_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [value, shown, smooth]);

  useEffect(() => {
    if (!swaps) return;
    const timer = window.setTimeout(() => setCalm(swaps), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [swaps]);

  return { shown, dim: smooth && (shown !== value || calm !== swaps), fresh: swaps === 0 };
}

export function Story({ content, pricing, leathers, productName, intro, endBody }: Props) {
  const section = useRef<HTMLElement>(null);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const { near, visible, session } = useNear(section, "60% 0px");
  const { available, lost } = useWebgl();
  const [readySession, setReadySession] = useState(-1);
  const [shownOnce, setShownOnce] = useState(false);
  const ready = near && readySession === session;
  const reduced = useReducedMotion();
  const [color, setColor] = useState<ColorKey | null>(null);
  const active = useActiveStep(steps);
  const target = useMemo(() => recolor(PRESETS[content.preset], color), [content.preset, color]);
  const stage = Math.min(active, FINAL - 1);
  const stages = useMemo(() => STORY_STEPS.map((_, index) => storyStage(target, index)), [target]);
  const spec = stages[stage]!;
  const { shown, dim, fresh } = useDip(spec, ready && !reduced);
  const stagePrice = quoteDesign(spec, pricing).totalCents;
  const finalPrice = quoteDesign(target, pricing).totalCents;
  const finished = active >= FINAL;
  const studioHref = `/studio?from=${content.slug}${color ? `&color=${color}` : ""}`;
  const poster = `/images/studio/${content.preset}.webp`;

  return (
    <section ref={section} id="story" aria-labelledby="story-heading" className="relative mt-16 bg-[linear-gradient(180deg,#0f211d_0%,#1b3730_30%,#20403a_70%,#0f211d_100%)] text-[#f4efe6] md:mt-24">
      <header className="px-page mx-auto max-w-3xl pb-6 pt-16 text-center md:pb-4 md:pt-28 short:pt-14">
        <p className="text-[12px] uppercase tracking-[0.22em] text-[#cfe0d6]">{content.eyebrow}</p>
        <h2 id="story-heading" className="mt-3 font-display text-[clamp(2.4rem,11vw,5.5rem)] leading-[0.95] short:text-5xl">{content.heading}</h2>
        <p className="mx-auto mt-4 max-w-[46ch] text-[15px] text-[#f4efe6]/75 [&_a]:underline [&_a]:underline-offset-4">{intro}</p>
      </header>

      <div className="relative md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] short:grid short:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="sticky top-0 z-0 h-svh md:order-2 md:min-h-[560px] short:order-2 short:min-h-0">
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-[4.5rem] transition-opacity duration-300 md:bottom-16 md:top-20 short:bottom-12 short:top-16 phone:bottom-[calc(13rem+var(--cookie-lift,0px))] ${available === false || !shownOnce ? "opacity-100" : "opacity-0"}`}>
            <Image src={poster} alt="" fill sizes="(min-width: 768px) 58vw, 100vw" className="object-contain p-6 md:p-16" />
          </div>
          {available && near ? (
            <div className={`absolute inset-x-0 top-[4.5rem] touch-pan-y transition-[opacity,scale] md:bottom-16 md:top-20 short:bottom-12 short:top-16 phone:bottom-[calc(13rem+var(--cookie-lift,0px))] ${!ready ? "opacity-0 duration-300" : dim ? "scale-[0.95] opacity-60 duration-150 ease-in" : `scale-100 opacity-100 duration-500 ease-out ${fresh ? "delay-300" : ""}`}`}>
              <Scene
                spec={shown}
                upcoming={stages}
                spin
                lite
                paused={!visible}
                onReady={() => {
                  setReadySession(session);
                  setShownOnce(true);
                }}
                onContextLost={lost}
              />
            </div>
          ) : null}

          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-6 hidden items-center justify-between gap-3 px-10 md:flex short:bottom-3 short:flex short:px-4">
            <Progress stage={stage} finished={finished} />
            <PriceChip cents={finished ? finalPrice : stagePrice} />
          </div>

          <div aria-hidden className={`glass-panel absolute inset-x-3 bottom-[calc(max(12px,env(safe-area-inset-bottom))+var(--cookie-lift,0px))] hidden rounded-[26px] p-5 text-fg transition-[opacity,translate] duration-500 phone:block ${finished ? "pointer-events-none translate-y-6 opacity-0" : "opacity-100"}`}>
            <div className="flex items-center justify-between gap-3">
              <Progress stage={stage} finished={finished} dark />
              <p className="text-[13px] tabular-nums">{money(stagePrice)}</p>
            </div>
            <div key={stage} className="story-caption mt-3">
              <p className="font-display text-[1.75rem] leading-none">{content.steps[STORY_STEPS[stage]!].title}</p>
              <p className="mt-2 text-[15px] leading-relaxed">{content.steps[STORY_STEPS[stage]!].body}</p>
            </div>
          </div>
        </div>

        <ol className="relative z-10 md:order-1 short:order-1 phone:-mt-[100svh]">
          {STORY_STEPS.map((step, index) => (
            <li
              key={step}
              ref={(node) => {
                steps.current[index] = node;
              }}
              data-step={index}
              className="px-page flex md:min-h-svh md:items-center md:!pl-[max(3rem,6vw)] md:!pr-6 short:min-h-svh short:items-center phone:h-[55svh]"
            >
              <div className={`max-w-md transition-opacity duration-500 phone:sr-only ${index === active ? "opacity-100" : "opacity-35"}`}>
                <p className="text-[12px] tabular-nums tracking-[0.18em] text-[#cfe0d6]">{String(index + 1).padStart(2, "0")} / {String(FINAL).padStart(2, "0")}</p>
                <h3 className="mt-2 font-display text-5xl leading-none short:text-3xl">{content.steps[step].title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#f4efe6]/80 short:text-[15px]">{content.steps[step].body}</p>
              </div>
            </li>
          ))}
          <li
            ref={(node) => {
              steps.current[FINAL] = node;
            }}
            data-step={FINAL}
            className="px-page flex pb-[max(12px,env(safe-area-inset-bottom))] md:min-h-svh md:items-center md:!pl-[max(3rem,6vw)] md:!pr-6 md:pb-0 short:min-h-svh short:items-center short:pb-3 phone:!px-3 phone:pt-[42svh]"
          >
            <div className="glass-panel w-full max-w-md rounded-[28px] p-5 text-fg md:p-7 short:p-4">
              <h3 className="font-display text-4xl leading-none md:text-5xl short:text-3xl">{content.endHeading}</h3>
              {productName ? <p className="mt-2 text-sm text-muted">{productName}</p> : null}
              <p className="mt-3 text-[15px] leading-relaxed [&_a]:underline [&_a]:underline-offset-4 short:hidden">{endBody}</p>
              <div role="group" aria-label="Try a leather colour" className="-ml-1.5 mt-3 flex flex-wrap items-center">
                {leathers.map((key) => (
                  <button key={key} type="button" aria-pressed={color === key} aria-label={COLORS[key].name} title={COLORS[key].name} onClick={() => setColor(color === key ? null : key)} className="grid h-11 w-11 place-items-center">
                    <span style={{ backgroundColor: COLORS[key].hex }} className={`block h-7 w-7 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35)] transition-transform ${color === key ? "scale-110 outline-2 outline-offset-2 outline-invert-bg" : "hover:scale-110"}`} />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm">
                <span className="text-muted">Studio price </span>
                <span aria-live="polite" className="tabular-nums">{money(finalPrice)}</span>
                {color ? <span className="text-muted"> in {COLORS[color].name}</span> : null}
              </p>
              <div className="mt-4 grid gap-2 min-[400px]:grid-cols-2">
                <Link href={studioHref} className={buttonClass("solid", "w-full px-5")}>{content.ctaLabel}</Link>
                <Link href={`/product/${content.slug}`} className={buttonClass("outline", "w-full px-5")}>{content.productLabel}</Link>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
