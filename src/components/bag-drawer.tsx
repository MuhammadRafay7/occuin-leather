"use client";

import { Check, Minus, Plus, X } from "@phosphor-icons/react";
import { animate, AnimatePresence, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type MouseEvent } from "react";
import { BagAssurance, type PaymentInfo } from "@/components/bag/bag-assurance";
import { PairsWell } from "@/components/bag/pairs-well";
import { ShippingProgress } from "@/components/bag/shipping-progress";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { useScrollLock } from "@/components/glass/hooks";
import { LineImage } from "@/components/line-image";
import { readBag, type BagView } from "@/components/product/bag-actions";
import { buttonClass } from "@/components/ui";
import { readBagExtras, updateBagLine, type BagExtras } from "@/lib/actions/bag";
import { bagDeliveryDates } from "@/lib/delivery-dates";
import { money, type Delivery } from "@/lib/format";

type Presented = { bag: BagView; addedId: string | null };
type Line = BagView["lines"][number];

const DISMISS_DISTANCE = 96;
const DISMISS_SPEED = 500;
const EDGE_GAP = 16;
const MAX_QUANTITY = 10;
const LIVE_PATHS = ["/bag", "/checkout"];
const listeners = new Set<(view: Presented) => void>();
const openers = new Set<() => void>();
const counters = new Set<(count: number) => void>();

export const syncBagCount = (count: number) => counters.forEach((listener) => listener(count));

export const presentBag = (view: Presented) => {
  syncBagCount(view.bag.count);
  listeners.forEach((listener) => listener(view));
};

export const openBag = () => openers.forEach((open) => open());

function BagLine({ line, added, busy, onChange }: { line: Line; added: boolean; busy: boolean; onChange: (quantity: number) => void }) {
  const reduceMotion = useReducedMotion();
  const ceiling = Math.min(MAX_QUANTITY, line.available);
  const adjustable = line.kind !== "bespoke";
  const short = line.quantity > line.available;

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      initial={added && !reduceMotion ? { opacity: 0, x: 28 } : false}
      animate={{ opacity: busy ? 0.55 : 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0, transition: INSTANT } : { opacity: 0, x: 28, transition: { duration: 0.18 } }}
      transition={reduceMotion ? INSTANT : SHEET_SPRING}
      aria-busy={busy}
      className="relative grid grid-cols-[72px_1fr] gap-4 border-b border-fg/10 py-4 last:border-b-0"
    >
      {added ? (
        <motion.span
          aria-hidden
          initial={{ opacity: reduceMotion ? 0 : 0.9 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 1.6, ease: "easeOut" }}
          className="pointer-events-none absolute -inset-x-3 inset-y-1 rounded-[16px] bg-invert-bg/8"
        />
      ) : null}
      <Link href={line.href} className="relative block aspect-[3/4] overflow-hidden rounded-[10px] bg-surface">
        <LineImage src={line.image} alt={line.name} sizes="72px" />
      </Link>
      <div className="relative grid min-w-0 content-start gap-1">
        {added ? (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? INSTANT : { ...SHEET_SPRING, delay: 0.12 }}
            className="flex items-center gap-1 text-xs font-medium text-invert-bg"
          >
            <Check size={14} weight="bold" aria-hidden />
            Added to your bag
          </motion.p>
        ) : null}
        <div className="flex items-start justify-between gap-3">
          <Link href={line.href} className="min-w-0 font-display text-lg leading-tight hover:opacity-60">{line.name}</Link>
          <p className="shrink-0 text-sm tabular-nums">{money(line.unitCents * line.quantity)}</p>
        </div>
        <p className="text-[13px] text-fg/75">{line.detail}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          {adjustable ? (
            <div className="flex items-center rounded-full border border-fg/15">
              <button
                type="button"
                aria-label={`Reduce quantity of ${line.name}`}
                disabled={busy || line.quantity <= 1}
                onClick={() => onChange(line.quantity - 1)}
                className="grid size-11 place-items-center rounded-full transition active:scale-[0.92] disabled:opacity-35 lg:size-9"
              >
                <Minus size={13} />
              </button>
              <span aria-live="polite" aria-label={`Quantity ${line.quantity}`} className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
              <button
                type="button"
                aria-label={`Increase quantity of ${line.name}`}
                disabled={busy || line.quantity >= ceiling}
                onClick={() => onChange(line.quantity + 1)}
                className="grid size-11 place-items-center rounded-full transition active:scale-[0.92] disabled:opacity-35 lg:size-9"
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <span />
          )}
          <button type="button" disabled={busy} onClick={() => onChange(0)} aria-label={`Remove ${line.name}`} className="flex min-h-11 items-center px-1 text-[13px] underline underline-offset-4 hover:opacity-60 disabled:opacity-40 lg:min-h-9">
            Remove
          </button>
        </div>
        {short ? <p role="alert" className="text-[13px] text-danger">{line.available < 1 ? "No longer available. Remove it to check out." : `Only ${line.available} left. Lower the quantity to check out.`}</p> : null}
      </div>
    </motion.li>
  );
}

