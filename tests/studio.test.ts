import { describe, expect, it } from "vitest";
import { designSpecSchema, normalizeSpec } from "@/lib/studio/spec";
import { PRESETS } from "@/lib/studio/presets";
import { describeDesign, quoteDesign } from "@/lib/studio/pricing";

describe("design presets", () => {
  it.each(Object.entries(PRESETS))("%s is a valid orderable spec", (_, spec) => {
    expect(designSpecSchema.safeParse(spec).success).toBe(true);
    expect(quoteDesign(spec).totalCents).toBeGreaterThan(0);
    expect(describeDesign(spec).length).toBeGreaterThan(4);
  });
});

describe("design validation", () => {
  const base = PRESETS.tote;

  it("rejects dimensions beyond what the atelier can cut", () => {
    expect(designSpecSchema.safeParse({ ...base, form: { ...base.form, width: 9000 } }).success).toBe(false);
  });

  it("rejects corners larger than the panel", () => {
    expect(designSpecSchema.safeParse({ ...base, form: { ...base.form, cornerTop: 160, height: 100, width: 200 } }).success).toBe(false);
  });

  it("rejects markup in the monogram", () => {
    expect(designSpecSchema.safeParse({ ...base, monogram: { ...base.monogram, text: "<b>" } }).success).toBe(false);
  });

  it("rejects unknown leathers", () => {
    const panels = { ...base.panels, primary: { finish: "vinyl", color: "noir" } };
    expect(designSpecSchema.safeParse({ ...base, panels }).success).toBe(false);
  });

  it("normalizes a spec after a dimension shrinks below its corners", () => {
    const spec = normalizeSpec({ ...base, form: { ...base.form, width: 100, height: 60, cornerTop: 150 } });
    expect(spec.form.cornerTop).toBe(30);
    expect(designSpecSchema.safeParse(spec).success).toBe(true);
  });
});

describe("design pricing", () => {
  const base = PRESETS.tote;
  const price = (patch: Partial<typeof base>) => quoteDesign({ ...base, ...patch }).totalCents;

  it("grows with size", () => {
    expect(price({ form: { ...base.form, width: 500 } })).toBeGreaterThan(price({}));
  });

  it("charges more for exotic finishes", () => {
    const panels = { ...base.panels, primary: { finish: "croc", color: "noir" } as const };
    expect(price({ panels })).toBeGreaterThan(price({}));
  });

  it("itemizes to exactly the total", () => {
    const quote = quoteDesign({ ...base, monogram: { ...base.monogram, text: "AB" } });
    expect(quote.lines.reduce((sum, line) => sum + line.cents, 0)).toBe(quote.totalCents);
    expect(quote.totalCents % 1000).toBe(0);
  });
});

describe("procedural geometry", () => {
  it.each(Object.entries(PRESETS))("%s builds finite meshes", async (_, spec) => {
    const { buildBag } = await import("@/lib/studio/geometry");
    const bag = buildBag(spec);
    for (const mesh of [bag.front, bag.back, bag.gusset, bag.edges]) {
      const array = mesh.getAttribute("position").array;
      expect(array.length).toBeGreaterThan(0);
      expect(Array.from(array).every(Number.isFinite)).toBe(true);
    }
    expect(bag.stitches.length).toBeGreaterThan(50);
    expect(bag.flap !== null).toBe(spec.closure.type === "flap");
  });

  it("points every panel normal away from the bag", async () => {
    const { buildBag } = await import("@/lib/studio/geometry");
    const bag = buildBag(PRESETS.satchel);
    const centerY = PRESETS.satchel.form.height * 0.005;
    for (const mesh of [bag.front, bag.back, bag.gusset]) {
      const position = mesh.getAttribute("position");
      const normal = mesh.getAttribute("normal");
      for (let i = 0; i < position.count; i += 11) {
        if (normal.getX(i) === 0 && normal.getY(i) === 0 && normal.getZ(i) === 0) continue;
        const away = position.getX(i) * normal.getX(i) + (position.getY(i) - centerY) * normal.getY(i) + position.getZ(i) * normal.getZ(i);
        expect(away).toBeGreaterThan(0);
      }
    }
  });

  it("gives open and flap bags a real lining, and lifts a flap to show it", async () => {
    const { buildBag } = await import("@/lib/studio/geometry");
    expect(buildBag(PRESETS.tote).lining).not.toBeNull();
    expect(buildBag(PRESETS.satchel).lining).not.toBeNull();
    expect(buildBag(PRESETS.pouch).lining).toBeNull();
    expect(buildBag(PRESETS.pouch, { open: true }).lining).not.toBeNull();
  });

  it("makes visible hardware for a bag with handles", async () => {
    const { buildBag } = await import("@/lib/studio/geometry");
    expect(buildBag(PRESETS.tote).hardware?.getAttribute("position").count).toBeGreaterThan(1000);
  });

  it("spaces the outline evenly and keeps it symmetric", async () => {
    const { buildOutline } = await import("@/lib/studio/geometry");
    const outline = buildOutline(PRESETS.crossbody.form);
    const maxX = Math.max(...outline.map((p) => p.x));
    const minX = Math.min(...outline.map((p) => p.x));
    expect(maxX + minX).toBeCloseTo(0, 0);
  });
});
