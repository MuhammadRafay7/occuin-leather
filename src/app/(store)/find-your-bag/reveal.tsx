"use client";

import { ArrowCounterClockwise, ArrowRight, Check, Info, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Component, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { presentBag } from "@/components/bag-drawer";
import { captureBridge } from "@/components/studio/store";
import { useWebgl } from "@/components/studio/viewport";
import { whatsappChatUrl } from "@/lib/bespoke/whatsapp";
import { deliveryEstimate, makingTime, money, type Delivery } from "@/lib/format";
import { fulfilmentOf, leatherLine, rankMatches, studioHref, type Candidate, type CompleteAnswers, type Match, type StepKey } from "@/lib/find-your-bag/match";
import { quoteDesign, type StudioPricing } from "@/lib/studio/pricing";
import { COLORS } from "@/lib/studio/spec";
import { addMatchToBag } from "./actions";
import { Leather, STEP_SPRING } from "./swatch";

const Scene = dynamic(() => import("@/components/studio/scene"), { ssr: false });

const PURPOSE_LABEL = { work: "Work", everyday: "Every day", travel: "Travel", evening: "Evening", gift: "Gift" } as const;
const LOAD_LABEL = { laptop: "Laptop", essentials: "Essentials", lots: "A lot" } as const;
const CARRY_LABEL = { hand: "In the hand", shoulder: "On the shoulder", crossbody: "Across the body", any: "Any way" } as const;

class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = {
  answers: CompleteAnswers;
  candidates: Candidate[];
  pricing: StudioPricing;
  delivery: Delivery;
  whatsapp: string | null;
  paused: string | null;
  onEdit: (step: StepKey) => void;
  onRestart: () => void;
};

export function Reveal({ answers, candidates, pricing, delivery, whatsapp, paused, onEdit, onRestart }: Props) {
  const matches = useMemo(() => rankMatches(candidates, answers), [candidates, answers]);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const match = matches.find((item) => item.candidate.id === chosenId) ?? matches[0];

  if (!match) {
    return (
      <div className="grid min-h-[60svh] place-items-center text-center">
        <div className="grid max-w-[40ch] justify-items-center gap-4">
          <h2 data-step-heading tabIndex={-1} style={{ outline: "none" }} className="font-display text-5xl outline-none">Nothing to show yet</h2>
          <p className="text-[#f4efe6]/75">The collection is being updated. You can still design a bag from a blank pattern in the studio.</p>
          <Link href="/studio" className="flex h-12 items-center rounded-full bg-[#f4efe6] px-7 text-sm font-medium text-invert-bg">Open the studio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-6 short:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Stage match={match} answers={answers} matches={matches} onPick={setChosenId} />
      <Panel key={match.candidate.id} match={match} answers={answers} pricing={pricing} delivery={delivery} whatsapp={whatsapp} paused={paused} onEdit={onEdit} onRestart={onRestart} />
    </div>
  );
}

function Stage({ match, answers, matches, onPick }: { match: Match; answers: CompleteAnswers; matches: Match[]; onPick: (id: string) => void }) {
  const { available, lost } = useWebgl();
  const [ready, setReady] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const plan = fulfilmentOf(match.candidate, answers.color, answers.initials);
  const spec = plan.kind === "made" ? plan.spec : match.candidate.spec;
  const { image, ready: listed } = match.candidate;
  const photoDiffers = listed?.color !== answers.color;

  useEffect(() => {
    const node = area.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid content-start gap-3">
      {matches.length > 1 ? (
        <div role="group" aria-label="Your matches" className="glass-panel mx-auto grid w-full max-w-[460px] grid-cols-2 gap-1 rounded-full p-1 text-fg lg:mx-0">
          {matches.map((item, position) => {
            const active = item.candidate.id === match.candidate.id;
            return (
              <button key={item.candidate.id} type="button" aria-pressed={active} onClick={() => onPick(item.candidate.id)} className="relative flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px]">
                {active ? <motion.span layoutId="match-pill" transition={STEP_SPRING} className="absolute inset-0 rounded-full bg-invert-bg shadow-[0_3px_10px_rgb(23_49_42/0.3)]" /> : null}
                <span className={`relative truncate ${active ? "text-invert-fg" : ""}`}>
                  <span className={active ? "text-invert-fg/70" : "text-fg/60"}>{position === 0 ? (item.exact ? "Best" : "Closest") : "Also"}</span> {item.candidate.name}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div ref={area} className="relative h-[min(42svh,400px)] min-h-[240px] lg:h-[min(calc(100svh-12rem),720px)] short:h-[calc(100svh-7rem)]">
        <AnimatePresence>
          {!ready || available === false ? (
            <motion.div key={`still-${match.candidate.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 grid place-items-center">
              {image ? (
                <figure className="relative h-full w-full">
                  <Image src={image} alt={`${match.candidate.name}, as listed in ${listed?.colorName ?? "its listed leather"}`} fill sizes="(min-width: 1024px) 60vw, 100vw" className={`object-contain drop-shadow-[0_30px_40px_rgb(0_0_0/0.35)] ${available ? "opacity-60 blur-[2px]" : ""}`} />
                  {available === false && photoDiffers ? (
                    <figcaption className="absolute inset-x-0 bottom-2 text-center text-[12px] text-[#f4efe6]/75">Photo shows {listed?.colorName ?? "the listed leather"}. Yours is made in {COLORS[answers.color].name}.</figcaption>
                  ) : null}
                </figure>
              ) : (
                <Leather color={answers.color} finish={spec.panels.primary.finish} className="size-48 rounded-[40px]" />
              )}
              {available ? <p role="status" className="absolute bottom-3 text-[12px] tracking-[0.12em] text-[#f4efe6]/70 uppercase">Preparing the 3D view</p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
        {available ? (
          <SceneBoundary onFail={lost}>
            <div className={`absolute inset-0 touch-pan-y transition duration-500 ease-out ${ready ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}>
              <Scene spec={spec} spin paused={offscreen} onReady={() => setReady(true)} onContextLost={lost} />
            </div>
          </SceneBoundary>
        ) : null}
        {ready ? <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[12px] text-[#f4efe6]/60">Drag to turn it</p> : null}
      </div>
    </div>
  );
}

function capturePreview() {
  try {
    return captureBridge.current?.() ?? null;
  } catch {
    return null;
  }
}

type PanelProps = Omit<Props, "candidates"> & { match: Match };

function Panel({ match, answers, pricing, delivery, whatsapp, paused, onEdit, onRestart }: PanelProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const added = useRef(false);
  const { candidate, exact, reasons, notes } = match;
  const plan = fulfilmentOf(candidate, answers.color, answers.initials);
  const spec = plan.kind === "made" ? plan.spec : candidate.spec;
  const priceCents = plan.kind === "ready" ? plan.priceCents : quoteDesign(plan.spec, pricing).totalCents;
  const listed = candidate.ready;
  const monogram = spec.monogram.text.trim();

  const add = (then: "bag" | "checkout") =>
    start(async () => {
      setStatus(null);
      if (then === "checkout" && added.current) {
        router.push("/checkout");
        return;
      }
      const result = await addMatchToBag({ candidateId: candidate.id, color: answers.color, initials: answers.initials ?? null, preview: plan.kind === "made" ? capturePreview() : null });
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      added.current = true;
      if (then === "checkout") {
        router.push("/checkout");
        return;
      }
      setStatus({ tone: "info", text: `${candidate.name} is in your bag.` });
      presentBag({ bag: result.bag, addedId: result.addedId });
    });

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${candidate.name} in ${COLORS[answers.color].name}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus({ tone: "info", text: "Link copied." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus({ tone: "info", text: `Your link: ${url}` });
    }
  };

  const link = typeof window === "undefined" ? "" : window.location.href;
  const message = `Hello OCCUIN. My bag match is ${candidate.name} in ${leatherLine(spec)}${monogram ? `, initials ${monogram}` : ""}, ${money(priceCents)}. ${link}`;

  const edits: { step: StepKey; label: string }[] = [
    { step: "purpose", label: PURPOSE_LABEL[answers.purpose] },
    { step: "load", label: LOAD_LABEL[answers.load] },
    { step: "carry", label: CARRY_LABEL[answers.carry] },
    { step: "color", label: COLORS[answers.color].name },
    { step: "initials", label: monogram || "No initials" },
  ];

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={STEP_SPRING}
      aria-labelledby="match-name"
      className="glass relative flex flex-col rounded-[32px] p-5 text-fg sm:p-7 short:max-h-[calc(100svh-6rem)] short:overflow-y-auto"
    >
      <p className="text-[12px] tracking-[0.16em] text-fg/65 uppercase">{exact ? "Your match" : "The closest match"}</p>
      <h2 id="match-name" data-step-heading tabIndex={-1} style={{ outline: "none" }} className="mt-1 font-display text-[44px] leading-[1.02] text-invert-bg outline-none sm:text-[52px]">
        {candidate.name}
      </h2>
      <p className="mt-1 text-[15px] text-fg/80">
        {candidate.type} in {leatherLine(spec)}
        {monogram ? `, with ${monogram} ${spec.monogram.technique === "blind" ? "blind embossed" : spec.monogram.technique === "paint" ? "painted" : `in ${spec.monogram.technique} foil`}` : ""}
      </p>

      <ul className="mt-5 grid gap-2.5">
        {reasons.map((reason) => (
          <li key={reason} className="flex gap-3 text-[14px] leading-snug">
            <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-invert-bg text-invert-fg">
              <Check size={11} weight="bold" />
            </span>
            {reason}
          </li>
        ))}
      </ul>

      {notes.length || !exact ? (
        <div className="mt-4 grid gap-1.5 rounded-[18px] bg-fg/[0.05] p-3.5 text-[13px] leading-snug text-fg/80">
          <p className="flex items-center gap-1.5 font-medium text-fg"><Info size={16} aria-hidden />Worth knowing</p>
          {notes.map((note) => <p key={note}>{note}</p>)}
          {!exact ? <p>Nothing in the collection fits every answer, so this is the closest. In the studio you can change its size, straps and closure.</p> : null}
        </div>
      ) : null}

      <div className="mt-6 flex items-end justify-between gap-3 border-t border-fg/10 pt-5">
        <div>
          <p className="text-[30px] leading-none tabular-nums">{money(priceCents)}</p>
          <p className="mt-1.5 text-[12px] text-fg/70">{plan.kind === "ready" ? "As listed" : "Made in your leather from our pattern"}</p>
        </div>
        {plan.kind === "made" && listed ? (
          <Link href={`/product/${candidate.slug}`} className="text-right text-[12px] leading-snug text-fg/70 underline underline-offset-4 hover:text-fg">
            As listed in {listed.colorName}
            <br />
            {money(listed.priceCents)}
          </Link>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-fg/75">
        Made after you order, in {makingTime(delivery)}. {deliveryEstimate("standard", delivery)} with tracked shipping.
      </p>

      {paused ? <p className="mt-3 rounded-[14px] bg-danger/10 p-3 text-[13px] text-danger">{paused}</p> : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => add("checkout")} disabled={pending || Boolean(paused)} className="h-12 rounded-full bg-invert-bg text-sm font-medium text-invert-fg transition hover:opacity-90 active:scale-[0.97] disabled:opacity-40">
          Buy now
        </button>
        <button type="button" onClick={() => add("bag")} disabled={pending || Boolean(paused)} className="h-12 rounded-full border border-fg text-sm font-medium transition hover:bg-invert-bg hover:text-invert-fg active:scale-[0.97] disabled:opacity-40">
          {pending ? "Adding" : "Add to bag"}
        </button>
        <Link href={studioHref(candidate, answers.color, answers.initials)} className="col-span-2 flex h-12 items-center justify-center gap-2 rounded-full bg-white/60 text-sm font-medium transition hover:bg-white active:scale-[0.97]">
          Make it mine in the studio
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <p aria-live="polite" className={`min-h-5 pt-2 text-[13px] ${status?.tone === "error" ? "text-danger" : "text-fg/75"}`}>{status?.text ?? ""}</p>

      <div className="grid gap-3 pt-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Change an answer">
          {edits.map((item) => (
            <button key={item.step} type="button" onClick={() => onEdit(item.step)} className="flex h-9 items-center rounded-full border border-fg/12 bg-white/40 px-3 text-[12px] transition hover:border-fg/40">
              <span className="sr-only">Change </span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          {whatsapp ? (
            <a href={whatsappChatUrl(whatsapp, message)} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 hover:opacity-70">
              <WhatsappLogo size={18} aria-hidden />
              Send my match to WhatsApp
            </a>
          ) : null}
          <button type="button" onClick={share} className="flex h-11 items-center gap-1.5 hover:opacity-70">
            <ShareNetwork size={18} aria-hidden />
            Share
          </button>
          <button type="button" onClick={onRestart} className="flex h-11 items-center gap-1.5 hover:opacity-70">
            <ArrowCounterClockwise size={18} aria-hidden />
            Start again
          </button>
        </div>
      </div>
    </motion.article>
  );
}
