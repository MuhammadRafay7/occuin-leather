import type { BespokeDesign } from "@/lib/bespoke/design";
import { checkDesign } from "@/lib/bespoke/rules";
import { Section, Tag } from "../../_components/ui";

export function MakeabilitySection({ design }: { design: BespokeDesign }) {
  const findings = checkDesign(design);
  const names = new Map(design.pieces.map((piece) => [piece.id, piece.name]));
  return (
    <Section title={`Makeability check (${findings.length})`}>
      <p className="mb-2 text-sm text-muted">Guidance from estimates, to be confirmed by the workshop.</p>
      {findings.length ? (
        <ul className="grid gap-2 text-sm" data-testid="admin-makeability">
          {findings.map((finding) => (
            <li key={finding.id} className="border border-line px-3 py-2">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <Tag tone={finding.level === "blocker" ? "plain" : "muted"}>{finding.level === "blocker" ? "Blocker" : "Warning"}</Tag>
                {finding.title}
              </p>
              <p className="text-muted">{names.get(finding.pieceId) ?? "Design"}: {finding.fix}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm" data-testid="admin-makeability">Nothing flagged.</p>
      )}
    </Section>
  );
}
