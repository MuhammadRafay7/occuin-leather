import type { DesignSpec } from "./spec";

export const INITIALS_PATTERN = /^[A-Za-z&. ]{0,4}$/;

export const cleanInitials = (value: string) => value.replace(/[^A-Za-z&. ]/g, "").slice(0, 4).toUpperCase();

export function initialsPlacement({ monogram, closure, pocket }: Pick<DesignSpec, "monogram" | "closure" | "pocket">): DesignSpec["monogram"]["placement"] {
  if (monogram.placement !== "center") return monogram.placement;
  if (closure.type === "flap") return "flap";
  return pocket === "none" ? "center" : "corner";
}

export function withInitials(spec: DesignSpec, text: string): DesignSpec {
  const letters = cleanInitials(text).trim();
  if (!letters) return spec;
  const { monogram, hardware } = spec;
  const foil = monogram.technique !== "blind" ? monogram.technique : hardware.metal === "gold" || hardware.metal === "brass" ? "gold" : "palladium";
  return { ...spec, monogram: { ...monogram, text: letters, technique: foil, placement: initialsPlacement(spec) } };
}
