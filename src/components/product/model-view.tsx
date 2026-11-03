"use client";

import { ArrowRight, HandGrabbing } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { cleanInitials, withInitials } from "@/lib/studio/initials";
import type { DesignSpec } from "@/lib/studio/spec";

export const loadScene = () => import("@/components/studio/scene");
const Scene = dynamic(loadScene, { ssr: false });

function canUseWebgl() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
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

type Props = { spec: DesignSpec; slug: string; name: string; initialsPrice: string; onReady: () => void; onBack: () => void };

function Unavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="glass-panel grid max-w-[34ch] justify-items-center gap-3 rounded-[26px] p-5">
        <p className="font-display text-xl leading-tight">3D is not available in this browser</p>
        <p className="text-[13px] text-fg/75">The photos show the same piece, and the size guide below uses its real measurements.</p>
        <button type="button" onClick={onBack} className="h-11 rounded-full bg-invert-bg px-5 text-[13px] font-medium text-invert-fg">Back to photos</button>
      </div>
    </div>
  );
}

export function ModelView({ spec, slug, name, initialsPrice, onReady, onBack }: Props) {
  const reduceMotion = useReducedMotion();
  const inputId = useId();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState(false);
  const [letters, setLetters] = useState("");
  const shown = useDeferredValue(letters);
  const dressed = useMemo(() => withInitials(spec, shown), [spec, shown]);
  const initials = letters.trim();

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAvailable(canUseWebgl()));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (available === false) return <Unavailable onBack={onBack} />;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative min-h-0 flex-1" onPointerDown={() => setTouched(true)} onWheel={() => setTouched(true)}>
        {ready ? null : (
          <p role="status" className="absolute inset-0 grid place-items-center text-[13px]">
            <span className="glass-panel rounded-full px-4 py-2">Shaping the leather</span>
          </p>
        )}
        {available ? (
          <SceneBoundary fallback={<Unavailable onBack={onBack} />}>
            <div className={`absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
              <Scene spec={dressed} onReady={() => {
                setReady(true);
                onReady();
              }} onContextLost={() => setAvailable(false)} />
            </div>
          </SceneBoundary>
        ) : null}
        <AnimatePresence>
          {ready && !touched ? (
            <motion.p
              aria-hidden
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-panel pointer-events-none absolute left-1/2 top-3 flex h-9 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[12px] max-lg:top-auto max-lg:bottom-2"
            >
              <HandGrabbing size={15} />
              <span className="lg:hidden">Drag to turn, pinch to zoom</span>
              <span className="hidden lg:inline">Drag to turn, scroll to zoom</span>
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="glass-panel relative z-10 m-2 mt-0 grid gap-1 rounded-[24px] p-1.5 sm:flex sm:items-center sm:gap-3 sm:p-2 sm:pl-4 lg:m-3 lg:mt-0">
        <label htmlFor={inputId} className="shrink-0 text-[13px] leading-tight max-sm:sr-only">
          <span className="block font-medium">Try your initials</span>
          <span className="block text-[11px] text-fg/70">{initials ? `Added in the studio, ${initialsPrice} in foil` : `Shown on ${name}, up to four letters`}</span>
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            id={inputId}
            value={letters}
            onChange={(event) => setLetters(cleanInitials(event.target.value))}
            maxLength={4}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Your initials"
            className="h-11 w-0 min-w-0 flex-1 rounded-full border border-fg/15 bg-bg/80 px-4 font-display text-[18px] tracking-[0.14em] text-fg placeholder:font-sans placeholder:text-[14px] placeholder:tracking-normal placeholder:text-fg/45 focus:border-invert-bg focus:outline-none"
          />
          {initials ? (
            <Link
              href={`/studio?from=${slug}&initials=${encodeURIComponent(initials)}`}
              className="group flex h-11 shrink-0 items-center gap-2 rounded-full bg-invert-bg pl-4 pr-1.5 text-[13px] font-medium text-invert-fg"
            >
              Make it mine
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-invert-fg text-invert-bg transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={14} />
              </span>
            </Link>
          ) : null}
        </div>
        <p aria-live="polite" className="px-3 pb-0.5 text-[11px] leading-tight text-fg/70 empty:hidden sm:sr-only">{initials ? `Added in the studio, ${initialsPrice} in foil.` : ""}</p>
      </div>
    </div>
  );
}
