import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { balanceCents, balanceOwedCents, bespokeRef, depositCents } from "@/lib/bespoke/status";
import { MAKING_TIME, money, orderRef, SHIPPING_METHODS, type ShippingMethod } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { getOrder } from "@/lib/server/orders";
import { describeDesign } from "@/lib/studio/pricing";
import { AdminTitle, linkClass, Section, StatusBadge, Table } from "../../_components/ui";
import { dateTime } from "../../_lib/format";
import { findCustomer } from "../../_lib/queries";
import { BalancePanel } from "../../bespoke/[id]/balance-panel";
import { MoveOrderForm } from "./move-form";

export const metadata: Metadata = { title: "Order" };

type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

function Pairs({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DesignDetail({ item }: { item: Order["items"][number] }) {
  const { designSpec, designPrice, image } = item;
  if (!designSpec) return null;
  return (
    <div className="grid gap-4 border border-line p-3 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium">{item.name}, specification</h3>
        <Pairs rows={describeDesign(designSpec)} />
        {image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block text-sm ${linkClass}`}>Open preview image</a>
        ) : null}
      </div>
      {designPrice ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Price breakdown</h3>
          <Pairs
            rows={[
              ...designPrice.lines.map((line): [string, ReactNode] => [line.label, money(line.cents)]),
              ["Total", money(designPrice.totalCents)],
              ["Lead time", MAKING_TIME],
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();
  const order = await getOrder(parsed.data);
  if (!order) notFound();

  const customer = await findCustomer(order.ownerKey);
  const address = order.shippingAddress;
  const method = SHIPPING_METHODS[order.shippingMethod as ShippingMethod]?.label ?? order.shippingMethod;
  const designs = order.items.filter((item) => item.designSpec);
  const balanceDueCents = order.bespoke.reduce((sum, request) => sum + balanceOwedCents(request), 0);

  return (
    <>
      <AdminTitle
        sub={`Placed ${dateTime(order.createdAt)}`}
        action={<Link href="/admin/orders" className={`text-sm ${linkClass}`}>All orders</Link>}
      >
        {orderRef(order.number)}
      </AdminTitle>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-medium">Customer</h2>
              <Pairs
                rows={[
                  ["Name", customer?.name ?? address?.name ?? "Guest"],
                  ["Account", customer?.email ?? "Guest checkout"],
                  ["Order email", order.email ?? "None"],
                ]}
              />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-medium">Shipping address</h2>
              {address ? (
                <address className="text-sm not-italic">
                  {address.name}<br />
                  {address.line1}<br />
                  {address.line2 ? <>{address.line2}<br /></> : null}
                  {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}<br />
                  {address.country}
                </address>
              ) : (
                <p className="text-sm text-muted">No address on this order.</p>
              )}
            </div>
          </div>

          <Section title="Items">
            <Table caption="Order items" head={["Item", "Detail", "Unit", "Qty", "Line total"]} minWidth="min-w-[600px]">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    {item.designSpec ? <span className="block text-xs text-muted">Made to order</span> : null}
                    {item.bespokeRequestId ? <Link href={`/admin/bespoke/${item.bespokeRequestId}`} className={`block text-xs ${linkClass}`}>Bespoke request</Link> : null}
                  </td>
                  <td className="max-w-[40ch] text-muted">{item.designSpec ? "See specification below" : item.detail}</td>
                  <td className="tabular-nums">{money(item.unitPriceCents)}</td>
                  <td className="tabular-nums">{item.quantity}</td>
                  <td className="tabular-nums">{money(item.unitPriceCents * item.quantity)}</td>
                </tr>
              ))}
            </Table>
          </Section>

          {designs.length ? (
            <Section title="Made-to-order pieces">
              <div className="grid gap-3">
                {designs.map((item) => <DesignDetail key={item.id} item={item} />)}
              </div>
            </Section>
          ) : null}

          <Section title="Timeline">
            {order.events.length ? (
              <ol className="grid gap-2 text-sm">
                {order.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-line pb-2">
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-muted">{dateTime(event.createdAt)}</span>
                    {event.note ? <p className="w-full whitespace-pre-wrap pt-1">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No events recorded.</p>
            )}
          </Section>
        </div>

        <aside className="grid content-start gap-6">
          <div className="border border-line p-3">
            <h2 className="mb-2 text-sm font-medium">Status</h2>
            <p className="mb-3 text-sm">{STATUS_LABELS[order.status]}</p>
            <MoveOrderForm orderId={order.id} status={order.status} balanceDueCents={balanceDueCents} />
          </div>
          {order.bespoke.map((request) => (
            <div key={request.id} className="border border-line p-3">
              <h2 className="mb-2 text-sm font-medium"><Link href={`/admin/bespoke/${request.id}`} className={linkClass}>{bespokeRef(request.number)}</Link> deposit and balance</h2>
              <Pairs
                rows={[
                  ["Total", money(request.quotedPriceCents ?? 0)],
                  [request.depositPaidAt ? "Deposit paid" : `Deposit, ${request.depositPercent}%`, money(depositCents(request.quotedPriceCents ?? 0, request.depositPercent))],
                  [request.balancePaidAt ? "Balance paid" : "Balance due", money(balanceCents(request.quotedPriceCents ?? 0, request.depositPercent))],
                ]}
              />
              {balanceOwedCents(request) ? <div className="mt-3"><BalancePanel requestId={request.id} owedCents={balanceOwedCents(request)} requestedAt={request.balanceRequestedAt ? dateTime(request.balanceRequestedAt) : null} /></div> : null}
            </div>
          ))}
          <div className="border border-line p-3">
            <h2 className="mb-2 text-sm font-medium">Payment and shipping</h2>
            <Pairs
              rows={[
                ["Subtotal", money(order.subtotalCents)],
                ["Discount", order.discountCents ? `-${money(order.discountCents)}` : money(0)],
                ["Shipping", money(order.shippingCents)],
                ["Tax", money(order.taxCents)],
                ["Total", money(order.totalCents)],
                ["Promo code", order.promoCode ?? "None"],
                ["Method", method],
                ["Tracking", order.trackingNumber ?? "None"],
                ["Payment ID", order.stripePaymentIntentId ?? "None"],
              ]}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
