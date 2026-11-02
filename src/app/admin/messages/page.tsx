import { CalendarBlank, ChatCircleDots, EnvelopeOpen, Tray } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { setMessageHandled } from "@/lib/actions/admin";
import { CONTACT_TOPICS } from "@/lib/policy";
import { requireAdmin } from "@/lib/server/auth";
import { ActionButton } from "../_components/controls";
import { FilterSelect, hrefWith, Person, PillTabs } from "../_components/people-ui";
import { AdminTitle, Empty, Filters, ghostButtonClass, MetricCard, Pagination, Section, StatGrid, StatusDot, Table, Tag } from "../_components/ui";
import { dateTime, param, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countMessages, listMessages, messageStats } from "../_lib/queries-people";

export const metadata: Metadata = { title: "Messages" };

const PATH = "/admin/messages";

export default async function AdminMessages({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const q = param(search, "q");
  const status = param(search, "status");
  const topic = param(search, "topic");
  const [total, stats] = await Promise.all([countMessages(search), messageStats()]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listMessages(search, offset);
  const tab = (label: string, value: string, count: number) => ({ label, count, href: hrefWith(PATH, search, { status: value }), active: status === value });

  return (
    <>
      <AdminTitle sub="Questions sent through your contact form. Open ones come first.">Messages</AdminTitle>
      <StatGrid>
        <MetricCard label="All messages" value={stats.total.toLocaleString("en-US")} icon={<Tray size={20} />} />
        <MetricCard label="Open" value={stats.open.toLocaleString("en-US")} icon={<ChatCircleDots size={20} />} href={`${PATH}?status=open`} />
        <MetricCard label="Not replied" value={stats.unreplied.toLocaleString("en-US")} icon={<EnvelopeOpen size={20} />} href={`${PATH}?status=unreplied`} />
        <MetricCard label="This week" value={stats.recent.toLocaleString("en-US")} icon={<CalendarBlank size={20} />} />
      </StatGrid>
      <Section title="Inbox" description={`${total.toLocaleString("en-US")} found`}>
        <PillTabs
          label="Filter by status"
          tabs={[tab("All", "", stats.total), tab("Open", "open", stats.open), tab("Not replied", "unreplied", stats.unreplied), tab("Replied", "replied", stats.replied), tab("Done", "handled", stats.handled)]}
        />
        <Filters path={PATH} q={q} placeholder="Name, email or text">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <FilterSelect label="Topic" name="topic" value={topic} options={[["", "All topics"], ...CONTACT_TOPICS.map((value): [string, string] => [value, value])]} width="sm:w-44" />
        </Filters>
        {rows.length ? (
          <>
            <div className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(3)]:hidden max-sm:[&_:is(th,td):nth-child(4)]:hidden max-sm:[&_:is(th,td):nth-child(6)]:hidden">
            <Table caption="Contact messages" head={["From", "Topic", "Message", "Received", "Status", "Action"]} minWidth="sm:min-w-[900px]">
              {rows.map((message) => (
                <tr key={message.id}>
                  <td><Person name={message.name} detail={message.email} href={`${PATH}/${message.id}`} /></td>
                  <td>{message.topic}</td>
                  <td className="max-w-[50ch] break-words"><span className="line-clamp-2 text-muted">{message.message}</span></td>
                  <td className="whitespace-nowrap text-muted">{dateTime(message.createdAt)}</td>
                  <td className="whitespace-nowrap">
                    <span className="flex gap-1">
                      {message.handled ? <StatusDot tone="muted">Done</StatusDot> : <StatusDot tone="warn">Open</StatusDot>}
                      {message.repliedAt ? <Tag tone="muted">Replied</Tag> : null}
                    </span>
                  </td>
                  <td>
                    <ActionButton action={setMessageHandled.bind(null, message.id, !message.handled)}>
                      {message.handled ? "Reopen" : "Mark as done"}
                    </ActionButton>
                  </td>
                </tr>
              ))}
            </Table>
            </div>
            <Pagination path={PATH} search={search} page={page} last={last} total={total} />
          </>
        ) : q || status || topic ? (
          <Empty title="No messages match" body="Change the filters or clear them." action={<a href={PATH} className={ghostButtonClass}>Clear filters</a>} />
        ) : (
          <Empty title="No messages yet" body="Messages from the contact form appear here." />
        )}
      </Section>
    </>
  );
}
