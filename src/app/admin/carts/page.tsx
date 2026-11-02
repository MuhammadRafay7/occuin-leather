import { CurrencyDollar, EnvelopeSimple, ShoppingCartSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { z } from "zod";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, Empty, MetricCard, Pagination, Table } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countAbandonedCarts, listAbandonedCarts } from "../_lib/queries-orders";
import { DesktopOnly, FilterTabs, MobileCard, MobileCards, StatStrip } from "../orders/sales-ui";

export const metadata: Metadata = { title: "Unfinished carts" };

const IDLE_OPTIONS = { "1": "1 hour", "6": "6 hours", "24": "24 hours", "72": "3 days", "168": "7 days", "720": "30 days" } as const;
const idleSchema = z.enum(Object.keys(IDLE_OPTIONS) as [keyof typeof IDLE_OPTIONS, ...(keyof typeof IDLE_OPTIONS)[]]).catch("24");

type Cart = Awaited<ReturnType<typeof listAbandonedCarts>>[number];

function idleFor(since: Date, now: Date) {
  const hours = Math.floor((now.getTime() - since.getTime()) / 3_600_000);
  if (hours < 1) return "Under an hour";
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${Math.floor(hours / 24)} days`;
}

function CartLines({ cart }: { cart: Cart }) {
  return (
    <div>
      <ul>
        {cart.lines.map((line) => <li key={line.id}>{line.name} × {line.quantity}</li>)}
      </ul>
      {cart.promoCode ? <p className="text-xs text-muted">Discount code {cart.promoCode}</p> : null}
    </div>
  );
}

export default async function AdminCarts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const idle = idleSchema.parse(param(search, "idle"));
  const now = new Date();
  const hours = Number(idle);
  const windows = Object.entries(IDLE_OPTIONS);
  const total = await countAbandonedCarts(hours, now);
  const { page, last, offset } = pageOf(search, total);
  const [carts, counts] = await Promise.all([
    listAbandonedCarts(hours, offset, now),
    Promise.all(windows.map(([value]) => countAbandonedCarts(Number(value), now))),
  ]);
  const shownValue = carts.reduce((sum, cart) => sum + cart.valueCents, 0);
  const shownEmails = carts.filter((cart) => cart.email).length;

  return (
    <>
      <AdminTitle sub="Shoppers who added items but did not check out.">Unfinished carts</AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<ShoppingCartSimple size={16} />} label="Carts left behind" value={total} description={`Untouched for ${IDLE_OPTIONS[idle]} or more`} />
        <MetricCard icon={<CurrencyDollar size={16} />} label="Value" value={money(shownValue)} description="Carts on this page, at today's prices" />
        <MetricCard icon={<EnvelopeSimple size={16} />} label="With an email" value={shownEmails} description="Carts on this page" />
      </StatStrip>

      <FilterTabs
        label="Untouched for at least"
        caption="Untouched for"
        tabs={windows.map(([value, label], index) => ({
          label,
          count: counts[index],
          active: idle === value,
          href: { pathname: "/admin/carts", query: { idle: value } },
        }))}
      />

      {carts.length ? (
        <>
          <DesktopOnly>
            <Table caption="Unfinished carts" head={["Customer", "Items", "Untouched for", "Value"]} right={["Value"]}>
              {carts.map((cart) => (
                <tr key={cart.id}>
                  <td>
                    {cart.owner?.name ?? (cart.guest ? "Guest" : "Deleted account")}
                    <span className="block text-xs text-muted [overflow-wrap:anywhere]">{cart.email ?? "No email"}</span>
                  </td>
                  <td><CartLines cart={cart} /></td>
                  <td className="whitespace-nowrap">{idleFor(cart.updatedAt, now)}</td>
                  <td className="font-medium tabular-nums">{money(cart.valueCents)}</td>
                </tr>
              ))}
            </Table>
          </DesktopOnly>
          <MobileCards label="Unfinished carts">
            {carts.map((cart) => (
              <MobileCard
                key={cart.id}
                title={cart.owner?.name ?? (cart.guest ? "Guest" : "Deleted account")}
                sub={cart.email ?? "No email"}
                rows={[
                  ["Value", <span key="value" className="font-medium">{money(cart.valueCents)}</span>],
                  ["Untouched for", idleFor(cart.updatedAt, now)],
                ]}
              >
                <CartLines cart={cart} />
              </MobileCard>
            ))}
          </MobileCards>
          <Pagination path="/admin/carts" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty title="No unfinished carts" body={`No cart with items has been idle for ${IDLE_OPTIONS[idle]} or more.`} />
      )}
    </>
  );
}
