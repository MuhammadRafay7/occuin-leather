"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { presentBag } from "@/components/bag-drawer";
import { addAndReadBag } from "@/components/product/bag-actions";
import { compareSizes } from "@/lib/shop-params";

type Props = { slug: string; name: string; sizes: string[]; surface?: "page" | "stage" };

const MESSAGE_TIME = 2600;
const REVEAL_CLASS =
  "transition duration-200 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-has-[:focus-visible]:translate-y-0 [@media(hover:hover)]:group-has-[:focus-visible]:opacity-100 [@media(hover:hover)]:group-has-[:focus-visible]:pointer-events-auto";
const STAGE_PILL = "bg-[#f4efe6] text-[#14201c] shadow-[0_10px_20px_-10px_rgb(0_0_0/0.65)]";
const STAGE_ADD = `${STAGE_PILL} pointer-events-auto flex h-11 min-w-11 items-center justify-center gap-2 rounded-full text-xs font-medium focus-visible:outline-[#f4efe6] active:scale-[0.96] [@media(hover:hover)]:h-9 [@media(hover:hover)]:px-4`;

export function QuickAdd({ slug, name, sizes, surface = "page" }: Props) {
  const ordered = [...sizes].sort(compareSizes);
  const single = ordered.length === 1;
  const onStage = surface === "stage";
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const sheet = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_TIME);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!sheet.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  function add(size?: string) {
    setMessage(null);
    start(async () => {
      const result = await addAndReadBag(slug, { size });
      if ("bag" in result && result.bag) {
        setExpanded(false);
        presentBag({ bag: result.bag, addedId: result.addedId });
      } else {
        setMessage(result.error ?? "Could not add this piece.");
      }
    });
  }

  const sizeButtons = ordered.map((size) => (
    <button
      key={size}
      type="button"
      disabled={pending}
      aria-label={`Add ${name} in size ${size} to bag`}
      onClick={() => add(size)}
      className={`grid h-11 min-w-11 place-items-center rounded-full px-1 text-xs text-fg transition hover:bg-invert-bg hover:text-invert-fg active:scale-[0.94] ${onStage ? "[@media(hover:hover)]:h-9 [@media(hover:hover)]:min-w-9" : "lg:h-8 lg:min-w-8"}`}
    >
      {size}
    </button>
  ));

  if (onStage) {
    return (
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex justify-end md:inset-x-3 md:bottom-3 lg:inset-x-4 lg:bottom-4">
        <div aria-live="polite" className="sr-only">{message}</div>
        {message ? (
          <p className={`${STAGE_PILL} pointer-events-auto flex min-h-10 items-center rounded-[20px] px-4 py-2 text-xs`}>{message}</p>
        ) : single ? (
          <button type="button" disabled={pending} aria-label={`Quick add ${name} to bag`} onClick={() => add()} className={`${STAGE_ADD} ${REVEAL_CLASS}`}>
            <Plus size={14} aria-hidden className={pending ? "opacity-40" : ""} />
            <span className="hidden [@media(hover:hover)]:inline">{pending ? "Adding" : "Quick add"}</span>
          </button>
        ) : (
          <div ref={sheet} className="pointer-events-auto max-w-full">
            {expanded ? (
              <div role="group" aria-label={`Choose a size for ${name}`} className={`${STAGE_PILL} flex flex-wrap items-center justify-end gap-0.5 rounded-[22px] p-0.5`}>
                {sizeButtons}
                <button type="button" aria-label="Close sizes" onClick={() => setExpanded(false)} className="grid size-11 place-items-center rounded-full text-fg [@media(hover:hover)]:size-9"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" aria-label={`Quick add ${name}, choose a size`} onClick={() => setExpanded(true)} className={`${STAGE_ADD} ${REVEAL_CLASS}`}>
                <Plus size={14} aria-hidden />
                <span className="hidden [@media(hover:hover)]:inline">Quick add</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex justify-end lg:justify-center">
      <div aria-live="polite" className="sr-only">{message}</div>
      {message ? (
        <p className="glass-panel pointer-events-auto flex h-10 items-center rounded-full px-4 text-xs text-fg">{message}</p>
      ) : single ? (
        <button
          type="button"
          disabled={pending}
          aria-label={`Quick add ${name} to bag`}
          onClick={() => add()}
          className={`glass-panel pointer-events-auto flex size-11 items-center justify-center gap-2 rounded-full text-xs text-fg active:scale-[0.96] lg:h-9 lg:w-auto lg:px-4 ${REVEAL_CLASS}`}
        >
          <Plus size={14} aria-hidden className={pending ? "opacity-40" : ""} />
          <span className="hidden lg:inline">{pending ? "Adding" : "Quick add"}</span>
        </button>
      ) : (
        <>
          <div role="group" aria-label={`Quick add ${name}, choose a size`} className={`glass-panel pointer-events-auto hidden max-w-full flex-wrap items-center justify-center gap-0.5 rounded-[20px] p-0.5 lg:flex ${REVEAL_CLASS}`}>
            {sizeButtons}
          </div>
          <div ref={sheet} className="pointer-events-auto lg:hidden">
            {expanded ? (
              <div role="group" aria-label={`Choose a size for ${name}`} className="glass-panel flex flex-wrap items-center justify-center gap-0.5 rounded-[22px] p-0.5">
                {sizeButtons}
                <button type="button" aria-label="Close sizes" onClick={() => setExpanded(false)} className="grid size-11 place-items-center rounded-full text-fg"><X size={14} /></button>
              </div>
            ) : (
              <button type="button" aria-label={`Quick add ${name}, choose a size`} onClick={() => setExpanded(true)} className="glass-panel grid size-11 place-items-center rounded-full text-fg active:scale-[0.96]">
                <Plus size={14} aria-hidden />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
