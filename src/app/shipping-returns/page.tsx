import type { Metadata } from "next";
import Link from "next/link";
import { Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";
import { FREE_SHIPPING_CENTS, MAKING_NOTE, MAKING_TIME, SHIPPING_METHODS, deliveryEstimate, money } from "@/lib/format";
import { pageMeta } from "@/lib/seo";
import { COUNTRIES } from "@/lib/validation";

export const metadata: Metadata = pageMeta("/shipping-returns");

const countryList = COUNTRIES.map((country) => country.name).sort().join(", ");

export default function ShippingReturnsPage() {
  return (
    <div className="px-page pt-header">
      <PageTitle>Shipping and returns</PageTitle>
      <Sections>
        <Section title="How long does delivery take?">
          <p>Tracked international shipping: {deliveryEstimate("standard").toLowerCase()}. Express courier: {deliveryEstimate("express").toLowerCase()}. Both times include the {MAKING_TIME} we take to make and pack your piece.</p>
        </Section>
        <Section title="Which countries do you ship to?">
          <p>We ship from Pakistan to these countries at checkout: {countryList}.</p>
        </Section>
        <Section title="Can I return an item?">
          <p>Only if it arrives faulty or differs from your order. Every piece is made to order, so we do not accept returns for a change of mind.</p>
        </Section>
        <Section title="Shipping">
          <ul>
            <li>{SHIPPING_METHODS.standard.label}: {money(SHIPPING_METHODS.standard.cents)}.</li>
            <li>{SHIPPING_METHODS.express.label}: {money(SHIPPING_METHODS.express.cents)}.</li>
          </ul>
          <p>{MAKING_NOTE} Orders arrive in 35 to 45 days with tracked shipping, or 30 to 40 days by express courier.</p>
          <p> Tracked international shipping is free on orders over {money(FREE_SHIPPING_CENTS)}.</p>
          <p>Prices are in US dollars and do not include import duties or local taxes. Your country sets these, and the courier may collect them on delivery.</p>
          <p>We email you when your order ships. You can follow it any time on the <Link href="/track">tracking page</Link> with your order number and email address.</p>
        </Section>
        <Section title="Studio pieces">
          <p>Pieces you design in the studio are made to order. The lead time is shown with your price before you buy, and shipping starts once the piece is finished.</p>
        </Section>
        <Section title="Returns">
          <p>Every piece is made to order, so we do not take back pieces because of a change of mind. If a piece arrives faulty or differs from your order, <Link href="/contact">write to us</Link> with your order number and we will put it right. This does not affect any rights you have by law.</p>
        </Section>
        <Section title="Faulty items">
          <p>If something arrives damaged or wrong, <Link href="/contact">tell us</Link> and include a photo. We will replace it or refund it.</p>
        </Section>
      </Sections>
    </div>
  );
}
