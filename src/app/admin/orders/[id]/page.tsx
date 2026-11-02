import { Package, PaperPlaneTilt, Printer } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { z } from "zod";
import { balanceCents, balanceOwedCents, bespokeRef, depositCents } from "@/lib/bespoke/status";
import { makingTime, money, orderRef, shippingLabel, type Delivery } from "@/lib/format";
import { getDelivery } from "@/lib/server/content";
import { canTransition } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { getOrder, stripe } from "@/lib/server/orders";
import { whatsappChatUrl } from "@/lib/bespoke/whatsapp";
import { describeDesign } from "@/lib/studio/pricing";
import { resendOrderConfirmation } from "@/lib/actions/admin-orders";
import { countryName, phoneDigits } from "@/lib/validation";
import { ActionButton } from "../../_components/controls";
import { AdminTitle, buttonClass, DetailGrid, linkClass, Pairs, Panel, StatusBadge, Table } from "../../_components/ui";
import { dateTime } from "../../_lib/format";
import { findOrderCustomer, listOrderNotes, listOrderRefunds } from "../../_lib/queries-orders";
import { BalancePanel } from "../../bespoke/[id]/balance-panel";
import { MoreMenu } from "../more-menu";
import { MoveOrderForm } from "./move-form";
import { NoteForm, RefundPanel, TrackingForm } from "./panels";
import { MarkPaidForm } from "./mark-paid-form";

export const metadata: Metadata = { title: "Order" };

type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

