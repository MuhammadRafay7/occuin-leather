"use client";

import { Cube, PaperPlaneTilt, PenNib, SlidersHorizontal, type Icon } from "@phosphor-icons/react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SPRING, Segments } from "@/components/studio/controls";
import { StudioRatesProvider, type StudioRates } from "@/components/studio/rates";
import { AskTeam } from "./ask-team";
import { Board } from "./board";
import { MakeabilityPanel, useMakeability } from "./makeability-panel";
import { Confirmation, DetailsPanel, EstimateBar, PiecePanel, SavedPanel, SendPanel } from "./panels";
import { PastDesigns, PastDesignsPrompt } from "./past-designs";
import { PiecesList } from "./pieces";
import { Preview } from "./preview";
import type { BespokeDesign } from "@/lib/bespoke/design";
import { useCreator, writeDraft, type Tool } from "./store";
import { ToolRail, ToolStrip } from "./tools";
import { GLASS_PANEL } from "./ui";

const STAGE = "fixed inset-0 z-[25] overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#21443a,var(--invert-bg)_52%,#10241e)] text-fg";
const DESKTOP_QUERY = "(min-width: 1024px)";
const RESTORED_NOTICE_MS = 6000;

type SideTab = "piece" | "details" | "saved" | "ask" | "send";
type Initial = { design: BespokeDesign; id: string | null; name: string } | null;
type MobileTab = "draw" | "3d" | "details" | "send";

const MOBILE_TABS: { key: MobileTab; label: string; icon: Icon }[] = [
  { key: "draw", label: "Draw", icon: PenNib },
  { key: "3d", label: "3D", icon: Cube },
  { key: "details", label: "Details", icon: SlidersHorizontal },
  { key: "send", label: "Send", icon: PaperPlaneTilt },
];

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

function useDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return desktop;
}

const TOOL_KEYS: Record<string, Tool> = { v: "select", h: "hand", p: "draw", t: "tube", a: "add", f: "hardware", m: "measure", r: "reflect" };

export const SHORTCUTS: [string, string][] = [
  ["V", "Select"],
  ["H", "Pan the board"],
  ["P", "Draw a piece"],
  ["T", "Draw a handle"],
  ["A", "Add a point on an edge"],
  ["F", "Place a fitting"],
  ["M", "Measure"],
  ["R", "Reflect across a line"],
  ["C", "Switch point between sharp and curved"],
  ["[ and ]", "Step through points"],
  ["Arrow keys", "Nudge, hold Shift for bigger steps"],
  ["Delete", "Delete the point, fitting or selection"],
  ["Enter", "Close the shape or finish the handle"],
  ["Esc", "Stop drawing"],
  ["Shift + click", "Add to the selection"],
  ["Drag on empty board", "Select with a marquee"],
  ["Ctrl + A", "Select all"],
  ["Ctrl + C, X, V", "Copy, cut, paste"],
  ["Ctrl + D", "Duplicate"],
  ["Ctrl + Z", "Undo"],
  ["Ctrl + Shift + Z", "Redo"],
  ["?", "Show this list"],
];

