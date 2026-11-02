import { StandardPageView } from "@/components/standard-page";
import { getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/size-guide");

export default async function SizeGuidePage() {
  return <StandardPageView page={await getContent("page.size-guide")} />;
}
