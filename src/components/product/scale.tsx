"use client";

import { Check, Minus } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Shape = "page" | "laptop" | "phone" | "bottle" | "card" | "book";
export type ScaleItem = { key: string; name: string; phrase: string; width: number; height: number; depth: number; shape: Shape; fits: boolean };
export type ScaleBag = {
  name: string;
  width: number;
  height: number;
  depth: number;
  taper: number;
  cornerBottom: number;
  cornerTop: number;
  handles: number;
  handleDrop: number;
  handleWidth: number;
  flap: number;
  colour: string;
};

const cm = (mm: number) => {
  const value = mm / 10;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} cm`;
};

function roundedPolygon(points: [number, number][], radii: number[]) {
  const count = points.length;
  let path = "";
  points.forEach((point, index) => {
    const previous = points[(index + count - 1) % count]!;
    const next = points[(index + 1) % count]!;
    const toward = (target: [number, number], distance: number): [number, number] => {
      const dx = target[0] - point[0];
      const dy = target[1] - point[1];
      const length = Math.hypot(dx, dy) || 1;
      const step = Math.min(distance, length / 2);
      return [point[0] + (dx / length) * step, point[1] + (dy / length) * step];
    };
    const start = toward(previous, radii[index]!);
    const end = toward(next, radii[index]!);
    path += `${index === 0 ? "M" : "L"}${start[0]},${start[1]} Q${point[0]},${point[1]} ${end[0]},${end[1]} `;
  });
  return `${path}Z`;
}

function BagShape({ bag, x, base }: { bag: ScaleBag; x: number; base: number }) {
  const top = base - bag.height;
  const halfBottom = bag.width / 2;
  const halfTop = (bag.width * bag.taper) / 2;
  const outline = roundedPolygon(
    [
      [x - halfTop, top],
      [x + halfTop, top],
      [x + halfBottom, base],
      [x - halfBottom, base],
    ],
    [bag.cornerTop, bag.cornerTop, bag.cornerBottom, bag.cornerBottom],
  );
  const flapDepth = bag.height * bag.flap;
  const handleSpan = Math.max(halfTop * 0.5, 14);
  const lift = bag.handleDrop * 1.33;
  const handle = (offset: number) =>
    `M${x - handleSpan + offset},${top + 2} C${x - handleSpan + offset},${top - lift} ${x + handleSpan + offset},${top - lift} ${x + handleSpan + offset},${top + 2}`;
  return (
    <g>
      {bag.handles ? (
        <g fill="none" stroke={bag.colour} strokeWidth={Math.max(bag.handleWidth * 0.55, 3)} strokeLinecap="round">
          <path d={handle(0)} />
          {bag.handles === 2 ? <path d={handle(0)} opacity={0.55} transform={`translate(0 ${-Math.min(bag.handleDrop * 0.08, 10)})`} /> : null}
        </g>
      ) : null}
      <path d={outline} fill={bag.colour} />
      <path d={outline} fill="url(#scale-sheen)" stroke="rgb(244 239 230 / 0.4)" strokeWidth={Math.max(bag.width * 0.004, 0.6)} />
      {bag.flap ? (
        <path d={`M${x - halfTop + 2},${top + flapDepth} Q${x},${top + flapDepth + bag.height * 0.05} ${x + halfTop - 2},${top + flapDepth}`} fill="none" stroke="rgb(0 0 0 / 0.28)" strokeWidth={Math.max(bag.width * 0.006, 0.8)} />
      ) : null}
    </g>
  );
}

function ItemShape({ item, x, base }: { item: ScaleItem; x: number; base: number }) {
  const left = x - item.width / 2;
  const top = base - item.height;
  const { width, height } = item;
  const shapes: Record<Shape, ReactNode> = {
    page: (
      <g>
        <rect x={left} y={top} width={width} height={height} fill="#fbfaf6" stroke="rgb(20 32 28 / 0.25)" strokeWidth={1} />
        {Array.from({ length: 9 }, (_, line) => (
          <rect key={line} x={left + width * 0.14} y={top + height * (0.14 + line * 0.075)} width={width * (line % 3 === 2 ? 0.48 : 0.72)} height={height * 0.012} fill="rgb(20 32 28 / 0.14)" />
        ))}
      </g>
    ),
    laptop: (
      <g>
        <rect x={left} y={top} width={width} height={height} rx={10} fill="#c9ccd0" />
        <rect x={left} y={top} width={width} height={height} rx={10} fill="url(#scale-sheen)" />
        <circle cx={x} cy={top + height / 2} r={Math.min(width, height) * 0.045} fill="rgb(255 255 255 / 0.55)" />
      </g>
    ),
    phone: (
      <g>
        <rect x={left} y={top} width={width} height={height} rx={11} fill="#1d2321" />
        <rect x={left + 3} y={top + 3} width={width - 6} height={height - 6} rx={9} fill="#3b5a50" />
        <rect x={x - 9} y={top + 7} width={18} height={5} rx={2.5} fill="#1d2321" />
      </g>
    ),
    bottle: (
      <g fill="#cfe1e6" stroke="rgb(20 32 28 / 0.2)" strokeWidth={1}>
        <rect x={x - 17} y={top} width={34} height={22} rx={4} fill="#3b5a50" stroke="none" />
        <path d={`M${x - 15},${top + 22} L${x + 15},${top + 22} L${x + 15},${top + 40} Q${x + width / 2},${top + 52} ${x + width / 2},${top + 72} L${x + width / 2},${base - 10} Q${x + width / 2},${base} ${x + width / 2 - 10},${base} L${x - width / 2 + 10},${base} Q${x - width / 2},${base} ${x - width / 2},${base - 10} L${x - width / 2},${top + 72} Q${x - width / 2},${top + 52} ${x - 15},${top + 40} Z`} />
      </g>
    ),
    card: (
      <g>
        <rect x={left} y={top} width={width} height={height} rx={3.5} fill="#e9e4d8" />
        <rect x={left + width * 0.1} y={top + height * 0.32} width={width * 0.15} height={height * 0.22} rx={1.5} fill="#d9b061" />
      </g>
    ),
    book: (
      <g>
        <rect x={left} y={top} width={width} height={height} rx={3} fill={item.key === "passport" ? "#561521" : "#d8cdb8"} />
        <rect x={left} y={top} width={width * 0.06} height={height} fill="rgb(0 0 0 / 0.14)" />
      </g>
    ),
  };
  return shapes[item.shape];
}

const TEXT_PX = 12;

function useFitToPixels(width: number, height: number) {
  const box = useRef<HTMLDivElement>(null);
  const [units, setUnits] = useState(1.6);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      if (!node.clientWidth || !node.clientHeight) return;
      const next = Math.max(width / node.clientWidth, height / node.clientHeight);
      setUnits((current) => (Math.abs(current - next) / next < 0.03 ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width, height]);
  return { box, units };
}

function Drawing({ bag, item }: { bag: ScaleBag; item: ScaleItem | null }) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const { box, units } = useFitToPixels(size.width, size.height);
  const gap = Math.max(bag.width, item?.width ?? 0) * 0.28;
  const pad = Math.max(bag.width, bag.height) * 0.08;
  const handleRise = bag.handles ? bag.handleDrop : 0;
  const tallest = Math.max(bag.height + handleRise, item?.height ?? 0);
  const label = TEXT_PX * 1.7 * units;
  const bagSpan = bag.width * Math.max(bag.taper, 1);
  const span = bagSpan + (item ? gap + item.width : 0);
  const viewWidth = span + pad * 2 + label;
  const viewHeight = tallest + pad + label * 2.6;
  const base = pad + tallest;
  const bagX = pad + label + bagSpan / 2;
  const itemX = bagX + bagSpan / 2 + gap + (item?.width ?? 0) / 2;
  if (size.width !== viewWidth || size.height !== viewHeight) setSize({ width: viewWidth, height: viewHeight });
  const stroke = Math.max(viewWidth * 0.0022, 0.6);
  const tick = label * 0.35;
  return (
    <div ref={box} className="size-full">
    <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="xMidYMid meet" className="size-full" aria-hidden>
      <defs>
        <linearGradient id="scale-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <line x1={0} x2={viewWidth} y1={base} y2={base} stroke="rgb(244 239 230 / 0.25)" strokeWidth={stroke} />
      <BagShape bag={bag} x={bagX} base={base} />
      {item ? <ItemShape item={item} x={itemX} base={base} /> : null}
      <g stroke="rgb(244 239 230 / 0.7)" strokeWidth={stroke} fill="none">
        <path d={`M${bagX - bag.width / 2},${base + label * 0.7} H${bagX + bag.width / 2} M${bagX - bag.width / 2},${base + label * 0.7 - tick} v${tick * 2} M${bagX + bag.width / 2},${base + label * 0.7 - tick} v${tick * 2}`} />
        <path d={`M${pad + label * 0.35},${base} V${base - bag.height} M${pad + label * 0.35 - tick},${base} h${tick * 2} M${pad + label * 0.35 - tick},${base - bag.height} h${tick * 2}`} />
      </g>
      <g fill="#f4efe6" fontSize={TEXT_PX * units} fontFamily="var(--font-geist), system-ui, sans-serif">
        <text x={bagX} y={base + label * 1.75} textAnchor="middle">{cm(bag.width)}</text>
        <text x={pad} y={base - bag.height / 2} textAnchor="middle" transform={`rotate(-90 ${pad} ${base - bag.height / 2})`}>{cm(bag.height)}</text>
        {item ? <text x={itemX} y={base + label * 1.75} textAnchor="middle" fillOpacity={0.75}>{cm(item.width)} × {cm(item.height)}</text> : null}
      </g>
    </svg>
    </div>
  );
}

export type ScaleLeather = { finish: string; note: string; colour: string; hex: string };

export function Scale({ bag, items, carry, leather, basis }: { bag: ScaleBag; items: ScaleItem[]; carry: string[]; leather: ScaleLeather | null; basis: string }) {
  const largestFit = [...items].reverse().find((item) => item.fits);
  const [chosen, setChosen] = useState(largestFit?.key ?? items[0]?.key ?? null);
  const item = items.find((entry) => entry.key === chosen) ?? null;
  const headingId = useId();
  const fitting = items.filter((entry) => entry.fits);

  return (
    <section id="size" aria-labelledby={headingId} className="mt-12 scroll-mt-24 md:mt-16">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-8">
        <figure className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(90%_90%_at_38%_40%,#3b5a50_0%,#20403a_50%,#0f211d_100%)] p-4 pt-12 md:p-6 md:pt-14">
          <div className="aspect-[4/3] w-full md:aspect-[16/10]">
            <Drawing bag={bag} item={item} />
          </div>
          <figcaption className="glass-panel absolute left-3 top-3 rounded-full px-3 py-1.5 text-[12px] md:left-4 md:top-4">
            {bag.name}{item ? ` beside ${item.phrase}` : ""}, to scale
          </figcaption>
        </figure>

        <div className="flex flex-col">
          <h2 id={headingId} className="font-display text-[30px] leading-[1.1] text-invert-bg md:text-[36px]">Size, made real</h2>
          <p className="mt-2 text-sm leading-[1.6] text-fg/80">
            {cm(bag.width)} wide, {cm(bag.height)} tall and {cm(bag.depth)} deep.{" "}
            {fitting.length ? `By its measurements, ${fitting.map((entry) => entry.phrase).slice(-2).reverse().join(" or ")} fits inside.` : "Compare it with things you already carry."}
          </p>

          <div role="group" aria-label="Compare with" className="mt-4 grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
            {items.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={entry.key === chosen}
                onClick={() => setChosen(entry.key)}
                className="flex min-h-12 items-center justify-between gap-2 rounded-[18px] border border-fg/12 bg-white/60 px-3 py-2 sm:px-3.5 text-left text-[13px] transition hover:border-fg/40 active:scale-[0.98] aria-pressed:border-invert-bg aria-pressed:bg-invert-bg aria-pressed:text-invert-fg"
              >
                <span className="leading-tight">{entry.name}</span>
                <span className={`flex shrink-0 items-center gap-1 text-[11px] ${entry.fits ? "" : "opacity-70"}`}>
                  {entry.fits ? <Check size={13} weight="bold" aria-hidden /> : <Minus size={13} aria-hidden />}
                  {entry.fits ? "Fits" : "Too big"}
                </span>
              </button>
            ))}
          </div>

          <dl className="mt-5 grid gap-2.5 border-t border-fg/10 pt-4 text-[13px]">
            {leather ? (
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <dt className="text-fg/70">Leather</dt>
                <dd className="flex gap-2.5">
                  <span aria-hidden className="mt-0.5 size-5 shrink-0 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: leather.hex }} />
                  <span>
                    {leather.finish}, {leather.colour}.
                    <span className="block text-fg/65">{leather.note}.</span>
                  </span>
                </dd>
              </div>
            ) : null}
            <div className="grid grid-cols-[72px_1fr] gap-2">
              <dt className="text-fg/70">Carry</dt>
              <dd>{carry.join(". ")}.</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] leading-snug text-fg/65">{basis}</p>
        </div>
      </div>
    </section>
  );
}
