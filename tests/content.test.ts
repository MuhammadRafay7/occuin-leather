import { describe, expect, it } from "vitest";
import { CONTENT, type ContentKey } from "@/lib/server/content";
import { DEFAULT_DELIVERY, deliveryEstimate, makingNote, makingTime } from "@/lib/format";
import { fillTokens, isSafeHref, parseInline, plainText, splitRich, textProblem } from "@/lib/content/rich-text";
import { isRedirectDestination, isRedirectSource, redirectProblem, redirectTarget, usableRules, type RedirectRule } from "@/lib/redirects";
import { HARDWARE } from "@/lib/bespoke/design";
import { estimateDesign } from "@/lib/bespoke/estimate";
import { INSPIRATION } from "@/lib/bespoke/parts";
import { PRESETS } from "@/lib/studio/presets";
import { DEFAULT_PRICING, quoteDesign, type StudioPricing } from "@/lib/studio/pricing";
import { FINISHES, METALS, PATTERNS, type DesignSpec } from "@/lib/studio/spec";

const rule = (source: string, destination: string, enabled = true): RedirectRule => ({ source, destination, permanent: true, enabled });
const parse = (key: ContentKey, value: unknown) => CONTENT[key].schema.safeParse(value);

describe("content defaults", () => {
  it.each(Object.keys(CONTENT) as ContentKey[])("%s passes its own schema unchanged", (key) => {
    const parsed = parse(key, CONTENT[key].fallback);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual(CONTENT[key].fallback);
  });

  it("keeps the delivery wording of the store", () => {
    expect(makingTime(DEFAULT_DELIVERY)).toBe("25 to 30 days");
    expect(deliveryEstimate("standard", DEFAULT_DELIVERY)).toBe("Arrives in 35 to 45 days");
    expect(deliveryEstimate("express", DEFAULT_DELIVERY)).toBe("Arrives in 30 to 40 days");
    expect(makingNote(DEFAULT_DELIVERY)).toBe("Every piece is made to order. We take 25 to 30 days to make and pack it, then it ships from Pakistan.");
  });
});

describe("rich text", () => {
  it("renders links as data, never markup", () => {
    expect(parseInline("See [the shop](/shop/women) now")).toEqual([{ text: "See " }, { text: "the shop", href: "/shop/women" }, { text: " now" }]);
    expect(plainText("See [the shop](/shop/women) now")).toBe("See the shop now");
  });

  it("drops unsafe links but keeps the words", () => {
    expect(parseInline("[x](javascript:alert(1))").some((part) => part.href)).toBe(false);
    expect(parseInline("[x](//evil.test)").some((part) => part.href)).toBe(false);
    expect(parseInline("[x](http://plain.test)").some((part) => part.href)).toBe(false);
  });

  it("refuses HTML, unknown values and unsafe links on save", () => {
    expect(textProblem("<script>alert(1)</script>")).toMatch(/web code/);
    expect(textProblem("Hello {{nope}}")).toMatch(/live detail/);
    expect(textProblem("[x](javascript:alert)")).toMatch(/links cannot be used/);
    expect(textProblem("Write to [{{email}}](mailto:{{email}}).")).toBeNull();
    expect(textProblem("On [WhatsApp]({{whatsapp_url}}).")).toBeNull();
  });

  it("fills live values", () => {
    expect(fillTokens("Takes {{making_time}}", { making_time: "2 days" })).toBe("Takes 2 days");
  });

  it("allows same-site paths and https only in navigation", () => {
    for (const good of ["/shop", "/shop/women?sort=new", "https://example.com/a"]) expect(isSafeHref(good)).toBe(true);
    for (const bad of ["javascript:alert(1)", "//evil.test", "/\\evil.test", "http://example.com", "shop", "data:text/html,x", "https://user:pw@example.com"]) expect(isSafeHref(bad)).toBe(false);
  });
});

