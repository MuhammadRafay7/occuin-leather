"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { saveProduct, type ProductInput } from "@/lib/actions/admin";
import { useAction } from "../_components/controls";
import { buttonClass, controlClass, Field, Notice, Panel, primaryButtonClass, textAreaClass } from "../_components/ui";
import type { VariantInput } from "../_lib/format";
import { ImageManager, type MediaChoice } from "./image-manager";

export type CategoryOption = { slug: string; name: string; department: string };
type Row = VariantInput & { key: string };
type VariantField = "color" | "size" | "sku" | "price" | "stock";

const DEPARTMENTS = ["women", "men", "leather"];
const OPTION_COLUMNS: { field: VariantField; label: string; inputMode?: "decimal" | "numeric" }[] = [
  { field: "color", label: "Colour" },
  { field: "size", label: "Size" },
  { field: "price", label: "Price, USD", inputMode: "decimal" },
  { field: "stock", label: "How many", inputMode: "numeric" },
];
const OPTION_GRID = "@lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_40px]";

const toRow = (variant: VariantInput, index: number): Row => ({ ...variant, key: variant.id ?? `initial-${index}` });

const toSlug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const plainWords = (text = "") =>
  text
    .replace(/\bslug\b/gi, "web address")
    .replace(/\bSKU\b/g, "product code")
    .replace(/\bvariant\b/gi, "option")
    .replace(/\bimage\b/gi, "photo")
    .replace(/\bthe composition\b/gi, "what it is made of");

function withProductCodes(rows: Row[], name: string) {
  const taken = new Set(rows.map((row) => row.sku.trim().toUpperCase()).filter(Boolean));
  return rows.map(({ key: _key, ...variant }) => {
    if (variant.sku.trim()) return variant;
    const base = toSlug(`${name} ${variant.color} ${variant.size}`).toUpperCase().slice(0, 74);
    let code = base;
    for (let copy = 2; taken.has(code); copy += 1) code = `${base}-${copy}`;
    taken.add(code);
    return { ...variant, sku: code };
  });
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="adm-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <Panel title={title}>
    <div className="grid gap-3">{children}</div>
  </Panel>
);

