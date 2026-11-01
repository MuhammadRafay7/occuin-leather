"use client";

import type { BespokeDesign } from "@/lib/bespoke/design";
import { Stage } from "./stage";

export function DesignStage({ design }: { design: BespokeDesign }) {
  return (
    <div className="aspect-[4/3] w-full">
      <Stage design={design} />
    </div>
  );
}
