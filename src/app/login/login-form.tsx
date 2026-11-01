"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { signIn } from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <FormMessage error={state.error} />
      <Field label="Email">
        <input name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={254} className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" maxLength={128} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Signing in" : "Sign in"}</Button>
    </form>
  );
}
