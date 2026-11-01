"use client";

import { useEffect, useState } from "react";
import { loadPastDesigns, type PastDesign } from "@/lib/actions/bespoke";
import { DesignPlan } from "./plan";
import { useCreator } from "./store";
import { GLASS_PANEL } from "./ui";

const SEEN_KEY = "occuin-past-designs-seen";

function usePastDesigns() {
  const [items, setItems] = useState<PastDesign[]>([]);
  useEffect(() => {
    let live = true;
    loadPastDesigns().then((rows) => {
      if (live) setItems(rows);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return items;
}

function PastList({ items, onUse }: { items: PastDesign[]; onUse?: () => void }) {
  const loadDesign = useCreator((state) => state.loadDesign);
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border border-fg/15 p-2">
          <DesignPlan design={item.design} className="h-16 w-16 overflow-hidden rounded-[12px]" />
          <span className="min-w-0 text-[13px]">
            <span className="block truncate font-medium">{item.name}</span>
            <span className="block truncate text-fg/75">{item.note}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              loadDesign(item.design, null, `${item.name} copy`.slice(0, 60));
              onUse?.();
            }}
            className="min-h-11 rounded-full border border-fg/20 px-3 text-[13px] font-medium hover:bg-fg/10"
          >
            Use as new
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PastDesigns() {
  const items = usePastDesigns();
  if (!items.length) return null;
  return (
    <section aria-labelledby="past-title" className="grid gap-2">
      <h2 id="past-title" className="text-[14px] font-medium">Start from a past design</h2>
      <p className="text-[13px] text-fg/75">This opens a copy. Your original stays as it is.</p>
      <PastList items={items} />
    </section>
  );
}

export function PastDesignsPrompt({ skip }: { skip: boolean }) {
  const items = usePastDesigns();
  const guiding = useCreator((state) => state.guideStep !== null);
  const hasBoard = useCreator((state) => state.design.pieces.length > 0);
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    const value = window.sessionStorage.getItem(SEEN_KEY) === "1";
    const timer = window.setTimeout(() => setSeen(value), 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (skip || guiding || seen !== false || !items.length) return null;
  const close = () => {
    window.sessionStorage.setItem(SEEN_KEY, "1");
    setSeen(true);
  };
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[#0d1f19]/45 p-4">
      <section role="dialog" aria-labelledby="past-prompt-title" className={`${GLASS_PANEL} grid max-h-full w-full max-w-[520px] gap-3 overflow-y-auto rounded-[28px] p-5`}>
        <h2 id="past-prompt-title" className="font-display text-[28px] leading-[1.08]">Welcome back</h2>
        <p className="text-[14px]">Start from one of your past designs. Each opens as a new copy you can change.{hasBoard ? " It replaces what is on the board, and Undo brings that back." : ""}</p>
        <PastList items={items} onUse={close} />
        <button type="button" autoFocus onClick={close} className="min-h-11 justify-self-end rounded-full bg-invert-bg px-5 text-[13px] font-medium text-invert-fg">{hasBoard ? "Keep my draft" : "Start blank"}</button>
      </section>
    </div>
  );
}
