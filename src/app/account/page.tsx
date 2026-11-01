import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { LinkButton, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/server/auth";
import { db, schema } from "@/lib/server/db";
import { listOrders } from "@/lib/server/orders";
import { AddressCard } from "./address-card";
import { OrderList } from "./order-list";

const RECENT = 3;

export default async function AccountPage() {
  const user = await requireUser("/account");
  const orders = await listOrders(`u:${user.id}`);
  const [defaultAddress] = await db
    .select()
    .from(schema.addresses)
    .where(and(eq(schema.addresses.userId, user.id), eq(schema.addresses.isDefault, true)));

  return (
    <>
      <PageTitle sub={user.email}>Hello, {user.name}</PageTitle>
      <div className="grid gap-12">
        <section aria-labelledby="recent-title" className="grid gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="recent-title" className="font-display text-2xl">Recent orders</h2>
            {orders.length > RECENT ? <Link href="/account/orders" className="text-sm underline underline-offset-4">View all</Link> : null}
          </div>
          {orders.length ? <OrderList orders={orders.slice(0, RECENT)} /> : <p className="text-muted">You have no orders yet.</p>}
        </section>
        <section aria-labelledby="default-title" className="grid justify-items-start gap-4">
          <h2 id="default-title" className="font-display text-2xl">Default address</h2>
          {defaultAddress ? <AddressCard address={defaultAddress.address} /> : <p className="text-muted">You have no saved address yet.</p>}
          <LinkButton href="/account/addresses" look="outline">Manage addresses</LinkButton>
        </section>
      </div>
    </>
  );
}
