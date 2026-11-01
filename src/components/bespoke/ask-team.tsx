"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { askContext, askTeam, sendMessage, type Access, type AskContext } from "@/lib/actions/bespoke";
import { visibleDesign } from "@/lib/bespoke/estimate";
import { longDate } from "@/lib/format";
import { COUNTRIES } from "@/lib/validation";
import { useCreator } from "./store";
import { AREA, FIELD } from "./ui";
import { ChatOnWhatsApp, ShareDesignOnWhatsApp } from "./whatsapp";

const MESSAGE_MAX = 2000;
const SEND = "flex min-h-11 w-full items-center justify-center rounded-full bg-invert-bg px-5 text-[13px] font-medium text-invert-fg hover:opacity-90 disabled:opacity-50";

export type ThreadMessage = { id: string; author: string; body: string; createdAt: Date };

export function AskTeam() {
  const [context, setContext] = useState<AskContext>({ whatsapp: null, name: "", email: "" });
  const [edits, setEdits] = useState<{ name?: string; email?: string }>({});
  const [country, setCountry] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ link: string; reference: string } | null>(null);
  const [pending, setPending] = useState(false);
  const name = edits.name ?? context.name;
  const email = edits.email ?? context.email;

  useEffect(() => {
    let live = true;
    askContext().then((value) => {
      if (live) setContext(value);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    useCreator.getState().finishDrawing();
    setPending(true);
    setError(null);
    try {
      const result = await askTeam({ name, email, country, question, design: visibleDesign(useCreator.getState().design) });
      if ("error" in result) setError(result.error ?? "We could not send your question.");
      else {
        setSent(result);
        setQuestion("");
      }
    } catch {
      setError("We could not reach the workshop. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      {sent ? (
        <div role="status" className="grid gap-2 text-[14px]">
          <p>We have your question, {sent.reference}. We will reply by email.</p>
          <Link href={sent.link} target="_blank" className="font-medium underline underline-offset-2">Open your private conversation</Link>
          <button type="button" onClick={() => setSent(null)} className="min-h-11 justify-self-start text-[13px] underline underline-offset-2">Ask something else</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-3">
          <div>
            <h2 className="text-[14px] font-medium">Ask our team</h2>
            <p className="mt-1 text-[13px] text-fg/75">We attach this design to your question and reply by email, usually within a working day.</p>
          </div>
          <label className="grid gap-1 text-[13px]">
            Your question
            <textarea value={question} maxLength={MESSAGE_MAX} rows={4} onChange={(event) => setQuestion(event.target.value)} className={AREA} />
          </label>
          <label className="grid gap-1 text-[13px]">
            Name
            <input value={name} maxLength={120} autoComplete="name" onChange={(event) => setEdits({ ...edits, name: event.target.value })} className={FIELD} />
          </label>
          <label className="grid gap-1 text-[13px]">
            Email
            <input type="email" value={email} maxLength={254} autoComplete="email" onChange={(event) => setEdits({ ...edits, email: event.target.value })} className={FIELD} />
          </label>
          <label className="grid gap-1 text-[13px]">
            Country
            <select value={country} onChange={(event) => setCountry(event.target.value)} className={FIELD}>
              <option value="">Choose a country</option>
              {COUNTRIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
            </select>
          </label>
          {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}
          <button type="submit" disabled={pending} className={SEND}>{pending ? "Sending" : "Send to our team"}</button>
        </form>
      )}
      <ChatOnWhatsApp number={context.whatsapp} text="Hello OCCUIN, I have a question about a design." />
      <ShareDesignOnWhatsApp number={context.whatsapp} />
    </div>
  );
}

export function MessageList({ messages, customerLabel }: { messages: ThreadMessage[]; customerLabel: string }) {
  if (!messages.length) return null;
  return (
    <ol className="grid gap-3">
      {messages.map((message) => (
        <li key={message.id} data-author={message.author} className={`grid gap-1 border border-line p-3 text-sm ${message.author === "team" ? "bg-surface" : ""}`}>
          <p className="text-xs text-muted">{message.author === "team" ? "OCCUIN workshop" : customerLabel}, {longDate(message.createdAt)}</p>
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function Conversation({ access, messages }: { access: Access; messages: ThreadMessage[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    start(async () => {
      setError(null);
      try {
        const result = await sendMessage(access, text);
        if ("error" in result) setError(result.error ?? "We could not send your message.");
        else {
          setText("");
          router.refresh();
        }
      } catch {
        setError("We could not reach the workshop. Try again.");
      }
    });
  }

  return (
    <section aria-labelledby="conversation-title" className="grid gap-3">
      <h2 id="conversation-title" className="border-b border-line pb-3 font-display text-2xl">Ask our team</h2>
      <MessageList messages={messages} customerLabel="You" />
      <form onSubmit={submit} noValidate className="grid gap-2">
        <label className="grid gap-1.5 text-sm">
          {messages.length ? "Reply" : "Your question"}
          <textarea value={text} maxLength={MESSAGE_MAX} rows={3} onChange={(event) => setText(event.target.value)} className="w-full border border-line bg-transparent p-3 text-[15px] focus:border-fg focus:outline-none" />
        </label>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <button type="submit" disabled={pending} className={`${SEND} sm:w-auto sm:justify-self-start`}>{pending ? "Sending" : "Send"}</button>
      </form>
    </section>
  );
}
