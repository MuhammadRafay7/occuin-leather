import Link from "next/link";
import { longDate, money, orderRef } from "@/lib/format";
import { STATUS_LABELS, type OrderStatus } from "@/lib/order-status";

type Row = { id: string; number: number; status: OrderStatus; totalCents: number; createdAt: Date };

export function OrderList({ orders }: { orders: Row[] }) {
  return (
    <ul className="border-t border-line">
      {orders.map((order) => (
        <li key={order.id} className="border-b border-line">
          <Link href={`/orders/${order.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 text-sm hover:opacity-60">
            <span>{orderRef(order.number)}</span>
            <span>{money(order.totalCents)}</span>
            <span className="text-muted">{longDate(order.createdAt)}</span>
            <span className="text-muted">{STATUS_LABELS[order.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
