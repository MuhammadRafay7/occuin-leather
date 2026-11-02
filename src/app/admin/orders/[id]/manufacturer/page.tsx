import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { orderRef } from "@/lib/format";
import { lineNeedsViews, buildSheet } from "@/lib/manufacturer/sheet";
import { SHEET_VIEW_KEYS } from "@/lib/manufacturer/views";
import { requireAdmin } from "@/lib/server/auth";
import { LINK_DAYS, linkUrl, listLinks, loadOrderForSheet, parseUuid, sheetFiles, sheetOrder } from "@/lib/server/manufacturer";
import { AdminTitle, DetailGrid, linkClass, Panel, StatusBadge, Table } from "../../../_components/ui";
import { dateTime } from "../../../_lib/format";
import { LinkRow, RemakeViews, SentToggle, SheetLinks } from "./controls";
import { ViewMaker, type ViewJob } from "./view-maker";

export const metadata: Metadata = { title: "Manufacturer sheet" };

const KIND_LABELS = { studio: "Studio design", bespoke: "Bespoke", product: "Standard product", payment: "Balance payment", unknown: "No details stored" };

export default async function ManufacturerSheetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const orderId = parseUuid((await params).id);
  const order = orderId ? await loadOrderForSheet(orderId) : null;
  if (!order) notFound();
  const [files, links] = await Promise.all([sheetFiles(order.id), listLinks(order.id)]);
  const sheet = buildSheet(sheetOrder(order), files, { includeAddress: false });
  const jobs: ViewJob[] = order.items.flatMap((item) => {
    if (!lineNeedsViews(item)) return [];
    const held = files.filter((file) => file.orderItemId === item.id && file.kind === "view").map((file) => file.slot);
    const missing = SHEET_VIEW_KEYS.filter((view) => !held.includes(view));
    return missing.length ? [{ itemId: item.id, name: item.name, missing, spec: item.designSpec, design: item.designSpec ? null : item.bespokeSnapshot!.design }] : [];
  });
  const base = `/admin/orders/${order.id}/manufacturer`;
  const canShare = !["pending", "cancelled", "refunded"].includes(order.status);
  const now = new Date();

  return (
    <>
      <AdminTitle back={{ href: `/admin/orders/${order.id}`, label: orderRef(order.number) }} meta={<StatusBadge status={order.status} />} sub="Everything your manufacturer needs for this order: exact details and images. It shows no prices and no customer contact details.">
        Manufacturer sheet
      </AdminTitle>
      <DetailGrid
        main={(
          <>
            <Panel title="Order lines" flush>
              <Table caption="Order lines on the sheet" head={["Item", "Type", "Images", "Sent"]} minWidth="min-w-[560px]">
                {sheet.lines.map((line) => {
                  const item = order.items.find((entry) => entry.id === line.id)!;
                  return (
                    <tr key={line.id}>
                      <td className="font-medium">{line.title}<span className="block text-xs text-muted">Quantity {line.quantity}</span></td>
                      <td>{KIND_LABELS[line.kind]}</td>
                      <td>
                        {line.kind === "studio" || line.kind === "bespoke" ? (
                          <div className="grid justify-items-start gap-1">
                            <span>{line.pictures.length} of {SHEET_VIEW_KEYS.length}</span>
                            {line.pictures.length ? <RemakeViews orderId={order.id} itemId={line.id} /> : null}
                          </div>
                        ) : line.kind === "product" ? `${line.pictures.length} photos` : "None"}
                      </td>
                      <td>{line.kind === "payment" ? "Nothing to send" : <><SentToggle orderId={order.id} itemId={line.id} sent={Boolean(item.sentToMakerAt)} />{item.sentToMakerAt ? <span className="mt-0.5 block text-xs text-muted">{dateTime(item.sentToMakerAt)}, {item.sentToMakerBy}</span> : null}</>}</td>
                    </tr>
                  );
                })}
              </Table>
            </Panel>
            <Panel title="3D images">
              <ViewMaker key={jobs.map((job) => `${job.itemId}:${job.missing.length}`).join()} orderId={order.id} jobs={jobs} />
            </Panel>
            <Panel title="Private links">
              {links.length ? (
                <ul className="grid gap-3">
                  {links.map((link) => {
                    const active = !link.revokedAt && link.expiresAt > now;
                    return (
                      <li key={link.id} className="grid gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
                        <p>
                          {link.revokedAt ? `Turned off ${dateTime(link.revokedAt)}` : active ? `Works until ${dateTime(link.expiresAt)}` : `Ended ${dateTime(link.expiresAt)}`}
                          {link.includeAddress ? ", with delivery address" : ""}
                        </p>
                        <p className="text-xs text-muted">Made by {link.createdBy}, {dateTime(link.createdAt)}. {link.lastOpenedAt ? `Last opened ${dateTime(link.lastOpenedAt)}.` : "Not opened yet."}</p>
                        <LinkRow orderId={order.id} linkId={link.id} url={linkUrl(link)} active={active} />
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-muted">No links yet. A link opens this sheet without a login, for this order only.</p>}
            </Panel>
          </>
        )}
        side={(
          <>
            <Panel title="Print or share">
              <SheetLinks base={base} canShare={canShare} linkDays={LINK_DAYS} orderId={order.id} />
            </Panel>
            <Panel title="Dates">
              <p>Required by {sheet.requiredBy ?? "not set"}.</p>
              <p className="mt-1 text-xs text-muted">From the making time when this order was placed.</p>
            </Panel>
            {order.status === "pending" ? <Panel title="Not paid yet"><p>This order has not been paid. Wait for payment before starting work.</p></Panel> : null}
            <p className="px-1 text-xs text-muted"><Link href={`/admin/orders/${order.id}`} className={linkClass}>Back to the order</Link></p>
          </>
        )}
      />
    </>
  );
}
