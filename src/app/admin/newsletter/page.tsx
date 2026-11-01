import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, buttonClass, Empty, Pagination, Table } from "../_components/ui";
import { dateTime, type SearchParams } from "../_lib/format";
import { countSubscribers, listSubscribers, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Newsletter" };

export default async function AdminNewsletter({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const total = await countSubscribers();
  const { page, last, offset } = pageOf(search, total);
  const rows = await listSubscribers(offset);

  return (
    <>
      <AdminTitle action={total ? <a href="/admin/newsletter/export" className={buttonClass}>Export CSV</a> : undefined}>Newsletter</AdminTitle>
      {rows.length ? (
        <>
          <Table caption="Newsletter subscribers" head={["Email", "Subscribed"]} minWidth="min-w-[420px]">
            {rows.map((subscriber) => (
              <tr key={subscriber.email}>
                <td>{subscriber.email}</td>
                <td className="whitespace-nowrap">{dateTime(subscriber.createdAt)}</td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/newsletter" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty title="No subscribers yet" body="People who join the newsletter appear here." />
      )}
    </>
  );
}
