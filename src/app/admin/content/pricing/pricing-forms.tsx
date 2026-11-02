"use client";

import type { ReactNode } from "react";
import type { DEFAULT_BESPOKE } from "@/lib/content/defaults";
import type { Delivery } from "@/lib/format";
import type { StudioPricing } from "@/lib/studio/pricing";
import { Advanced, ContentEditor, Numeric, Text, type Form } from "../_components/editor";

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

function DayRange({ form, title, from, to }: { form: Form; title: string; from: string; to: string }) {
  return (
    <div role="group" aria-label={title} className="grid gap-1">
      <p className="text-xs font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <Numeric form={form} path={from} label="Shortest (days)" step="1" />
        <Numeric form={form} path={to} label="Longest (days)" step="1" />
      </div>
    </div>
  );
}

export function DeliveryEditor({ initial, fallback }: { initial: Delivery; fallback: Delivery }) {
  return (
    <ContentEditor contentKey="delivery" initial={initial} fallback={fallback} previewHref="/shipping-returns" saveLabel="Save delivery times">
      {(form) => (
        <div className="adm-stack max-w-3xl">
          <div className="grid gap-4 md:grid-cols-3">
            <DayRange form={form} title="Making a piece" from="makingMinDays" to="makingMaxDays" />
            <DayRange form={form} title="Standard delivery" from="standardMinDays" to="standardMaxDays" />
            <DayRange form={form} title="Express delivery" from="expressMinDays" to="expressMaxDays" />
          </div>
          <p className="adm-field-hint">Delivery times count from the day of the order, so they include making the piece.</p>
          <Advanced form={form} under={["standardLabel", "expressLabel"]} label="Shipping names">
            <div className="grid gap-3 md:grid-cols-2">
              <Text form={form} path="standardLabel" label="Name of standard shipping" />
              <Text form={form} path="expressLabel" label="Name of express shipping" />
            </div>
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}

export function BespokeEditor({ initial, fallback }: { initial: typeof DEFAULT_BESPOKE; fallback: typeof DEFAULT_BESPOKE }) {
  return (
    <ContentEditor contentKey="bespoke" initial={initial} fallback={fallback} previewHref="/studio/create" saveLabel="Save custom orders">
      {(form) => (
        <div className="grid max-w-xl gap-3 sm:grid-cols-2">
          <Numeric form={form} path="depositPercent" label="Deposit customers pay first (%)" hint="For new requests. You can change it on each quote." step="1" />
          <Numeric form={form} path="quoteDays" label="Days a price offer stays open" hint="For offers you send from now on." step="1" />
        </div>
      )}
    </ContentEditor>
  );
}

type Named = { key: string; name: string };

function Money({ form, path, label, hint }: { form: Form; path: string; label: string; hint?: string }) {
  return <Numeric form={form} path={path} label={`${label} ($)`} hint={hint} scale={100} />;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-xs font-medium">{title}</h3>
        {hint ? <p className="adm-field-hint">{hint}</p> : null}
      </div>
      <div className={GRID}>{children}</div>
    </div>
  );
}

export function PricingEditor({ initial, fallback, finishes, metals, patterns, hardware }: { initial: StudioPricing; fallback: StudioPricing; finishes: Named[]; metals: Named[]; patterns: Named[]; hardware: Named[] }) {
  return (
    <ContentEditor contentKey="pricing" initial={initial} fallback={fallback} previewHref="/studio" saveLabel="Save studio prices">
      {(form) => (
        <div className="adm-stack">
          <p className="adm-field-hint max-w-3xl">These set the price of bags customers design in the studio. Products in the shop keep the price on each product.</p>
          <Group title="Every piece">
            <Money form={form} path="baseCents" label="Pattern cutting and setup" />
            <Money form={form} path="labourCentsPerHour" label="One hour of hand work" />
          </Group>
          <Group title="Leather" hint="Price for a 10 cm by 10 cm square of each leather.">
            {finishes.map((item) => <Money key={item.key} form={form} path={`finishCentsPerDm2.${item.key}`} label={item.name} />)}
          </Group>
          <Group title="Metal colour" hint="Extra charged for this colour.">
            {metals.map((item) => <Money key={item.key} form={form} path={`metalCents.${item.key}`} label={item.name} />)}
          </Group>
          <Group title="Surface finish" hint="Extra charged on a medium bag. Larger bags pay more.">
            {patterns.map((item) => <Money key={item.key} form={form} path={`patternCents.${item.key}`} label={item.name} />)}
          </Group>
          <Group title="Things customers add">
            <Money form={form} path="zipCents" label="Zip across the top" />
            <Money form={form} path="zipPocketCents" label="Zip pocket" />
            <Money form={form} path="flapClaspCents" label="Clasp on a flap" />
            <Money form={form} path="handleCents" label="Each handle" />
            <Money form={form} path="strapCents" label="Shoulder strap" />
            <Money form={form} path="feetCents" label="Metal feet" />
            <Money form={form} path="blindMonogramCents" label="Pressed initials" />
            <Money form={form} path="foilMonogramCents" label="Coloured initials" />
          </Group>
          <Advanced form={form} under={["wastage", "margin", "roundToCents"]} label="How the total is worked out">
            <div className={GRID}>
              <Numeric form={form} path="wastage" label="Extra leather for offcuts" hint="1.35 means 35% extra." step="0.01" />
              <Numeric form={form} path="margin" label="Markup" hint="1.6 means cost plus 60%." step="0.01" />
              <Money form={form} path="roundToCents" label="Round prices up to the next" />
            </div>
          </Advanced>
          <Advanced form={form} under={["bespokeLogoCents", "bespokeLowSpread", "bespokeHighSpread", "hardwareCents"]} label="Rough price guide in Create your own">
            <p className="adm-field-hint">Only the rough guide shown while people draw. You always set the final price yourself.</p>
            <div className={GRID}>
              <Money form={form} path="bespokeLogoCents" label="Adding a logo" />
              <Numeric form={form} path="bespokeLowSpread" label="Low end of the guide" hint="0.9 means 10% under." step="0.01" />
              <Numeric form={form} path="bespokeHighSpread" label="High end of the guide" hint="1.25 means 25% over." step="0.01" />
              {hardware.map((item) => <Money key={item.key} form={form} path={`hardwareCents.${item.key}`} label={item.name} />)}
            </div>
          </Advanced>
        </div>
      )}
    </ContentEditor>
  );
}
