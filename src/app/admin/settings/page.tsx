import type { Metadata } from "next";
import { BRAND } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { demoPaymentsAllowed, getSettings, paymentModeOf, stripeConfigured } from "@/lib/server/settings";
import { AdminTitle } from "../_components/ui";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

const dollars = (cents: number) => (cents / 100).toFixed(2);

export default async function AdminSettings() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <AdminTitle sub="Changes reach your store as soon as you save.">Settings</AdminTitle>
      <SettingsForm
        fallbackEmail={BRAND.email}
        stripeReady={stripeConfigured() || demoPaymentsAllowed()}
        initial={{
          announcement: settings.announcement,
          freeShipping: dollars(settings.freeShippingCents),
          standardShipping: dollars(settings.standardShippingCents),
          expressShipping: dollars(settings.expressShippingCents),
          ordersPaused: settings.ordersPaused,
          ordersPausedMessage: settings.ordersPausedMessage,
          lowStockLimit: String(settings.lowStockLimit),
          supportEmail: settings.supportEmail,
          whatsappNumber: settings.whatsappNumber,
          paymentMode: paymentModeOf(settings),
          autoCancelDays: String(settings.autoCancelDays),
        }}
      />
    </>
  );
}
