import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/server/auth";
import { listContentStatus } from "@/lib/server/content";
import { AdminTitle, linkClass, Table, Tag } from "../../_components/ui";
import { dateTime } from "../../_lib/format";
import { describeStatus, pageKey, PAGE_SLUGS } from "../_components/page-list";

export const metadata: Metadata = { title: "Pages" };

export default async function ContentPages() {
  await requireAdmin();
  const rows = await listContentStatus();
  return (
    <>
      <AdminTitle sub="Pick a page to change its words.">Pages</AdminTitle>
      <Table caption="Written pages" head={["Page", "Status", "Last saved", "On the site"]} minWidth="min-w-[560px]">
        {PAGE_SLUGS.map((slug) => {
          const { label, preview, row } = describeStatus(pageKey(slug), rows);
          return (
            <tr key={slug}>
              <td><Link href={`/admin/content/pages/${slug}`} className={linkClass}>{label}</Link></td>
              <td><Tag tone={row ? "plain" : "muted"}>{row ? "Changed" : "Original"}</Tag></td>
              <td className="text-muted">{row ? dateTime(row.updatedAt) : "Never"}</td>
              <td><a href={preview} target="_blank" rel="noopener noreferrer" className={linkClass}>See it</a></td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
