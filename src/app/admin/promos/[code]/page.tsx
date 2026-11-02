import { Percent, Receipt, TrendUp } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { deleteOrDeactivatePromo } from "@/lib/actions/admin-orders";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { AdminTitle, DetailGrid, MetricCard, Panel } from "../../_components/ui";
import { getPromoWithUsage, promoIsUsed } from "../../_lib/queries-orders";
import { StatStrip } from "../../orders/sales-ui";
import { ConfirmActionButton } from "../confirm-button";
import { PromoEditForm } from "../promo-form";

export const metadata: Metadata = { title: "Edit discount code" };

export default async function AdminPromo({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin();
  const code = decodeURIComponent((await params).code);
  const promo = await getPromoWithUsage(code);
  if (!promo) notFound();
  const used = promoIsUsed(promo);

  return (
    <>
      <AdminTitle back={{ href: "/admin/promos", label: "Discount codes" }} sub="Change what this code gives. Past orders stay as they were. The code name itself cannot change.">
        {promo.code}
      </AdminTitle>
      <StatStrip columns={3}>
        <MetricCard icon={<Receipt size={16} />} label="Paid orders" value={promo.paidOrders} description={`Used ${promo.claimed} ${promo.claimed === 1 ? "time" : "times"} in all`} />
        <MetricCard icon={<TrendUp size={16} />} label="Sales with this code" value={money(promo.revenueCents)} description="After refunds" />
        <MetricCard icon={<Percent size={16} />} label="Discounts given" value={money(promo.discountCents)} />
      </StatStrip>
      <DetailGrid
        main={(
          <Panel title="Edit code">
            <PromoEditForm
              initial={{
                code: promo.code,
                percentOff: String(promo.percentOff),
                minSubtotal: (promo.minSubtotalCents / 100).toFixed(2),
                expiresOn: promo.expiresAt ? promo.expiresAt.toISOString().slice(0, 10) : "",
                maxUses: promo.maxUses === null ? "" : String(promo.maxUses),
                oncePerCustomer: promo.oncePerCustomer,
              }}
            />
          </Panel>
        )}
        side={(
          <Panel title={used ? "Turn off this code" : "Delete this code"}>
            <div className="grid justify-items-start gap-2">
              <p className="text-muted">{used ? "Customers have used this code, so it stays on record. You can turn it off so nobody else can use it." : "Nobody has used this code yet, so you can delete it completely."}</p>
              <ConfirmActionButton
                danger
                action={deleteOrDeactivatePromo.bind(null, promo.code, true)}
                confirm={used ? `Turn off ${promo.code}? Customers will not be able to use it.` : `Delete the code ${promo.code}? You cannot undo this.`}
              >
                {used ? "Turn off" : "Delete"}
              </ConfirmActionButton>
            </div>
          </Panel>
        )}
      />
    </>
  );
}
