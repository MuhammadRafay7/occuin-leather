import type { Metadata } from "next";
import { EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { listOrders } from "@/lib/server/orders";
import { OrderList } from "../order-list";

export const metadata: Metadata = { title: "Orders" };

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await listOrders(`u:${user.id}`);

  return (
    <>
      <PageTitle>Orders</PageTitle>
      {orders.length ? (
        <OrderList orders={orders} />
      ) : (
        <EmptyState title="No orders yet" body="Your orders will appear here." action={<LinkButton href="/shop/leather">Shop the collection</LinkButton>} />
      )}
    </>
  );
}
