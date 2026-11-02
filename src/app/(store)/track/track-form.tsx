"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { Button, Field, inputClass } from "@/components/ui";
import { trackOrder } from "@/lib/actions/checkout";
import type { FormState } from "@/lib/form-state";

const INITIAL: FormState = {};

export function TrackForm() {
  const [state, action, pending] = useActionState(trackOrder, INITIAL);
  const errors = state.fields ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <FormMessage error={state.error} />
      <Field label="Order reference" error={errors.ref} hint="For example OC-000123">
        <input name="ref" defaultValue={state.values?.ref} autoCapitalize="characters" maxLength={16} aria-invalid={Boolean(errors.ref)} className={inputClass} />
      </Field>
      <Field label="Email" error={errors.email}>
        <input name="email" type="email" defaultValue={state.values?.email} autoComplete="email" maxLength={254} aria-invalid={Boolean(errors.email)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Looking" : "Find my order"}</Button>
    </form>
  );
}
