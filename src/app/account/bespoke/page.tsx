import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { PRODUCT_TYPES, type ProductType } from "@/lib/bespoke/design";
import { balanceOwedCents, BESPOKE_STATUS_LABELS, bespokeRef } from "@/lib/bespoke/status";
import { longDate, money } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";
import { listOwnedRequests } from "@/lib/server/bespoke";
import { db, schema } from "@/lib/server/db";

export const metadata: Metadata = { title: "Bespoke" };

export default async function AccountBespokePage() {
  const user = await requireUser("/account/bespoke");
  const owner = `u:${user.id}`;
  const [requests, saved] = await Promise.all([
    listOwnedRequests(owner),
    db.select().from(schema.bespokeDesigns).where(eq(schema.bespokeDesigns.ownerKey, owner)).orderBy(desc(schema.bespokeDesigns.updatedAt)),
  ]);
  return (
    <>
      <PageTitle>Bespoke</PageTitle>
      <div className="grid gap-12">
        <section aria-labelledby="requests-title" className="grid gap-4">
          <h2 id="requests-title" className="font-display text-2xl">Your requests</h2>
          {requests.length ? (
            <ul className="border-t border-line">
              {requests.map((request) => (
                <li key={request.id} className="border-b border-line">
                  <Link href={`/bespoke/mine/${request.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 text-sm hover:opacity-60">
                    <span>{bespokeRef(request.number)}, {PRODUCT_TYPES[request.productType as ProductType] ?? request.productType}</span>
                    <span>{request.quotedPriceCents ? money(request.quotedPriceCents) : request.status === "question" ? "Question" : "Not priced yet"}</span>
                    <span className="text-muted">{longDate(request.createdAt)}</span>
                    <span className="text-muted">{balanceOwedCents(request) ? `${BESPOKE_STATUS_LABELS[request.status]}, balance due ${money(balanceOwedCents(request))}` : BESPOKE_STATUS_LABELS[request.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">You have not sent us a design yet.</p>
          )}
        </section>
        <section aria-labelledby="saved-title" className="grid gap-4">
          <h2 id="saved-title" className="font-display text-2xl">Saved designs</h2>
          {saved.length ? (
            <ul className="border-t border-line">
              {saved.map((design) => (
                <li key={design.id} className="border-b border-line">
                  <Link href={`/studio/create?design=${design.id}`} className="flex min-h-11 items-center justify-between gap-4 py-3 text-sm hover:opacity-60">
                    <span>{design.name}</span>
                    <span className="text-muted">{longDate(design.updatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Designs you save at the pattern board appear here.</p>
          )}
          <Link href="/studio/create" className="text-sm underline underline-offset-4">Open the pattern board</Link>
        </section>
      </div>
    </>
  );
}
