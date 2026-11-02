import type { Icon } from "@phosphor-icons/react";
import { ChatCircleText, MagnifyingGlass, Receipt, Scissors, ShoppingBag, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { bespokeRef } from "@/lib/bespoke/status";
import { money, orderRef } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { IconHeading } from "../_components/people-ui";
import { AdminTitle, BespokeBadge, controlClass, Empty, linkClass, Panel, primaryButtonClass, StatusBadge, StatusDot, Tag } from "../_components/ui";
import { param, type SearchParams } from "../_lib/format";
import { MIN_SEARCH_LENGTH, SEARCH_RESULT_LIMIT, searchEverything } from "../_lib/queries-people";

export const metadata: Metadata = { title: "Search" };

function Results({ id, title, icon, count, all, children }: { id: string; title: string; icon: Icon; count: number; all: string; children: ReactNode }) {
  if (!count) return null;
  return (
    <div id={id} className="scroll-mt-20">
      <Panel
        flush
        title={<IconHeading icon={icon}>{title} ({count === SEARCH_RESULT_LIMIT ? `first ${count}` : count})</IconHeading>}
        action={count === SEARCH_RESULT_LIMIT ? <Link href={all} className={`text-xs ${linkClass}`}>See all</Link> : undefined}
      >
        <ul className="adm-rows">{children}</ul>
      </Panel>
    </div>
  );
}

const Row = ({ href, title, meta, tag }: { href: string; title: string; meta: string; tag?: ReactNode }) => (
  <li>
    <Link href={href} className="adm-rowlink flex-wrap justify-between">
      <span className="min-w-0">
        <span className="font-medium">{title}</span>
        <span className="ml-2 break-all text-xs text-muted">{meta}</span>
      </span>
      {tag}
    </Link>
  </li>
);

export default async function AdminSearch({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const q = param(await searchParams, "q").slice(0, 120);
  const results = q.length >= MIN_SEARCH_LENGTH ? await searchEverything(q) : null;
  const encoded = encodeURIComponent(q);
  const found = results ? Object.values(results).reduce((sum, list) => sum + list.length, 0) : 0;
  const jumps = results ? ([["orders", "Orders", results.orders.length], ["customers", "Customers", results.customers.length], ["products", "Products", results.products.length], ["bespoke", "Bespoke", results.bespoke.length], ["messages", "Messages", results.messages.length]] as const).filter(([, , count]) => count) : [];

  return (
    <>
      <AdminTitle sub="Find any order, customer, product, bespoke request or message.">Search</AdminTitle>
      <Form action="/admin/search" className="adm-filters">
        <span className="relative block min-w-0 flex-1">
          <MagnifyingGlass size={14} aria-hidden="true" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" type="search" defaultValue={q} aria-label="Search" placeholder="Order number, name, email or product code" className={`${controlClass} pl-7`} />
        </span>
        <button type="submit" className={primaryButtonClass}>Search</button>
      </Form>
      {!results ? (
        <Empty title="Search the store" body={`Enter at least ${MIN_SEARCH_LENGTH} characters.`} />
      ) : !found ? (
        <Empty title="Nothing found" body={`No results for "${q}".`} />
      ) : (
        <>
          <nav aria-label="Jump to results" className="mb-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs text-muted">{found} {found === 1 ? "result" : "results"}</span>
            {jumps.map(([id, label, count]) => <a key={id} href={`#${id}`} className="adm-tag hover:text-fg">{label} {count}</a>)}
          </nav>
          <div className="adm-stack">
            <Results id="orders" title="Orders" icon={Receipt} count={results.orders.length} all={`/admin/orders?q=${encoded}`}>
              {results.orders.map((order) => <Row key={order.id} href={`/admin/orders/${order.id}`} title={orderRef(order.number)} meta={`${order.email ?? "No email"}, ${money(order.totalCents)}`} tag={<StatusBadge status={order.status} />} />)}
            </Results>
            <Results id="customers" title="Customers" icon={UsersThree} count={results.customers.length} all={`/admin/customers?q=${encoded}`}>
              {results.customers.map((customer) => <Row key={customer.id} href={`/admin/customers/${customer.id}`} title={customer.name} meta={customer.email} tag={customer.blockedAt ? <StatusDot tone="danger">Blocked</StatusDot> : customer.role === "admin" ? <Tag>Admin</Tag> : undefined} />)}
            </Results>
            <Results id="products" title="Products" icon={ShoppingBag} count={results.products.length} all={`/admin/products?q=${encoded}`}>
              {results.products.map((product) => <Row key={product.id} href={`/admin/products/${product.id}`} title={product.name} meta={product.slug} tag={product.active ? undefined : <StatusDot tone="muted">Inactive</StatusDot>} />)}
            </Results>
            <Results id="bespoke" title="Bespoke requests" icon={Scissors} count={results.bespoke.length} all="/admin/bespoke">
              {results.bespoke.map((request) => <Row key={request.id} href={`/admin/bespoke/${request.id}`} title={bespokeRef(request.number)} meta={`${request.name}, ${request.email}`} tag={<BespokeBadge status={request.status} />} />)}
            </Results>
            <Results id="messages" title="Messages" icon={ChatCircleText} count={results.messages.length} all={`/admin/messages?q=${encoded}`}>
              {results.messages.map((message) => <Row key={message.id} href={`/admin/messages/${message.id}`} title={message.name} meta={`${message.email}, ${message.topic}`} tag={message.handled ? <StatusDot tone="muted">Done</StatusDot> : <StatusDot tone="warn">Open</StatusDot>} />)}
            </Results>
          </div>
        </>
      )}
    </>
  );
}