export function ProductForm({ initial, categories, library }: { initial: ProductInput; categories: CategoryOption[]; library: MediaChoice[] }) {
  const router = useRouter();
  const nextKey = useRef(0);
  const [product, setProduct] = useState(initial);
  const [rows, setRows] = useState<Row[]>(() => initial.variants.map(toRow));
  const [images, setImages] = useState(() => initial.images.split("\n").filter(Boolean));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { pending, result, run, clear } = useAction<Awaited<ReturnType<typeof saveProduct>>>();
  const errors = result?.fieldErrors ?? {};
  const named = Boolean(product.name.trim());
  const advancedError = named && (Boolean(errors.slug) || Object.keys(errors).some((field) => /^variants\.\d+\.sku$/.test(field)));

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setProduct((current) => ({ ...current, [key]: value }));
  const setCell = (key: string, field: VariantField, value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  function addOption() {
    const last = rows.at(-1);
    const key = `added-${nextKey.current++}`;
    setRows([...rows, { key, color: last?.color ?? "", size: "", sku: "", price: last?.price ?? "", stock: "0" }]);
  }

  function removeOption(key: string) {
    clear();
    setRows(rows.filter((row) => row.key !== key));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const slug = product.slug.trim() || toSlug(product.name);
    run(
      () => saveProduct({ ...product, slug, images: images.join("\n"), variants: withProductCodes(rows, product.name) }),
      (saved) => {
        if (!saved.ok || !saved.id) return;
        if (!product.id) router.push(`/admin/products/${saved.id}?created=1`);
        else if (saved.variants) setRows(saved.variants.map(toRow));
      },
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="adm-grid-detail">
        <div className="adm-stack">
          <Group title="Photos">
            <ImageManager images={images} library={library} error={plainWords(errors.images) || undefined} onChange={setImages} />
          </Group>

          <Group title="About this piece">
            <Field label="Name" error={errors.name}>
              <input value={product.name} onChange={(event) => set("name", event.target.value)} className={controlClass} />
            </Field>
            <Field label="Description" error={errors.description} hint="What customers read on the product page.">
              <textarea value={product.description} onChange={(event) => set("description", event.target.value)} rows={4} className={textAreaClass} />
            </Field>
            <Field label="What it is made of" error={plainWords(errors.composition) || undefined}>
              <textarea value={product.composition} onChange={(event) => set("composition", event.target.value)} rows={2} className={textAreaClass} />
            </Field>
          </Group>

          <Group title="Price and stock">
            <p className="text-xs text-muted">Add one line for each colour and size you sell.</p>
            <div className="@container">
              <div className={`hidden gap-2 pb-1 text-xs font-medium text-muted @lg:grid ${OPTION_GRID}`}>
                {OPTION_COLUMNS.map((column) => <span key={column.field}>{column.label}</span>)}
                <span className="sr-only">Remove</span>
              </div>
              <ul className="grid gap-2">
                {rows.map((row, index) => (
                  <li key={row.key} className={`grid grid-cols-2 items-start gap-2 rounded-[6px] border border-line p-2 @lg:border-0 @lg:p-0 ${OPTION_GRID}`}>
                    {OPTION_COLUMNS.map(({ field, label, inputMode }) => {
                      const error = errors[`variants.${index}.${field}`];
                      return (
                        <div key={field} className="grid gap-1">
                          <span aria-hidden="true" className="text-xs text-muted @lg:hidden">{label}</span>
                          <input
                            aria-label={`${label}, option ${index + 1}`}
                            aria-invalid={Boolean(error)}
                            inputMode={inputMode}
                            value={row[field]}
                            onChange={(event) => setCell(row.key, field, event.target.value)}
                            className={controlClass}
                          />
                          {error ? <span role="alert" className="block text-xs text-danger">{plainWords(error)}</span> : null}
                        </div>
                      );
                    })}
                    <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => removeOption(row.key)} className={`${buttonClass} col-span-2 @lg:col-span-1 @lg:!px-0`}>
                      <X size={14} aria-hidden="true" />
                      <span className="@lg:hidden">Remove</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {errors.variants ? <p role="alert" className="text-xs text-danger">{plainWords(errors.variants)}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={addOption} className={buttonClass}><Plus size={14} aria-hidden="true" />Add an option</button>
              <p className="text-xs text-muted">Removing an option also takes it out of customers&apos; bags. Past orders are not changed.</p>
            </div>
          </Group>

          <details open={advancedOpen || advancedError} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} className="adm-card">
            <summary className="cursor-pointer p-3 font-medium">Advanced</summary>
            <div className="grid gap-3 border-t border-line p-3">
              <p className="text-xs text-muted">These fill themselves in. You only need them to change the automatic values.</p>
              <Field label="Web address" error={named ? plainWords(errors.slug) || undefined : undefined} hint="The last part of the product's link. Changing it stops old links from working.">
                <input value={product.slug} placeholder={toSlug(product.name)} onChange={(event) => set("slug", event.target.value)} className={controlClass} />
              </Field>
              {rows.map((row, index) => (
                <Field key={row.key} label={`Product code, ${[row.color, row.size].filter(Boolean).join(" ") || `option ${index + 1}`}`} error={named ? plainWords(errors[`variants.${index}.sku`]) || undefined : undefined} hint="Your own reference for this option.">
                  <input value={row.sku} placeholder="Made for you when you save" onChange={(event) => setCell(row.key, "sku", event.target.value)} className={controlClass} />
                </Field>
              ))}
            </div>
          </details>
        </div>

        <aside className="adm-stack lg:sticky lg:top-[60px]">
          <Group title="Status">
            <Toggle label="Show in the store" checked={product.active} onChange={(checked) => set("active", checked)} />
            <Toggle label="Feature this piece" checked={product.featured} onChange={(checked) => set("featured", checked)} />
            <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full`}>
              {pending ? "Saving" : product.id ? "Save changes" : "Create product"}
            </button>
            <Notice result={result ? { ...result, message: plainWords(result.message) } : null} />
          </Group>
          <Group title="Where it belongs">
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
            <div className="grid gap-1">
              <p className="text-xs font-medium">Who it is for</p>
              <Toggle label="Women" checked={product.audiences.includes("women")} onChange={(checked) => set("audiences", checked ? [...product.audiences, "women"] : product.audiences.filter((item) => item !== "women"))} />
              <Toggle label="Men" checked={product.audiences.includes("men")} onChange={(checked) => set("audiences", checked ? [...product.audiences, "men"] : product.audiences.filter((item) => item !== "men"))} />
              {errors.audiences ? <p role="alert" className="text-xs text-danger">{errors.audiences}</p> : null}
            </div>
          </Group>
        </aside>
      </div>
    </form>
  );
}
