"use client";

import dynamic from "next/dynamic";
import { Pinyon_Script } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { PreviewView } from "@/components/bespoke/stage";
import { trackLoads, type ShotTaker } from "@/components/studio/shot";
import { useWebgl } from "@/components/studio/viewport";
import { recordViewsMade, uploadSheetView } from "@/lib/actions/admin-manufacturer";
import type { BespokeDesign } from "@/lib/bespoke/design";
import { SHEET_VIEWS, SHOT_PX, type SheetView } from "@/lib/manufacturer/views";
import type { DesignSpec } from "@/lib/studio/spec";
import { buttonClass, Notice } from "../../../_components/ui";

const script = Pinyon_Script({ weight: "400", subsets: ["latin"], display: "swap" });
const StudioScene = dynamic(() => import("@/components/studio/scene"), { ssr: false });
const BespokeScene = dynamic(() => import("@/components/bespoke/scene"), { ssr: false });

export type ViewJob = { itemId: string; name: string; missing: SheetView[]; spec: DesignSpec | null; design: BespokeDesign | null };

const WAIT_MS = 240_000;
const POLL_MS = 150;
const SETTLE_MS = 500;
const QUIET_VIEW = { key: "front" as PreviewView, nonce: 0 };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fontsReady() {
  const style = getComputedStyle(document.documentElement);
  const families = ["--font-bodoni", "--font-geist"].map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
  await Promise.all(families.flatMap((family) => ["500", "600"].map((weight) => document.fonts.load(`${weight} 40px ${family}`, "OCCUIN&.").catch(() => []))));
  await document.fonts.load(`400 40px ${script.style.fontFamily}`, "OCCUIN&.").catch(() => []);
  await document.fonts.ready;
}

async function waitForScene(shot: RefObject<ShotTaker | null>, idle: () => boolean) {
  const deadline = Date.now() + WAIT_MS;
  const ready = () => Boolean(shot.current) && idle();
  while (Date.now() < deadline) {
    if (ready()) {
      await pause(SETTLE_MS);
      if (ready()) return true;
    }
    await pause(POLL_MS);
  }
  return false;
}

function JobScene({ job, shot }: { job: ViewJob; shot: RefObject<ShotTaker | null> }) {
  const capture = useRef<(() => string | null) | null>(null);
  return (
    <div aria-hidden="true" style={{ position: "fixed", left: -SHOT_PX * 2, top: 0, width: SHOT_PX, height: SHOT_PX }}>
      {job.spec ? <StudioScene spec={job.spec} interactive={false} still shotRef={shot} /> : null}
      {job.design ? <BespokeScene design={job.design} view={QUIET_VIEW} captureRef={capture} shotRef={shot} /> : null}
    </div>
  );
}

export function ViewMaker({ orderId, jobs }: { orderId: string; jobs: ViewJob[] }) {
  const router = useRouter();
  const { available } = useWebgl();
  const shot = useRef<ShotTaker | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [fonts, setFonts] = useState(false);
  const job = started && fonts && !failure ? jobs[index] : undefined;
  const total = jobs.reduce((sum, item) => sum + item.missing.length, 0);

  useEffect(() => {
    document.body.style.setProperty("--font-script", script.style.fontFamily);
    void fontsReady().finally(() => setFonts(true));
    return () => {
      document.body.style.removeProperty("--font-script");
    };
  }, []);

  useEffect(() => {
    if (available && total && !started) {
      const frame = requestAnimationFrame(() => setStarted(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [available, started, total]);

  useEffect(() => {
    if (!job) return;
    let live = true;
    const loads = trackLoads();
    const make = async () => {
      setStatus(`Making images for ${job.name}`);
      if (!(await waitForScene(shot, loads.idle)) || !live) throw new Error("The 3D scene did not finish loading.");
      for (const [position, view] of job.missing.entries()) {
        setStatus(`${job.name}: image ${position + 1} of ${job.missing.length}, ${SHEET_VIEWS[view].label}`);
        await pause(30);
        const url = shot.current?.(SHEET_VIEWS[view]);
        if (!url) throw new Error("The image could not be made.");
        const saved = await uploadSheetView(orderId, job.itemId, view, url);
        if (!saved.ok) throw new Error(saved.message);
        if (!live) return;
      }
      await recordViewsMade(orderId, job.itemId);
      if (live) setIndex((value) => value + 1);
    };
    make()
      .catch((error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : "The images could not be made.");
      })
      .finally(() => loads.stop());
    return () => {
      live = false;
    };
  }, [job, orderId]);

  useEffect(() => {
    if (started && index >= jobs.length && jobs.length) router.refresh();
  }, [index, jobs.length, router, started]);

  if (!total) return <p className="text-muted">All images are saved. Everyone sees these same images.</p>;
  if (available === false) return <Notice result={{ ok: false, message: "This browser cannot make 3D images. Open this page on a computer with graphics turned on." }} />;
  return (
    <div className="grid gap-2" data-view-maker={failure ? "failed" : job ? "working" : "done"}>
      <p role="status">{failure ? null : status || "Getting ready to make the images."}</p>
      {failure ? (
        <>
          <Notice result={{ ok: false, message: failure }} />
          <button type="button" className={buttonClass} onClick={() => setFailure(null)}>Try again</button>
        </>
      ) : <p className="text-xs text-muted">Keep this page open. It takes about a minute for each piece.</p>}
      {job ? <JobScene key={job.itemId} job={job} shot={shot} /> : null}
    </div>
  );
}
