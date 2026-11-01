import { z } from "zod";

export const FINISHES = {
  box: { name: "Box calf", note: "Dense, glazed, ages to a deep shine", grain: "smooth", roughness: 0.5, clearcoat: 0.12, sheen: 0, centsPerDm2: 190 },
  pebble: { name: "Pebbled bull", note: "Soft tumbled grain, forgiving and supple", grain: "pebble", roughness: 0.56, clearcoat: 0.08, sheen: 0, centsPerDm2: 170 },
  saffiano: { name: "Saffiano", note: "Cross-hatched and scratch resistant", grain: "saffiano", roughness: 0.42, clearcoat: 0.25, sheen: 0, centsPerDm2: 210 },
  croc: { name: "Croc-embossed calf", note: "Hand-plated scale, polished by agate", grain: "croc", roughness: 0.34, clearcoat: 0.4, sheen: 0, centsPerDm2: 300 },
  suede: { name: "Goat suede", note: "Velvet nap, brushed by hand", grain: "suede", roughness: 0.95, clearcoat: 0, sheen: 1, centsPerDm2: 180 },
} as const;

export const COLORS = {
  noir: { name: "Noir", hex: "#16130f" },
  espresso: { name: "Espresso", hex: "#3a2318" },
  cognac: { name: "Cognac", hex: "#8a4a21" },
  tan: { name: "Vachetta", hex: "#c08a58" },
  ivory: { name: "Craie", hex: "#e6dccb" },
  bordeaux: { name: "Bordeaux", hex: "#561521" },
  forest: { name: "Sapin", hex: "#1e3a2e" },
  navy: { name: "Nuit", hex: "#17233f" },
  rose: { name: "Poudre", hex: "#cf9f96" },
  sage: { name: "Sauge", hex: "#8c9a82" },
  ochre: { name: "Ocre", hex: "#b98a26" },
  cobalt: { name: "Cobalt", hex: "#1f43a0" },
} as const;

export const THREADS = {
  self: { name: "Tone on tone", hex: "" },
  ivory: { name: "Linen", hex: "#efe6d4" },
  honey: { name: "Saddle honey", hex: "#c8913f" },
  noir: { name: "Noir", hex: "#191512" },
  bordeaux: { name: "Bordeaux", hex: "#7a1f2e" },
} as const;

export const METALS = {
  gold: { name: "Polished gold", hex: "#d9b061", roughness: 0.18, cents: 0 },
  palladium: { name: "Palladium", hex: "#d6d6d2", roughness: 0.16, cents: 0 },
  brass: { name: "Aged brass", hex: "#a88444", roughness: 0.42, cents: 0 },
  gunmetal: { name: "Gunmetal", hex: "#4a4b4e", roughness: 0.3, cents: 0 },
  noir: { name: "Matte noir", hex: "#1c1c1d", roughness: 0.55, cents: 300 },
} as const;

export const PATTERNS = {
  none: { name: "Plain hide", cents: 0 },
  quilted: { name: "Diamond quilt", cents: 3000 },
  woven: { name: "Hand woven", cents: 5000 },
  perforated: { name: "Perforated", cents: 1800 },
  signature: { name: "Your initials, all over", cents: 4000 },
} as const;

const key = <T extends Record<string, unknown>>(record: T) =>
  z.enum(Object.keys(record) as [keyof T & string, ...(keyof T & string)[]]);

const hide = z.object({ finish: key(FINISHES), color: key(COLORS) });

export const designSpecSchema = z
  .object({
    version: z.literal(1),
    name: z.string().trim().min(1).max(60),
    form: z.object({
      width: z.number().int().min(90).max(600),
      height: z.number().int().min(60).max(450),
      depth: z.number().int().min(6).max(300),
      taper: z.number().min(0.6).max(1.2),
      belly: z.number().min(0).max(1),
      topArc: z.number().min(-1).max(1),
      cornerBottom: z.number().int().min(2).max(160),
      cornerTop: z.number().int().min(2).max(160),
      softness: z.number().min(0).max(1),
      gusset: z.enum(["flat", "bellows"]),
    }),
    panels: z.object({
      layout: z.enum(["single", "yoke", "split", "diagonal", "tipped"]),
      divide: z.number().min(0.2).max(0.8),
      primary: hide,
      accent: hide,
      gusset: hide,
    }),
    surface: z.object({ pattern: key(PATTERNS), scale: z.number().min(0.6).max(1.6) }),
    closure: z.object({
      type: z.enum(["open", "zip", "flap"]),
      flapShape: z.enum(["straight", "round", "point"]),
      flapLength: z.number().min(0.25).max(1),
      clasp: z.enum(["none", "turnlock", "bar"]),
    }),
    carry: z.object({
      handles: z.number().int().min(0).max(2),
      handleDrop: z.number().int().min(50).max(320),
      handleWidth: z.number().int().min(8).max(30),
      strap: z.boolean(),
      strapLength: z.number().int().min(500).max(1300),
      strapWidth: z.number().int().min(10).max(50),
    }),
    pocket: z.enum(["none", "slip", "zip"]),
    hardware: z.object({ metal: key(METALS), feet: z.boolean() }),
    stitch: z.object({ thread: key(THREADS), length: z.number().min(2).max(6), rows: z.number().int().min(1).max(2) }),
    edgeColor: key(COLORS),
    liningColor: key(COLORS),
    monogram: z.object({
      text: z.string().regex(/^[A-Za-z&. ]{0,4}$/),
      font: z.enum(["didone", "grotesk", "script"]),
      technique: z.enum(["blind", "gold", "palladium", "paint"]),
      placement: z.enum(["center", "corner", "flap"]),
    }),
  })
  .superRefine((spec, ctx) => {
    const { width, height, cornerBottom, cornerTop, depth } = spec.form;
    const limit = Math.min(width, height) / 2;
    if (cornerBottom > limit || cornerTop > limit) {
      ctx.addIssue({ code: "custom", path: ["form"], message: "Corner radius cannot exceed half the shortest side." });
    }
    if (depth > width) {
      ctx.addIssue({ code: "custom", path: ["form", "depth"], message: "Depth cannot exceed width." });
    }
    if (spec.monogram.placement === "flap" && spec.closure.type !== "flap") {
      ctx.addIssue({ code: "custom", path: ["monogram", "placement"], message: "A flap monogram needs a flap." });
    }
  });

export type DesignSpec = z.infer<typeof designSpecSchema>;
export type Hide = DesignSpec["panels"]["primary"];
export type FinishKey = keyof typeof FINISHES;
export type ColorKey = keyof typeof COLORS;

export function isBagSized(spec: DesignSpec) {
  return spec.form.depth >= 40 && spec.form.width >= 180;
}

export function normalizeSpec(spec: DesignSpec): DesignSpec {
  const limit = Math.floor(Math.min(spec.form.width, spec.form.height) / 2);
  const monogramPlacement =
    spec.monogram.placement === "flap" && spec.closure.type !== "flap" ? "center" : spec.monogram.placement;
  return {
    ...spec,
    form: {
      ...spec.form,
      depth: Math.min(spec.form.depth, spec.form.width),
      cornerBottom: Math.min(spec.form.cornerBottom, limit),
      cornerTop: Math.min(spec.form.cornerTop, limit),
    },
    monogram: { ...spec.monogram, placement: monogramPlacement },
  };
}
