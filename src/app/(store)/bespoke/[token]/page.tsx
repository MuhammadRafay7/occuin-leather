import { getDelivery } from "@/lib/server/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequestView } from "@/components/bespoke/request-view";
import { getOwnerKey } from "@/lib/server/auth";
import { appUrl, findByToken, listMessages, quoteSharePath, unpaidOrderLink } from "@/lib/server/bespoke";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Your bespoke design", robots: { index: false, follow: false }, referrer: "same-origin" };

export default async function BespokeRequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await findByToken(token);
  if (!request) notFound();
  const owner = await getOwnerKey();
  return <RequestView request={request} payment={paymentModeOf(await getSettings())} unpaidOrder={await unpaidOrderLink(request)} delivery={await getDelivery()} access={{ token }} canSeeOrder={Boolean(owner && (owner === request.ownerKey || owner === request.acceptedOwnerKey))} messages={await listMessages(request.id)} whatsapp={(await contactDetails()).whatsapp} shareUrl={`${appUrl()}${quoteSharePath(request.id)}`} />;
}
