import { PencilSimple, Percent, Plus, Power, Ticket, Trash, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { setPromoActive } from "@/lib/actions/admin";
import { deleteOrDeactivatePromo } from "@/lib/actions/admin-orders";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { ActionButton } from "../_components/controls";
import { AdminTitle, buttonClass, Empty, linkClass, MetricCard, Table, Tag } from "../_components/ui";
import { shortDate } from "../_lib/format";
import { listPromosWithUsage, promoIsUsed } from "../_lib/queries-orders";
import { DesktopOnly, MobileCard, MobileCards, Reveal, StatStrip } from "../orders/sales-ui";
import { ConfirmActionButton } from "./confirm-button";
import { PromoForm } from "./promo-form";

export const metadata: Metadata = { title: "Discount codes" };

type Promo = Awaited<ReturnType<typeof listPromosWithUsage>>[number];

const isExpired = (promo: Promo, now: Date) => promo.expiresAt !== null && promo.expiresAt <= now;

const uses = (promo: Promo) => `${promo.paidOrders}${promo.maxUses ? ` of ${promo.maxUses}` : ""}`;

function PromoStatus({ promo, now }: { promo: Promo; now: Date }) {
  if (isExpired(promo, now)) return <Tag tone="danger">Expired</Tag>;
  return <Tag tone={promo.active ? "success" : "muted"}>{promo.active ? "Active" : "Inactive"}</Tag>;
}

function PromoActions({ promo }: { promo: Promo }) {
  return (
    <>
      <Link href={`/admin/promos/${encodeURIComponent(promo.code)}`} aria-label={`Edit ${promo.code}`} className={buttonClass}><PencilSimple size={14} aria-hidden="true" />Edit</Link>
      <ActionButton action={setPromoActive.bind(null, promo.code, !promo.active)}>
        <Power size={14} aria-hidden="true" />{promo.active ? "Turn off" : "Turn on"}
      </ActionButton>
      {promoIsUsed(promo) ? null : (
        <ConfirmActionButton danger action={deleteOrDeactivatePromo.bind(null, promo.code)} confirm={`Delete the code ${promo.code}? Customers will not be able to use it, and you cannot undo this.`}>
          <Trash size={14} aria-hidden="true" />Delete
        </ConfirmActionButton>
      )}
    </>
  );
}

export default async function AdminPromos() {
  await requireAdmin();
  const promos = await listPromosWithUsage();
  const now = new Date();
  const live = promos.filter((promo) => promo.active && !isExpired(promo, now)).length;
  const sum = (pick: (promo: Promo) => number) => promos.reduce((total, promo) => total + pick(promo), 0);

  return (
    <>
      <AdminTitle sub="Discount codes customers can type in at checkout.">Discount codes</AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<Ticket size={16} />} label="Codes in use" value={live} description={`${promos.length} in total`} />
        <MetricCard icon={<TrendUp size={16} />} label="Sales with a code" value={money(sum((promo) => promo.revenueCents))} description="After refunds" />
        <MetricCard icon={<Percent size={16} />} label="Discounts given" value={money(sum((promo) => promo.discountCents))} />
      </StatStrip>

      <Reveal label="New code" primary open={promos.length === 0} icon={<Plus size={14} aria-hidden="true" className="transition-transform group-open:rotate-45" />} className="mb-3">
        <div className="adm-card"><PromoForm /></div>
      </Reveal>

      {promos.length ? (
        <>
          <DesktopOnly>
            <Table caption="Discount codes" head={["Code", "Discount", "Status", "Times used", "Sales", "Actions"]} right={["Discount", "Times used", "Sales", "Actions"]} minWidth="min-w-[880px]">
              {promos.map((promo) => (
                <tr key={promo.code}>
                  <td className="whitespace-nowrap font-medium">
                    <Link href={`/admin/promos/${encodeURIComponent(promo.code)}`} className={linkClass}>{promo.code}</Link>
                    <span className="block text-xs font-normal text-muted">{promo.expiresAt ? `Ends ${shortDate(promo.expiresAt)}` : "No end date"}</span>
                  </td>
                  <td className="tabular-nums">{promo.percentOff}%</td>
                  <td><PromoStatus promo={promo} now={now} /></td>
                  <td className="tabular-nums whitespace-nowrap">{uses(promo)}</td>
                  <td className="font-medium tabular-nums">{money(promo.revenueCents)}</td>
                  <td>
                    <div className="flex flex-wrap items-start justify-end gap-1"><PromoActions promo={promo} /></div>
                  </td>
                </tr>
              ))}
            </Table>
          </DesktopOnly>
          <MobileCards label="Discount codes">
            {promos.map((promo) => (
              <MobileCard
                key={promo.code}
                title={<Link href={`/admin/promos/${encodeURIComponent(promo.code)}`} className={linkClass}>{promo.code}</Link>}
                sub={`${promo.percentOff}% off, ${promo.expiresAt ? `ends ${shortDate(promo.expiresAt)}` : "no end date"}`}
                chip={<PromoStatus promo={promo} now={now} />}
                rows={[
                  ["Times used", uses(promo)],
                  ["Sales", money(promo.revenueCents)],
                ]}
              >
                <PromoActions promo={promo} />
              </MobileCard>
            ))}
          </MobileCards>
        </>
      ) : (
        <Empty title="No discount codes yet" body="Use New code above to make your first one." />
      )}
    </>
  );
}
