"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Field } from "@/components/ui";
import { saveProduct, type ProductInput } from "@/lib/actions/admin";
import { useAction } from "../_components/controls";
import { buttonClass, controlClass, Notice, primaryButtonClass, Table, textAreaClass } from "../_components/ui";
import type { VariantInput } from "../_lib/format";

export type CategoryOption = { slug: string; name: string; department: string };
type Row = VariantInput & { key: string };
type VariantField = "color" | "size" | "sku" | "price" | "stock";

const DEPARTMENTS = ["women", "men", "leather"];
const VARIANT_COLUMNS: { field: VariantField; label: string; inputMode?: "decimal" | "numeric"; width: string }[] = [
  { field: "color", label: "Colour", width: "min-w-32" },
  { field: "size", label: "Size", width: "min-w-20" },
  { field: "sku", label: "SKU", width: "min-w-44" },
  { field: "price", label: "Price, USD", inputMode: "decimal", width: "min-w-24" },
  { field: "stock", label: "Stock", inputMode: "numeric", width: "min-w-20" },
];

const toRow = (variant: VariantInput, index: number): Row => ({ ...variant, key: variant.id ?? `initial-${index}` });

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-[var(--fg)]" />
      {label}
    </label>
  );
}

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <fieldset className="grid gap-4 border border-line p-4">
    <legend className="px-1 text-sm font-medium">{title}</legend>
    {children}
  </fieldset>
);

export function ProductForm({ initial, categories }: { initial: ProductInput; categories: CategoryOption[] }) {
  const router = useRouter();
  const nextKey = useRef(0);
  const [product, setProduct] = useState(initial);
  const [rows, setRows] = useState<Row[]>(() => initial.variants.map(toRow));
  const { pending, result, run, clear } = useAction<Awaited<ReturnType<typeof saveProduct>>>();
  const errors = result?.fieldErrors ?? {};

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setProduct((current) => ({ ...current, [key]: value }));
  const setCell = (key: string, field: VariantField, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  function addVariant() {
    const last = rows.at(-1);
    const key = `added-${nextKey.current++}`;
    setRows([...rows, { key, color: last?.color ?? "", size: "", sku: "", price: last?.price ?? "", stock: "0" }]);
  }

  function removeVariant(key: string) {
    clear();
    setRows(rows.filter((row) => row.key !== key));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = rows.map(({ key: _key, ...variant }) => variant);
    run(
      () => saveProduct({ ...product, variants: payload }),
      (saved) => {
        if (!saved.ok || !saved.id) return;
        if (!product.id) router.push(`/admin/products/${saved.id}?created=1`);
        else if (saved.variants) setRows(saved.variants.map(toRow));
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-6" noValidate>
      <Group title="Details">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input value={product.name} onChange={(event) => set("name", event.target.value)} className={controlClass} />
          </Field>
          <Field label="Slug" error={errors.slug} hint="Used in the product address. Changing it breaks old links.">
            <input value={product.slug} onChange={(event) => set("slug", event.target.value)} className={controlClass} />
          </Field>
        </div>
        <Field label="Description" error={errors.description}>
          <textarea value={product.description} onChange={(event) => set("description", event.target.value)} rows={5} className={textAreaClass} />
        </Field>
        <Field label="Composition" error={errors.composition}>
          <textarea value={product.composition} onChange={(event) => set("composition", event.target.value)} rows={2} className={textAreaClass} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Category" error={errors.categorySlug}>
            <select value={product.categorySlug} onChange={(event) => set("categorySlug", event.target.value)} className={controlClass}>
              <option value="">Choose a category</option>
              {DEPARTMENTS.map((department) => (
                <optgroup key={department} label={department}>
                  {categories.filter((category) => category.department === department).map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-6 md:pt-6">
            <Toggle label="Women" checked={product.audiences.includes("women")} onChange={(checked) => set("audiences", checked ? [...product.audiences, "women"] : product.audiences.filter((item) => item !== "women"))} />
            <Toggle label="Men" checked={product.audiences.includes("men")} onChange={(checked) => set("audiences", checked ? [...product.audiences, "men"] : product.audiences.filter((item) => item !== "men"))} />
            <Toggle label="Active" checked={product.active} onChange={(checked) => set("active", checked)} />
            <Toggle label="Featured" checked={product.featured} onChange={(checked) => set("featured", checked)} />
          </div>
        </div>
        <Field label="Images" error={errors.images} hint="One path per line or separated by commas, each under /images. The first is the main image.">
          <textarea value={product.images} onChange={(event) => set("images", event.target.value)} rows={4} className={`${textAreaClass} font-mono text-xs`} />
        </Field>
      </Group>

      <Group title="Variants">
        <Table caption="Variants" head={[...VARIANT_COLUMNS.map((column) => column.label), "Remove"]}>
          {rows.map((row, index) => (
            <tr key={row.key}>
              {VARIANT_COLUMNS.map(({ field, label, inputMode, width }) => {
                const error = errors[`variants.${index}.${field}`];
                return (
                  <td key={field} className={width}>
                    <input
                      aria-label={`${label}, variant ${index + 1}`}
                      aria-invalid={Boolean(error)}
                      inputMode={inputMode}
                      value={row[field]}
                      onChange={(event) => setCell(row.key, field, event.target.value)}
                      className={controlClass}
                    />
                    {error ? <span role="alert" className="mt-1 block text-xs text-danger">{error}</span> : null}
                  </td>
                );
              })}
              <td>
                <button type="button" aria-label={`Remove variant ${index + 1}`} onClick={() => removeVariant(row.key)} className={buttonClass}>
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
        </Table>
        {errors.variants ? <p role="alert" className="text-xs text-danger">{errors.variants}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={addVariant} className={`${buttonClass} gap-1`}><Plus size={14} /> Add variant</button>
          <p className="text-xs text-muted">Removing a variant also takes it out of customer bags. Past orders keep their line items.</p>
        </div>
      </Group>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving" : product.id ? "Save changes" : "Create product"}
        </button>
        <Notice result={result} />
      </div>
    </form>
  );
}
