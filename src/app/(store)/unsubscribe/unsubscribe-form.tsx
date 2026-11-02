"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { unsubscribe, type NewsletterState } from "@/lib/actions/newsletter";

export function UnsubscribeForm({ email, token }: { email: string; token: string }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(unsubscribe, {});
  if (state.ok) return <p role="status" className="max-w-md text-sm">{email} will not get the newsletter again.</p>;
  return (
    <form action={action} className="grid max-w-md justify-items-start gap-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <p className="break-all text-sm">Stop sending the OCCUIN newsletter to {email}?</p>
      <Button type="submit" disabled={pending}>{pending ? "Working" : "Unsubscribe"}</Button>
      {state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
