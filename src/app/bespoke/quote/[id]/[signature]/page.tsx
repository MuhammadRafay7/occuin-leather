import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DesignStage } from "@/components/bespoke/design-stage";
import { DesignViews } from "@/components/bespoke/plan";
import { PiecesTable } from "@/components/bespoke/request-view";
import { designSchema } from "@/lib/bespoke/design";
import { balanceCents, bespokeRef, depositCents, quoteExpired } from "@/lib/bespoke/status";
import { money } from "@/lib/format";
import { findQuoteShare } from "@/lib/server/bespoke";

export const metadata: Metadata = { title: "A shared quote", robots: { index: false, follow: false }, referrer: "same-origin" };

export default async function SharedQuotePage({ params }: { params: Promise<{ id: string; signature: string }> }) {
  const { id, signature } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const request = await findQuoteShare(id, signature);
  const parsed = designSchema.safeParse(request?.design);
  if (!request || !parsed.success) notFound();
  const quoted = request.quotedPriceCents;
  const balance = quoted ? balanceCents(quoted, request.depositPercent) : 0;
  return (
    <div className="mx-auto grid max-w-[1080px] gap-8 px-page pb-24 pt-header">
      <header>
        <p className="text-sm text-muted">A shared OCCUIN design, {bespokeRef(request.number)}, view only</p>
        <h1 className="mt-1 font-display text-4xl leading-[1.05] text-invert-bg md:text-6xl">{parsed.data.name || "A bespoke design"}</h1>
        {quoted ? <p className="mt-3 font-display text-3xl tabular-nums" data-testid="shared-price">{money(quoted)}</p> : null}
        {quoted && balance ? <p className="mt-1 text-sm text-muted">{request.depositPercent}% deposit of {money(depositCents(quoted, request.depositPercent))}, then {money(balance)} before shipping.</p> : null}
        {quoted && quoteExpired(request.quoteExpiresAt) ? <p className="mt-1 text-sm text-muted">This quote has expired.</p> : null}
      </header>
      <DesignStage design={parsed.data} />
      <DesignViews design={parsed.data} />
      <PiecesTable design={parsed.data} />
    </div>
  );
}
