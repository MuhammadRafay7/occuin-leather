import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { CONTENT, getContent } from "@/lib/server/content";
import { AdminTitle } from "../../_components/ui";
import { NavEditor } from "./nav-form";

export const metadata: Metadata = { title: "Menus" };

export default async function ContentNavigation() {
  await requireAdmin();
  return (
    <>
      <AdminTitle sub="The links at the top and bottom of your site.">Menus</AdminTitle>
      <NavEditor initial={await getContent("nav")} fallback={CONTENT.nav.fallback} />
    </>
  );
}
