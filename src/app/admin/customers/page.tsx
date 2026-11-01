import type { Metadata } from "next";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, Empty, Pagination, Table, Tag } from "../_components/ui";
import { shortDate, type SearchParams } from "../_lib/format";
import { countCustomers, listCustomers, pageOf } from "../_lib/queries";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const search = await searchParams;
  const total = await countCustomers();
  const { page, last, offset } = pageOf(search, total);
  const rows = await listCustomers(offset);

  return (
    <>
      <AdminTitle sub="Account holders only. Total spent leaves out unpaid, cancelled and refunded orders.">Customers</AdminTitle>
      {rows.length ? (
        <>
          <Table caption="Customers" head={["Name", "Email", "Role", "Joined", "Orders", "Total spent"]}>
            {rows.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name}</td>
                <td>{customer.email}</td>
                <td>{customer.role === "admin" ? <Tag>Admin</Tag> : <span className="text-muted">Customer</span>}</td>
                <td className="whitespace-nowrap">{shortDate(customer.createdAt)}</td>
                <td className="tabular-nums">{customer.orderCount}</td>
                <td className="tabular-nums">{money(customer.spentCents)}</td>
              </tr>
            ))}
          </Table>
          <Pagination path="/admin/customers" search={search} page={page} last={last} total={total} />
        </>
      ) : (
        <Empty title="No customers yet" body="People appear here when they create an account." />
      )}
    </>
  );
}
