"use client";

import { useActionState, useTransition } from "react";
import { Button, Field, inputClass } from "@/components/ui";
import { applyPromo } from "@/lib/actions/cart";
import { formText } from "@/lib/form-state";

async function submitPromo(_: string | undefined, data: FormData) {
  const result = await applyPromo(formText(data, "code").slice(0, 64));
  return result.error;
}

export function PromoForm({ applied, problem }: { applied: string | null; problem: string | null }) {
  const [error, action, pending] = useActionState(submitPromo, undefined);
  const [removing, startRemoving] = useTransition();

  if (applied) {
    return (
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <p>Code {applied} {problem ? "is not active" : "applied"}</p>
          <button
            type="button"
            disabled={removing}
            onClick={() => startRemoving(async () => { await applyPromo(null); })}
            className="min-h-11 underline underline-offset-4 hover:opacity-60 disabled:opacity-40"
          >
            {removing ? "Removing" : "Remove"}
          </button>
        </div>
        {problem ? <p role="alert" className="text-xs text-danger">{problem}</p> : null}
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-3">
      <Field label="Promo code" error={error}>
        <input name="code" autoComplete="off" autoCapitalize="characters" maxLength={64} aria-invalid={Boolean(error)} className={inputClass} />
      </Field>
      <Button type="submit" look="outline" disabled={pending}>{pending ? "Applying" : "Apply"}</Button>
    </form>
  );
}
