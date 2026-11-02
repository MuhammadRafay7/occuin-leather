"use client";

import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { useState } from "react";
import { deleteCategory, moveCategory, updateCategory } from "@/lib/actions/admin-catalog";
import { ConfirmButton } from "../_components/confirm-button";
import { useAction } from "../_components/controls";
import { buttonClass, controlClass, Notice, StatusDot } from "../_components/ui";

type Category = { slug: string; name: string; department: string; productCount: number };
type RowProps = { category: Category; first: boolean; last: boolean };

function useCategoryEdit(category: Category) {
  const [name, setName] = useState(category.name);
  const [department, setDepartment] = useState(category.department);
  const saving = useAction();
  const moving = useAction();
  const unchanged = name.trim() === category.name && department === category.department;
  return { name, setName, department, setDepartment, saving, moving, unchanged };
}

type Edit = ReturnType<typeof useCategoryEdit>;

function NameEditor({ category, edit }: { category: Category; edit: Edit }) {
  const { name, setName, department, saving, unchanged } = edit;
  return (
    <>
      <div className="flex gap-1">
        <input aria-label={`Name of ${category.name}`} value={name} onChange={(event) => setName(event.target.value)} className={controlClass} />
        <button type="button" disabled={saving.pending || unchanged} onClick={() => saving.run(() => updateCategory({ slug: category.slug, name, department }))} className={buttonClass}>
          {saving.pending ? "Saving" : "Save"}
        </button>
      </div>
      <p className="mt-1 truncate text-xs text-muted">Web address: {category.slug.replace(/^leather-/, "")}</p>
      <Notice result={saving.result?.fieldErrors?.name ? { ok: false, message: saving.result.fieldErrors.name } : saving.result} compact />
    </>
  );
}

function DepartmentSelect({ category, edit }: { category: Category; edit: Edit }) {
  return (
    <select aria-label={`Department of ${category.name}`} value={edit.department} onChange={(event) => edit.setDepartment(event.target.value)} className={controlClass}>
      <option value="leather">All leather</option>
      <option value="women">Women</option>
      <option value="men">Men</option>
    </select>
  );
}

function OrderButtons({ category, first, last, edit: { moving } }: RowProps & { edit: Edit }) {
  return (
    <>
      <div className="flex gap-1">
        <button type="button" aria-label={`Move ${category.name} up`} disabled={first || moving.pending} onClick={() => moving.run(() => moveCategory(category.slug, "up"))} className={buttonClass}><ArrowUp size={14} /></button>
        <button type="button" aria-label={`Move ${category.name} down`} disabled={last || moving.pending} onClick={() => moving.run(() => moveCategory(category.slug, "down"))} className={buttonClass}><ArrowDown size={14} /></button>
      </div>
      {moving.result && !moving.result.ok ? <Notice result={moving.result} compact /> : null}
    </>
  );
}

function DeleteAction({ category }: { category: Category }) {
  if (category.productCount) return <StatusDot tone="muted">Has products</StatusDot>;
  return <ConfirmButton action={() => deleteCategory(category.slug)} prompt={`Delete ${category.name}? You cannot undo this.`} confirmLabel="Yes, delete">Delete</ConfirmButton>;
}

export function CategoryRow({ category, first, last }: RowProps) {
  const edit = useCategoryEdit(category);
  return (
    <tr>
      <td className="min-w-56 align-top"><NameEditor category={category} edit={edit} /></td>
      <td className="min-w-32 align-top"><DepartmentSelect category={category} edit={edit} /></td>
      <td className="align-top tabular-nums">{category.productCount}</td>
      <td className="align-top"><OrderButtons category={category} first={first} last={last} edit={edit} /></td>
      <td className="align-top [&>div]:justify-items-end"><DeleteAction category={category} /></td>
    </tr>
  );
}

export function CategoryCard({ category, first, last }: RowProps) {
  const edit = useCategoryEdit(category);
  return (
    <li className="adm-card grid gap-2 p-3">
      <div className="min-w-0"><NameEditor category={category} edit={edit} /></div>
      <DepartmentSelect category={category} edit={edit} />
      <p className="text-xs tabular-nums text-muted">{category.productCount} {category.productCount === 1 ? "product" : "products"}</p>
      <div className="flex items-start justify-between gap-2 border-t border-line pt-2">
        <div><OrderButtons category={category} first={first} last={last} edit={edit} /></div>
        <DeleteAction category={category} />
      </div>
    </li>
  );
}
