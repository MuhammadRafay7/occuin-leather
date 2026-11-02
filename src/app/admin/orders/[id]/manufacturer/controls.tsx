"use client";

import { useState } from "react";
import { createSheetLink, makeViewsAgain, markSentToManufacturer, revokeSheetLink, shareSheetMessage } from "@/lib/actions/admin-manufacturer";
import type { ActionResult } from "@/lib/actions/admin";
import { useAction } from "../../../_components/controls";
import { buttonClass, controlClass, dangerButtonClass, ghostButtonClass, linkClass, Notice, primaryButtonClass } from "../../../_components/ui";

export function SheetLinks({ base, canShare, linkDays, orderId }: { base: string; canShare: boolean; linkDays: readonly number[]; orderId: string }) {
  const [address, setAddress] = useState(false);
  const [days, setDays] = useState(30);
  const { pending, result, run } = useAction();
  const query = address ? "?address=1" : "";
  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={address} onChange={(event) => setAddress(event.target.checked)} className="mt-0.5" />
        <span>Include the delivery address. Leave this off unless the manufacturer ships the piece directly.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <a href={`${base}/sheet${query}`} target="_blank" rel="noopener" className={primaryButtonClass}>Open printable sheet</a>
        <a href={`${base}/pdf${query}`} className={buttonClass}>Download PDF</a>
      </div>
      {canShare ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
          <label className="grid gap-1">
            <span>Private link lasts</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))} className={controlClass}>
              {linkDays.map((value) => <option key={value} value={value}>{value} days</option>)}
            </select>
          </label>
          <button type="button" disabled={pending} className={buttonClass} onClick={() => run(() => createSheetLink({ orderId, days, includeAddress: address }))}>{pending ? "Making" : "Make private link"}</button>
        </div>
      ) : <p className="border-t border-line pt-3 text-muted">Private links can be made once this order is paid.</p>}
      <Notice result={result} compact />
    </div>
  );
}

export function LinkRow({ orderId, linkId, url, active }: { orderId: string; linkId: string; url: string; active: boolean }) {
  const { pending, result, run } = useAction();
  const share = useAction<ActionResult & { text?: string }>();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, note: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(note);
  };
  const shareMessage = () =>
    share.run(() => shareSheetMessage(orderId, linkId), (outcome) => {
      if (outcome.text) void copy(outcome.text, "Message copied. Paste it into WhatsApp.").catch(() => setCopied("Your browser blocked copying."));
    });
  if (!active) return null;
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener" className={linkClass}>Open</a>
        <button type="button" className={ghostButtonClass} onClick={() => void copy(url, "Link copied.").catch(() => setCopied("Your browser blocked copying."))}>Copy link</button>
        <button type="button" disabled={share.pending} className={buttonClass} onClick={shareMessage}>Copy WhatsApp message</button>
        <button type="button" disabled={pending} className={dangerButtonClass} onClick={() => run(() => revokeSheetLink(orderId, linkId))}>Turn off link</button>
      </div>
      {copied ? <p role="status" className="text-xs text-muted">{copied}</p> : <Notice result={result ?? share.result} compact />}
    </div>
  );
}

export function SentToggle({ orderId, itemId, sent }: { orderId: string; itemId: string; sent: boolean }) {
  const { pending, result, run } = useAction();
  const [checked, setChecked] = useState(sent);
  const change = (next: boolean) => {
    setChecked(next);
    run(() => markSentToManufacturer(orderId, itemId, next), (outcome) => {
      if (!outcome.ok) setChecked(!next);
    });
  };
  return (
    <div className="grid gap-1">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={checked} disabled={pending} onChange={(event) => change(event.target.checked)} />
        <span>Sent to manufacturer</span>
      </label>
      {result && !result.ok ? <Notice result={result} compact /> : null}
    </div>
  );
}

export function RemakeViews({ orderId, itemId }: { orderId: string; itemId: string }) {
  const { pending, run } = useAction();
  return <button type="button" disabled={pending} className={ghostButtonClass} onClick={() => run(() => makeViewsAgain(orderId, itemId))}>Make images again</button>;
}
