import { StandardPageView } from "@/components/standard-page";
import { getContent, pageMetadata } from "@/lib/server/content";

export const generateMetadata = () => pageMetadata("/terms");

export default async function TermsPage() {
  return <StandardPageView page={await getContent("page.terms")} />;
}
