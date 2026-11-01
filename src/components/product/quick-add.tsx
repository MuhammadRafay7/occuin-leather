"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useTransition } from "react";
import { presentBag } from "@/components/bag-drawer";
import { addAndReadBag } from "@/components/product/bag-actions";
import { compareSizes } from "@/lib/shop-params";

type Props = { slug: string; name: string; sizes: string[] };

const MESSAGE_TIME = 2600;
const REVEAL_CLASS =
  "transition duration-200 [@media(hover:hover)]:translate-y-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-has-[:focus-visible]:translate-y-0 [@media(hover:hover)]:group-has-[:focus-visible]:opacity-100 [@media(hover:hover)]:group-has-[:focus-visible]:pointer-events-auto";

export function QuickAdd({ slug, name, sizes }: Props) {
  const ordered = [...sizes].sort(compareSizes);
  const single = ordered.length === 1;
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
      className="grid h-10 min-w-10 place-items-center rounded-full px-1 text-xs text-fg transition hover:bg-invert-bg hover:text-invert-fg active:scale-[0.94] sm:h-8 sm:min-w-8"
    >
      {size}
    </button>
  ));

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10 flex justify-end sm:justify-center">
      <div aria-live="polite" className="sr-only">{message}</div>
      {message ? (
        <p className="glass-panel pointer-events-auto flex h-10 items-center rounded-full px-4 text-xs text-fg">{message}</p>
      ) : single ? (
        <button
          type="button"
          disabled={pending}
          aria-label={`Quick add ${name} to bag`}
          onClick={() => add()}
          className={`glass-panel pointer-events-auto flex size-11 items-center justify-center gap-2 rounded-full text-xs text-fg active:scale-[0.96] sm:h-9 sm:w-auto sm:px-4 ${REVEAL_CLASS}`}
        >
          <Plus size={14} aria-hidden className={pending ? "opacity-40" : ""} />
          <span className="hidden sm:inline">{pending ? "Adding" : "Quick add"}</span>
        </button>
      ) : (
        <>
          <div role="group" aria-label={`Quick add ${name}, choose a size`} className={`glass-panel pointer-events-auto hidden max-w-full flex-wrap items-center justify-center gap-0.5 rounded-[20px] p-0.5 sm:flex ${REVEAL_CLASS}`}>
            {sizeButtons}
          </div>
          <div ref={sheet} className="pointer-events-auto sm:hidden">
            {expanded ? (
              <div role="group" aria-label={`Choose a size for ${name}`} className="glass-panel flex flex-wrap items-center justify-center gap-0.5 rounded-[22px] p-0.5">
                {sizeButtons}
                <button type="button" aria-label="Close sizes" onClick={() => setExpanded(false)} className="grid size-10 place-items-center rounded-full text-fg"><X size={14} /></button>
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
