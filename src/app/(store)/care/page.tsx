import { StandardPageView } from "@/components/standard-page";
import { getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/care");

export default async function CarePage() {
  return <StandardPageView page={await getContent("page.care")} />;
}
