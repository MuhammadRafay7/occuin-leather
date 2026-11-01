"use client";

import { ArrowUUpLeft, ArrowUUpRight, BezierCurve, ClipboardText, Copy, Cursor, FlipHorizontal, FlipVertical, GridFour, Hand, Keyboard, MinusCircle, Package, Path, PenNib, PlusCircle, Ruler, SelectionPlus, Swatches, Wrench, type Icon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { PRESS } from "@/components/studio/controls";
import { HARDWARE, type HardwareKind } from "@/lib/bespoke/design";
import { pathData, STARTERS, starterPoints, type StarterKind } from "@/lib/bespoke/outline";
import { useCreator, useSelectedPiece, type Tool } from "./store";

const KINDS = Object.keys(STARTERS) as StarterKind[];
const HARDWARE_KINDS = Object.keys(HARDWARE) as HardwareKind[];

function ShapeGlyph({ kind }: { kind: StarterKind }) {
  return (
    <svg aria-hidden viewBox="-62 -48 124 96" className="h-6 w-8" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round">
      <path d={pathData(starterPoints(kind, 110, 80), true)} />
    </svg>
  );
}

export function ShapeButtons({ compact = false }: { compact?: boolean }) {
  const addStarter = useCreator((state) => state.addStarter);
  return (
    <>
      {KINDS.map((kind) => (
        <motion.button
          key={kind}
          type="button"
          aria-label={`Add a ${STARTERS[kind].toLowerCase()} piece`}
          title={STARTERS[kind]}
          whileTap={{ scale: 0.94 }}
          transition={PRESS}
          onClick={() => addStarter(kind)}
          className={`grid shrink-0 place-items-center rounded-[14px] transition-colors duration-200 hover:bg-fg/10 ${compact ? "h-11 w-12" : "h-10"}`}
        >
          <ShapeGlyph kind={kind} />
        </motion.button>
      ))}
    </>
  );
}

function Cell({ label, title, icon: CellIcon, pressed, disabled, onClick, strip }: { label: string; title?: string; icon: Icon; pressed?: boolean; disabled?: boolean; onClick: () => void; strip?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-label={title ?? label}
      title={title ?? label}
      aria-pressed={pressed}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={PRESS}
      onClick={onClick}
      className={`grid h-[46px] shrink-0 place-content-center justify-items-center gap-0.5 rounded-[14px] text-[10.5px] font-medium leading-none transition-colors duration-200 hover:bg-fg/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-invert-bg aria-pressed:text-invert-fg aria-pressed:hover:bg-invert-bg ${strip ? "w-[60px]" : ""}`}
    >
      <CellIcon size={18} aria-hidden />
      {label}
    </motion.button>
  );
}

function useCells(strip: boolean) {
  const tool = useCreator((state) => state.tool);
  const snap = useCreator((state) => state.snap);
  const additive = useCreator((state) => state.additive);
  const leatherView = useCreator((state) => state.leatherView);
  const mirrorDefault = useCreator((state) => state.mirror);
  const pointIndex = useCreator((state) => state.pointIndex);
  const hasClip = useCreator((state) => state.clipboard.length > 0);
  const canUndo = useCreator((state) => state.past.length > 0);
  const canRedo = useCreator((state) => state.future.length > 0);
  const store = useCreator.getState();
  const piece = useSelectedPiece();
  const point = piece && pointIndex !== null ? piece.points[pointIndex] : null;
  const toolCell = (key: Tool, label: string, icon: Icon, title?: string) => <Cell key={key} strip={strip} label={label} title={title} icon={icon} pressed={tool === key} onClick={() => store.setTool(key)} />;
  return [
    toolCell("select", "Select", Cursor),
    toolCell("hand", "Pan", Hand, "Pan the board"),
    toolCell("draw", "Draw", PenNib, "Draw a piece"),
    toolCell("tube", "Handle", Path, "Draw a handle or strap"),
    toolCell("add", "Add pt", PlusCircle, "Add point"),
    <Cell key="del" strip={strip} label="Del pt" title="Delete point" icon={MinusCircle} disabled={!point} onClick={store.deletePoint} />,
    <Cell key="curve" strip={strip} label={point?.smooth ? "Sharp" : "Curve"} title="Switch point between sharp and curved" icon={BezierCurve} pressed={Boolean(point?.smooth)} disabled={!point} onClick={store.togglePointSmooth} />,
    toolCell("hardware", "Fittings", Wrench, "Place hardware"),
    toolCell("measure", "Measure", Ruler),
    toolCell("reflect", "Reflect", FlipVertical, "Reflect the selection across a line you draw"),
    <Cell key="mirror" strip={strip} label="Mirror" title="Live mirror about the centre line" icon={FlipHorizontal} pressed={piece ? piece.mirror : mirrorDefault} onClick={store.toggleMirror} />,
    <Cell key="snap" strip={strip} label="Snap" title="Snap to grid" icon={GridFour} pressed={snap} onClick={store.toggleSnap} />,
    <Cell key="multi" strip={strip} label="Multi" title="Add to selection" icon={SelectionPlus} pressed={additive} onClick={store.toggleAdditive} />,
    <Cell key="copy" strip={strip} label="Copy" icon={Copy} disabled={!piece} onClick={store.copy} />,
    <Cell key="paste" strip={strip} label="Paste" icon={ClipboardText} disabled={!hasClip} onClick={store.paste} />,
    <Cell key="undo" strip={strip} label="Undo" icon={ArrowUUpLeft} disabled={!canUndo} onClick={store.undo} />,
    <Cell key="redo" strip={strip} label="Redo" icon={ArrowUUpRight} disabled={!canRedo} onClick={store.redo} />,
    <Cell key="leather" strip={strip} label="Leather" title="Leather preview on the board" icon={Swatches} pressed={leatherView} onClick={store.toggleLeatherView} />,
    <Cell key="keys" strip={strip} label="Keys" title="Keyboard shortcuts" icon={Keyboard} onClick={() => store.setHelp(true)} />,
  ];
}

function HardwarePicker() {
  const tool = useCreator((state) => state.tool);
  const kind = useCreator((state) => state.hardwareKind);
  const setKind = useCreator((state) => state.setHardwareKind);
  if (tool !== "hardware") return null;
  return (
    <div role="group" aria-label="Fitting" className="flex flex-wrap gap-1">
      {HARDWARE_KINDS.map((item) => (
        <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)} className="min-h-9 rounded-full border border-fg/15 px-2.5 text-[12px] font-medium aria-pressed:border-invert-bg aria-pressed:bg-invert-bg aria-pressed:text-invert-fg">{HARDWARE[item].name}</button>
      ))}
    </div>
  );
}