describe("redirects", () => {
  it("accepts ordinary paths and refuses system ones", () => {
    expect(isRedirectSource("/old-page")).toBe(true);
    for (const bad of ["/", "/admin", "/admin/x", "/api/x", "/_next/x", "/shop", "/login", "old", "//evil", "/a/", "/a?b=1"]) expect(isRedirectSource(bad)).toBe(false);
  });

  it("keeps destinations on this site", () => {
    expect(isRedirectDestination("/shop/leather?sort=new")).toBe(true);
    for (const bad of ["https://evil.test", "//evil.test", "/\\evil.test", "/blog"]) expect(isRedirectDestination(bad)).toBe(false);
  });

  it("finds loops of any length", () => {
    expect(redirectProblem([rule("/a", "/a")], 0)).toMatch(/where they started/);
    expect(redirectProblem([rule("/a", "/b"), rule("/b", "/a")], 0)).toMatch(/where they started/);
    expect(redirectProblem([rule("/x", "/a"), rule("/a", "/b"), rule("/b", "/a")], 0)).toMatch(/circle/);
    expect(redirectProblem([rule("/a", "/b"), rule("/b", "/a", false)], 0)).toBeNull();
    expect(redirectProblem([rule("/a", "/b?x=1"), rule("/b", "/a#top")], 0)).toMatch(/where they started/);
  });

  it("refuses very long chains", () => {
    const rules = ["a", "b", "c", "d", "e", "f"].map((name, index, all) => rule(`/${name}`, `/${all[index + 1] ?? "end"}`));
    expect(redirectProblem(rules, 0)).toMatch(/more than/);
  });

  it("drops unusable rows at the proxy", () => {
    const table = usableRules([rule("/a", "https://evil.test"), rule("/b", "/b"), rule("/admin", "/x"), rule("/ok", "/shop/leather"), { source: 3 }]);
    expect([...table.keys()]).toEqual(["/ok"]);
    expect(usableRules("nonsense").size).toBe(0);
  });

  it("keeps the query string", () => {
    expect(redirectTarget(rule("/a", "/b"), "?utm=1")).toBe("/b?utm=1");
    expect(redirectTarget(rule("/a", "/b?x=2"), "?utm=1")).toBe("/b?x=2");
    expect(redirectTarget(rule("/a", "/b#top"), "?utm=1")).toBe("/b?utm=1#top");
  });

  it("rejects a loop through the schema", () => {
    expect(parse("redirects", { rules: [rule("/a", "/b"), rule("/b", "/a")] }).success).toBe(false);
    expect(parse("redirects", { rules: [rule("/a", "/b"), rule("/a", "/c")] }).success).toBe(false);
  });
});

