import type { Metadata } from "next";
import Link from "next/link";
import { money, orderRef } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, Empty, Section, StatusBadge, Table, Tag, linkClass } from "./_components/ui";
import { dateTime } from "./_lib/format";
import { dashboardNumbers, LOW_STOCK_LIMIT, NEEDS_ACTION_FILTER } from "./_lib/queries";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, note, href }: { label: string; value: string; note: string; href?: string }) {
  return (
    <div className="bg-bg p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl tabular-nums">{href ? <Link href={href} className={linkClass}>{value}</Link> : value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}

export default async function AdminDashboard() {
  await requireAdmin();
  const data = await dashboardNumbers();

  return (
    <>
      <AdminTitle sub="Revenue counts confirmed, in-atelier, shipped and delivered orders. Cancelled and refunded orders are left out.">Dashboard</AdminTitle>

      <div className="grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Revenue" value={money(data.revenue)} note="All time" />
        <Stat label="Paid orders" value={String(data.paidOrders)} note="All time" />
        <Stat label="Average order" value={data.averageOrder === null ? "None yet" : money(data.averageOrder)} note="Revenue per paid order" />
        <Stat label="Needs action" value={String(data.needsAction)} note="Confirmed or in the atelier, not shipped" href={`/admin/orders?status=${NEEDS_ACTION_FILTER}`} />
        <Stat label="Low stock" value={String(data.lowStockCount)} note={`Active variants at ${LOW_STOCK_LIMIT} or fewer`} href="/admin/inventory?low=1" />
      </div>

      <Section title="Recent orders" action={<Link href="/admin/orders" className={`text-sm ${linkClass}`}>All orders</Link>}>
        {data.recentOrders.length ? (
          <Table caption="Recent orders" head={["Reference", "Placed", "Email", "Status", "Total"]}>
            {data.recentOrders.map((order) => (
              <tr key={order.id}>
                <td><Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link></td>
                <td className="whitespace-nowrap">{dateTime(order.createdAt)}</td>
                <td>{order.email ?? "None"}</td>
                <td><StatusBadge status={order.status} /></td>
                <td className="tabular-nums">{money(order.totalCents)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No orders yet" body="Orders appear here as soon as a customer checks out." />
        )}
      </Section>

      <Section title="Low-stock variants" action={<Link href="/admin/inventory?low=1" className={`text-sm ${linkClass}`}>All low stock</Link>}>
        {data.lowVariants.length ? (
          <Table caption="Low-stock variants" head={["Product", "SKU", "Colour", "Size", "Stock"]}>
            {data.lowVariants.map((variant) => (
              <tr key={variant.id}>
                <td><Link href={`/admin/products/${variant.productId}`} className={linkClass}>{variant.productName}</Link></td>
                <td className="whitespace-nowrap">{variant.sku}</td>
                <td>{variant.color}</td>
                <td>{variant.size}</td>
                <td>{variant.stock === 0 ? <Tag tone="danger">Sold out</Tag> : <span className="tabular-nums">{variant.stock}</span>}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Stock looks healthy" body={`No active variant is at ${LOW_STOCK_LIMIT} or fewer.`} />
        )}
      </Section>
    </>
  );
}
