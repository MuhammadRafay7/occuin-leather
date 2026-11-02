"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { resetPassword } from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage error={state.error} />
      <Field label="New password" error={errors.password} hint="At least 10 characters">
        <input name="password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.password)} className={inputClass} />
      </Field>
      <Field label="Repeat new password" error={errors.confirm}>
        <input name="confirm" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.confirm)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save password"}</Button>
    </form>
  );
}
