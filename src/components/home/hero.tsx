"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Intro } from "@/components/home/intro";
import { useWebgl } from "@/components/studio/viewport";
import { buttonClass } from "@/components/ui";
import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { money } from "@/lib/format";
import { PRESETS } from "@/lib/studio/presets";
import { quoteDesign, type StudioPricing } from "@/lib/studio/pricing";
import { COLORS, type ColorKey, type DesignSpec } from "@/lib/studio/spec";

const loadScene = () => import("@/components/studio/scene");
if (typeof window !== "undefined") void loadScene();
const Scene = dynamic(loadScene, { ssr: false });

function dress(spec: DesignSpec, color: ColorKey): DesignSpec {
  const { primary, gusset } = spec.panels;
  return { ...spec, panels: { ...spec.panels, primary: { ...primary, color }, gusset: { ...gusset, color } } };
}

const HERO_FILES = [
  { href: "/hdri/hero-env.hdr", as: "fetch" },
  { href: "/textures/pebble-normal-640.webp", as: "image" },
  { href: "/textures/pebble-detail-640.webp", as: "image" },
];

export function Hero({ content, pricing }: { content: typeof DEFAULT_HOME.hero; pricing: StudioPricing }) {
  const [form, setForm] = useState(content.forms[0]!);
  const [color, setColor] = useState<ColorKey>(content.leathers[0]!);
  const [ready, setReady] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const section = useRef<HTMLElement>(null);
  const { available, lost } = useWebgl();
  const spec = useMemo(() => dress(PRESETS[form.key], color), [form, color]);
  const price = quoteDesign(spec, pricing).totalCents;

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={section} data-hero className="relative h-svh min-h-[520px] overflow-hidden bg-[radial-gradient(90%_80%_at_50%_42%,#3b5a50_0%,#20403a_44%,#0f211d_100%)] md:h-dvh md:min-h-[640px] short:h-svh short:min-h-[320px]">
      <Intro ready={ready || available === false} />
      {HERO_FILES.map((file) => (
        <link key={file.href} rel="preload" href={file.href} as={file.as} crossOrigin="anonymous" />
      ))}
      <h1 aria-label={`${content.lineOne} ${content.lineTwo}`.replace(/[.!]+$/, "")} className="pointer-events-none font-display text-[#f4efe6]">
        <span aria-hidden="true" className="absolute left-4 top-[calc(5rem+env(safe-area-inset-top))] block text-[min(23vw,13svh)] leading-[1.05] md:left-8 md:top-16 md:text-[13.5vw] short:left-[max(1.5rem,env(safe-area-inset-left))] short:top-[4.5rem] short:text-[22svh]">{content.lineOne}</span>
        <span aria-hidden="true" className="absolute bottom-[calc(11.75rem+env(safe-area-inset-bottom)+var(--cookie-lift,0px))] right-4 block pb-2 text-[min(23vw,13svh)] italic leading-[1.1] md:bottom-[calc(6rem+var(--cookie-lift,0px))] md:right-8 md:text-[13.5vw] short:bottom-auto short:left-[max(4.5rem,calc(env(safe-area-inset-left)+3rem))] short:right-auto short:top-[calc(4.5rem+22svh)] short:pb-0 short:text-[22svh]">{content.lineTwo}</span>
      </h1>

      <div className="absolute inset-x-0 bottom-[calc(25%+var(--cookie-lift,0px))] top-[10%] md:bottom-[calc(10%+var(--cookie-lift,0px))] md:top-[8%] short:bottom-16 short:left-[38%] short:top-14">
        {available === false ? (
          <Image src={content.fallbackImage} alt={content.fallbackAlt} fill sizes="(min-width: 768px) 70vw, 100vw" unoptimized={content.fallbackImage.startsWith("/api/")} className="object-contain" />
        ) : null}
        {available ? (
          <div className={`absolute inset-0 touch-pan-y transition duration-300 ease-out ${ready ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
            <Scene spec={spec} spin lite paused={offscreen} onReady={() => setReady(true)} onContextLost={lost} />
          </div>
        ) : null}
      </div>

      <div className="glass-panel absolute bottom-[calc(max(12px,env(safe-area-inset-bottom))+var(--cookie-lift,0px))] left-[max(12px,env(safe-area-inset-left))] right-[max(12px,env(safe-area-inset-right))] grid gap-1 rounded-[28px] p-2 md:bottom-[calc(24px+var(--cookie-lift,0px))] md:left-1/2 md:right-auto md:flex md:-translate-x-1/2 md:flex-nowrap md:items-center md:justify-center md:gap-3 md:rounded-full md:pl-4 short:bottom-[calc(8px+var(--cookie-lift,0px))] short:flex short:flex-nowrap short:items-center short:justify-between short:gap-1 short:rounded-full short:py-1.5">
        <div role="group" aria-label="Choose a form" className="flex items-center justify-between md:justify-start">
          {content.forms.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={form.key === item.key}
              onClick={() => setForm(item)}
              className="h-11 whitespace-nowrap rounded-full px-2 text-[13px] min-[375px]:px-3 transition-colors hover:bg-white/50 aria-pressed:bg-white/80 md:h-10 aria-pressed:shadow-[inset_0_1px_0_white,0_2px_6px_rgb(23_49_42/0.12)]"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Choose a leather" className="flex items-center justify-between md:justify-start">
          {content.leathers.map((key) => (
            <button key={key} type="button" aria-pressed={color === key} aria-label={COLORS[key].name} title={COLORS[key].name} onClick={() => setColor(key)} className="grid h-11 w-12 place-items-center md:h-10 md:w-9 short:h-10 short:w-8">
              <span
                style={{ backgroundColor: COLORS[key].hex }}
                className={`block h-6 w-6 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35)] transition-transform ${color === key ? "scale-110 outline-2 outline-offset-2 outline-invert-bg" : "hover:scale-110"}`}
              />
            </button>
          ))}
        </div>
        <p aria-live="polite" className="hidden whitespace-nowrap px-2 text-sm tabular-nums md:block short:block">{money(price)}</p>
        <Link href={`/studio?from=${form.slug}&color=${color}`} className={buttonClass("solid", "h-11! justify-between! gap-4 px-5 md:h-10! md:justify-center! md:px-7 short:h-10! short:px-4 short:md:px-7")}>
          {content.ctaLabel}
          <span aria-hidden className="tabular-nums md:hidden short:hidden">{money(price)}</span>
        </Link>
      </div>
    </section>
  );
}
