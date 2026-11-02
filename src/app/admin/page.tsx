import { CaretRight, ChartLineUp, CurrencyDollar, Receipt, UserPlus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { money, orderRef } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { expireUnpaidOrders } from "@/lib/server/orders";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";
import { CategoryDonut, CustomerGrowthChart, RevenueAreaChart, type ChartDatum } from "./_components/dashboard-charts";
import { RefreshButton } from "./_components/refresh-button";
import { AdminTitle, ContentGrid, Empty, linkClass, MetricCard, Panel, primaryButtonClass, Section, StatusBadge, Table, Trend } from "./_components/ui";
import { dateTime } from "./_lib/format";
import { NEEDS_ACTION_FILTER } from "./_lib/queries";
import { listAllCategories } from "./_lib/queries-catalog";
import { countNewCustomers, dashboardTotals, newCustomersByDay } from "./_lib/queries-dashboard";
import { dailySales, dashboardAttention, dashboardWindows, recentOrders, salesSummary } from "./_lib/queries-orders";
import { lastDays } from "./_lib/report-range";

export const metadata: Metadata = { title: "Dashboard" };

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const CATEGORY_SLICES = 5;

const plural = (count: number, noun: string, rest: string) => `${noun}${count === 1 ? "" : "s"} ${rest}`;
const dayLabel = (day: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

function reportHref(days: number) {
  const { fromText, toText } = lastDays(days);
  return `/admin/reports?from=${fromText}&to=${toText}`;
}

function categorySlices(categories: { name: string; productCount: number }[]): ChartDatum[] {
  const merged = new Map<string, number>();
  for (const { name, productCount } of categories) merged.set(name, (merged.get(name) ?? 0) + productCount);
  const ranked = [...merged].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const rest = ranked.slice(CATEGORY_SLICES).reduce((sum, item) => sum + item.value, 0);
  return rest ? [...ranked.slice(0, CATEGORY_SLICES), { label: "Other", value: rest }] : ranked;
}

export default async function AdminDashboard() {
  await requireAdmin();
  await expireUnpaidOrders();
  const settings = await getSettings();
  const { lowStockLimit } = settings;
  const whatsappMissing = paymentModeOf(settings) === "whatsapp" && !(await contactDetails()).whatsapp;
  const { today, end, month } = dashboardWindows();
  const previousMonth = new Date(month.getTime() - WINDOW_DAYS * DAY_MS);
  const [todaySales, monthSales, priorSales, days, signups, newCustomers, priorCustomers, totals, categories, attention, recent] = await Promise.all([
    salesSummary(today, end),
    salesSummary(month, end),
    salesSummary(previousMonth, month),
    dailySales(month, end),
    newCustomersByDay(month, end),
    countNewCustomers(month, end),
    countNewCustomers(previousMonth, month),
    dashboardTotals(),
    listAllCategories(),
    dashboardAttention(lowStockLimit),
    recentOrders(),
  ]);

  const tasks = [
    { count: attention.needsAction, label: plural(attention.needsAction, "order", "to make or ship"), href: `/admin/orders?status=${NEEDS_ACTION_FILTER}` },
    { count: attention.late, label: plural(attention.late, "order", `older than ${attention.lateDays} days`), href: `/admin/orders?status=${NEEDS_ACTION_FILTER}&sort=oldest` },
    { count: attention.stuck, label: plural(attention.stuck, "order", "still waiting for payment"), href: "/admin/orders?status=pending&sort=oldest" },
    { count: attention.bespokeWaiting, label: plural(attention.bespokeWaiting, "bespoke request", "waiting on you"), href: "/admin/bespoke" },
    { count: attention.messages, label: plural(attention.messages, "message", "to answer"), href: "/admin/messages" },
    { count: attention.lowStockCount, label: plural(attention.lowStockCount, "item", "running low on stock"), href: "/admin/inventory?low=1" },
    { count: totals.unanswered, label: plural(totals.unanswered, "review", "without a reply"), href: "/admin/reviews?state=unanswered" },
    { count: attention.abandoned, label: plural(attention.abandoned, "unfinished cart", "from over a day ago"), href: "/admin/carts" },
  ].filter((task) => task.count > 0);

  const revenueData = days.map((day) => ({ label: dayLabel(day.day), value: day.grossCents }));
  const growthData = days.map((day) => ({ label: dayLabel(day.day), value: signups.get(day.day) ?? 0 }));

  return (
    <>
      <AdminTitle sub="What needs doing today, and how the shop is going." action={<RefreshButton />}>Dashboard</AdminTitle>

      {whatsappMissing ? (
        <p role="alert" className="adm-notice mb-4" data-tone="danger">
          No WhatsApp number is set, so customers cannot send you their orders on WhatsApp. Orders still save and customers are asked to email you. <Link href="/admin/settings" className={linkClass}>Add the number in Settings</Link>
        </p>
      ) : null}

      <Panel title="To do today" flush={tasks.length > 0}>
        {tasks.length ? (
          <ul className="adm-rows">
            {tasks.map((task) => (
              <li key={task.label}>
                <Link href={task.href} className="adm-todo">
                  <span className="adm-todo-count">{task.count}</span>
                  <span className="min-w-0 flex-1 font-medium">{task.label}</span>
                  <CaretRight size={14} aria-hidden="true" className="flex-none text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">You are all caught up. New orders and messages will show here.</p>
        )}
      </Panel>

      <Section title="How the shop is going" description="The last 30 days">
        <ContentGrid cols={4}>
          <MetricCard label="Sales today" value={money(todaySales.netCents)} icon={<CurrencyDollar size={20} />} href={reportHref(1)} description={`${todaySales.orders} ${todaySales.orders === 1 ? "order" : "orders"} today`} />
          <MetricCard label="Sales" value={money(monthSales.netCents)} icon={<ChartLineUp size={20} />} href={reportHref(WINDOW_DAYS)} trend={<Trend current={monthSales.netCents} previous={priorSales.netCents} />} />
          <MetricCard label="Orders" value={monthSales.orders.toLocaleString("en-US")} icon={<Receipt size={20} />} href="/admin/orders" trend={<Trend current={monthSales.orders} previous={priorSales.orders} />} />
          <MetricCard label="New customers" value={newCustomers.toLocaleString("en-US")} icon={<UserPlus size={20} />} href="/admin/customers?sort=newest" trend={<Trend current={newCustomers} previous={priorCustomers} />} />
        </ContentGrid>
      </Section>

      <Section title="Latest orders" action={<Link href="/admin/orders" className={primaryButtonClass}>See all orders</Link>}>
        {recent.length ? (
          <Table caption="Latest orders" head={["Order", "Placed", "Customer", "Status", "Total"]} right={["Total"]} minWidth="min-w-[720px]">
            {recent.map((order) => (
              <tr key={order.id}>
                <td className="whitespace-nowrap"><Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link></td>
                <td className="whitespace-nowrap text-xs text-muted">{dateTime(order.createdAt)}</td>
                <td className="break-all text-muted">{order.email ?? "None"}</td>
                <td><StatusBadge status={order.status} /></td>
                <td className="font-medium tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No orders yet" body="When someone buys from the shop, the order will show here." />
        )}
      </Section>

      <Section title="Charts" description="The last 30 days">
        <ContentGrid cols={3}>
          <RevenueAreaChart data={revenueData} />
          <CustomerGrowthChart data={growthData} />
          <CategoryDonut data={categorySlices(categories)} />
        </ContentGrid>
      </Section>
    </>
  );
}
