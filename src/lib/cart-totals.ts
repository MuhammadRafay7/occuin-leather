export type PricedLine = {
  amountCents: number;
  bespoke: { part: "deposit" | "balance"; depositCents: number; balanceCents: number } | null;
};

export const discountableCents = (lines: PricedLine[]) => lines.reduce((sum, line) => sum + (line.bespoke ? 0 : line.amountCents), 0);

export function cartTotals(lines: PricedLine[], percentOff: number) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const discountCents = Math.round((discountableCents(lines) * percentOff) / 100);
  const depositsInBalances = lines.reduce((sum, line) => sum + (line.bespoke?.part === "balance" ? line.bespoke.depositCents : 0), 0);
  return {
    subtotalCents,
    discountCents,
    shippingBasisCents: subtotalCents - discountCents + depositsInBalances,
    shippingWaived: lines.length > 0 && lines.every((line) => line.bespoke?.part === "deposit" && line.bespoke.balanceCents > 0),
  };
}
