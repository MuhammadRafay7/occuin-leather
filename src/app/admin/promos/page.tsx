import type { Metadata } from "next";
import { setPromoActive } from "@/lib/actions/admin";
import { money } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { ActionButton } from "../_components/controls";
import { AdminTitle, Empty, Section, Table, Tag } from "../_components/ui";
import { dateTime } from "../_lib/format";
import { listPromos } from "../_lib/queries";
import { PromoForm } from "./promo-form";

export const metadata: Metadata = { title: "Promo codes" };

export default async function AdminPromos() {
  await requireAdmin();
  const promos = await listPromos();
  const now = new Date();

  return (
    <>
      <AdminTitle>Promo codes</AdminTitle>
      <PromoForm />
      <Section title="All codes">
        {promos.length ? (
          <Table caption="Promo codes" head={["Code", "Off", "Minimum", "Expires", "Status", "Times used", "Action"]}>
            {promos.map((promo) => {
              const expired = promo.expiresAt !== null && promo.expiresAt <= now;
              return (
                <tr key={promo.code}>
                  <td className="whitespace-nowrap font-medium">{promo.code}</td>
                  <td className="tabular-nums">{promo.percentOff}%</td>
                  <td className="tabular-nums">{promo.minSubtotalCents ? money(promo.minSubtotalCents) : "None"}</td>
                  <td className="whitespace-nowrap">{promo.expiresAt ? dateTime(promo.expiresAt) : "Never"}</td>
                  <td>
                    {expired ? <Tag tone="danger">Expired</Tag> : <Tag tone={promo.active ? "plain" : "muted"}>{promo.active ? "Active" : "Inactive"}</Tag>}
                  </td>
                  <td className="tabular-nums">{promo.timesUsed}</td>
                  <td>
                    <ActionButton action={setPromoActive.bind(null, promo.code, !promo.active)}>
                      {promo.active ? "Deactivate" : "Activate"}
                    </ActionButton>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title="No promo codes yet" body="Create a code above and it will appear here." />
        )}
      </Section>
    </>
  );
}
