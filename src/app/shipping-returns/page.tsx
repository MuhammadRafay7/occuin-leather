import type { Metadata } from "next";
import Link from "next/link";
import { Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";
import { FREE_SHIPPING_CENTS, MAKING_NOTE, SHIPPING_METHODS, money } from "@/lib/format";
import { RETURN_DAYS } from "@/lib/policy";

export const metadata: Metadata = {
  title: "Shipping and returns",
  description: "Delivery times, shipping costs, and how to return an OCCUIN order.",
};

export default function ShippingReturnsPage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Shipping and returns</PageTitle>
      <Sections>
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
          <p>Return unworn pieces with their tags within {RETURN_DAYS} days of delivery for a refund to your original payment method.</p>
          <p>Return shipping to Pakistan is paid by you unless the piece arrived faulty. To start a return, write to us through the <Link href="/contact">contact page</Link> with your order number.</p>
        </Section>
        <Section title="What cannot be returned">
          <p>Studio pieces are made for you, so they cannot be returned unless they arrive faulty or differ from your design.</p>
        </Section>
        <Section title="Faulty items">
          <p>If something arrives damaged or wrong, <Link href="/contact">tell us</Link> and include a photo. We will replace it or refund it.</p>
        </Section>
      </Sections>
    </div>
  );
}
