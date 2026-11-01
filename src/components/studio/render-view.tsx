"use client";

import { useState } from "react";
import type { DesignSpec } from "@/lib/studio/spec";
import { BareScene } from "./viewport";

export function RenderView({ spec }: { spec: DesignSpec }) {
  const [ready, setReady] = useState(false);
  return (
    <div data-render-ready={ready} className="fixed inset-0 z-[100] bg-surface">
      <BareScene spec={spec} onReady={() => setReady(true)} />
    </div>
  );
}
