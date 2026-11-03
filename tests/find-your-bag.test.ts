import { describe, expect, it } from "vitest";
import {
  fulfilmentOf,
  isComplete,
  parseHash,
  rankMatches,
  scoreCandidate,
  studioHref,
  toHash,
  traitsOf,
  type Candidate,
  type CompleteAnswers,
} from "@/lib/find-your-bag/match";
import { PRESETS, STARTING_POINTS, type PresetKey } from "@/lib/studio/presets";
import { designSpecSchema } from "@/lib/studio/spec";

const CATALOGUE: PresetKey[] = ["tote", "satchel", "crossbody", "weekender", "bucket", "pouch", "laptop", "sleeve", "messenger", "cardcase", "billfold"];

const candidate = (key: PresetKey, overrides: Partial<Candidate> = {}): Candidate => {
  const spec = PRESETS[key];
  const slug = spec.name.toLowerCase().replace(/\s+/g, "-");
  return {
    id: `product:${slug}`,
    slug,
    name: spec.name,
    type: STARTING_POINTS.find((point) => point.key === key)!.label,
    image: `/images/studio/${key}.webp`,
    spec,
    ready: { variantId: `00000000-0000-4000-8000-${String(CATALOGUE.indexOf(key)).padStart(12, "0")}`, color: spec.panels.primary.color, colorName: spec.panels.primary.color, priceCents: 25000, inStock: true },
    ...overrides,
  };
};

const catalogue = CATALOGUE.map((key) => candidate(key));
const answers = (purpose: CompleteAnswers["purpose"], load: CompleteAnswers["load"], carry: CompleteAnswers["carry"], extra: Partial<CompleteAnswers> = {}): CompleteAnswers => ({
  purpose,
  load,
  carry,
  color: "noir",
  ...extra,
});
const top = (input: CompleteAnswers) => rankMatches(catalogue, input).map((match) => match.candidate.name);

describe("bag matching", () => {
  it("puts a laptop bag first for work with a laptop", () => {
    const [first] = rankMatches(catalogue, answers("work", "laptop", "shoulder"));
    expect(first!.candidate.name).toBe("Bureau 15");
    expect(first!.exact).toBe(true);
    expect(first!.reasons.some((reason) => reason.includes("400 × 290 mm") && reason.includes("15 inches"))).toBe(true);
  });

  it("never leads with a piece a laptop cannot fit in when one that fits exists", () => {
    for (const purpose of ["work", "everyday", "travel", "evening", "gift"] as const) {
      for (const carry of ["hand", "shoulder", "crossbody", "any"] as const) {
        const [first] = rankMatches(catalogue, answers(purpose, "laptop", carry));
        expect(traitsOf(first!.candidate.spec).laptopInches, `${purpose} ${carry}`).toBeGreaterThan(0);
      }
    }
  });

  it("chooses the weekender for travel with a lot to carry", () => {
    expect(top(answers("travel", "lots", "any"))[0]).toBe("Grand Tour 50");
  });

  it("chooses the saddle bag for everyday essentials worn across the body", () => {
    expect(top(answers("everyday", "essentials", "crossbody"))[0]).toBe("Selle 22");
  });

  it("chooses a small evening piece for an evening with essentials in the hand", () => {
    const names = top(answers("evening", "essentials", "hand"));
    expect(names[0]).toBe("Pochette 26");
    expect(names).toContain("Nocturne 28");
  });

  it("offers small leather goods for a gift of essentials", () => {
    const [first] = rankMatches(catalogue, answers("gift", "essentials", "any"));
    expect(traitsOf(first!.candidate.spec).shape).toBe("small");
  });

  it("returns two different kinds of piece when it can", () => {
    const matches = rankMatches(catalogue, answers("work", "laptop", "hand"));
    expect(matches).toHaveLength(2);
    expect(matches[0]!.candidate.type).not.toBe(matches[1]!.candidate.type);
  });

  it("falls back to the closest piece and says what does not fit", () => {
    const matches = rankMatches(catalogue, answers("evening", "laptop", "crossbody"));
    expect(matches).toHaveLength(2);
    expect(matches[0]!.exact).toBe(false);
    expect(matches[0]!.notes.length).toBeGreaterThan(0);
  });

  it("still answers with a single candidate, and with none", () => {
    expect(rankMatches([candidate("cardcase")], answers("travel", "lots", "crossbody"))).toHaveLength(1);
    expect(rankMatches([], answers("work", "laptop", "hand"))).toEqual([]);
  });

  it("only gives a small bonus for a piece already made in the chosen leather", () => {
    const tote = candidate("tote");
    const choice = answers("everyday", "lots", "shoulder");
    const inCognac = scoreCandidate(tote, { ...choice, color: "cognac" }).score;
    const inNoir = scoreCandidate(tote, { ...choice, color: "noir" }).score;
    expect(inCognac - inNoir).toBe(0.5);
  });

  it("gives at most three reasons, each taken from the piece itself", () => {
    for (const match of rankMatches(catalogue, answers("everyday", "lots", "shoulder"))) {
      expect(match.reasons.length).toBeGreaterThan(0);
      expect(match.reasons.length).toBeLessThanOrEqual(3);
      expect(match.reasons.join(" ")).not.toMatch(/best[- ]?seller|popular|only \d|left in stock/i);
    }
  });
});

