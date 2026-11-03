"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { Intro } from "@/components/home/intro";
import { FormPicker, HeroPreloads, HeroStage, LeatherPicker, useHeroBag, type HeroForm, type HeroLook } from "@/components/home/hero-shared";
import { buttonClass } from "@/components/ui";
import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { money } from "@/lib/format";
import { PRESETS } from "@/lib/studio/presets";
import type { StudioPricing } from "@/lib/studio/pricing";
import { COLORS, FINISHES, type ColorKey } from "@/lib/studio/spec";

const STATEMENT: HeroLook = { finish: "saffiano", thread: "honey", metal: "gold", initials: "OC" };
const LEATHERS: ColorKey[] = ["noir", "espresso", "bordeaux", "navy", "cognac"];

type Props = { content: typeof DEFAULT_HOME.hero; pricing: StudioPricing; makingTime: string };

export function Hero({ content, pricing, makingTime }: Props) {
  const forms = content.forms as HeroForm[];
  const section = useRef<HTMLElement>(null);
  const bag = useHeroBag({ section, initialForm: forms.find((form) => form.key === "crossbody") ?? forms[0]!, initialColor: LEATHERS[0]!, initialLook: STATEMENT, pricing });
  const { primary } = bag.spec.panels;
  const caption = `${PRESETS[bag.form.key].name}, ${COLORS[primary.color].name} ${FINISHES[primary.finish].name.toLowerCase()}`;

  return (
    <section
      ref={section}
      data-hero
      data-revealed={bag.revealed}
      className="hero relative h-svh min-h-[540px] overflow-hidden bg-[radial-gradient(70%_60%_at_72%_46%,#3f6155_0%,#20403a_46%,#0c1c18_100%)] text-[#f4efe6] md:min-h-[640px] short:min-h-[360px]"
    >
      <Intro ready={bag.shownOnce || bag.webgl.available === false} onDone={() => bag.setRevealed(true)} />
      <HeroPreloads spec={bag.firstSpec} />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_34%_at_72%_58%,rgb(255_214_168/0.10),transparent_70%)]" />

      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))] md:gap-6 md:px-8 md:pb-8 md:pt-24 lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10 lg:px-12 lg:pb-10 short:grid short:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] short:items-center short:gap-5 short:px-[max(1.5rem,env(safe-area-inset-left))] short:pb-3 short:pt-[4.25rem]">
        <div className="flex min-h-0 flex-1 flex-col gap-2 lg:order-2 lg:h-full lg:gap-4 lg:py-6 short:order-2 short:h-full short:gap-2">
          <div className="relative min-h-0 flex-1">
            <HeroStage bag={bag} fallbackImage={content.fallbackImage} fallbackAlt={content.fallbackAlt} showcase="plinth" framing={1.3} sizes="(min-width: 1024px) 55vw, 100vw" />
          </div>
          <div className="glass-panel mx-auto grid w-full max-w-[34rem] gap-0.5 rounded-[26px] p-1.5 text-[#14231f] md:flex md:w-auto md:max-w-full md:items-center md:gap-2 md:rounded-full md:pl-2 short:grid short:w-full short:gap-0 short:rounded-[22px] short:p-1">
            <FormPicker
              forms={forms}
              value={bag.form}
              onPick={bag.pickForm}
              className="min-w-0 justify-between md:justify-start short:justify-between"
              buttonClassName="h-10 px-[5px] text-[12px] min-[375px]:px-2 min-[375px]:text-[13px] min-[400px]:px-3 hover:bg-white/50 aria-pressed:bg-white/85 aria-pressed:shadow-[inset_0_1px_0_white,0_2px_6px_rgb(23_49_42/0.12)] short:h-8 short:px-2 short:text-[12px]"
            />
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-[#14231f]/15 md:block short:hidden" />
            <LeatherPicker leathers={LEATHERS} value={bag.color} onPick={bag.pickColor} className="justify-between px-1 md:justify-start md:gap-0.5 short:justify-between" buttonClassName="h-10 w-12 md:w-9 short:h-8 short:w-9" />
          </div>
        </div>

        <div className="shrink-0 lg:order-1 short:order-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[#f4efe6]/70 lg:text-[12px]">{caption}</p>
          <h1 className="mt-1.5 font-display text-[clamp(2.15rem,10.6vw,3.6rem)] leading-[0.98] tracking-[-0.01em] md:text-[4.25rem] lg:mt-4 lg:text-[clamp(4.5rem,6.6vw,7.25rem)] short:mt-1 short:text-[min(5.4vw,11.5svh)]">
            {content.lineOne} <em className="italic lg:block short:block">{content.lineTwo}</em>
          </h1>
          <p className="mt-2 max-w-[34ch] text-[13px] leading-snug text-[#f4efe6]/80 md:text-[15px] lg:mt-5 lg:text-[17px] short:mt-1.5 short:text-[12.5px]">
            Cut, stitched and finished by hand in Pakistan, then made to order for you in {makingTime}.
          </p>
          <div className="mt-3 flex gap-2 lg:mt-8 lg:gap-3 short:mt-3">
            <Link href={bag.href} className={buttonClass("solid", "h-11! min-w-0 flex-1 justify-between! gap-3 bg-[#f4efe6]! px-5 text-[#14231f]! shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)] hover:bg-white! md:flex-none md:gap-6 lg:h-12! lg:px-7 short:h-10!")}>
              {content.ctaLabel}
              <span className="tabular-nums">{bag.priceLabel}</span>
            </Link>
            <Link href={content.secondaryHref} className="glass flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-[#14231f] transition-colors hover:bg-white/80 lg:h-12 lg:px-6 short:h-10">
              {content.secondaryLabel}
              <ArrowRight aria-hidden size={14} className="hidden min-[380px]:block" />
            </Link>
          </div>
          <p className="sr-only" aria-live="polite">{money(bag.price)}</p>
        </div>
      </div>
    </section>
  );
}
