import { Bell, PencilRuler, Scissors } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_TYPES, type ProductType } from "@/lib/bespoke/design";
import { BESPOKE_STATUS_LABELS, BESPOKE_STATUSES, bespokeRef, type BespokeStatus } from "@/lib/bespoke/status";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { awaitingReply } from "@/lib/server/bespoke";
import { AdminTitle, BespokeBadge, Empty, linkClass, MetricCard, Pagination, Table, Tag as StatusTag } from "../_components/ui";
import { param, shortDate, type SearchParams } from "../_lib/format";
import { countBespoke, listBespoke, pageOf } from "../_lib/queries";
import { DesktopOnly, FilterTabs, MobileCard, MobileCards, StatStrip, ViewLink } from "../orders/sales-ui";

export const metadata: Metadata = { title: "Bespoke" };

const MAIN_STATUSES: BespokeStatus[] = ["new", "changes_requested", "quoted", "in_production"];
const WAITING_ON_US: BespokeStatus[] = ["new", "question", "changes_requested"];
const toTab = (value: BespokeStatus) => ({ label: BESPOKE_STATUS_LABELS[value], value: value as string });
const MAIN_TABS = [{ label: "All", value: "" }, ...MAIN_STATUSES.map(toTab)];
const STATUS_TABS = [...MAIN_TABS, ...BESPOKE_STATUSES.filter((value) => !MAIN_STATUSES.includes(value)).map(toTab)];

const countOf = (counts: number[], value: string) => counts[STATUS_TABS.findIndex((tab) => tab.value === value)] ?? 0;

export default async function AdminBespoke({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const status = param(search, "status");
  const total = await countBespoke(status);
  const { page, last, offset } = pageOf(search, total);
  const [rows, counts] = await Promise.all([listBespoke(status, offset), Promise.all(STATUS_TABS.map((tab) => countBespoke(tab.value)))]);
  const waiting = await awaitingReply(rows.map((row) => row.id));
  const tabs = STATUS_TABS.map((tab, index) => ({
    label: tab.label,
    count: counts[index],
    active: status === tab.value,
    href: { pathname: "/admin/bespoke", query: tab.value ? { status: tab.value } : {} },
  }));

  return (
    <>
      <AdminTitle sub="Custom designs customers sent from the studio. Open one to reply and send a price.">Bespoke</AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<Bell size={16} />} label="Waiting for you" value={WAITING_ON_US.reduce((sum, value) => sum + countOf(counts, value), 0)} description="New, questions and change requests" />
        <MetricCard icon={<Scissors size={16} />} label="Being made" value={countOf(counts, "in_production")} href="/admin/bespoke?status=in_production" />
        <MetricCard icon={<PencilRuler size={16} />} label="All requests" value={countOf(counts, "")} href="/admin/bespoke" />
      </StatStrip>

      <FilterTabs label="Request status" tabs={tabs.slice(0, MAIN_TABS.length)} more={tabs.slice(MAIN_TABS.length)} />

      {rows.length ? (
        <>
          <DesktopOnly>
            <Table caption="Bespoke requests" head={["Request", "Customer", "Product", "Price", "Status", "Actions"]} right={["Price", "Actions"]}>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap">
                    <Link href={`/admin/bespoke/${row.id}`} className={linkClass}>{bespokeRef(row.number)}</Link>
                    <span className="block text-xs text-muted">{shortDate(row.createdAt)}</span>
                  </td>
                  <td>
                    {row.name}
                    <span className="block text-xs text-muted [overflow-wrap:anywhere]">{row.email}</span>
                  </td>
                  <td>{PRODUCT_TYPES[row.productType as ProductType] ?? row.productType}</td>
                  <td className="font-medium tabular-nums">{row.quotedPriceCents ? money(row.quotedPriceCents) : <span className="font-normal text-muted">Not priced</span>}</td>
                  <td>
                    <span className="flex flex-wrap gap-1">
                      <BespokeBadge status={row.status} />
                      {waiting.has(row.id) ? <StatusTag tone="danger">Awaiting reply</StatusTag> : null}
                    </span>
                  </td>
                  <td><ViewLink href={`/admin/bespoke/${row.id}`} label={`View ${bespokeRef(row.number)}`} /></td>
                </tr>
              ))}
            </Table>
          </DesktopOnly>
          <MobileCards label="Bespoke requests">
            {rows.map((row) => (
              <MobileCard
                key={row.id}
                title={<Link href={`/admin/bespoke/${row.id}`} className={linkClass}>{bespokeRef(row.number)}</Link>}
                sub={<><span className="block text-fg">{row.name}</span>{row.email}</>}
                chip={<><BespokeBadge status={row.status} />{waiting.has(row.id) ? <StatusTag tone="danger">Awaiting reply</StatusTag> : null}</>}
                rows={[
                  ["Product", PRODUCT_TYPES[row.productType as ProductType] ?? row.productType],
                  ["Price", row.quotedPriceCents ? money(row.quotedPriceCents) : "Not priced"],
                ]}
              >
                <ViewLink href={`/admin/bespoke/${row.id}`} label={`View ${bespokeRef(row.number)}`} />
              </MobileCard>
            ))}
          </MobileCards>
          <Pagination path="/admin/bespoke" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={status ? "No requests match" : "No bespoke requests yet"}
          body={status ? "Try another status." : "Designs sent from the studio appear here."}
        />
      )}
    </>
  );
}
