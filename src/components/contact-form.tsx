"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { sendMessage, type ContactState } from "@/lib/actions/contact";
import { CONTACT_TOPICS } from "@/lib/policy";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessage, {});

  if (state.ok) {
    return <p role="status" className="font-display text-3xl">Thank you. We have your message and will reply by email.</p>;
  }

  return (
    <form action={action} className="grid gap-5">
      <Field label="Name" error={state.fields?.name}>
        <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
      </Field>
      <Field label="Email" error={state.fields?.email}>
        <input type="email" name="email" required autoComplete="email" className={inputClass} />
      </Field>
      <Field label="What is this about?" error={state.fields?.topic}>
        <select name="topic" required defaultValue={CONTACT_TOPICS[0]} className={inputClass}>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic} className="bg-bg text-fg">{topic}</option>
          ))}
        </select>
      </Field>
      <Field label="Message" error={state.fields?.message}>
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={`${inputClass} h-auto py-3`} />
      </Field>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? "Sending" : "Send message"}
      </Button>
    </form>
  );
}
