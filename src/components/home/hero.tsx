"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWebgl } from "@/components/studio/viewport";
import { buttonClass } from "@/components/ui";
import { money } from "@/lib/format";
import { PRESETS } from "@/lib/studio/presets";
import { quoteDesign } from "@/lib/studio/pricing";
import { COLORS, type ColorKey, type DesignSpec } from "@/lib/studio/spec";

const Scene = dynamic(() => import("@/components/studio/scene"), { ssr: false });

const FORMS = [
  { key: "tote", label: "Tote", slug: "cabas-38" },
  { key: "satchel", label: "Top handle", slug: "nocturne-28" },
  { key: "crossbody", label: "Saddle", slug: "selle-22" },
  { key: "weekender", label: "Weekender", slug: "grand-tour-50" },
] as const;
const LEATHERS: ColorKey[] = ["cognac", "noir", "bordeaux", "navy", "tan"];

function dress(spec: DesignSpec, color: ColorKey): DesignSpec {
  const { primary, gusset } = spec.panels;
  return { ...spec, panels: { ...spec.panels, primary: { ...primary, color }, gusset: { ...gusset, color } } };
}

export function Hero() {
  const [form, setForm] = useState<(typeof FORMS)[number]>(FORMS[0]);
  const [color, setColor] = useState<ColorKey>("cognac");
  const [ready, setReady] = useState(false);
  const { available, lost } = useWebgl();
  const spec = useMemo(() => dress(PRESETS[form.key], color), [form, color]);
  const price = quoteDesign(spec).totalCents;

  return (
    <section className="relative h-[100dvh] min-h-[640px] overflow-hidden bg-[radial-gradient(90%_80%_at_50%_42%,#3b5a50_0%,#20403a_44%,#0f211d_100%)]">
      <h1 aria-label="Make it yours" className="pointer-events-none font-display text-[#f4efe6]">
        <span aria-hidden="true" className="absolute left-4 top-20 block text-[23vw] leading-[1.05] md:left-8 md:top-16 md:text-[13.5vw]">Make it</span>
        <span aria-hidden="true" className="absolute bottom-44 right-4 block pb-2 text-[23vw] italic leading-[1.1] md:bottom-24 md:right-8 md:text-[13.5vw]">yours.</span>
      </h1>

      <div className="absolute inset-x-0 bottom-[10%] top-[8%]">
        <Image
          src="/images/hero/tote-cognac.webp"
          alt="A cognac leather tote"
          fill
          preload
          sizes="(min-width: 768px) 70vw, 100vw"
          className={`object-contain transition-opacity duration-500 ${ready ? "opacity-0" : "opacity-100"}`}
        />
        {available ? (
          <div className={`absolute inset-0 touch-pan-y transition-opacity duration-500 max-md:pointer-events-none ${ready ? "opacity-100" : "opacity-0"}`}>
            <Scene spec={spec} spin onReady={() => setReady(true)} onContextLost={lost} />
          </div>
        ) : null}
      </div>

      <div className="glass-panel absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[28px] p-2 md:inset-x-auto md:left-1/2 md:bottom-6 md:-translate-x-1/2 md:flex-nowrap md:rounded-full md:pl-4">
        <div role="group" aria-label="Choose a form" className="flex items-center">
          {FORMS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={form.key === item.key}
              onClick={() => setForm(item)}
              className="h-10 whitespace-nowrap rounded-full px-3 text-[13px] transition-colors hover:bg-white/50 aria-pressed:bg-white/80 aria-pressed:shadow-[inset_0_1px_0_white,0_2px_6px_rgb(23_49_42/0.12)]"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Choose a leather" className="flex items-center">
          {LEATHERS.map((key) => (
            <button key={key} type="button" aria-pressed={color === key} aria-label={COLORS[key].name} title={COLORS[key].name} onClick={() => setColor(key)} className="grid h-10 w-9 place-items-center">
              <span
                style={{ backgroundColor: COLORS[key].hex }}
                className={`block h-6 w-6 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35)] transition-transform ${color === key ? "scale-110 outline-2 outline-offset-2 outline-invert-bg" : "hover:scale-110"}`}
              />
            </button>
          ))}
        </div>
        <p aria-live="polite" className="whitespace-nowrap px-2 text-sm tabular-nums">{money(price)}</p>
        <Link href={`/studio?from=${form.slug}&color=${color}`} className={buttonClass("solid", "h-10!")}>Design yours</Link>
      </div>
    </section>
  );
}
