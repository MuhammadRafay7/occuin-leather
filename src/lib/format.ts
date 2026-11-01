export const BRAND = { name: "OCCUIN", tagline: "Leather goods, made to last.", email: "occuin.co@gmail.com" };

export const FREE_SHIPPING_CENTS = 20000;
export const SHIPPING_METHODS = {
  standard: { label: "Tracked international, 7 to 12 business days", cents: 1800 },
  express: { label: "Express courier, 3 to 5 business days", cents: 3800 },
} as const;
export type ShippingMethod = keyof typeof SHIPPING_METHODS;

export const MAKING_TIME = "25 to 30 days";
export const MAKING_NOTE = `Every piece is made to order. We take ${MAKING_TIME} to make and pack it, then it ships from Pakistan.`;

const ARRIVAL: Record<ShippingMethod, string> = { standard: "35 to 45 days", express: "30 to 40 days" };
export const deliveryEstimate = (method: ShippingMethod) => `Arrives in ${ARRIVAL[method]}`;

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const longDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(date));

export const orderRef = (number: number) => `OC-${String(number).padStart(6, "0")}`;

export function shippingCents(subtotalCents: number, method: ShippingMethod) {
  if (method === "standard" && subtotalCents >= FREE_SHIPPING_CENTS) return 0;
  return SHIPPING_METHODS[method].cents;
}
