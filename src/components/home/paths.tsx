import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { DEFAULT_HOME } from "@/lib/content/defaults";

export function Paths({ content }: { content: typeof DEFAULT_HOME.paths }) {
  return (
    <section aria-labelledby="paths-heading" className="mt-16 bg-[radial-gradient(90%_120%_at_50%_0%,#3b5a50_0%,#20403a_45%,#0f211d_100%)] text-[#f4efe6] md:mt-28">
      <div className="px-page mx-auto max-w-6xl py-16 md:py-24 short:py-12">
        <h2 id="paths-heading" className="max-w-[18ch] font-display text-4xl leading-none md:text-6xl">{content.heading}</h2>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2 md:mt-12 md:gap-3 lg:grid-cols-4">
          {content.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="group flex h-full min-h-28 flex-col justify-between gap-6 rounded-[24px] border border-[#f4efe6]/20 p-5 transition-colors hover:border-[#f4efe6]/60 hover:bg-[#f4efe6]/[0.06] md:min-h-44">
                <span className="flex items-center justify-between gap-4 font-display text-2xl leading-tight md:text-3xl">
                  {link.label}
                  <ArrowRight aria-hidden size={20} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                {link.note ? <span className="text-[13px] text-[#f4efe6]/70">{link.note}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
