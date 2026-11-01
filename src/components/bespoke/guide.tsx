"use client";

import { finishGuide, useCreator } from "./store";
import { GLASS_PANEL } from "./ui";

const STEPS = (verb: string) => [
  { title: "Draw your first piece", body: `${verb} the board to place points, then ${verb.toLowerCase()} the first point to close the shape. You can also start from a shape or an example.` },
  { title: "Shape and dress it", body: "Drag points to reshape, add curves, cut-outs, handles and hardware. Each piece has its own leather and thread." },
  { title: "Check it and send it", body: "Watch the 3D preview and the estimate as you go. Send it to our workshop for a final price." },
];

export function Guide({ step, verb }: { step: number; verb: string }) {
  const setGuide = useCreator((state) => state.setGuide);
  const steps = STEPS(verb);
  const current = steps[step]!;
  const last = step === steps.length - 1;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-[#0d1f19]/45 p-4">
      <section role="dialog" aria-labelledby="guide-title" className={`${GLASS_PANEL} grid w-full max-w-[380px] gap-3 rounded-[28px] p-5`}>
        <p className="text-[12px] font-medium tabular-nums text-fg/75">Step {step + 1} of {steps.length}</p>
        <h2 id="guide-title" className="font-display text-[28px] leading-[1.08]">{current.title}</h2>
        <p className="text-[14px] leading-snug">{current.body}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button type="button" onClick={finishGuide} className="min-h-11 rounded-full px-3 text-[13px] underline underline-offset-2">Skip</button>
          <button type="button" autoFocus onClick={() => (last ? finishGuide() : setGuide(step + 1))} className="min-h-11 rounded-full bg-invert-bg px-5 text-[13px] font-medium text-invert-fg">{last ? "Start designing" : "Next"}</button>
        </div>
      </section>
    </div>
  );
}
