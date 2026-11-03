import type { ColorKey, DesignSpec } from "../studio/spec";

export const STORY_STEPS = ["shape", "leather", "panels", "closure", "stitch", "carry"] as const;
export type StoryStep = (typeof STORY_STEPS)[number];

export function storyStage(target: DesignSpec, stage: number): DesignSpec {
  const plain = { finish: "box", color: "ivory" } as const;
  const reached = (step: StoryStep) => stage >= STORY_STEPS.indexOf(step);
  return {
    ...target,
    panels: reached("panels")
      ? target.panels
      : { ...target.panels, layout: "single", primary: reached("leather") ? target.panels.primary : plain, gusset: reached("leather") ? target.panels.gusset : plain },
    surface: reached("panels") ? target.surface : { pattern: "none", scale: 1 },
    closure: reached("closure") ? target.closure : { ...target.closure, type: "open", clasp: "none" },
    pocket: reached("closure") ? target.pocket : "none",
    hardware: reached("closure") ? target.hardware : { ...target.hardware, feet: false },
    stitch: reached("stitch") ? target.stitch : { ...target.stitch, thread: "self", rows: 1 },
    edgeColor: reached("stitch") ? target.edgeColor : reached("leather") ? target.panels.primary.color : "ivory",
    carry: reached("carry") ? target.carry : { ...target.carry, handles: 0, strap: false },
    monogram: reached("stitch") ? target.monogram : { ...target.monogram, text: "" },
  };
}

export function recolor(spec: DesignSpec, color: ColorKey | null): DesignSpec {
  if (!color) return spec;
  const { primary, gusset } = spec.panels;
  const matched = gusset.color === primary.color;
  return { ...spec, panels: { ...spec.panels, primary: { ...primary, color }, gusset: matched ? { ...gusset, color } : gusset } };
}
