import type { BespokeDesign } from "@/lib/bespoke/design";
import { checkDesign } from "@/lib/bespoke/rules";
import { Panel, Tag } from "../../_components/ui";

export function MakeabilitySection({ design }: { design: BespokeDesign }) {
  const findings = checkDesign(design);
  const names = new Map(design.pieces.map((piece) => [piece.id, piece.name]));
  return (
    <Panel title={`Can it be made? (${findings.length})`}>
      <p className="mb-2 text-muted">A rough guide. The workshop makes the final call.</p>
      {findings.length ? (
        <ul className="adm-rows" data-testid="admin-makeability">
          {findings.map((finding) => (
            <li key={finding.id} className="py-2">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Tag tone={finding.level === "blocker" ? "danger" : "warn"}>{finding.level === "blocker" ? "Problem" : "Check"}</Tag>
                {finding.title}
              </p>
              <p className="text-muted">{names.get(finding.pieceId) ?? "Design"}: {finding.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p data-testid="admin-makeability">Nothing flagged.</p>
      )}
    </Panel>
  );
}
