"use client";

import { useDeferredValue } from "react";
import { LIMITS } from "@/lib/bespoke/design";
import { Stage, StageMessage } from "./stage";
import { useCreator } from "./store";
import { GLASS_PILL } from "./ui";

export function Preview() {
  const live = useCreator((state) => state.design);
  const design = useDeferredValue(live);
  const update = useCreator((state) => state.updateDesign);
  const hasPiece = live.pieces.some((piece) => (piece.closed || piece.kind === "tube") && piece.visible && !piece.holeOf);

  return (
    <Stage design={design} empty={hasPiece ? null : <StageMessage title="Your piece appears here" body="Close a shape on the board to see it in leather." />}>
      <label className={`${GLASS_PILL} absolute inset-x-2 bottom-2 flex h-11 items-center gap-3 px-4 text-[13px] font-medium`}>
        Depth
        <input
          type="range"
          min={0}
          max={LIMITS.depthMm}
          step={5}
          value={live.depth}
          aria-valuetext={live.depth ? `${live.depth} millimetres` : "Flat"}
          onChange={(event) => update({ depth: Number(event.target.value) }, "depth")}
          className="h-6 min-w-0 flex-1 cursor-pointer accent-invert-bg"
        />
        <span className="w-[52px] text-right font-normal tabular-nums">{live.depth ? `${live.depth} mm` : "Flat"}</span>
      </label>
    </Stage>
  );
}
