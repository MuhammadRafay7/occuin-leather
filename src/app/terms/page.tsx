import type { Metadata } from "next";
import Link from "next/link";
import { LegalTemplateNotice, Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";
import { BRAND } from "@/lib/format";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms that apply when you use the OCCUIN store and place an order.",
};

export default function TermsPage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Terms</PageTitle>
      <LegalTemplateNotice />
      <Sections>
        <Section title="These terms">
          <p>These terms apply when you use this store or place an order with {BRAND.name}. By placing an order, you accept them.</p>
        </Section>
        <Section title="Orders">
          <p>Your order is confirmed when we email you after payment. We may cancel an order if a piece is no longer available or a price was clearly wrong, and we will refund you in full if we do.</p>
        </Section>
        <Section title="Prices and payment">
          <p>Prices are shown in US dollars. Shipping is added at checkout. Any taxes or import duties that apply to your order are your responsibility unless shown otherwise at checkout.</p>
        </Section>
        <Section title="Delivery">
          <p>Delivery times are estimates. <Link href="/shipping-returns">Shipping and returns</Link> sets out the current options and costs.</p>
        </Section>
        <Section title="Returns">
          <p>Every piece is made to order. You can return a piece if it arrives faulty or differs from your order. This does not affect any rights you have by law.</p>
        </Section>
        <Section title="Studio pieces">
          <p>Studio pieces are made to your design, so they cannot be returned unless they are faulty or differ from your design. You must not submit monograms or designs that use another person&rsquo;s trademark or rights.</p>
          <p>Leather is a natural material. Small variations in grain and colour are normal and are not faults.</p>
        </Section>
        <Section title="Reviews">
          <p>Reviews must be honest and about a piece you bought. We may remove reviews that are unlawful, abusive or off topic.</p>
        </Section>
        <Section title="Our site">
          <p>The content on this site belongs to {BRAND.name} or its licensors. Do not copy it for commercial use without permission.</p>
        </Section>
        <Section title="Liability">
          <p>Nothing in these terms limits liability that cannot be limited by law. Otherwise, our liability for an order is limited to the amount you paid for it.</p>
        </Section>
        <Section title="Contact">
          <p>Write to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> with any question about these terms.</p>
        </Section>
      </Sections>
    </div>
  );
}
