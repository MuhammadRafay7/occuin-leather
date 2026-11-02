"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChartCard } from "./ui";

export type ChartDatum = { label: string; value: number };

const HEIGHT = 224;
const PAD = { top: 8, right: 8, bottom: 22, left: 40 };
const DONUT = 148;
const RING = 22;
const SLICE_COLORS = ["var(--adm-chart-1)", "var(--adm-chart-2)", "var(--adm-chart-3)", "var(--adm-chart-4)", "var(--adm-chart-5)", "var(--adm-chart-6)"];

function niceMax(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  return ([1, 2, 3, 5, 10].find((candidate) => value / step <= candidate) ?? 10) * step;
}

function TrendChart({ data, color, area, label, format, tick }: { data: ChartDatum[]; color: string; area: boolean; label: string; format: (value: number) => string; tick: (value: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry!.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const top = niceMax(Math.max(...data.map((item) => item.value)));
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const last = Math.max(1, data.length - 1);
  const x = (index: number) => PAD.left + (index / last) * innerWidth;
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;
  const line = data.map((item, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(item.value).toFixed(1)}`).join(" ");
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerWidth / 64))));
  const selected = active === null ? null : data[active];

  const pick = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(((event.clientX - bounds.left - PAD.left) / innerWidth) * last))));
  };

  const step = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const move = event.key === "ArrowLeft" ? -1 : 1;
    setActive((current) => Math.min(data.length - 1, Math.max(0, (current ?? (move < 0 ? data.length : -1)) + move)));
  };

  return (
    <div ref={box} className="relative">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" tabIndex={0} aria-label={`${label}. Use the left and right arrow keys to read each day.`} className="block max-w-full touch-pan-y" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)} onKeyDown={step} onBlur={() => setActive(null)}>
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(top * share)} y2={y(top * share)} stroke="var(--line)" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y(top * share) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{tick(top * share)}</text>
          </g>
        ))}
        {data.map((item, index) => (index % every === 0 ? <text key={item.label} x={x(index)} y={HEIGHT - 6} textAnchor={index === 0 ? "start" : "middle"} fontSize="10" fill="var(--muted)">{item.label}</text> : null))}
        {area ? <path d={`${line} L${x(data.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={color} fillOpacity="0.14" /> : null}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {selected ? (
          <>
            <line x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--line)" />
            <circle cx={x(active!)} cy={y(selected.value)} r="4" fill={color} stroke="var(--bg)" strokeWidth="2" />
          </>
        ) : null}
      </svg>
      {selected ? (
        <div role="status" className="adm-card pointer-events-none absolute top-1 z-10 px-3 py-2 text-xs" style={x(active!) > width / 2 ? { right: width - x(active!) + 10 } : { left: x(active!) + 10 }}>
          <p className="font-semibold">{selected.label}</p>
          <p className="whitespace-nowrap tabular-nums">{format(selected.value)}</p>
        </div>
      ) : null}
    </div>
  );
}

export function CustomerGrowthChart({ data }: { data: ChartDatum[] }) {
  return (
    <ChartCard title="New customers">
      {data.some((item) => item.value > 0) ? <TrendChart data={data} color="#f59e0b" area={false} label="New customers by day" format={(value) => `${value} new ${value === 1 ? "customer" : "customers"}`} tick={(value) => String(Math.round(value * 10) / 10)} /> : <div className="adm-chart-empty">No new customers yet. They will show here when people sign up.</div>}
    </ChartCard>
  );
}

export function RevenueAreaChart({ data }: { data: ChartDatum[] }) {
  const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
  return (
    <ChartCard title="Sales">
      {data.some((item) => item.value > 0) ? <TrendChart data={data} color="var(--adm-chart-1)" area label="Gross revenue by day" format={(value) => dollars.format(value / 100)} tick={(value) => compact.format(value / 100)} /> : <div className="adm-chart-empty">No sales yet. Your sales will show here.</div>}
    </ChartCard>
  );
}

export function CategoryDonut({ data }: { data: ChartDatum[] }) {
  const slices = data.filter((item) => item.value > 0);
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const radius = (DONUT - RING) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = slices.map((item, index) => ({
    ...item,
    length: (item.value / total) * circumference,
    start: slices.slice(0, index).reduce((sum, earlier) => sum + (earlier.value / total) * circumference, 0),
  }));

  return (
    <ChartCard title="Products by type">
      {total ? (
        <div className="grid h-56 grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          <svg width={DONUT} height={DONUT} viewBox={`0 0 ${DONUT} ${DONUT}`} role="img" aria-label={slices.map((item) => `${item.label}: ${item.value}`).join(", ")}>
            <g transform={`rotate(-90 ${DONUT / 2} ${DONUT / 2})`}>
              {arcs.map((arc, index) => (
                <circle key={arc.label} cx={DONUT / 2} cy={DONUT / 2} r={radius} fill="none" stroke={SLICE_COLORS[index % SLICE_COLORS.length]} strokeWidth={RING} strokeDasharray={`${Math.max(0, arc.length - 1.5)} ${circumference}`} strokeDashoffset={-arc.start} />
              ))}
            </g>
            <text x={DONUT / 2} y={DONUT / 2 + 6} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--fg)">{total}</text>
          </svg>
          <ul className="grid min-w-0 gap-1.5 text-xs">
            {slices.map((item, index) => (
              <li key={item.label} className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="adm-chart-empty">Add your first product to see this.</div>}
    </ChartCard>
  );
}
