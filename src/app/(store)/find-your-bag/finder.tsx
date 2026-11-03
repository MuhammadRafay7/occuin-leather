"use client";

import { AirplaneTilt, Briefcase, CaretLeft, Champagne, Check, Gift, Infinity as AnyWay, Key, Laptop, Package, Sun, type Icon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { money, type Delivery } from "@/lib/format";
import { isComplete, parseHash, STEPS, toHash, type Answers, type Candidate, type Carry, type Load, type Purpose, type StepKey } from "@/lib/find-your-bag/match";
import type { StudioPricing } from "@/lib/studio/pricing";
import { COLORS, type ColorKey } from "@/lib/studio/spec";
import { Reveal } from "./reveal";
import { isLightLeather, Leather, STEP_SPRING } from "./swatch";

const HASH_EVENT = "find-your-bag:hash";
const ADVANCE_MS = 260;
const INSTANT = { duration: 0 } as const;

const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  window.addEventListener(HASH_EVENT, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(HASH_EVENT, callback);
  };
};
const readHash = () => window.location.hash;
const serverHash = () => "";

export function navigate(answers: Answers, step: StepKey, mode: "push" | "replace" = "push") {
  const next = toHash(answers, step);
  if (mode === "push" && next !== window.location.hash) {
    window.history.pushState(window.history.state, "", next);
  } else {
    window.history.replaceState(window.history.state, "", next);
  }
  window.dispatchEvent(new Event(HASH_EVENT));
}

type Option<T extends string> = { value: T; label: string; hint: string; icon: Icon | (() => ReactNode) };

const PURPOSE_OPTIONS: Option<Purpose>[] = [
  { value: "work", label: "Work", hint: "Meetings, a laptop, papers", icon: Briefcase },
  { value: "everyday", label: "Every day", hint: "Out of the door, most days", icon: Sun },
  { value: "travel", label: "Travel", hint: "A weekend away, or a long day out", icon: AirplaneTilt },
  { value: "evening", label: "An evening out", hint: "Dinner, a wedding, a night out", icon: Champagne },
  { value: "gift", label: "A gift", hint: "For someone else", icon: Gift },
];

const LOAD_OPTIONS: Option<Load>[] = [
  { value: "laptop", label: "A laptop", hint: "14 or 15 inches, and a few papers", icon: Laptop },
  { value: "essentials", label: "Just the essentials", hint: "Phone, keys, cards", icon: Key },
  { value: "lots", label: "A lot", hint: "The whole day in one bag", icon: Package },
];

const strokes = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const HandIcon = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden {...strokes}>
    <path d="M12 13v-2.5a4 4 0 0 1 8 0V13" />
    <path d="M7.5 13h17l-1.4 12.2a2 2 0 0 1-2 1.8H10.9a2 2 0 0 1-2-1.8z" />
  </svg>
);
const ShoulderIcon = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden {...strokes}>
    <path d="M4 10.5c3-3.5 7-5 12-5s9 1.5 12 5" opacity="0.4" />
    <path d="M11 7v12M21 7v12" />
    <rect x="8" y="18.5" width="16" height="9.5" rx="2.5" />
  </svg>
);
const CrossIcon = () => (
  <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden {...strokes}>
    <circle cx="16" cy="5.5" r="3" opacity="0.4" />
    <path d="M9 12c2-2 4.5-3 7-3s5 1 7 3v15H9z" opacity="0.4" />
    <path d="M22 10 11.5 22" />
    <rect x="7" y="20.5" width="9.5" height="7" rx="2.5" />
  </svg>
);

const CARRY_OPTIONS: Option<Carry>[] = [
  { value: "hand", label: "In the hand", hint: "By a top handle", icon: HandIcon },
  { value: "shoulder", label: "On the shoulder", hint: "A strap or long handles", icon: ShoulderIcon },
  { value: "crossbody", label: "Across the body", hint: "Hands free", icon: CrossIcon },
  { value: "any", label: "No preference", hint: "Show me the best fit", icon: AnyWay },
];

const LEATHERS = Object.keys(COLORS) as ColorKey[];

