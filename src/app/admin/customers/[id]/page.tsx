import { ArrowLeft, ChatTeardropText, CurrencyDollar, GearSix, House, MapPin, Note, Receipt, Scissors, ShoppingBag, Star, UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { bespokeRef } from "@/lib/bespoke/status";
import { money, orderRef } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { Avatar, FlushTable, IconHeading, LineTabs } from "../../_components/people-ui";
import { AdminTitle, BespokeBadge, DetailGrid, linkClass, MetricCard, Pairs, Panel, StatGrid, StatusBadge, StatusDot, Tag } from "../../_components/ui";
import { dateTime, param, shortDate, type SearchParams } from "../../_lib/format";
import { getCustomerProfile } from "../../_lib/queries-people";
import { CustomerActions, StaffNote } from "./customer-actions";

export const metadata: Metadata = { title: "Customer" };

const RECENT = 5;
const TABS = ["overview", "orders", "bespoke", "reviews", "account"] as const;
type TabName = (typeof TABS)[number];

type Profile = NonNullable<Awaited<ReturnType<typeof getCustomerProfile>>>;

function OrdersPanel({ orders, email, guestOrders, viewAll }: { orders: Profile["orders"]; email: string; guestOrders: number; viewAll?: string }) {
  const action = guestOrders
    ? <Link href={{ pathname: "/admin/orders", query: { q: email } }} className={`text-xs ${linkClass}`}>{guestOrders} more placed as a guest with this email</Link>
    : viewAll ? <Link href={viewAll} className={`text-xs ${linkClass}`}>View all</Link> : undefined;
  return (
    <Panel title={<IconHeading icon={Receipt}>Orders</IconHeading>} flush={orders.length > 0} action={action}>
      {orders.length ? (
        <FlushTable caption="Orders" head={["Order", "Placed", "Status", "Total"]} right={4} minWidth="min-w-[480px]">
          {orders.map((order) => (
            <tr key={order.id}>
              <td><Link href={`/admin/orders/${order.id}`} className={linkClass}>{orderRef(order.number)}</Link></td>
              <td className="whitespace-nowrap text-muted">{shortDate(order.createdAt)}</td>
              <td><StatusBadge status={order.status} /></td>
              <td className="tabular-nums">{money(order.totalCents)}</td>
            </tr>
          ))}
        </FlushTable>
      ) : <p className="text-muted">This customer has not ordered with this account.</p>}
    </Panel>
  );
}

function BespokePanel({ requests, viewAll }: { requests: Profile["requests"]; viewAll?: string }) {
  return (
    <Panel title={<IconHeading icon={Scissors}>Bespoke requests</IconHeading>} flush={requests.length > 0} action={viewAll ? <Link href={viewAll} className={`text-xs ${linkClass}`}>View all</Link> : undefined}>
      {requests.length ? (
        <FlushTable caption="Bespoke requests" head={["Request", "Piece", "Status", "Quote", "Received"]} right={4} minWidth="min-w-[560px]">
          {requests.map((request) => (
            <tr key={request.id}>
              <td><Link href={`/admin/bespoke/${request.id}`} className={linkClass}>{bespokeRef(request.number)}</Link></td>
              <td>{request.productType}</td>
              <td><BespokeBadge status={request.status} /></td>
              <td className="tabular-nums">{request.quotedPriceCents ? money(request.quotedPriceCents) : <span className="text-muted">None</span>}</td>
              <td className="whitespace-nowrap text-muted">{shortDate(request.createdAt)}</td>
            </tr>
          ))}
        </FlushTable>
      ) : <p className="text-muted">Requests from this account or email appear here.</p>}
    </Panel>
  );
}

function ReviewsPanel({ reviews }: { reviews: Profile["reviews"] }) {
  return (
    <Panel title={<IconHeading icon={Star}>Reviews</IconHeading>} flush={reviews.length > 0}>
      {reviews.length ? (
        <ul className="adm-rows">
          {reviews.map((review) => (
            <li key={review.id} className="p-4">
              <p className="flex flex-wrap items-center gap-2">
                <Link href={`/product/${review.productSlug}`} className={linkClass}>{review.productName}</Link>
                <span className="tabular-nums text-muted">{review.rating} of 5</span>
                {review.hiddenAt ? <Tag tone="muted">Hidden</Tag> : null}
              </p>
              <p className="mt-1 font-medium">{review.title}</p>
              <p className="whitespace-pre-wrap break-words text-muted">{review.body}</p>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">This customer has not reviewed a product.</p>}
    </Panel>
  );
}

export default async function AdminCustomer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const actor = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCustomerProfile(id);
  if (!profile) notFound();
  const { customer, orders, addresses, requests, reviews, guestOrders } = profile;
  const requested = param(await searchParams, "tab") as TabName;
  const tab: TabName = TABS.includes(requested) ? requested : "overview";
  const path = `/admin/customers/${customer.id}`;
  const tabHref = (name: TabName) => (name === "overview" ? path : `${path}?tab=${name}`);

  return (
    <>
      <Link href="/admin/customers" className="adm-back"><ArrowLeft size={12} aria-hidden="true" />Customers</Link>
      <div className="flex items-start gap-3 sm:gap-4">
        <Avatar name={customer.name} className="size-12 text-base sm:size-16 sm:text-xl" />
        <div className="min-w-0 flex-1">
          <AdminTitle
            sub={<span className="break-all">{customer.email}, joined {shortDate(customer.createdAt)}</span>}
            meta={(
              <>
                {customer.role === "admin" ? <Tag>Admin</Tag> : null}
                {customer.blockedAt ? <StatusDot tone="danger">Blocked</StatusDot> : <StatusDot tone="success">Active</StatusDot>}
              </>
            )}
          >
            {customer.name}
          </AdminTitle>
        </div>
      </div>
      {customer.blockedAt ? <p role="status" className="adm-notice mb-3" data-tone="danger">Blocked on {dateTime(customer.blockedAt)}.</p> : null}

      <LineTabs
        label="Customer sections"
        tabs={[
          { label: "Overview", icon: House, href: tabHref("overview"), active: tab === "overview" },
          { label: "Orders", icon: Receipt, href: tabHref("orders"), active: tab === "orders", count: orders.length },
          { label: "Bespoke", icon: Scissors, href: tabHref("bespoke"), active: tab === "bespoke", count: requests.length },
          { label: "Reviews", icon: Star, href: tabHref("reviews"), active: tab === "reviews", count: reviews.length },
          { label: "Manage account", icon: GearSix, href: tabHref("account"), active: tab === "account" },
        ]}
      />

      <DetailGrid
        main={(
          <>
            {tab === "overview" ? (
              <>
                <StatGrid columns={3}>
                  <MetricCard label="Total spent" value={money(customer.spentCents)} icon={<CurrencyDollar size={20} />} />
                  <MetricCard label="Orders" value={customer.orderCount} icon={<ShoppingBag size={20} />} href={tabHref("orders")} />
                  <MetricCard label="Bespoke requests" value={requests.length} icon={<ChatTeardropText size={20} />} href={tabHref("bespoke")} />
                </StatGrid>
                <OrdersPanel orders={orders.slice(0, RECENT)} email={customer.email} guestOrders={guestOrders} viewAll={orders.length > RECENT ? tabHref("orders") : undefined} />
                <BespokePanel requests={requests.slice(0, RECENT)} viewAll={requests.length > RECENT ? tabHref("bespoke") : undefined} />
              </>
            ) : null}
            {tab === "orders" ? <OrdersPanel orders={orders} email={customer.email} guestOrders={guestOrders} /> : null}
            {tab === "bespoke" ? <BespokePanel requests={requests} /> : null}
            {tab === "reviews" ? <ReviewsPanel reviews={reviews} /> : null}
            {tab === "account" ? (
              <CustomerActions
                userId={customer.id}
                email={customer.email}
                isAdmin={customer.role === "admin"}
                blocked={Boolean(customer.blockedAt)}
                isSelf={customer.id === actor.id}
              />
            ) : null}
          </>
        )}
        side={(
          <>
            <Panel title={<IconHeading icon={UserCircle}>Profile</IconHeading>}>
              <Pairs
                rows={[
                  ["Type", customer.role === "admin" ? "Admin" : "Customer"],
                  ["Status", customer.blockedAt ? "Blocked" : "Active"],
                  ["Joined", shortDate(customer.createdAt)],
                  ["Addresses", addresses.length],
                ]}
              />
            </Panel>
            <Panel title={<IconHeading icon={Note}>Private note</IconHeading>}>
              <StaffNote userId={customer.id} note={customer.adminNote} />
            </Panel>
            <Panel title={<IconHeading icon={MapPin}>Addresses</IconHeading>} flush={addresses.length > 0}>
              {addresses.length ? (
                <ul className="adm-rows">
                  {addresses.map(({ id: addressId, address, isDefault }) => (
                    <li key={addressId} className="p-4">
                      {isDefault ? <p className="mb-1"><Tag tone="muted">Default</Tag></p> : null}
                      <p>{address.name}</p>
                      <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                      <p>{address.city}{address.state ? `, ${address.state}` : ""} {address.postalCode}</p>
                      <p>{address.country}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted">This customer has not saved an address.</p>}
            </Panel>
          </>
        )}
      />
    </>
  );
}
