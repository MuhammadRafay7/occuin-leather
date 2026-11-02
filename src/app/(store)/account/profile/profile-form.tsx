"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { updateProfile } from "@/lib/actions/account";
import type { FormState } from "@/lib/form-state";
import { submitInPlace } from "@/lib/submit-in-place";

const INITIAL: FormState = {};

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} onSubmit={submitInPlace(action)} noValidate className="grid gap-5">
      <FormMessage error={state.error} notice={state.notice} />
      <Field label="Name" error={errors.name}>
        <input name="name" defaultValue={name} autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.name)} className={inputClass} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input name="email" type="email" defaultValue={email} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} className={inputClass} />
      </Field>
      <Field label="Current password" error={errors.password} hint="Needed only to change your email">
        <input name="password" type="password" autoComplete="current-password" maxLength={128} aria-invalid={Boolean(errors.password)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save details"}</Button>
    </form>
  );
}
