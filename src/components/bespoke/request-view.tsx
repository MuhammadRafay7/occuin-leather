import Link from "next/link";
import type { BespokeDesign } from "@/lib/bespoke/design";
import { designSchema, PRODUCT_TYPES, type ProductType } from "@/lib/bespoke/design";
import { hardwareList } from "@/lib/bespoke/estimate";
import { boundsOf, layerOrder, outlineOf, pieceBounds } from "@/lib/bespoke/outline";
import { balanceBuyable, balanceCents, balanceOwedCents, BESPOKE_STATUS_LABELS, bespokeBuyable, bespokeRef, depositCents, quoteAcceptable, quoteExpired, QUOTE_DAYS, type BespokeStatus } from "@/lib/bespoke/status";
import { BESPOKE_NOTE, longDate, money } from "@/lib/format";
import { COLORS, FINISHES, METALS, THREADS } from "@/lib/studio/spec";
import { Conversation, type ThreadMessage } from "./ask-team";
import { DesignStage } from "./design-stage";
import { DesignViews } from "./plan";
import { QuoteActions } from "./quote-actions";
import { ChatOnWhatsApp, ShareOnWhatsApp } from "./whatsapp";

type Request = {
  id: string;
  number: number;
  status: BespokeStatus;
  productType: string;
  design: BespokeDesign;
  quotedPriceCents: number | null;
  quoteExpiresAt: Date | null;
  orderId: string | null;
  changeMessage: string | null;
  depositPercent: number;
  depositPaidAt: Date | null;
  balanceRequestedAt: Date | null;
  balancePaidAt: Date | null;
};

const STATUS_NOTES: Partial<Record<BespokeStatus, string>> = {
  question: "Your question is with our team. We will reply here and by email.",
  new: "We are reviewing your design and will email you a final price.",
  changes_requested: "We have your message. The workshop will come back to you with a new price.",
  declined: "Our workshop could not take this design on. This quote cannot be bought.",
  in_production: "Paid, and your piece is being made.",
  completed: "This piece is finished. Thank you.",
};

