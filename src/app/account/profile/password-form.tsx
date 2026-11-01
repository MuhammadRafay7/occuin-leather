"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { changePassword } from "@/lib/actions/account";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <FormMessage error={state.error} notice={state.notice} />
      <Field label="Current password" error={errors.current}>
        <input name="current" type="password" autoComplete="current-password" maxLength={128} aria-invalid={Boolean(errors.current)} className={inputClass} />
      </Field>
      <Field label="New password" error={errors.password} hint="At least 10 characters">
        <input name="password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.password)} className={inputClass} />
      </Field>
      <Field label="Repeat new password" error={errors.confirm}>
        <input name="confirm" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.confirm)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Change password"}</Button>
    </form>
  );
}
