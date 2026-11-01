"use client";

import { CheckCircle, Prohibit, Warning } from "@phosphor-icons/react";
import { useDeferredValue, useMemo } from "react";
import { Group, SECONDARY } from "@/components/studio/controls";
import { checkDesign, type Finding } from "@/lib/bespoke/rules";
import { useCreator } from "./store";

export const MAKEABILITY_NOTE = "Guidance from estimates, to be confirmed by the workshop.";

export function useMakeability() {
  const design = useCreator((state) => state.design);
  const deferred = useDeferredValue(design);
  return useMemo(() => checkDesign(deferred), [deferred]);
}

function FindingRow({ finding, onPick }: { finding: Finding; onPick: (pieceId: string) => void }) {
  const blocker = finding.level === "blocker";
  const Icon = blocker ? Prohibit : Warning;
  return (
    <li>
      <button
        type="button"
        data-testid="makeability-item"
        data-level={finding.level}
        onClick={() => onPick(finding.pieceId)}
        className="grid min-h-11 w-full grid-cols-[20px_minmax(0,1fr)] gap-2 rounded-[16px] px-2.5 py-2 text-left transition-colors duration-200 hover:bg-fg/10"
      >
        <Icon size={18} weight={blocker ? "bold" : "regular"} aria-hidden className={`mt-0.5 ${blocker ? "text-danger" : ""}`} />
        <span className="grid gap-0.5">
          <span className={`text-[11px] font-medium uppercase tracking-[0.06em] ${blocker ? "text-danger" : SECONDARY}`}>{blocker ? "Must fix before sending" : "Worth a look"}</span>
          <span className="text-[13px] font-medium leading-snug">{finding.title}</span>
          <span className={`text-[12px] leading-snug ${SECONDARY}`}>{finding.fix}</span>
        </span>
      </button>
    </li>
  );
}

export function MakeabilityPanel({ onPick }: { onPick?: () => void }) {
  const findings = useMakeability();
  const hasPieces = useCreator((state) => state.design.pieces.length > 0);

  function pick(pieceId: string) {
    const { design, setView, setTool, selectPiece } = useCreator.getState();
    const piece = design.pieces.find((item) => item.id === pieceId);
    if (!piece) return;
    setTool("select");
    setView(piece.view);
    selectPiece(piece.id);
    onPick?.();
  }

  return (
    <div data-testid="makeability-panel">
      <Group title="Workshop check" note={MAKEABILITY_NOTE}>
        {findings.length ? (
          <ul aria-label="Workshop check results" className="grid gap-1">
            {findings.map((finding) => <FindingRow key={finding.id} finding={finding} onPick={pick} />)}
          </ul>
        ) : (
          <p role="status" className="flex items-start gap-2 text-[13px] leading-snug">
            <CheckCircle size={18} aria-hidden className="shrink-0" />
            {hasPieces ? "Nothing flagged so far. The workshop still reviews every design by hand." : "Draw a piece to start the check."}
          </p>
        )}
      </Group>
    </div>
  );
}
