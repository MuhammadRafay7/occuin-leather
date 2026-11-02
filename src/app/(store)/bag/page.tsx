import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { getOwnerKey } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { money, paymentNote, shippingCents } from "@/lib/format";
import { contactDetails, getSettings, pausedMessage, paymentModeOf } from "@/lib/server/settings";
import { BagLine } from "./bag-line";
import { PromoForm } from "./promo-form";

export const metadata: Metadata = { title: "Bag", robots: { index: false } };

export default async function BagPage() {
  const [cart, settings] = await Promise.all([getOwnerKey().then(getCart), getSettings()]);

  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
        <PageTitle>Bag</PageTitle>
        <EmptyState
          title="Your bag is empty"
          body="Add a piece from the collection, or design your own in the studio."
          action={<LinkButton href="/shop/leather">Shop the collection</LinkButton>}
        />
      </div>
    );
  }

  const merchandise = cart.subtotalCents - cart.discountCents;
  const shipping = cart.shippingWaived ? 0 : shippingCents(cart.shippingBasisCents, "standard", settings);
  const toFreeShipping = settings.freeShippingCents - cart.shippingBasisCents;
  const paused = pausedMessage(settings);
  const short = cart.lines.some((line) => line.quantity > line.available);
  const whatsapp = paymentModeOf(settings) === "whatsapp";
  const { whatsapp: number } = await contactDetails();

  return (
    <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <PageTitle>Bag</PageTitle>
      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <ul className="border-t border-line">
          {cart.lines.map((line) => (
            <BagLine key={line.id} line={line} />
          ))}
        </ul>
        <aside aria-label="Bag summary" className="grid gap-6 self-start lg:sticky lg:top-24">
          <PromoForm applied={cart.promoCode} problem={cart.promoError} />
          <dl className="grid gap-3 border-t border-line pt-6 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Subtotal</dt>
              <dd>{money(cart.subtotalCents)}</dd>
            </div>
            {cart.discountCents ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Discount</dt>
                <dd>-{money(cart.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Shipping estimate</dt>
              <dd>{shipping ? money(shipping) : "Free"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
              <dt>Estimated total</dt>
              <dd>{money(merchandise + shipping)}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">
            {cart.shippingWaived
              ? "Shipping is added when you pay the balance."
              : toFreeShipping > 0
              ? `Spend ${money(toFreeShipping)} more for free standard shipping.`
              : "Your order qualifies for free standard shipping."}
          </p>
          {whatsapp ? <p className="text-sm text-muted">{paymentNote(Boolean(number))}</p> : null}
          {paused ? (
            <p role="status" className="border border-line bg-surface px-3 py-2 text-sm">{paused}</p>
          ) : short ? (
            <p role="alert" className="text-sm text-danger">Change the marked items to check out.</p>
          ) : (
            <LinkButton href="/checkout" className="w-full">Check out</LinkButton>
          )}
          <Link href="/shop/leather" className="flex min-h-11 items-center text-sm underline underline-offset-4 hover:opacity-60 lg:block lg:min-h-0">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
