"use client";

import type { Icon } from "@phosphor-icons/react";
import { CaretRight, ChatCircle, Storefront, Truck, Wallet } from "@phosphor-icons/react/dist/ssr";
import { useState, type ReactNode } from "react";
import { saveStoreSettings, type SettingsInput } from "@/lib/actions/admin-people";
import { useAction } from "../_components/controls";
import { controlClass, Field, Notice, primaryButtonClass, StatusDot, textAreaClass } from "../_components/ui";

type TextKey = Exclude<keyof SettingsInput, "ordersPaused">;
type GroupKey = "store" | "payment" | "delivery" | "contact";

const GROUPS: { key: GroupKey; title: string; about: string; icon: Icon; fields: TextKey[] }[] = [
  { key: "store", title: "Your store", about: "What shoppers see, and whether they can order.", icon: Storefront, fields: ["announcement", "ordersPausedMessage"] },
  { key: "payment", title: "Orders and payment", about: "How customers order, and what happens to orders nobody pays for.", icon: Wallet, fields: ["paymentMode", "autoCancelDays"] },
  { key: "delivery", title: "Shipping and stock", about: "What delivery costs, and when to warn you about stock. Prices are in US dollars.", icon: Truck, fields: ["freeShipping", "standardShipping", "expressShipping", "lowStockLimit"] },
  { key: "contact", title: "Contact details", about: "How customers reach you.", icon: ChatCircle, fields: ["supportEmail", "whatsappNumber"] },
];

function Group({ group, shown, children }: { group: (typeof GROUPS)[number]; shown: boolean; children: ReactNode }) {
  const Glyph = group.icon;
  return (
    <section hidden={!shown} aria-labelledby={`settings-${group.key}`} className="adm-card">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <span className="adm-metric-chip" aria-hidden="true"><Glyph size={20} /></span>
        <div className="min-w-0">
          <h2 id={`settings-${group.key}`} className="text-base">{group.title}</h2>
          <p className="text-muted">{group.about}</p>
        </div>
      </div>
      <div className="grid gap-4 p-4">{children}</div>
    </section>
  );
}

