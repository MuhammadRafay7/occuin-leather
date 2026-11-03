import { describe, expect, it } from "vitest";
import { lookHref, lookSpec } from "@/lib/home/hero-look";
import { quoteDesign } from "@/lib/studio/pricing";
import { PRESETS } from "@/lib/studio/presets";
import { designSpecSchema } from "@/lib/studio/spec";

const bureau = { key: "laptop" as const, label: "Laptop", slug: "bureau-15" };
const statement = { finish: "saffiano" as const, thread: "honey" as const, metal: "gold" as const, initials: "OC" };

describe("hero looks", () => {
  it("dresses a real preset with a real leather, thread, metal and initials", () => {
    const spec = lookSpec("laptop", "noir", statement);
    expect(designSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.panels.primary).toEqual({ finish: "saffiano", color: "noir" });
    expect(spec.panels.gusset).toEqual({ finish: "saffiano", color: "noir" });
    expect(spec.stitch.thread).toBe("honey");
    expect(spec.hardware.metal).toBe("gold");
    expect(spec.monogram).toMatchObject({ text: "OC", technique: "gold", placement: "corner" });
  });

  it("prices the look above the plain piece", () => {
    expect(quoteDesign(lookSpec("laptop", "noir", statement)).totalCents).toBeGreaterThan(quoteDesign(PRESETS.laptop).totalCents);
    expect(quoteDesign(lookSpec("laptop", "espresso", {})).totalCents).toBe(quoteDesign(PRESETS.laptop).totalCents);
  });

  it("links to the studio with every part of the look", () => {
    expect(lookHref(bureau, "noir", statement)).toBe("/studio?from=bureau-15&color=noir&finish=saffiano&thread=honey&metal=gold&initials=OC");
    expect(lookHref(bureau, "noir", {})).toBe("/studio?from=bureau-15&color=noir");
  });
});
