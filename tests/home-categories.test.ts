import { describe, expect, it } from "vitest";
import { desktopSpans } from "@/components/home/categories";
import { DEFAULT_FAQ, DEFAULT_HOME } from "@/lib/content/defaults";
import { CONTENT } from "@/lib/server/content";

// Cells a layout covers on the 4-column grid: the lead tile is 2×2, and a lone second tile is 2×2 too.
const cells = (spans: number[]) => spans.reduce((sum, span, index) => sum + (index === 0 || spans.length === 2 ? span * 2 : span), 0);

describe("category bento", () => {
  it("lays out the default four tiles as one big tile, one wide tile and two small ones", () => {
    expect(desktopSpans(4)).toEqual([2, 2, 1, 1]);
  });

  it("fills whole rows for every tile count the admin allows", () => {
    for (let count = 1; count <= 8; count++) {
      const spans = desktopSpans(count);
      expect(spans).toHaveLength(count);
      if (count > 1) expect(cells(spans) % 4).toBe(0);
    }
  });
});

describe("homepage questions", () => {
  it("keeps homepage content saved before the questions section existed", () => {
    const { faq, ...saved } = DEFAULT_HOME;
    const parsed = CONTENT.home.schema.safeParse(saved);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.faq).toEqual(faq);
  });

  it("only picks questions that exist on the Questions page", () => {
    const known = DEFAULT_FAQ.items.map((item) => item.question);
    for (const question of DEFAULT_HOME.faq.questions) expect(known).toContain(question);
  });

  it("refuses the same question twice", () => {
    const repeated = { ...DEFAULT_HOME, faq: { ...DEFAULT_HOME.faq, questions: ["How do I pay?", "How do I pay?"] } };
    expect(CONTENT.home.schema.safeParse(repeated).success).toBe(false);
  });
});
