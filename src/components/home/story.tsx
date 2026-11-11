import Link from "next/link";
import type { ReactNode } from "react";
import { StorySheet } from "@/components/home/story-sheet";
import { buttonClass } from "@/components/ui";
import type { DEFAULT_HOME } from "@/lib/content/defaults";
import { money } from "@/lib/format";
import { STORY_STEPS, storyFrame } from "@/lib/home/story";
import { PRESETS } from "@/lib/studio/presets";
import { quoteDesign, type StudioPricing } from "@/lib/studio/pricing";

type Content = typeof DEFAULT_HOME.story;
type Props = { content: Content; pricing: StudioPricing; productName: string | null; intro: ReactNode; endBody: ReactNode };

export function Story({ content, pricing, productName, intro, endBody }: Props) {
  const price = quoteDesign(PRESETS.crossbody, pricing).totalCents;
  const frames = STORY_STEPS.map((key, index) => ({ key, ...content.steps[key], image: storyFrame(index, key) }));

  return (
    <section id="story" aria-labelledby="story-heading" className="relative mt-16 overflow-hidden bg-[#17312a] text-[#f4efe6] md:mt-24">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_75%_50%,rgb(212_168_90/0.08),transparent_70%),linear-gradient(180deg,#0f211d_0%,transparent_28%,transparent_78%,#0f211d_100%)]" />
      <div className="px-page relative mx-auto max-w-[1240px] py-16 md:py-24">
        <StorySheet
          frames={frames}
          label={productName ?? PRESETS.crossbody.name}
          header={
            <header>
              <p className="flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[#cfe0d6]">
                <span aria-hidden className="h-px w-8 bg-[#d4a85a]" />
                {content.eyebrow}
              </p>
              <h2 id="story-heading" className="mt-5 max-w-[11ch] font-display text-[clamp(2.6rem,7vw,4.75rem)] leading-[0.92] tracking-[-0.02em]">{content.heading}</h2>
              <p className="mt-5 max-w-[40ch] text-[15px] leading-relaxed text-[#f4efe6]/70 [&_a]:underline [&_a]:underline-offset-4">{intro}</p>
            </header>
          }
          footer={
            <div className="grid gap-5">
              <p className="max-w-[44ch] text-[13px] leading-relaxed text-[#f4efe6]/60 [&_a]:underline [&_a]:underline-offset-4">
                <span className="font-display text-base italic text-[#f4efe6]">{content.endHeading}</span>
                <span className="mx-2 tabular-nums text-[#d4a85a]">{money(price)}</span>
                {endBody}
              </p>
              <div className="grid gap-2 min-[400px]:grid-cols-2 md:flex">
                <Link href={`/studio?from=${content.slug}`} className={buttonClass("solid", "w-full bg-[#f4efe6]! px-6 text-[#14231f]! hover:bg-white! md:w-auto")}>{content.ctaLabel}</Link>
                <Link href={`/product/${content.slug}`} className={buttonClass("outline", "w-full border-[#f4efe6]/35! px-6 text-[#f4efe6]! hover:bg-[#f4efe6]/10! md:w-auto")}>{content.productLabel}</Link>
              </div>
            </div>
          }
        />
      </div>
    </section>
  );
}
