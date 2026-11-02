"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { money } from "@/lib/format";

export type ChartPoint = { day: string; cents: number; orders: number; previousDay: string; previousCents: number };

const HEIGHT = 260;
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };

const label = (day: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
const compact = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

function niceMax(value: number) {
  if (value <= 0) return 10_000;
  const step = 10 ** Math.floor(Math.log10(value));
  const fraction = value / step;
  const nice = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((candidate) => fraction <= candidate) ?? 10;
  return nice * step;
}

function pathOf(values: number[], x: (index: number) => number, y: (value: number) => number) {
  return values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
}

export function RevenueChart({ points }: { points: ChartPoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry!.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const top = niceMax(Math.max(...points.flatMap((point) => [point.cents, point.previousCents])));
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const last = Math.max(1, points.length - 1);
  const x = (index: number) => PAD.left + (points.length === 1 ? innerWidth / 2 : (index / last) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerWidth / 80))));
  const selected = active === null ? null : points[active];

  function pick(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left - PAD.left) / innerWidth;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * last))));
  }

  function step(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const move = event.key === "ArrowLeft" ? -1 : 1;
    setActive((current) => Math.min(points.length - 1, Math.max(0, (current ?? (move < 0 ? points.length : -1)) + move)));
  }

  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--adm-accent)" strokeWidth="2" /></svg>
          This period
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="4" aria-hidden="true"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--muted)" strokeWidth="2" strokeDasharray="4 3" /></svg>
          Previous period
        </span>
      </figcaption>
      <div ref={box} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          tabIndex={0}
          aria-label="Sales by day. Use the left and right arrow keys to read each day. The table below has the same figures."
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
          onKeyDown={step}
          onBlur={() => setActive(null)}
          className="block max-w-full touch-pan-y focus:outline-1 focus:outline-line"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((share) => (
            <g key={share}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(top * share)} y2={y(top * share)} stroke="var(--line)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(top * share) + 4} textAnchor="end" fontSize="11" fill="var(--muted)" className="tabular-nums">{compact(top * share)}</text>
            </g>
          ))}
          {points.map((point, index) =>
            index % labelEvery === 0 ? (
              <text key={point.day} x={x(index)} y={HEIGHT - 8} textAnchor={index === 0 && points.length > 1 ? "start" : "middle"} fontSize="11" fill="var(--muted)">{label(point.day)}</text>
            ) : null,
          )}
          <path d={pathOf(points.map((point) => point.previousCents), x, y)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
          <path d={pathOf(points.map((point) => point.cents), x, y)} fill="none" stroke="var(--adm-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.length === 1 ? <circle cx={x(0)} cy={y(points[0]!.cents)} r="4" fill="var(--adm-accent)" /> : null}
          {selected ? (
            <>
              <line x1={x(active!)} x2={x(active!)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--muted)" strokeWidth="1" />
              <circle cx={x(active!)} cy={y(selected.previousCents)} r="4" fill="var(--muted)" stroke="var(--bg)" strokeWidth="2" />
              <circle cx={x(active!)} cy={y(selected.cents)} r="4" fill="var(--adm-accent)" stroke="var(--bg)" strokeWidth="2" />
            </>
          ) : null}
        </svg>
        {selected ? (
          <div
            role="status"
            className="adm-card pointer-events-none absolute top-1 z-10 w-48 p-2 text-xs"
            style={x(active!) > width / 2 ? { right: width - x(active!) + 10 } : { left: x(active!) + 10 }}
          >
            <p className="font-medium">{label(selected.day)}</p>
            <p className="tabular-nums">{money(selected.cents)}, {selected.orders} {selected.orders === 1 ? "order" : "orders"}</p>
            <p className="tabular-nums text-muted">{label(selected.previousDay)}: {money(selected.previousCents)}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}
