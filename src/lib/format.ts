export const BRAND = { name: "OCCUIN", tagline: "Leather goods, made to last.", email: "occuin.co@gmail.com" };

export const FREE_SHIPPING_CENTS = 20000;
export const SHIPPING_METHODS = {
  standard: { cents: 1800 },
  express: { cents: 3800 },
} as const;
export type ShippingMethod = keyof typeof SHIPPING_METHODS;

export const ORDERS_PAUSED_FALLBACK = "We are not taking new orders right now. Please check back soon.";

export type Delivery = {
  makingMinDays: number;
  makingMaxDays: number;
  standardMinDays: number;
  standardMaxDays: number;
  expressMinDays: number;
  expressMaxDays: number;
  standardLabel: string;
  expressLabel: string;
};

export const DEFAULT_DELIVERY: Delivery = {
  makingMinDays: 25,
  makingMaxDays: 30,
  standardMinDays: 35,
  standardMaxDays: 45,
  expressMinDays: 30,
  expressMaxDays: 40,
  standardLabel: "Tracked international, 7 to 12 business days",
  expressLabel: "Express courier, 3 to 5 business days",
};

const dayRange = (min: number, max: number) => (min === max ? `${min} days` : `${min} to ${max} days`);

export const makingTime = (delivery: Delivery) => dayRange(delivery.makingMinDays, delivery.makingMaxDays);
export const makingNote = (delivery: Delivery) => `Every piece is made to order. We take ${makingTime(delivery)} to make and pack it, then it ships from Pakistan.`;
export const bespokeNote = (delivery: Delivery) =>
  `Every piece is made to order, and a piece designed from scratch usually takes longer than our regular ${makingTime(delivery)}. We confirm the timing with your final price, then it ships from Pakistan.`;
export const arrivalTime = (method: ShippingMethod, delivery: Delivery) =>
  method === "standard" ? dayRange(delivery.standardMinDays, delivery.standardMaxDays) : dayRange(delivery.expressMinDays, delivery.expressMaxDays);
export const deliveryEstimate = (method: ShippingMethod, delivery: Delivery) => `Arrives in ${arrivalTime(method, delivery)}`;
export const shippingLabel = (method: string, delivery: Delivery) =>
  method === "standard" ? delivery.standardLabel : method === "express" ? delivery.expressLabel : method;

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export const longDate = (date: Date | string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(date));

export const paymentNote = (hasWhatsApp: boolean) =>
  `You do not pay on this site. After you order, we arrange payment with you ${hasWhatsApp ? "on WhatsApp" : "by email"}.`;

export const orderRef = (number: number) => `OC-${String(number).padStart(6, "0")}`;

export type ShippingRates = { freeShippingCents: number; standardShippingCents: number; expressShippingCents: number };

export const methodCents = (rates: ShippingRates, method: ShippingMethod) =>
  method === "standard" ? rates.standardShippingCents : rates.expressShippingCents;

export function shippingCents(subtotalCents: number, method: ShippingMethod, rates: ShippingRates) {
  if (method === "standard" && subtotalCents >= rates.freeShippingCents) return 0;
  return methodCents(rates, method);
}

export const freeShippingNote = (rates: ShippingRates) =>
  rates.freeShippingCents > 0 ? `free over ${money(rates.freeShippingCents)}` : "free on every order";

export function publicName(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts.at(-1) : undefined;
  return last ? `${parts[0]} ${last[0]!.toUpperCase()}.` : parts[0]!;
}
