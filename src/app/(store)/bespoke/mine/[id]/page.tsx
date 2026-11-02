import { getDelivery } from "@/lib/server/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestView } from "@/components/bespoke/request-view";
import { getOwnerKey } from "@/lib/server/auth";
import { appUrl, findOwned, listMessages, quoteSharePath, unpaidOrderLink } from "@/lib/server/bespoke";
import { contactDetails, getSettings, paymentModeOf } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Your bespoke design", robots: { index: false, follow: false } };

export default async function OwnedRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const request = await findOwned(id, await getOwnerKey());
  if (!request) notFound();
  return <RequestView request={request} payment={paymentModeOf(await getSettings())} unpaidOrder={await unpaidOrderLink(request)} delivery={await getDelivery()} access={{ id }} canSeeOrder messages={await listMessages(request.id)} whatsapp={(await contactDetails()).whatsapp} shareUrl={`${appUrl()}${quoteSharePath(request.id)}`} />;
}
