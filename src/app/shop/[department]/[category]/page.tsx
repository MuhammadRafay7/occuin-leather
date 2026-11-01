import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
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
  const who = { women: " for women", men: " for men", leather: "" }[department];
  const title = `Leather ${category.name.toLowerCase()}${who}`;
  return { title, description: `${title}, handmade to order in Pakistan and shipped worldwide from OCCUIN.`, alternates: { canonical: path } };
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