export function SettingsForm({ initial, fallbackEmail, stripeReady }: { initial: SettingsInput; fallbackEmail: string; stripeReady: boolean }) {
  const { pending, result, run } = useAction();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [active, setActive] = useState<GroupKey>("store");
  const errors = result?.fieldErrors ?? {};
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const bind = (key: TextKey) => ({
    value: values[key],
    onChange: (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });
  const save = () => run(() => saveStoreSettings(values), (outcome) => {
    if (outcome.ok) {
      setSaved(values);
      return;
    }
    const failed = GROUPS.find((group) => group.fields.some((field) => outcome.fieldErrors?.[field]));
    if (failed) setActive(failed.key);
  });

  return (
    <form noValidate className="grid max-w-5xl gap-4 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-6" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {GROUPS.map((group) => {
          const Glyph = group.icon;
          const current = group.key === active;
          const failing = group.fields.some((field) => errors[field]);
          return (
            <button
              key={group.key}
              type="button"
              aria-current={current ? "true" : undefined}
              onClick={() => setActive(group.key)}
              className={`flex h-9 flex-none cursor-pointer items-center gap-2 rounded-[var(--adm-radius-sm)] px-3 text-left text-[13px] font-medium whitespace-nowrap transition-colors lg:w-full ${current ? "bg-invert-bg text-invert-fg" : "text-muted hover:bg-surface hover:text-fg"}`}
            >
              <Glyph size={16} aria-hidden="true" />
              <span className="flex-1">{group.title}</span>
              {failing ? <span className="size-1.5 rounded-full bg-danger" role="img" aria-label="Has an error" /> : null}
              {current ? <CaretRight size={12} aria-hidden="true" className="hidden opacity-60 lg:block" /> : null}
            </button>
          );
        })}
      </nav>

      <div className="grid min-w-0 content-start gap-4">
        <Group group={GROUPS[0]!} shown={active === "store"}>
          <Field label="Message at the top of the store" hint="A short line shown on every page. Leave empty to hide it." error={errors.announcement}>
            <input maxLength={160} {...bind("announcement")} className={controlClass} />
          </Field>
          <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-line pt-4">
            <span className="grid justify-items-start gap-1">
              <span className="font-medium">Pause new orders</span>
              <span className="text-xs text-muted">Turn on while the workshop is closed. Shoppers cannot check out.</span>
              {values.ordersPaused ? <StatusDot tone="warn">Orders paused</StatusDot> : <StatusDot tone="success">Taking orders</StatusDot>}
            </span>
            <input type="checkbox" role="switch" checked={values.ordersPaused} onChange={(event) => setValues((current) => ({ ...current, ordersPaused: event.target.checked }))} className="peer sr-only" />
            <span aria-hidden="true" className="relative h-6 w-11 flex-none rounded-full bg-line transition-colors peer-checked:bg-[var(--adm-warn-dot)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
          </label>
          <Field label="Message while orders are paused" hint="Shown in the bag and at checkout. Leave empty for a standard message." error={errors.ordersPausedMessage}>
            <textarea rows={2} maxLength={200} {...bind("ordersPausedMessage")} className={textAreaClass} />
          </Field>
        </Group>

        <Group group={GROUPS[1]!} shown={active === "payment"}>
          <Field label="How customers order" hint={stripeReady ? "On WhatsApp, the customer orders here and you arrange payment in a chat. With card payment, they pay at checkout." : "Card payment is off until your developer connects Stripe, so orders go to WhatsApp."} error={errors.paymentMode}>
            <select {...bind("paymentMode")} className={controlClass}>
              <option value="whatsapp">Orders on WhatsApp, payment arranged by chat</option>
              <option value="stripe" disabled={!stripeReady}>Card payment at checkout, with Stripe</option>
            </select>
          </Field>
          {values.paymentMode === "whatsapp" && !values.whatsappNumber ? <p role="alert" className="text-danger">Add your WhatsApp number under Contact details. Until then customers are asked to email you.</p> : null}
          <div className="max-w-56 border-t border-line pt-4 md:max-w-none">
            <div className="max-w-72">
              <Field label="Cancel unpaid orders after" hint="Days. Unpaid WhatsApp orders are then cancelled, and their items and discount code are released. Use 0 to never cancel them." error={errors.autoCancelDays}>
                <input inputMode="numeric" {...bind("autoCancelDays")} className={controlClass} />
              </Field>
            </div>
          </div>
        </Group>

        <Group group={GROUPS[2]!} shown={active === "delivery"}>
          <div className="grid items-start gap-3 md:grid-cols-3">
            <Field label="Free shipping from" hint="Orders at this amount or more ship free. Use 0 to make it always free." error={errors.freeShipping}>
              <input inputMode="decimal" {...bind("freeShipping")} className={controlClass} />
            </Field>
            <Field label="Standard shipping price" hint="What normal delivery costs." error={errors.standardShipping}>
              <input inputMode="decimal" {...bind("standardShipping")} className={controlClass} />
            </Field>
            <Field label="Express shipping price" hint="Faster delivery. It is never free." error={errors.expressShipping}>
              <input inputMode="decimal" {...bind("expressShipping")} className={controlClass} />
            </Field>
          </div>
          <div className="max-w-56 border-t border-line pt-4 md:max-w-none">
            <div className="max-w-56">
              <Field label="Low stock warning" hint="Warn me when an item has this many left, or fewer." error={errors.lowStockLimit}>
                <input inputMode="numeric" {...bind("lowStockLimit")} className={controlClass} />
              </Field>
            </div>
          </div>
        </Group>

        <Group group={GROUPS[3]!} shown={active === "contact"}>
          <div className="grid items-start gap-3 md:grid-cols-2">
            <Field label="Support email" hint={`Shown on your site. Customer replies go here. Leave empty to use ${fallbackEmail}.`} error={errors.supportEmail}>
              <input type="email" {...bind("supportEmail")} className={controlClass} />
            </Field>
            <Field label="WhatsApp number" hint="Include the country code. Leave empty to use your default number. With no number, WhatsApp buttons are hidden." error={errors.whatsappNumber}>
              <input inputMode="tel" {...bind("whatsappNumber")} className={controlClass} />
            </Field>
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}>{pending ? "Saving" : "Save settings"}</button>
          {dirty ? <p className="text-xs text-muted">You have unsaved changes.</p> : null}
          <Notice result={result} compact />
        </div>
      </div>
    </form>
  );
}
