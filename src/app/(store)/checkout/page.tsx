import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BagCountSync } from "@/components/bag/bag-page-extras";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { arrivalWindow } from "@/lib/delivery-dates";
import { makingTime, shippingCents, SHIPPING_METHODS, type ShippingMethod } from "@/lib/format";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { getDelivery } from "@/lib/server/content";
import { db, schema } from "@/lib/server/db";
import { stripe } from "@/lib/server/orders";
import { contactDetails, demoPaymentsAllowed, getSettings, pausedMessage, paymentModeOf } from "@/lib/server/settings";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

const METHODS = Object.keys(SHIPPING_METHODS) as ShippingMethod[];

export default async function CheckoutPage() {
  const [ownerKey, user, settings] = await Promise.all([getOwnerKey(), getUser(), getSettings()]);
  const cart = await getCart(ownerKey);
  if (!cart.lines.length) redirect("/bag");

  const paused = pausedMessage(settings);
  if (paused) {
    return (
      <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
        <PageTitle>Checkout</PageTitle>
        <EmptyState title="Orders are paused" body={paused} action={<LinkButton href="/bag">Back to your bag</LinkButton>} />
      </div>
    );
  }

  const whatsapp = paymentModeOf(settings) === "whatsapp";
  const [saved, delivery, contact] = await Promise.all([
    user
      ? db
          .select({ id: schema.addresses.id, address: schema.addresses.address })
          .from(schema.addresses)
          .where(eq(schema.addresses.userId, user.id))
          .orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.createdAt))
      : [],
    getDelivery(),
    contactDetails(),
  ]);
  const productsOnly = cart.lines.every((line) => line.kind === "product");
  const arrivals = productsOnly ? Object.fromEntries(METHODS.map((method) => [method, arrivalWindow(method, delivery)])) as Record<ShippingMethod, string> : null;

  return (
    <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <BagCountSync count={cart.count} />
      <PageTitle
        sub={user ? undefined : <>Checking out as a guest. <Link href="/login?next=/checkout" className="underline underline-offset-4">Sign in</Link> to use saved addresses.</>}
      >
        Checkout
      </PageTitle>
      <CheckoutForm
        email={user?.email ?? ""}
        saved={saved}
        lines={cart.lines}
        delivery={delivery}
        arrivals={arrivals}
        making={productsOnly ? makingTime(delivery) : null}
        autoCancelDays={settings.autoCancelDays}
        storeEmail={contact.email}
        subtotalCents={cart.subtotalCents}
        discountCents={cart.discountCents}
        promoCode={cart.promoError ? null : cart.promoCode}
        promoError={cart.promoError}
        shipping={cart.shippingWaived ? { standard: 0, express: 0 } : { standard: shippingCents(cart.shippingBasisCents, "standard", settings), express: shippingCents(cart.shippingBasisCents, "express", settings) }}
        testMode={!whatsapp && !stripe && demoPaymentsAllowed()}
        whatsapp={whatsapp ? { hasNumber: Boolean(contact.whatsapp) } : null}
      />
    </div>
  );
}
