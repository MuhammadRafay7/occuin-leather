"use client";

import { useState } from "react";
import { saveBespoke, shareSavedBespoke } from "@/lib/actions/bespoke";
import { whatsappChatUrl, whatsappShareUrl } from "@/lib/bespoke/whatsapp";
import { useCreator } from "./store";

const LINK = "flex min-h-11 items-center justify-center rounded-full border border-fg/30 px-5 text-center text-[13px] font-medium hover:bg-fg/5 disabled:opacity-50";

export function ChatOnWhatsApp({ number, text }: { number: string | null; text: string }) {
  if (!number) return null;
  return <a href={whatsappChatUrl(number, text)} target="_blank" rel="noopener noreferrer" className={LINK}>Chat on WhatsApp</a>;
}

export function ShareOnWhatsApp({ number, text, label = "Share on WhatsApp" }: { number: string | null; text: string; label?: string }) {
  if (!number) return null;
  return <a href={whatsappShareUrl(text)} target="_blank" rel="noopener noreferrer" className={LINK}>{label}</a>;
}

export function ShareDesignOnWhatsApp({ number }: { number: string | null }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!number) return null;

  async function prepare() {
    const { design, savedId, savedName, markSaved, finishDrawing } = useCreator.getState();
    finishDrawing();
    const name = savedName || design.name || "My design";
    setPending(true);
    setError(null);
    try {
      const saved = await saveBespoke({ id: savedId, name, design: useCreator.getState().design });
      if ("error" in saved || !saved.id) {
        setError(("error" in saved && saved.error) || "We could not save this design.");
        return;
      }
      markSaved(saved.id, name);
      const shared = await shareSavedBespoke(saved.id);
      if ("link" in shared && shared.link) setLink(`${window.location.origin}${shared.link}`);
      else setError(("error" in shared && shared.error) || "We could not make a link.");
    } catch {
      setError("We could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      {link ? (
        <ShareOnWhatsApp number={number} text={`My OCCUIN design: ${link}`} label="Open WhatsApp to share" />
      ) : (
        <button type="button" disabled={pending} onClick={prepare} className={LINK}>{pending ? "Preparing a link" : "Share this design on WhatsApp"}</button>
      )}
      {link ? null : <p className="text-[12px] text-fg/70">This saves your design and makes a view-only link.</p>}
      {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}
