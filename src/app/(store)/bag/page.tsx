import type { Metadata } from "next";
import Link from "next/link";
import { BagAssurance } from "@/components/bag/bag-assurance";
import { BagCountSync, BagPagePairs } from "@/components/bag/bag-page-extras";
import { ShippingProgress } from "@/components/bag/shipping-progress";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { bagDeliveryDates } from "@/lib/delivery-dates";
import { money, shippingCents } from "@/lib/format";
import { getOwnerKey } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { getDelivery } from "@/lib/server/content";
import { contactDetails, getSettings, pausedMessage, paymentModeOf } from "@/lib/server/settings";
import { suggestFor } from "@/lib/server/suggestions";
import { BagLine } from "./bag-line";
import { PromoForm } from "./promo-form";

export const metadata: Metadata = { title: "Bag", robots: { index: false } };

export default async function BagPage() {
  const [cart, settings, delivery, contact] = await Promise.all([getOwnerKey().then(getCart), getSettings(), getDelivery(), contactDetails()]);

  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
        <BagCountSync count={0} />
        <PageTitle>Bag</PageTitle>
        <EmptyState
          title="Your bag is empty"
          body="Add a piece from the collection, or design your own in the studio."
          action={<LinkButton href="/shop/leather">Shop the collection</LinkButton>}
        />
      </div>
    );
  }

  const suggestions = await suggestFor(cart.lines);
  const merchandise = cart.subtotalCents - cart.discountCents;
  const shipping = cart.shippingWaived ? 0 : shippingCents(cart.shippingBasisCents, "standard", settings);
  const paused = pausedMessage(settings);
  const short = cart.lines.some((line) => line.quantity > line.available);
  const payment = { whatsapp: paymentModeOf(settings) === "whatsapp", hasNumber: Boolean(contact.whatsapp) };

  return (
    <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <BagCountSync count={cart.count} />
      <PageTitle>Bag</PageTitle>
      <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-14">
        <ul className="border-t border-line lg:col-start-1 lg:row-start-1">
          {cart.lines.map((line) => (
            <BagLine key={line.id} line={line} />
          ))}
        </ul>
        <aside aria-label="Bag summary" className="grid gap-6 self-start lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <ShippingProgress merchandiseCents={cart.shippingBasisCents} thresholdCents={settings.freeShippingCents} waived={cart.shippingWaived} />
          <PromoForm applied={cart.promoCode} problem={cart.promoError} />
          <dl className="grid gap-3 border-t border-line pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{money(cart.subtotalCents)}</dd>
            </div>
            {cart.discountCents ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Discount</dt>
                <dd className="tabular-nums">-{money(cart.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Standard shipping</dt>
              <dd className="tabular-nums">{shipping ? money(shipping) : "Free"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
              <dt>Estimated total</dt>
              <dd className="tabular-nums">{money(merchandise + shipping)}</dd>
            </div>
          </dl>
          {paused ? (
            <p role="status" className="border border-line bg-surface px-3 py-2 text-sm">{paused}</p>
          ) : short ? (
            <p role="alert" className="text-sm text-danger">Change the marked items to check out.</p>
          ) : (
            <LinkButton href="/checkout" className="w-full">Check out</LinkButton>
          )}
          <div className="border-t border-line pt-6">
            <BagAssurance dates={bagDeliveryDates(cart.lines, delivery)} payment={payment} />
          </div>
          <Link href="/shop/leather" className="flex min-h-11 items-center text-sm underline underline-offset-4 hover:opacity-60 lg:block lg:min-h-0">Continue shopping</Link>
        </aside>
        <div className="lg:col-start-1 lg:row-start-2">
          <BagPagePairs suggestions={suggestions} />
        </div>
      </div>
    </div>
  );
}
