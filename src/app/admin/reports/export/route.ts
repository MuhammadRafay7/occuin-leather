import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { countryName } from "@/lib/validation";
import { csvMoney, csvResponse, type CsvValue } from "../../_lib/csv";
import { bespokeFunnel, dailySales, salesByCategory, salesByCountry, topProducts } from "../../_lib/queries-orders";
import { parseRange, type ReportRange } from "../../_lib/report-range";

type Sheet = { head: string[]; rows: (range: ReportRange) => Promise<CsvValue[][]> };

const SHEETS: Record<string, Sheet> = {
  daily: {
    head: ["day", "orders", "gross_usd", "refunds_usd", "net_usd"],
    rows: async ({ from, end }) => (await dailySales(from, end)).map((day) => [day.day, day.orders, csvMoney(day.grossCents), csvMoney(day.refundsCents), csvMoney(day.grossCents - day.refundsCents)]),
  },
  products: {
    head: ["product", "units", "orders", "sales_usd"],
    rows: async ({ from, end }) => (await topProducts(from, end, null)).map((row) => [row.name, row.units, row.orders, csvMoney(row.cents)]),
  },
  categories: {
    head: ["category", "units", "sales_usd"],
    rows: async ({ from, end }) => (await salesByCategory(from, end)).map((row) => [row.category, row.units, csvMoney(row.cents)]),
  },
  countries: {
    head: ["country", "orders", "net_sales_usd"],
    rows: async ({ from, end }) => (await salesByCountry(from, end)).map((row) => [countryName(row.country), row.orders, csvMoney(row.cents)]),
  },
  funnel: {
    head: ["stage", "requests"],
    rows: async ({ from, end }) => {
      const { stages, declined } = await bespokeFunnel(from, end);
      return [...stages.map((stage): CsvValue[] => [stage.label, stage.count]), ["Declined", declined]];
    },
  },
};

export async function GET(request: NextRequest) {
  await requireAdmin();
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("report") ?? "daily";
  const sheet = Object.hasOwn(SHEETS, name) ? SHEETS[name] : undefined;
  if (!sheet) return new Response("Unknown report", { status: 400 });
  const range = parseRange(searchParams.get("from") ?? "", searchParams.get("to") ?? "");
  if (range.problem) return new Response(range.problem, { status: 400 });
  return csvResponse(`occuin-${name}-${range.fromText}-to-${range.toText}.csv`, sheet.head, await sheet.rows(range));
}
