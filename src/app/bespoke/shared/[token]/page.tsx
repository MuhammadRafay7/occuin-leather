import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignStage } from "@/components/bespoke/design-stage";
import { DesignViews } from "@/components/bespoke/plan";
import { PiecesTable } from "@/components/bespoke/request-view";
import { ChatOnWhatsApp, ShareOnWhatsApp } from "@/components/bespoke/whatsapp";
import { LinkButton } from "@/components/ui";
import { designSchema } from "@/lib/bespoke/design";
import { appUrl, findShared } from "@/lib/server/bespoke";
import { whatsappNumber } from "@/lib/server/whatsapp";

export const metadata: Metadata = { title: "A shared design", robots: { index: false, follow: false }, referrer: "same-origin" };

export default async function SharedDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findShared(token);
  const parsed = designSchema.safeParse(row?.design);
  if (!row || !parsed.success) notFound();
  const whatsapp = whatsappNumber();
  return (
    <div className="mx-auto grid max-w-[1080px] gap-8 px-page pb-24 pt-header">
      <header>
        <p className="text-sm text-muted">A shared OCCUIN design, view only</p>
        <h1 className="mt-1 font-display text-4xl leading-[1.05] text-invert-bg md:text-6xl">{row.name}</h1>
      </header>
      <DesignStage design={parsed.data} />
      <DesignViews design={parsed.data} />
      <PiecesTable design={parsed.data} />
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href={`/studio/create?from=${token}`}>Start from this design</LinkButton>
        <ShareOnWhatsApp number={whatsapp} text={`An OCCUIN design: ${appUrl()}/bespoke/shared/${token}`} />
        <ChatOnWhatsApp number={whatsapp} text="Hello OCCUIN, I have a question about a design." />
      </div>
    </div>
  );
}
