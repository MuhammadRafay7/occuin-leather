"use client";

// Open/close motion adapted from Watermelon UI's animated-accordion
// (https://ui.watermelon.sh, MIT licence; see THIRD-PARTY-NOTICES.md).
// Rebuilt on plain buttons so the store does not need Radix.

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Plus } from "@phosphor-icons/react";

export type HomeQuestion = { question: string; answer: ReactNode };

type Props = { heading: string; linkLabel: string; items: HomeQuestion[] };

export function HomeFaq({ heading, linkLabel, items }: Props) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <section aria-labelledby={`${base}-heading`} className="px-page mt-16 md:mt-28">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <h2 id={`${base}-heading`} className="max-w-[14ch] font-display text-4xl leading-none md:text-6xl">{heading}</h2>
          <Link href="/faq" className="mt-5 inline-flex min-h-11 items-center text-[13px] underline underline-offset-4 hover:opacity-60">{linkLabel}</Link>
        </div>

        <MotionConfig reducedMotion="user">
          <ul className="border-t border-line">
            {items.map((item, index) => {
              const isOpen = open === index;
              const panel = `${base}-panel-${index}`;
              const trigger = `${base}-trigger-${index}`;
              return (
                <li key={item.question} className="border-b border-line">
                  <h3>
                    <button
                      id={trigger}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panel}
                      onClick={() => setOpen(isOpen ? null : index)}
                      className="flex min-h-16 w-full items-center justify-between gap-6 py-4 text-left text-[17px] leading-snug transition-opacity hover:opacity-70 md:text-lg"
                    >
                      {item.question}
                      <motion.span aria-hidden animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface">
                        <Plus size={16} />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        key="panel"
                        id={panel}
                        role="region"
                        aria-labelledby={trigger}
                        initial={{ height: 0, opacity: 0, y: 16, "--mask-stop": "0%" }}
                        animate={{ height: "auto", opacity: 1, y: 0, "--mask-stop": "100%" }}
                        exit={{ height: 0, opacity: 0, y: 16, "--mask-stop": "0%" }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        style={{
                          overflow: "hidden",
                          maskImage: "linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
                          WebkitMaskImage: "linear-gradient(black var(--mask-stop), transparent var(--mask-stop))",
                        }}
                      >
                        <p className="max-w-[60ch] pb-6 pr-12 text-[15px] leading-relaxed text-muted [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4">{item.answer}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </MotionConfig>
      </div>
    </section>
  );
}
