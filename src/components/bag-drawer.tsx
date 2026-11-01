"use client";

import { Check, X } from "@phosphor-icons/react";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { useScrollLock } from "@/components/glass/hooks";
import { LineImage } from "@/components/line-image";
import { readBag, type BagView } from "@/components/product/bag-actions";
import { buttonClass } from "@/components/ui";
import { FREE_SHIPPING_CENTS, money } from "@/lib/format";

type Presented = { bag: BagView; addedId: string | null };

const DISMISS_DISTANCE = 96;
const DISMISS_SPEED = 500;
const EDGE_GAP = 16;
const listeners = new Set<(view: Presented) => void>();

export const presentBag = (view: Presented) => listeners.forEach((listener) => listener(view));

function ShippingProgress({ merchandise }: { merchandise: number }) {
  const remaining = FREE_SHIPPING_CENTS - merchandise;
  const reached = Math.min(merchandise / FREE_SHIPPING_CENTS, 1);
  return (
    <div className="grid gap-2">
      <p className="text-[13px]">
        {remaining > 0 ? `Spend ${money(remaining)} more for free standard shipping.` : "Your order qualifies for free standard shipping."}
      </p>
      <div role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reached * 100)} className="h-1 overflow-hidden rounded-full bg-fg/15">
        <motion.div initial={false} animate={{ scaleX: reached }} transition={SHEET_SPRING} className="h-full origin-left rounded-full bg-invert-bg" />
      </div>
    </div>
  );
}

function BagLines({ view }: { view: Presented }) {
  const ordered = [...view.bag.lines].sort((a, b) => Number(b.id === view.addedId) - Number(a.id === view.addedId));
  return (
    <ul data-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
      {ordered.map((line) => (
        <li key={line.id} className="grid grid-cols-[72px_1fr] gap-4 border-b border-fg/10 py-4 last:border-b-0">
          <Link href={line.href} className="relative block aspect-[3/4] overflow-hidden bg-surface">
            <LineImage src={line.image} alt={line.name} sizes="72px" />
          </Link>
          <div className="grid content-start gap-1">
            {line.id === view.addedId ? (
              <p className="flex items-center gap-1 text-xs text-invert-bg"><Check size={14} weight="bold" aria-hidden />Added</p>
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <Link href={line.href} className="font-display text-lg leading-tight hover:opacity-60">{line.name}</Link>
              <p className="shrink-0 text-sm">{money(line.unitCents * line.quantity)}</p>
            </div>
            <p className="text-[13px] text-fg/75">{line.detail}</p>
            {line.quantity > 1 ? <p className="text-[13px] text-fg/75">Quantity {line.quantity}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BagDrawer({ count }: { count: number }) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? INSTANT : SHEET_SPRING;
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLElement>(null);
  const drag = useDragControls();
  const x = useMotionValue(0);
  const scrim = useMotionValue(0);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<Presented | null>(null);

  const offscreen = () => (panel.current?.offsetWidth ?? 0) + EDGE_GAP;

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

  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });

  useEffect(() => {
    const listener = (next: Presented) => {
      setView(next);
      showRef.current();
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useScrollLock(dialog, isOpen);

  function openFromLink(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    setView(null);
    show();
    readBag().then((bag) => setView({ bag, addedId: null }));
  }

  function endDrag(_: unknown, info: PanInfo) {
    if (info.offset.x > DISMISS_DISTANCE || info.velocity.x > DISMISS_SPEED) hide();
    else animate(x, 0, transition);
  }

  const bag = view?.bag;
  const merchandise = bag ? bag.subtotalCents - bag.discountCents : 0;
  const short = bag?.lines.some((line) => line.quantity > line.available);

  return (
    <>
      <Link href="/bag" onClick={openFromLink} className="whitespace-nowrap hover:opacity-60">Bag ({count})</Link>
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
            if (event.pointerType === "touch") drag.start(event);
          }}
          style={{ x }}
          className="glass-panel absolute inset-y-2 right-2 flex w-[calc(100vw-16px)] max-w-[420px] touch-pan-y flex-col overflow-hidden rounded-[28px]"
        >
          <div className="flex h-16 shrink-0 items-center justify-between pl-5 pr-3">
            <h2 className="font-display text-2xl">Your bag{bag ? ` (${bag.count})` : ""}</h2>
            <button type="button" aria-label="Close bag" onClick={hide} className="grid size-11 place-items-center rounded-full transition-transform hover:bg-fg/5 active:scale-[0.94]">
              <X size={20} />
            </button>
          </div>

          {!bag ? (
            <div aria-busy="true" className="flex-1 px-5">
              <div className="h-24 animate-pulse rounded-[16px] bg-fg/5" />
            </div>
          ) : bag.lines.length ? (
            <>
              <BagLines view={view} />
              <div className="grid shrink-0 gap-4 border-t border-fg/10 p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
                <ShippingProgress merchandise={merchandise} />
                <div className="flex items-baseline justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="text-base">{money(bag.subtotalCents)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/bag" onClick={hide} className={buttonClass("outline", "px-4")}>View bag</Link>
                  {short ? null : <Link href="/checkout" onClick={hide} className={buttonClass("solid", "px-4")}>Checkout</Link>}
                </div>
                {short ? <p className="text-[13px] text-danger">Some items are no longer available. Open your bag to change them.</p> : null}
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
