import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MessageList } from "@/components/bespoke/ask-team";
import { DesignViews } from "@/components/bespoke/plan";
import { designSchema, LOGO_STYLES, PRODUCT_TYPES, TEXT_TECHNIQUES, VIEWS, type ProductType } from "@/lib/bespoke/design";
import { estimateDesign, hardwareList } from "@/lib/bespoke/estimate";
import { bodyOf, boundsOf, holesFor, layerOrder, netArea, outlineOf, pathLength, perimeter, pieceBounds } from "@/lib/bespoke/outline";
import { balanceCents, balanceOwedCents, BESPOKE_STATUS_LABELS, bespokeRef, depositCents, PRICE_LOCKED, quoteExpired } from "@/lib/bespoke/status";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { listMessages } from "@/lib/server/bespoke";
import { COLORS, FINISHES, METALS, THREADS } from "@/lib/studio/spec";
import { countryName } from "@/lib/validation";
import { AdminTitle, Empty, linkClass, Section, Table, Tag } from "../../_components/ui";
import { dateTime } from "../../_lib/format";
import { getBespoke } from "../../_lib/queries";
import { BalancePanel } from "./balance-panel";
import { MakeabilitySection } from "./makeability";
import { QuoteForm } from "./quote-form";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Bespoke request" };

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted">{term}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function AdminBespokeRequest({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsedId = z.uuid().safeParse((await params).id);
  if (!parsedId.success) notFound();
  const found = await getBespoke(parsedId.data);
  if (!found) notFound();
  const { request, images } = found;
  const parsed = designSchema.safeParse(request.design);
  const design = parsed.success ? parsed.data : null;
  const estimate = design ? estimateDesign(design) : null;
  const body = design ? bodyOf(design) : null;
  const reference = bespokeRef(request.number);
  const messages = await listMessages(request.id);
  const quoted = request.quotedPriceCents;
  const owed = balanceOwedCents(request);

  return (
    <>
      <AdminTitle
        sub={`Received ${dateTime(request.createdAt)}`}
        action={<Tag tone={request.status === "declined" ? "muted" : "plain"}>{BESPOKE_STATUS_LABELS[request.status]}</Tag>}
      >
        {reference}
      </AdminTitle>
      <p className="-mt-4 mb-2 flex flex-wrap gap-4 text-sm">
        <Link href="/admin/bespoke" className={linkClass}>All bespoke requests</Link>
        {design ? <a href={`/api/admin/bespoke-cut-sheet/${request.id}`} className={linkClass}>Download draft pattern, PDF at 1:1</a> : null}
        {design ? <a href={`/api/admin/bespoke-cut-sheet/${request.id}?format=svg`} className={linkClass}>SVG at 1:1</a> : null}
      </p>
      {request.changeMessage && request.status === "changes_requested" ? (
        <div className="mb-2 border border-line bg-surface px-3 py-2 text-sm">
          <p className="font-medium">Customer asked for a change{request.changeRequestedAt ? `, ${dateTime(request.changeRequestedAt)}` : ""}</p>
          <p className="whitespace-pre-wrap break-words">{request.changeMessage}</p>
        </div>
      ) : null}

      <div className="grid gap-x-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Section title="Pattern">
            {design ? <DesignViews design={design} className="max-h-[560px] border border-line" /> : <Empty title="This design could not be read" body="The stored data did not pass validation, so it is not drawn here." />}
          </Section>

          {design ? (
            <Section title={`Pieces, back to front (${design.pieces.length})`}>
              <Table caption="Pieces" head={["Piece", "Leather", "Thread", "Size, mm", "Area, dm²", "Stitched, mm", "Level", "Text"]} minWidth="min-w-[820px]">
                {layerOrder(design.pieces).map((piece) => {
                  const outline = outlineOf(piece);
                  const tube = piece.kind === "tube";
                  const box = tube ? pieceBounds(piece) : boundsOf(outline);
                  const holes = holesFor(piece, design.pieces).length;
                  return (
                    <tr key={piece.id}>
                      <td>
                        {piece.name}
                        {piece.view !== "front" ? <span className="ml-2"><Tag tone="muted">{VIEWS[piece.view]}</Tag></span> : null}
                        {piece === body && piece.name !== "Body" ? <span className="ml-2"><Tag tone="muted">Body</Tag></span> : null}
                        {piece.mirror ? <span className="ml-2"><Tag tone="muted">Mirrored</Tag></span> : null}
                        {piece.holeOf ? <span className="ml-2"><Tag tone="muted">Cut-out</Tag></span> : null}
                        {tube ? <span className="ml-2"><Tag tone="muted">{`Handle ${piece.tubeWidth} mm`}</Tag></span> : null}
                        {piece.puff ? <span className="ml-2"><Tag tone="muted">{`Puff ${piece.puff} mm`}</Tag></span> : null}
                        {piece.fold ? <span className="ml-2"><Tag tone="muted">{`Fold ${piece.fold.angle} deg`}</Tag></span> : null}
                      </td>
                      <td>
                        {piece.holeOf ? <span className="text-muted">Removed from the piece below</span> : (
                          <>
                            <span aria-hidden className="mr-2 inline-block h-3 w-3 border border-line align-[-1px]" style={{ background: COLORS[piece.color].hex }} />
                            {COLORS[piece.color].name} {FINISHES[piece.finish].name.toLowerCase()}
                          </>
                        )}
                      </td>
                      <td>{THREADS[piece.thread].name}</td>
                      <td className="whitespace-nowrap tabular-nums">{Math.round(box.width)} × {Math.round(box.height)}</td>
                      <td className="tabular-nums">{tube ? ((pathLength(outline) * piece.tubeWidth * 2.4) / 10_000).toFixed(2) : (netArea(piece, design.pieces) / 10_000).toFixed(2)}{holes ? ` (${holes} cut)` : ""}</td>
                      <td className="tabular-nums">{piece.stitched ? Math.round(tube ? pathLength(outline) * 2 : perimeter(outline)) : "No"}</td>
                      <td className="tabular-nums">{piece.stack}</td>
                      <td>{piece.text ? `${piece.text.value}, ${TEXT_TECHNIQUES[piece.text.technique].toLowerCase()}` : <span className="text-muted">None</span>}</td>
                    </tr>
                  );
                })}
              </Table>
            </Section>
          ) : null}

          {design?.pieces.some((piece) => piece.logo) ? (
            <Section title="Logos">
              <ul className="grid gap-3 text-sm sm:grid-cols-2">
                {design.pieces.filter((piece) => piece.logo).map((piece) => (
                  <li key={piece.id} className="flex items-center gap-3">
                    <span className="relative block h-16 w-16 shrink-0 border border-line bg-surface"><Image unoptimized fill sizes="64px" src={`/api/bespoke/logo/${piece.logo!.id}`} alt={`Logo on ${piece.name}`} className="object-contain" /></span>
                    <span>{piece.name}, {piece.logo!.width} mm wide, {LOGO_STYLES[piece.logo!.style].toLowerCase()}, rotated {piece.logo!.rotation} degrees. {piece.logo!.rightsConfirmed ? "Customer confirmed they may use it." : "Rights not confirmed."}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {design ? <MakeabilitySection design={design} /> : null}

          {design && hardwareList(design).length ? (
            <Section title="Hardware">
              <ul className="grid gap-1 text-sm">
                {hardwareList(design).map((item) => <li key={`${item.kind}-${item.name}`}>{item.quantity} × {item.name}, {METALS[design.metal].name}</li>)}
              </ul>
            </Section>
          ) : null}

          <Section title={`Conversation (${messages.length})`}>
            <div className="grid gap-3">
              <MessageList messages={messages} customerLabel={request.name} />
              <ReplyForm requestId={request.id} />
            </div>
          </Section>

          <Section title="Customer notes">
            <p className="max-w-[70ch] whitespace-pre-wrap break-words text-sm">{request.notes || "None"}</p>
          </Section>

          <Section title={`Reference images (${images.length})`}>
            {images.length ? (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {images.map((image) => (
                  <li key={image.id} className="grid gap-1">
                    <a href={`/api/admin/bespoke-images/${image.id}`} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden border border-line bg-surface">
                      <Image unoptimized fill sizes="240px" src={`/api/admin/bespoke-images/${image.id}`} alt={`Reference ${image.position + 1}: ${image.filename}`} className="object-contain" />
                    </a>
                    <span className="truncate text-xs text-muted">{image.filename}, {Math.max(1, Math.round(image.byteSize / 1024))} KB</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None</p>
            )}
          </Section>
        </div>

        <aside className="min-w-0">
          <Section title="Quote">
            <QuoteForm id={request.id} status={request.status} quotedPriceCents={request.quotedPriceCents} depositPercent={request.depositPercent} adminNote={request.adminNote} priceLocked={PRICE_LOCKED.includes(request.status)} canResend={request.status === "quoted"} />
            {request.quoteEmailedAt ? <p className="mt-2 text-sm" data-testid="quote-emailed">Quote emailed {dateTime(request.quoteEmailedAt)}</p> : request.status === "quoted" ? <p className="mt-2 text-sm text-danger">The quote email has not been sent.</p> : null}
            {request.quoteExpiresAt ? <p className="text-sm text-muted">{quoteExpired(request.quoteExpiresAt) ? "Expired" : "Expires"} {dateTime(request.quoteExpiresAt)}</p> : null}
            {request.acceptedAt ? <p className="text-sm text-muted">Accepted {dateTime(request.acceptedAt)}</p> : null}
          </Section>
          {quoted ? (
            <Section title="Payment">
              <Facts
                rows={[
                  ["Total", money(quoted)],
                  [request.depositPaidAt ? "Deposit paid" : `Deposit, ${request.depositPercent}%`, money(depositCents(quoted, request.depositPercent))],
                  [request.balancePaidAt ? "Balance paid" : "Balance due", money(balanceCents(quoted, request.depositPercent))],
                ]}
              />
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                {request.orderId ? <Link href={`/admin/orders/${request.orderId}`} className={linkClass}>Deposit order</Link> : null}
                {request.balanceOrderId ? <Link href={`/admin/orders/${request.balanceOrderId}`} className={linkClass}>Balance order</Link> : null}
              </p>
              {owed ? <div className="mt-3"><BalancePanel requestId={request.id} owedCents={owed} requestedAt={request.balanceRequestedAt ? dateTime(request.balanceRequestedAt) : null} /></div> : null}
            </Section>
          ) : null}
          <Section title="Customer">
            <Facts rows={[["Name", request.name], ["Email", request.email], ["Country", countryName(request.country)], ["Phone", request.phone ?? "None"]]} />
            <p className="mt-2 text-sm"><a href={`mailto:${request.email}?subject=${encodeURIComponent(`Your OCCUIN design ${reference}`)}`} className={linkClass}>Email the customer</a></p>
          </Section>
          <Section title="Estimate shown">
            <Facts
              rows={[
                ["Range", `${money(request.estimateLowCents)} to ${money(request.estimateHighCents)}`],
                ...(estimate
                  ? ([
                      ["Size", `${estimate.widthMm} × ${estimate.heightMm} × ${estimate.depthMm} mm`],
                      ["Leather", `${estimate.areaDm2.toFixed(1)} dm²`],
                      ["Stitching", `${Math.round(estimate.stitchedMm)} mm`],
                      ["Handwork", `${estimate.hours.toFixed(1)} hours`],
                    ] as [string, string][])
                  : []),
              ]}
            />
          </Section>
          {design ? (
            <Section title="Details">
              <Facts
                rows={[
                  ["Product", PRODUCT_TYPES[request.productType as ProductType] ?? request.productType],
                  ["Design name", design.name || "None"],
                  ["Hardware", METALS[design.metal].name],
                  ["Lining", COLORS[design.lining].name],
                  ["Closure", design.closure || "None"],
                ]}
              />
            </Section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
