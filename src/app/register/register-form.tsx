"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { register } from "@/lib/actions/auth";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(register, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <FormMessage error={state.error} />
      <Field label="Name" error={errors.name}>
        <input name="name" defaultValue={state.values?.name} autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.name)} className={inputClass} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} className={inputClass} />
      </Field>
      <Field label="Password" error={errors.password} hint="At least 10 characters">
        <input name="password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={Boolean(errors.password)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Creating account" : "Create account"}</Button>
    </form>
  );
}
