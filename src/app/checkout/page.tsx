import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getOwnerKey, getUser } from "@/lib/server/auth";
import { getCart } from "@/lib/server/cart";
import { db, schema } from "@/lib/server/db";
import { demoPaymentsAllowed, stripe } from "@/lib/server/orders";
import { shippingCents } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [ownerKey, user] = await Promise.all([getOwnerKey(), getUser()]);
  const cart = await getCart(ownerKey);
  if (!cart.lines.length) redirect("/bag");

  const saved = user
    ? await db
        .select({ id: schema.addresses.id, address: schema.addresses.address })
        .from(schema.addresses)
        .where(eq(schema.addresses.userId, user.id))
        .orderBy(desc(schema.addresses.isDefault), asc(schema.addresses.createdAt))
    : [];

  return (
    <div className="mx-auto max-w-[1280px] px-page pb-24 pt-header">
      <PageTitle
        sub={user ? undefined : <>Checking out as a guest. <Link href="/login?next=/checkout" className="underline underline-offset-4">Sign in</Link> to use saved addresses.</>}
      >
        Checkout
      </PageTitle>
      <CheckoutForm
        email={user?.email ?? ""}
        saved={saved}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        discountCents={cart.discountCents}
        promoCode={cart.promoError ? null : cart.promoCode}
        promoError={cart.promoError}
        shipping={cart.shippingWaived ? { standard: 0, express: 0 } : { standard: shippingCents(cart.shippingBasisCents, "standard"), express: shippingCents(cart.shippingBasisCents, "express") }}
        testMode={!stripe && demoPaymentsAllowed()}
      />
    </div>
  );
}
