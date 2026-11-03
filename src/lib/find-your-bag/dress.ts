import { z } from "zod";
import { withInitials } from "../studio/initials";
import { COLORS, normalizeSpec, type ColorKey, type DesignSpec } from "../studio/spec";

export const INITIALS_PATTERN = /^[A-Za-z]{1,3}$/;

export const initialsSchema = z
  .string()
  .trim()
  .regex(INITIALS_PATTERN)
  .transform((value) => value.toUpperCase());

export const colorSchema = z.custom<ColorKey>((value) => typeof value === "string" && Object.hasOwn(COLORS, value));

export function dressSpec(spec: DesignSpec, color: ColorKey, initials: string | null = null): DesignSpec {
  const { primary, gusset } = spec.panels;
  const coloured = { ...spec, panels: { ...spec.panels, primary: { ...primary, color }, gusset: { ...gusset, color } } };
  if (!initials) return normalizeSpec(coloured);
  return normalizeSpec(withInitials(coloured, initials));
}
