import { CaretDown, Image as ImageIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { ReactNode } from "react";
import { buttonClass, controlClass, StatGrid } from "./ui";

const SUMMARY = "cursor-pointer list-none [&::-webkit-details-marker]:hidden";

export const StatStrip = ({ children, columns = 4 }: { children: ReactNode; columns?: number }) => (
  <div className="mb-4">
    <StatGrid columns={columns}>{children}</StatGrid>
  </div>
);

export function Thumb({ src, size = 40 }: { src: string | null; size?: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-[6px] border border-line bg-surface" style={{ width: size, height: size }}>
      {src ? (
        <Image unoptimized fill sizes={`${size}px`} src={src} alt="" className="object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted"><ImageIcon size={16} aria-hidden="true" /></span>
      )}
    </span>
  );
}

export function FilterSelect({ label, name, value, options, width = "w-32" }: { label: string; name: string; value: string; options: readonly (readonly [string, string])[]; width?: string }) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <select name={name} defaultValue={value} className={`${controlClass} ${width}`}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

export function MoreMenu({ children }: { children: ReactNode }) {
  return (
    <details className="relative">
      <summary className={`${buttonClass} ${SUMMARY}`}>More<CaretDown size={12} aria-hidden="true" /></summary>
      <div className="adm-menu bottom-auto left-auto right-0 top-[calc(100%+4px)] max-sm:left-0 max-sm:right-auto">{children}</div>
    </details>
  );
}

export function MoreInline({ label = "More", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="min-w-0">
      <summary className={`${buttonClass} ${SUMMARY}`}>{label}<CaretDown size={12} aria-hidden="true" /></summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

export function MoreFilters({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <details open={active} className="self-end [&[open]]:basis-full">
      <summary className={`${buttonClass} ${SUMMARY}`}>More filters<CaretDown size={12} aria-hidden="true" /></summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">{children}</div>
    </details>
  );
}
