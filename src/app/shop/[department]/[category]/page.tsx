import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { DEPARTMENTS } from "@/lib/server/catalog";
import { categoryPath, resolveCategory, resolveDepartment } from "@/lib/server/shop";
import type { RawParams } from "@/lib/shop-params";

type Props = { params: Promise<{ department: string; category: string }>; searchParams: Promise<RawParams> };

async function resolve(params: Props["params"]) {
  const { department: rawDepartment, category: rawCategory } = await params;
  const department = resolveDepartment(rawDepartment);
  const category = await resolveCategory(department, rawCategory);
  return { department, category, path: categoryPath(department, category.slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { department, category, path } = await resolve(params);
  const title = department === "leather" ? category.name : `${DEPARTMENTS[department].name}: ${category.name.toLowerCase()}`;
  return { title, description: `Shop ${title.toLowerCase()} at OCCUIN.`, alternates: { canonical: path } };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { department, category, path } = await resolve(params);
  return (
    <ShopView
      path={path}
      title={category.name}
      department={department}
      category={category.slug}
      params={await searchParams}
    />
  );
}
