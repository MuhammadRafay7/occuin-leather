"use client";

import { ArrowRight, Eye, X } from "@phosphor-icons/react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { presentBag } from "@/components/bag-drawer";
import { useMediaQuery, useScrollLock } from "@/components/glass/hooks";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { addAndReadBag } from "@/components/product/bag-actions";
import { readQuickView, type QuickViewProduct } from "@/lib/actions/bag";
import { money } from "@/lib/format";
import { compareSizes } from "@/lib/shop-params";
import { swatchHex } from "./swatches";

const openers = new Set<(slug: string) => void>();
const loaded = new Map<string, Promise<QuickViewProduct | null>>();

export function prefetchQuickView(slug: string) {
  let pending = loaded.get(slug);
  if (!pending) {
    pending = readQuickView(slug).catch(() => null);
    loaded.set(slug, pending);
    pending.then((product) => {
      if (!product) loaded.delete(slug);
    });
  }
  return pending;
}

export const openQuickView = (slug: string) => openers.forEach((open) => open(slug));

export function QuickViewButton({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`Quick view ${name}`}
      aria-haspopup="dialog"
      onPointerEnter={() => prefetchQuickView(slug)}
      onFocus={() => prefetchQuickView(slug)}
      onClick={() => openQuickView(slug)}
      className={className}
    >
      <Eye size={15} aria-hidden />
    </button>
  );
}

function pickInitial(product: QuickViewProduct) {
  const color = product.variants.find((variant) => variant.inStock)?.color ?? product.variants[0]?.color ?? "";
  const sizes = product.variants.filter((variant) => variant.color === color);
  const size = sizes.length === 1 && sizes[0]!.inStock ? sizes[0]!.size : null;
  return { color, size };
}

