import { Field, inputClass } from "@/components/ui";
import { COUNTRIES } from "@/lib/validation";

export type AddressDefaults = Partial<Record<"name" | "line1" | "line2" | "city" | "state" | "postalCode" | "country", string>>;

export function AddressFields({ defaults = {}, errors = {} }: { defaults?: AddressDefaults; errors?: Record<string, string> }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Full name" error={errors.name}>
          <input name="name" defaultValue={defaults.name} autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.name)} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Address line 1" error={errors.line1}>
          <input name="line1" defaultValue={defaults.line1} autoComplete="address-line1" maxLength={160} aria-invalid={Boolean(errors.line1)} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Address line 2 (optional)" error={errors.line2}>
          <input name="line2" defaultValue={defaults.line2} autoComplete="address-line2" maxLength={160} aria-invalid={Boolean(errors.line2)} className={inputClass} />
        </Field>
      </div>
      <Field label="City" error={errors.city}>
        <input name="city" defaultValue={defaults.city} autoComplete="address-level2" maxLength={100} aria-invalid={Boolean(errors.city)} className={inputClass} />
      </Field>
      <Field label="State or province" error={errors.state}>
        <input name="state" defaultValue={defaults.state} autoComplete="address-level1" maxLength={80} aria-invalid={Boolean(errors.state)} className={inputClass} />
      </Field>
      <Field label="Postal code" error={errors.postalCode}>
        <input name="postalCode" defaultValue={defaults.postalCode} autoComplete="postal-code" maxLength={12} aria-invalid={Boolean(errors.postalCode)} className={inputClass} />
      </Field>
      <Field label="Country" error={errors.country}>
        <select name="country" defaultValue={defaults.country ?? "US"} autoComplete="country" aria-invalid={Boolean(errors.country)} className={`${inputClass} bg-bg`}>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}
