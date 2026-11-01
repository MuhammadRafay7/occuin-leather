"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { motion, useDragControls } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { SPRING } from "@/components/studio/controls";
import { PRODUCT_TYPES } from "@/lib/bespoke/design";
import { isSolidPanel, groupBounds, layerOrder } from "@/lib/bespoke/outline";
import { INSPIRATION, partPreview, PART_CATEGORIES, type Part } from "@/lib/bespoke/parts";
import type { BespokeDesign } from "@/lib/bespoke/design";
import { PlanDefs, PlanPiece } from "./plan";
import { useCreator } from "./store";
import { GLASS_PANEL } from "./ui";

const MARGIN_MM = 16;
let previewIds = 0;
const nextId = () => `p${(previewIds++).toString(36)}`;

const Thumb = memo(function Thumb({ design, ghostId }: { design: BespokeDesign; ghostId: string | null }) {
  const solid = design.pieces.filter((piece) => isSolidPanel(piece) || piece.kind === "tube");
  if (!solid.length) return null;
  const box = groupBounds(solid);
  return (
    <svg aria-hidden viewBox={`${box.minX - MARGIN_MM} ${box.minY - MARGIN_MM} ${box.width + MARGIN_MM * 2} ${box.height + MARGIN_MM * 2}`} className="h-full w-full">
      <defs><PlanDefs /></defs>
      {layerOrder(design.pieces).map((piece) =>
        piece.id === ghostId ? (
          <g key={piece.id} opacity="0.32"><PlanPiece piece={{ ...piece, stitched: false, hardware: piece.hardware }} pieces={design.pieces} metal={design.metal} /></g>
        ) : (
          <PlanPiece key={piece.id} piece={piece} pieces={design.pieces} metal={design.metal} />
        ),
      )}
    </svg>
  );
});

function PartTile({ part, large }: { part: Part; large: boolean }) {
  const placePart = useCreator((state) => state.placePart);
  const setLibrary = useCreator((state) => state.setLibrary);
  const preview = useMemo(() => partPreview(part.key), [part.key]);
  return (
    <button
      type="button"
      data-part={part.key}
      onClick={() => {
        placePart(part.key);
        if (large) setLibrary(false);
      }}
      className="grid content-start gap-1 rounded-[16px] border border-fg/10 bg-bg/70 p-2 text-left transition-colors duration-200 hover:border-fg/35"
    >
      <span className={`block overflow-hidden rounded-[10px] bg-[#cfd6d1] p-1 ${large ? "h-[108px]" : "h-[78px]"}`}>{preview ? <Thumb design={preview.design} ghostId={preview.ghostId} /> : null}</span>
      <span className="text-[13px] font-medium leading-tight">{part.name}</span>
      <span className="text-[12px] leading-snug text-fg/75">{part.hint}</span>
    </button>
  );
}

function InspirationTile({ item, large }: { item: (typeof INSPIRATION)[number]["designs"][number]; large: boolean }) {
  const loadDesign = useCreator((state) => state.loadDesign);
  const setLibrary = useCreator((state) => state.setLibrary);
  const design = useMemo(() => item.build(nextId), [item]);
  return (
    <button
      type="button"
      data-example={item.key}
      onClick={() => {
        loadDesign(item.build(nextId));
        setLibrary(false);
      }}
      className="grid content-start gap-1 rounded-[16px] border border-fg/10 bg-bg/70 p-2 text-left transition-colors duration-200 hover:border-fg/35"
    >
      <span className={`block overflow-hidden rounded-[10px] bg-[#cfd6d1] p-1 ${large ? "h-[108px]" : "h-[78px]"}`}><Thumb design={design} ghostId={null} /></span>
      <span className="text-xs text-fg/75">Example</span>
      <span className="text-[13px] font-medium leading-tight">{item.label}</span>
      <span className="text-[12px] leading-snug text-fg/75">{item.note}</span>
    </button>
  );
}

const TABS = [{ key: "inspiration", label: "Examples" }, ...PART_CATEGORIES.map(({ key, label }) => ({ key, label }))];

function useCoarseWidth() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return phone;
}

function Contents({ large }: { large: boolean }) {
  const [tab, setTab] = useState("body");
  const [query, setQuery] = useState("");
  const setLibrary = useCreator((state) => state.setLibrary);
  const term = query.trim().toLowerCase();
  const found = term
    ? PART_CATEGORIES.flatMap((category) => category.parts.filter((part) => `${part.name} ${part.hint} ${category.label}`.toLowerCase().includes(term)))
    : (PART_CATEGORIES.find((category) => category.key === tab)?.parts ?? []);
  const columns = "grid grid-cols-2 gap-2";
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="font-display text-[22px] leading-none">Parts library</h2>
        <button type="button" aria-label="Close the parts library" onClick={() => setLibrary(false)} className="ml-auto grid h-11 w-11 place-items-center rounded-full hover:bg-fg/10"><X size={18} aria-hidden /></button>
      </div>
      <label className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-fg/20 bg-bg px-4">
        <MagnifyingGlass size={16} aria-hidden />
        <span className="sr-only">Search parts</span>
        <input type="search" value={query} placeholder="Search parts" onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-fg/60 focus:outline-none" />
      </label>
      {term ? null : (
        <div role="tablist" aria-label="Part categories" className={`flex shrink-0 gap-1 ${large ? "touch-pan-x overflow-x-auto [scrollbar-width:none]" : "flex-wrap"}`}>
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-medium aria-selected:bg-invert-bg aria-selected:text-invert-fg ${large ? "min-h-11" : "min-h-9"}`}>{label}</button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [scrollbar-width:thin]">
        {!term && tab === "inspiration" ? (
          <div className="grid gap-4">
            {INSPIRATION.map((group) => (
              <section key={group.productType} className="grid gap-2">
                <h3 className="text-[13px] font-medium">{PRODUCT_TYPES[group.productType]}</h3>
                <div className={columns}>{group.designs.map((item) => <InspirationTile key={item.key} item={item} large={large} />)}</div>
              </section>
            ))}
          </div>
        ) : found.length ? (
          <div className={columns}>{found.map((part) => <PartTile key={part.key} part={part} large={large} />)}</div>
        ) : (
          <p className="p-2 text-[13px] text-fg/75">No parts match that search.</p>
        )}
      </div>
    </div>
  );
}

export function Library() {
  const phone = useCoarseWidth();
  const setLibrary = useCreator((state) => state.setLibrary);
  const drag = useDragControls();
  if (phone) {
    return (
      <motion.aside
        aria-label="Parts library"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={SPRING}
        drag="y"
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 500) setLibrary(false);
        }}
        className={`${GLASS_PANEL} !bg-bg absolute inset-x-1 bottom-1 top-14 z-10 flex flex-col rounded-[24px] px-3 pb-2`}
      >
        <button type="button" aria-label="Drag down to close" onPointerDown={(event) => drag.start(event)} onClick={() => setLibrary(false)} className="grid h-8 w-full shrink-0 touch-none place-items-center">
          <span aria-hidden className="block h-[5px] w-10 rounded-full bg-fg/35" />
        </button>
        <div className="min-h-0 flex-1"><Contents large /></div>
      </motion.aside>
    );
  }
  return (
    <aside aria-label="Parts library" className={`${GLASS_PANEL} !bg-bg/95 absolute bottom-3 left-3 top-3 z-10 w-[360px] max-w-[calc(100%-24px)] rounded-[24px] p-3`}>
      <Contents large={false} />
    </aside>
  );
}
