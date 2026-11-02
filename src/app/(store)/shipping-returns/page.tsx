import { StandardPageView } from "@/components/standard-page";
import { getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/shipping-returns");

export default async function ShippingReturnsPage() {
  return <StandardPageView page={await getContent("page.shipping-returns")} />;
}
