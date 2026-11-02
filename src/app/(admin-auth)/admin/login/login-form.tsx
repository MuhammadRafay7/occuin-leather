"use client";

import { useActionState } from "react";
import { signInAdmin } from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";
import { controlClass, Field, primaryButtonClass } from "../../../admin/_components/ui";

const INITIAL: FormState = {};

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAdmin, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      {state.error ? <p role="alert" className="adm-notice">{state.error}</p> : null}
      <Field label="Email">
        <input name="email" type="email" required defaultValue={state.values?.email} autoComplete="username" maxLength={254} className={controlClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" maxLength={128} className={controlClass} />
      </Field>
      <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-1 w-full`}>{pending ? "Signing in" : "Sign in"}</button>
    </form>
  );
}