export function LibraryButton({ strip = false }: { strip?: boolean }) {
  const open = useCreator((state) => state.libraryOpen);
  const setLibrary = useCreator((state) => state.setLibrary);
  return (
    <button type="button" aria-pressed={open} onClick={() => setLibrary(!open)} className={`flex min-h-11 items-center justify-center gap-2 rounded-full bg-invert-bg px-4 text-[13px] font-medium text-invert-fg hover:opacity-90 ${strip ? "shrink-0" : "w-full"}`}>
      <Package size={18} aria-hidden />
      Parts library
    </button>
  );
}

export function ToolRail() {
  const cells = useCells(false);
  return (
    <div role="toolbar" aria-label="Drawing tools" className="grid gap-2">
      <LibraryButton />
      <div className="grid grid-cols-5 gap-0.5">{cells}</div>
      <HardwarePicker />
      <div className="grid grid-cols-5 border-t border-fg/10 pt-1.5"><ShapeButtons /></div>
    </div>
  );
}

export function ToolStrip() {
  const cells = useCells(true);
  return (
    <div className="grid gap-1 py-1">
      <div className="px-2 empty:hidden"><HardwarePicker /></div>
      <div role="toolbar" aria-label="Drawing tools" className="flex touch-pan-x items-center gap-0.5 overflow-x-auto overscroll-contain px-1.5 [scrollbar-width:none]">
        <LibraryButton strip />
        {cells}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-fg/20" />
        <ShapeButtons compact />
      </div>
    </div>
  );
}
