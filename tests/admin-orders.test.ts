import { describe, expect, it } from "vitest";
import { csvCell, csvMoney, csvText } from "@/app/admin/_lib/csv";
import { eachDay, lastDays, parseRange } from "@/app/admin/_lib/report-range";

const NOW = new Date("2026-03-15T12:00:00Z");

describe("csv cells", () => {
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\t=1", " =1", "＝1"])("neutralises %j", (value) => {
    expect(csvCell(value).startsWith(`"'`)).toBe(true);
  });

  it("leaves plain text and numbers alone", () => {
    expect(csvCell("a@b.com")).toBe('"a@b.com"');
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell(null)).toBe("");
  });

  it("escapes quotes and joins rows", () => {
    expect(csvText(["a"], [['x"y']])).toBe('"a"\r\n"x""y"');
    expect(csvMoney(1999)).toBe(19.99);
  });
});

describe("report range", () => {
  it("defaults to the last 30 UTC days ending today", () => {
    const range = parseRange("", "", NOW);
    expect(range).toMatchObject({ fromText: "2026-02-14", toText: "2026-03-15", days: 30, problem: null });
    expect(range.previousEnd).toEqual(range.from);
    expect(eachDay(range.previousFrom, range.previousEnd)).toHaveLength(30);
  });

  it("compares a chosen range with the same number of days before it", () => {
    const range = parseRange("2026-03-01", "2026-03-07", NOW);
    expect(range.days).toBe(7);
    expect(range.previousFrom.toISOString().slice(0, 10)).toBe("2026-02-22");
  });

  it.each([
    ["2026-03-07", "2026-03-01"],
    ["2026-02-31", "2026-03-01"],
    ["2026-03-01", ""],
    ["2020-01-01", "2026-01-01"],
  ])("falls back on %s to %s", (from, to) => {
    const range = parseRange(from, to, NOW);
    expect(range.problem).toBeTruthy();
    expect(range.days).toBe(30);
  });

  it("covers exactly one day for a single-day range", () => {
    expect(lastDays(1, NOW).fromText).toBe("2026-03-15");
    expect(eachDay(lastDays(1, NOW).from, lastDays(1, NOW).end)).toEqual(["2026-03-15"]);
  });
});
