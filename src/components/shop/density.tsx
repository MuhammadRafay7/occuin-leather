"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { readLocal, writeLocal } from "@/lib/local-store";

const KEY = "orsel-grid-columns";
const OPTIONS = [2, 3, 4] as const;
type Density = (typeof OPTIONS)[number];

const GRID: Record<Density, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Density => OPTIONS.find((option) => String(option) === readLocal(KEY)) ?? 4;
const serverSnapshot = (): Density => 4;

function choose(density: Density) {
  writeLocal(KEY, String(density));
  listeners.forEach((listener) => listener());
}

const useDensity = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot);

export function DensityToggle({ className = "" }: { className?: string }) {
  const density = useDensity();
  return (
    <div role="group" aria-label="Columns" className={`flex items-center gap-1 ${className}`}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={density === option}
          aria-label={`${option} columns`}
          onClick={() => choose(option)}
          className={`grid size-9 place-items-center rounded-full text-xs transition active:scale-[0.94] ${density === option ? "bg-invert-bg text-invert-fg" : "text-fg hover:bg-fg/5"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function DensityGrid({ children }: { children: ReactNode }) {
  const density = useDensity();
  return <div className={`grid gap-x-2 gap-y-8 ${GRID[density]}`}>{children}</div>;
}
