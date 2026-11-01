import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_TYPES, type ProductType } from "@/lib/bespoke/design";
import { BESPOKE_STATUS_LABELS, BESPOKE_STATUSES, bespokeRef } from "@/lib/bespoke/status";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { awaitingReply } from "@/lib/server/bespoke";
import { countryName } from "@/lib/validation";
import { AdminTitle, controlClass, Empty, Filters, linkClass, Pagination, Table, Tag } from "../_components/ui";
import { dateTime, param, type SearchParams } from "../_lib/format";
import { countBespoke, listBespoke, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Bespoke" };

export default async function AdminBespoke({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const status = param(search, "status");
  const total = await countBespoke(status);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listBespoke(status, offset);
  const waiting = await awaitingReply(rows.map((row) => row.id));

  return (
    <>
      <AdminTitle sub="Designs customers drew from scratch at /studio/create.">Bespoke</AdminTitle>
      <Filters path="/admin/bespoke">
        <label className="grid gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status} className={`${controlClass} w-48`}>
            <option value="">All statuses</option>
            {BESPOKE_STATUSES.map((value) => (
              <option key={value} value={value}>{BESPOKE_STATUS_LABELS[value]}</option>
            ))}
          </select>
        </label>
      </Filters>

      {rows.length ? (
        <>
          <Table caption="Bespoke requests" head={["Reference", "Received", "Customer", "Product", "Estimate", "Quoted", "Status"]} minWidth="min-w-[860px]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/admin/bespoke/${row.id}`} className={linkClass}>{bespokeRef(row.number)}</Link></td>
                <td className="whitespace-nowrap">{dateTime(row.createdAt)}</td>
                <td>
                  {row.name}
                  <span className="block text-xs text-muted">{row.email}, {countryName(row.country)}</span>
                </td>
                <td>{PRODUCT_TYPES[row.productType as ProductType] ?? row.productType}</td>
                <td className="whitespace-nowrap tabular-nums">{money(row.estimateLowCents)} to {money(row.estimateHighCents)}</td>
                <td className="tabular-nums">{row.quotedPriceCents ? money(row.quotedPriceCents) : <span className="text-muted">None</span>}</td>
                <td className="whitespace-nowrap">
                  <Tag tone={row.status === "declined" ? "muted" : "plain"}>{BESPOKE_STATUS_LABELS[row.status]}</Tag>
                  {waiting.has(row.id) ? <span className="ml-1"><Tag tone="danger">Awaiting reply</Tag></span> : null}
                </td>
              </tr>
            ))}
          </Table>
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