function Details({ product, onAdded }: { product: QuickViewProduct; onAdded: () => void }) {
  const [choice, setChoice] = useState(() => pickInitial(product));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const colors = [...new Set(product.variants.map((variant) => variant.color))];
  const options = product.variants.filter((variant) => variant.color === choice.color).sort((a, b) => compareSizes(a.size, b.size));
  const chosen = options.find((variant) => variant.size === choice.size) ?? null;
  const prices = options.filter((variant) => variant.inStock).map((variant) => variant.priceCents);
  const lowest = prices.length ? Math.min(...prices) : (options[0]?.priceCents ?? 0);
  const varied = prices.some((price) => price !== lowest);
  const soldOut = !options.some((variant) => variant.inStock);
  const needsSize = options.length > 1 && !chosen;

  function chooseColor(color: string) {
    const sizes = product.variants.filter((variant) => variant.color === color);
    setChoice({ color, size: sizes.length === 1 && sizes[0]!.inStock ? sizes[0]!.size : null });
    setError(null);
  }

  function add() {
    if (!chosen) {
      setError("Choose a size first.");
      return;
    }
    setError(null);
    start(async () => {
      const result = await addAndReadBag(product.slug, { variantId: chosen.id });
      if ("bag" in result && result.bag) {
        onAdded();
        presentBag({ bag: result.bag, addedId: result.addedId });
      } else {
        setError(result.error ?? "Could not add this piece.");
      }
    });
  }

  return (
    <div className="grid content-start gap-5">
      <div className="grid gap-1.5">
        <p className="text-[13px] text-fg/70">{product.categoryName}</p>
        <h2 id="quick-view-title" className="font-display text-[30px] leading-[1.05] md:text-[38px]">{product.name}</h2>
        <p className="text-base tabular-nums">{soldOut ? "Sold out" : chosen ? money(chosen.priceCents) : `${varied ? "From " : ""}${money(lowest)}`}</p>
      </div>

      {colors.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[13px] text-fg/75">Colour: <span className="text-fg">{choice.color}</span></legend>
          <div className="flex flex-wrap gap-1">
            {colors.map((color) => (
              <button
                key={color}
                type="button"
                aria-pressed={color === choice.color}
                aria-label={color}
                onClick={() => chooseColor(color)}
                className={`grid size-11 place-items-center rounded-full border transition-colors ${color === choice.color ? "border-fg" : "border-transparent hover:border-fg/30"}`}
              >
                <span aria-hidden className="size-8 rounded-full ring-1 ring-inset ring-fg/15" style={{ background: swatchHex(color) }} />
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {options.length > 1 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[13px] text-fg/75">Size{chosen ? `: ${chosen.size}` : ""}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((variant) => (
              <button
                key={variant.id}
                type="button"
                disabled={!variant.inStock}
                aria-pressed={variant.size === choice.size}
                onClick={() => {
                  setChoice({ color: choice.color, size: variant.size });
                  setError(null);
                }}
                className={`flex h-11 min-w-12 items-center justify-center rounded-full border px-4 text-[13px] transition active:scale-[0.96] disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${variant.size === choice.size ? "border-invert-bg bg-invert-bg text-invert-fg" : "border-fg/25 hover:border-fg"}`}
              >
                {variant.size}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {product.description ? <p className="line-clamp-4 text-[14px] leading-relaxed text-fg/80">{product.description}</p> : null}

      <div className="grid gap-3">
        <button
          type="button"
          onClick={add}
          disabled={pending || soldOut}
          aria-describedby={error ? "quick-view-error" : undefined}
          className="inline-flex h-12 items-center justify-center rounded-full bg-invert-bg px-7 text-sm font-medium text-invert-fg transition hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOut ? "Sold out" : pending ? "Adding" : needsSize ? "Choose a size" : `Add to bag, ${money(chosen?.priceCents ?? lowest)}`}
        </button>
        <p id="quick-view-error" role="alert" className="min-h-0 text-[13px] text-danger empty:hidden">{error}</p>
        <Link href={`/product/${product.slug}`} className="group inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[13px] underline underline-offset-4 hover:opacity-60">
          View full details
          <ArrowRight size={13} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function Gallery({ product }: { product: QuickViewProduct }) {
  const rail = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const node = rail.current;
    if (node) setIndex(Math.round(node.scrollLeft / Math.max(node.clientWidth, 1)));
  }

  return (
    <div className="relative min-h-0 overflow-hidden rounded-[22px] bg-surface">
      <div
        ref={rail}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={`${product.name} photos`}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {product.images.map((src, position) => (
          <div key={src} className="relative aspect-[4/5] w-full shrink-0 snap-center md:aspect-auto md:h-full short:aspect-auto short:h-full">
            <Image src={src} alt={position === 0 ? product.name : ""} fill sizes="(min-width: 768px) 460px, 92vw" preload={position === 0} className="object-cover" />
          </div>
        ))}
      </div>
      {product.images.length > 1 ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {product.images.map((src, position) => (
            <span key={src} className={`h-1.5 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.2)] transition-all duration-300 ${position === index ? "w-4 opacity-100" : "w-1.5 opacity-60"}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function QuickViewHost() {
  const reduceMotion = useReducedMotion();
  const wide = useMediaQuery("(min-width: 768px)");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [product, setProduct] = useState<QuickViewProduct | null | undefined>(undefined);
  const offset = useMotionValue(0);
  const scrim = useMotionValue(0);
  const transition = reduceMotion ? INSTANT : SHEET_SPRING;

  useScrollLock(dialog, open);

  const away = () => (wide ? 24 : (dialog.current?.querySelector<HTMLElement>("[data-quick-panel]")?.offsetHeight ?? 600) + 16);

  const requested = useRef<string | null>(null);
  const showRef = useRef<(next: string) => void>(() => {});
  useEffect(() => {
    showRef.current = (next: string) => {
      const node = dialog.current;
      if (!node) return;
      requested.current = next;
      setSlug(next);
      setProduct(undefined);
      prefetchQuickView(next).then((found) => {
        if (requested.current === next) setProduct(found);
      });
      if (!node.open) {
        node.showModal();
        setOpen(true);
        offset.set(wide ? 24 : 480);
        scrim.set(0);
      }
      animate(offset, 0, transition);
      animate(scrim, 1, transition);
    };
  });

  useEffect(() => {
    const opener = (next: string) => showRef.current(next);
    openers.add(opener);
    return () => {
      openers.delete(opener);
    };
  }, []);

  function hide() {
    animate(scrim, 0, transition);
    animate(offset, away(), { ...transition, onComplete: () => dialog.current?.close() });
  }

  function closeNow() {
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="quick-view-title"
      onCancel={(event) => {
        event.preventDefault();
        hide();
      }}
      onClose={() => {
        setOpen(false);
        requested.current = null;
        setSlug(null);
        setProduct(undefined);
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none overflow-hidden border-0 bg-transparent p-0 text-fg"
    >
      <motion.div style={{ opacity: scrim }} onClick={hide} className="absolute inset-0 bg-invert-bg/30" />
      <motion.div
        data-quick-panel
        style={wide ? { y: offset, opacity: scrim } : { y: offset }}
        className="glass-panel absolute inset-x-[max(8px,env(safe-area-inset-left))] bottom-[max(8px,env(safe-area-inset-bottom))] flex max-h-[calc(100dvh-64px)] flex-col overflow-hidden rounded-[28px] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:h-[min(620px,calc(100dvh-48px))] md:w-[min(920px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 short:h-[calc(100dvh-16px)] short:max-h-none"
      >
        <button type="button" aria-label="Close quick view" onClick={hide} className="glass absolute right-3 top-3 z-10 grid size-11 place-items-center rounded-full transition-transform active:scale-[0.94]">
          <X size={18} />
        </button>
        {slug && product ? (
          <div data-scroll className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain p-3 pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:gap-8 md:overflow-hidden md:p-4 short:grid-cols-[minmax(0,42%)_minmax(0,1fr)] short:overflow-hidden">
            <Gallery product={product} />
            <div className="px-2 md:overflow-y-auto md:py-8 md:pr-4 short:overflow-y-auto short:py-4" data-scroll>
              <Details key={product.slug} product={product} onAdded={closeNow} />
            </div>
          </div>
        ) : product === null ? (
          <div className="grid min-h-[240px] content-center justify-items-center gap-3 p-8 text-center">
            <p id="quick-view-title" className="font-display text-2xl">This piece is no longer available</p>
            <button type="button" onClick={hide} className="min-h-11 text-[13px] underline underline-offset-4">Close</button>
          </div>
        ) : (
          <div aria-busy="true" className="grid min-h-0 flex-1 gap-5 p-3 md:grid-cols-[minmax(0,1fr)_380px] md:p-4">
            <span id="quick-view-title" className="sr-only">Loading</span>
            <div className="aspect-[4/5] animate-pulse rounded-[22px] bg-fg/6 md:aspect-auto" />
            <div className="hidden content-start gap-3 py-8 md:grid">
              <div className="h-4 w-24 animate-pulse rounded-full bg-fg/6" />
              <div className="h-10 w-3/4 animate-pulse rounded-full bg-fg/6" />
              <div className="h-4 w-16 animate-pulse rounded-full bg-fg/6" />
            </div>
          </div>
        )}
      </motion.div>
    </dialog>
  );
}
