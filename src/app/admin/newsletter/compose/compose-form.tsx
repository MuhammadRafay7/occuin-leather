"use client";

import { Eye, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendCampaignTest, startCampaign, type CampaignResult } from "@/lib/actions/admin-people";
import { newsletterText } from "@/lib/newsletter";
import { useAction } from "../../_components/controls";
import { IconHeading } from "../../_components/people-ui";
import { buttonClass, controlClass, Notice, Panel, primaryButtonClass, textAreaClass } from "../../_components/ui";

type Step = "write" | "confirm";

export function ComposeForm({ audience, testEmail, mailReady }: { audience: number; testEmail: string; mailReady: boolean }) {
  const router = useRouter();
  const test = useAction();
  const send = useAction<CampaignResult>();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<Step>("write");
  const [typed, setTyped] = useState("");
  const input = { subject, body };
  const ready = Boolean(subject.trim() && body.trim());
  const errors = send.result?.fieldErrors ?? test.result?.fieldErrors;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title={<IconHeading icon={PencilSimple}>Your email</IconHeading>}>
        <div className="grid content-start gap-3">
          {mailReady ? null : <p role="status" className="adm-notice" data-tone="danger">Email is not set up yet, so nothing can be sent. You can still write and preview here.</p>}
          <label className="adm-field">
            Subject
            <input value={subject} maxLength={150} disabled={step === "confirm"} onChange={(event) => setSubject(event.target.value)} className={controlClass} />
            {errors?.subject ? <span className="text-danger">{errors.subject}</span> : null}
          </label>
          <label className="adm-field">
            Message (plain text)
            <textarea rows={14} maxLength={20_000} value={body} disabled={step === "confirm"} onChange={(event) => setBody(event.target.value)} className={textAreaClass} />
            {errors?.body ? <span className="text-danger">{errors.body}</span> : null}
          </label>
          {step === "write" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!ready || test.pending} onClick={() => test.run(() => sendCampaignTest(input))} className={`${buttonClass} max-w-full truncate`}>{test.pending ? "Sending test" : `Send a test to ${testEmail}`}</button>
              <button type="button" disabled={!ready || !audience} onClick={() => { setTyped(""); send.clear(); setStep("confirm"); }} className={primaryButtonClass}>Review and send</button>
              {audience ? null : <p className="text-xs text-muted">There are no subscribers yet.</p>}
            </div>
          ) : (
            <div className="adm-card grid justify-items-start gap-2 p-4">
              <p className="text-sm font-medium">Send to all {audience} subscribers?</p>
              <p className="text-xs text-muted">This cannot be undone. Keep this page open until it finishes. Type {audience} to confirm.</p>
              <input aria-label="Subscriber count" inputMode="numeric" value={typed} onChange={(event) => setTyped(event.target.value)} className={`${controlClass} max-w-32`} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={send.pending || typed.trim() !== String(audience)}
                  onClick={() => send.run(() => startCampaign(input, Number(typed)), (outcome) => { if (outcome.campaign) router.push(`/admin/newsletter/campaigns/${outcome.campaign.id}?run=1`); })}
                  className={primaryButtonClass}
                >
                  {send.pending ? "Starting" : "Send newsletter"}
                </button>
                <button type="button" disabled={send.pending} onClick={() => setStep("write")} className={buttonClass}>Back</button>
              </div>
            </div>
          )}
          <Notice result={test.result} compact />
          <Notice result={send.result} compact />
        </div>
      </Panel>
      <section aria-label="Preview">
        <Panel title={<IconHeading icon={Eye}>What subscribers will see</IconHeading>} flush>
          <p className="border-b border-line px-4 py-3 font-medium break-words">{subject || "No subject yet"}</p>
          <pre className="whitespace-pre-wrap break-words px-4 py-3 font-sans text-sm">{newsletterText(body || "Your message appears here.", "(their personal unsubscribe link)")}</pre>
        </Panel>
      </section>
    </div>
  );
}
