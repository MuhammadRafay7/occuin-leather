"use client";

import { ArrowCounterClockwise, ArrowLeft, ArrowRight, ArrowUUpLeft, ArrowUUpRight, BookmarkSimple, Handbag, Plus, Resize, Scissors, Sparkle, Swatches, TextAa, type Icon } from "@phosphor-icons/react";
import { animate, AnimatePresence, MotionConfig, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { Pinyon_Script } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { designSpecSchema, type DesignSpec } from "@/lib/studio/spec";
import { PRESS, SECONDARY, Segments, SPRING } from "./controls";
import { SavedDesigns } from "./saved";
import { StartingPoints } from "./starting-points";
import { SectionView, type Issues } from "./steps";
import { readDraft, restoreDraft, STEPS, useStudio, writeDraft, type SectionKey, type StepKey } from "./store";
import { BagBar, SheetSummary, SummaryCard, useDesignActions, type DesignActions } from "./summary";
import { Stage, useWebgl, ViewPicker } from "./viewport";

const script = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap" });

export type StudioInitial = {
  spec: DesignSpec;
  designId: string | null;
  source: string;
  owned: boolean;
} | null;

const FRIENDLY: Record<string, string> = {
  name: "Give your design a name of up to 60 characters.",
  "monogram.text": "Use up to four letters, with & or a full stop if you wish.",
};

function collectIssues(spec: DesignSpec) {
  const issues: Issues = new Map();
  const parsed = designSpecSchema.safeParse(spec);
  if (parsed.success) return issues;
  for (const issue of parsed.error.issues) {
    const path = issue.path.join(".");
    if (!issues.has(path)) issues.set(path, FRIENDLY[path] ?? issue.message);
  }
  return issues;
}

const STEP_FOR_ROOT: Record<string, StepKey> = {
  form: "shape",
  panels: "leather",
  surface: "leather",
  closure: "details",
  carry: "details",
  pocket: "details",
  hardware: "hardware",
  stitch: "stitch",
  edgeColor: "stitch",
  liningColor: "stitch",
  monogram: "personalise",
};

const DOCK_STEPS = STEPS.filter((item) => item.key !== "saved");
const DOCK_ICONS: Record<Exclude<StepKey, "saved">, Icon> = {
  shape: Resize,
  leather: Swatches,
  details: Handbag,
  hardware: Sparkle,
  stitch: Scissors,
  personalise: TextAa,
};

const DESKTOP_QUERY = "(min-width: 1024px)";
const NAV_BOTTOM_PX = 64;
const FOOTER_PX = 128;
const PEEK_PX = 108;
const RUBBER_PX = 240;
const PEEK_STAGE_SCALE = 1.15;
const HALF_SHARE = 0.54;
const FULL_SHARE = 0.74;
const DECELERATION = 0.994;
const HISTORY_MS = 100;

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return desktop;
}

function useLockedPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);
}

const REFRACT = "[.refract_&]:[backdrop-filter:url(#liquid-glass)_blur(9px)_saturate(190%)]";
const TOOL = "grid h-11 w-11 place-items-center rounded-full text-fg transition-colors duration-200 hover:bg-fg/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

function ToolButton({ label, disabled, pressed, onClick, children }: { label: string; disabled?: boolean; pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={PRESS}
      onClick={onClick}
      className={`${TOOL} aria-pressed:bg-invert-bg aria-pressed:text-invert-fg aria-pressed:hover:bg-invert-bg`}
    >
      {children}
    </motion.button>
  );
}

