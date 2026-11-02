import { ShoppingBag, UserPlus, Prohibit, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { MoreMenu } from "../_components/people-controls";
import { FilterSelect, hrefWith, MoreFilters, Person, PillTabs } from "../_components/people-ui";
import { AdminTitle, Empty, Filters, ghostButtonClass, MetricCard, Pagination, Section, StatGrid, StatusDot, Table, Tag } from "../_components/ui";
import { param, shortDate, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countCustomers, customerStats, listCustomers } from "../_lib/queries-people";

export const metadata: Metadata = { title: "Customers" };

const PATH = "/admin/customers";
const FILTER_KEYS = ["q", "role", "state", "buyers", "sort"];

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const [total, stats] = await Promise.all([countCustomers(search), customerStats()]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listCustomers(search, offset);
  const filtered = FILTER_KEYS.some((key) => param(search, key));
  const exportQuery = new URLSearchParams(FILTER_KEYS.flatMap((key) => (param(search, key) ? [[key, param(search, key)]] : []))).toString();
  const state = param(search, "state");

  return (
    <>
      <AdminTitle
        sub="Everyone who has an account at your store."
        action={total ? <MoreMenu><a href={`/admin/customers/export${exportQuery ? `?${exportQuery}` : ""}`} className="adm-menu-item">Download this list (CSV)</a></MoreMenu> : undefined}
      >
        Customers
      </AdminTitle>
      {param(search, "deleted") ? <p role="status" className="adm-notice mb-3">Customer deleted.</p> : null}
      <StatGrid>
        <MetricCard label="All customers" value={stats.total.toLocaleString("en-US")} icon={<UsersThree size={20} />} description={`${stats.admins} with admin access`} />
        <MetricCard label="Have bought" value={stats.buyers.toLocaleString("en-US")} icon={<ShoppingBag size={20} />} href={`${PATH}?buyers=yes`} />
        <MetricCard label="New, last 30 days" value={stats.recent.toLocaleString("en-US")} icon={<UserPlus size={20} />} href={`${PATH}?sort=newest`} />
        <MetricCard label="Blocked" value={stats.blocked.toLocaleString("en-US")} icon={<Prohibit size={20} />} href={`${PATH}?state=blocked`} />
      </StatGrid>
      <Section title="All customers" description={`${total.toLocaleString("en-US")} found. Total spent leaves out unpaid, cancelled and refunded orders.`}>
        <PillTabs
          label="Filter by account state"
          tabs={[
            { label: "All", href: hrefWith(PATH, search, { state: "" }), active: !state, count: stats.total },
            { label: "Active", href: hrefWith(PATH, search, { state: "active" }), active: state === "active", count: stats.total - stats.blocked },
            { label: "Blocked", href: hrefWith(PATH, search, { state: "blocked" }), active: state === "blocked", count: stats.blocked },
          ]}
        />
        <Filters path={PATH} q={param(search, "q")} placeholder="Name or email">
          {state ? <input type="hidden" name="state" value={state} /> : null}
          <FilterSelect label="Sort by" name="sort" value={param(search, "sort")} options={[["", "Total spent"], ["newest", "Newest"], ["name", "Name"]]} />
          <MoreFilters active={Boolean(param(search, "role") || param(search, "buyers"))}>
            <FilterSelect label="Type" name="role" value={param(search, "role")} options={[["", "Everyone"], ["customer", "Customers"], ["admin", "Admins"]]} />
            <FilterSelect label="Orders" name="buyers" value={param(search, "buyers")} options={[["", "Any"], ["yes", "Has ordered"], ["no", "No orders"]]} />
          </MoreFilters>
        </Filters>
        {rows.length ? (
          <>
            <div className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(4)]:hidden max-sm:[&_:is(th,td):nth-child(5)]:hidden">
            <Table caption="Customers" head={["Customer", "Type", "Status", "Joined", "Orders", "Total spent"]} right={["Orders", "Total spent"]} minWidth="sm:min-w-[720px]">
              {rows.map((customer) => (
                <tr key={customer.id}>
                  <td><Person name={customer.name} detail={customer.email} href={`${PATH}/${customer.id}`} /></td>
                  <td>{customer.role === "admin" ? <Tag>Admin</Tag> : <span className="text-muted">Customer</span>}</td>
                  <td>{customer.blockedAt ? <StatusDot tone="danger">Blocked</StatusDot> : <StatusDot tone="success">Active</StatusDot>}</td>
                  <td className="whitespace-nowrap text-muted">{shortDate(customer.createdAt)}</td>
                  <td className="tabular-nums">{customer.orderCount}</td>
                  <td className="tabular-nums">{money(customer.spentCents)}</td>
                </tr>
              ))}
            </Table>
            </div>
            <Pagination path={PATH} search={search} page={page} last={last} total={total} />
          </>
        ) : filtered ? (
          <Empty title="No customers match" body="Change the filters or clear them." action={<a href={PATH} className={ghostButtonClass}>Clear filters</a>} />
        ) : (
          <Empty title="No customers yet" body="People appear here when they create an account." />
        )}
      </Section>
    </>
  );
}
