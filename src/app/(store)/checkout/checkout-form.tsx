"use client";

import { CaretDown, Check, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type FormEvent, type ReactNode } from "react";
import type { AddressDefaults } from "@/components/address-fields";
import { FormMessage } from "@/components/form-message";
import { LineImage } from "@/components/line-image";
import { Button, inputClass } from "@/components/ui";
import { submitCheckout } from "@/lib/actions/checkout";
import { needsPostalCode, STATE_REQUIRED } from "@/lib/address-rules";
import { checkField, isCheckoutField } from "@/lib/checkout-checks";
import { money, SHIPPING_METHODS, shippingLabel, type Delivery, type ShippingMethod, deliveryEstimate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { CartLine } from "@/lib/server/cart";
import type { ShippingAddress } from "@/lib/server/schema";
import { submitInPlace } from "@/lib/submit-in-place";
import { COUNTRIES } from "@/lib/validation";

type Props = {
  email: string;
  saved: { id: string; address: ShippingAddress }[];
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  promoError: string | null;
  shipping: Record<ShippingMethod, number>;
  delivery: Delivery;
  arrivals: Record<ShippingMethod, string> | null;
  making: string | null;
  autoCancelDays: number;
  storeEmail: string;
  testMode: boolean;
  whatsapp: { hasNumber: boolean } | null;
};

const METHODS = Object.keys(SHIPPING_METHODS) as ShippingMethod[];
const INITIAL: FormState = {};
const sectionTitle = "font-display text-2xl";
const DIAL: Record<string, string> = {
  US: "1", CA: "1", GB: "44", IE: "353", FR: "33", DE: "49", IT: "39", ES: "34", NL: "31", CH: "41", AE: "971", SA: "966", QA: "974", KW: "965", BE: "32",
  SE: "46", NO: "47", DK: "45", AT: "43", PT: "351", NZ: "64", MY: "60", HK: "852", KR: "82", ZA: "27", PK: "92", AU: "61", JP: "81", SG: "65",
};

const countryLabel = (code: string) => COUNTRIES.find((country) => country.code === code)?.name ?? code;

const subscribeNever = () => () => {};

function guessCountry() {
  const region = navigator.languages?.map((tag) => tag.split("-")[1]?.toUpperCase()).find((code) => code && COUNTRIES.some((country) => country.code === code));
  return region ?? null;
}

function Input({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 text-sm">
      <label htmlFor={`checkout-${name}`}>{label}</label>
      {children}
      {error ? (
        <p id={`checkout-${name}-error`} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={`checkout-${name}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldProps = (name: string, error: string | undefined, hint = false) => ({
  id: `checkout-${name}`,
  name,
  "aria-invalid": Boolean(error),
  "aria-describedby": error ? `checkout-${name}-error` : hint ? `checkout-${name}-hint` : undefined,
  className: inputClass,
});

function OrderLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="grid gap-4">
      {lines.map((line) => (
        <li key={line.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-4 text-sm">
          <div className="relative">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface">
              <LineImage src={line.image} alt={line.name} sizes="64px" />
            </div>
            <span aria-hidden className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-invert-bg text-[11px] font-medium tabular-nums text-invert-fg">{line.quantity}</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-base leading-tight">{line.name}</p>
            <p className="text-[13px] text-muted">{line.detail}</p>
            <p className="sr-only">Quantity {line.quantity}</p>
          </div>
          <p className="tabular-nums">{money(line.unitCents * line.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

function Totals({ subtotalCents, discountCents, promoCode, shippingCents, totalCents }: { subtotalCents: number; discountCents: number; promoCode: string | null; shippingCents: number; totalCents: number }) {
  return (
    <dl className="grid gap-3 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Subtotal</dt>
        <dd className="tabular-nums">{money(subtotalCents)}</dd>
      </div>
      {discountCents ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Discount{promoCode ? ` (${promoCode})` : ""}</dt>
          <dd className="tabular-nums">-{money(discountCents)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4">
        <dt className="text-muted">Shipping</dt>
        <dd className="tabular-nums">{shippingCents ? money(shippingCents) : "Free"}</dd>
      </div>
      <div className="flex justify-between gap-4 border-t border-line pt-3 text-base">
        <dt>Total</dt>
        <dd className="tabular-nums">{money(totalCents)}</dd>
      </div>
    </dl>
  );
}

function NextSteps({ whatsapp, making, autoCancelDays, storeEmail }: { whatsapp: Props["whatsapp"]; making: string | null; autoCancelDays: number; storeEmail: string }) {
  const hold = autoCancelDays ? ` We hold your pieces for ${autoCancelDays} ${autoCancelDays === 1 ? "day" : "days"} while we arrange payment.` : "";
  const steps = whatsapp
    ? [
        { title: "Place your order", body: `Nothing is charged on this site. We save your order and email you a link to it.${hold}` },
        whatsapp.hasNumber
          ? { title: "Send it to us on WhatsApp", body: "We write the message for you. We reply with how to pay." }
          : { title: "Arrange payment by email", body: `Write to ${storeEmail} with your order reference and we reply with how to pay.` },
        { title: "We make it by hand", body: making ? `Making starts once your order is paid and takes ${making}. Then it ships to you from Pakistan.` : "Making starts once your order is paid. We confirm the timing for custom pieces with you, then ship from Pakistan." },
      ]
    : [
        { title: "Pay securely", body: "You pay by card on a secure payment page from Stripe." },
        { title: "We confirm by email", body: "You get an email with your order and a link to follow it." },
        { title: "We make it by hand", body: making ? `Making takes ${making}. Then it ships to you from Pakistan.` : "We confirm the timing for custom pieces with you, then ship from Pakistan." },
      ];
  return (
    <section aria-labelledby="next-title" className="grid gap-5">
      <h2 id="next-title" className={sectionTitle}>What happens next</h2>
      <ol className="grid gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="grid grid-cols-[32px_1fr] gap-3">
            <span aria-hidden className="grid size-8 place-items-center rounded-full border border-invert-bg/30 font-display text-base text-invert-bg">{index + 1}</span>
            <div className="grid gap-0.5 pt-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-[13px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function CheckoutForm({ email, saved, lines, subtotalCents, discountCents, promoCode, promoError, shipping, delivery, arrivals, making, autoCancelDays, storeEmail, testMode, whatsapp }: Props) {
  const [state, action, pending] = useActionState(submitCheckout, INITIAL);
  const [method, setMethod] = useState<ShippingMethod>("standard");
  const [address, setAddress] = useState<AddressDefaults>(saved[0]?.address ?? {});
  const [addressKey, setAddressKey] = useState(0);
  const guessed = useSyncExternalStore(subscribeNever, guessCountry, () => null);
  const [chosenCountry, setCountry] = useState<string | null>(saved[0]?.address.country ?? null);
  const country = chosenCountry ?? guessed ?? "US";
  const [moreLines, setMoreLines] = useState(Boolean(saved[0]?.address.line2));
  const [checked, setChecked] = useState<Record<string, string>>({});
  const [serverErrors, setServerErrors] = useState<FormState | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const totalCents = subtotalCents - discountCents + shipping[method];
  const short = lines.filter((line) => line.quantity > line.available);
  const submitLabel = whatsapp ? "Place order" : `Pay ${money(totalCents)}`;
  const showState = STATE_REQUIRED.has(country) || Boolean(address.state);
  const showPostal = needsPostalCode(country);
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);

  if (serverErrors !== state) {
    setServerErrors(state);
    setChecked({});
  }

  const errorFor = (name: string) => {
    if (name in checked) return checked[name] || undefined;
    return state.fields?.[name];
  };

  useEffect(() => {
    if (state.fields) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  function validate(name: string, value: string) {
    if (!isCheckoutField(name)) return;
    setChecked((current) => ({ ...current, [name]: checkField(name, value, country) ?? "" }));
  }

  function onBlur(event: FocusEvent<HTMLFormElement>) {
    const target: EventTarget = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.value || target.name in checked || state.fields?.[target.name]) validate(target.name, target.value);
  }

  function onInput(event: FormEvent<HTMLFormElement>) {
    const target: EventTarget = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (errorFor(target.name)) validate(target.name, target.value);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const next: Record<string, string> = {};
    for (const [name, value] of data.entries()) {
      if (typeof value === "string" && isCheckoutField(name)) next[name] = checkField(name, value, country) ?? "";
    }
    if (Object.values(next).some(Boolean)) {
      event.preventDefault();
      setChecked(next);
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    submitInPlace(action)(event);
  }

  const pickAddress = (id: string) => {
    const chosen: AddressDefaults = saved.find((entry) => entry.id === id)?.address ?? {};
    setAddress(chosen);
    setCountry(chosen.country ?? country);
    setMoreLines(Boolean(chosen.line2));
    setChecked({});
    setAddressKey((key) => key + 1);
  };

  const summary = (
    <>
      <OrderLines lines={lines} />
      <div className="border-t border-line pt-5">
        <Totals subtotalCents={subtotalCents} discountCents={discountCents} promoCode={promoCode} shippingCents={shipping[method]} totalCents={totalCents} />
      </div>
    </>
  );

  return (
    <form ref={form} action={action} onSubmit={onSubmit} onBlur={onBlur} onInput={onInput} noValidate className="grid gap-10 lg:grid-cols-[1fr_420px] lg:gap-12">
      <details className="group -mt-4 rounded-[20px] border border-line lg:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            Order summary, {pieces} {pieces === 1 ? "piece" : "pieces"}
            <CaretDown size={14} aria-hidden className="transition-transform group-open:rotate-180" />
          </span>
          <span className="text-base tabular-nums">{money(totalCents)}</span>
        </summary>
        <div className="grid gap-5 border-t border-line p-4">{summary}</div>
      </details>

      <div className="grid min-w-0 content-start gap-10">
        {testMode ? <p role="status" className="border border-line bg-surface p-3 text-sm">Test mode: no card is charged</p> : null}

        <section className="grid gap-5" aria-labelledby="contact-title">
          <h2 id="contact-title" className={sectionTitle}>Contact</h2>
          <Input label="Email" name="email" error={errorFor("email")} hint="For your order link and updates.">
            <input {...fieldProps("email", errorFor("email"), true)} type="email" inputMode="email" defaultValue={email} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} enterKeyHint="next" />
          </Input>
          {whatsapp ? (
            <Input
              label="Phone number"
              name="phone"
              error={errorFor("phone")}
              hint={`The number you use on WhatsApp, with your country code${DIAL[country] ? ` (+${DIAL[country]} for ${countryLabel(country)})` : ""}.`}
            >
              <input {...fieldProps("phone", errorFor("phone"), true)} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} enterKeyHint="next" />
            </Input>
          ) : null}
        </section>

        <section className="grid gap-5" aria-labelledby="address-title">
          <h2 id="address-title" className={sectionTitle}>Shipping address</h2>
          {saved.length ? (
            <div className="grid gap-2 text-sm">
              <label htmlFor="checkout-saved">Saved addresses</label>
              <select id="checkout-saved" onChange={(event) => pickAddress(event.target.value)} className={`${inputClass} bg-bg`}>
                {saved.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.address.name}, {entry.address.line1}, {entry.address.city}</option>
                ))}
                <option value="">Enter a new address</option>
              </select>
            </div>
          ) : null}
          <div key={addressKey} className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Country" name="country" error={errorFor("country")}>
                <select {...fieldProps("country", errorFor("country"))} value={country} onChange={(event) => setCountry(event.target.value)} autoComplete="shipping country" className={`${inputClass} bg-bg`}>
                  {COUNTRIES.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </Input>
            </div>
            <div className="sm:col-span-2">
              <Input label="Full name" name="name" error={errorFor("name")}>
                <input {...fieldProps("name", errorFor("name"))} defaultValue={address.name} autoComplete="shipping name" autoCapitalize="words" maxLength={120} enterKeyHint="next" />
              </Input>
            </div>
            <div className="grid gap-3 sm:col-span-2">
              <Input label="Address" name="line1" error={errorFor("line1")}>
                <input {...fieldProps("line1", errorFor("line1"))} defaultValue={address.line1} autoComplete="shipping address-line1" maxLength={160} enterKeyHint="next" />
              </Input>
              {moreLines ? (
                <Input label="Apartment, suite or building (optional)" name="line2" error={errorFor("line2")}>
                  <input {...fieldProps("line2", errorFor("line2"))} defaultValue={address.line2} autoComplete="shipping address-line2" maxLength={160} enterKeyHint="next" />
                </Input>
              ) : (
                <button type="button" onClick={() => setMoreLines(true)} className="flex min-h-11 items-center gap-1.5 justify-self-start text-[13px] underline underline-offset-4 hover:opacity-60">
                  <Plus size={12} aria-hidden />
                  Add apartment, suite or building
                </button>
              )}
            </div>
            <div className={showState || showPostal ? "" : "sm:col-span-2"}>
              <Input label="City" name="city" error={errorFor("city")}>
                <input {...fieldProps("city", errorFor("city"))} defaultValue={address.city} autoComplete="shipping address-level2" maxLength={100} enterKeyHint="next" />
              </Input>
            </div>
            {showState ? (
              <Input label={STATE_REQUIRED.has(country) ? "State or province" : "State or province (optional)"} name="state" error={errorFor("state")}>
                <input {...fieldProps("state", errorFor("state"))} defaultValue={address.state} autoComplete="shipping address-level1" maxLength={80} enterKeyHint="next" />
              </Input>
            ) : null}
            {showPostal ? (
              <div className={showState ? "sm:col-span-2" : ""}>
                <Input label="Postal code" name="postalCode" error={errorFor("postalCode")}>
                  <input {...fieldProps("postalCode", errorFor("postalCode"))} defaultValue={address.postalCode} autoComplete="shipping postal-code" autoCapitalize="characters" spellCheck={false} maxLength={12} enterKeyHint="done" />
                </Input>
              </div>
            ) : null}
          </div>
        </section>

        <fieldset className="grid gap-3">
          <legend className={`${sectionTitle} mb-5`}>Shipping</legend>
          {METHODS.map((value) => (
            <label key={value} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border border-line px-4 py-3 text-sm transition-colors has-[:checked]:border-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2">
              <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} className="size-5 accent-[var(--invert-bg)]" />
              <span className="flex-1">
                {shippingLabel(value, delivery)}
                <span className="block text-xs text-muted">{arrivals ? `Paid today, arrives around ${arrivals[value]}` : deliveryEstimate(value, delivery)}</span>
              </span>
              <span className="tabular-nums">{shipping[value] ? money(shipping[value]) : "Free"}</span>
            </label>
          ))}
          {errorFor("method") ? <p role="alert" className="text-xs text-danger">{errorFor("method")}</p> : null}
        </fieldset>

        <NextSteps whatsapp={whatsapp} making={making} autoCancelDays={autoCancelDays} storeEmail={storeEmail} />
      </div>

      <aside aria-label="Order summary" className="grid min-w-0 content-start gap-6 self-start lg:sticky lg:top-24">
        <h2 className={`${sectionTitle} hidden lg:block`}>Order summary</h2>
        <div className="hidden gap-5 border-t border-line pt-6 lg:grid">{summary}</div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-5 text-base lg:hidden">
          <span>Total</span>
          <span className="tabular-nums">{money(totalCents)}</span>
        </div>
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
          {pending ? "Placing your order" : submitLabel}
        </Button>
        <ul className="grid gap-2 text-[13px] text-muted">
          {whatsapp ? (
            <li className="flex gap-2"><Check size={14} aria-hidden className="mt-0.5 shrink-0 text-invert-bg" />Nothing is charged on this site.</li>
          ) : null}
          <li className="flex gap-2"><Check size={14} aria-hidden className="mt-0.5 shrink-0 text-invert-bg" />Made by hand to order in Pakistan.</li>
          <li className="flex gap-2 pl-[22px]"><Link href="/shipping-returns" className="underline underline-offset-4 hover:text-fg">Shipping and returns</Link></li>
        </ul>
      </aside>
    </form>
  );
}
