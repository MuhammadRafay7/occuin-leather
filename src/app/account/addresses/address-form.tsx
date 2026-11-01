"use client";

import { useActionState } from "react";
import { AddressFields, type AddressDefaults } from "@/components/address-fields";
import { FormMessage } from "@/components/form-message";
import { Button, LinkButton } from "@/components/ui";
import { saveAddress } from "@/lib/actions/account";
import type { FormState } from "@/lib/form-state";
import { submitInPlace } from "@/lib/submit-in-place";

const INITIAL: FormState = {};

export function AddressForm({ id, defaults, isDefault }: { id?: string; defaults?: AddressDefaults; isDefault?: boolean }) {
  const [state, action, pending] = useActionState(saveAddress, INITIAL);
  return (
    <form action={action} onSubmit={submitInPlace(action)} noValidate className="grid max-w-[640px] gap-6">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <FormMessage error={state.error} />
      <AddressFields defaults={defaults} errors={state.fields} />
      {isDefault ? null : (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="isDefault" className="accent-[var(--fg)]" />
          Make this my default address
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving" : "Save address"}</Button>
        <LinkButton href="/account/addresses" look="outline">Cancel</LinkButton>
      </div>
    </form>
  );
}
