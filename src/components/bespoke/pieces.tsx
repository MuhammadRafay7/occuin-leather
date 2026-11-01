"use client";

import { ArrowDown, ArrowUp, Copy, Eye, EyeSlash, Plus, Trash } from "@phosphor-icons/react";
import { LeatherSample } from "@/components/studio/controls";
import { LIMITS } from "@/lib/bespoke/design";
import { bodyOf, layerOrder } from "@/lib/bespoke/outline";
import { useCreator } from "./store";
import { ICON_BUTTON } from "./ui";

export function PiecesList() {
  const design = useCreator((state) => state.design);
  const selectedId = useCreator((state) => state.selectedId);
  const others = useCreator((state) => state.others);
  const selectPiece = useCreator((state) => state.selectPiece);
  const toggleInSelection = useCreator((state) => state.toggleInSelection);
  const updatePiece = useCreator((state) => state.updatePiece);
  const duplicatePiece = useCreator((state) => state.duplicatePiece);
  const removePiece = useCreator((state) => state.removePiece);
  const moveLayer = useCreator((state) => state.moveLayer);
  const setTool = useCreator((state) => state.setTool);
  const activeView = useCreator((state) => state.activeView);
  const front = [...layerOrder(design.pieces.filter((piece) => piece.view === activeView))].reverse();
  const body = bodyOf(design);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 pb-1">
        <h2 className="font-display text-[20px] leading-none">Pieces</h2>
        <button
          type="button"
          disabled={design.pieces.length >= LIMITS.pieces}
          onClick={() => {
            setTool("draw");
            selectPiece(null);
          }}
          className="flex min-h-10 items-center gap-1 rounded-full px-3 text-[13px] font-medium transition-colors duration-200 hover:bg-fg/10 disabled:opacity-40"
        >
          <Plus size={14} weight="bold" aria-hidden />
          New
        </button>
      </div>
      {front.length ? (
        <ul aria-label="Pieces, front first" className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          {front.map((piece, index) => {
            const active = piece.id === selectedId || others.includes(piece.id);
            return (
              <li key={piece.id} className={`rounded-[16px] transition-colors duration-200 ${active ? "bg-invert-bg/10 ring-1 ring-invert-bg/40" : ""}`}>
                <div className="flex items-center">
                  <button type="button" aria-pressed={active} onClick={(event) => (event.shiftKey || event.metaKey || event.ctrlKey ? toggleInSelection(piece.id) : selectPiece(piece.id))} className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[16px] px-2 text-left text-[13px] font-medium">
                    <LeatherSample finish={piece.finish} color={piece.color} className="h-6 w-6 shrink-0 rounded-[7px]" />
                    <span className="truncate">{piece.name}</span>
                    {piece === body && piece.name !== "Body" ? <span className="shrink-0 rounded-full bg-fg/10 px-1.5 text-[11px] font-medium">Body</span> : null}
                    {piece.holeOf ? <span className="shrink-0 rounded-full bg-fg/10 px-1.5 text-[11px] font-medium">Cut-out</span> : null}
                    {piece.kind === "tube" ? <span className="shrink-0 rounded-full bg-fg/10 px-1.5 text-[11px] font-medium">Handle</span> : null}
                  </button>
                  <button
                    type="button"
                    aria-label={piece.visible ? `Hide ${piece.name}` : `Show ${piece.name}`}
                    aria-pressed={!piece.visible}
                    title={piece.visible ? "Hide" : "Show"}
                    onClick={() => updatePiece(piece.id, { visible: !piece.visible })}
                    className={ICON_BUTTON}
                  >
                    {piece.visible ? <Eye size={16} aria-hidden /> : <EyeSlash size={16} aria-hidden />}
                  </button>
                </div>
                {piece.id === selectedId && !others.length ? (
                  <div className="flex items-center justify-between px-1 pb-1">
                    <button type="button" aria-label={`Move ${piece.name} forward`} title="Move forward" disabled={index === 0} onClick={() => moveLayer(piece.id, 1)} className={ICON_BUTTON}><ArrowUp size={16} aria-hidden /></button>
                    <button type="button" aria-label={`Move ${piece.name} back`} title="Move back" disabled={index === front.length - 1} onClick={() => moveLayer(piece.id, -1)} className={ICON_BUTTON}><ArrowDown size={16} aria-hidden /></button>
                    <button type="button" aria-label={`Duplicate ${piece.name}`} title="Duplicate" onClick={() => duplicatePiece(piece.id)} className={ICON_BUTTON}><Copy size={16} aria-hidden /></button>
                    <button type="button" aria-label={`Delete ${piece.name}`} title="Delete" onClick={() => removePiece(piece.id)} className={ICON_BUTTON}><Trash size={16} aria-hidden /></button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1 pt-1 text-[13px] leading-snug text-fg/75">Each panel of your design is its own piece. They appear here as you draw.</p>
      )}
    </div>
  );
}