function copyFor(step: (typeof STEPS)[number], gift: boolean, pricing: StudioPricing) {
  switch (step) {
    case "purpose":
      return { title: "What is it for?", hint: "Pick the one that matters most." };
    case "load":
      return { title: gift ? "What will they carry?" : "What will you carry?", hint: "This decides the size." };
    case "carry":
      return { title: gift ? "How do they like to carry it?" : "How do you like to carry it?", hint: "Handles, strap, or both." };
    case "color":
      return { title: "Choose the leather.", hint: "We cut every piece to order, so any of these is yours to choose." };
    case "initials":
      return { title: "Add initials?", hint: `Optional. Up to three letters in foil to match the hardware, for ${money(pricing.foilMonogramCents)}.` };
  }
}

type Props = { candidates: Candidate[]; pricing: StudioPricing; delivery: Delivery; whatsapp: string | null; paused: string | null };

export function Finder({ candidates, pricing, delivery, whatsapp, paused }: Props) {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const { answers, step } = useMemo(() => parseHash(hash), [hash]);
  const reduced = useReducedMotion();
  const [trail, setTrail] = useState({ step, direction: 1 });
  const [announcement, setAnnouncement] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);

  const order = (key: StepKey) => (key === "result" ? STEPS.length : STEPS.indexOf(key));
  if (trail.step !== step) setTrail({ step, direction: order(step) >= order(trail.step) ? 1 : -1 });

  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const frame = requestAnimationFrame(() => [...(stage.current?.querySelectorAll<HTMLElement>("[data-step-heading]") ?? [])].at(-1)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (step === "color" || step === "initials" || step === "result") void import("@/components/studio/scene");
  }, [step]);

  const index = order(step);
  const gift = answers.purpose === "gift";
  const back = () => navigate(answers, index > 0 ? STEPS[index - 1]! : "purpose");

  const choose = <K extends keyof Answers>(key: K, value: NonNullable<Answers[K]>, label: string) => {
    const nextAnswers = { ...answers, [key]: value };
    const next = STEPS[index + 1] ?? "result";
    setAnnouncement(`${label} chosen.`);
    navigate(nextAnswers, step, "replace");
    window.setTimeout(() => navigate(nextAnswers, next), reduced ? 0 : ADVANCE_MS);
  };

  const motionProps = {
    custom: trail.direction,
    initial: "enter",
    animate: "center",
    exit: "leave",
    variants: {
      enter: (direction: number) => ({ opacity: 0, x: reduced ? 0 : direction * 48, filter: reduced ? "none" : "blur(6px)" }),
      center: { opacity: 1, x: 0, filter: "blur(0px)" },
      leave: (direction: number) => ({ opacity: 0, x: reduced ? 0 : direction * -48, filter: reduced ? "none" : "blur(6px)" }),
    },
    transition: reduced ? INSTANT : STEP_SPRING,
  };

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(110%_80%_at_50%_30%,#3b5a50_0%,#20403a_48%,#0f211d_100%)] text-[#f4efe6]">
      <div ref={stage} className="px-page relative mx-auto min-h-[100svh] max-w-[1240px] pb-[max(2rem,env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] md:pt-[calc(6rem+env(safe-area-inset-top))]">
        <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
        <AnimatePresence mode="popLayout" initial={false} custom={trail.direction}>
          {step === "result" && isComplete(answers) ? (
            <motion.div key="result" {...motionProps}>
              <Reveal
                answers={answers}
                candidates={candidates}
                pricing={pricing}
                delivery={delivery}
                whatsapp={whatsapp}
                paused={paused}
                onEdit={(target) => navigate(answers, target)}
                onRestart={() => navigate({}, "purpose")}
              />
            </motion.div>
          ) : (
            <motion.div key={step} {...motionProps} className="grid gap-6 lg:min-h-[calc(100svh-10rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)] lg:items-center lg:gap-16 short:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] short:items-start short:gap-6">
              <Question step={step as (typeof STEPS)[number]} index={index} gift={gift} pricing={pricing} onBack={back} />
              <div className="glass-panel rounded-[30px] p-2 text-fg sm:p-3">
                {step === "purpose" ? <Choices options={PURPOSE_OPTIONS} current={answers.purpose} onChoose={(option) => choose("purpose", option.value, option.label)} /> : null}
                {step === "load" ? <Choices options={LOAD_OPTIONS} current={answers.load} onChoose={(option) => choose("load", option.value, option.label)} /> : null}
                {step === "carry" ? <Choices options={CARRY_OPTIONS} current={answers.carry} onChoose={(option) => choose("carry", option.value, option.label)} /> : null}
                {step === "color" ? <Leathers current={answers.color} onChoose={(color) => choose("color", color, COLORS[color].name)} /> : null}
                {step === "initials" ? <Initials answers={answers} /> : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {STEPS.map((key, position) => (
          <span key={key} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/18">
            <motion.span initial={false} animate={{ scaleX: position <= index ? 1 : 0 }} transition={STEP_SPRING} className="absolute inset-0 origin-left rounded-full bg-[#f4efe6]" />
          </span>
        ))}
      </div>
      <p className="shrink-0 text-[12px] tabular-nums text-[#f4efe6]/75">
        <span className="sr-only">Question </span>
        {Math.min(index + 1, STEPS.length)} of {STEPS.length}
      </p>
    </div>
  );
}

function Question({ step, index, gift, pricing, onBack }: { step: (typeof STEPS)[number]; index: number; gift: boolean; pricing: StudioPricing; onBack: () => void }) {
  const copy = copyFor(step, gift, pricing);
  return (
    <div className="grid gap-5 lg:gap-8 short:gap-3">
      <div className="flex items-center gap-2">
        {index > 0 ? (
          <button type="button" onClick={onBack} className="-ml-2 flex h-11 items-center gap-1 rounded-full pl-1.5 pr-3 text-[13px] text-[#f4efe6]/85 transition hover:bg-white/10 active:scale-[0.96]">
            <CaretLeft size={18} aria-hidden />
            Back
          </button>
        ) : (
          <h1 className="text-[13px] tracking-[0.18em] text-[#f4efe6]/75 uppercase">Find your bag</h1>
        )}
        <div className="ml-auto w-[min(56%,260px)]">
          <Progress index={index} />
        </div>
      </div>
      <div className="grid gap-3">
        <h2 data-step-heading tabIndex={-1} style={{ outline: "none" }} className="font-display text-[clamp(2.6rem,11vw,5.6rem)] leading-[0.98] tracking-[-0.01em] outline-none short:text-[2.4rem]">
          {copy.title}
        </h2>
        <p className="max-w-[40ch] text-[15px] leading-relaxed text-[#f4efe6]/75">{copy.hint}</p>
      </div>
    </div>
  );
}

function Choices<T extends string>({ options, current, onChoose }: { options: Option<T>[]; current: T | undefined; onChoose: (option: Option<T>) => void }) {
  const [picked, setPicked] = useState<T | null>(null);
  const reduced = useReducedMotion();
  const active = picked ?? current;
  return (
    <ul className="grid gap-1">
      {options.map((option) => {
        const chosen = active === option.value;
        const Glyph = option.icon;
        return (
          <li key={option.value}>
            <motion.button
              type="button"
              aria-pressed={chosen}
              disabled={picked !== null}
              whileTap={reduced ? undefined : { scale: 0.975 }}
              transition={STEP_SPRING}
              onClick={() => {
                setPicked(option.value);
                onChoose(option);
              }}
              className={`group relative flex min-h-[68px] w-full items-center gap-4 rounded-[22px] px-3 py-2.5 text-left transition-colors duration-200 disabled:cursor-default sm:min-h-[74px] sm:px-4 short:min-h-[56px] ${chosen ? "bg-invert-bg text-invert-fg" : "hover:bg-white/70"}`}
            >
              <span className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors ${chosen ? "bg-white/12" : "bg-invert-bg/[0.07] text-invert-bg"}`}>
                <Glyph size={24} weight="light" />
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="text-[16px] font-medium leading-tight">{option.label}</span>
                <span className={`text-[13px] leading-snug ${chosen ? "text-invert-fg/75" : "text-fg/65"}`}>{option.hint}</span>
              </span>
              <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full border transition ${chosen ? "border-transparent bg-[#f4efe6] text-invert-bg" : "border-fg/20"}`}>
                {chosen ? <Check size={14} weight="bold" /> : null}
              </span>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}

function Leathers({ current, onChoose }: { current: ColorKey | undefined; onChoose: (color: ColorKey) => void }) {
  const [picked, setPicked] = useState<ColorKey | null>(null);
  const reduced = useReducedMotion();
  const active = picked ?? current;
  return (
    <div role="group" aria-label="Leathers" className="grid grid-cols-3 gap-x-1.5 gap-y-1 p-1.5 min-[400px]:grid-cols-4 sm:p-2 short:grid-cols-6">
      {LEATHERS.map((color) => {
        const chosen = active === color;
        return (
          <motion.button
            key={color}
            type="button"
            aria-pressed={chosen}
            disabled={picked !== null}
            whileTap={reduced ? undefined : { scale: 0.95 }}
            transition={STEP_SPRING}
            onClick={() => {
              setPicked(color);
              onChoose(color);
            }}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 rounded-[20px] p-1.5 pb-2 text-center transition-colors hover:bg-white/60 disabled:cursor-default"
          >
            <Leather color={color} className={`aspect-square w-full rounded-[16px] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_14px_-6px_rgb(15_33_29/0.55)] transition-transform duration-300 ${chosen ? "scale-[0.9] outline-2 outline-offset-[5px] outline-invert-bg" : ""}`}>
              {chosen ? (
                <span className={`absolute inset-0 grid place-items-center ${isLightLeather(color) ? "text-invert-bg" : "text-white"}`}>
                  <Check size={22} weight="bold" aria-hidden />
                </span>
              ) : null}
            </Leather>
            <span className="truncate text-[13px] leading-tight short:text-[12px]">{COLORS[color].name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function Initials({ answers }: { answers: Answers }) {
  const [value, setValue] = useState(answers.initials ?? "");
  const color = answers.color ?? "cognac";
  const light = isLightLeather(color);

  const update = (raw: string) => {
    const letters = raw.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    setValue(letters);
    const { initials: _dropped, ...rest } = answers;
    navigate(letters ? { ...rest, initials: letters } : rest, "initials", "replace");
  };

  const finish = (withInitials: boolean) => {
    const { initials: _dropped, ...rest } = answers;
    navigate(withInitials && value ? { ...rest, initials: value } : rest, "result");
  };

  return (
    <form
      className="grid gap-3 p-2 sm:p-3"
      onSubmit={(event) => {
        event.preventDefault();
        finish(true);
      }}
    >
      <Leather color={color} className="grid h-36 place-items-center rounded-[22px] sm:h-44 short:h-24">
        <span
          aria-hidden
          className={`relative bg-[linear-gradient(170deg,#f6e3a8_8%,#d9b061_42%,#9c7631_72%,#e8cd84_96%)] bg-clip-text font-display text-[64px] tracking-[0.12em] text-transparent sm:text-[76px] short:text-[44px] ${value ? "" : "opacity-45"}`}
          style={{ filter: light ? "drop-shadow(0 1px 0 rgb(0 0 0 / 0.25))" : "drop-shadow(0 1px 1px rgb(0 0 0 / 0.55))" }}
        >
          {value || "AB"}
        </span>
      </Leather>
      <p className="-mt-1 text-[12px] text-fg/65">Shown in gold foil. Pieces with silver-toned hardware get palladium foil.</p>
      <label className="grid gap-1.5">
        <span className="text-[13px] text-fg/70">Your initials</span>
        <input
          value={value}
          onChange={(event) => update(event.target.value)}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={3}
          placeholder="AB"
          className="h-14 w-full rounded-[18px] border border-fg/15 bg-white/70 px-4 font-display text-[28px] tracking-[0.2em] text-fg uppercase placeholder:text-fg/25 focus:border-invert-bg focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => finish(false)} className="h-12 rounded-full border border-fg/20 text-sm font-medium transition hover:bg-white/70 active:scale-[0.97]">
          Skip
        </button>
        <button type="submit" disabled={!value} className="h-12 rounded-full bg-invert-bg text-sm font-medium text-invert-fg transition hover:opacity-90 active:scale-[0.97] disabled:opacity-40">
          Add {value || "initials"}
        </button>
      </div>
    </form>
  );
}
