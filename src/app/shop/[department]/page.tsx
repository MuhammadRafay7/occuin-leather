import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { breadcrumbData, jsonLd, pageMeta } from "@/lib/seo";
import { DEPARTMENTS } from "@/lib/server/catalog";
import { resolveDepartment } from "@/lib/server/shop";
import type { RawParams } from "@/lib/shop-params";

type Props = { params: Promise<{ department: string }>; searchParams: Promise<RawParams> };

export const dynamicParams = false;

export const generateStaticParams = () => Object.keys(DEPARTMENTS).map((department) => ({ department }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const department = resolveDepartment((await params).department);
  return pageMeta(`/shop/${department}`, DEPARTMENTS[department].image);
}

export default async function DepartmentPage({ params, searchParams }: Props) {
  const department = resolveDepartment((await params).department);
  const crumbs = [{ name: "Home", path: "/" }, { name: DEPARTMENTS[department].name, path: `/shop/${department}` }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbData(crumbs))} />
      <ShopView
        path={`/shop/${department}`}
        title={DEPARTMENTS[department].name}
        department={department}
        params={await searchParams}
      />
    </>
  );
}
