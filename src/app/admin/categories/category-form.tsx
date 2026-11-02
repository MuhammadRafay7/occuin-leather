"use client";

import { Plus } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";
import { createCategory } from "@/lib/actions/admin-catalog";
import { MoreInline } from "../_components/catalog-ui";
import { useAction } from "../_components/controls";
import { controlClass, Field, Notice, primaryButtonClass } from "../_components/ui";

const BLANK = { name: "", department: "leather", address: "" };

export function CategoryForm() {
  const [values, setValues] = useState(BLANK);
  const { pending, result, run } = useAction();
  const errors = result?.fieldErrors ?? {};
  const set = (key: keyof typeof BLANK, value: string) => setValues((current) => ({ ...current, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    run(() => createCategory(values), (saved) => { if (saved.ok) setValues(BLANK); });
  }

  return (
    <form onSubmit={submit} className="adm-card" noValidate>
      <div className="adm-panel-head"><h2>Add a category</h2></div>
      <div className="adm-panel-body grid gap-3">
        <div className="grid items-start gap-3 md:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input value={values.name} onChange={(event) => set("name", event.target.value)} className={controlClass} />
          </Field>
          <Field label="Department" error={errors.department}>
            <select value={values.department} onChange={(event) => set("department", event.target.value)} className={controlClass}>
              <option value="leather">All leather</option>
              <option value="women">Women</option>
              <option value="men">Men</option>
            </select>
          </Field>
        </div>
        <MoreInline label="Advanced">
          <div className="max-w-sm">
            <Field label="Web address" error={errors.address} hint="Made from the name if you leave this empty.">
              <input value={values.address} onChange={(event) => set("address", event.target.value)} className={controlClass} />
            </Field>
          </div>
        </MoreInline>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={primaryButtonClass}><Plus size={14} aria-hidden="true" />{pending ? "Saving" : "Add category"}</button>
          <Notice result={result} />
        </div>
      </div>
    </form>
  );
}
