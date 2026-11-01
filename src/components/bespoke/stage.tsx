"use client";

import { ImageSquare } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { Component, useRef, useState, type ReactNode } from "react";
import { useWebgl } from "@/components/studio/viewport";
import type { BespokeDesign } from "@/lib/bespoke/design";
import { GLASS_PILL } from "./ui";

export type PreviewView = "angle" | "front" | "back" | "side";
const VIEWS: { key: PreviewView; label: string }[] = [
  { key: "angle", label: "Angle" },
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "side", label: "Side" },
];

export const StageMessage = ({ title, body }: { title: string; body?: string }) => (
  <div className="absolute inset-0 grid place-items-center p-6 text-center text-[#f3ecdd]">
    <div className="grid max-w-[30ch] gap-1">
      <p className="font-display text-[22px] leading-tight">{title}</p>
      {body ? <p className="text-[13px] leading-snug text-[#f3ecdd]/85">{body}</p> : null}
    </div>
  </div>
);

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => <StageMessage title="Preparing the preview" /> });

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const Fallback = () => <StageMessage title="3D is not available here" body="This browser cannot show the preview. The pattern and every other step still work." />;

export function Stage({ design, empty, children }: { design: BespokeDesign; empty?: ReactNode; children?: ReactNode }) {
  const { available, lost } = useWebgl();
  const [view, setView] = useState({ key: "angle" as PreviewView, nonce: 0 });
  const [lookInside, setLookInside] = useState(false);
  const capture = useRef<(() => string | null) | null>(null);
  const saveImage = () => {
    const url = capture.current?.();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "occuin-design-preview.png";
    link.click();
  };
  return (
    <section aria-label="3D preview" className="relative h-full min-h-0 overflow-hidden rounded-[28px] bg-[radial-gradient(80%_75%_at_50%_42%,#2d5044,#1b382f_72%)] shadow-[inset_0_0_0_1px_rgb(243_236_221/0.12)]">
      {available === false ? <Fallback /> : null}
      {available ? (
        <SceneBoundary fallback={<Fallback />}>
          <div className="absolute inset-0">
            <Scene design={design} view={view} lookInside={lookInside} captureRef={capture} onContextLost={lost} />
          </div>
        </SceneBoundary>
      ) : null}
      {available ? empty : null}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-between gap-2">
        <div role="group" aria-label="Camera view" className={`${GLASS_PILL} pointer-events-auto flex p-0.5`}>
          {VIEWS.map(({ key, label }) => (
            <button key={key} type="button" aria-pressed={view.key === key} onClick={() => setView((current) => ({ key, nonce: current.nonce + 1 }))} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-200 hover:bg-fg/10 aria-pressed:bg-invert-bg aria-pressed:text-invert-fg">
              {label}
            </button>
          ))}
          <button type="button" aria-pressed={lookInside} onClick={() => setLookInside(!lookInside)} className="min-h-9 rounded-full px-2.5 text-[12px] font-medium transition-colors duration-200 hover:bg-fg/10 aria-pressed:bg-invert-bg aria-pressed:text-invert-fg">Inside</button>
        </div>
        {available ? <button type="button" onClick={saveImage} title="Save a higher quality design preview image" aria-label="Save a higher quality design preview image" className={`${GLASS_PILL} pointer-events-auto grid h-10 w-10 shrink-0 place-items-center`}><ImageSquare size={16} aria-hidden /></button> : null}
      </div>
      {children}
    </section>
  );
}
