import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { CONTENT, getBespokeRules, getDelivery, getPricing } from "@/lib/server/content";
import { HARDWARE } from "@/lib/bespoke/design";
import { FINISHES, METALS, PATTERNS } from "@/lib/studio/spec";
import { AdminTitle, Section } from "../../_components/ui";
import { BespokeEditor, DeliveryEditor, PricingEditor } from "./pricing-forms";

export const metadata: Metadata = { title: "Prices" };

const names = (record: Record<string, { name: string }>) => Object.entries(record).map(([key, value]) => ({ key, name: value.name }));

export default async function ContentPricing() {
  await requireAdmin();
  const [pricing, delivery, bespoke] = await Promise.all([getPricing(), getDelivery(), getBespokeRules()]);
  return (
    <>
      <AdminTitle sub="What customers pay and how long they wait. Saving updates the whole site.">Prices</AdminTitle>
      <Section title="How long things take" description="Shown on product pages, at checkout and in order emails.">
        <DeliveryEditor initial={delivery} fallback={CONTENT.delivery.fallback} />
      </Section>
      <Section title="Custom orders" description="For pieces people draw themselves and send to you.">
        <BespokeEditor initial={bespoke} fallback={CONTENT.bespoke.fallback} />
      </Section>
      <Section title="Studio prices" description="What customers pay for each part of a bag they design.">
        <PricingEditor initial={pricing} fallback={CONTENT.pricing.fallback} finishes={names(FINISHES)} metals={names(METALS)} patterns={names(PATTERNS)} hardware={names(HARDWARE)} />
      </Section>
    </>
  );
}
