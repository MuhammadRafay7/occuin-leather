"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { money } from "@/lib/format";
import { initialsPlacement } from "@/lib/studio/initials";
import { quoteDesign } from "@/lib/studio/pricing";
import { COLORS, FINISHES, METALS, PATTERNS, THREADS, type ColorKey, type DesignSpec, type FinishKey, type Hide } from "@/lib/studio/spec";
import { useStudioRates } from "./rates";
import { BagGlyph, ColorGrid, Disclosure, Group, Issue, LeatherSample, SECONDARY, Segments, SideGlyph, Slider, Tile, Tiles, Toggle } from "./controls";
import { useStudio, type SectionKey } from "./store";

type Spec = DesignSpec;
export type Issues = Map<string, string>;

const mm = (value: number) => `${Math.round(value)} mm`;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const signedMm = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)} mm`;
const clampInt = (value: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, value)));
const near = (a: number, b: number, tolerance = 0.015) => Math.abs(a - b) <= tolerance;
const closest = <T extends number>(value: number, stops: readonly { value: T }[], tolerance: number) =>
  stops.find((stop) => Math.abs(stop.value - value) <= tolerance)?.value ?? null;

function useEdit() {
  const change = useStudio((state) => state.change);
  return useMemo(
    () => ({
      form: (patch: Partial<Spec["form"]>, key?: string) => change((spec) => ({ ...spec, form: { ...spec.form, ...patch } }), key),
      panels: (patch: Partial<Spec["panels"]>, key?: string) => change((spec) => ({ ...spec, panels: { ...spec.panels, ...patch } }), key),
      surface: (patch: Partial<Spec["surface"]>, key?: string) => change((spec) => ({ ...spec, surface: { ...spec.surface, ...patch } }), key),
      closure: (patch: Partial<Spec["closure"]>, key?: string) => change((spec) => ({ ...spec, closure: { ...spec.closure, ...patch } }), key),
      carry: (patch: Partial<Spec["carry"]>, key?: string) => change((spec) => ({ ...spec, carry: { ...spec.carry, ...patch } }), key),
      hardware: (patch: Partial<Spec["hardware"]>, key?: string) => change((spec) => ({ ...spec, hardware: { ...spec.hardware, ...patch } }), key),
      stitch: (patch: Partial<Spec["stitch"]>, key?: string) => change((spec) => ({ ...spec, stitch: { ...spec.stitch, ...patch } }), key),
      monogram: (patch: Partial<Spec["monogram"]>, key?: string) => change((spec) => ({ ...spec, monogram: { ...spec.monogram, ...patch } }), key),
      root: (patch: Partial<Pick<Spec, "pocket" | "edgeColor" | "liningColor">>, key?: string) => change((spec) => ({ ...spec, ...patch }), key),
    }),
    [change],
  );
}

function usePriceDelta(spec: Spec) {
  const { pricing } = useStudioRates();
  return useMemo(() => {
    const current = quoteDesign(spec, pricing).totalCents;
    return (candidate: Spec) => {
      const delta = quoteDesign(candidate, pricing).totalCents - current;
      if (delta === 0) return undefined;
      return `${delta > 0 ? "+" : "\u2212"}${money(Math.abs(delta))}`;
    };
  }, [spec, pricing]);
}

const SIZES = [
  { key: "small", label: "Small", width: 220 },
  { key: "medium", label: "Medium", width: 300 },
  { key: "large", label: "Large", width: 400 },
] as const;

const SIZE_GLYPH_UNIT = 0.15;

function resized(form: Spec["form"], width: number): Spec["form"] {
  const ratio = width / form.width;
  const height = clampInt(form.height * ratio, 60, 450);
  const limit = Math.floor(Math.min(width, height) / 2);
  return {
    ...form,
    width,
    height,
    depth: clampInt(form.depth * ratio, 6, Math.min(300, width)),
    cornerBottom: clampInt(form.cornerBottom * ratio, 2, Math.min(160, limit)),
    cornerTop: clampInt(form.cornerTop * ratio, 2, Math.min(160, limit)),
  };
}

function SizeSection({ spec, issues }: { spec: Spec; issues: Issues }) {
  const edit = useEdit();
  const { form } = spec;
  const bare = { ...spec, closure: { ...spec.closure, type: "open" as const }, carry: { ...spec.carry, handles: 0, strap: false }, pocket: "none" as const };
  const matched = SIZES.some((size) => size.width === form.width);
  return (
    <div className="grid gap-4">
      <Group title="Choose a size" note={`Keeps your proportions.${matched ? "" : ` Now a custom ${form.width} mm wide.`}`}>
        <Tiles label="Size">
          {SIZES.map((size) => {
            const next = resized(form, size.width);
            return (
              <Tile
                key={size.key}
                label={size.label}
                note={`${next.width} × ${next.height}`}
                selected={form.width === size.width}
                onSelect={() => edit.form({ ...next })}
              >
                <BagGlyph spec={{ ...bare, form: next }} unit={SIZE_GLYPH_UNIT} className="mx-auto max-w-[88px]" />
              </Tile>
            );
          })}
        </Tiles>
      </Group>
      <Disclosure label="Exact measurements">
        <Slider label="Width" value={form.width} min={90} max={600} display={mm(form.width)} onChange={(value) => edit.form({ width: value }, "form.width")} error={issues.get("form.width")} />
        <Slider label="Height" value={form.height} min={60} max={450} display={mm(form.height)} onChange={(value) => edit.form({ height: value }, "form.height")} error={issues.get("form.height")} />
        <Slider label="Depth" value={form.depth} min={6} max={Math.min(300, form.width)} display={mm(form.depth)} onChange={(value) => edit.form({ depth: value }, "form.depth")} error={issues.get("form.depth")} />
      </Disclosure>
    </div>
  );
}

const SILHOUETTES = [
  { key: "box", label: "Box", taper: 1, belly: 0, topArc: 0, cornerBottom: 0.08, cornerTop: 0.05, softness: 0.25 },
  { key: "trapeze", label: "Trapeze", taper: 1.14, belly: 0, topArc: -0.2, cornerBottom: 0.05, cornerTop: 0.02, softness: 0.45 },
  { key: "dome", label: "Dome", taper: 0.86, belly: 0.1, topArc: 0.4, cornerBottom: 0.1, cornerTop: 0.3, softness: 0.3 },
  { key: "saddle", label: "Saddle", taper: 0.92, belly: 0.3, topArc: 0.1, cornerBottom: 0.42, cornerTop: 0.14, softness: 0.3 },
  { key: "slouch", label: "Slouch", taper: 1.1, belly: 0.4, topArc: 0, cornerBottom: 0.25, cornerTop: 0.02, softness: 0.65 },
  { key: "arch", label: "Arch", taper: 0.8, belly: 0.05, topArc: 0.85, cornerBottom: 0.12, cornerTop: 0.42, softness: 0.2 },
] as const;

function silhouetteForm(form: Spec["form"], shape: (typeof SILHOUETTES)[number]): Spec["form"] {
  const side = Math.min(form.width, form.height);
  const limit = Math.min(160, Math.floor(side / 2));
  return {
    ...form,
    taper: shape.taper,
    belly: shape.belly,
    topArc: shape.topArc,
    softness: shape.softness,
    cornerBottom: clampInt(side * shape.cornerBottom, 2, limit),
    cornerTop: clampInt(side * shape.cornerTop, 2, limit),
  };
}

function SilhouetteSection({ spec, issues }: { spec: Spec; issues: Issues }) {
  const edit = useEdit();
  const { form } = spec;
  const cornerLimit = Math.max(2, Math.min(160, Math.floor(Math.min(form.width, form.height) / 2)));
  const bare = { ...spec, closure: { ...spec.closure, type: "open" as const }, carry: { ...spec.carry, handles: 0, strap: false }, pocket: "none" as const };
  return (
    <div className="grid gap-4">
      <Group title="Choose a silhouette">
        <Tiles label="Silhouette">
          {SILHOUETTES.map((shape) => {
            const next = silhouetteForm(form, shape);
            const selected = near(form.taper, next.taper) && near(form.belly, next.belly) && near(form.topArc, next.topArc) && near(form.softness, next.softness) && form.cornerBottom === next.cornerBottom && form.cornerTop === next.cornerTop;
            return (
              <Tile key={shape.key} label={shape.label} selected={selected} onSelect={() => edit.form({ ...next })}>
                <BagGlyph spec={{ ...bare, form: next }} className="mx-auto max-w-[80px]" />
              </Tile>
            );
          })}
        </Tiles>
      </Group>
      <Disclosure label="Exact curves">
        <Slider label="Top width" value={form.taper} min={0.6} max={1.2} step={0.01} display={mm(form.width * form.taper)} onChange={(value) => edit.form({ taper: value }, "form.taper")} error={issues.get("form.taper")} />
        <Slider label="Belly" value={form.belly} min={0} max={1} step={0.01} display={signedMm(form.belly * 0.14 * form.width)} onChange={(value) => edit.form({ belly: value }, "form.belly")} error={issues.get("form.belly")} />
        <Slider label="Top arc" value={form.topArc} min={-1} max={1} step={0.01} display={signedMm(form.topArc * 0.32 * form.height)} onChange={(value) => edit.form({ topArc: value }, "form.topArc")} error={issues.get("form.topArc")} />
        <Slider label="Bottom corners" value={form.cornerBottom} min={2} max={cornerLimit} display={mm(form.cornerBottom)} onChange={(value) => edit.form({ cornerBottom: value }, "form.cornerBottom")} error={issues.get("form.cornerBottom")} />
        <Slider label="Top corners" value={form.cornerTop} min={2} max={cornerLimit} display={mm(form.cornerTop)} onChange={(value) => edit.form({ cornerTop: value }, "form.cornerTop")} error={issues.get("form.cornerTop")} />
        <Slider label="Softness" value={form.softness} min={0} max={1} step={0.01} display={percent(form.softness)} onChange={(value) => edit.form({ softness: value }, "form.softness")} error={issues.get("form.softness")} />
        <Issue message={issues.get("form")} />
      </Disclosure>
    </div>
  );
}

const DEPTHS = [
  { key: "slim", label: "Slim", share: 0.15 },
  { key: "regular", label: "Regular", share: 0.33 },
  { key: "deep", label: "Deep", share: 0.5 },
] as const;

function SidesSection({ spec, issues }: { spec: Spec; issues: Issues }) {
  const edit = useEdit();
  const { form } = spec;
  const delta = usePriceDelta(spec);
  const maxDepth = Math.min(300, form.width);
  const depthFor = (share: number) => clampInt(form.width * share, 6, maxDepth);
  return (
    <div className="grid gap-4">
      <Group title="Side construction">
        <Tiles label="Side construction" columns={2}>
          <Tile
            label="Flat"
            note={delta({ ...spec, form: { ...form, gusset: "flat" } }) ?? "Clean, tailored sides"}
            selected={form.gusset === "flat"}
            onSelect={() => edit.form({ gusset: "flat" })}
          >
            <SideGlyph pleated={false} depth={26} />
          </Tile>
          <Tile
            label="Bellows"
            note={delta({ ...spec, form: { ...form, gusset: "bellows" } }) ?? "Folded sides that expand"}
            selected={form.gusset === "bellows"}
            onSelect={() => edit.form({ gusset: "bellows" })}
          >
            <SideGlyph pleated depth={26} />
          </Tile>
        </Tiles>
      </Group>
      <Group title="Depth">
        <Tiles label="Depth">
          {DEPTHS.map((option) => (
            <Tile key={option.key} label={option.label} note={mm(depthFor(option.share))} selected={form.depth === depthFor(option.share)} onSelect={() => edit.form({ depth: depthFor(option.share) })}>
              <SideGlyph pleated={form.gusset === "bellows"} depth={Math.max(6, option.share * 90)} />
            </Tile>
          ))}
        </Tiles>
      </Group>
      <Disclosure label="Exact depth">
        <Slider label="Depth" value={form.depth} min={6} max={maxDepth} display={mm(form.depth)} onChange={(value) => edit.form({ depth: value }, "form.depth")} error={issues.get("form.depth")} />
      </Disclosure>
    </div>
  );
}

const HIDE_TARGETS = { primary: "Body", accent: "Accent", gusset: "Sides" } as const;
type HideTarget = keyof typeof HIDE_TARGETS;

function HideSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const setView = useStudio((state) => state.setView);
  const setSection = useStudio((state) => state.setSection);
  const delta = usePriceDelta(spec);
  const [choice, setChoice] = useState<HideTarget>("primary");
  const hasAccent = spec.panels.layout !== "single";
  const target = choice === "accent" && !hasAccent ? "primary" : choice;
  const hide: Hide = spec.panels[target];
  const update = (patch: Partial<Hide>) => edit.panels({ [target]: { ...hide, ...patch } });
  const targets = (Object.keys(HIDE_TARGETS) as HideTarget[]).filter((key) => key !== "accent" || hasAccent);
  const pick = (key: HideTarget) => {
    setChoice(key);
    setView(key === "gusset" ? "side" : key === "accent" ? "front" : "hero");
  };

  return (
    <div className="grid gap-4">
      <Segments label="Part of the piece" showLabel={false} value={target} segments={targets.map((key) => ({ value: key, label: HIDE_TARGETS[key] }))} onChange={pick} />
      <div className="grid gap-1.5">
        <p className="flex items-baseline justify-between gap-4 text-[13px]">
          <span className="font-medium">Finish</span>
          <span className={SECONDARY}>{FINISHES[hide.finish].name}</span>
        </p>
        <div role="group" aria-label="Finish" className="grid grid-cols-6 gap-2">
          {(Object.keys(FINISHES) as FinishKey[]).map((finish, index) => (
            <Tile
              key={finish}
              label={FINISHES[finish].name}
              note={hide.finish === finish ? undefined : delta({ ...spec, panels: { ...spec.panels, [target]: { ...hide, finish } } })}
              selected={hide.finish === finish}
              onSelect={() => update({ finish })}
              className={`p-1.5 ${index < 3 ? "col-span-2" : "col-span-3"}`}
            >
              <LeatherSample finish={finish} color={hide.color} className="h-[50px] w-full" />
            </Tile>
          ))}
        </div>
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>{FINISHES[hide.finish].note}.</p>
      </div>
      <ColorGrid label="Colour" value={hide.color} finish={hide.finish} onChange={(color) => update({ color })} />
      {hasAccent ? null : (
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>
          One hide all over.{" "}
          <button type="button" onClick={() => setSection("panels")} className="inline-flex min-h-11 items-center font-medium text-fg underline underline-offset-4">Add a second hide</button>
        </p>
      )}
    </div>
  );
}

const LAYOUTS = [
  { value: "single", label: "Single" },
  { value: "yoke", label: "Yoke" },
  { value: "split", label: "Split" },
  { value: "diagonal", label: "Diagonal" },
  { value: "tipped", label: "Tipped" },
] as const;

const DIVIDES = [
  { value: 0.35, label: "Low" },
  { value: 0.5, label: "Middle" },
  { value: 0.65, label: "High" },
];

function PanelsSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const { panels, form } = spec;
  const hasDivide = panels.layout === "yoke" || panels.layout === "split" || panels.layout === "diagonal";
  const span = panels.layout === "split" ? form.width : form.height;
  const bare = { ...spec, closure: { ...spec.closure, type: "open" as const }, carry: { ...spec.carry, handles: 0, strap: false }, pocket: "none" as const };
  return (
    <div className="grid gap-4">
      <Group title="Panel layout" note="How the hides meet on the front and back.">
        <Tiles label="Layout">
          {LAYOUTS.map((layout) => (
            <Tile
              key={layout.value}
              label={layout.label}
              note={panels.layout === layout.value ? undefined : delta({ ...spec, panels: { ...panels, layout: layout.value } })}
              selected={panels.layout === layout.value}
              onSelect={() => edit.panels({ layout: layout.value })}
            >
              <BagGlyph spec={{ ...bare, panels: { ...panels, layout: layout.value } }} className="mx-auto max-w-[80px]" />
            </Tile>
          ))}
        </Tiles>
      </Group>
      {hasDivide ? (
        <>
          <Segments label="Where the panels meet" value={closest(panels.divide, DIVIDES, 0.005)} segments={DIVIDES} onChange={(divide) => edit.panels({ divide })} />
          <Disclosure label="Exact position">
            <Slider label="Divide" value={panels.divide} min={0.2} max={0.8} step={0.01} display={mm(span * panels.divide)} onChange={(divide) => edit.panels({ divide }, "panels.divide")} />
          </Disclosure>
        </>
      ) : null}
      {panels.layout !== "single" ? (
        <ColorGrid label="Accent colour" value={panels.accent.color} finish={panels.accent.finish} onChange={(color) => edit.panels({ accent: { ...panels.accent, color } })} />
      ) : null}
    </div>
  );
}

const PATTERN_ART: Record<Spec["surface"]["pattern"], CSSProperties | null> = {
  none: null,
  quilted: {
    backgroundImage:
      "repeating-linear-gradient(45deg, transparent 0 13px, rgb(255 255 255 / 0.45) 13px 14px), repeating-linear-gradient(-45deg, transparent 0 13px, rgb(255 255 255 / 0.45) 13px 14px)",
  },
  woven: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgb(0 0 0 / 0.3) 0 2px, transparent 2px 10px), repeating-linear-gradient(90deg, rgb(255 255 255 / 0.22) 0 5px, rgb(0 0 0 / 0.2) 5px 10px)",
  },
  perforated: { backgroundImage: "radial-gradient(circle, rgb(0 0 0 / 0.65) 1.6px, transparent 2px)", backgroundSize: "11px 11px" },
  signature: null,
};

const SCALES = [
  { value: 0.75, label: "Fine" },
  { value: 1, label: "Regular" },
  { value: 1.4, label: "Bold" },
];

function SurfaceSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const setStep = useStudio((state) => state.setStep);
  const { surface, panels, monogram } = spec;
  const hasPattern = surface.pattern !== "none";
  const letters = monogram.text.trim().toUpperCase() || "OC";
  return (
    <div className="grid gap-4">
      <Group title="Surface">
        <Tiles label="Surface">
          {(Object.keys(PATTERNS) as Spec["surface"]["pattern"][]).map((pattern) => (
            <Tile
              key={pattern}
              label={PATTERNS[pattern].name}
              note={surface.pattern === pattern ? undefined : delta({ ...spec, surface: { ...surface, pattern } })}
              selected={surface.pattern === pattern}
              onSelect={() => edit.surface({ pattern })}
              className="p-1.5"
            >
              <LeatherSample finish={panels.primary.finish} color={panels.primary.color} className="h-[60px] w-full">
                {PATTERN_ART[pattern] ? <span className="absolute inset-0" style={PATTERN_ART[pattern]} /> : null}
                {pattern === "signature" ? <span className="absolute inset-0 grid place-items-center overflow-hidden whitespace-nowrap font-display text-[13px] leading-tight tracking-[0.1em] text-white/55">{`${letters} `.repeat(4)}</span> : null}
              </LeatherSample>
            </Tile>
          ))}
        </Tiles>
      </Group>
      {surface.pattern === "signature" ? (
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>
          {monogram.text.trim() ? `Repeats ${letters} across the hide.` : "Repeats OC until you set your own."}{" "}
          <button type="button" onClick={() => setStep("personalise")} className="inline-flex min-h-11 items-center font-medium text-fg underline underline-offset-4">Set your initials</button>
        </p>
      ) : null}
      {hasPattern ? (
        <>
          <Segments label="Pattern scale" value={closest(surface.scale, SCALES, 0.005)} segments={SCALES} onChange={(scale) => edit.surface({ scale })} />
          <Disclosure label="Exact scale">
            <Slider label="Scale" value={surface.scale} min={0.6} max={1.6} step={0.01} display={percent(surface.scale)} onChange={(scale) => edit.surface({ scale }, "surface.scale")} />
          </Disclosure>
        </>
      ) : null}
    </div>
  );
}

const FLAP_LENGTHS = [
  { value: 0.35, label: "Short" },
  { value: 0.55, label: "Half" },
  { value: 0.85, label: "Long" },
];

function ClosureSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const { closure, form } = spec;
  const hasFlap = closure.type === "flap";
  const types = [
    { value: "open", label: "Open top" },
    { value: "zip", label: "Zip" },
    { value: "flap", label: "Flap" },
  ] as const;
  const shapes = [
    { value: "straight", label: "Straight" },
    { value: "round", label: "Round" },
    { value: "point", label: "Point" },
  ] as const;
  const clasps = [
    { value: "none", label: "No clasp" },
    { value: "turnlock", label: "Turnlock" },
    { value: "bar", label: "Bar" },
  ] as const;
  return (
    <div className="grid gap-4">
      <Group title="Closure">
        <Tiles label="Closure">
          {types.map((type) => {
            const next = { ...spec, closure: { ...closure, type: type.value } };
            return (
              <Tile key={type.value} label={type.label} note={closure.type === type.value ? undefined : delta(next)} selected={closure.type === type.value} onSelect={() => edit.closure({ type: type.value })}>
                <BagGlyph spec={{ ...next, carry: { ...spec.carry, handles: 0, strap: false } }} className="mx-auto max-w-[80px]" />
              </Tile>
            );
          })}
        </Tiles>
      </Group>
      {hasFlap ? (
        <>
          <Group title="Flap shape">
            <Tiles label="Flap shape">
              {shapes.map((shape) => (
                <Tile key={shape.value} label={shape.label} selected={closure.flapShape === shape.value} onSelect={() => edit.closure({ flapShape: shape.value })}>
                  <BagGlyph spec={{ ...spec, carry: { ...spec.carry, handles: 0, strap: false }, closure: { ...closure, flapShape: shape.value } }} className="mx-auto max-w-[80px]" />
                </Tile>
              ))}
            </Tiles>
          </Group>
          <Segments label="Flap length" value={closest(closure.flapLength, FLAP_LENGTHS, 0.005)} segments={FLAP_LENGTHS} onChange={(flapLength) => edit.closure({ flapLength })} />
          <Disclosure label="Exact flap length">
            <Slider label="Flap length" value={closure.flapLength} min={0.25} max={1} step={0.01} display={mm(form.height * closure.flapLength)} onChange={(flapLength) => edit.closure({ flapLength }, "closure.flapLength")} />
          </Disclosure>
          <Group title="Clasp">
            <Tiles label="Clasp">
              {clasps.map((clasp) => (
                <Tile
                  key={clasp.value}
                  label={clasp.label}
                  note={closure.clasp === clasp.value ? undefined : delta({ ...spec, closure: { ...closure, clasp: clasp.value } })}
                  selected={closure.clasp === clasp.value}
                  onSelect={() => edit.closure({ clasp: clasp.value })}
                >
                  <BagGlyph spec={{ ...spec, carry: { ...spec.carry, handles: 0, strap: false }, closure: { ...closure, clasp: clasp.value } }} className="mx-auto max-w-[80px]" />
                </Tile>
              ))}
            </Tiles>
          </Group>
        </>
      ) : (
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>Choose a flap to shape it and add a clasp.</p>
      )}
    </div>
  );
}

const DROPS = [
  { value: 90, label: "Hand" },
  { value: 150, label: "Arm" },
  { value: 230, label: "Shoulder" },
];

const STRAPS = [
  { key: "none", label: "No strap", length: null },
  { key: "shoulder", label: "Shoulder", length: 900 },
  { key: "cross", label: "Crossbody", length: 1250 },
] as const;

function CarrySection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const { carry } = spec;
  const counts = [
    { value: 0, label: "No handle" },
    { value: 1, label: "One" },
    { value: 2, label: "Two" },
  ];
  const bare = { ...spec, closure: { ...spec.closure, type: "open" as const }, pocket: "none" as const };
  const strapPatch = (length: number | null) => (length === null ? { strap: false } : { strap: true, strapLength: length });
  return (
    <div className="grid gap-4">
      <Group title="Handles">
        <Tiles label="Handles">
          {counts.map((count) => {
            const next = { ...carry, handles: count.value };
            return (
              <Tile key={count.value} label={count.label} note={carry.handles === count.value ? undefined : delta({ ...spec, carry: next })} selected={carry.handles === count.value} onSelect={() => edit.carry({ handles: count.value })}>
                <BagGlyph spec={{ ...bare, carry: { ...next, strap: false } }} className="mx-auto max-w-[80px]" />
              </Tile>
            );
          })}
        </Tiles>
      </Group>
      {carry.handles ? (
        <>
          <Segments label="Handle drop" value={closest(carry.handleDrop, DROPS, 0)} segments={DROPS} onChange={(handleDrop) => edit.carry({ handleDrop })} />
          <Disclosure label="Exact handles">
            <Slider label="Handle drop" value={carry.handleDrop} min={50} max={320} display={mm(carry.handleDrop)} onChange={(handleDrop) => edit.carry({ handleDrop }, "carry.handleDrop")} />
            <Slider label="Handle width" value={carry.handleWidth} min={8} max={30} display={mm(carry.handleWidth)} onChange={(handleWidth) => edit.carry({ handleWidth }, "carry.handleWidth")} />
          </Disclosure>
        </>
      ) : null}
      <Group title="Shoulder strap">
        <Tiles label="Shoulder strap">
          {STRAPS.map((strap) => {
            const selected = strap.length === null ? !carry.strap : carry.strap && carry.strapLength === strap.length;
            const next = { ...carry, ...strapPatch(strap.length) };
            return (
              <Tile key={strap.key} label={strap.label} note={selected ? undefined : delta({ ...spec, carry: next })} selected={selected} onSelect={() => edit.carry(strapPatch(strap.length))}>
                <BagGlyph spec={{ ...bare, carry: { ...next, handles: 0 } }} className="mx-auto max-w-[80px]" />
              </Tile>
            );
          })}
        </Tiles>
      </Group>
      {carry.strap ? (
        <Disclosure label="Exact strap">
          <Slider label="Strap length" value={carry.strapLength} min={500} max={1300} step={10} display={mm(carry.strapLength)} onChange={(strapLength) => edit.carry({ strapLength }, "carry.strapLength")} />
          <Slider label="Strap width" value={carry.strapWidth} min={10} max={50} display={mm(carry.strapWidth)} onChange={(strapWidth) => edit.carry({ strapWidth }, "carry.strapWidth")} />
        </Disclosure>
      ) : null}
    </div>
  );
}

function PocketSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const pockets = [
    { value: "none", label: "No pocket" },
    { value: "slip", label: "Slip" },
    { value: "zip", label: "Zip" },
  ] as const;
  return (
    <Group title="Front pocket">
      <Tiles label="Front pocket">
        {pockets.map((pocket) => (
          <Tile key={pocket.value} label={pocket.label} note={spec.pocket === pocket.value ? undefined : delta({ ...spec, pocket: pocket.value })} selected={spec.pocket === pocket.value} onSelect={() => edit.root({ pocket: pocket.value })}>
            <BagGlyph spec={{ ...spec, closure: { ...spec.closure, type: "open" }, carry: { ...spec.carry, handles: 0, strap: false }, pocket: pocket.value }} className="mx-auto max-w-[80px]" />
          </Tile>
        ))}
      </Tiles>
    </Group>
  );
}

const METAL_SHINE: Record<keyof typeof METALS, string> = {
  gold: "#fff3cf",
  palladium: "#ffffff",
  brass: "#dcc48a",
  gunmetal: "#8e9094",
  noir: "#55555a",
};

function metalStyle(metal: keyof typeof METALS): CSSProperties {
  const { hex } = METALS[metal];
  return { background: `radial-gradient(circle at 34% 28%, ${METAL_SHINE[metal]}, ${hex} 44%, color-mix(in srgb, ${hex} 62%, black) 100%)` };
}

function hasMetal(spec: Spec) {
  const { closure, carry, pocket, hardware, form } = spec;
  return closure.type === "zip" || (closure.type === "flap" && closure.clasp !== "none") || carry.handles > 0 || carry.strap || pocket === "zip" || (hardware.feet && form.depth >= 40);
}

function HardwareSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const setView = useStudio((state) => state.setView);
  const delta = usePriceDelta(spec);
  const { hardware, form } = spec;
  const shallow = form.depth < 40;
  const feetNote = shallow
    ? hardware.feet
      ? "Not fitted under 40 mm deep. Turn off to remove the cost."
      : "Fitted to pieces at least 40 mm deep."
    : "Four studs that lift the base.";
  return (
    <div className="grid gap-4">
      <Group title="Metal" note={hasMetal(spec) ? "Every fitting on the piece." : "Nothing metal on this piece yet. Add a zip, clasp, handles or feet to see it."}>
        <Tiles label="Metal">
          {(Object.keys(METALS) as (keyof typeof METALS)[]).map((metal) => (
            <Tile key={metal} label={METALS[metal].name} note={hardware.metal === metal ? undefined : delta({ ...spec, hardware: { ...hardware, metal } })} selected={hardware.metal === metal} onSelect={() => edit.hardware({ metal })}>
              <span aria-hidden className="mx-auto mt-0.5 block h-10 w-10 rounded-full shadow-[0_2px_6px_rgb(0_0_0/0.3),inset_0_-2px_3px_rgb(0_0_0/0.25)]" style={metalStyle(metal)} />
            </Tile>
          ))}
        </Tiles>
      </Group>
      <Toggle
        label="Base feet"
        note={feetNote}
        checked={hardware.feet}
        disabled={shallow && !hardware.feet}
        onChange={(feet) => {
          edit.hardware({ feet });
          setView("side");
        }}
      />
    </div>
  );
}

const STITCH_LENGTHS = [
  { value: 2.5, label: "Fine" },
  { value: 3.5, label: "Classic" },
  { value: 5, label: "Bold" },
];

function threadColor(spec: Spec, thread: keyof typeof THREADS) {
  return THREADS[thread].hex || `color-mix(in srgb, ${COLORS[spec.panels.primary.color].hex} 72%, white)`;
}

function StitchLine({ color, rows, length }: { color: string; rows: number; length: number }) {
  return (
    <span className="absolute inset-x-1.5 top-1/2 grid -translate-y-1/2 gap-1.5">
      {Array.from({ length: rows }, (_, row) => (
        <span
          key={row}
          className="block h-[2.5px] rounded-full"
          style={{ backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 ${length * 2}px, transparent ${length * 2}px ${length * 3}px)` }}
        />
      ))}
    </span>
  );
}

function ThreadSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const { stitch, panels } = spec;
  const rows = [
    { value: 1, label: "Single row" },
    { value: 2, label: "Double row" },
  ];
  return (
    <div className="grid gap-4">
      <Group title="Thread">
        <Tiles label="Thread">
          {(Object.keys(THREADS) as (keyof typeof THREADS)[]).map((thread) => (
            <Tile key={thread} label={THREADS[thread].name} selected={stitch.thread === thread} onSelect={() => edit.stitch({ thread })} className="p-1.5">
              <LeatherSample finish={panels.primary.finish} color={panels.primary.color} className="h-[52px] w-full">
                <StitchLine color={threadColor(spec, thread)} rows={stitch.rows} length={stitch.length} />
              </LeatherSample>
            </Tile>
          ))}
        </Tiles>
      </Group>
      <Tiles label="Rows" columns={2}>
        {rows.map((row) => (
          <Tile
            key={row.value}
            label={row.label}
            note={stitch.rows === row.value ? undefined : delta({ ...spec, stitch: { ...stitch, rows: row.value } })}
            selected={stitch.rows === row.value}
            onSelect={() => edit.stitch({ rows: row.value })}
            className="p-1.5"
          >
            <LeatherSample finish={panels.primary.finish} color={panels.primary.color} className="h-[44px] w-full">
              <StitchLine color={threadColor(spec, stitch.thread)} rows={row.value} length={stitch.length} />
            </LeatherSample>
          </Tile>
        ))}
      </Tiles>
      <Segments label="Stitch length" value={closest(stitch.length, STITCH_LENGTHS, 0.01)} segments={STITCH_LENGTHS} onChange={(length) => edit.stitch({ length })} />
      <Disclosure label="Exact stitch length">
        <Slider label="Stitch length" value={stitch.length} min={2} max={6} step={0.5} display={`${stitch.length.toFixed(1)} mm`} onChange={(length) => edit.stitch({ length }, "stitch.length")} />
      </Disclosure>
    </div>
  );
}

function EdgesSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  return (
    <Group title="Edge paint" note="Hand painted along every raw edge.">
      <ColorGrid label="Edge colour" value={spec.edgeColor} finish="box" onChange={(edgeColor: ColorKey) => edit.root({ edgeColor })} />
    </Group>
  );
}

function LiningSection({ spec }: { spec: Spec }) {
  const edit = useEdit();
  const open = spec.closure.type === "open";
  return (
    <Group title="Lining" note={open ? "Shows through the open top." : "Stays inside on a closed piece. Choose an open top to see it here."}>
      <ColorGrid label="Lining colour" value={spec.liningColor} finish="suede" onChange={(liningColor: ColorKey) => edit.root({ liningColor })} />
    </Group>
  );
}

const FONT_STACKS = {
  didone: "var(--font-display), serif",
  grotesk: "var(--font-sans), sans-serif",
  script: "var(--font-script), cursive",
};

const FONTS = [
  { value: "didone", label: "Didone", size: 22 },
  { value: "grotesk", label: "Grotesk", size: 18 },
  { value: "script", label: "Script", size: 24 },
] as const;

const TECHNIQUES = [
  { value: "blind", label: "Blind deboss" },
  { value: "gold", label: "Gold foil" },
  { value: "palladium", label: "Palladium foil" },
  { value: "paint", label: "Hand painted" },
] as const;

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function inkStyle(spec: Spec): CSSProperties {
  const { technique } = spec.monogram;
  if (technique === "gold" || technique === "palladium") {
    const stops = technique === "gold" ? "#f6e3a8, #c99a3c 48%, #f1d68c 70%, #a97c2a" : "#ffffff, #b9bab6 50%, #efefec 72%, #94958f";
    return { backgroundImage: `linear-gradient(170deg, ${stops})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: "drop-shadow(0 1px 0 rgb(0 0 0 / 0.35))" };
  }
  if (technique === "paint") return { color: `color-mix(in srgb, ${COLORS[spec.edgeColor].hex} 90%, white)` };
  const dark = luminance(COLORS[spec.panels.primary.color].hex) < 0.2;
  return { color: dark ? "rgb(255 255 255 / 0.16)" : "rgb(0 0 0 / 0.34)", textShadow: "0 1px 0 rgb(255 255 255 / 0.24), 0 -1px 0 rgb(0 0 0 / 0.5)" };
}

function MonogramPreview({ spec }: { spec: Spec }) {
  const { monogram, panels } = spec;
  const text = monogram.text.trim().toUpperCase();
  const size = monogram.font === "script" ? 64 : 52;
  return (
    <LeatherSample finish={panels.primary.finish} color={panels.primary.color} className="grid h-[118px] w-full place-items-center rounded-[18px]">
      <span
        data-testid="monogram-preview"
        className="absolute inset-0 grid place-items-center leading-none tracking-[0.08em]"
        style={{ fontFamily: FONT_STACKS[monogram.font], fontSize: size, ...(text ? inkStyle(spec) : { color: "rgb(255 255 255 / 0.4)" }) }}
      >
        {text || "OC"}
      </span>
    </LeatherSample>
  );
}

function MonogramSection({ spec, issues }: { spec: Spec; issues: Issues }) {
  const edit = useEdit();
  const delta = usePriceDelta(spec);
  const { monogram, closure, surface } = spec;
  const hasText = Boolean(monogram.text.trim());
  const allOver = surface.pattern === "signature";
  const lettered = hasText || allOver;
  const placements = [
    { value: "center", label: "Centre" },
    { value: "corner", label: "Corner" },
    ...(closure.type === "flap" ? [{ value: "flap" as const, label: "On the flap" }] : []),
  ] as { value: Spec["monogram"]["placement"]; label: string }[];
  return (
    <div className="grid gap-4">
      <MonogramPreview spec={spec} />
      <div className="grid gap-1.5">
        <label htmlFor="studio-monogram" className="text-[13px] font-medium">Your initials</label>
        <input
          id="studio-monogram"
          value={monogram.text}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Up to four letters"
          aria-invalid={Boolean(issues.get("monogram.text"))}
          onChange={(event) => {
            const placement = monogram.text ? monogram.placement : initialsPlacement(spec);
            edit.monogram({ text: event.target.value, ...(placement !== monogram.placement ? { placement } : {}) }, "monogram.text");
          }}
          className={`h-12 w-full rounded-full border border-fg/15 bg-bg/70 px-5 text-[16px] tracking-[0.12em] text-fg uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-fg/75 focus:border-invert-bg focus:outline-none ${monogram.text ? "font-display" : ""}`}
        />
        <Issue message={issues.get("monogram.text")} />
        
      </div>
      {lettered ? (
        <>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Lettering</span>
            <Tiles label="Lettering">
              {FONTS.map((font) => (
                <Tile
                  key={font.value}
                  label={<span className="block text-center" style={{ fontFamily: FONT_STACKS[font.value], fontSize: font.size }}>{font.label}</span>}
                  ariaLabel={font.label}
                  selected={monogram.font === font.value}
                  onSelect={() => edit.monogram({ font: font.value })}
                  className="place-content-center"
                />
              ))}
            </Tiles>
          </div>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium">Technique</span>
            <Tiles label="Technique" columns={2}>
              {TECHNIQUES.map((technique) => (
                <Tile
                  key={technique.value}
                  label={technique.label}
                  note={monogram.technique === technique.value ? undefined : delta({ ...spec, monogram: { ...monogram, technique: technique.value } })}
                  selected={monogram.technique === technique.value}
                  onSelect={() => edit.monogram({ technique: technique.value })}
                />
              ))}
            </Tiles>
          </div>
          {allOver ? (
            <p className={`text-[13px] leading-snug ${SECONDARY}`}>Your initials run all over this piece, so there is no single placement.</p>
          ) : (
            <Segments label="Placement" value={monogram.placement} segments={placements} onChange={(placement) => edit.monogram({ placement })} />
          )}
          {!allOver && closure.type !== "flap" ? <p className={`text-[13px] leading-snug ${SECONDARY}`}>Add a flap under Details to place initials on it.</p> : null}
          {!allOver && closure.type === "flap" && monogram.placement === "center" ? <p className={`text-[13px] leading-snug ${SECONDARY}`}>The flap may cover the centre. Lift it to read your initials.</p> : null}
          {!allOver && closure.type !== "flap" && spec.pocket !== "none" && monogram.placement === "center" ? <p className={`text-[13px] leading-snug ${SECONDARY}`}>The front pocket crosses the centre. Corner keeps your initials clear of it.</p> : null}
          <Issue message={issues.get("monogram.placement")} />
        </>
      ) : (
        <p className={`text-[13px] leading-snug ${SECONDARY}`}>Type your initials to choose the lettering, technique and placement. Leave empty for none.</p>
      )}
    </div>
  );
}

export function SectionView({ section, spec, issues }: { section: SectionKey; spec: Spec; issues: Issues }): ReactNode {
  switch (section) {
    case "size":
      return <SizeSection spec={spec} issues={issues} />;
    case "silhouette":
      return <SilhouetteSection spec={spec} issues={issues} />;
    case "sides":
      return <SidesSection spec={spec} issues={issues} />;
    case "hide":
      return <HideSection spec={spec} />;
    case "panels":
      return <PanelsSection spec={spec} />;
    case "surface":
      return <SurfaceSection spec={spec} />;
    case "closure":
      return <ClosureSection spec={spec} />;
    case "carry":
      return <CarrySection spec={spec} />;
    case "pocket":
      return <PocketSection spec={spec} />;
    case "metal":
      return <HardwareSection spec={spec} />;
    case "thread":
      return <ThreadSection spec={spec} />;
    case "edges":
      return <EdgesSection spec={spec} />;
    case "lining":
      return <LiningSection spec={spec} />;
    case "monogram":
      return <MonogramSection spec={spec} issues={issues} />;
    default:
      return null;
  }
}
