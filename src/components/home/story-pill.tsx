"use client";

// Floating progress pill adapted from Watermelon UI's scroll-island and step-indicator
// (https://ui.watermelon.sh, MIT licence; see THIRD-PARTY-NOTICES.md).

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { CaretDown } from "@phosphor-icons/react";

type Props = {
  shown: boolean;
  stage: number;
  titles: string[];
  endLabel: string;
  onJump: (index: number) => void;
};

export function StoryPill({ shown, stage, titles, endLabel, onJump }: Props) {
  const [expanded, setOpen] = useState(false);
  // Closes by itself when the pill hides, without a state update in an effect.
  const open = expanded && shown;
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const total = titles.length;
  const progress = ((stage + 1) / total) * 100;
  // On wide screens the list opens sideways as numbered chips; hovering one previews its name here.
  const [preview, setPreview] = useState<number | null>(null);
  const label = open && preview !== null ? preview : stage;

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const jump = (index: number) => {
    setOpen(false);
    setPreview(null);
    onJump(index);
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}>
      <AnimatePresence>
        {shown ? (
          <motion.div
            key="pill"
            ref={box}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.75rem)] z-30 -translate-x-1/2 md:bottom-[max(1.5rem,env(safe-area-inset-bottom))] md:left-[max(3rem,6vw)] md:top-auto md:translate-x-0 short:bottom-3 short:left-[max(1.5rem,env(safe-area-inset-left))] short:top-auto short:translate-x-0"
          >
            <motion.div
              layout
              style={{ borderRadius: 26 }}
              className="glass-panel overflow-hidden text-fg shadow-[0_18px_40px_-20px_rgb(0_0_0/0.6)] md:flex md:items-center short:flex short:items-center"
            >
              <motion.button
                layout="position"
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen(!open)}
                className="flex min-h-11 shrink-0 items-center gap-2.5 py-1.5 pl-1.5 pr-3.5 text-[13px] md:w-[15.5rem] short:w-[15.5rem]"
              >
                <span
                  aria-hidden
                  className="relative h-8 w-8 shrink-0 rounded-full transition-[background] duration-500"
                  style={{ background: `conic-gradient(var(--invert-bg) ${progress}%, rgb(23 49 42 / 0.14) 0)` }}
                >
                  <span className="absolute inset-[3px] grid place-items-center rounded-full bg-[#fafafa] text-[11px] font-medium tabular-nums">{stage + 1}</span>
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">
                  <span className="font-medium">{titles[label]}</span>
                  <span className="text-muted tabular-nums"> · {label + 1} of {total}</span>
                </span>
                <motion.span aria-hidden animate={{ rotate: open ? 180 : 0 }}>
                  <CaretDown size={14} />
                </motion.span>
              </motion.button>

              <AnimatePresence initial={false}>
                {open ? (
                  <motion.ol
                    key="list"
                    id={listId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onMouseLeave={() => setPreview(null)}
                    className="grid min-w-60 gap-0.5 border-t border-[#14231f]/10 p-1.5 md:flex md:min-w-0 md:items-center md:gap-1 md:border-l md:border-t-0 md:py-1 md:pl-2 md:pr-1.5 short:flex short:min-w-0 short:items-center short:gap-1 short:border-l short:border-t-0 short:py-1 short:pl-2 short:pr-1.5"
                  >
                    {titles.map((title, index) => (
                      <li key={title}>
                        <button
                          type="button"
                          aria-current={index === stage ? "step" : undefined}
                          title={title}
                          onClick={() => jump(index)}
                          onMouseEnter={() => setPreview(index)}
                          onFocus={() => setPreview(index)}
                          className="flex min-h-10 w-full items-center gap-3 rounded-full px-3 text-left text-[13px] hover:bg-white/60 aria-[current=step]:bg-white/85 md:w-9 md:justify-center md:px-0 short:w-9 short:justify-center short:px-0"
                        >
                          <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] tabular-nums md:h-6 md:w-6 md:text-[11px] short:h-6 short:w-6 short:text-[11px] ${index <= stage ? "bg-invert-bg text-invert-fg" : "bg-[#14231f]/10"}`}>{index + 1}</span>
                          <span className="md:sr-only short:sr-only">{title}</span>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button type="button" onClick={() => jump(total)} className="flex min-h-10 w-full items-center whitespace-nowrap rounded-full px-3 text-left text-[13px] font-medium underline underline-offset-4 hover:bg-white/60 md:ml-1">
                        {endLabel}
                      </button>
                    </li>
                  </motion.ol>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}