type Props = { server: { count: number }; freeShippingCents: number; delivery: Delivery; payment: PaymentInfo };

export function BagDrawer({ server, freeShippingCents, delivery, payment }: Props) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? INSTANT : SHEET_SPRING;
  const router = useRouter();
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useDragControls();
  const x = useMotionValue(0);
  const scrim = useMotionValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<Presented | null>(null);
  const [extras, setExtras] = useState<BagExtras | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [, startUpdate] = useTransition();
  const [liveCount, setLiveCount] = useState(server.count);
  const [rendered, setRendered] = useState(server);
  const [bump, setBump] = useState(0);

  if (server !== rendered) {
    setRendered(server);
    setLiveCount(server.count);
  }

  const offscreen = () => (panel.current?.offsetWidth ?? 0) + EDGE_GAP;

  function loadExtras() {
    readBagExtras().then(setExtras, () => setExtras({ shippingWaived: false, suggestions: [] }));
  }

  function show() {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) {
      node.showModal();
      x.set(offscreen());
      setIsOpen(true);
    }
    animate(x, 0, transition);
    animate(scrim, 1, transition);
  }

  function hide() {
    animate(scrim, 0, transition);
    animate(x, offscreen(), { ...transition, onComplete: () => dialog.current?.close() });
  }

  function openFresh() {
    setView(null);
    setLineError(null);
    show();
    readBag().then((bag) => {
      setView({ bag, addedId: null });
      setLiveCount(bag.count);
    });
    loadExtras();
  }

  function refreshPage() {
    if (LIVE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) router.refresh();
  }

  const handlers = useRef({ show, openFresh, loadExtras, refreshPage });
  useEffect(() => {
    handlers.current = { show, openFresh, loadExtras, refreshPage };
  });

  useEffect(() => {
    const listener = (next: Presented) => {
      setView(next);
      setLineError(null);
      if (next.addedId) setBump((value) => value + 1);
      handlers.current.show();
      handlers.current.loadExtras();
      handlers.current.refreshPage();
    };
    const opener = () => handlers.current.openFresh();
    const counter = (next: number) => setLiveCount(next);
    listeners.add(listener);
    openers.add(opener);
    counters.add(counter);
    return () => {
      listeners.delete(listener);
      openers.delete(opener);
      counters.delete(counter);
    };
  }, []);

  useScrollLock(dialog, isOpen);

  function openFromLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openFresh();
  }

  function endDrag(_: unknown, info: PanInfo) {
    if (info.offset.x > DISMISS_DISTANCE || info.velocity.x > DISMISS_SPEED) hide();
    else animate(x, 0, transition);
  }

  function changeLine(line: Line, quantity: number) {
    setBusyLine(line.id);
    setLineError(null);
    startUpdate(async () => {
      const result = await updateBagLine(line.id, quantity);
      setBusyLine(null);
      if ("error" in result) {
        setLineError(result.error);
        return;
      }
      setView({ bag: result.bag, addedId: null });
      setLiveCount(result.bag.count);
      loadExtras();
      refreshPage();
    });
  }

  const bag = view?.bag;
  const short = bag?.lines.some((line) => line.quantity > line.available);
  const ordered = bag ? [...bag.lines].sort((a, b) => Number(b.id === view?.addedId) - Number(a.id === view?.addedId)) : [];
  const dates = bag ? bagDeliveryDates(bag.lines, delivery) : null;

  return (
    <>
      <Link href="/bag" onClick={openFromLink} className="-mx-2 flex h-11 items-center whitespace-nowrap px-2 hover:opacity-60">
        <span>
          Bag (
          <motion.span
            key={bump}
            initial={bump && !reduceMotion ? { scale: 1.6 } : false}
            animate={{ scale: 1 }}
            transition={reduceMotion ? INSTANT : { type: "spring", stiffness: 420, damping: 14 }}
            className="inline-block tabular-nums"
          >
            {liveCount}
          </motion.span>
          )
        </span>
      </Link>
      <dialog
        ref={dialog}
        aria-label="Your bag"
        onCancel={(event) => {
          event.preventDefault();
          hide();
        }}
        onClose={() => {
          setIsOpen(false);
          scrim.set(0);
        }}
        className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 text-fg"
      >
        <motion.div data-bag-scrim style={{ opacity: scrim }} onClick={hide} className="absolute inset-0 bg-invert-bg/25" />
        <motion.aside
          ref={panel}
          data-bag-panel
          drag="x"
          dragControls={drag}
          dragListener={false}
          dragDirectionLock
          dragConstraints={{ left: 0 }}
          dragElastic={{ left: 0, right: 0.9 }}
          dragMomentum={false}
          onDragEnd={endDrag}
          onPointerDown={(event) => {
            if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("button, a, [data-no-drag]")) drag.start(event);
          }}
          style={{ x }}
          className="glass-panel absolute bottom-[max(8px,env(safe-area-inset-bottom))] right-[max(8px,env(safe-area-inset-right))] top-[max(8px,env(safe-area-inset-top))] flex w-[calc(100vw-16px)] max-w-[420px] touch-pan-y flex-col overflow-hidden rounded-[28px]"
        >
          <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3 short:h-12">
            <h2 className="font-display text-2xl">Your bag{bag ? ` (${bag.count})` : ""}</h2>
            <button type="button" aria-label="Close bag" onClick={hide} className="grid size-11 place-items-center rounded-full transition-transform hover:bg-fg/5 active:scale-[0.94]">
              <X size={20} />
            </button>
          </div>

          {!bag ? (
            <div aria-busy="true" className="grid flex-1 content-start gap-3 px-5">
              <div className="h-[3px] animate-pulse rounded-full bg-fg/8" />
              <div className="mt-3 h-24 animate-pulse rounded-[16px] bg-fg/5" />
            </div>
          ) : bag.lines.length ? (
            <>
              <div className="shrink-0 px-5 pb-3 short:pb-2">
                <ShippingProgress merchandiseCents={bag.shippingBasisCents} thresholdCents={freeShippingCents} waived={extras?.shippingWaived} />
              </div>
              <div data-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
                <ul>
                  <AnimatePresence initial={false}>
                    {ordered.map((line) => (
                      <BagLine key={line.id} line={line} added={line.id === view.addedId} busy={busyLine === line.id} onChange={(quantity) => changeLine(line, quantity)} />
                    ))}
                  </AnimatePresence>
                </ul>
                {lineError ? <p role="alert" className="pb-3 text-[13px] text-danger">{lineError}</p> : null}
                <div className="grid gap-6 border-t border-fg/10 py-5">
                  <BagAssurance dates={dates} payment={payment} onNavigate={hide} />
                  {extras ? <PairsWell suggestions={extras.suggestions} onAdded={presentBag} onNavigate={hide} /> : null}
                </div>
              </div>
              <div className="grid shrink-0 gap-3 border-t border-fg/10 p-5 short:gap-2 short:p-3">
                <div className="flex items-baseline justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="text-base tabular-nums">{money(bag.subtotalCents)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/bag" onClick={hide} className={buttonClass("outline", "px-4")}>View bag</Link>
                  {short ? null : <Link href="/checkout" onClick={hide} className={buttonClass("solid", "px-4")}>Checkout</Link>}
                </div>
                {short ? <p className="text-[13px] text-danger">Some pieces are no longer available. Change them to check out.</p> : null}
              </div>
            </>
          ) : (
            <div className="grid flex-1 content-center justify-items-center gap-4 px-5 pb-16 text-center">
              <p className="font-display text-2xl">Your bag is empty</p>
              <Link href="/shop/leather" onClick={hide} className={buttonClass("solid")}>Shop the collection</Link>
            </div>
          )}
        </motion.aside>
      </dialog>
    </>
  );
}
