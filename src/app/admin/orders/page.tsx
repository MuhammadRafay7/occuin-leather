import { Clock, TrendUp, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { money, orderRef, SHIPPING_METHODS } from "@/lib/format";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { expireUnpaidOrders } from "@/lib/server/orders";
import { countryName } from "@/lib/validation";
import { AdminTitle, controlClass, Empty, Filters, linkClass, MetricCard, Pagination, StatusBadge, Table } from "../_components/ui";
import { shortDate, type SearchParams } from "../_lib/format";
import { NEEDS_ACTION_FILTER, pageOf } from "../_lib/queries";
import { countFilteredOrders, listFilteredOrders, ORDER_SORTS, orderCountries, parseOrderFilters, salesSummary, type OrderFilters } from "../_lib/queries-orders";
import { lastDays } from "../_lib/report-range";
import { MoreMenu } from "./more-menu";
import { ActiveFilters, DesktopOnly, FilterTabs, MenuDownload, MobileCard, MobileCards, Reveal, StatStrip, ViewLink } from "./sales-ui";

export const metadata: Metadata = { title: "Orders" };

const NO_FILTERS: OrderFilters = { status: "", q: "", from: "", to: "", method: "", country: "", sort: "newest" };

const MAIN_TABS = [
  { label: "All", value: "" },
  { label: "Needs action", value: NEEDS_ACTION_FILTER },
  { label: "Waiting for payment", value: "pending" },
  { label: STATUS_LABELS.shipped, value: "shipped" },
  { label: STATUS_LABELS.delivered, value: "delivered" },
];
const MORE_TABS = ORDER_STATUSES.filter((value) => !MAIN_TABS.some((tab) => tab.value === value)).map((value) => ({ label: STATUS_LABELS[value], value: value as string }));
const STATUS_TABS = [...MAIN_TABS, ...MORE_TABS];

const queryOf = (filters: OrderFilters) => Object.fromEntries(Object.entries(filters).filter(([, value]) => value));

const exportHref = (filters: OrderFilters) => `/admin/orders/export?${new URLSearchParams(queryOf(filters))}`;

const activeCount = (filters: OrderFilters) => [filters.status, filters.q, filters.from, filters.to, filters.method, filters.country].filter(Boolean).length;
const hasFilters = (filters: OrderFilters) => activeCount(filters) > 0;

function RefundedNote({ order }: { order: { refundedCents: number; status: string } }) {
  if (!order.refundedCents) return null;
  return <span className="block text-xs text-muted">{money(order.refundedCents)} refunded{order.status === "refunded" ? "" : ", in part"}</span>;
}

export default async function AdminOrders({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  await expireUnpaidOrders();
  const search = await searchParams;
  const filters = parseOrderFilters(search);
  const total = await countFilteredOrders(filters);
  const { page, last, offset } = pageOf(search, total);
  const month = lastDays(30);
  const [rows, countries, needsAction, awaitingPayment, sales, tabCounts] = await Promise.all([
    listFilteredOrders(filters, offset),
    orderCountries(),
    countFilteredOrders({ ...NO_FILTERS, status: NEEDS_ACTION_FILTER }),
    countFilteredOrders({ ...NO_FILTERS, status: "pending" }),
    salesSummary(month.from, month.end),
    Promise.all(STATUS_TABS.map((tab) => countFilteredOrders({ ...filters, status: tab.value }))),
  ]);
  const active = activeCount(filters);
  const tabs = STATUS_TABS.map((tab, index) => ({
    label: tab.label,
    count: tabCounts[index],
    active: filters.status === tab.value,
    href: { pathname: "/admin/orders", query: queryOf({ ...filters, status: tab.value }) },
  }));
  const moreOpen = Boolean(filters.from || filters.to || filters.method || filters.country || filters.sort !== "newest");
  const field = "grid min-w-0 gap-1 text-xs text-muted max-sm:w-full";

  return (
    <>
      <AdminTitle
        sub="Every customer order. Open one to update it, ship it or refund it."
        action={<MoreMenu><MenuDownload href={exportHref(filters)}>Download this list (CSV)</MenuDownload></MoreMenu>}
      >
        Orders
      </AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<Wrench size={16} />} label="Needs action" value={needsAction} description="Paid, not sent yet" href={`/admin/orders?status=${NEEDS_ACTION_FILTER}`} />
        <MetricCard icon={<Clock size={16} />} label="Waiting for payment" value={awaitingPayment} href="/admin/orders?status=pending" />
        <MetricCard icon={<TrendUp size={16} />} label="Sales, last 30 days" value={money(sales.netCents)} description="After refunds" href="/admin/reports" />
      </StatStrip>

      <FilterTabs label="Order status" tabs={tabs.slice(0, MAIN_TABS.length)} more={tabs.slice(MAIN_TABS.length)} />
      <Filters path="/admin/orders" q={filters.q} placeholder="Order number or email">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <Reveal label="More filters" open={moreOpen} className="order-last open:w-full">
          <div className="flex flex-wrap items-end gap-3">
            <label className={field}>
              From
              <input type="date" name="from" defaultValue={filters.from} className={`${controlClass} sm:w-36`} />
            </label>
            <label className={field}>
              To
              <input type="date" name="to" defaultValue={filters.to} className={`${controlClass} sm:w-36`} />
            </label>
            <label className={field}>
              Shipping
              <select name="method" defaultValue={filters.method} className={`${controlClass} sm:w-32`}>
                <option value="">All methods</option>
                {Object.keys(SHIPPING_METHODS).map((method) => (
                  <option key={method} value={method}>{method === "express" ? "Express" : "Standard"}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              Country
              <select name="country" defaultValue={filters.country} className={`${controlClass} sm:w-36`}>
                <option value="">All countries</option>
                {countries.map((code) => (
                  <option key={code} value={code}>{countryName(code)}</option>
                ))}
              </select>
            </label>
            <label className={field}>
              Sort
              <select name="sort" defaultValue={filters.sort} className={`${controlClass} sm:w-40`}>
                {Object.entries(ORDER_SORTS).map(([value, sort]) => (
                  <option key={value} value={value}>{sort.label}</option>
                ))}
              </select>
            </label>
          </div>
        </Reveal>
      </Filters>
      <ActiveFilters count={active} clearHref="/admin/orders" />

      {rows.length ? (
        <>
          <DesktopOnly>
            <Table caption="Orders" head={["Order", "Customer", "Status", "Total", "Date", "Actions"]} right={["Total", "Actions"]}>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap"><Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link></td>
                  <td>
                    {order.customerName ?? "Guest"}
                    <span className="block text-xs text-muted [overflow-wrap:anywhere]">{order.email ?? "No email"}</span>
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                    {order.paymentMethod === "whatsapp" ? <span className="block text-xs text-muted">WhatsApp order</span> : null}
                  </td>
                  <td className="tabular-nums">
                    <span className="font-medium">{money(order.totalCents)}</span>
                    <RefundedNote order={order} />
                  </td>
                  <td className="whitespace-nowrap text-muted">{shortDate(order.createdAt)}</td>
                  <td><ViewLink href={`/admin/orders/${order.id}`} label={`View ${orderRef(order.number)}`} /></td>
                </tr>
              ))}
            </Table>
          </DesktopOnly>
          <MobileCards label="Orders">
            {rows.map((order) => (
              <MobileCard
                key={order.id}
                title={<Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link>}
                sub={<>{order.customerName ? <span className="block text-fg">{order.customerName}</span> : null}{order.email ?? "No email"}</>}
                chip={<StatusBadge status={order.status} />}
                rows={[
                  ["Total", <><span className="font-medium">{money(order.totalCents)}</span><RefundedNote order={order} /></>],
                  ["Date", shortDate(order.createdAt)],
                  ...(order.paymentMethod === "whatsapp" ? ([["Ordered on", "WhatsApp"]] as [string, string][]) : []),
                ]}
              >
                <ViewLink href={`/admin/orders/${order.id}`} label={`View ${orderRef(order.number)}`} />
              </MobileCard>
            ))}
          </MobileCards>
          <Pagination path="/admin/orders" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={hasFilters(filters) ? "No orders match" : "No orders yet"}
          body={hasFilters(filters) ? "Try wider dates or fewer filters." : "Orders appear here as soon as a customer checks out."}
        />
      )}
    </>
  );
}
