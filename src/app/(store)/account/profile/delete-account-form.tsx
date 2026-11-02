"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { deleteAccount } from "@/lib/actions/account";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <FormMessage error={state.error} notice={state.notice} />
      <p className="text-sm text-muted">This removes your account, addresses, saved designs and reviews, and cannot be undone. We keep records of past orders where the law requires it.</p>
      <Field label="Password" error={errors.password}>
        <input name="password" type="password" autoComplete="current-password" maxLength={128} aria-invalid={Boolean(errors.password)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Deleting" : "Delete my account"}</Button>
    </form>
  );
}
