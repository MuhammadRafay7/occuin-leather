export const STOCK_REASONS = ["Received from workshop", "Stock count correction", "Damaged", "Returned by customer", "Sample or photo shoot", "Other"] as const;

export const stockReason = (reason: string, note: string) => (note ? `${reason}: ${note}` : reason);
