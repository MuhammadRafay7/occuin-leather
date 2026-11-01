"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AddressFields, type AddressDefaults } from "@/components/address-fields";
import { FormMessage } from "@/components/form-message";
import { LineImage } from "@/components/line-image";
import { Button, Field, inputClass } from "@/components/ui";
import { submitCheckout } from "@/lib/actions/checkout";
import { money, SHIPPING_METHODS, type ShippingMethod, deliveryEstimate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { CartLine } from "@/lib/server/cart";
import type { ShippingAddress } from "@/lib/server/schema";
import { submitInPlace } from "@/lib/submit-in-place";

type Props = {
  email: string;
  saved: { id: string; address: ShippingAddress }[];
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  promoError: string | null;
  shipping: Record<ShippingMethod, number>;
  testMode: boolean;
};

const METHODS = Object.keys(SHIPPING_METHODS) as ShippingMethod[];
const INITIAL: FormState = {};
const sectionTitle = "font-display text-2xl";

export function CheckoutForm({ email, saved, lines, subtotalCents, discountCents, promoCode, promoError, shipping, testMode }: Props) {
  const [state, action, pending] = useActionState(submitCheckout, INITIAL);
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const [address, setAddress] = useState<AddressDefaults>(saved[0]?.address ?? {});
  const [addressKey, setAddressKey] = useState(0);
  const errors = state.fields ?? {};
  const totalCents = subtotalCents - discountCents + shipping[method];
  const short = lines.filter((line) => line.quantity > line.available);

  const pickAddress = (id: string) => {
    setAddress(saved.find((entry) => entry.id === id)?.address ?? {});
    setAddressKey((key) => key + 1);
  };

  return (
    <form action={action} onSubmit={submitInPlace(action)} noValidate className="grid gap-12 lg:grid-cols-[1fr_420px]">
      <div className="grid content-start gap-10">
        {testMode ? <p role="status" className="border border-line bg-surface p-3 text-sm">Test mode: no card is charged</p> : null}

        <section className="grid gap-5" aria-labelledby="contact-title">
          <h2 id="contact-title" className={sectionTitle}>Contact</h2>
          <Field label="Email" error={errors.email}>
            <input name="email" type="email" defaultValue={email} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} className={inputClass} />
          </Field>
        </section>

        <section className="grid gap-5" aria-labelledby="address-title">
          <h2 id="address-title" className={sectionTitle}>Shipping address</h2>
          {saved.length ? (
            <Field label="Saved addresses">
              <select onChange={(event) => pickAddress(event.target.value)} className={`${inputClass} bg-bg`}>
                {saved.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.address.name}, {entry.address.line1}, {entry.address.city}</option>
                ))}
                <option value="">Enter a new address</option>
              </select>
            </Field>
          ) : null}
          <AddressFields key={addressKey} defaults={address} errors={errors} />
        </section>

        <fieldset className="grid gap-3">
          <legend className={`${sectionTitle} mb-5`}>Shipping method</legend>
          {METHODS.map((value) => (
            <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 border border-line px-3 py-2 text-sm has-[:checked]:border-fg">
              <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="accent-[var(--fg)]" />
              <span className="flex-1">{SHIPPING_METHODS[value].label}<span className="block text-xs text-muted">{deliveryEstimate(value)}</span></span>
              <span>{shipping[value] ? money(shipping[value]) : "Free"}</span>
            </label>
          ))}
          {errors.method ? <p role="alert" className="text-xs text-danger">{errors.method}</p> : null}
        </fieldset>
      </div>

      <aside aria-label="Order summary" className="grid content-start gap-6 self-start lg:sticky lg:top-24">
        <h2 className={sectionTitle}>Order summary</h2>
        <ul className="grid gap-4 border-t border-line pt-6">
          {lines.map((line) => (
            <li key={line.id} className="grid grid-cols-[64px_1fr_auto] gap-3 text-sm">
              <div className="relative aspect-[3/4] overflow-hidden bg-surface">
                <LineImage src={line.image} alt={line.name} sizes="64px" />
              </div>
              <div>
                <p>{line.name}</p>
                <p className="text-muted">{line.detail}</p>
                <p className="text-muted">Quantity {line.quantity}</p>
              </div>
              <p>{money(line.unitCents * line.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="grid gap-3 border-t border-line pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Subtotal</dt>
            <dd>{money(subtotalCents)}</dd>
          </div>
          {discountCents ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Discount{promoCode ? ` (${promoCode})` : ""}</dt>
              <dd>-{money(discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Shipping</dt>
            <dd>{shipping[method] ? money(shipping[method]) : "Free"}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
            <dt>Total</dt>
            <dd>{money(totalCents)}</dd>
          </div>
        </dl>
        {promoError ? (
          <p role="alert" className="text-sm text-danger">{promoError} <Link href="/bag" className="underline underline-offset-4">Update your bag</Link></p>
        ) : null}
        {short.length ? (
          <p role="alert" className="text-sm text-danger">
            {short.map((line) => line.name).join(", ")} {short.length > 1 ? "are" : "is"} short on stock. <Link href="/bag" className="underline underline-offset-4">Update your bag</Link>
          </p>
        ) : null}
        <FormMessage error={state.error} />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Placing your order" : `Pay ${money(totalCents)}`}
        </Button>
      </aside>
    </form>
  );
}
