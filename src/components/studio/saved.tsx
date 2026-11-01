"use client";

import { Trash } from "@phosphor-icons/react";
import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { deleteDesign, listDesigns, type SavedDesign } from "@/lib/actions/designs";
import { money } from "@/lib/format";
import { designSpecSchema } from "@/lib/studio/spec";
import { PRESS, SECONDARY } from "./controls";
import { useStudio } from "./store";

export function SavedDesigns({ refreshKey = 0, compact = false }: { refreshKey?: number; compact?: boolean }) {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const begin = useStudio((state) => state.begin);
  const forget = useStudio((state) => state.forget);
  const currentId = useStudio((state) => state.designId);

  useEffect(() => {
    let live = true;
    listDesigns()
      .then((rows) => {
        if (!live) return;
        setDesigns(rows);
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [refreshKey]);

  const open = (design: SavedDesign) => {
    const parsed = designSpecSchema.safeParse(design.spec);
    if (!parsed.success) return;
    begin({ spec: parsed.data, designId: design.id, source: `design:${design.id}`, saved: true });
    window.history.replaceState(null, "", `/studio?design=${design.id}`);
  };

  const remove = async (id: string) => {
    setConfirming(null);
    const previous = designs;
    setDesigns((rows) => rows?.filter((row) => row.id !== id) ?? null);
    try {
      const result = await deleteDesign(id);
      if (!result.ok) throw new Error("not deleted");
      forget(id);
      if (window.location.search.includes(id)) window.history.replaceState(null, "", "/studio");
    } catch {
      setDesigns(previous);
      setFailed(true);
    }
  };

  if (failed) return <p role="alert" className="text-sm text-danger">We could not reach your saved designs. Please try again.</p>;
  if (!designs) return <p className={`text-[13px] ${SECONDARY}`} role="status">Loading your designs</p>;
  if (!designs.length) {
    if (compact) return null;
    return <p className={`text-[13px] ${SECONDARY}`}>Nothing saved yet. Your designs will rest here once you save one.</p>;
  }

  return (
    <div className="grid gap-4">
      {compact ? <h2 className="font-display text-3xl">Your saved designs</h2> : null}
      <ul className={compact ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-2"}>
        {designs.map((design) => (
          <li key={design.id} className="grid grid-cols-[1fr_auto] items-center gap-1 rounded-[18px] border border-fg/10 bg-bg/60 p-1.5 pr-2">
            <motion.button type="button" aria-label={`Open ${design.name}`} whileTap={{ scale: 0.98 }} transition={PRESS} onClick={() => open(design)} className="grid min-w-0 grid-cols-[64px_1fr] items-center gap-3 rounded-[12px] text-left">
              <span className="block h-16 w-16 overflow-hidden bg-surface">
                <Image src={`/api/designs/${design.id}/preview`} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{design.name}</span>
                <span className={`block text-[13px] tabular-nums ${SECONDARY}`}>{money(design.priceCents)}{design.id === currentId ? ", open now" : ""}</span>
              </span>
            </motion.button>
            {confirming === design.id ? (
              <div className="flex items-center gap-1 text-[13px] font-medium">
                <button type="button" onClick={() => remove(design.id)} className="min-h-11 rounded-full px-3 text-danger hover:bg-fg/10">Delete</button>
                <button type="button" onClick={() => setConfirming(null)} className="min-h-11 rounded-full px-3 hover:bg-fg/10">Keep</button>
              </div>
            ) : (
              <button type="button" aria-label={`Delete ${design.name}`} onClick={() => setConfirming(design.id)} className="grid h-11 w-11 place-items-center rounded-full text-fg/75 transition-colors duration-200 hover:bg-fg/10 hover:text-fg">
                <Trash size={18} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
