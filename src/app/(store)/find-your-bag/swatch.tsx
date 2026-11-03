import type { CSSProperties, ReactNode } from "react";
import { COLORS, type ColorKey, type FinishKey } from "@/lib/studio/spec";

export const STEP_SPRING = { type: "spring", bounce: 0.14, visualDuration: 0.42 } as const;

const LIGHT: ColorKey[] = ["ivory", "tan", "rose", "sage", "ochre"];

export const isLightLeather = (color: ColorKey) => LIGHT.includes(color);

export function Leather({ color, finish = "pebble", className = "", style, children }: { color: ColorKey; finish?: FinishKey; className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <span className={`relative isolate block overflow-hidden ${className}`} style={{ backgroundColor: COLORS[color].hex, ...style }}>
      <span
        aria-hidden
        className="absolute inset-0 opacity-[0.55] mix-blend-overlay [filter:grayscale(1)_contrast(1.6)]"
        style={{ backgroundImage: `url(/textures/${finish}-detail-640.webp)`, backgroundSize: "220px" }}
      />
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(120%_90%_at_28%_18%,rgb(255_255_255/0.28),transparent_55%),radial-gradient(120%_120%_at_80%_100%,rgb(0_0_0/0.32),transparent_60%)]" />
      {children}
    </span>
  );
}
