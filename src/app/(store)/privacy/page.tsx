import { StandardPageView } from "@/components/standard-page";
import { getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/privacy");

export default async function PrivacyPage() {
  return <StandardPageView page={await getContent("page.privacy")} />;
}
