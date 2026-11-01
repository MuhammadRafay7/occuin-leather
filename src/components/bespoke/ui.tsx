"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { PRESS } from "@/components/studio/controls";

export const GLASS_PANEL = "glass-panel !bg-bg/88";
export const GLASS_PILL = "rounded-full border border-white/60 bg-bg/90 text-fg shadow-[0_6px_18px_-8px_rgb(0_0_0/0.5)]";
export const ICON_BUTTON = "grid h-10 w-10 place-items-center rounded-full text-fg transition-colors duration-200 hover:bg-fg/10 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";
export const FIELD = "h-11 w-full rounded-full border border-fg/20 bg-bg px-4 text-[14px] text-fg placeholder:text-fg/60 focus:border-fg focus:outline-none";
export const AREA = "w-full rounded-[18px] border border-fg/20 bg-bg px-4 py-3 text-[14px] text-fg placeholder:text-fg/60 focus:border-fg focus:outline-none";

export function ToolPill({
  label,
  icon,
  pressed,
  disabled,
  onClick,
  compact = false,
  shortcut,
}: {
  label: string;
  icon: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
  shortcut?: string;
}) {
  return (
    <motion.button
      type="button"
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={PRESS}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full text-[13px] font-medium transition-colors duration-200 hover:bg-fg/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-invert-bg aria-pressed:text-invert-fg aria-pressed:hover:bg-invert-bg ${compact ? "px-3" : "w-full px-3"}`}
    >
      {icon}
      {label}
    </motion.button>
  );
}

export function FormField({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[13px] font-medium">
      <span>{label}</span>
      {children}
      {hint && !error ? <span className="text-[12px] font-normal text-fg/75">{hint}</span> : null}
      {error ? <span role="alert" className="text-[12px] font-normal text-danger">{error}</span> : null}
    </label>
  );
}