function ShortcutHelp() {
  const open = useCreator((state) => state.helpOpen);
  const setHelp = useCreator((state) => state.setHelp);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[#0d1f19]/55 p-4" onClick={() => setHelp(false)}>
      <section role="dialog" aria-labelledby="keys-title" className={`${GLASS_PANEL} grid max-h-full w-full max-w-[620px] gap-3 overflow-y-auto rounded-[28px] p-6`} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="keys-title" className="font-display text-[28px] leading-none">Keyboard shortcuts</h2>
          <button type="button" autoFocus onClick={() => setHelp(false)} className="min-h-11 rounded-full px-4 text-[13px] font-medium hover:bg-fg/10">Close</button>
        </div>
        <p className="text-[13px] text-fg/75">On a phone every action is a button in the tool strip. Pinch to zoom, and use two fingers to move around.</p>
        <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {SHORTCUTS.map(([keys, action]) => (
            <div key={keys} className="flex items-baseline justify-between gap-3 border-b border-fg/10 py-1">
              <dd>{action}</dd>
              <dt className="shrink-0 font-medium">{keys}</dt>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input:not([type=range]), textarea, select")) return;
      const key = event.key.toLowerCase();
      const store = useCreator.getState();
      if (event.key === "?") {
        store.setHelp(!store.helpOpen);
        return;
      }
      if (event.key === "Escape" && store.helpOpen) {
        store.setHelp(false);
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) {
        const tool = TOOL_KEYS[key];
        if (tool && !event.altKey) store.setTool(tool);
        return;
      }
      const actions: Record<string, () => void> = {
        z: () => (event.shiftKey ? store.redo() : store.undo()),
        y: store.redo,
        c: store.copy,
        x: store.cut,
        v: store.paste,
        a: store.selectAll,
        d: () => {
          store.duplicateSelection();
        },
      };
      const action = actions[key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function useAutosave() {
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useCreator.subscribe((state, previous) => {
      if (state.design === previous.design) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(writeDraft, 300);
    });
    window.addEventListener("pagehide", writeDraft);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      window.removeEventListener("pagehide", writeDraft);
      writeDraft();
    };
  }, []);
}

function StartOver({ dark = false }: { dark?: boolean }) {
  const startOver = useCreator((state) => state.startOver);
  const hasPieces = useCreator((state) => state.design.pieces.length > 0);
  const [asking, setAsking] = useState(false);
  const tone = dark ? "text-fg" : "text-invert-fg";
  if (!hasPieces) return null;
  if (asking) {
    return (
      <span className={`flex items-center gap-1 text-[12px] ${tone}`}>
        <span className="px-2">Clear this design?</span>
        <button type="button" className="min-h-9 rounded-full bg-bg px-3 font-medium text-fg" onClick={() => { startOver(); setAsking(false); }}>Clear</button>
        <button type="button" className="min-h-9 rounded-full px-2 underline underline-offset-2" onClick={() => setAsking(false)}>Keep</button>
      </span>
    );
  }
  return <button type="button" className={`min-h-9 rounded-full px-2 text-[12px] underline underline-offset-2 hover:opacity-80 ${tone}`} onClick={() => setAsking(true)}>Start over</button>;
}

function Title() {
  return (
    <h1 className="whitespace-nowrap px-2 pt-1 font-display text-[21px] leading-none sm:text-[25px] tracking-[-0.01em] text-invert-fg">Create from scratch</h1>
  );
}

function SidePanel() {
  const [tab, setTab] = useState<SideTab>("piece");
  const flagged = useMakeability().length;
  return (
    <div className={`${GLASS_PANEL} flex min-h-0 flex-1 flex-col rounded-[28px]`}>
      <div className="shrink-0 px-3 pt-3">
        <Segments<SideTab>
          label="Panel"
          showLabel={false}
          value={tab}
          segments={[{ value: "piece", label: "Piece" }, { value: "details", label: "Details" }, { value: "saved", label: "Saved" }, { value: "ask", label: "Ask" }, { value: "send", label: flagged ? `Send ${flagged}` : "Send" }]}
          onChange={setTab}
        />
      </div>
      <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4 [scrollbar-width:thin]">
        {tab === "piece" ? <PiecePanel /> : tab === "details" ? <DetailsPanel /> : tab === "saved" ? <div className="grid gap-7"><SavedPanel /><PastDesigns /></div> : tab === "ask" ? <AskTeam /> : <div className="grid gap-6"><MakeabilityPanel /><SendPanel /></div>}
      </div>
    </div>
  );
}

function Desktop() {
  return (
    <div className="absolute inset-x-3 bottom-3 top-[80px] grid grid-cols-[236px_minmax(0,1fr)_340px] gap-3 xl:grid-cols-[248px_minmax(0,1fr)_384px]">
      <div className="flex min-h-0 flex-col gap-3">
        <Title />
        <aside aria-label="Drawing tools" className={`${GLASS_PANEL} shrink-0 rounded-[28px] p-2.5`}><ToolRail /></aside>
        <aside aria-label="Pieces" className={`${GLASS_PANEL} min-h-0 flex-1 rounded-[28px] p-2.5`}><PiecesList /></aside>
        <div className="-my-1.5 flex h-9 shrink-0 items-center"><StartOver /></div>
      </div>
      <Board />
      <div className="flex min-h-0 flex-col gap-3">
        <div className="h-[37%] min-h-[220px] shrink-0"><Preview /></div>
        <SidePanel />
        <div className={`${GLASS_PANEL} shrink-0 rounded-[24px] px-4 py-2.5`}><EstimateBar /></div>
      </div>
    </div>
  );
}

function Scroller({ children }: { children: ReactNode }) {
  return (
    <div className={`${GLASS_PANEL} h-full touch-pan-y overflow-y-auto overscroll-contain rounded-[24px] p-4`}>
      {children}
    </div>
  );
}

function Mobile() {
  const [tab, setTab] = useState<MobileTab>("draw");
  return (
    <div className="absolute inset-x-1.5 bottom-0 top-[68px] flex flex-col gap-1.5" style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1">
        {tab === "draw" ? (
          <div className="flex h-full flex-col gap-1.5">
            <div className="min-h-0 flex-1"><Board /></div>
            <div className={`${GLASS_PANEL} shrink-0 rounded-[24px]`}><ToolStrip /></div>
          </div>
        ) : null}
        {tab === "3d" ? (
          <div className="flex h-full flex-col gap-1.5">
            <div className="min-h-0 flex-1"><Preview /></div>
            <div className={`${GLASS_PANEL} shrink-0 rounded-[24px] px-4 py-2.5`}><EstimateBar /></div>
          </div>
        ) : null}
        {tab === "details" ? (
          <Scroller>
            <div className="grid gap-7">
              <div className="max-h-[280px]"><PiecesList /></div>
              <div className="flex justify-end"><StartOver dark /></div>
              <PiecePanel />
              <hr className="border-fg/15" />
              <DetailsPanel />
              <hr className="border-fg/15" />
              <SavedPanel />
              <hr className="border-fg/15" />
              <PastDesigns />
            </div>
          </Scroller>
        ) : null}
        {tab === "send" ? (
          <Scroller>
            <div className="grid gap-5">
              <EstimateBar />
              <MakeabilityPanel onPick={() => setTab("draw")} />
              <SendPanel />
              <hr className="border-fg/15" />
              <AskTeam />
            </div>
          </Scroller>
        ) : null}
      </div>
      <nav className={`${GLASS_PANEL} shrink-0 rounded-[24px] p-1`}>
        <div role="tablist" aria-label="Design steps" className="grid grid-cols-4">
          {MOBILE_TABS.map(({ key, label, icon: TabIcon }) => {
            const active = key === tab;
            return (
              <button
                key={key}
                id={`tab-${key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={`grid h-[52px] place-content-center justify-items-center gap-0.5 rounded-[20px] text-[11px] font-medium transition-colors duration-200 ${active ? "bg-invert-bg text-invert-fg" : "text-fg"}`}
              >
                <TabIcon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Creator({ initial = null, rates }: { initial?: Initial; rates: StudioRates }) {
  return (
    <StudioRatesProvider rates={rates}>
      <CreatorStage initial={initial} />
    </StudioRatesProvider>
  );
}

function CreatorStage({ initial }: { initial: Initial }) {
  const phase = useCreator((state) => state.phase);
  const start = useCreator((state) => state.start);
  const sent = useCreator((state) => state.sent);
  const restored = useCreator((state) => state.restored);
  const desktop = useDesktop();
  const [showRestored, setShowRestored] = useState(true);
  useLockedPage();
  useShortcuts();
  useAutosave();

  useEffect(() => {
    start(initial);
  }, [start, initial]);

  useEffect(() => {
    if (!restored) return;
    const timer = window.setTimeout(() => setShowRestored(false), RESTORED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [restored]);

  const ready = phase === "ready" && desktop !== null;

  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      <div className={STAGE}>
        {!ready ? (
          <div className="grid h-full place-items-center" role="status">
            <p className="text-sm text-invert-fg/85">Loading the board</p>
          </div>
        ) : sent ? (
          <Confirmation reference={sent.reference} link={sent.link} />
        ) : desktop ? (
          <Desktop />
        ) : (
          <Mobile />
        )}
        <AnimatePresence>
          {ready && !sent && restored && showRestored ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full bg-bg px-4 py-1.5 text-[13px] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]">
              <span className="whitespace-nowrap">We kept your draft on this device.</span>
              <button type="button" className="min-h-9 font-medium underline underline-offset-2" onClick={() => setShowRestored(false)}>OK</button>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {ready && !sent ? <PastDesignsPrompt skip={Boolean(initial)} /> : null}
        <ShortcutHelp />
        <Link href="/studio" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[72px] focus:z-20 focus:rounded-full focus:bg-bg focus:px-3 focus:py-1.5">Back to the studio</Link>
      </div>
    </MotionConfig>
  );
}
