import { CalendarPlus, EnvelopeSimple, Megaphone, PaperPlaneTilt, PencilSimple, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { removeNewsletterSubscriber } from "@/lib/actions/admin-people";
import { requireAdmin } from "@/lib/server/auth";
import { listCampaigns } from "@/lib/server/campaigns";
import { ConfirmButton, MoreMenu } from "../_components/people-controls";
import { CAMPAIGN_STATE, hrefWith, LineTabs } from "../_components/people-ui";
import { AdminTitle, buttonClass, Empty, Filters, linkClass, MetricCard, Pagination, primaryButtonClass, StatGrid, StatusDot, Table } from "../_components/ui";
import { dateTime, param, shortDate, type SearchParams } from "../_lib/format";
import { pageOf } from "../_lib/queries";
import { countSubscribers, listSubscribers, subscriberStats } from "../_lib/queries-people";

export const metadata: Metadata = { title: "Newsletter" };

const PATH = "/admin/newsletter";

export default async function AdminNewsletter({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const q = param(search, "q");
  const view = param(search, "view") === "campaigns" ? "campaigns" : "subscribers";
  const [total, campaigns, stats] = await Promise.all([countSubscribers(q), listCampaigns(), subscriberStats()]);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listSubscribers(q, offset);
  const delivered = campaigns.reduce((sum, campaign) => sum + campaign.sent, 0);
  const unfinished = campaigns.filter((campaign) => campaign.status !== "done").length;

  return (
    <>
      <AdminTitle
        sub="The people on your mailing list and the newsletters you send them."
        action={(
          <>
            {total ? <MoreMenu><a href={`/admin/newsletter/export${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="adm-menu-item">Download subscribers (CSV)</a></MoreMenu> : null}
            <Link href="/admin/newsletter/compose" className={primaryButtonClass}><PencilSimple size={14} aria-hidden="true" />Write a newsletter</Link>
          </>
        )}
      >
        Newsletter
      </AdminTitle>
      <StatGrid>
        <MetricCard label="Subscribers" value={stats.total.toLocaleString("en-US")} icon={<UsersThree size={20} />} />
        <MetricCard label="New, last 30 days" value={stats.recent.toLocaleString("en-US")} icon={<CalendarPlus size={20} />} />
        <MetricCard label="Newsletters" value={campaigns.length} icon={<Megaphone size={20} />} href={`${PATH}?view=campaigns`} description={unfinished ? `${unfinished} not finished` : undefined} />
        <MetricCard label="Emails sent" value={delivered.toLocaleString("en-US")} icon={<PaperPlaneTilt size={20} />} />
      </StatGrid>
      <div className="mt-6">
        <LineTabs
          label="Newsletter sections"
          tabs={[
            { label: "Subscribers", icon: EnvelopeSimple, href: hrefWith(PATH, search, { view: "" }), active: view === "subscribers", count: total },
            { label: "Newsletters", icon: Megaphone, href: hrefWith(PATH, search, { view: "campaigns" }), active: view === "campaigns", count: campaigns.length },
          ]}
        />
      </div>
      {view === "subscribers" ? (
        <>
          <Filters path={PATH} q={q} placeholder="Email" />
          {rows.length ? (
            <>
              <div className="max-sm:[&_:is(th,td):nth-child(2)]:hidden">
              <Table caption="Newsletter subscribers" head={["Email", "Joined", "Action"]} minWidth="sm:min-w-[520px]">
                {rows.map((subscriber) => (
                  <tr key={subscriber.email}>
                    <td className="break-all">{subscriber.email}</td>
                    <td className="whitespace-nowrap text-muted">{dateTime(subscriber.createdAt)}</td>
                    <td><ConfirmButton action={removeNewsletterSubscriber.bind(null, subscriber.email)} label="Remove" confirmLabel="Yes, remove" warning="They will stop getting your newsletters." /></td>
                  </tr>
                ))}
              </Table>
              </div>
              <Pagination path={PATH} search={search} page={page} last={last} total={total} />
            </>
          ) : q ? (
            <Empty title="No subscribers match" body="Try a different email." />
          ) : (
            <Empty title="No subscribers yet" body="People who join the newsletter appear here." />
          )}
        </>
      ) : campaigns.length ? (
        <div className="max-sm:[&_:is(th,td):nth-child(2)]:hidden max-sm:[&_:is(th,td):nth-child(5)]:hidden">
        <Table caption="Newsletters" head={["Subject", "Started", "Status", "Sent", "Failed"]} right={["Sent", "Failed"]} minWidth="sm:min-w-[560px]">
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <td className="break-words"><Link href={`/admin/newsletter/campaigns/${campaign.id}`} className={linkClass}>{campaign.subject}</Link></td>
              <td className="whitespace-nowrap text-muted">{shortDate(campaign.createdAt)}</td>
              <td><StatusDot tone={CAMPAIGN_STATE[campaign.status].tone}>{CAMPAIGN_STATE[campaign.status].label}</StatusDot></td>
              <td className="whitespace-nowrap tabular-nums">{campaign.sent} of {campaign.total}</td>
              <td className="tabular-nums">{campaign.failed.length}</td>
            </tr>
          ))}
        </Table>
        </div>
      ) : <Empty title="No newsletters yet" body="Newsletters you send appear here." action={<Link href="/admin/newsletter/compose" className={buttonClass}>Write a newsletter</Link>} />}
    </>
  );
}
