import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { CONTENT, getContent } from "@/lib/server/content";
import { AdminTitle } from "../../_components/ui";
import { RedirectsEditor } from "./redirects-form";

export const metadata: Metadata = { title: "Old links" };

export default async function ContentRedirects() {
  await requireAdmin();
  return (
    <>
      <AdminTitle sub="Moved a page? Send people from the old page to the new one, so old links keep working. Can take up to a minute to start.">Old links</AdminTitle>
      <RedirectsEditor initial={await getContent("redirects")} fallback={CONTENT.redirects.fallback} />
    </>
  );
}
