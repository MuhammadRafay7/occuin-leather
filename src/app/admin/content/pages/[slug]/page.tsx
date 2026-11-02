import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/server/auth";
import { CONTENT, getContent } from "@/lib/server/content";
import { AdminTitle } from "../../../_components/ui";
import { listMediaChoices } from "../../../_lib/queries-catalog";
import { isPageSlug, pageKey } from "../../_components/page-list";
import { AboutEditor, ContactEditor, FaqEditor, StandardEditor } from "./page-forms";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditContentPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();
  const key = pageKey(slug);
  const { label, preview } = CONTENT[key];
  const title = <AdminTitle sub="Change the words, then press Save. It updates the site straight away.">{label}</AdminTitle>;

  if (key === "page.about") {
    return <>{title}<AboutEditor initial={await getContent(key)} fallback={CONTENT[key].fallback} media={await listMediaChoices()} preview={preview} /></>;
  }
  if (key === "page.faq") return <>{title}<FaqEditor initial={await getContent(key)} fallback={CONTENT[key].fallback} preview={preview} /></>;
  if (key === "page.contact") return <>{title}<ContactEditor initial={await getContent(key)} fallback={CONTENT[key].fallback} preview={preview} /></>;
  return <>{title}<StandardEditor contentKey={key} initial={await getContent(key)} fallback={CONTENT[key].fallback} preview={preview} /></>;
}
