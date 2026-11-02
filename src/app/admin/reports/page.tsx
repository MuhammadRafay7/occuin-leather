import { CurrencyDollar, Receipt, ShoppingCart, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { countryName } from "@/lib/validation";
import { AdminTitle, ChartCard, controlClass, Empty, Filters, MetricCard, Notice, Section, StatGrid, Table, Trend } from "../_components/ui";
import { param, shortDate, type SearchParams } from "../_lib/format";
import { bespokeFunnel, dailySales, salesByCategory, salesByCountry, salesSummary, topProducts } from "../_lib/queries-orders";
import { lastDays, parseRange } from "../_lib/report-range";
import { MoreMenu } from "../orders/more-menu";
import { FilterTabs, MenuDownload, Reveal } from "../orders/sales-ui";
import { RevenueChart } from "./revenue-chart";

export const metadata: Metadata = { title: "Sales reports" };

const PRESETS = [7, 30, 90, 365];

const DOWNLOADS = [
  ["daily", "Sales by day (CSV)"],
  ["products", "Top products (CSV)"],
  ["categories", "Sales by category (CSV)"],
  ["countries", "Sales by country (CSV)"],
  ["funnel", "Bespoke requests (CSV)"],
] as const;

export default async function AdminReports({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const range = parseRange(param(search, "from"), param(search, "to"));
  const { from, end, previousFrom, previousEnd, fromText, toText } = range;
  const [current, previous, days, previousDays, products, categories, countries, funnel] = await Promise.all([
    salesSummary(from, end),
    salesSummary(previousFrom, previousEnd),
    dailySales(from, end),
    dailySales(previousFrom, previousEnd),
    topProducts(from, end),
    salesByCategory(from, end),
    salesByCountry(from, end),
    bespokeFunnel(from, end),
  ]);

  const change = (now: number, before: number) =>
    before === 0 && now > 0 ? { description: "New this period" } : { trend: <Trend current={now} previous={before} label={`prior ${range.days}d`} /> };
  const points = days.map((day, index) => ({
    day: day.day,
    cents: day.grossCents,
    orders: day.orders,
    previousDay: previousDays[index]!.day,
    previousCents: previousDays[index]!.grossCents,
  }));
  const hasSales = current.orders > 0 || previous.orders > 0 || current.refundsCents > 0;
  const firstStage = funnel.stages[0]!.count;
  const presets = PRESETS.map((length) => {
    const preset = lastDays(length);
    return {
      label: `Last ${length} days`,
      active: preset.fromText === fromText && preset.toText === toText,
      href: { pathname: "/admin/reports", query: { from: preset.fromText, to: preset.toText } },
    };
  });

  return (
    <>
      <AdminTitle
        sub="How sales are going for the dates you pick."
        action={(
          <MoreMenu>
            {DOWNLOADS.map(([report, label]) => (
              <MenuDownload key={report} href={`/admin/reports/export?${new URLSearchParams({ report, from: fromText, to: toText })}`}>{label}</MenuDownload>
            ))}
          </MoreMenu>
        )}
      >
        Sales reports
      </AdminTitle>

      <div className="mb-3 flex flex-wrap items-start gap-x-2 gap-y-1">
        <FilterTabs
          label="Date presets"
          className="max-w-full min-w-0"
          tabs={presets.map((preset) => ({ label: preset.label, active: preset.active, href: preset.href }))}
        />
        <Reveal label="Pick your own dates" open={!presets.some((preset) => preset.active)} className="open:w-full">
          <Filters path="/admin/reports">
            <label className="grid min-w-0 gap-1 text-xs text-muted max-sm:w-full">
              From
              <input type="date" name="from" defaultValue={fromText} className={`${controlClass} sm:w-40`} />
            </label>
            <label className="grid min-w-0 gap-1 text-xs text-muted max-sm:w-full">
              To
              <input type="date" name="to" defaultValue={toText} className={`${controlClass} sm:w-40`} />
            </label>
          </Filters>
        </Reveal>
      </div>
      <p className="mb-3 text-xs text-muted">Showing {shortDate(from)} to {shortDate(new Date(end.getTime() - 1))}. Compared with {shortDate(previousFrom)} to {shortDate(new Date(previousEnd.getTime() - 1))}. Days follow UTC.</p>
      {range.problem ? <div className="mb-3"><Notice result={{ ok: false, message: range.problem }} /></div> : null}

      <StatGrid columns={4}>
        <MetricCard icon={<TrendUp size={16} />} label="Total sales" value={money(current.grossCents)} {...change(current.grossCents, previous.grossCents)} />
        <MetricCard icon={<CurrencyDollar size={16} />} label="After refunds" value={money(current.netCents)} description={`${money(current.refundsCents)} refunded`} />
        <MetricCard icon={<ShoppingCart size={16} />} label="Orders" value={current.orders} {...change(current.orders, previous.orders)} />
        <MetricCard
          icon={<Receipt size={16} />}
          label="Average order"
          value={current.averageCents === null ? "None" : money(current.averageCents)}
          {...change(current.averageCents ?? 0, previous.averageCents ?? 0)}
        />
      </StatGrid>

      <div className="adm-section">
        {hasSales ? (
          <ChartCard title="Sales by day" subtitle="Compared with the period before">
            <RevenueChart points={points} />
            <details className="mt-3">
              <summary className="cursor-pointer text-muted">Show as a table</summary>
              <div className="mt-2">
                <Table caption="Sales by day" head={["Day", "Orders", "Sales", "Refunds", "Period before"]} right={["Orders", "Sales", "Refunds", "Period before"]} minWidth="min-w-[520px]">
                  {points.map((point, index) => (
                    <tr key={point.day}>
                      <td className="whitespace-nowrap">{shortDate(point.day)}</td>
                      <td className="tabular-nums">{point.orders}</td>
                      <td className="tabular-nums">{money(point.cents)}</td>
                      <td className="tabular-nums">{money(days[index]!.refundsCents)}</td>
                      <td className="tabular-nums">{money(point.previousCents)}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </details>
          </ChartCard>
        ) : (
          <Section title="Sales by day">
            <Empty title="No paid orders in these dates" body="Try a longer period." />
          </Section>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
        <Section title="Top products">
          {products.length ? (
            <Table caption="Top products" head={["Product", "Units", "Orders", "Sales"]} right={["Units", "Orders", "Sales"]} minWidth="min-w-full">
              {products.map((product) => (
                <tr key={product.key}>
                  <td>{product.name}</td>
                  <td className="tabular-nums">{product.units}</td>
                  <td className="tabular-nums">{product.orders}</td>
                  <td className="tabular-nums">{money(product.cents)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="No product sales" body="Nothing sold in these dates." />
          )}
        </Section>

        <Section title="Sales by category">
          {categories.length ? (
            <Table caption="Sales by category" head={["Category", "Units", "Sales"]} right={["Units", "Sales"]} minWidth="min-w-[320px]">
              {categories.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="tabular-nums">{row.units}</td>
                  <td className="tabular-nums">{money(row.cents)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="No category sales" body="Nothing sold in these dates." />
          )}
        </Section>

        <Section title="Sales by country">
          {countries.length ? (
            <Table caption="Sales by country" head={["Country", "Orders", "Sales"]} right={["Orders", "Sales"]} minWidth="min-w-[320px]">
              {countries.map((row) => (
                <tr key={row.country}>
                  <td>{countryName(row.country)}</td>
                  <td className="tabular-nums">{row.orders}</td>
                  <td className="tabular-nums">{money(row.cents)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="No country sales" body="Nothing sold in these dates." />
          )}
        </Section>

        <Section title="Bespoke requests, step by step">
          {firstStage ? (
            <div className="adm-card grid gap-2 p-3">
              {funnel.stages.map((stage) => {
                const share = Math.round((stage.count / firstStage) * 100);
                return (
                  <div key={stage.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5rem] items-center gap-2">
                    <span>{stage.label}</span>
                    <span className="adm-progress block" aria-hidden="true">
                      <span className="block bg-fg" style={{ width: `${share}%` }} />
                    </span>
                    <span className="text-right tabular-nums">{stage.count}, {share}%</span>
                  </div>
                );
              })}
              <p className="text-xs text-muted">Requests made in these dates, and how far they have got today. {funnel.declined} declined.</p>
            </div>
          ) : (
            <Empty title="No bespoke requests" body="No request came in during these dates." />
          )}
        </Section>
      </div>
      <p className="mt-3 text-xs text-muted">Product and category sales are before discounts and leave out orders refunded in full. Country sales are after refunds.</p>
    </>
  );
}
