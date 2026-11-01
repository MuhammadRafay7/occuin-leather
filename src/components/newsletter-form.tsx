"use client";

import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { subscribe, type NewsletterState } from "@/lib/actions/newsletter";

export function NewsletterForm() {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribe, {});

  if (state.ok) return <p role="status" className="text-sm">You are on the list.</p>;

  return (
    <form action={action} className="grid max-w-sm gap-2">
      <label htmlFor="newsletter-email" className="text-sm">New pieces by email</label>
      <div className="flex gap-2">
        <input id="newsletter-email" type="email" name="email" required autoComplete="email" placeholder="you@example.com" className={inputClass} />
        <Button type="submit" look="outline" disabled={pending} className="px-5">
          {pending ? "Joining" : "Join"}
        </Button>
      </div>
      {state.error ? <p role="alert" className="text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
