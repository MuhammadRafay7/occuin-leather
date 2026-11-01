import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { DEPARTMENTS } from "@/lib/server/catalog";
import { resolveDepartment } from "@/lib/server/shop";
import type { RawParams } from "@/lib/shop-params";

const HEADINGS = { women: "Women's Leather Bags and Accessories", men: "Men's Leather Bags and Accessories", leather: "Handmade Leather Bags and Accessories" };

type Props = { params: Promise<{ department: string }>; searchParams: Promise<RawParams> };

export const dynamicParams = false;

export const generateStaticParams = () => Object.keys(DEPARTMENTS).map((department) => ({ department }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const department = resolveDepartment((await params).department);
  const { image } = DEPARTMENTS[department];
  return {
    title: HEADINGS[department],
    description: `${HEADINGS[department]}: handmade bags, laptop bags, wallets and belts, made to order in Pakistan and shipped worldwide.`,
    alternates: { canonical: `/shop/${department}` },
    openGraph: { images: [image] },
  };
}

export default async function DepartmentPage({ params, searchParams }: Props) {
  const department = resolveDepartment((await params).department);
  return (
    <ShopView
      path={`/shop/${department}`}
      title={DEPARTMENTS[department].name}
      department={department}
      params={await searchParams}
    />
  );
}
