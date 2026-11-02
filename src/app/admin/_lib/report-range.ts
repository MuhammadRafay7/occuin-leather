import { z } from "zod";

export const DAY_MS = 86_400_000;
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 731;

const isoDay = z.iso.date();

export const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export const startOfDay = (date: Date) => new Date(`${dayKey(date)}T00:00:00.000Z`);
export const parseDay = (text: string) => (isoDay.safeParse(text).success ? new Date(`${text}T00:00:00.000Z`) : null);

export type ReportRange = {
  from: Date;
  end: Date;
  fromText: string;
  toText: string;
  days: number;
  previousFrom: Date;
  previousEnd: Date;
  problem: string | null;
};

function build(from: Date, end: Date, problem: string | null): ReportRange {
  const days = Math.round((end.getTime() - from.getTime()) / DAY_MS);
  return {
    from,
    end,
    fromText: dayKey(from),
    toText: dayKey(new Date(end.getTime() - DAY_MS)),
    days,
    previousFrom: new Date(from.getTime() - days * DAY_MS),
    previousEnd: from,
    problem,
  };
}

export function lastDays(days: number, now = new Date()) {
  const end = new Date(startOfDay(now).getTime() + DAY_MS);
  return build(new Date(end.getTime() - days * DAY_MS), end, null);
}

export function parseRange(fromText: string, toText: string, now = new Date()): ReportRange {
  if (!fromText && !toText) return lastDays(DEFAULT_DAYS, now);
  const fallback = (problem: string) => ({ ...lastDays(DEFAULT_DAYS, now), problem });
  const from = parseDay(fromText);
  const to = parseDay(toText);
  if (!from || !to) return fallback(`Enter both dates. Showing the last ${DEFAULT_DAYS} days.`);
  if (from > to) return fallback(`The start date is after the end date. Showing the last ${DEFAULT_DAYS} days.`);
  const end = new Date(to.getTime() + DAY_MS);
  if ((end.getTime() - from.getTime()) / DAY_MS > MAX_DAYS) return fallback(`Choose ${MAX_DAYS} days or fewer. Showing the last ${DEFAULT_DAYS} days.`);
  return build(from, end, null);
}

export function eachDay(from: Date, end: Date) {
  const days: string[] = [];
  for (let time = from.getTime(); time < end.getTime(); time += DAY_MS) days.push(dayKey(new Date(time)));
  return days;
}
