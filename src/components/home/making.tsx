import Link from "next/link";
import { Inline } from "@/components/content-blocks";
import type { TokenValues } from "@/lib/content/rich-text";
import type { DEFAULT_HOME } from "@/lib/content/defaults";

export function Making({ content, tokens }: { content: typeof DEFAULT_HOME.making; tokens: TokenValues }) {
  return (
    <section aria-labelledby="making-heading" className="px-page mt-16 md:mt-28">
      <div className="mx-auto max-w-6xl">
        <h2 id="making-heading" className="max-w-[16ch] font-display text-4xl leading-none md:text-6xl">{content.heading}</h2>
        <ol className="making mt-8 grid gap-0 md:mt-12 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))] md:gap-6">
          {content.steps.map((step, index) => (
            <li key={index} className="making-step relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-8 last:pb-0 md:block md:pb-0">
              <span aria-hidden className="relative z-10 grid h-10 w-10 place-items-center rounded-full bg-invert-bg font-display text-lg text-invert-fg">{index + 1}</span>
              <div className="md:mt-5">
                <h3 className="font-display text-2xl leading-tight">{step.title}</h3>
                <p className="mt-2 max-w-[36ch] text-[15px] leading-relaxed text-muted [&_a]:underline [&_a]:underline-offset-4"><Inline text={step.body} tokens={tokens} /></p>
              </div>
            </li>
          ))}
        </ol>
        <Link href="/shipping-returns" className="mt-8 inline-flex min-h-11 items-center text-[13px] underline underline-offset-4 hover:opacity-60">Shipping and returns</Link>
      </div>
    </section>
  );
}
