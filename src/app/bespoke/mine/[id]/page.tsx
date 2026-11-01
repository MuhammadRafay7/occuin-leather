import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestView } from "@/components/bespoke/request-view";
import { getOwnerKey } from "@/lib/server/auth";
import { appUrl, findOwned, listMessages, quoteSharePath } from "@/lib/server/bespoke";
import { whatsappNumber } from "@/lib/server/whatsapp";

export const metadata: Metadata = { title: "Your bespoke design", robots: { index: false, follow: false } };

export default async function OwnedRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const request = await findOwned(id, await getOwnerKey());
  if (!request) notFound();
  return <RequestView request={request} access={{ id }} canSeeOrder messages={await listMessages(request.id)} whatsapp={whatsappNumber()} shareUrl={`${appUrl()}${quoteSharePath(request.id)}`} />;
}