function DesignDetail({ item, delivery }: { item: Order["items"][number]; delivery: Delivery }) {
  const { designSpec, designPrice, image } = item;
  if (!designSpec) return null;
  return (
    <div className="grid gap-4 p-3 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium">{item.name}, specification</h3>
        <Pairs rows={describeDesign(designSpec)} />
        {image ? (
          <a href={image} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block ${linkClass}`}>Open preview image</a>
        ) : null}
      </div>
      {designPrice ? (
        <div>
          <h3 className="mb-2 text-sm font-medium">Price breakdown</h3>
          <Pairs
            rows={[
              ...designPrice.lines.map((line): [string, ReactNode] => [line.label, money(line.cents)]),
              ["Total", money(designPrice.totalCents)],
              ["Lead time", makingTime(delivery)],
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

  const [customer, refunds, notes] = await Promise.all([findOrderCustomer(order.ownerKey), listOrderRefunds(order.id), listOrderNotes(order.id)]);
  const refundedCents = order.status === "refunded" ? order.totalCents : refunds.reduce((sum, refund) => sum + refund.amountCents, 0);
  const canResend = Boolean(order.email) && !["pending", "cancelled", "refunded"].includes(order.status);
  const address = order.shippingAddress;
  const delivery = await getDelivery();
  const method = shippingLabel(order.shippingMethod, delivery);
  const designs = order.items.filter((item) => item.designSpec);
  const balanceDueCents = order.bespoke.reduce((sum, request) => sum + balanceOwedCents(request), 0);
  const whatsappOrder = order.paymentMethod === "whatsapp";
  const awaitingWhatsApp = whatsappOrder && order.status === "pending";
  const customerChat = address?.phone ? whatsappChatUrl(phoneDigits(address.phone), `Hello ${address.name}, this is OCCUIN about your order ${orderRef(order.number)}.`) : null;

  return (
    <>
      <AdminTitle
        back={{ href: "/admin/orders", label: "Orders" }}
        meta={<StatusBadge status={order.status} />}
        sub={`Placed ${dateTime(order.createdAt)}. Update its status or give a refund from this page.`}
        action={
          <MoreMenu>
            <a href={`/admin/orders/${order.id}/invoice`} target="_blank" rel="noopener" className="adm-menu-item"><Printer size={14} aria-hidden="true" />Print invoice</a>
            <a href={`/admin/orders/${order.id}/packing-slip`} target="_blank" rel="noopener" className="adm-menu-item"><Package size={14} aria-hidden="true" />Print packing slip</a>
            {canResend ? <div className="p-1"><ActionButton action={resendOrderConfirmation.bind(null, order.id)}><PaperPlaneTilt size={14} aria-hidden="true" />Email the confirmation again</ActionButton></div> : null}
          </MoreMenu>
        }
      >
        {orderRef(order.number)}
      </AdminTitle>

      <DetailGrid
        main={(
          <>
            <Panel title="Items" flush>
              <div className="overflow-x-auto" role="region" aria-label="Order items" tabIndex={0}>
                <table className="adm-table sm:min-w-[600px]" data-right="3 4 5">
                  <caption className="sr-only">Order items</caption>
                  <thead>
                    <tr>{["Item", "Detail", "Unit", "Qty", "Line total"].map((label) => <th key={label} scope="col" className={label === "Detail" || label === "Unit" ? "max-sm:hidden" : undefined}>{label}</th>)}</tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="font-medium">{item.name}</span>
                          {item.designSpec ? <span className="block text-xs text-muted">Made to order</span> : null}
                          <span className="block text-xs text-muted sm:hidden">{item.designSpec ? "See specification below" : item.detail}</span>
                          {item.bespokeRequestId ? <Link href={`/admin/bespoke/${item.bespokeRequestId}`} className={`block text-xs ${linkClass}`}>Bespoke request</Link> : null}
                        </td>
                        <td className="max-w-[40ch] text-muted max-sm:hidden">{item.designSpec ? "See specification below" : item.detail}</td>
                        <td className="tabular-nums max-sm:hidden">{money(item.unitPriceCents)}</td>
                        <td className="tabular-nums">{item.quantity}</td>
                        <td className="tabular-nums">{money(item.unitPriceCents * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-line p-3 sm:pl-[50%] [&_dd]:text-right [&_dd]:tabular-nums">
                <Pairs
                  rows={[
                    ["Subtotal", money(order.subtotalCents)],
                    ["Discount", order.discountCents ? `-${money(order.discountCents)}` : money(0)],
                    ["Shipping", money(order.shippingCents)],
                    ["Tax", money(order.taxCents)],
                    ["Total", <strong key="total" className="font-semibold">{money(order.totalCents)}</strong>],
                    ["Refunded", refundedCents ? `-${money(refundedCents)}` : money(0)],
                    ["Customer paid in the end", <strong key="net" className="font-semibold">{money(order.totalCents - refundedCents)}</strong>],
                  ]}
                />
              </div>
            </Panel>

            {designs.length ? (
              <Panel title="Made-to-order pieces" flush>
                <div className="adm-rows divide-y divide-line">
                  {designs.map((item) => <DesignDetail key={item.id} item={item} delivery={delivery} />)}
                </div>
              </Panel>
            ) : null}

            <Panel title="Notes for your team">
              <NoteForm orderId={order.id} />
              {notes.length ? (
                <ul className="mt-3 grid gap-2 border-t border-line pt-3">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <p className="whitespace-pre-wrap break-words">{note.body}</p>
                      <p className="mt-0.5 text-xs text-muted">{note.actorEmail}, {dateTime(note.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>

            <Panel title="History">
              {order.events.length ? (
                <ol className="grid gap-3 border-l border-line pl-4">
                  {order.events.map((event) => (
                    <li key={event.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span aria-hidden="true" className="absolute top-1.5 -left-[20.5px] size-2 rounded-full bg-muted" />
                      <StatusBadge status={event.status} />
                      <span className="text-xs text-muted">{dateTime(event.createdAt)}</span>
                      {event.note ? <p className="w-full whitespace-pre-wrap">{event.note}</p> : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted">Nothing recorded yet.</p>
              )}
            </Panel>

            {refunds.length ? (
              <Panel title="Refund history" flush>
                <div className="overflow-x-auto" role="region" aria-label="Refund history" tabIndex={0}>
                  <table className="adm-table min-w-[640px]" data-right="2">
                    <caption className="sr-only">Refund history</caption>
                    <thead>
                      <tr>{["When", "Amount", "Reason", "By", "Card refund number"].map((label) => <th key={label} scope="col">{label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {refunds.map((refund) => (
                        <tr key={refund.id}>
                          <td className="whitespace-nowrap">{dateTime(refund.createdAt)}</td>
                          <td className="tabular-nums">{money(refund.amountCents)}</td>
                          <td className="max-w-[36ch] whitespace-pre-wrap">{refund.reason}</td>
                          <td>{refund.actorEmail}</td>
                          <td className="text-muted">{refund.stripeRefundId ?? "Recorded by hand, no card refund"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}
          </>
        )}
        side={(
          <>
            {whatsappOrder ? (
              <Panel title="WhatsApp order">
                {awaitingWhatsApp ? <MarkPaidForm orderId={order.id} /> : <p className="text-muted">This order was placed for payment on WhatsApp.</p>}
                {customerChat ? <a href={customerChat} target="_blank" rel="noopener noreferrer" className={`mt-3 inline-block ${linkClass}`}>Open WhatsApp chat</a> : null}
              </Panel>
            ) : null}
            <Panel title="For the maker">
              <p className="mb-2 text-muted">Exact details and 3D images to send to your manufacturer, with no prices or customer contact details.</p>
              <Link href={`/admin/orders/${order.id}/manufacturer`} className={buttonClass}>Manufacturer sheet</Link>
            </Panel>
            <Panel title="Update status">
              <MoveOrderForm orderId={order.id} status={order.status} balanceDueCents={balanceDueCents} />
            </Panel>
            <Panel title="Customer">
              <Pairs
                rows={[
                  ["Name", customer?.name ?? address?.name ?? "Guest"],
                  ["Account", customer ? <Link key="customer" href={`/admin/customers/${customer.id}`} className={linkClass}>{customer.email}</Link> : "Guest checkout"],
                  ["Order email", order.email ?? "None"],
                  ...(address?.phone ? ([["Phone", address.phone]] as [string, string][]) : []),
                ]}
              />
            </Panel>
            <Panel title="Shipping">
              {address ? (
                <address className="mb-3 not-italic">
                  {address.name}<br />
                  {address.line1}<br />
                  {address.line2 ? <>{address.line2}<br /></> : null}
                  {[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}<br />
                  {countryName(address.country)}
                </address>
              ) : (
                <p className="mb-3 text-muted">No address on this order.</p>
              )}
              <TrackingForm orderId={order.id} trackingNumber={order.trackingNumber} editable={order.status !== "pending" && order.status !== "cancelled"} />
            </Panel>
            <Panel title="Payment and delivery">
              <Pairs
                rows={[
                  ["Discount code", order.promoCode ?? "None"],
                  ["Delivery", method],
                  whatsappOrder ? ["Payment", "Arranged on WhatsApp"] : ["Payment number", order.stripePaymentIntentId ?? "None"],
                ]}
              />
            </Panel>
            <Panel title="Refund">
              <RefundPanel
                orderId={order.id}
                refundable={canTransition(order.status, "refunded")}
                totalCents={order.totalCents}
                refundedCents={refundedCents}
                hasPaymentIntent={Boolean(order.stripePaymentIntentId)}
                stripeConfigured={Boolean(stripe)}
              />
            </Panel>
            {order.bespoke.map((request) => (
              <Panel key={request.id} title={<><Link href={`/admin/bespoke/${request.id}`} className={linkClass}>{bespokeRef(request.number)}</Link> deposit and remaining balance</>}>
                <Pairs
                  rows={[
                    ["Total", money(request.quotedPriceCents ?? 0)],
                    [request.depositPaidAt ? "Deposit paid" : `Deposit, ${request.depositPercent}%`, money(depositCents(request.quotedPriceCents ?? 0, request.depositPercent))],
                    [request.balancePaidAt ? "Balance paid" : "Balance due", money(balanceCents(request.quotedPriceCents ?? 0, request.depositPercent))],
                  ]}
                />
                {balanceOwedCents(request) && !awaitingWhatsApp ? <div className="mt-3"><BalancePanel requestId={request.id} owedCents={balanceOwedCents(request)} requestedAt={request.balanceRequestedAt ? dateTime(request.balanceRequestedAt) : null} /></div> : null}
              </Panel>
            ))}
          </>
        )}
      />
    </>
  );
}
