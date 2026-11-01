"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { requestReset } from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, INITIAL);
  return (
    <form action={action} noValidate className="grid gap-5">
      <FormMessage error={state.error} notice={state.notice} />
      <Field label="Email" error={state.fields?.email}>
        <input name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={254} aria-invalid={Boolean(state.fields?.email)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Sending" : "Send reset link"}</Button>
    </form>
  );
}
