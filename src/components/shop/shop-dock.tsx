"use client";

import { Check, Faders, SortAscending, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { useFloatingClearance, useFocusTrap, useIsoLayoutEffect, useScrollLock } from "@/components/glass/hooks";
import { INSTANT, SHEET_SPRING } from "@/components/glass/motion";
import { Button } from "@/components/ui";
import { PRICE_RANGES, SORTS, activeFilterCount, shopHref, toggled, type ShopState } from "@/lib/shop-params";
import { swatchHex } from "./swatches";

type Props = { path: string; state: ShopState; colors: string[]; sizes: string[]; resultCount: number };
type Panel = "filter" | "sort";

const BAR_HEIGHT = 56;
const SHEET_WIDTH = 460;
const SIDE_GAP = 8;
const TOP_GAP = 88;
const DOCK_BUTTON = "flex h-11 items-center gap-2 rounded-full px-4 text-[13px] text-fg transition hover:bg-fg/5 active:scale-[0.96]";
const PILL = "flex h-11 items-center justify-center rounded-full border px-4 text-[13px] transition active:scale-[0.96] lg:h-10";
const CHOSEN = "border-invert-bg bg-invert-bg text-invert-fg";
const OPEN = "border-fg/25 text-fg hover:border-fg";

const pieces = (count: number) => `${count} ${count === 1 ? "piece" : "pieces"}`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-[13px] text-fg/75">{title}</h3>
      {children}
    </section>
  );
}

