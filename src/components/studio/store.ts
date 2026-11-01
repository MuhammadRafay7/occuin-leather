import { create } from "zustand";
import { PRESETS } from "@/lib/studio/presets";
import { designSpecSchema, normalizeSpec, type DesignSpec } from "@/lib/studio/spec";

export type ViewName = "hero" | "front" | "side" | "back" | "top";

export const STEPS = [
  {
    key: "shape",
    label: "Shape",
    sections: [
      { key: "size", label: "Size", view: "hero" },
      { key: "silhouette", label: "Silhouette", view: "front" },
      { key: "sides", label: "Sides", view: "side" },
    ],
  },
  {
    key: "leather",
    label: "Leather",
    sections: [
      { key: "hide", label: "Hide", view: "hero" },
      { key: "panels", label: "Panels", view: "front" },
      { key: "surface", label: "Surface", view: "front" },
    ],
  },
  {
    key: "details",
    label: "Details",
    sections: [
      { key: "closure", label: "Closure", view: "hero" },
      { key: "carry", label: "Carry", view: "hero" },
      { key: "pocket", label: "Pocket", view: "front" },
    ],
  },
  { key: "hardware", label: "Hardware", sections: [{ key: "metal", label: "Metal", view: "front" }] },
  {
    key: "stitch",
    label: "Stitch",
    sections: [
      { key: "thread", label: "Thread", view: "front" },
      { key: "edges", label: "Edges", view: "side" },
      { key: "lining", label: "Lining", view: "top" },
    ],
  },
  { key: "personalise", label: "Personalise", sections: [{ key: "monogram", label: "Monogram", view: "front" }] },
  { key: "saved", label: "Saved designs", sections: [{ key: "list", label: "Saved designs", view: "hero" }] },
] as const satisfies readonly { key: string; label: string; sections: readonly { key: string; label: string; view: ViewName }[] }[];

export type StepKey = (typeof STEPS)[number]["key"];
export type SectionKey = (typeof STEPS)[number]["sections"][number]["key"];
export type DesignOrigin = { spec: DesignSpec; designId: string | null; source: string | null; saved?: boolean };

const DRAFT_KEY = "orsel.studio.draft.v1";
const HISTORY_LIMIT = 80;
const COALESCE_MS = 600;

type Draft = { spec: DesignSpec; baseline: DesignSpec; designId: string | null; source: string | null; savedJson: string | null };

type StudioState = {
  phase: "loading" | "choosing" | "designing";
  spec: DesignSpec;
  baseline: DesignSpec;
  past: DesignSpec[];
  future: DesignSpec[];
  lastKey: string | null;
  lastAt: number;
  designId: string | null;
  source: string | null;
  savedJson: string | null;
  step: StepKey;
  section: SectionKey;
  view: { name: ViewName; nonce: number };
  autoRotate: boolean;
  change: (recipe: (spec: DesignSpec) => DesignSpec, key?: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  begin: (origin: DesignOrigin) => void;
  choose: () => void;
  markSaved: (id: string) => void;
  forget: (id: string) => void;
  setStep: (step: StepKey) => void;
  setSection: (section: SectionKey) => void;
  setView: (name: ViewName) => void;
  toggleAutoRotate: () => void;
  setChoosing: () => void;
};

function openingOf(step: StepKey, nonce: number) {
  const first = STEPS.find((item) => item.key === step)!.sections[0];
  return { section: first.key as SectionKey, nonce: { name: first.view as ViewName, nonce: nonce + 1 } };
}

export const useStudio = create<StudioState>((set, get) => ({
  phase: "loading",
  spec: PRESETS.blank,
  baseline: PRESETS.blank,
  past: [],
  future: [],
  lastKey: null,
  lastAt: 0,
  designId: null,
  source: null,
  savedJson: null,
  step: "shape",
  section: "size",
  view: { name: "hero", nonce: 0 },
  autoRotate: false,

  change: (recipe, key) => {
    const { spec, past, lastKey, lastAt } = get();
    const next = normalizeSpec(recipe(spec));
    if (JSON.stringify(next) === JSON.stringify(spec)) return;
    const now = Date.now();
    const coalesced = key !== undefined && key === lastKey && now - lastAt < COALESCE_MS;
    set({
      spec: next,
      past: coalesced ? past : [...past, spec].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: key ?? null,
      lastAt: now,
    });
  },

  undo: () => {
    const { past, future, spec } = get();
    const previous = past[past.length - 1];
    if (!previous) return;
    set({ spec: previous, past: past.slice(0, -1), future: [spec, ...future], lastKey: null });
  },

  redo: () => {
    const { past, future, spec } = get();
    const [next, ...rest] = future;
    if (!next) return;
    set({ spec: next, past: [...past, spec], future: rest, lastKey: null });
  },

  reset: () => {
    const { baseline, spec, past } = get();
    if (JSON.stringify(baseline) === JSON.stringify(spec)) return;
    set({ spec: baseline, past: [...past, spec].slice(-HISTORY_LIMIT), future: [], lastKey: null });
  },

  begin: ({ spec, designId, source, saved }) =>
    set({
      phase: "designing",
      spec,
      baseline: spec,
      past: [],
      future: [],
      lastKey: null,
      designId,
      source,
      savedJson: saved ? JSON.stringify(spec) : null,
      step: "shape",
      section: "size",
      view: { name: "hero", nonce: get().view.nonce + 1 },
    }),

  choose: () => {
    clearDraft();
    set({ phase: "choosing", designId: null, source: null, savedJson: null, autoRotate: false });
  },

  markSaved: (id) => set({ designId: id, savedJson: JSON.stringify(get().spec) }),
  forget: (id) => {
    if (get().designId === id) set({ designId: null, savedJson: null, source: null });
  },
  setStep: (step) => {
    const { section, nonce } = openingOf(step, get().view.nonce);
    set({ step, section, view: nonce });
  },
  setSection: (section) => {
    const step = STEPS.find((item) => item.key === get().step);
    const target = step?.sections.find((item) => item.key === section);
    if (!target) return;
    set({ section: target.key, view: { name: target.view, nonce: get().view.nonce + 1 } });
  },
  setView: (name) => set({ view: { name, nonce: get().view.nonce + 1 } }),
  toggleAutoRotate: () => set({ autoRotate: !get().autoRotate }),
  setChoosing: () => set({ phase: "choosing" }),
}));

export function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    const usable = (spec: DesignSpec) =>
      designSpecSchema.safeParse({ ...spec, name: spec.name.trim() || "Untitled design", monogram: { ...spec.monogram, text: "" } }).success;
    return usable(draft.spec) && usable(draft.baseline) ? draft : null;
  } catch {
    return null;
  }
}

export function restoreDraft(draft: Draft) {
  useStudio.setState({
    phase: "designing",
    spec: draft.spec,
    baseline: draft.baseline,
    past: [],
    future: [],
    lastKey: null,
    designId: draft.designId,
    source: draft.source,
    savedJson: draft.savedJson,
    step: "shape",
    section: "size",
  });
}

export function writeDraft() {
  const { phase, spec, baseline, designId, source, savedJson } = useStudio.getState();
  if (phase !== "designing") return;
  const draft: Draft = { spec, baseline, designId, source, savedJson };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    return;
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    return;
  }
}

export const captureBridge: { current: (() => string | null) | null } = { current: null };
