"use client";

import { ArrowsClockwise } from "@phosphor-icons/react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";
import type { DesignSpec } from "@/lib/studio/spec";
import { PRESS } from "./controls";
import { useStudio, type ViewName } from "./store";

const Scene = dynamic(() => import("./scene"), { ssr: false, loading: () => <CanvasSkeleton /> });

const VIEWS: { name: ViewName; label: string }[] = [
  { name: "hero", label: "Angle" },
  { name: "front", label: "Front" },
  { name: "side", label: "Side" },
  { name: "back", label: "Back" },
  { name: "top", label: "Top" },
];

function CanvasSkeleton() {
  return (
    <div className="grid h-full place-items-center" role="status">
      <div className="grid justify-items-center gap-4">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Preparing the atelier</p>
      </div>
    </div>
  );
}

function WebglFallback() {
  return (
    <div className="grid h-full place-items-center p-8 text-center lg:pl-[200px] lg:pr-[60px]">
      <div className="grid max-w-[38ch] justify-items-center gap-3">
        <h2 className="font-display text-2xl">The live preview is unavailable</h2>
        <p className="text-sm text-muted">
          This browser cannot display 3D. Every choice, the price and saving still work, and our atelier will make the piece exactly as specified.
        </p>
      </div>
    </div>
  );
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function canUseWebgl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useWebgl() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setAvailable(canUseWebgl()));
    return () => cancelAnimationFrame(frame);
  }, []);
  return { available, lost: () => setAvailable(false) };
}

export function BareScene({ spec, onReady }: { spec: DesignSpec; onReady?: () => void }) {
  const { available, lost } = useWebgl();
  if (available === null) return null;
  if (!available) return <WebglFallback />;
  return (
    <SceneBoundary fallback={<WebglFallback />}>
      <Scene spec={spec} interactive={false} onReady={onReady} onContextLost={lost} />
    </SceneBoundary>
  );
}

export function Stage({ webgl }: { webgl: ReturnType<typeof useWebgl> }) {
  const spec = useStudio((state) => state.spec);
  const { available, lost } = webgl;
  return (
    <section aria-label="Preview" className="relative h-full min-h-0">
      {available === null ? <CanvasSkeleton /> : null}
      {available === false ? <WebglFallback /> : null}
      {available ? (
        <SceneBoundary fallback={<WebglFallback />}>
          <div className="absolute inset-0">
            <Scene spec={spec} onContextLost={lost} />
          </div>
        </SceneBoundary>
      ) : null}
    </section>
  );
}

export function ViewPicker({ vertical = false }: { vertical?: boolean }) {
  const activeView = useStudio((state) => state.view.name);
  const setView = useStudio((state) => state.setView);
  const autoRotate = useStudio((state) => state.autoRotate);
  const toggleAutoRotate = useStudio((state) => state.toggleAutoRotate);
  const item = `min-h-11 rounded-full text-[13px] font-medium transition-colors duration-200 hover:bg-fg/10 aria-pressed:bg-invert-bg aria-pressed:text-invert-fg aria-pressed:hover:bg-invert-bg ${vertical ? "w-[60px]" : "min-w-11 flex-1 px-1.5"}`;
  return (
    <div role="group" aria-label="Camera view" className={`glass-panel flex rounded-[26px] p-1 ${vertical ? "flex-col" : "items-center"}`}>
      {VIEWS.map((view) => (
        <motion.button key={view.name} type="button" aria-pressed={activeView === view.name} whileTap={{ scale: 0.94 }} transition={PRESS} onClick={() => setView(view.name)} className={item}>
          {view.label}
        </motion.button>
      ))}
      <motion.button
        type="button"
        aria-pressed={autoRotate}
        aria-label="Rotate automatically"
        title="Rotate automatically"
        whileTap={{ scale: 0.94 }}
        transition={PRESS}
        onClick={toggleAutoRotate}
        className={`grid place-items-center ${item}`}
      >
        <ArrowsClockwise size={18} />
      </motion.button>
    </div>
  );
}
