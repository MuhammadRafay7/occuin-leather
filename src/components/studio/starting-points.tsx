"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PRESETS, STARTING_POINTS, type PresetKey } from "@/lib/studio/presets";
import { BagGlyph, leatherStyle, PRESS, SPRING } from "./controls";
import { SavedDesigns } from "./saved";
import { useStudio } from "./store";

const LEAD: PresetKey = "tote";

function Render({ presetKey, label }: { presetKey: PresetKey; label: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <div className="absolute inset-0 grid place-items-center px-[16%] pb-[12%] text-invert-bg/80">
        <BagGlyph spec={PRESETS[presetKey]} />
      </div>
    );
  }
  return (
    <motion.div className="absolute inset-0" variants={{ rest: { scale: 1.14 }, hover: { scale: 1.2 } }} transition={SPRING}>
      <Image
        src={`/images/studio/${presetKey}.webp`}
        alt={label}
        fill
        loading={presetKey === LEAD ? "eager" : "lazy"}
        sizes={presetKey === LEAD ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw"}
        className="object-cover"
        onError={() => setMissing(true)}
      />
    </motion.div>
  );
}

function PieceCard({ presetKey, label, hint, onChoose }: { presetKey: PresetKey; label: string; hint: string; onChoose: () => void }) {
  const lead = presetKey === LEAD;
  return (
    <li className={lead ? "col-span-2 row-span-2 lg:col-span-2" : ""}>
      <motion.button
        type="button"
        onClick={onChoose}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap={{ scale: 0.985 }}
        transition={PRESS}
        className="relative block aspect-square h-full w-full overflow-hidden bg-surface text-left"
      >
        <Render presetKey={presetKey} label={label} />
        <span className={`glass-panel absolute bottom-2 left-2 grid rounded-[20px] md:bottom-3 md:left-3 ${lead ? "px-4 py-2.5 md:min-w-[280px] md:px-5 md:py-3.5" : "px-3.5 py-1.5"}`}>
          <span className={`font-display leading-tight ${lead ? "text-[26px] md:text-[34px]" : "text-[18px] md:text-[20px]"}`}>{label}</span>
          <span className={lead ? "text-[13px] leading-snug text-fg/75" : "sr-only"}>{hint}</span>
        </span>
      </motion.button>
    </li>
  );
}

function BlankHide({ hint, onChoose }: { hint: string; onChoose: () => void }) {
  return (
    <li className="col-span-2">
      <motion.button
        type="button"
        onClick={onChoose}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileTap={{ scale: 0.985 }}
        transition={PRESS}
        className="relative flex h-full min-h-[200px] w-full items-end justify-between gap-6 overflow-hidden p-5 text-left text-invert-fg md:p-7"
        style={leatherStyle("pebble", "forest")}
      >
        <span className="grid gap-1">
          <span className="font-display text-[34px] leading-[1.05] tracking-[-0.01em] md:text-[44px]">Blank hide</span>
          <span className="text-[15px] text-invert-fg/85">{hint}</span>
        </span>
        <motion.span variants={{ rest: { x: 0 }, hover: { x: 6 } }} transition={SPRING} className="glass grid h-12 w-12 shrink-0 place-items-center rounded-full !bg-bg text-invert-bg">
          <ArrowRight size={18} weight="bold" />
        </motion.span>
      </motion.button>
    </li>
  );
}

function FromScratch() {
  return (
    <Link
      href="/studio/create"
      className="group mb-1.5 grid gap-5 overflow-hidden bg-invert-bg p-6 text-invert-fg transition-opacity hover:opacity-95 md:grid-cols-[1fr_auto] md:items-center md:p-8 lg:mb-2"
    >
      <span className="grid gap-1.5">
        <span className="font-display text-[34px] leading-[1.05] tracking-[-0.01em] md:text-[48px]">Create from scratch</span>
        <span className="max-w-[58ch] text-[15px] text-invert-fg/85">No template. Draw every panel yourself on a pattern board, choose each leather, and our workshop will price it for you.</span>
      </span>
      <span className="flex items-center gap-3 text-sm font-medium">
        Open the pattern board
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-bg text-invert-bg transition-transform duration-300 group-hover:translate-x-1">
          <ArrowRight size={18} weight="bold" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

export function StartingPoints({ notice }: { notice: string | null }) {
  const begin = useStudio((state) => state.begin);

  const choose = (key: PresetKey) => {
    begin({ spec: PRESETS[key], designId: null, source: `preset:${key}` });
    window.history.replaceState(null, "", "/studio");
  };

  const pieces = STARTING_POINTS.filter((point) => point.key !== "blank");
  const blank = STARTING_POINTS.find((point) => point.key === "blank");

  return (
    <div className="mx-auto max-w-[1440px] px-2 pb-10 pt-[96px] md:px-4 md:pt-[112px]">
      <header className="mb-8 grid gap-3 px-2 md:mb-10 md:grid-cols-[1fr_auto] md:items-end md:gap-12 md:px-2">
        <div>
          <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.015em] text-invert-bg md:text-[76px]">Pick a bag to change</h1>
        </div>
        <p className="max-w-[44ch] text-muted md:pb-2">
          Change its size, leather, stitching and hardware in 3D, and add up to four initials. The price updates as you go.
        </p>
        {notice ? <p role="status" className="text-sm text-danger md:col-span-2">{notice}</p> : null}
      </header>
      <FromScratch />
      <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-4 lg:gap-2">
        {pieces.map((point) => (
          <PieceCard key={point.key} presetKey={point.key} label={point.label} hint={point.hint} onChoose={() => choose(point.key)} />
        ))}
        {blank ? <BlankHide hint={blank.hint} onChoose={() => choose(blank.key)} /> : null}
      </ul>
      <div className="mt-10 px-2">
        <SavedDesigns compact />
      </div>
    </div>
  );
}
