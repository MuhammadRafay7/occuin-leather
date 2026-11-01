"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { COLORS, FINISHES, type ColorKey, type DesignSpec, type FinishKey } from "@/lib/studio/spec";

export const SPRING = { type: "spring", bounce: 0, visualDuration: 0.34 } as const;
export const PRESS = { type: "spring", bounce: 0, visualDuration: 0.14 } as const;
export const SECONDARY = "text-fg/75";

export function Group({ title, note, children }: { title?: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      {title || note ? (
        <div>
          {title ? <h3 className="font-display text-[19px] leading-tight tracking-[-0.005em]">{title}</h3> : null}
          {note ? <p className={`mt-0.5 text-[13px] leading-snug ${SECONDARY}`}>{note}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Issue({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[13px] text-danger">{message}</p>;
}

const RANGE =
  "h-11 w-full cursor-pointer touch-pan-y appearance-none rounded-full bg-transparent focus-visible:outline-offset-0 " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--invert-bg)_var(--fill),color-mix(in_srgb,var(--fg)_16%,transparent)_var(--fill))] " +
  "[&::-webkit-slider-thumb]:-mt-[10px] [&::-webkit-slider-thumb]:h-[26px] [&::-webkit-slider-thumb]:w-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-fg/10 [&::-webkit-slider-thumb]:bg-bg [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(23_49_42/0.3)] [&::-webkit-slider-thumb]:transition-transform active:[&::-webkit-slider-thumb]:scale-110 " +
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-fg/15 [&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-invert-bg " +
  "[&::-moz-range-thumb]:h-[26px] [&::-moz-range-thumb]:w-[26px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-fg/10 [&::-moz-range-thumb]:bg-bg";

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
  error,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
  error?: string;
}) {
  const id = useId();
  const fill = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return (
    <div className="grid">
      <div className="flex items-baseline justify-between gap-4 text-[13px]">
        <label htmlFor={id} className="font-medium">{label}</label>
        <output htmlFor={id} className={`tabular-nums ${SECONDARY}`}>{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--fill": `${fill}%` } as CSSProperties}
        className={RANGE}
      />
      <Issue message={error} />
    </div>
  );
}

export function Tile({
  label,
  note,
  selected,
  disabled,
  onSelect,
  children,
  ariaLabel,
  className = "",
}: {
  label: ReactNode;
  note?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children?: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={PRESS}
      onClick={onSelect}
      className={`relative grid min-h-11 content-start gap-1 overflow-hidden rounded-[18px] border p-2 text-left transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        selected ? "border-invert-bg bg-invert-bg text-invert-fg" : "border-fg/10 bg-bg/60 text-fg hover:border-fg/35"
      } ${className}`}
    >
      {children}
      <span className="px-0.5 text-[13px] font-medium leading-tight">{label}</span>
      {note ? <span className={`px-0.5 text-[12px] leading-tight ${selected ? "text-invert-fg/80" : SECONDARY}`}>{note}</span> : null}
    </motion.button>
  );
}

export function Tiles({ label, columns = 3, children }: { label: string; columns?: 2 | 3 | 4; children: ReactNode }) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns];
  return <div role="group" aria-label={label} className={`grid gap-2 ${grid}`}>{children}</div>;
}

export type Segment<T extends string | number> = { value: T; label: string; ariaLabel?: string };

export function Segments<T extends string | number>({
  label,
  value,
  segments,
  onChange,
  showLabel = true,
}: {
  label: string;
  value: T | null;
  segments: Segment<T>[];
  onChange: (value: T) => void;
  showLabel?: boolean;
}) {
  const index = segments.findIndex((segment) => segment.value === value);
  return (
    <div className="grid gap-1.5">
      {showLabel ? <span className="text-[13px] font-medium">{label}</span> : null}
      <div role="group" aria-label={label} className="relative grid rounded-full bg-fg/[0.07] p-1" style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}>
        {index >= 0 ? (
          <div className="pointer-events-none absolute inset-y-1 left-1" style={{ width: `calc((100% - 8px) / ${segments.length})` }}>
            <motion.span
              aria-hidden
              initial={false}
              animate={{ x: `${index * 100}%` }}
              transition={SPRING}
              className="block h-full rounded-full bg-invert-bg shadow-[0_2px_6px_rgb(23_49_42/0.25)]"
            />
          </div>
        ) : null}
        {segments.map((segment) => (
          <motion.button
            key={segment.value}
            type="button"
            aria-pressed={segment.value === value}
            aria-label={segment.ariaLabel}
            whileTap={{ scale: 0.96 }}
            transition={PRESS}
            onClick={() => onChange(segment.value)}
            className={`relative min-h-11 whitespace-nowrap rounded-full px-2 text-[13px] font-medium transition-colors duration-200 ${segment.value === value ? "text-invert-fg" : "text-fg"}`}
          >
            {segment.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ label, note, checked, disabled, onChange }: { label: string; note?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex min-h-11 items-center justify-between gap-4 text-[13px] font-medium ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
      <span>
        {label}
        {note ? <span className={`block font-normal leading-snug ${SECONDARY}`}>{note}</span> : null}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`flex h-[30px] w-[50px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg ${checked ? "justify-end bg-invert-bg" : "justify-start bg-fg/25"} ${disabled ? "opacity-40" : ""}`}
      >
        <motion.span layout transition={SPRING} className="block h-[26px] w-[26px] rounded-full bg-bg shadow-[0_2px_6px_rgb(23_49_42/0.3)]" />
      </span>
    </label>
  );
}

export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="rounded-[18px] border border-fg/10 bg-bg/40">
      <motion.button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        whileTap={{ scale: 0.98 }}
        transition={PRESS}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[18px] px-3 text-[13px] font-medium"
      >
        {label}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="grid place-items-center">
          <CaretDown size={14} weight="bold" />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING}
            className="overflow-hidden"
          >
            <div className="grid gap-1 px-3 pb-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function svgUri(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const FILTERED = (size: number, filter: string, body: string) =>
  svgUri(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><filter id="g" x="0" y="0" width="100%" height="100%">${filter}</filter>${body}</svg>`);

const shadowLight = (scale: number) => `<feDiffuseLighting surfaceScale="${scale}" diffuseConstant="1.15" lighting-color="#fff"><feDistantLight azimuth="235" elevation="62"/></feDiffuseLighting>`;
const glintLight = (scale: number, power: number) => `<feSpecularLighting surfaceScale="${scale}" specularConstant="0.5" specularExponent="${power}" lighting-color="#fff"><feDistantLight azimuth="235" elevation="28"/></feSpecularLighting>`;
const turbulence = (frequency: number, octaves: number) => `<feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="7" stitchTiles="stitch"/>`;
const SHEET = `<rect width="100%" height="100%" filter="url(#g)"/>`;

function noiseLayers(frequency: number, octaves: number, scale: number, power: number) {
  return {
    glint: FILTERED(220, turbulence(frequency, octaves) + glintLight(scale, power), SHEET),
    shadow: FILTERED(220, turbulence(frequency, octaves) + shadowLight(scale), SHEET),
  };
}

const SCALES_ART = Array.from({ length: 12 }, (_, row) =>
  Array.from({ length: 18 }, (_, column) => `<rect x="${column * 30 + (row % 2 ? 12 : -4)}" y="${row * 22 + 1}" width="27" height="19" rx="7"/>`).join(""),
).join("");
const CROC_SHAPE = `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16"/><feGaussianBlur stdDeviation="0.6"/>`;
const CROC = {
  glint: FILTERED(520, CROC_SHAPE + glintLight(2.2, 18), `<g filter="url(#g)">${SCALES_ART}</g>`),
  shadow: FILTERED(520, CROC_SHAPE + shadowLight(2.2), `<g filter="url(#g)">${SCALES_ART}</g>`),
};

const GRAIN: Record<(typeof FINISHES)[FinishKey]["grain"], { layers: { glint: string; shadow: string }; size: string; gloss: number; hatch?: boolean }> = {
  smooth: { layers: noiseLayers(0.5, 3, 0.35, 30), size: "220px", gloss: 0.17 },
  pebble: { layers: noiseLayers(0.07, 4, 2.6, 14), size: "150px", gloss: 0.07 },
  saffiano: { layers: noiseLayers(0.6, 2, 0.45, 44), size: "220px", gloss: 0.1, hatch: true },
  croc: { layers: CROC, size: "360px", gloss: 0.14 },
  suede: { layers: noiseLayers(0.85, 3, 0.5, 20), size: "220px", gloss: 0 },
};

const HATCH = "repeating-linear-gradient(45deg, rgb(255 255 255 / 0.1) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgb(0 0 0 / 0.2) 0 1px, transparent 1px 4px)";

export function leatherStyle(finish: FinishKey, color: ColorKey): CSSProperties {
  const { layers, size, gloss, hatch } = GRAIN[FINISHES[finish].grain];
  const images = [
    `radial-gradient(90% 70% at 28% 18%, rgb(255 255 255 / ${gloss}), transparent 70%)`,
    "linear-gradient(160deg, transparent 45%, rgb(0 0 0 / 0.16))",
    ...(hatch ? [HATCH] : []),
    layers.glint,
    layers.shadow,
  ];
  const sizes = ["auto", "auto", ...(hatch ? ["auto"] : []), size, size];
  const blends = ["normal", "normal", ...(hatch ? ["normal"] : []), "normal", "multiply"];
  return {
    backgroundColor: COLORS[color].hex,
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundBlendMode: blends.join(", "),
  };
}

export function LeatherSample({ finish, color, className = "", children }: { finish: FinishKey; color: ColorKey; className?: string; children?: ReactNode }) {
  return (
    <span aria-hidden className={`relative block overflow-hidden rounded-[12px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12),inset_0_-8px_14px_-10px_rgb(0_0_0/0.45)] ${className}`} style={leatherStyle(finish, color)}>
      {children}
    </span>
  );
}

function SelectedMark() {
  return (
    <span aria-hidden className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-bg text-invert-bg shadow-[0_1px_4px_rgb(0_0_0/0.35)]">
      <Check size={12} weight="bold" />
    </span>
  );
}

export function ColorGrid({ label, value, finish, onChange }: { label: string; value: ColorKey; finish: FinishKey; onChange: (color: ColorKey) => void }) {
  return (
    <div className="grid gap-1.5">
      <p className="flex items-baseline justify-between gap-4 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className={SECONDARY}>{COLORS[value].name}</span>
      </p>
      <div role="group" aria-label={label} className="grid grid-cols-4 gap-1.5">
        {(Object.keys(COLORS) as ColorKey[]).map((color) => (
          <motion.button
            key={color}
            type="button"
            aria-pressed={value === color}
            aria-label={COLORS[color].name}
            title={COLORS[color].name}
            whileTap={{ scale: 0.94 }}
            transition={PRESS}
            onClick={() => onChange(color)}
            className={`relative h-12 rounded-[14px] p-[3px] ring-2 transition-shadow duration-200 ${value === color ? "ring-invert-bg" : "ring-transparent hover:ring-fg/25"}`}
          >
            <LeatherSample finish={finish} color={color} className="h-full w-full rounded-[11px]" />
            {value === color ? <SelectedMark /> : null}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

const round = (value: number) => Math.round(value * 10) / 10;

function outlinePath({ cx, yb, yt, width, topWidth, cornerBottom, cornerTop, bulge, arc }: { cx: number; yb: number; yt: number; width: number; topWidth: number; cornerBottom: number; cornerTop: number; bulge: number; arc: number }) {
  const right = cx + width / 2;
  const left = cx - width / 2;
  const topRight = cx + topWidth / 2;
  const topLeft = cx - topWidth / 2;
  const midY = (yb + yt) / 2;
  const points = [
    `M${left + cornerBottom} ${yb}`,
    `L${right - cornerBottom} ${yb}`,
    `Q${right} ${yb} ${right} ${yb - cornerBottom}`,
    `Q${(right + topRight) / 2 + bulge * 2} ${midY} ${topRight} ${yt + cornerTop}`,
    `Q${topRight} ${yt} ${topRight - cornerTop} ${yt}`,
    `Q${cx} ${yt - arc * 2} ${topLeft + cornerTop} ${yt}`,
    `Q${topLeft} ${yt} ${topLeft} ${yt + cornerTop}`,
    `Q${(left + topLeft) / 2 - bulge * 2} ${midY} ${left} ${yb - cornerBottom}`,
    `Q${left} ${yb} ${left + cornerBottom} ${yb}`,
    "Z",
  ];
  return points.join(" ");
}

export function BagGlyph({ spec, unit, className = "" }: { spec: DesignSpec; unit?: number; className?: string }) {
  const clip = useId();
  const { form, closure, carry, panels, pocket } = spec;
  const handleRise = carry.handles ? Math.min(carry.handleDrop, form.height * 0.9) : 0;
  const strapRise = carry.strap ? form.height * 0.62 : 0;
  const reach = Math.max(handleRise, strapRise);
  const u = unit ?? Math.min(80 / (form.width * Math.max(1, form.taper) * (1 + form.belly * 0.2)), 60 / (form.height * (1 + Math.max(0, form.topArc) * 0.32) + reach));
  const cx = 50;
  const yb = 72;
  const width = form.width * u;
  const height = form.height * u;
  const topWidth = width * form.taper;
  const yt = yb - height;
  const arc = form.topArc * 0.32 * height;
  const limit = Math.min(width, height) / 2;
  const cornerBottom = Math.min(form.cornerBottom * u, limit);
  const cornerTop = Math.min(form.cornerTop * u, limit);
  const body = outlinePath({ cx, yb, yt, width, topWidth, cornerBottom, cornerTop, bulge: form.belly * 0.14 * width, arc });
  const flapDepth = height * closure.flapLength;
  const flapBottom = yt + flapDepth;
  const half = topWidth / 2 - 0.5;
  const flap =
    closure.flapShape === "point"
      ? `M${cx - half} ${yt} L${cx - half} ${yt + flapDepth * 0.55} L${cx} ${flapBottom} L${cx + half} ${yt + flapDepth * 0.55} L${cx + half} ${yt}`
      : closure.flapShape === "round"
        ? `M${cx - half} ${yt} L${cx - half} ${yt + flapDepth * 0.4} Q${cx - half} ${flapBottom} ${cx} ${flapBottom} Q${cx + half} ${flapBottom} ${cx + half} ${yt + flapDepth * 0.4} L${cx + half} ${yt}`
        : `M${cx - half} ${yt} L${cx - half} ${flapBottom - 2} Q${cx - half} ${flapBottom} ${cx - half + 2} ${flapBottom} L${cx + half - 2} ${flapBottom} Q${cx + half} ${flapBottom} ${cx + half} ${flapBottom - 2} L${cx + half} ${yt}`;
  const divideY = yb - height * panels.divide;
  const divideX = cx - width / 2 + width * panels.divide;
  const pocketWidth = width * 0.56;
  const pocketTop = yb - height * 0.46;
  const pocketBottom = yb - height * 0.12;
  const arcOver = (x: number, rise: number) => `M${cx - x} ${yt - arc * 0.6} C${cx - x} ${yt - rise * 1.3} ${cx + x} ${yt - rise * 1.3} ${cx + x} ${yt - arc * 0.6}`;

  return (
    <svg aria-hidden viewBox="0 0 100 76" className={`block h-auto w-full ${className}`} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <clipPath id={clip}><path d={body} /></clipPath>
      {carry.strap ? <path d={arcOver(topWidth * 0.46, strapRise * u)} strokeWidth="0.9" opacity="0.65" /> : null}
      {carry.handles === 2 ? <path d={arcOver(topWidth * 0.17, handleRise * u * 0.92)} opacity="0.5" /> : null}
      {carry.handles ? <path d={arcOver(topWidth * 0.24, handleRise * u)} /> : null}
      <path d={body} fill="currentColor" fillOpacity="0.12" />
      <g clipPath={`url(#${clip})`}>
        {panels.layout === "yoke" ? <path d={`M0 ${divideY} H100`} /> : null}
        {panels.layout === "split" ? <path d={`M${divideX} 0 V76`} /> : null}
        {panels.layout === "diagonal" ? <path d={`M${cx - width / 2 - 4} ${yb + 4} L${cx + width / 2 + 4} ${yt - 4}`} /> : null}
        {panels.layout === "tipped" ? (
          <path
            d={`M${cx - width / 2} ${yb - height * 0.3} L${cx - width * 0.2} ${yb} L${cx - width / 2} ${yb} Z M${cx + width / 2} ${yb - height * 0.3} L${cx + width * 0.2} ${yb} L${cx + width / 2} ${yb} Z`}
            fill="currentColor"
            fillOpacity="0.45"
          />
        ) : null}
        {pocket !== "none" ? (
          <>
            <path d={`M${cx - pocketWidth / 2} ${pocketTop} H${cx + pocketWidth / 2} V${pocketBottom} H${cx - pocketWidth / 2} Z`} strokeWidth="0.9" />
            {pocket === "zip" ? <path d={`M${cx - pocketWidth / 2 + 3} ${pocketTop + 3} H${cx + pocketWidth / 2 - 3}`} strokeWidth="1.5" /> : null}
          </>
        ) : null}
        {closure.type === "zip" ? <path d={`M${cx - half + 3} ${yt + 3} Q${cx} ${yt + 3 - arc * 2} ${cx + half - 3} ${yt + 3}`} strokeWidth="1.5" /> : null}
      </g>
      {closure.type === "flap" ? <path d={flap} fill="currentColor" fillOpacity="0.16" /> : null}
      {closure.type === "flap" && closure.clasp === "turnlock" ? <circle cx={cx} cy={flapBottom - 3.5} r="2.4" fill="currentColor" /> : null}
      {closure.type === "flap" && closure.clasp === "bar" ? <path d={`M${cx - 6} ${flapBottom - 3} H${cx + 6}`} strokeWidth="2.2" /> : null}
    </svg>
  );
}

export function SideGlyph({ pleated, depth }: { pleated: boolean; depth: number }) {
  const half = depth / 2;
  const top = 8;
  const bottom = 66;
  const left = 50 - half;
  const right = 50 + half;
  return (
    <svg aria-hidden viewBox="0 0 100 76" className="block h-auto w-full" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {pleated ? (
        <path d={`M${left} ${top} L${50 - half * 0.25} 37 L${left} ${bottom} H${right} L${50 + half * 0.25} 37 L${right} ${top} Z`} fill="currentColor" fillOpacity="0.12" />
      ) : (
        <path d={`M${left} ${top} V${bottom} H${right} V${top} Z`} fill="currentColor" fillOpacity="0.12" />
      )}
    </svg>
  );
}
