"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNear } from "@/components/home/use-near";
import { useTween } from "@/components/home/use-tween";
import { useWebgl } from "@/components/studio/viewport";
import type { Showcase } from "@/components/studio/scene";
import { money } from "@/lib/format";
import { grainTileUrls } from "@/lib/studio/grain-files";
import { quoteDesign, type StudioPricing } from "@/lib/studio/pricing";
import { lookHref, lookSpec, type HeroForm, type HeroLook } from "@/lib/home/hero-look";
import { COLORS, type ColorKey, type DesignSpec } from "@/lib/studio/spec";

export type { HeroForm, HeroLook };

const loadScene = () => import("@/components/studio/scene");
if (typeof window !== "undefined") void loadScene();
const Scene = dynamic(loadScene, { ssr: false });

const DIP_OUT_MS = 170;
const DIP_IN_MS = 320;

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function heroFiles(spec: DesignSpec) {
  const { primary, gusset } = spec.panels;
  const grains = [...new Set([primary.finish, gusset.finish])].flatMap((finish) => Object.values(grainTileUrls(finish, "-640")));
  return [{ href: "/hdri/hero-env.hdr", as: "fetch" }, ...grains.map((href) => ({ href, as: "image" }))];
}

type Options = { section: RefObject<HTMLElement | null>; initialForm: HeroForm; initialColor: ColorKey; initialLook: HeroLook; pricing: StudioPricing };

export function useHeroBag({ section, initialForm, initialColor, initialLook, pricing }: Options) {
  const [form, setForm] = useState(initialForm);
  const [color, setColor] = useState<ColorKey>(initialColor);
  const look = initialLook;
  const [readySession, setReadySession] = useState(-1);
  const [shownOnce, setShownOnce] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [dip, setDip] = useState<"none" | "shape" | "leather">("none");
  const { near, visible, session } = useNear(section, "50% 0px");
  const ready = near && readySession === session;
  const pending = useRef<number[]>([]);
  const webgl = useWebgl();
  const spec = useMemo(() => lookSpec(form.key, color, look), [form, color, look]);
  const firstSpec = useMemo(() => lookSpec(initialForm.key, initialColor, initialLook), [initialForm, initialColor, initialLook]);
  const price = quoteDesign(spec, pricing).totalCents;
  const shownPrice = useTween(price);
  const priceLabel = money(Math.round(shownPrice / 100) * 100);

  useEffect(() => () => pending.current.forEach((timer) => window.clearTimeout(timer)), []);

  const switchTo = (kind: "shape" | "leather", apply: () => void) => {
    pending.current.forEach((timer) => window.clearTimeout(timer));
    if (!ready || reducedMotion()) {
      apply();
      return;
    }
    setDip(kind);
    pending.current = [window.setTimeout(apply, DIP_OUT_MS), window.setTimeout(() => setDip("none"), DIP_OUT_MS + DIP_IN_MS)];
  };

  const bagState = !ready ? "scale-95 opacity-0" : dip === "shape" ? "scale-[0.96] opacity-0" : dip === "leather" ? "opacity-55" : "scale-100 opacity-100";

  return {
    form,
    color,
    look,
    setColor,
    spec,
    firstSpec,
    price,
    priceLabel,
    near,
    visible,
    ready,
    revealed,
    setRevealed,
    shownOnce,
    webgl,
    href: lookHref(form, color, look),
    pickForm: (next: HeroForm) => next.key !== form.key && switchTo("shape", () => setForm(next)),
    pickColor: (next: ColorKey) => next !== color && switchTo("leather", () => setColor(next)),
    stage: { bagState, dip, onReady: () => {
      setReadySession(session);
      setShownOnce(true);
    } },
  };
}

export type HeroBag = ReturnType<typeof useHeroBag>;

type StageProps = { bag: HeroBag; fallbackImage: string; fallbackAlt: string; showcase?: Showcase; framing?: number; sizes: string };

export function HeroStage({ bag, fallbackImage, fallbackAlt, showcase, framing, sizes }: StageProps) {
  const { available, lost } = bag.webgl;
  return (
    <>
      {available === false ? <Image src={fallbackImage} alt={fallbackAlt} fill sizes={sizes} unoptimized={fallbackImage.startsWith("/api/")} className="object-contain" /> : null}
      {available && bag.near ? (
        <div data-ready={bag.ready} className={`absolute inset-0 touch-pan-y transition-[opacity,scale] ease-out ${bag.stage.dip === "none" ? "duration-500" : "duration-150"} ${bag.stage.bagState}`}>
          <Scene spec={bag.spec} spin lite paused={!bag.visible} showcase={showcase} framing={framing} onReady={bag.stage.onReady} onContextLost={lost} />
        </div>
      ) : null}
    </>
  );
}

export function HeroPreloads({ spec }: { spec: DesignSpec }) {
  return heroFiles(spec).map((file) => <link key={file.href} rel="preload" href={file.href} as={file.as} crossOrigin="anonymous" />);
}

type FormPickerProps = { forms: HeroForm[]; value: HeroForm; onPick: (form: HeroForm) => void; className?: string; buttonClassName?: string };

export function FormPicker({ forms, value, onPick, className = "", buttonClassName = "" }: FormPickerProps) {
  return (
    <div role="group" aria-label="Choose a form" className={`flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {forms.map((item) => (
        <button key={item.key} type="button" aria-pressed={value.key === item.key} onClick={() => onPick(item)} className={`shrink-0 whitespace-nowrap rounded-full transition-colors ${buttonClassName}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

type LeatherPickerProps = { leathers: ColorKey[]; value: ColorKey; onPick: (color: ColorKey) => void; className?: string; buttonClassName?: string };

export function LeatherPicker({ leathers, value, onPick, className = "", buttonClassName = "" }: LeatherPickerProps) {
  return (
    <div role="group" aria-label="Choose a leather" className={`flex items-center ${className}`}>
      {leathers.map((key) => (
        <button key={key} type="button" aria-pressed={value === key} aria-label={COLORS[key].name} title={COLORS[key].name} onClick={() => onPick(key)} className={`grid shrink-0 place-items-center ${buttonClassName}`}>
          <span
            style={{ backgroundColor: COLORS[key].hex }}
            className={`block size-6 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35)] transition-transform duration-300 ${value === key ? "scale-110 outline-2 outline-offset-2 outline-invert-bg" : "hover:scale-110"}`}
          />
        </button>
      ))}
    </div>
  );
}