describe("what goes in the bag", () => {
  const tote = candidate("tote");

  it("adds the listed piece when the leather matches and there are no initials", () => {
    expect(fulfilmentOf(tote, "cognac", null)).toEqual({ kind: "ready", variantId: tote.ready!.variantId, priceCents: 25000 });
  });

  it("makes a studio piece in another leather", () => {
    const plan = fulfilmentOf(tote, "noir", null);
    expect(plan.kind).toBe("made");
    if (plan.kind !== "made") return;
    expect(plan.spec.panels.primary.color).toBe("noir");
    expect(plan.spec.panels.gusset.color).toBe("noir");
    expect(plan.spec.name).toBe("Cabas 38 in Noir");
    expect(designSpecSchema.safeParse(plan.spec).success).toBe(true);
  });

  it("makes a studio piece when initials are asked for, even in the listed leather", () => {
    const plan = fulfilmentOf(tote, "cognac", "AB");
    expect(plan.kind).toBe("made");
    if (plan.kind === "made") expect(plan.spec.monogram.text).toBe("AB");
  });

  it("keeps initials clear of a front pocket", () => {
    const plan = fulfilmentOf(candidate("laptop"), "noir", "MR");
    expect(plan.kind === "made" && plan.spec.monogram.placement).toBe("corner");
  });

  it("makes a studio piece when the listed one is sold out", () => {
    const soldOut = candidate("tote", { ready: { ...tote.ready!, inStock: false } });
    expect(fulfilmentOf(soldOut, "cognac", null).kind).toBe("made");
  });

  it("produces orderable specs for every piece, leather and initials", () => {
    for (const item of catalogue) {
      for (const color of ["noir", "rose", "cobalt"] as const) {
        const plan = fulfilmentOf(item, color, "XYZ");
        if (plan.kind === "made") expect(designSpecSchema.safeParse(plan.spec).success, item.name).toBe(true);
      }
    }
  });

  it("links to the studio with the choices applied", () => {
    expect(studioHref(tote, "noir", "AB")).toBe("/studio?from=cabas-38&color=noir&initials=AB");
    expect(studioHref(tote, "noir")).toBe("/studio?from=cabas-38&color=noir");
  });
});

describe("answers in the link", () => {
  it("round trips through the hash", () => {
    const full = { purpose: "work", load: "laptop", carry: "hand", color: "bordeaux", initials: "MR" } as const;
    expect(parseHash(toHash(full, "result"))).toEqual({ answers: full, step: "result" });
  });

  it("drops values it does not know", () => {
    const { answers: parsed } = parseHash("#for=party&carry=laptop&wear=<script>&leather=gold&initials=1234");
    expect(parsed).toEqual({ load: "laptop" });
  });

  it("sends a visitor back to the first unanswered question", () => {
    expect(parseHash("#for=work&step=result").step).toBe("load");
    expect(parseHash("#for=work&step=color").step).toBe("load");
    expect(parseHash("").step).toBe("purpose");
  });

  it("lets initials stay optional", () => {
    const parsed = parseHash("#for=gift&carry=essentials&wear=any&leather=noir&step=result");
    expect(parsed.step).toBe("result");
    expect(isComplete(parsed.answers)).toBe(true);
  });

  it("opens a question that has been reached", () => {
    expect(parseHash("#for=gift&carry=essentials&step=carry").step).toBe("carry");
    expect(parseHash("#for=gift&carry=essentials&wear=any&leather=noir&step=initials").step).toBe("initials");
  });
});