export function ShopDock({ path, state, colors, sizes, resultCount }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion ? INSTANT : SHEET_SPRING;
  const shell = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [barWidth, setBarWidth] = useState(300);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [shown, setShown] = useOptimistic(state);
  const [pending, startNavigation] = useTransition();
  const { nearFooter, lift } = useFloatingClearance(shell);
  const active = activeFilterCount(shown);

  const close = useCallback(() => {
    setPanel(null);
    const grid = document.querySelector("[data-shop-grid]");
    if (grid && grid.getBoundingClientRect().bottom < window.innerHeight / 2) grid.scrollIntoView({ behavior: "auto" });
  }, []);
  useFocusTrap(sheet, panel !== null, close);
  useScrollLock(shell, panel !== null);

  function showResults() {
    setPanel(null);
    const grid = document.querySelector("[data-shop-grid]");
    if (grid && grid.getBoundingClientRect().top < 0) grid.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }

  useIsoLayoutEffect(() => {
    const node = bar.current;
    if (!node) return;
    const measure = () => setBarWidth(node.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useIsoLayoutEffect(() => {
    const measure = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useIsoLayoutEffect(() => {
    if (panel && sheet.current) setSheetHeight(sheet.current.scrollHeight);
  }, [panel, viewport]);

  useEffect(() => {
    if (!panel) return;
    const outside = (event: PointerEvent) => {
      if (!shell.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [panel, close]);

  function apply(event: MouseEvent<HTMLAnchorElement>, patch: Partial<ShopState>, thenClose = false) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = shopHref(path, shown, patch);
    startNavigation(() => {
      setShown({ ...shown, page: 1, ...patch });
      router.push(href, { scroll: false });
    });
    if (thenClose) showResults();
  }

  const sheetWidth = Math.min(SHEET_WIDTH, viewport.width - SIDE_GAP * 2);
  const maxHeight = viewport.height - TOP_GAP - SIDE_GAP;
  const open = panel !== null;
  const clearAll = { colors: [], sizes: [], min: undefined, max: undefined };

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            data-dock-scrim
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="fixed inset-0 z-[24] bg-invert-bg/15"
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        ref={shell}
        data-dock
        initial={false}
        animate={{
          width: open ? sheetWidth : barWidth,
          height: open ? Math.min(sheetHeight || BAR_HEIGHT, maxHeight) : BAR_HEIGHT,
          y: open ? 0 : nearFooter ? 120 : -lift,
          opacity: !open && nearFooter ? 0 : 1,
        }}
        transition={transition}
        style={{ width: barWidth, height: BAR_HEIGHT }}
        inert={!open && nearFooter}
        className="glass-panel fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[25] mx-auto overflow-hidden rounded-[28px]"
      >
        <p className="sr-only" aria-live="polite">{pieces(resultCount)}</p>

        <motion.div
          ref={bar}
          inert={open}
          initial={false}
          animate={{ opacity: open ? 0 : 1 }}
          transition={transition}
          className="absolute bottom-0 left-1/2 flex h-14 w-max -translate-x-1/2 items-center gap-0.5 px-1.5"
        >
          <p className="px-3 text-[13px] tabular-nums text-fg">{pieces(resultCount)}</p>
          <span aria-hidden className="h-5 w-px bg-fg/15" />
          <button type="button" aria-expanded={panel === "filter"} aria-haspopup="dialog" onClick={() => setPanel("filter")} className={DOCK_BUTTON}>
            <Faders size={18} aria-hidden />
            Filter
            {active ? <span className="grid size-5 place-items-center rounded-full bg-invert-bg text-[11px] text-invert-fg">{active}</span> : null}
          </button>
          <button type="button" aria-expanded={panel === "sort"} aria-haspopup="dialog" onClick={() => setPanel("sort")} className={DOCK_BUTTON}>
            <SortAscending size={18} aria-hidden />
            Sort
          </button>
        </motion.div>

        <AnimatePresence>
          {panel ? (
            <motion.div
              key={panel}
              ref={sheet}
              role="dialog"
              aria-modal="true"
              aria-label={panel === "filter" ? "Filter" : "Sort"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={reduceMotion ? INSTANT : { duration: 0.18, delay: 0.05 }}
              style={{ width: sheetWidth, maxHeight }}
              className="absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col"
            >
              <div className="flex h-14 shrink-0 items-center justify-between pl-5 pr-2">
                <h2 className="font-display text-2xl">{panel === "filter" ? "Filter" : "Sort"}</h2>
                <button type="button" aria-label="Close" onClick={close} className="grid size-11 place-items-center rounded-full text-fg transition hover:bg-fg/5 active:scale-[0.94]">
                  <X size={20} />
                </button>
              </div>

              {panel === "filter" ? (
                <>
                  <div data-scroll className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">
                    {colors.length > 1 ? (
                      <Group title="Colour">
                        <div className="grid grid-cols-5 gap-x-0.5 gap-y-3">
                          {colors.map((color) => {
                            const chosen = shown.colors.includes(color);
                            return (
                              <Link
                                key={color}
                                href={shopHref(path, shown, { colors: toggled(shown.colors, color) })}
                                scroll={false}
                                aria-current={chosen ? "true" : undefined}
                                onClick={(event) => apply(event, { colors: toggled(shown.colors, color) })}
                                className="grid justify-items-center gap-1.5 rounded-[12px] py-1 text-xs text-fg transition active:scale-[0.96]"
                              >
                                <span className={`grid size-11 place-items-center rounded-full border transition-colors ${chosen ? "border-fg" : "border-transparent"}`}>
                                  <span
                                    aria-hidden
                                    className="grid size-9 place-items-center rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.35),inset_0_-1px_2px_rgb(0_0_0/0.2)] ring-1 ring-inset ring-fg/15"
                                    style={{ background: swatchHex(color) }}
                                  >
                                    {chosen ? <Check size={14} weight="bold" className="text-white mix-blend-difference" /> : null}
                                  </span>
                                </span>
                                {color}
                              </Link>
                            );
                          })}
                        </div>
                      </Group>
                    ) : null}

                    {sizes.length > 1 ? (
                      <Group title="Size">
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((size) => {
                            const chosen = shown.sizes.includes(size);
                            return (
                              <Link
                                key={size}
                                href={shopHref(path, shown, { sizes: toggled(shown.sizes, size) })}
                                scroll={false}
                                aria-current={chosen ? "true" : undefined}
                                onClick={(event) => apply(event, { sizes: toggled(shown.sizes, size) })}
                                className={`${PILL} ${chosen ? CHOSEN : OPEN}`}
                              >
                                {size}
                              </Link>
                            );
                          })}
                        </div>
                      </Group>
                    ) : null}

                    <Group title="Price">
                      <div className="flex flex-wrap gap-2">
                        {PRICE_RANGES.map((range) => {
                          const chosen = shown.min === range.min && shown.max === range.max;
                          const patch = chosen ? { min: undefined, max: undefined } : { min: range.min, max: range.max };
                          return (
                            <Link
                              key={range.label}
                              href={shopHref(path, shown, patch)}
                              scroll={false}
                              aria-current={chosen ? "true" : undefined}
                              onClick={(event) => apply(event, patch)}
                              className={`${PILL} ${chosen ? CHOSEN : OPEN}`}
                            >
                              {range.label}
                            </Link>
                          );
                        })}
                      </div>
                    </Group>
                  </div>

                  <div className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-4 border-t border-fg/10 p-3 pl-5">
                    <Link
                      href={shopHref(path, shown, clearAll)}
                      scroll={false}
                      aria-disabled={active === 0}
                      tabIndex={active === 0 ? -1 : undefined}
                      onClick={(event) => apply(event, clearAll)}
                      className={`flex min-h-11 items-center text-[13px] underline underline-offset-4 lg:block lg:min-h-0 ${active === 0 ? "pointer-events-none opacity-40" : "hover:opacity-60"}`}
                    >
                      Clear all
                    </Link>
                    <Button type="button" onClick={showResults} aria-busy={pending}>Show {pieces(resultCount)}</Button>
                  </div>
                </>
              ) : (
                <div className="grid gap-2 px-3 pb-3">
                  {SORTS.map((option) => {
                    const chosen = shown.sort === option.value;
                    return (
                      <Link
                        key={option.value}
                        href={shopHref(path, shown, { sort: option.value })}
                        scroll={false}
                        aria-current={chosen ? "true" : undefined}
                        onClick={(event) => apply(event, { sort: option.value }, true)}
                        className={`flex h-12 items-center justify-between rounded-full px-5 text-sm transition active:scale-[0.98] ${chosen ? "bg-invert-bg text-invert-fg" : "text-fg hover:bg-fg/5"}`}
                      >
                        {option.label}
                        {chosen ? <Check size={16} aria-hidden /> : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
