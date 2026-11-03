import type { Metadata } from "next";
import { breadcrumbData, jsonLd } from "@/lib/seo";
import { getStudioRates, pageMetadata } from "@/lib/server/content";
import { contactDetails, getSettings, pausedMessage } from "@/lib/server/settings";
import { loadCandidates } from "./candidates";
import { Finder } from "./finder";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata("/find-your-bag");
}

export default async function FindYourBagPage() {
  const [candidates, { pricing, delivery }, contact, settings] = await Promise.all([loadCandidates(), getStudioRates(), contactDetails(), getSettings()]);
  const breadcrumbs = breadcrumbData([
    { name: "Home", path: "/" },
    { name: "Find your bag", path: "/find-your-bag" },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbs)} />
      <Finder candidates={candidates} pricing={pricing} delivery={delivery} whatsapp={contact.whatsapp} paused={pausedMessage(settings)} />
    </>
  );
}