export function PiecesTable({ design }: { design: BespokeDesign }) {
  const fittings = hardwareList(design);
  return (
    <section aria-labelledby="pieces-title" className="grid gap-3">
      <h2 id="pieces-title" className="border-b border-line pb-3 font-display text-2xl">Pieces</h2>
      <ul className="grid gap-2 text-sm">
        {layerOrder(design.pieces).filter((piece) => !piece.holeOf).map((piece) => {
          const box = piece.kind === "tube" ? pieceBounds(piece) : boundsOf(outlineOf(piece));
          return (
            <li key={piece.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span>
                <span aria-hidden className="mr-2 inline-block h-3 w-3 align-[-1px]" style={{ background: COLORS[piece.color].hex }} />
                {piece.name}
              </span>
              <span className="text-muted">{COLORS[piece.color].name} {FINISHES[piece.finish].name.toLowerCase()}, {piece.stitched ? `${THREADS[piece.thread].name} thread, ` : ""}{Math.round(box.width)} × {Math.round(box.height)} mm</span>
            </li>
          );
        })}
      </ul>
      {fittings.length ? <p className="text-sm text-muted">Fittings in {METALS[design.metal].name.toLowerCase()}: {fittings.map((item) => `${item.quantity} × ${item.name.toLowerCase()}`).join(", ")}.</p> : null}
    </section>
  );
}

function Payment({ request, quoted }: { request: Request; quoted: number }) {
  const deposit = depositCents(quoted, request.depositPercent);
  const balance = balanceCents(quoted, request.depositPercent);
  if (!balance) return null;
  const paidUp = Boolean(request.balancePaidAt);
  return (
    <dl className="mt-3 grid gap-1 text-sm">
      <div className="flex justify-between gap-4" data-testid="deposit">
        <dt className="text-muted">{request.depositPaidAt ? "Deposit paid" : `Deposit, ${request.depositPercent}%`}</dt>
        <dd className="tabular-nums">{money(deposit)}</dd>
      </div>
      <div className="flex justify-between gap-4" data-testid="balance">
        <dt className="text-muted">{paidUp ? "Balance paid" : "Balance due before shipping"}</dt>
        <dd className="tabular-nums">{money(balance)}</dd>
      </div>
    </dl>
  );
}

export function RequestView({ request, access, canSeeOrder, messages, whatsapp, shareUrl }: { request: Request; access: { token?: string; id?: string }; canSeeOrder: boolean; messages: ThreadMessage[]; whatsapp: string | null; shareUrl: string }) {
  const parsed = designSchema.safeParse(request.design);
  const design = parsed.success ? parsed.data : null;
  const expired = quoteExpired(request.quoteExpiresAt);
  const acceptable = quoteAcceptable(request);
  const buyable = bespokeBuyable(request);
  const reference = bespokeRef(request.number);
  const quoted = request.quotedPriceCents;
  const owed = balanceOwedCents(request);
  const deposit = quoted ? depositCents(quoted, request.depositPercent) : 0;
  const payLabel = quoted && deposit === quoted ? `pay ${money(quoted)}` : `pay ${money(deposit)} deposit`;
  const paidNote = owed ? (request.balanceRequestedAt ? `Your piece is ready for its final payment of ${money(owed)}.` : "Your deposit is paid and your piece is being made.") : null;
  const shareText = quoted ? `My OCCUIN design ${reference}, quoted at ${money(quoted)}: ${shareUrl}` : `My OCCUIN design ${reference}: ${shareUrl}`;
  const quotedAndOpen = request.status === "quoted";
  const note = expired && (quotedAndOpen || request.status === "accepted") ? `This quote expired on ${longDate(request.quoteExpiresAt!)}, so it cannot be bought. Ask for a change and we will look at it again.` : (paidNote ?? STATUS_NOTES[request.status]);
  return (
    <div className="mx-auto max-w-[1080px] px-page pb-24 pt-header">
      <header className="mb-8">
        <p className="text-sm text-muted">{reference}, {PRODUCT_TYPES[request.productType as ProductType] ?? request.productType}</p>
        <h1 className="mt-1 font-display text-4xl leading-[1.05] text-invert-bg md:text-6xl">{design?.name || "Your bespoke design"}</h1>
        <p className="mt-3 inline-block rounded-full bg-invert-bg px-3 py-1 text-[13px] font-medium text-invert-fg" data-testid="status">{BESPOKE_STATUS_LABELS[request.status]}</p>
      </header>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-8">
          {design ? <DesignStage design={design} /> : null}
          {design ? <DesignViews design={design} /> : null}
          {design ? <PiecesTable design={design} /> : null}
          <Conversation access={access} messages={messages} />
        </div>
        <aside className="grid content-start gap-5">
          {request.quotedPriceCents ? (
            <div>
              <p className="text-sm text-muted">Final price</p>
              <p className="font-display text-5xl leading-tight tabular-nums" data-testid="price">{money(request.quotedPriceCents)}</p>
              {request.quoteExpiresAt && quotedAndOpen && !expired ? <p className="mt-1 text-sm text-muted">This quote is open for {QUOTE_DAYS} days, until {longDate(request.quoteExpiresAt)}.</p> : null}
              {quoted ? <Payment request={request} quoted={quoted} /> : null}
            </div>
          ) : null}
          {note ? <p role="status" className="text-sm">{note}</p> : null}
          <QuoteActions access={access} canAccept={acceptable} canChange={quotedAndOpen} canBag={buyable} canPayBalance={balanceBuyable(request)} payLabel={payLabel} balanceLabel={`Pay balance of ${money(owed)}`} />
          <ChatOnWhatsApp number={whatsapp} text={`Hello OCCUIN, I have a question about my design ${reference}.`} />
          <ShareOnWhatsApp number={whatsapp} text={shareText} label={quoted ? "Share this quote on WhatsApp" : "Share this design on WhatsApp"} />
          {request.orderId && canSeeOrder ? <Link href={`/orders/${request.orderId}`} className="text-sm underline underline-offset-4">View your order</Link> : null}
          <p className="text-sm text-muted">{BESPOKE_NOTE}</p>
        </aside>
      </div>
    </div>
  );
}