describe("pricing rules", () => {
  const spec = PRESETS.tote;

  it("is unchanged by the default rates", () => {
    expect(quoteDesign(spec)).toEqual(quoteDesign(spec, DEFAULT_PRICING));
  });

  it("moves the quote when a rate moves", () => {
    const base = quoteDesign(spec).totalCents;
    expect(quoteDesign(spec, { ...DEFAULT_PRICING, baseCents: DEFAULT_PRICING.baseCents + 10_000 }).totalCents).toBeGreaterThan(base);
    expect(quoteDesign(spec, { ...DEFAULT_PRICING, margin: 2 }).totalCents).toBeGreaterThan(base);
    expect(quoteDesign(spec, { ...DEFAULT_PRICING, roundToCents: 100 }).totalCents % 100).toBe(0);
  });

  it("keeps a design above zero at the lowest values the schema allows", () => {
    const zero = Object.fromEntries(Object.entries(DEFAULT_PRICING).map(([key, value]) => [key, typeof value === "object" ? Object.fromEntries(Object.keys(value).map((name) => [name, 0])) : 0]));
    const lowest = { ...zero, labourCentsPerHour: 100, wastage: 1, margin: 1, roundToCents: 100, bespokeLowSpread: 0.1, bespokeHighSpread: 1 };
    const parsed = parse("pricing", lowest);
    expect(parsed.success).toBe(true);
    expect(quoteDesign(spec, parsed.data as typeof DEFAULT_PRICING).totalCents).toBeGreaterThan(0);
  });

  it("every studio rate changes a studio quote or a designer estimate", () => {
    const base = PRESETS.tote;
    const variants: DesignSpec[] = [
      base,
      { ...base, closure: { ...base.closure, type: "zip" }, pocket: "zip", hardware: { ...base.hardware, feet: true } },
      { ...base, closure: { ...base.closure, type: "flap", clasp: "turnlock" }, carry: { ...base.carry, handles: 2, strap: true } },
      { ...base, monogram: { ...base.monogram, text: "AB", technique: "blind" } },
      { ...base, monogram: { ...base.monogram, text: "AB", technique: "gold" } },
      ...(Object.keys(FINISHES) as (keyof typeof FINISHES)[]).map((finish) => ({ ...base, panels: { ...base.panels, primary: { ...base.panels.primary, finish } } })),
      ...(Object.keys(METALS) as (keyof typeof METALS)[]).map((metal) => ({ ...base, hardware: { ...base.hardware, metal } })),
      ...(Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]).map((pattern) => ({ ...base, surface: { ...base.surface, pattern } })),
    ];
    let serial = 0;
    const drawn = INSPIRATION[0]!.designs[0]!.build(() => (++serial).toString(36).padStart(6, "a"));
    const fitted = { ...drawn, pieces: drawn.pieces.map((piece, index) => (index ? piece : { ...piece, logo: {} as never, hardware: (Object.keys(HARDWARE) as (keyof typeof HARDWARE)[]).map((kind) => ({ kind, label: "" }) as never) })) };
    const outcome = (pricing: StudioPricing) => JSON.stringify([variants.map((spec) => quoteDesign(spec, pricing).totalCents), estimateDesign(fitted, pricing)]);
    const before = outcome(DEFAULT_PRICING);
    const bump = (key: string, value: number) => (key === "roundToCents" ? 900 : key.endsWith("Spread") ? value + 0.05 : key === "wastage" || key === "margin" ? value + 0.5 : value + 10_000);
    for (const [key, value] of Object.entries(DEFAULT_PRICING)) {
      if (typeof value === "number") {
        expect(outcome({ ...DEFAULT_PRICING, [key]: bump(key, value) }), key).not.toBe(before);
        continue;
      }
      for (const [name, cents] of Object.entries(value)) {
        expect(outcome({ ...DEFAULT_PRICING, [key]: { ...value, [name]: cents + 10_000 } }), `${key}.${name}`).not.toBe(before);
      }
    }
  });

  it("refuses rates that would break pricing", () => {
    expect(parse("pricing", { ...DEFAULT_PRICING, roundToCents: 0 }).success).toBe(false);
    expect(parse("pricing", { ...DEFAULT_PRICING, margin: 0.5 }).success).toBe(false);
    expect(parse("pricing", { ...DEFAULT_PRICING, labourCentsPerHour: 0 }).success).toBe(false);
    expect(parse("pricing", { ...DEFAULT_PRICING, baseCents: null }).success).toBe(false);
  });

});

describe("rich text splitting", () => {
  it("rebuilds the exact stored text from its parts", () => {
    for (const text of ["Plain", "Or email [{{email}}](mailto:{{email}}).", "{{making_note}} See [care](/care).\n\nNext {{nope}}", ""]) {
      expect(splitRich(text).map((part) => part.raw).join("")).toBe(text);
    }
  });

  it("names links and live details", () => {
    expect(splitRich("[care](/care) {{email}} {{nope}}").map((part) => part.kind)).toEqual(["link", "text", "value", "text", "text"]);
  });
});

describe("delivery rules", () => {
  it("refuses arrival shorter than making time", () => {
    expect(parse("delivery", { ...DEFAULT_DELIVERY, standardMinDays: 5 }).success).toBe(false);
    expect(parse("delivery", { ...DEFAULT_DELIVERY, makingMaxDays: 20 }).success).toBe(false);
    expect(parse("delivery", { ...DEFAULT_DELIVERY, expressMaxDays: 29, expressMinDays: 29 }).success).toBe(false);
  });
});

describe("content links", () => {
  it("refuses unsafe navigation", () => {
    const nav = CONTENT.nav.fallback;
    const bad = { ...nav, mobileLinks: [{ label: "Bad", href: "javascript:alert(1)" }] };
    expect(parse("nav", bad).success).toBe(false);
  });

  it("refuses duplicate FAQ questions", () => {
    const item = { question: "Same?", answer: "Yes." };
    expect(parse("page.faq", { title: "Questions", items: [item, item] }).success).toBe(false);
  });
});
