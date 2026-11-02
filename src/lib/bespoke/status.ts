export const BESPOKE_STATUSES = ["question", "new", "quoted", "changes_requested", "accepted", "declined", "in_production", "completed"] as const;
export type BespokeStatus = (typeof BESPOKE_STATUSES)[number];

export const BESPOKE_STATUS_LABELS: Record<BespokeStatus, string> = {
  question: "Question",
  new: "New",
  quoted: "Quoted",
  changes_requested: "Changes requested",
  accepted: "Accepted",
  declined: "Declined",
  in_production: "In production",
  completed: "Completed",
};

export const bespokeRef = (number: number) => `BR-${String(number).padStart(6, "0")}`;

export const QUOTE_DAYS = 30;
export const quoteExpired = (expiresAt: Date | string | null, now = new Date()) => Boolean(expiresAt && new Date(expiresAt) < now);
export const quoteExpiry = (from = new Date(), days = QUOTE_DAYS) => new Date(from.getTime() + days * 86_400_000);
export const PRICE_LOCKED: readonly BespokeStatus[] = ["accepted", "in_production", "completed"];

export const bespokeBuyable = (request: { status: BespokeStatus; quotedPriceCents: number | null; quoteExpiresAt: Date | string | null }, now = new Date()) =>
  request.status === "accepted" && Boolean(request.quotedPriceCents) && !quoteExpired(request.quoteExpiresAt, now);

export const quoteAcceptable = (request: { status: BespokeStatus; quotedPriceCents: number | null; quoteExpiresAt: Date | string | null }, now = new Date()) =>
  request.status === "quoted" && Boolean(request.quotedPriceCents) && !quoteExpired(request.quoteExpiresAt, now);

export type BespokePart = "deposit" | "balance";
export const depositCents = (quotedCents: number, percent: number) => Math.round((quotedCents * percent) / 100);
export const balanceCents = (quotedCents: number, percent: number) => quotedCents - depositCents(quotedCents, percent);
export const MIN_CHARGE_CENTS = 50;

export function depositProblem(quotedCents: number, percent: number) {
  const balance = balanceCents(quotedCents, percent);
  if (depositCents(quotedCents, percent) < MIN_CHARGE_CENTS) return "The deposit is too small to charge. Raise the percent or the price.";
  if (balance > 0 && balance < MIN_CHARGE_CENTS) return "The balance is too small to charge. Use 100% or lower the percent.";
  return null;
}

type DepositState = { quotedPriceCents: number | null; depositPercent: number; depositPaidAt: Date | string | null; balancePaidAt: Date | string | null };

export const balanceOwedCents = (request: DepositState) =>
  request.depositPaidAt && !request.balancePaidAt && request.quotedPriceCents ? balanceCents(request.quotedPriceCents, request.depositPercent) : 0;

export const balanceBuyable = (request: DepositState & { status: BespokeStatus; balanceRequestedAt: Date | string | null }) =>
  (request.status === "in_production" || request.status === "completed") && Boolean(request.balanceRequestedAt) && balanceOwedCents(request) > 0;
