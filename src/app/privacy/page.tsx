import type { Metadata } from "next";
import { LegalTemplateNotice, Section, Sections } from "@/components/prose";
import { PageTitle } from "@/components/ui";
import { BRAND } from "@/lib/format";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta("/privacy");

export default function PrivacyPage() {
  return (
    <div className="px-page pt-header">
      <PageTitle>Privacy</PageTitle>
      <LegalTemplateNotice />
      <Sections>
        <Section title="Who we are">
          <p>{BRAND.name} runs this store. For anything about your data, write to <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.</p>
        </Section>
        <Section title="What we collect">
          <ul>
            <li>Account details: your name, email address and a protected version of your password.</li>
            <li>Order details: what you bought, your delivery address and your email address.</li>
            <li>Your saved items, bag and studio designs.</li>
            <li>Reviews you post and messages you send us.</li>
            <li>Your email address if you join the newsletter.</li>
          </ul>
        </Section>
        <Section title="Payments">
          <p>Card payments are handled by Stripe. We receive confirmation of payment, and we do not see or store your full card number.</p>
        </Section>
        <Section title="How we use it">
          <ul>
            <li>To take, make and deliver your order, and to handle returns.</li>
            <li>To send order and account emails.</li>
            <li>To answer your messages.</li>
            <li>To send the newsletter, if you joined it.</li>
            <li>To protect the store from abuse, for example by limiting repeated requests.</li>
          </ul>
        </Section>
        <Section title="Who we share it with">
          <p>We share data only with the services we need to run the store: payment processing, email delivery, delivery carriers and hosting. We do not sell your data.</p>
        </Section>
        <Section title="Cookies and local storage">
          <p>We use one cookie to keep you signed in and one to hold the bag and saved items of guests. Your browser also stores your choice of grid columns and that you have seen the cookie notice. We do not use advertising cookies.</p>
        </Section>
        <Section title="Keeping and deleting data">
          <p>You can delete your account from your profile page. We keep order records for as long as the law requires, even after an account is deleted. You can ask us for a copy of your data, or ask us to correct or delete it, by writing to the address above.</p>
        </Section>
        <Section title="Changes">
          <p>If we change this policy, we will update this page.</p>
        </Section>
      </Sections>
    </div>
  );
}
