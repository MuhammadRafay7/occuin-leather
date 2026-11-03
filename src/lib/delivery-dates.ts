import { makingTime, type Delivery, type ShippingMethod } from "./format";

const DAY_MS = 86_400_000;

const later = (from: Date, days: number) => new Date(from.getTime() + days * DAY_MS);

function shortDate(date: Date, from: Date) {
  const sameYear = date.getFullYear() === from.getFullYear();
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(date);
}

export function dateWindow(from: Date, minDays: number, maxDays: number) {
  const start = shortDate(later(from, minDays), from);
  const end = shortDate(later(from, maxDays), from);
  return start === end ? start : `${start} to ${end}`;
}

export const arrivalWindow = (method: ShippingMethod, delivery: Delivery, from = new Date()) =>
  method === "standard"
    ? dateWindow(from, delivery.standardMinDays, delivery.standardMaxDays)
    : dateWindow(from, delivery.expressMinDays, delivery.expressMaxDays);

export const bagDeliveryDates = (lines: { kind: string }[], delivery: Delivery, from = new Date()) =>
  lines.length && lines.every((line) => line.kind === "product") ? { making: makingTime(delivery), arrives: arrivalWindow("standard", delivery, from) } : null;