function Tools() {
  const canUndo = useStudio((state) => state.past.length > 0);
  const canRedo = useStudio((state) => state.future.length > 0);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const reset = useStudio((state) => state.reset);
  const changed = useStudio((state) => state.spec !== state.baseline);
  const choose = useStudio((state) => state.choose);
  const step = useStudio((state) => state.step);
  const setStep = useStudio((state) => state.setStep);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="relative">
      <div role="toolbar" aria-label="Design tools" className={`glass-panel flex w-fit items-center rounded-full p-1 ${REFRACT}`}>
        <ToolButton label="Undo" disabled={!canUndo} onClick={undo}><ArrowUUpLeft size={18} /></ToolButton>
        <ToolButton label="Redo" disabled={!canRedo} onClick={redo}><ArrowUUpRight size={18} /></ToolButton>
        <ToolButton label="Reset to where you began" disabled={!changed} onClick={reset}><ArrowCounterClockwise size={18} /></ToolButton>
        <ToolButton label="Start a new design" onClick={() => setConfirming(true)}><Plus size={18} /></ToolButton>
        <ToolButton label="Saved designs" pressed={step === "saved"} onClick={() => setStep(step === "saved" ? "shape" : "saved")}><BookmarkSimple size={18} /></ToolButton>
      </div>
      <AnimatePresence>
        {confirming ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={SPRING}
            style={{ transformOrigin: "top left" }}
            className="glass-panel absolute left-0 top-[calc(100%+8px)] z-10 grid w-[280px] gap-2 rounded-[22px] bg-bg/90 p-4 text-[13px]"
          >
            <p>Leave this design? Unsaved changes will be lost.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-11 flex-1 rounded-full bg-invert-bg px-3 font-medium text-invert-fg"
                onClick={() => {
                  window.history.replaceState(null, "", "/studio");
                  choose();
                }}
              >
                Start again
              </button>
              <button type="button" className="min-h-11 flex-1 rounded-full border border-fg/15 px-3 font-medium hover:bg-fg/10" onClick={() => setConfirming(false)}>Stay</button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Dock({ issues, compact = false, onPick }: { issues: Issues; compact?: boolean; onPick?: (step: StepKey, same: boolean) => void }) {
  const step = useStudio((state) => state.step);
  const setStep = useStudio((state) => state.setStep);
  const flagged = useMemo(() => new Set([...issues.keys()].map((path) => STEP_FOR_ROOT[path.split(".")[0]!])), [issues]);
  const index = DOCK_STEPS.findIndex((item) => item.key === step);

  return (
    <nav aria-label="Design steps" className="relative grid" style={{ gridTemplateColumns: `repeat(${DOCK_STEPS.length}, minmax(0, 1fr))` }}>
      {index >= 0 ? (
        <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: `${100 / DOCK_STEPS.length}%` }}>
          <motion.span aria-hidden initial={false} animate={{ x: `${index * 100}%` }} transition={SPRING} className="block h-full rounded-[22px] bg-invert-bg shadow-[0_3px_10px_rgb(23_49_42/0.3)]" />
        </div>
      ) : null}
      {DOCK_STEPS.map((item, position) => {
        const StepIcon = DOCK_ICONS[item.key];
        const active = item.key === step;
        return (
          <motion.button
            key={item.key}
            type="button"
            aria-current={active ? "step" : undefined}
            whileTap={{ scale: 0.93 }}
            transition={PRESS}
            onClick={() => {
              if (!active) setStep(item.key);
              onPick?.(item.key, active);
            }}
            className={`relative grid h-[54px] place-content-center justify-items-center gap-0.5 rounded-[22px] text-center leading-none transition-colors duration-200 ${compact ? "text-[11px] tracking-[-0.015em]" : "min-w-[92px] text-[12px]"} ${active ? "font-medium text-invert-fg" : "text-fg hover:bg-fg/[0.07]"}`}
          >
            <StepIcon size={20} weight={active ? "fill" : "regular"} aria-hidden />
            <span>
              <span className="sr-only">Step {position + 1} of {DOCK_STEPS.length}: </span>
              {item.label}
            </span>
            {flagged.has(item.key) ? (
              <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-danger">
                <span className="sr-only">Needs attention</span>
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </nav>
  );
}

function StepPanel({ issues, savedKey, scroller, bottomSpace, onMeasure }: { issues: Issues; savedKey: number; scroller?: RefObject<HTMLDivElement | null>; bottomSpace?: number; onMeasure?: (height: number) => void }) {
  const spec = useStudio((state) => state.spec);
  const step = useStudio((state) => state.step);
  const section = useStudio((state) => state.section);
  const setStep = useStudio((state) => state.setStep);
  const setSection = useStudio((state) => state.setSection);
  const localScroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const chrome = useRef<HTMLDivElement>(null);
  const index = DOCK_STEPS.findIndex((item) => item.key === step);
  const current = STEPS.find((item) => item.key === step)!;
  const sections: readonly { key: SectionKey; label: string }[] = current.sections;
  const next = index >= 0 ? DOCK_STEPS[index + 1] : undefined;
  const previous = index > 0 ? DOCK_STEPS[index - 1] : undefined;
  const scrollerRef = scroller ?? localScroller;

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 });
  }, [step, section, scrollerRef]);

  useEffect(() => {
    const content = inner.current;
    const fixed = chrome.current;
    if (!onMeasure || !content || !fixed) return;
    const report = () => onMeasure(content.offsetHeight + fixed.offsetHeight);
    const observer = new ResizeObserver(report);
    observer.observe(content);
    observer.observe(fixed);
    report();
    return () => observer.disconnect();
  }, [onMeasure]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={chrome} className="shrink-0">
        <div className="grid gap-2.5 px-4 pb-3 pt-0 lg:pt-4">
          <div className={`flex items-baseline justify-between gap-4 ${step === "saved" ? "" : "max-lg:sr-only"}`}>
            <h2 className="font-display text-[24px] leading-none tracking-[-0.01em] lg:text-[28px]">{current.label}</h2>
            {index >= 0 ? <p className={`text-[13px] tabular-nums ${SECONDARY}`}>{index + 1} of {DOCK_STEPS.length}</p> : null}
          </div>
          {sections.length > 1 ? <Segments label={`${current.label} sections`} showLabel={false} value={section} segments={sections.map((item) => ({ value: item.key, label: item.label }))} onChange={setSection} /> : null}
        </div>
      </div>
      <div ref={scrollerRef} data-sheet-body className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [scrollbar-width:thin] lg:[mask-image:linear-gradient(to_bottom,black_calc(100%-18px),transparent)]" style={{ paddingBottom: bottomSpace }}>
        <div ref={inner} className="px-4 pb-4">
          <motion.div key={`${step}/${section}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
            {step === "saved" ? <SavedDesigns refreshKey={savedKey} /> : <SectionView section={section} spec={spec} issues={issues} />}
          </motion.div>
          {index >= 0 ? (
            <div className="mt-4 flex items-center justify-between gap-2">
              {previous ? (
                <motion.button type="button" aria-label={`Back to ${previous.label}`} whileTap={{ scale: 0.94 }} transition={PRESS} onClick={() => setStep(previous.key)} className="grid h-11 w-11 place-items-center rounded-full border border-fg/15 transition-colors duration-200 hover:bg-fg/10">
                  <ArrowLeft size={16} />
                </motion.button>
              ) : <span />}
              {next ? (
                <motion.button type="button" whileTap={{ scale: 0.96 }} transition={PRESS} onClick={() => setStep(next.key)} className="flex min-h-11 items-center gap-2 rounded-full border border-fg/15 px-5 text-[13px] font-medium transition-colors duration-200 hover:bg-fg/10">
                  Next: {next.label}
                  <ArrowRight size={14} />
                </motion.button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DesktopLayout({ issues, savedKey, actions, nameError }: { issues: Issues; savedKey: number; actions: DesignActions; nameError?: string }) {
  const webgl = useWebgl();
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const step = useStudio((state) => state.step);

  return (
    <>
      <div className="absolute inset-0 -translate-x-[200px]"><Stage webgl={webgl} /></div>
      <div className="absolute left-4 top-[84px] z-10"><Tools /></div>
      {webgl.available ? (
        <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2"><ViewPicker vertical /></div>
      ) : null}
      <div className="absolute bottom-4 left-4 right-[444px] z-10 flex justify-center">
        <div className={`glass-panel rounded-[28px] p-1 ${REFRACT}`}><Dock issues={issues} /></div>
      </div>
      <aside aria-label="Design controls" className="pointer-events-none absolute bottom-4 right-4 top-[84px] z-10 flex w-[420px] flex-col justify-end gap-2">
        <motion.div
          key={step === "saved" ? "saved" : "steps"}
          initial={false}
          animate={{ height: panelHeight ?? "100%" }}
          transition={SPRING}
          className="glass-panel pointer-events-auto min-h-0 shrink overflow-hidden rounded-[28px]"
        >
          <StepPanel issues={issues} savedKey={savedKey} onMeasure={setPanelHeight} />
        </motion.div>
        <div className="pointer-events-auto shrink-0"><SummaryCard actions={actions} nameError={nameError} /></div>
      </aside>
    </>
  );
}

function rubberband(overshoot: number, dimension: number) {
  const constant = 0.55;
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function project(velocity: number) {
  return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION);
}

function useViewportHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const sync = () => setHeight(window.innerHeight);
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  return height;
}

type Snaps = { full: number; half: number; peek: number };

function useSheet(viewport: number) {
  const reduced = useReducedMotion();
  const visibleFull = Math.round(viewport * FULL_SHARE);
  const visiblePeek = FOOTER_PX + PEEK_PX;
  const snaps = useMemo<Snaps>(() => ({ full: 0, half: Math.max(0, visibleFull - Math.round(viewport * HALF_SHARE)), peek: Math.max(0, visibleFull - visiblePeek) }), [viewport, visibleFull, visiblePeek]);
  const y = useMotionValue(snaps.half);
  const [snap, setSnap] = useState<keyof Snaps>("half");
  const motionRef = useRef<AnimationPlaybackControls | null>(null);
  const gesture = useRef<{ origin: number; start: number; samples: { y: number; t: number }[] } | null>(null);

  const settle = useCallback(
    (target: keyof Snaps, velocity = 0) => {
      setSnap(target);
      motionRef.current?.stop();
      if (reduced) {
        y.set(snaps[target]);
        return;
      }
      motionRef.current = animate(y, snaps[target], { type: "spring", bounce: Math.abs(velocity) > 700 ? 0.14 : 0, visualDuration: 0.36, velocity });
    },
    [reduced, snaps, y],
  );

  const snapRef = useRef(snap);
  useEffect(() => {
    snapRef.current = snap;
  }, [snap]);
  useEffect(() => {
    y.jump(snaps[snapRef.current]);
  }, [snaps, y]);

  const begin = useCallback(
    (pointerY: number) => {
      motionRef.current?.stop();
      gesture.current = { origin: y.get(), start: pointerY, samples: [{ y: pointerY, t: performance.now() }] };
    },
    [y],
  );

  const track = useCallback(
    (pointerY: number) => {
      const active = gesture.current;
      if (!active) return;
      const raw = active.origin + pointerY - active.start;
      const next = raw < 0 ? -rubberband(-raw, RUBBER_PX) : raw > snaps.peek ? snaps.peek + rubberband(raw - snaps.peek, RUBBER_PX) : raw;
      y.set(next);
      const now = performance.now();
      active.samples.push({ y: pointerY, t: now });
      while (active.samples.length > 2 && now - active.samples[0]!.t > HISTORY_MS) active.samples.shift();
    },
    [snaps.peek, y],
  );

  const release = useCallback(() => {
    const active = gesture.current;
    gesture.current = null;
    if (!active) return;
    const first = active.samples[0]!;
    const last = active.samples[active.samples.length - 1]!;
    const elapsed = last.t - first.t;
    const velocity = elapsed > 0 ? ((last.y - first.y) / elapsed) * 1000 : 0;
    const landing = y.get() + project(velocity);
    const order: (keyof Snaps)[] = ["full", "half", "peek"];
    const target = order.reduce((best, key) => (Math.abs(snaps[key] - landing) < Math.abs(snaps[best] - landing) ? key : best), "half" as keyof Snaps);
    settle(target, velocity);
  }, [settle, snaps, y]);

  return { y, snap, snaps, settle, begin, track, release, visibleFull, visiblePeek, gesture };
}

function useSheetTouch(sheet: RefObject<HTMLDivElement | null>, controls: ReturnType<typeof useSheet>) {
  const { y, begin, track, release } = controls;
  useEffect(() => {
    const root = sheet.current;
    if (!root) return;
    let mode: "pending" | "sheet" | "pass" = "pass";
    let startX = 0;
    let startY = 0;
    let scroller: HTMLElement | null = null;

    const onStart = (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (event.touches.length !== 1 || target.closest("[data-sheet-handle]")) {
        mode = "pass";
        return;
      }
      const touch = event.touches[0]!;
      startX = touch.clientX;
      startY = touch.clientY;
      scroller = target.closest<HTMLElement>("[data-sheet-body]");
      mode = "pending";
    };

    const onMove = (event: TouchEvent) => {
      if (mode === "pass") return;
      const touch = event.touches[0]!;
      if (mode === "pending") {
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        if (Math.hypot(dx, dy) < 6) return;
        const expanding = dy < 0 && y.get() > 1;
        const collapsing = dy > 0 && (!scroller || scroller.scrollTop <= 0);
        if (Math.abs(dx) > Math.abs(dy) || !(expanding || collapsing || !scroller) || !event.cancelable) {
          mode = "pass";
          return;
        }
        mode = "sheet";
        begin(touch.clientY);
      }
      event.preventDefault();
      track(touch.clientY);
    };

    const onEnd = () => {
      if (mode === "sheet") release();
      mode = "pass";
    };

    root.addEventListener("touchstart", onStart, { passive: true });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd);
    root.addEventListener("touchcancel", onEnd);
    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, [begin, release, sheet, track, y]);
}

function SheetHandle({ controls }: { controls: ReturnType<typeof useSheet> }) {
  const { snap, settle, begin, track, release } = controls;
  const moved = useRef(0);
  const origin = useRef(0);
  const cycle = () => settle(snap === "peek" ? "half" : snap === "half" ? "full" : "peek");

  const onDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    moved.current = 0;
    origin.current = event.clientY;
    begin(event.clientY);
  };
  const onMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    moved.current = Math.max(moved.current, Math.abs(event.clientY - origin.current));
    track(event.clientY);
  };
  const onUp = () => release();

  return (
    <button
      type="button"
      data-sheet-handle
      aria-label={snap === "full" ? "Show more of the piece" : "Show more of the controls"}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(event) => {
        if (event.detail === 0 || moved.current < 4) cycle();
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          settle(snap === "peek" ? "half" : "full");
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          settle(snap === "full" ? "half" : "peek");
        }
      }}
      className="-mb-1.5 grid h-11 w-full cursor-grab touch-none place-items-center active:cursor-grabbing"
    >
      <span aria-hidden className="block h-[5px] w-10 rounded-full bg-fg/35" />
    </button>
  );
}

function useStageMotion(y: MotionValue<number>, viewport: number, snaps: Snaps, visibleFull: number, visiblePeek: number) {
  const stageHeight = viewport - visiblePeek;
  const centerOf = (visible: number) => NAV_BOTTOM_PX + (viewport - visible - NAV_BOTTOM_PX) / 2;
  const home = stageHeight / 2;
  const halfVisible = visibleFull - snaps.half;
  const fit = (visible: number) => Math.min(1, (viewport - visible - NAV_BOTTOM_PX + 28) / (stageHeight * 0.62));
  const input = [snaps.full, snaps.half, snaps.peek];
  const stageY = useTransform(y, input, [centerOf(visibleFull) - home, centerOf(halfVisible) - home, centerOf(visiblePeek) - home]);
  const stageScale = useTransform(y, input, [fit(visibleFull), fit(halfVisible), PEEK_STAGE_SCALE]);
  return { stageHeight, stageY, stageScale };
}

function MobileLayout({ issues, savedKey, actions, nameError }: { issues: Issues; savedKey: number; actions: DesignActions; nameError?: string }) {
  const webgl = useWebgl();
  const viewport = useViewportHeight();
  const controls = useSheet(viewport);
  const { y, snap, snaps, settle, visibleFull, visiblePeek } = controls;
  const sheet = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { stageHeight, stageY, stageScale } = useStageMotion(y, viewport, snaps, visibleFull, visiblePeek);
  const pickerOpacity = useTransform(y, [snaps.full, snaps.half], [0, 1]);
  useSheetTouch(sheet, controls);

  return (
    <>
      <motion.div className="absolute inset-x-0 top-0" style={{ height: stageHeight, y: stageY, scale: stageScale }}>
        <Stage webgl={webgl} />
      </motion.div>
      <div className="absolute left-2 top-[72px] z-10"><Tools /></div>
      <motion.aside
        ref={sheet}
        aria-label="Design controls"
        className="fixed inset-x-2 bottom-0 z-10 mx-auto max-w-[620px]"
        style={{ height: visibleFull, y }}
      >
        {webgl.available ? (
          <motion.div className="absolute right-0 top-[-56px]" style={{ opacity: pickerOpacity }}>
            <ViewPicker />
          </motion.div>
        ) : null}
        <div className="glass-panel flex h-full flex-col overflow-hidden rounded-t-[28px]">
          <div className="shrink-0">
            <SheetHandle controls={controls} />
            <div className="pb-2.5"><SheetSummary actions={actions} nameError={nameError} /></div>
          </div>
          <StepPanel issues={issues} savedKey={savedKey} scroller={scroller} bottomSpace={snaps[snap] + FOOTER_PX + 8} />
        </div>
      </motion.aside>
      <div className="glass-panel fixed inset-x-2 bottom-0 z-20 mx-auto grid max-w-[620px] content-start gap-1.5 rounded-t-[28px] p-1.5" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
        <Dock
          issues={issues}
          compact
          onPick={(_, same) => {
            if (same) settle(snap === "peek" ? "half" : "peek");
            else if (snap === "peek") settle("half");
          }}
        />
        <BagBar actions={actions} />
      </div>
    </>
  );
}

function Workspace() {
  const spec = useStudio((state) => state.spec);
  const undo = useStudio((state) => state.undo);
  const redo = useStudio((state) => state.redo);
  const desktop = useIsDesktop();
  const [savedKey, setSavedKey] = useState(0);
  const issues = useMemo(() => collectIssues(spec), [spec]);
  const blocked = issues.size ? [...issues.values()][0]! : null;
  const actions = useDesignActions(blocked, () => setSavedKey((key) => key + 1));
  useLockedPage();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement;
      if (target.matches("input:not([type=range]), textarea")) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const Layout = desktop ? DesktopLayout : MobileLayout;
  return (
    <>
      <div className="fixed inset-0 z-[25] overflow-hidden bg-[radial-gradient(85%_75%_at_38%_46%,var(--bg),var(--surface)_58%,var(--line))]">
        <Layout issues={issues} savedKey={savedKey} actions={actions} nameError={issues.get("name")} />
      </div>
    </>
  );
}

function resolveStart(initial: StudioInitial, notice: string | null) {
  const draft = readDraft();
  const { begin, setChoosing } = useStudio.getState();
  if (notice) {
    setChoosing();
    return;
  }
  if (initial) {
    const sameColor = draft?.spec.panels.primary.color === initial.spec.panels.primary.color;
    const fromLinkColor = initial.source.split(":").length > 2;
    const resumes = draft && (draft.source === initial.source || (initial.designId !== null && draft.designId === initial.designId)) && (!fromLinkColor || sameColor);
    if (resumes) restoreDraft(draft);
    else begin({ spec: initial.spec, designId: initial.owned ? initial.designId : null, source: initial.source, saved: initial.owned });
    return;
  }
  if (draft) restoreDraft(draft);
  else setChoosing();
}

export function Studio({ initial, notice }: { initial: StudioInitial; notice: string | null }) {
  const phase = useStudio((state) => state.phase);
  const startKey = initial?.source ?? null;
  const startRef = useRef({ initial, notice });
  const handled = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    startRef.current = { initial, notice };
  });

  useEffect(() => {
    const family = script.style.fontFamily;
    document.body.style.setProperty("--font-script", family);
    return () => {
      document.body.style.removeProperty("--font-script");
    };
  }, []);

  useEffect(() => {
    if (handled.current === startKey) return;
    const firstRun = handled.current === undefined;
    handled.current = startKey;
    const current = useStudio.getState();
    if (!firstRun && (startKey === null || startKey === current.source || startKey === `design:${current.designId}`)) return;
    resolveStart(startRef.current.initial, startRef.current.notice);
  }, [startKey]);

  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useStudio.subscribe((state, previous) => {
      if (state.spec === previous.spec && state.designId === previous.designId && state.savedJson === previous.savedJson && state.phase === previous.phase) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(writeDraft, 250);
    });
    const flush = () => writeDraft();
    window.addEventListener("pagehide", flush);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      writeDraft();
    };
  }, []);

  if (phase === "loading") {
    return (
      <div className="grid h-dvh place-items-center pt-[68px]" role="status">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Preparing the atelier</p>
      </div>
    );
  }
  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      {phase === "choosing" ? <StartingPoints notice={notice} /> : <Workspace />}
    </MotionConfig>
  );
}
