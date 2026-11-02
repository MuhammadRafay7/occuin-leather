import { ArrowsLeftRight, Cube, Tag as PriceTag } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { StatStrip, Thumb } from "../../_components/catalog-ui";
import { AdminTitle, buttonClass, DetailGrid, Empty, MetricCard, Pagination, StatusDot, Table } from "../../_components/ui";
import { dateTime, type SearchParams } from "../../_lib/format";
import { pageOf } from "../../_lib/queries";
import { countMovements, getVariant, listMovements } from "../../_lib/queries-catalog";
import { AdjustForm } from "./adjust-form";

export const metadata: Metadata = { title: "Stock history" };

const signed = (delta: number) => (delta > 0 ? `+${delta}` : String(delta));

export default async function StockHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const row = await getVariant(parsed.data);
  if (!row) notFound();
  const search = await searchParams;
  const total = await countMovements(row.variant.id);
  const { page, last, offset } = pageOf(search, total);
  const movements = await listMovements(row.variant.id, offset);
  const path = `/admin/inventory/${row.variant.id}`;

  return (
    <>
      <AdminTitle
        back={{ href: "/admin/inventory", label: "Stock" }}
        sub={`Every stock change for ${row.variant.color}, ${row.variant.size}.`}
        meta={row.variant.stock === 0 ? <StatusDot tone="danger">Sold out</StatusDot> : undefined}
        action={<Link href={`/admin/products/${row.variant.productId}`} className={buttonClass}>Edit product</Link>}
      >
        {row.productName}
      </AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<Cube size={18} />} label="In stock" value={row.variant.stock} />
        <MetricCard icon={<PriceTag size={18} />} label="Price" value={money(row.variant.priceCents)} />
        <MetricCard icon={<ArrowsLeftRight size={18} />} label="Changes" value={total} />
      </StatStrip>
      <DetailGrid
        main={movements.length ? (
          <div>
            <ul className="adm-list lg:hidden">
              {movements.map((movement) => (
                <li key={movement.id} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2">
                  <span className="font-medium">{movement.reason}</span>
                  <span className="text-right tabular-nums">{signed(movement.delta)}</span>
                  <span className="min-w-0 break-words text-xs text-muted">{dateTime(movement.createdAt)}, {movement.actorEmail ?? "System"}</span>
                  <span className="text-right text-xs tabular-nums text-muted">{movement.stockAfter} left</span>
                </li>
              ))}
            </ul>
            <div className="hidden lg:block">
              <Table caption="Stock history" head={["When", "Change", "Left after", "Reason", "By"]} right={["Change", "Left after"]} minWidth="min-w-[620px]">
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="whitespace-nowrap text-muted">{dateTime(movement.createdAt)}</td>
                    <td className="tabular-nums">{signed(movement.delta)}</td>
                    <td className="tabular-nums">{movement.stockAfter}</td>
                    <td>{movement.reason}</td>
                    <td>{movement.actorEmail ?? "System"}</td>
                  </tr>
                ))}
              </Table>
            </div>
            <Pagination path={path} search={search} page={page} last={last} total={total} />
          </div>
        ) : (
          <Empty title="No changes yet" body="Stock changes show here from now on." />
        )}
        side={
          <>
            <div className="adm-card flex items-center gap-3 p-3">
              <Thumb src={row.productImage} size={56} />
              <div className="min-w-0">
                <p className="truncate font-medium">{row.productName}</p>
                <p className="truncate text-xs text-muted">Product code: {row.variant.sku}</p>
              </div>
            </div>
            <AdjustForm variantId={row.variant.id} stock={row.variant.stock} />
          </>
        }
      />
    </>
  );
}
