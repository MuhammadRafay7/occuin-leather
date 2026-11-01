import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { PageTitle } from "@/components/ui";
import { BRAND } from "@/lib/format";

export const metadata: Metadata = {
  title: "Contact",
  description: "Write to OCCUIN about an order, a return, a product or the design studio.",
};

export default function ContactPage() {
  return (
    <div className="px-4 pt-24 md:px-8">
      <PageTitle>Contact</PageTitle>
      <div className="grid gap-12 md:grid-cols-12">
        <div className="max-w-xl md:col-span-6">
          <ContactForm />
        </div>
        <div className="grid content-start gap-4 text-sm md:col-span-4 md:col-start-9 [&_a]:underline [&_a]:underline-offset-4">
          <p>Or email <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.</p>
          <p>If you are writing about an order, include your order number.</p>
          <p>Quick answers: <Link href="/track">track an order</Link>, <Link href="/shipping-returns">shipping and returns</Link>, <Link href="/faq">questions</Link>.</p>
        </div>
      </div>
    </div>
  );
}
