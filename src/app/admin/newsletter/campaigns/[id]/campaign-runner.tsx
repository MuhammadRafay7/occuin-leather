"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { resumeNewsletterCampaign, sendCampaignBatch } from "@/lib/actions/admin-people";
import type { Campaign } from "@/lib/server/campaigns";
import { CAMPAIGN_STATE } from "../../../_components/people-ui";
import { buttonClass, Notice, StatusDot } from "../../../_components/ui";

export function CampaignRunner({ initial, autoStart, mailReady }: { initial: Campaign; autoStart: boolean; mailReady: boolean }) {
  const [campaign, setCampaign] = useState(initial);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const started = useRef(false);

  const pump = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    try {
      for (;;) {
        const result = await sendCampaignBatch(initial.id);
        if (result.campaign) setCampaign(result.campaign);
        if (!result.ok) setNotice(result);
        if (!result.ok || result.campaign?.status !== "sending") break;
      }
    } catch {
      setNotice({ ok: false, message: "The connection dropped. Nothing is lost: press Continue to carry on." });
    } finally {
      setRunning(false);
    }
  }, [initial.id]);

  useEffect(() => {
    if (!autoStart || started.current || initial.status !== "sending") return;
    started.current = true;
    void pump();
  }, [autoStart, initial.status, pump]);

  const resume = async () => {
    setRunning(true);
    const result = await resumeNewsletterCampaign(initial.id).catch(() => null);
    if (!result?.campaign) {
      setRunning(false);
      setNotice(result ?? { ok: false, message: "We could not reach the server. Try again." });
      return;
    }
    setCampaign(result.campaign);
    await pump();
  };

  const unconfirmed = Math.max(0, campaign.claimed - campaign.sent - campaign.failed.length);
  const handled = campaign.sent + campaign.failed.length;
  const percent = Math.min(100, Math.round((handled / Math.max(1, campaign.total)) * 100));
  const canContinue = !running && mailReady && campaign.status === "sending";
  const canRetry = !running && mailReady && campaign.status !== "sending" && (campaign.status === "paused" || campaign.failed.length > 0);

  return (
    <div className="grid justify-items-start gap-3">
      <div className="flex w-full items-center justify-between gap-2">
        <StatusDot tone={running ? "plain" : CAMPAIGN_STATE[campaign.status].tone}>{running ? "Sending" : CAMPAIGN_STATE[campaign.status].label}</StatusDot>
        <span className="text-xl font-semibold tabular-nums">{percent}%</span>
      </div>
      <div role="progressbar" aria-label="Campaign progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="adm-progress w-full">
        <div style={{ width: `${percent}%` }} />
      </div>
      <dl className="grid w-full grid-cols-3 gap-2">
        {([["Sent", campaign.sent], ["Failed", campaign.failed.length], ["Total", campaign.total]] as const).map(([label, value]) => (
          <div key={label} className="adm-stat">
            <dt className="adm-stat-label">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p role="status" className="text-xs text-muted">
        {campaign.sent} sent, {campaign.failed.length} failed, of {campaign.total} subscribers.
        {" "}
        {running ? "Sending. Keep this page open." : campaign.status === "done" ? "Finished." : campaign.status === "paused" ? "Stopped." : "Not finished."}
      </p>
      {unconfirmed && !running ? <p className="text-xs text-muted">{unconfirmed} were handed to a request that ended before it reported back, so we cannot say if they arrived. They are not sent again, to avoid duplicates.</p> : null}
      {mailReady ? null : <p className="text-danger">Email is not set up yet, so this newsletter cannot continue.</p>}
      <Notice result={notice} />
      {canContinue ? <button type="button" onClick={() => void pump()} className={buttonClass}>Continue sending</button> : null}
      {canRetry ? <button type="button" onClick={() => void resume()} className={buttonClass}>{campaign.failed.length ? `Retry ${campaign.failed.length} failed and continue` : "Continue sending"}</button> : null}
      {campaign.failed.length ? (
        <details className="text-xs text-muted">
          <summary>Failed addresses</summary>
          <ul className="mt-1 grid gap-0.5 break-all">{campaign.failed.map((email) => <li key={email}>{email}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}
