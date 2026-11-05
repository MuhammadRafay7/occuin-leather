import { describe, expect, it } from "vitest";
import { DEFAULT_HOME } from "@/lib/content/defaults";
import { newArrivals } from "@/lib/home/new-in";
import { recolor, STORY_STEPS, storyStage } from "@/lib/home/story";
import { CONTENT } from "@/lib/server/content";
import { PRESETS } from "@/lib/studio/presets";
import { designSpecSchema } from "@/lib/studio/spec";

describe("homepage content", () => {
  it("keeps homepage content saved before the story sections existed", () => {
    const { story, shapes, leathers, making, paths, ...saved } = DEFAULT_HOME;
    const { secondaryLabel, secondaryHref, cueLabel, ...savedHero } = saved.hero;
    const parsed = CONTENT.home.schema.safeParse({ ...saved, hero: { ...savedHero, lineOne: "Kept" } });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.hero).toMatchObject({ lineOne: "Kept", secondaryLabel, secondaryHref, cueLabel });
    expect(parsed.data).toMatchObject({ story, shapes, leathers, making, paths });
  });

  it("links the quiz from the closing paths", () => {
    expect(DEFAULT_HOME.paths.links.map((link) => link.href)).toContain("/find-your-bag");
  });
});

describe("story stages", () => {
  const target = PRESETS.crossbody;

  it("starts as a plain open form and ends as the finished preset", () => {
    const first = storyStage(target, 0);
    expect(first.form).toEqual(target.form);
    expect(first.closure.type).toBe("open");
    expect(first.carry.strap).toBe(false);
    expect(first.panels.layout).toBe("single");
    expect(storyStage(target, STORY_STEPS.length - 1)).toEqual(target);
  });

  it("produces a valid design at every stage", () => {
    for (const key of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
      STORY_STEPS.forEach((_, stage) => expect(designSpecSchema.safeParse(storyStage(PRESETS[key], stage)).success).toBe(true));
    }
  });

  it("recolours the main panel and a matching gusset only", () => {
    const tote = recolor(PRESETS.tote, "navy");
    expect(tote.panels.primary.color).toBe("navy");
    expect(tote.panels.gusset.color).toBe("navy");
    const saddle = recolor(target, "navy");
    expect(saddle.panels.gusset.color).toBe(target.panels.gusset.color);
  });
});

describe("new in", () => {
  const card = (slug: string, day: number) => ({ slug, createdAt: new Date(2026, 0, day) });
  const catalogue = [card("cabas-38", 9), card("slate-buckle-satchel", 3), card("brogued-dress-belt", 1), card("tooled-bifold-wallet", 2)];

  it("shows the newest pieces that Pick your shape does not", () => {
    expect(newArrivals(catalogue, ["cabas-38"], 4).map((item) => item.slug)).toEqual(["slate-buckle-satchel", "tooled-bifold-wallet", "brogued-dress-belt"]);
    expect(newArrivals(catalogue, ["cabas-38"], 2)).toHaveLength(2);
  });

  it("hides itself when fewer than two are left", () => {
    expect(newArrivals(catalogue, ["cabas-38", "slate-buckle-satchel", "tooled-bifold-wallet"], 4)).toEqual([]);
  });
});
