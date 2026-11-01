"use client";

import { BookmarkSimple, Check, Link as LinkIcon, Receipt, X } from "@phosphor-icons/react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDesignToBag } from "@/lib/actions/cart";
import { saveDesign } from "@/lib/actions/designs";
import { deliveryEstimate, MAKING_NOTE, money, SHIPPING_METHODS, type ShippingMethod } from "@/lib/format";
import { describeDesign, quoteDesign } from "@/lib/studio/pricing";
import { designSpecSchema } from "@/lib/studio/spec";
import { Issue, PRESS, SECONDARY, SPRING } from "./controls";
import { captureBridge, useStudio } from "./store";

type Status = { tone: "info" | "error"; message: string } | null;
type Busy = "save" | "bag" | "share" | null;

function capturePreview() {
  try {
    return captureBridge.current?.() ?? null;
  } catch {
    return null;
  }
}

export function useDesignActions(blocked: string | null, onSaved: () => void) {
  const spec = useStudio((state) => state.spec);
  const designId = useStudio((state) => state.designId);
  const savedJson = useStudio((state) => state.savedJson);
  const markSaved = useStudio((state) => state.markSaved);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<Status>(null);
  const [bagged, setBagged] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const quote = useMemo(() => quoteDesign(spec), [spec]);
  const rows = useMemo(() => describeDesign(spec), [spec]);
  const dirty = savedJson !== JSON.stringify(spec);

  const persist = async () => {
    const parsed = designSpecSchema.safeParse(spec);
    if (!parsed.success) {
      setStatus({ tone: "error", message: blocked ?? "Please correct the highlighted choices." });
      return null;
    }
    const result = await saveDesign({ id: designId, spec: parsed.data, preview: capturePreview() });
    if (!result.ok) {
      setStatus({ tone: "error", message: result.error });
      return null;
    }
    markSaved(result.id);
    window.history.replaceState(null, "", `/studio?design=${result.id}`);
    onSaved();
    return result.id;
  };

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setBusy(kind);
    setStatus(null);
    setBagged(false);
    try {
      await action();
    } catch {
      setStatus({ tone: "error", message: "We could not reach the atelier. Please try again." });
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run("save", async () => {
      const id = await persist();
      if (!id) return;
      setShareUrl(`${window.location.origin}/studio?design=${id}`);
      setStatus({ tone: "info", message: "Saved to your designs." });
    });

  const addToBag = () =>
    run("bag", async () => {
      const id = await persist();
      if (!id) return;
      const result = await addDesignToBag(id);
      if ("error" in result && result.error) {
        setStatus({ tone: "error", message: result.error });
        return;
      }
      setBagged(true);
    });

  const share = () =>
    run("share", async () => {
      const id = dirty || !designId ? await persist() : designId;
      if (!id) return;
      const url = `${window.location.origin}/studio?design=${id}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setStatus({ tone: "info", message: "Link copied." });
      } catch {
        setStatus({ tone: "info", message: "Your link is ready below." });
      }
    });

  const dismiss = () => {
    setStatus(null);
    setBagged(false);
    setShareUrl(null);
  };

  return { spec, quote, rows, dirty, designId, busy, status, bagged, shareUrl, save, addToBag, share, dismiss };
}

export type DesignActions = ReturnType<typeof useDesignActions>;

const priceText = (cents: number) => money(Math.round(cents / 100) * 100);

function Price({ cents, className = "" }: { cents: number; className?: string }) {
  const reduced = useReducedMotion();
  const value = useMotionValue(cents);
  const text = useTransform(value, priceText);
  useEffect(() => {
    if (reduced) {
      value.jump(cents);
      return;
    }
    const controls = animate(value, cents, { type: "spring", bounce: 0, visualDuration: 0.5 });
    return () => controls.stop();
  }, [cents, reduced, value]);
  return (
    <>
      <motion.span aria-hidden data-testid="studio-price" className={`tabular-nums ${className}`}>{text}</motion.span>
      <span role="status" className="sr-only">Price {money(cents)}</span>
    </>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!area.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return { open, setOpen, area };
}

function Breakdown({ actions, onClose }: { actions: DesignActions; onClose: () => void }) {
  const { quote, rows } = actions;
  return (
    <motion.div
      role="dialog"
      aria-label="Price breakdown"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={SPRING}
      style={{ transformOrigin: "bottom center" }}
      className="glass-panel absolute bottom-[calc(100%+8px)] left-0 right-0 z-10 max-h-[min(60dvh,520px)] overflow-y-auto overscroll-contain rounded-[28px] bg-bg/90 p-5 text-[13px]"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-display text-[19px]">Price breakdown</h3>
        <motion.button type="button" aria-label="Close price breakdown" whileTap={{ scale: 0.92 }} transition={PRESS} onClick={onClose} className="-mr-2 grid h-11 w-11 place-items-center rounded-full hover:bg-fg/10">
          <X size={16} />
        </motion.button>
      </div>
      <dl className="mt-2 grid gap-1.5">
        {quote.lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className={SECONDARY}>{line.label}</dt>
            <dd className="tabular-nums">{money(line.cents)}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-4 border-t border-fg/15 pt-2 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">{money(quote.totalCents)}</dd>
        </div>
      </dl>
      <h3 className="mt-5 font-display text-[19px]">Delivery</h3>
      <p className={`mt-2 leading-snug ${SECONDARY}`}>{MAKING_NOTE}</p>
      <dl className="mt-2 grid gap-1.5">
        {(Object.keys(SHIPPING_METHODS) as ShippingMethod[]).map((method) => (
          <div key={method} className="flex justify-between gap-4">
            <dt className={SECONDARY}>{method === "express" ? "Express courier" : "Tracked shipping"}</dt>
            <dd>{deliveryEstimate(method)}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 font-display text-[19px]">Your piece</h3>
      <dl className="mt-2 grid gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[84px_1fr] gap-3">
            <dt className={SECONDARY}>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}

function Notices({ actions, floating = false }: { actions: DesignActions; floating?: boolean }) {
  const { bagged, status, shareUrl, dismiss } = actions;
  const visible = bagged || status || shareUrl;
  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={SPRING}
          className={floating ? "glass-panel absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-[22px] bg-bg/90 p-3 text-[13px]" : "text-[13px]"}
        >
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 gap-1.5">
              {bagged ? (
                <p role="status" className="flex items-center gap-1.5">
                  <Check size={14} weight="bold" />
                  In your bag. <Link href="/bag" className="font-medium underline underline-offset-4">View bag</Link>
                </p>
              ) : null}
              {status ? <p role={status.tone === "error" ? "alert" : "status"} className={status.tone === "error" ? "text-danger" : SECONDARY}>{status.message}</p> : null}
              {shareUrl ? (
                <input
                  readOnly
                  aria-label="Link to this design"
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-11 w-full rounded-full border border-fg/15 bg-bg/70 px-4 text-[13px] text-fg focus:border-invert-bg focus:outline-none"
                />
              ) : null}
            </div>
            <button type="button" aria-label="Dismiss" onClick={dismiss} className="-m-1 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-fg/10">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function NameField({ error, className = "" }: { error?: string; className?: string }) {
  const name = useStudio((state) => state.spec.name);
  const change = useStudio((state) => state.change);
  return (
    <>
      <input
        aria-label="Design name"
        value={name}
        aria-invalid={Boolean(error)}
        onChange={(event) => change((spec) => ({ ...spec, name: event.target.value }), "name")}
        className={`min-w-0 flex-1 rounded-[10px] bg-transparent font-display text-fg outline-offset-2 hover:bg-fg/[0.05] focus:bg-fg/[0.05] ${className}`}
      />
      <Issue message={error} />
    </>
  );
}

const ICON_ACTION = "grid h-11 w-11 shrink-0 place-items-center rounded-full border border-fg/15 text-fg transition-colors duration-200 hover:bg-fg/10 disabled:opacity-40";

function ActionIcons({ actions, onDetails, detailsOpen }: { actions: DesignActions; onDetails: () => void; detailsOpen: boolean }) {
  const { busy, dirty, designId, save, share } = actions;
  const saved = !dirty && Boolean(designId);
  return (
    <>
      <motion.button
        type="button"
        aria-label={saved ? "Saved" : busy === "save" ? "Saving" : "Save"}
        title={saved ? "Saved" : "Save"}
        disabled={busy !== null}
        whileTap={{ scale: 0.92 }}
        transition={PRESS}
        onClick={save}
        className={ICON_ACTION}
      >
        <BookmarkSimple size={18} weight={saved ? "fill" : "regular"} />
      </motion.button>
      <motion.button
        type="button"
        aria-label={busy === "share" ? "Saving" : "Share"}
        title="Share"
        disabled={busy !== null}
        whileTap={{ scale: 0.92 }}
        transition={PRESS}
        onClick={share}
        className={ICON_ACTION}
      >
        <LinkIcon size={18} />
      </motion.button>
      <motion.button
        type="button"
        aria-label="Price breakdown"
        aria-expanded={detailsOpen}
        title="Price breakdown"
        whileTap={{ scale: 0.92 }}
        transition={PRESS}
        onClick={onDetails}
        className={ICON_ACTION}
      >
        <Receipt size={18} />
      </motion.button>
    </>
  );
}

export function SummaryCard({ actions, nameError }: { actions: DesignActions; nameError?: string }) {
  const { open, setOpen, area } = usePopover();
  const { quote, spec, busy, addToBag } = actions;
  return (
    <div ref={area} className="relative">
      <AnimatePresence>{open ? <Breakdown actions={actions} onClose={() => setOpen(false)} /> : null}</AnimatePresence>
      <div className="glass-panel grid gap-3 rounded-[28px] p-4">
        <div className="flex items-center gap-2">
          <NameField error={nameError} className="-mx-1 h-9 px-1 text-[21px] leading-tight" />
        </div>
        <div className="flex items-end justify-between gap-4">
          <p className="font-display text-[30px] leading-none"><Price cents={quote.totalCents} /></p>
          <p className={`text-right text-[13px] leading-snug ${SECONDARY}`}>
            {deliveryEstimate("standard")}
            <span className="block tabular-nums">{spec.form.width} × {spec.form.height} × {spec.form.depth} mm</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            disabled={busy !== null}
            whileTap={{ scale: 0.97 }}
            transition={PRESS}
            onClick={addToBag}
            className="h-12 min-w-0 flex-1 rounded-full bg-invert-bg px-4 text-sm font-medium text-invert-fg transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
          >
            {busy === "bag" ? "Adding" : "Add to bag"}
          </motion.button>
          <ActionIcons actions={actions} detailsOpen={open} onDetails={() => setOpen(!open)} />
        </div>
        <Notices actions={actions} />
      </div>
    </div>
  );
}

export function SheetSummary({ actions, nameError }: { actions: DesignActions; nameError?: string }) {
  const { open, setOpen, area } = usePopover();
  return (
    <div ref={area} className="relative">
      <AnimatePresence>{open ? <Breakdown actions={actions} onClose={() => setOpen(false)} /> : null}</AnimatePresence>
      <div className="flex items-center gap-1.5 px-4">
        <div className="-mt-1 grid min-w-0 flex-1">
          <NameField error={nameError} className="-mx-1 h-11 px-1 text-[19px] leading-tight" />
          <p className={`-mt-1.5 truncate text-[13px] leading-tight ${SECONDARY}`}>{deliveryEstimate("standard")}</p>
        </div>
        <ActionIcons actions={actions} detailsOpen={open} onDetails={() => setOpen(!open)} />
      </div>
    </div>
  );
}

export function BagBar({ actions }: { actions: DesignActions }) {
  const { quote, busy, addToBag } = actions;
  return (
    <div className="relative">
      <Notices actions={actions} floating />
      <motion.button
        type="button"
        disabled={busy !== null}
        whileTap={{ scale: 0.98 }}
        transition={PRESS}
        onClick={addToBag}
        className="flex h-12 w-full items-center justify-between gap-4 rounded-full bg-invert-bg px-5 text-[15px] font-medium text-invert-fg disabled:opacity-40"
      >
        <span>{busy === "bag" ? "Adding" : "Add to bag"}</span>
        <span className="font-display text-[19px] leading-none"><Price cents={quote.totalCents} /></span>
      </motion.button>
    </div>
  );
}
