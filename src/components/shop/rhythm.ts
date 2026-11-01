export type Span = "base" | "wide" | "feature" | "full";
export type Placement = { phone: Span; tablet: Span; desktop: Span };

type Plan = { cycle: Span[][]; tails: Record<number, Span[][]> };

const PAIR: Span[] = ["base", "base"];
const ROW3: Span[] = ["base", "base", "base"];
const ROW4: Span[] = ["base", "base", "base", "base"];
const FEATURE3_LEFT: Span[] = ["feature", "base", "base"];
const FEATURE3_RIGHT: Span[] = ["base", "feature", "base"];
const FEATURE4_LEFT: Span[] = ["feature", "base", "base", "base", "base"];
const FEATURE4_RIGHT: Span[] = ["base", "base", "feature", "base", "base"];
const WIDE_RIGHT3: Span[] = ["base", "base", "wide"];
const WIDE_LEFT3: Span[] = ["wide", "base", "base"];

const PLANS: { phone: Plan; tablet: Plan; desktop: Plan } = {
  phone: {
    cycle: [["full"], PAIR, PAIR],
    tails: { 1: [["full"]], 2: [PAIR], 3: [["full"], PAIR], 4: [PAIR, PAIR] },
  },
  tablet: {
    cycle: [FEATURE3_LEFT, ROW3, FEATURE3_RIGHT, ROW3],
    tails: {
      1: [["full"]],
      2: [["wide", "base"]],
      3: [FEATURE3_LEFT],
      4: [["wide", "base"], ["base", "wide"]],
      5: [FEATURE3_RIGHT, ["wide", "base"]],
      6: [FEATURE3_RIGHT, ROW3],
    },
  },
  desktop: {
    cycle: [FEATURE4_LEFT, FEATURE4_RIGHT, ROW4],
    tails: {
      1: [["full"]],
      2: [["wide", "wide"]],
      3: [WIDE_LEFT3],
      4: [ROW4],
      5: [FEATURE4_RIGHT],
      6: [WIDE_LEFT3, WIDE_RIGHT3],
      7: [FEATURE4_RIGHT, ["wide", "wide"]],
      8: [FEATURE4_RIGHT, WIDE_LEFT3],
    },
  },
};

function arrange(count: number, { cycle, tails }: Plan) {
  const largestTail = Math.max(...Object.keys(tails).map(Number));
  const spans: Span[] = [];
  let remaining = count;
  for (let step = 0; remaining > largestTail; step += 1) {
    const block = cycle[step % cycle.length]!;
    spans.push(...block);
    remaining -= block.length;
  }
  if (remaining > 0) spans.push(...tails[remaining]!.flat());
  return spans;
}

export function arrangeCards(count: number): Placement[] {
  const phone = arrange(count, PLANS.phone);
  const tablet = arrange(count, PLANS.tablet);
  const desktop = arrange(count, PLANS.desktop);
  return phone.map((span, index) => ({ phone: span, tablet: tablet[index]!, desktop: desktop[index]! }));
}

const CELL = {
  phone: { base: "col-span-1", wide: "col-span-2", feature: "col-span-2", full: "col-span-2" },
  tablet: { base: "md:col-span-1", wide: "md:col-span-2", feature: "md:col-span-2 md:row-span-2", full: "md:col-span-3 md:flex-row" },
  desktop: { base: "lg:col-span-1 lg:row-span-1", wide: "lg:col-span-2 lg:row-span-1", feature: "lg:col-span-2 lg:row-span-2", full: "lg:col-span-4 lg:flex-row" },
};

const STAGE = {
  phone: { base: "aspect-square", wide: "aspect-[4/3]", feature: "aspect-[4/3]", full: "aspect-[4/3]" },
  tablet: { base: "md:aspect-square", wide: "md:aspect-[2/1]", feature: "md:aspect-auto md:min-h-0 md:grow-[999] md:basis-0", full: "md:aspect-auto md:min-h-[440px] md:flex-[3]" },
  desktop: { base: "lg:aspect-[4/3] lg:grow-0 lg:basis-auto", wide: "lg:aspect-[8/3] lg:grow-0 lg:basis-auto", feature: "lg:aspect-auto lg:min-h-0 lg:grow-[999] lg:basis-0", full: "lg:aspect-auto lg:min-h-[480px] lg:flex-[3]" },
};

const CONTENT_MAX = 1600;
const PAGE_GUTTER = 64;
const DESKTOP_WIDTHS: Record<Span, number> = { base: 0.25, wide: 0.5, feature: 0.5, full: 0.6 };
const TABLET_WIDTHS: Record<Span, string> = { base: "34vw", wide: "67vw", feature: "67vw", full: "60vw" };

export const cellClass = ({ phone, tablet, desktop }: Placement) => `${CELL.phone[phone]} ${CELL.tablet[tablet]} ${CELL.desktop[desktop]}`;

export const stageClass = ({ phone, tablet, desktop }: Placement) => `${STAGE.phone[phone]} ${STAGE.tablet[tablet]} ${STAGE.desktop[desktop]}`;

export function imageSizes({ phone, tablet, desktop }: Placement) {
  const share = DESKTOP_WIDTHS[desktop];
  const capped = Math.round((CONTENT_MAX - PAGE_GUTTER) * share);
  const fluid = `${Math.round(share * 100)}vw`;
  return `(min-width: ${CONTENT_MAX}px) ${capped}px, (min-width: 1024px) ${fluid}, (min-width: 768px) ${TABLET_WIDTHS[tablet]}, ${phone === "base" ? "50vw" : "100vw"}`;
}
