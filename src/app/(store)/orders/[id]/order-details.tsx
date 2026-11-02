import Link from "next/link";
import { LineImage } from "@/components/line-image";
import { balanceCents, balanceOwedCents, bespokeRef, depositCents } from "@/lib/bespoke/status";
import { longDate, makingTime, money, orderRef, shippingLabel, type Delivery } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/order-status";
import type { getOrder } from "@/lib/server/orders";
import { describeDesign } from "@/lib/studio/pricing";
import { designSpecSchema } from "@/lib/studio/spec";
import { countryName } from "@/lib/validation";

type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
type Item = Order["items"][number];

function designRows(item: Item) {
  const spec = designSpecSchema.safeParse(item.designSpec);
  return spec.success ? describeDesign(spec.data) : [];
}

function OrderItem({ item, delivery }: { item: Item; delivery: Delivery }) {
  const rows = designRows(item);
  return (
    <li className="grid grid-cols-[72px_1fr_auto] gap-4 border-b border-line py-5 text-sm sm:grid-cols-[96px_1fr_auto]">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        <LineImage src={item.image} alt={item.name} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl leading-tight">{item.name}</p>
        {rows.length ? null : <p className="mt-1 text-muted">{item.detail}</p>}
        <p className="mt-1 text-muted">Quantity {item.quantity}</p>
        {item.bespokeRequestId ? <Link href={`/bespoke/mine/${item.bespokeRequestId}`} className="mt-1 inline-block underline underline-offset-4">View your bespoke design</Link> : null}
        {rows.length ? (
          <dl className="mt-3 grid gap-1 text-[13px]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap gap-x-2">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            {item.designPrice ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted">Made in</dt>
                <dd>{makingTime(delivery)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>
      <p>{money(item.unitPriceCents * item.quantity)}</p>
    </li>
  );
}

export function OrderDetails({ order, delivery }: { order: Order; delivery: Delivery }) {
  const address = order.shippingAddress;
  const method = shippingLabel(order.shippingMethod, delivery);

  return (
    <article className="grid gap-12">
      <header>
        <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">Order {orderRef(order.number)}</h1>
        <p className="mt-3 text-muted">Placed {longDate(order.createdAt)}. {STATUS_LABELS[order.status]}.</p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
        <section aria-labelledby="items-title">
          <h2 id="items-title" className="border-b border-line pb-3 font-display text-2xl">Items</h2>
          <ul>
            {order.items.map((item) => (
              <OrderItem key={item.id} item={item} delivery={delivery} />
            ))}
          </ul>
          <dl className="mt-6 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd>{money(order.subtotalCents)}</dd>
            </div>
            {order.discountCents ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Discount{order.promoCode ? ` (${order.promoCode})` : ""}</dt>
                <dd>-{money(order.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Shipping</dt>
              <dd>{order.shippingCents ? money(order.shippingCents) : "Free"}</dd>
            </div>
            {order.taxCents ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Tax</dt>
                <dd>{money(order.taxCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
              <dt>Total</dt>
              <dd>{money(order.totalCents)}</dd>
            </div>
          </dl>
          {order.bespoke.filter((request) => request.quotedPriceCents && balanceCents(request.quotedPriceCents, request.depositPercent)).map((request) => (
            <dl key={request.id} data-testid="order-balance" className="mt-6 grid gap-3 border-t border-line pt-6 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{bespokeRef(request.number)} total</dt>
                <dd>{money(request.quotedPriceCents!)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{request.depositPaidAt ? "Deposit paid" : "Deposit"}</dt>
                <dd>{money(depositCents(request.quotedPriceCents!, request.depositPercent))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{balanceOwedCents(request) ? "Balance due before shipping" : "Balance paid"}</dt>
                <dd>{money(balanceCents(request.quotedPriceCents!, request.depositPercent))}</dd>
              </div>
            </dl>
          ))}
        </section>

        <div className="grid content-start gap-10">
          <section aria-labelledby="status-title">
            <h2 id="status-title" className="border-b border-line pb-3 font-display text-2xl">Status</h2>
            <ol className="mt-4 grid gap-3 text-sm">
              {order.events.map((event) => (
                <li key={event.id} className="flex justify-between gap-4">
                  <span>{STATUS_LABELS[event.status]}</span>
                  <time dateTime={new Date(event.createdAt).toISOString()} className="text-muted">{longDate(event.createdAt)}</time>
                </li>
              ))}
            </ol>
            {order.trackingNumber ? <p className="mt-4 text-sm">Tracking number <span className="break-all">{order.trackingNumber}</span></p> : null}
          </section>

          {address ? (
            <section aria-labelledby="address-title">
              <h2 id="address-title" className="border-b border-line pb-3 font-display text-2xl">Shipping to</h2>
              <address className="mt-4 text-sm not-italic">
                <p>{address.name}</p>
                <p>{address.line1}</p>
                {address.line2 ? <p>{address.line2}</p> : null}
                <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(", ")}</p>
                <p>{countryName(address.country)}</p>
                {address.phone ? <p>{address.phone}</p> : null}
              </address>
              <p className="mt-3 text-sm text-muted">{method}</p>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
