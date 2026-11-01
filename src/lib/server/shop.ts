import { notFound } from "next/navigation";
import { DEPARTMENTS, listCategories, type Department } from "./catalog";

export const categoryPath = (department: string, slug: string) =>
  `/shop/${department}/${slug.replace("leather-", "")}`;

export function resolveDepartment(value: string): Department {
  if (!Object.hasOwn(DEPARTMENTS, value)) notFound();
  return value as Department;
}

export async function resolveCategory(department: Department, value: string) {
  const categories = await listCategories(department);
  const category = categories.find((item) => item.slug === `leather-${value}`);
  if (!category) notFound();
  return category;
}
