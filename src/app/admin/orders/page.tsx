import type { Metadata } from "next";
import Link from "next/link";
import { money, orderRef } from "@/lib/format";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, controlClass, Empty, Filters, linkClass, Pagination, StatusBadge, Table } from "../_components/ui";
import { dateTime, param, type SearchParams } from "../_lib/format";
import { countOrders, listOrders, NEEDS_ACTION_FILTER, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const status = param(search, "status");
  const q = param(search, "q");
  const total = await countOrders(status, q);
  const { page, last, offset } = pageOf(search, total);
  const rows = await listOrders(status, q, offset);

  return (
    <>
      <AdminTitle>Orders</AdminTitle>
      <Filters path="/admin/orders" q={q} placeholder="Reference or email">
        <label className="grid gap-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status} className={`${controlClass} w-48`}>
            <option value="">All statuses</option>
            <option value={NEEDS_ACTION_FILTER}>Needs action</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
        </label>
      </Filters>

      {rows.length ? (
        <>
          <Table caption="Orders" head={["Reference", "Placed", "Email", "Status", "Tracking", "Total"]}>
            {rows.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link></td>
                <td className="whitespace-nowrap">{dateTime(order.createdAt)}</td>
                <td>{order.email ?? "None"}</td>
                <td><StatusBadge status={order.status} /></td>
                <td className="text-muted">{order.trackingNumber ?? "None"}</td>
                <td className="tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/orders" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty
          title={status || q ? "No orders match" : "No orders yet"}
          body={status || q ? "Try another status or search term." : "Orders appear here as soon as a customer checks out."}
        />
      )}
    </>
  );
}
