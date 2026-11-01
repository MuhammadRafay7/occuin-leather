import type { Metadata } from "next";
import { setMessageHandled } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/server/auth";
import { ActionButton } from "../_components/controls";
import { AdminTitle, Empty, linkClass, Pagination, Table, Tag } from "../_components/ui";
import { dateTime, type SearchParams } from "../_lib/format";
import { countMessages, listMessages, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Messages" };

export default async function AdminMessages({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const total = await countMessages();
  const { page, last, offset } = pageOf(search, total);
  const rows = await listMessages(offset);

  return (
    <>
      <AdminTitle sub="Open messages come first.">Messages</AdminTitle>
      {rows.length ? (
        <>
          <Table caption="Contact messages" head={["From", "Topic", "Message", "Received", "Status", "Action"]} minWidth="min-w-[900px]">
            {rows.map((message) => (
              <tr key={message.id}>
                <td>
                  {message.name}
                  <a href={`mailto:${message.email}`} className={`block text-xs ${linkClass}`}>{message.email}</a>
                </td>
                <td>{message.topic}</td>
                <td className="max-w-[50ch] whitespace-pre-wrap break-words">{message.message}</td>
                <td className="whitespace-nowrap">{dateTime(message.createdAt)}</td>
                <td><Tag tone={message.handled ? "muted" : "plain"}>{message.handled ? "Handled" : "Open"}</Tag></td>
                <td>
                  <ActionButton action={setMessageHandled.bind(null, message.id, !message.handled)}>
                    {message.handled ? "Reopen" : "Mark handled"}
                  </ActionButton>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/messages" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty title="No messages yet" body="Messages from the contact form appear here." />
      )}
    </>
  );
}
