import { describe, expect, it } from "vitest";
import { carryNotes, comparisons, fitsInside, presetMatches } from "@/lib/scale";
import { dressSpec } from "@/lib/find-your-bag/dress";
import { studioSections } from "@/lib/manufacturer/studio-rows";
import { cleanInitials, initialsPlacement, withInitials } from "@/lib/studio/initials";
import { PRESETS } from "@/lib/studio/presets";
import { designSpecSchema } from "@/lib/studio/spec";

const fitting = (preset: keyof typeof PRESETS) =>
  comparisons(PRESETS[preset].form)
    .filter((item) => item.fits)
    .map((item) => item.key);

describe("fitsInside", () => {
  it("fits the laptop each laptop piece is described for", () => {
    expect(fitting("laptop")).toContain("laptop15");
    expect(fitting("sleeve")).toContain("laptop13");
    expect(fitting("sleeve")).not.toContain("laptop15");
  });

  it("keeps a phone out of a wallet and a card in it", () => {
    expect(fitting("billfold")).toContain("card");
    expect(fitting("billfold")).not.toContain("phone");
  });

  it("allows any orientation but respects depth", () => {
    expect(fitsInside({ width: 300, height: 240, depth: 100 }, { width: 70, height: 230, depth: 70 })).toBe(true);
    expect(fitsInside({ width: 300, height: 240, depth: 30 }, { width: 70, height: 230, depth: 70 })).toBe(false);
  });

  it("narrows the opening for a tapered top", () => {
    const item = { width: 300, height: 200, depth: 10 };
    expect(fitsInside({ width: 320, height: 240, depth: 60 }, item)).toBe(true);
    expect(fitsInside({ width: 320, height: 240, depth: 60, taper: 0.86 }, item)).toBe(false);
  });

  it("only compares with objects of a sensible scale", () => {
    const keys = comparisons(PRESETS.cardcase.form).map((item) => item.key);
    expect(keys).toContain("card");
    expect(keys).not.toContain("laptop15");
  });
});

describe("presetMatches", () => {
  it("matches only when the preset leather is the product colour", () => {
    expect(presetMatches(PRESETS.tote, ["Cognac"])).toBe(true);
    expect(presetMatches(PRESETS.satchel, ["Slate"])).toBe(false);
    expect(presetMatches(null, ["Cognac"])).toBe(false);
  });
});

describe("initials", () => {
  it("cleans input to four allowed characters", () => {
    expect(cleanInitials("ab1c!de")).toBe("ABCD");
    expect(cleanInitials("a.b")).toBe("A.B");
  });

  it("produces a valid spec that the studio accepts", () => {
    for (const spec of Object.values(PRESETS)) {
      const lettered = withInitials(spec, "mr");
      expect(designSpecSchema.safeParse(lettered).success).toBe(true);
      expect(lettered.monogram.text).toBe("MR");
      expect(lettered.monogram.technique).not.toBe("blind");
    }
  });

  it("moves centred initials onto a flap", () => {
    expect(withInitials(PRESETS.satchel, "mr").monogram.placement).toBe("flap");
    expect(withInitials(PRESETS.tote, "mr").monogram.placement).toBe("center");
  });

  it("moves centred initials off a front pocket to the corner everywhere", () => {
    const studio = initialsPlacement(PRESETS.laptop);
    const product = withInitials(PRESETS.laptop, "mr").monogram.placement;
    const quiz = dressSpec(PRESETS.laptop, "noir", "MR").monogram.placement;
    expect([studio, product, quiz]).toEqual(["corner", "corner", "corner"]);
    const position = studioSections(withInitials(PRESETS.laptop, "mr"))
      .flatMap((section) => section.rows)
      .find((entry) => entry.label === "Position");
    expect(position?.value).toMatch(/^Front panel, lower right/);
  });

  it("keeps a placement the customer already chose", () => {
    const corner = { ...PRESETS.tote, monogram: { ...PRESETS.tote.monogram, placement: "corner" as const } };
    expect(initialsPlacement(corner)).toBe("corner");
    const centred = { ...PRESETS.laptop, pocket: "none" as const };
    expect(initialsPlacement(centred)).toBe("center");
    expect(initialsPlacement(PRESETS.satchel)).toBe("flap");
  });

  it("leaves the spec alone without letters", () => {
    expect(withInitials(PRESETS.tote, "  ")).toBe(PRESETS.tote);
  });
});

describe("carryNotes", () => {
  it("describes handles and strap from the preset", () => {
    expect(carryNotes(PRESETS.laptop)).toEqual(["Two top handles, 8 cm drop", "Shoulder strap, 120 cm long"]);
    expect(carryNotes(PRESETS.cardcase)).toEqual(["Carried in the hand or a pocket"]);
  });
});
